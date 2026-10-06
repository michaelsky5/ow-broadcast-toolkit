import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeStatsCandidateRows, parseMatchTimeOcr, parseStatsLine } from '../src/app/editors/data-center/statsCaptureUtils.js'
import { STAT_FIELDS, isCaptureCellPending, isCaptureTimePending, isDurationInputValid, reviewCaptureDiagnostics, reviewCaptureRow, validateCaptureData } from '../src/app/editors/data-center/statsCaptureReview.js'
import { applyScoreboardOcrReviewGuard, selectMatchTimeOcrCandidates } from '../src/app/editors/data-center/statsCaptureTimeReview.js'
import { createBrowserOcrEngine, getOcrRuntimeUrls, initializeOcrWorker, runStatsCaptureOcr, withOcrOperation } from '../src/app/editors/data-center/runStatsCaptureOcr.js'
import { selectStatsCellCandidate } from '../src/app/editors/data-center/statsCellOcr.js'

const correctRow = parseStatsLine('5 11 7 1,476 2,436 24')
const otherRow = { ...correctRow, dmg: '1478' }
const diagnostic = autoApply => Object.fromEntries(STAT_FIELDS.map(field => [field, { selectedValue: correctRow[field], autoApply }]))
const validInput = () => ({ rows: { teamA: [correctRow], teamB: [] }, playerIds: { teamA: ['a1'] },
  playerOptions: { teamA: [{ id: 'a1' }, { id: 'a2' }], teamB: [{ id: 'b1' }] },
  timeInput: '6:22', bindingsReviewed: true })
const makeAssets = () => ({
  rowZones: Object.fromEntries(['teamA', 'teamB'].map(team => [team, Array.from({ length: 5 }, (_, i) => team + i + '-binary')])),
  rowZoneVariants: Object.fromEntries(['teamA', 'teamB'].map(team => [team, Array.from({ length: 5 }, (_, i) => ['loose', 'thick', 'gray'].map(mode => team + i + '-' + mode))])),
  timeZone: 'time-original', isolatedTimeZone: 'time-tight', timeZoneVariants: ['time-tight', 'time-orange', 'time-bright']
})

 test('time parsing selects game time and refuses FPS / invalid seconds', () => {
  assert.equal(parseMatchTimeOcr('FPS:263 时间: 6:22'), '6:22')
  assert.equal(parseMatchTimeOcr('6：22'), '6:22')
  assert.equal(parseMatchTimeOcr('FPS:263'), '')
  assert.equal(isDurationInputValid('6:99'), false)
  assert.equal(isDurationInputValid('0:00'), false)
  assert.equal(isDurationInputValid('0:22'), true)
  assert.equal(isDurationInputValid('6.3667'), true)
  assert.equal(isDurationInputValid(''), false)
 })

 test('credible grayscale dissent keeps a repeated binary mistake pending', () => {
  const candidates = [otherRow, otherRow, otherRow, correctRow]
  const metadata = candidates.map((row, i) => ({ parsed: { row }, candidateIndex: i === 3 ? 3 : 0, confidence: 90 }))
  const review = analyzeStatsCandidateRows(otherRow, candidates, metadata)
  assert.equal(review.dmg.supportCount, 3)
  assert.equal(review.dmg.hasCredibleIndependentDissent, true)
  assert.equal(review.dmg.autoApply, false)
  assert.equal(review.elim.autoApply, true)
 })

 test('cell rereads improve a supported suggestion while preserving human review', () => {
  const result = selectStatsCellCandidate({ selectedValue: '1478', alternatives: [{ value: '1476' }, { value: '1478' }] }, [
    { preprocessing: 'grayscale', text: '1,476', confidence: 95 },
    { preprocessing: 'contrast', text: '1476', confidence: 92 }
  ])
  assert.equal(result.selectedValue, '1476')
  assert.equal(isCaptureCellPending({ selectedValue: result.selectedValue, autoApply: false }, '1476'), true)
  assert.equal(selectStatsCellCandidate({ selectedValue: '1478', alternatives: [] }, [
    { preprocessing: 'grayscale', text: '1476', confidence: 95 },
    { preprocessing: 'contrast', text: '1476', confidence: 92 }
  ]).selectedValue, '1478')
 })

 test('several page modes of one ordinary time image are not independent consensus', () => {
  const readings = ['7', '8', '13'].map(pageSegMode => ({ rawText: '6:22', confidence: 90, candidateIndex: 0, pageSegMode }))
  assert.equal(selectMatchTimeOcrCandidates(readings).autoApply, false)
  assert.equal(selectMatchTimeOcrCandidates([...readings, { rawText: '6:22', confidence: 90, candidateIndex: 1 }]).autoApply, true)
  assert.equal(selectMatchTimeOcrCandidates([]).value, '')
 })

 test('widespread disagreement requires every number and time to be checked', () => {
  const diagnostics = { teamA: [diagnostic(true), diagnostic(true)], teamB: [] }
  for (const field of STAT_FIELDS.slice(0, 3)) diagnostics.teamA[0][field].autoApply = false
  const review = applyScoreboardOcrReviewGuard(diagnostics, { value: '6:22', autoApply: true })
  assert.ok(review.reviewWarning)
  assert.equal(review.numericDiagnostics.teamA[1].dmg.autoApply, false)
  assert.equal(review.timeOcrReview.autoApply, false)
 })

 test('zeros are data; empty, missing, stale and unreviewed assignments block apply', () => {
  const input = validInput()
  input.rows.teamA[0] = Object.fromEntries(STAT_FIELDS.map(field => [field, '0']))
  assert.equal(validateCaptureData(input).canApply, true)
  assert.equal(validateCaptureData({ ...input, bindingsReviewed: false }).canApply, false)
  assert.equal(validateCaptureData({ ...input, stale: true }).canApply, false)
  assert.equal(validateCaptureData({ ...input, timeInput: '6:99' }).canApply, false)
  input.rows.teamA[0] = { ...input.rows.teamA[0], elim: '' }
  assert.ok(validateCaptureData(input).issues.some(issue => issue.kind === 'missing'))
  assert.ok(validateCaptureData({ ...input, rows: { teamA: [], teamB: [] } }).issues.some(issue => issue.kind === 'empty'))
 })

 test('duplicate and cross-team player bindings cannot be applied', () => {
  const input = validInput()
  input.rows.teamA.push(correctRow)
  input.playerIds.teamA.push('a1')
  assert.ok(validateCaptureData(input).issues.some(issue => issue.kind === 'duplicate'))
  input.playerIds.teamA[1] = 'b1'
  assert.ok(validateCaptureData(input).issues.some(issue => issue.kind === 'player'))
 })

 test('review acknowledgements are tied to the exact number and time', () => {
  const input = validInput()
  const diagnostics = { teamA: [diagnostic(false)], teamB: [] }
  assert.equal(validateCaptureData({ ...input, diagnostics }).pending.length, 6)
  const reviewed = reviewCaptureDiagnostics(diagnostics, input.rows)
  assert.equal(validateCaptureData({ ...input, diagnostics: reviewed }).canApply, true)
  assert.equal(isCaptureCellPending(reviewed.teamA[0].dmg, '1478'), true)
  assert.equal(isCaptureTimePending({ value: '6:22', autoApply: false, reviewedValue: '6:22' }, '6:23'), true)
 })

 test('runtime URLs stay on the active host and support a base path', () => {
  const urls = getOcrRuntimeUrls('https://test.example/app/')
  for (const url of Object.values(urls)) assert.equal(new URL(url).origin, 'https://test.example')
  assert.equal(urls.workerPath, 'https://test.example/app/ocr-runtime/worker.min.js')
 })

 test('initialization timeout / error / cancellation terminate even an unready engine', async () => {
  for (const outcome of ['timeout', 'error', 'cancel']) {
    let terminated = 0
    const controller = new AbortController()
    const engine = { initialize: () => outcome === 'error' ? Promise.reject(new Error('model unavailable')) : new Promise(() => {}), terminate: async () => { terminated += 1 } }
    const pending = initializeOcrWorker({ signal: controller.signal }, 10, () => engine)
    if (outcome === 'cancel') controller.abort()
    await assert.rejects(pending, error => error.code === ({ timeout: 'OCR_ENGINE_INIT_TIMEOUT', error: 'OCR_ENGINE_INIT_FAILED', cancel: 'OCR_CANCELLED' })[outcome])
    assert.equal(terminated, 1)
  }
 })

 test('the browser proxy drops late worker replies after cancellation', async () => {
  const native = { messages: [], postMessage(message) { this.messages.push(message) }, terminate() { this.stopped = true } }
  const engine = createBrowserOcrEngine(native)
  const pending = engine.initialize({ logger: () => {} })
  const rejected = assert.rejects(pending, error => error.code === 'OCR_CANCELLED')
  await engine.terminate()
  native.onmessage({ data: { id: native.messages[0].id, result: 'late success' } })
  await rejected
  assert.equal(native.stopped, true)
 })

 test('operation deadlines and aborts do not wait for a hung OCR call', async () => {
  await assert.rejects(withOcrOperation(() => new Promise(() => {}), { timeoutMs: 10 }), error => error.code === 'OCR_READ_TIMEOUT')
  const controller = new AbortController()
  const pending = withOcrOperation(() => new Promise(() => {}), { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, error => error.code === 'OCR_CANCELLED')
 })

 test('a complete OCR run compares variants, reads 6:22 and cleans up the engine', async () => {
  const assets = makeAssets()
  const reads = []
  let terminated = 0
  const worker = { setParameters: async () => {}, recognize: async image => {
    reads.push(image)
    return { data: { text: image.startsWith('time-') ? '6:22' : '5 11 7 1,476 2,436 24', confidence: 90 } }
  }, terminate: async () => { terminated += 1 } }
  const result = await runStatsCaptureOcr('image', {}, { buildCropAssets: async () => assets, initializeOcrWorker: async () => worker })
  assert.equal(result.teamA.length, 5)
  assert.equal(result.teamB[4].dmg, '1476')
  assert.equal(result.timeReview.value, '6:22')
  assert.equal(result.timeReview.autoApply, true)
  assert.equal(result.numericDiagnostics.teamA[0].dmg.autoApply, true)
  assert.equal(reads.filter(image => image.startsWith('team')).length, 40)
  assert.equal(reads.filter(image => image.startsWith('time-')).length, 12)
  assert.equal(terminated, 1)
 })

 test('recognition failures and cancellation always stop the engine', async () => {
  for (const cancelled of [false, true]) {
    const controller = new AbortController()
    let terminated = 0
    const worker = { setParameters: async () => {}, recognize: async () => {
      if (cancelled) { controller.abort(); return new Promise(() => {}) }
      throw new Error('read failed')
    }, terminate: async () => { terminated += 1 } }
    await assert.rejects(runStatsCaptureOcr('image', { signal: controller.signal }, {
      buildCropAssets: async () => makeAssets(), initializeOcrWorker: async () => worker
    }), error => error.code === (cancelled ? 'OCR_CANCELLED' : 'OCR_READ_FAILED'))
    assert.equal(terminated, 1)
  }
 })

test('bundled OCR resources contain executable WASM and an intact English model', () => {
  const runtime = new URL('../public/ocr-runtime/', import.meta.url)
  const wasm = readFileSync(new URL('core/tesseract-core-lstm.wasm', runtime))
  assert.deepEqual([...wasm.subarray(0, 8)], [0, 97, 115, 109, 1, 0, 0, 0])
  assert.ok(gunzipSync(readFileSync(new URL('lang/eng.traineddata.gz', runtime))).length > 1_000_000)
  assert.ok(readFileSync(new URL('worker.min.js', runtime)).length > 100_000)
  assert.ok(readFileSync(new URL('core/tesseract-core-lstm.wasm.js', runtime)).length > 100_000)
})

test('row confirmation accepts exact values and leaves other rows and time pending', () => {
  const rows = { teamA: [correctRow, { ...correctRow, ast: "0" }], teamB: [correctRow] }
  const diagnostics = { teamA: [diagnostic(false), diagnostic(false)], teamB: [diagnostic(false)] }
  const reviewed = reviewCaptureRow(diagnostics, rows, "teamA", 1)
  for (const field of STAT_FIELDS) assert.equal(isCaptureCellPending(reviewed.teamA[1][field], rows.teamA[1][field]), false)
  assert.equal(reviewed.teamA[1].ast.reviewedValue, "0")
  assert.equal(isCaptureCellPending(reviewed.teamA[1].ast, "1"), true)
  assert.equal(reviewed.teamA[0], diagnostics.teamA[0])
  assert.equal(reviewed.teamB, diagnostics.teamB)
  assert.equal(isCaptureCellPending(diagnostics.teamA[1].dmg, correctRow.dmg), true)
  assert.equal(isCaptureTimePending({ value: "6:22", autoApply: false }, "6:22"), true)
})

test('row confirmation refuses a missing or overlong number without acknowledging any cell', () => {
  const diagnostics = { teamA: [diagnostic(false)], teamB: [] }
  for (const dmg of ["", "1234567"]) {
    const rows = { teamA: [{ ...correctRow, dmg }], teamB: [] }
    assert.equal(reviewCaptureRow(diagnostics, rows, "teamA", 0), diagnostics)
    assert.equal(isCaptureCellPending(diagnostics.teamA[0].elim, correctRow.elim), true)
  }
})
