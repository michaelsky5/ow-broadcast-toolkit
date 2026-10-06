import { DEFAULT_CAPTURE } from '../../../project/statsCaptureConfig.js'
import { analyzeStatsCandidateRows, buildCropAssets, mergeStatsCandidateRows, parseStatsLineDetailed } from './statsCaptureUtils.js'
import { STAT_FIELDS, TEAM_KEYS } from './statsCaptureReview.js'
import { applyScoreboardOcrReviewGuard, selectMatchTimeOcrCandidates } from './statsCaptureTimeReview.js'
import { buildStatsCellVariants, selectStatsCellCandidate } from './statsCellOcr.js'

const ROW_PARAMS = { tessedit_char_whitelist: '0123456789,.: oOlIi|zZsSqQdDhHnNcC ', tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' }
const TIME_PARAMS = { tessedit_char_whitelist: '0123456789:：.,; oOlIi|SsZzBbQqDdFPSfps', tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' }
export const OCR_ENGINE_INIT_TIMEOUT_MS = 120_000
export const OCR_OPERATION_TIMEOUT_MS = 30_000

const engineError = (code, cause) => Object.assign(new Error(code), { name: 'OcrEngineError', code, cause })
const assertActive = signal => { if (signal?.aborted) throw engineError('OCR_CANCELLED') }

export const getOcrRuntimeUrls = (base = new URL(import.meta.env?.BASE_URL || '/', globalThis.location?.origin || 'http://localhost/').href) => {
  const runtime = new URL('ocr-runtime/', base).href
  return { workerPath: `${runtime}worker.min.js`, corePath: `${runtime}core/tesseract-core-lstm.wasm.js`, langPath: `${runtime}lang` }
}

export const withOcrOperation = async (operation, { signal, timeoutMs = OCR_OPERATION_TIMEOUT_MS, timeoutCode = 'OCR_READ_TIMEOUT' } = {}) => {
  assertActive(signal)
  let timer
  let abort
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(engineError(timeoutCode)), timeoutMs)
    abort = () => reject(engineError('OCR_CANCELLED'))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
  try { return await Promise.race([Promise.resolve().then(() => { assertActive(signal); return operation() }), guard]) }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}

export const createBrowserOcrEngine = (providedWorker) => {
  const nativeWorker = providedWorker || new Worker(new URL('./statsOcrEngineWorker.js', import.meta.url), { type: 'module' })
  const jobs = new Map()
  let nextId = 0
  let terminated = false
  let logger = () => {}
  const request = (type, payload) => new Promise((resolve, reject) => {
    if (terminated) { reject(engineError('OCR_CANCELLED')); return }
    const id = ++nextId
    jobs.set(id, { resolve, reject })
    try { nativeWorker.postMessage({ id, type, payload }) }
    catch (error) { jobs.delete(id); reject(error) }
  })
  nativeWorker.onmessage = ({ data }) => {
    if (terminated) return
    if (data.type === 'progress') { logger(data.message); return }
    const job = jobs.get(data.id)
    if (!job) return
    jobs.delete(data.id)
    if (data.error) job.reject(new Error(data.error))
    else job.resolve(data.result)
  }
  nativeWorker.onerror = event => {
    const error = new Error(event.message || 'OCR worker failed')
    for (const job of jobs.values()) job.reject(error)
    jobs.clear()
  }
  return {
    initialize: options => {
      const { logger: nextLogger, ...serializable } = options
      logger = nextLogger || logger
      return request('initialize', serializable)
    },
    setParameters: parameters => request('setParameters', parameters),
    recognize: image => request('recognize', image),
    terminate: async () => {
      if (terminated) return
      terminated = true
      nativeWorker.terminate()
      for (const job of jobs.values()) job.reject(engineError('OCR_CANCELLED'))
      jobs.clear()
    }
  }
}

export const initializeOcrWorker = async (options = {}, timeoutMs = OCR_ENGINE_INIT_TIMEOUT_MS, spawnEngine = createBrowserOcrEngine) => {
  const { signal, ...workerOptions } = options
  assertActive(signal)
  let engine
  try {
    engine = spawnEngine()
    await withOcrOperation(() => engine.initialize(workerOptions), { signal, timeoutMs, timeoutCode: 'OCR_ENGINE_INIT_TIMEOUT' })
    return engine
  } catch (error) {
    await engine?.terminate().catch(() => {})
    throw error?.code ? error : engineError('OCR_ENGINE_INIT_FAILED', error)
  }
}

const scoreCandidate = candidate => {
  const values = STAT_FIELDS.map(field => String(candidate.parsed.row[field] ?? ''))
  const complete = values.filter(Boolean).length
  return candidate.parsed.score + complete * 35 - (6 - complete) * 90 + (Number(candidate.confidence) || 0) * 0.25
}
const unique = images => [...new Set((images || []).filter(Boolean))]

export async function runStatsCaptureOcr(imageDataUrl, options = {}, dependencies = {}) {
  const { capture = DEFAULT_CAPTURE, signal, onProgress = () => {}, engineInitTimeoutMs = OCR_ENGINE_INIT_TIMEOUT_MS, operationTimeoutMs = OCR_OPERATION_TIMEOUT_MS } = options
  assertActive(signal)
  if (!imageDataUrl) throw engineError('OCR_IMAGE_REQUIRED')
  onProgress({ stage: 'prepare', progress: 5 })
  let assets
  try { assets = await (dependencies.buildCropAssets || buildCropAssets)(imageDataUrl, capture) }
  catch (cause) { throw engineError('OCR_IMAGE_FAILED', cause) }
  assertActive(signal)
  onProgress({ stage: 'loading', progress: 10, assets })
  let loadingEngine = true
  const worker = await (dependencies.initializeOcrWorker || initializeOcrWorker)({
    ...getOcrRuntimeUrls(), workerBlobURL: false, cacheMethod: 'write', cachePath: 'owbt-ocr-v7-eng-best-int-v1', signal,
    logger: message => { if (loadingEngine) onProgress({ stage: 'loading', progress: 10 + Math.round((message.progress || 0) * 10) }) }
  }, engineInitTimeoutMs)
  loadingEngine = false
  const run = operation => withOcrOperation(operation, { signal, timeoutMs: operationTimeoutMs })
  const numericDiagnostics = { teamA: [], teamB: [] }
  const rows = { teamA: [], teamB: [] }
  const texts = { teamA: [], teamB: [] }
  try {
    await run(() => worker.setParameters(ROW_PARAMS))
    for (const [teamIndex, team] of TEAM_KEYS.entries()) {
      for (let index = 0; index < 5; index += 1) {
        const progress = 20 + (teamIndex * 5 + index) * 6
        onProgress({ stage: 'row', team, index, progress })
        const variants = assets.rowZoneVariants?.[team]?.[index] || []
        const images = unique([assets.rowZones[team][index], ...variants])
        const candidates = []
        for (const image of images) {
          const result = await run(() => worker.recognize(image))
          const text = result.data.text || ''
          candidates.push({ text: text.trim(), parsed: parseStatsLineDetailed(text), confidence: result.data.confidence,
            candidateIndex: image === variants[2] ? 3 : 0 })
        }
        const best = candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0]
        const candidateRows = candidates.map(candidate => candidate.parsed.row)
        const merged = mergeStatsCandidateRows(best?.parsed.row, candidateRows)
        const diagnostics = analyzeStatsCandidateRows(merged, candidateRows, candidates)
        const pending = STAT_FIELDS.filter(field => !diagnostics[field].autoApply)
        if (pending.length && assets.snippets?.[team]?.[index]) {
          await run(() => worker.setParameters({ ...ROW_PARAMS, tessedit_char_whitelist: '0123456789,' }))
          for (const field of pending) {
            onProgress({ stage: 'cell', team, index, field, progress })
            const images = await (dependencies.buildStatsCellVariants || buildStatsCellVariants)(assets.snippets[team][index], field, variants[2])
            const reads = []
            for (const { image, preprocessing } of images) {
              const result = await run(() => worker.recognize(image))
              reads.push({ preprocessing, text: result.data.text, confidence: result.data.confidence })
            }
            const cellReview = selectStatsCellCandidate(diagnostics[field], reads)
            merged[field] = cellReview.selectedValue
            diagnostics[field] = { ...diagnostics[field], selectedValue: cellReview.selectedValue, autoApply: false, cellReview }
          }
          await run(() => worker.setParameters(ROW_PARAMS))
        }
        texts[team].push(best?.text || '')
        rows[team].push(merged)
        numericDiagnostics[team].push(diagnostics)
      }
    }
    const candidates = []
    const timeImages = unique([assets.timeZone, ...(assets.timeZoneVariants || [])])
    const isolatedIndex = timeImages.indexOf(assets.isolatedTimeZone)
    for (const [candidateIndex, image] of timeImages.entries()) {
      for (const pageSegMode of ['7', '8', '13']) {
        onProgress({ stage: 'time', progress: 85 })
        await run(() => worker.setParameters({ ...TIME_PARAMS, tessedit_pageseg_mode: pageSegMode }))
        const result = await run(() => worker.recognize(image))
        candidates.push({ rawText: result.data.text, confidence: result.data.confidence, candidateIndex, pageSegMode })
      }
    }
    const review = applyScoreboardOcrReviewGuard(numericDiagnostics, selectMatchTimeOcrCandidates(candidates, isolatedIndex))
    assertActive(signal)
    onProgress({ stage: 'complete', progress: 100 })
    return { ...rows, assets, numericDiagnostics: review.numericDiagnostics, timeReview: review.timeOcrReview,
      reviewWarning: review.reviewWarning,
      rawText: `${texts.teamA.join('\n')}\n\n---\n${texts.teamB.join('\n')}`.trim() }
  } catch (error) {
    throw error?.code ? error : engineError('OCR_READ_FAILED', error)
  } finally { await worker.terminate().catch(() => {}) }
}
