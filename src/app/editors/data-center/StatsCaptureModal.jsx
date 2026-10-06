import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentTeams, getStartingPlayers, getTeamPlayers } from '../../../project/projectUtils'
import { CORE_STATS, formatStatNumber, normalizeStatsRows } from '../../../project/statsModel'
import {
  getCaptureLayoutPreset,
  normalizeCaptureConfig
} from '../../../project/statsCaptureConfig.js'
import styles from '../shared/styles/statsCaptureModal.module.css'
import StatsCaptureCalibration from './StatsCaptureCalibration.jsx'
import { runStatsCaptureOcr } from './runStatsCaptureOcr.js'
import { isCaptureCellPending, isCaptureTimePending, isDurationInputValid, reviewCaptureDiagnostics, reviewCaptureRow, validateCaptureData } from './statsCaptureReview.js'
import {
  buildCropAssets,
  countFilledRows,
  fileToDataUrl,
  formatDurationInput,
  formatDurationMinutes,
  getTeamTotals,
  normalizeDurationInput,
  onlyDigits,
  parseDurationMinutes,
  parseStatsBlock,
  resolveTimeCrop
} from './statsCaptureUtils'

function StatsCaptureModal({ project, settings, onApplyRows, onClose, onUpdateCapture, text }) {
  const { teamA, teamB } = getCurrentTeams(project)
  const inputRef = useRef(null)
  const editedCellsRef = useRef(new Set())
  const editedTimeRef = useRef(false)
  const modalRef = useRef(null)
  const sourceImage = settings.capture?.imageDataUrl || ''
  const capture = normalizeCaptureConfig(settings.capture)
  const timeCrop = resolveTimeCrop(capture)
  const [imageDataUrl, setImageDataUrl] = useState(sourceImage)
  const initialMinutes = Number(settings.capture?.dataMinutes ?? settings.dataMinutes ?? 10) || 0
  const [dataMinutes, setDataMinutes] = useState(initialMinutes)
  const [timeInput, setTimeInput] = useState(settings.capture?.timeText ?? formatDurationInput(initialMinutes))
  const [rows, setRows] = useState(() => normalizeStatsRows(capture.resultStale ? undefined : settings.ocrRows))
  const [playerIds, setPlayerIds] = useState(() => ({
    teamA: Array.from({ length: 5 }, (_, index) => (
      settings.statsPlayerIds?.teamA?.[index] || getStartingPlayers(project, 'teamA')[index]?.id || ''
    )),
    teamB: Array.from({ length: 5 }, (_, index) => (
      settings.statsPlayerIds?.teamB?.[index] || getStartingPlayers(project, 'teamB')[index]?.id || ''
    ))
  }))
  const [cellSnippets, setCellSnippets] = useState({ teamA: [], teamB: [] })
  const [playerSnippets, setPlayerSnippets] = useState({ teamA: [], teamB: [] })
  const [zones, setZones] = useState([])
  const [timeZone, setTimeZone] = useState(settings.capture?.timeZone || '')
  const [rawText, setRawText] = useState('')
  const [status, setStatus] = useState(sourceImage ? text.statusImageReady : text.statusWaitingImage)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [diagnostics, setDiagnostics] = useState({ teamA: [], teamB: [] })
  const [timeReview, setTimeReview] = useState(null)
  const [bindingsReviewed, setBindingsReviewed] = useState(false)
  const [isSwapped, setIsSwapped] = useState(Boolean(capture.teamOrderSwapped))
  const [stale, setStale] = useState(Boolean(capture.resultStale))
  const [isDragging, setIsDragging] = useState(false)
  const [activeCropPanel, setActiveCropPanel] = useState('stats')
  const [focusedReviewKey, setFocusedReviewKey] = useState('')
  const [zoomImage, setZoomImage] = useState('')
  const runRef = useRef(null)
  const mountedRef = useRef(true)
  const isBusy = isProcessing || isPreparing
  const totals = useMemo(() => ({
    teamA: getTeamTotals(rows.teamA),
    teamB: getTeamTotals(rows.teamB)
  }), [rows])
  const filledRows = useMemo(() => ({
    teamA: countFilledRows(rows.teamA),
    teamB: countFilledRows(rows.teamB)
  }), [rows])
  const teamSummaries = useMemo(() => ([
    {
      key: 'teamA',
      name: teamA?.shortName || teamA?.name || text.teamA,
      rows: filledRows.teamA,
      totals: totals.teamA
    },
    {
      key: 'teamB',
      name: teamB?.shortName || teamB?.name || text.teamB,
      rows: filledRows.teamB,
      totals: totals.teamB
    }
  ]), [filledRows, teamA?.name, teamA?.shortName, teamB?.name, teamB?.shortName, text.teamA, text.teamB, totals])
  const rawTextLineCount = useMemo(() => (
    String(rawText || '').split('\n').filter(line => line.trim()).length
  ), [rawText])
  const playerOptions = useMemo(() => ({
    teamA: getTeamPlayers(project, teamA?.id),
    teamB: getTeamPlayers(project, teamB?.id)
  }), [project, teamA?.id, teamB?.id])
  const validation = validateCaptureData({ rows, playerIds, playerOptions, timeInput, diagnostics, timeReview, bindingsReviewed, stale })
  const timePending = isCaptureTimePending(timeReview, timeInput)
  const timeInvalid = !isDurationInputValid(timeInput)
  const timeState = timeInvalid ? 'invalid' : timePending ? 'pending' : 'valid'
  const timeCandidates = [...new Set((timeReview?.candidates || []).map(candidate => candidate.parsedTime).filter(Boolean))].slice(0, 3)
  const orientTeams = value => isSwapped ? { teamA: value.teamB, teamB: value.teamA } : value
  const resetReview = () => {
    editedCellsRef.current.clear()
    editedTimeRef.current = false
    setProgress(0)
    setRows(normalizeStatsRows())
    setDiagnostics({ teamA: [], teamB: [] })
    setTimeReview(null)
    setBindingsReviewed(false)
    setStale(true)
  }
  const updateCapture = patch => {
    const changed = Object.keys(patch).some(key => /^(?:scale|threshold|.*Pct)$/.test(key) && Number(patch[key]) !== Number(capture[key]))
    if (changed) {
      resetReview()
      setRawText('')
      setCellSnippets({ teamA: [], teamB: [] })
      setPlayerSnippets({ teamA: [], teamB: [] })
      setZones([])
      setTimeZone('')
    }
    onUpdateCapture({ ...capture, dataMinutes, timeText: timeInput, timeZone, ...patch, ...(changed ? { resultStale: true, timeZone: '' } : {}) })
  }
  const updateDataTime = (value, reviewed = false) => {
    const minutes = parseDurationMinutes(value)
    setTimeInput(value)
    setDataMinutes(minutes)
    editedTimeRef.current = !reviewed
    setTimeReview(prev => ({ ...prev, autoApply: false, reviewedValue: reviewed ? value : undefined }))
    onUpdateCapture({ ...capture, dataMinutes: minutes, timeText: value, timeZone })
  }
  const commitDataTime = () => {
    if (!editedTimeRef.current) return
    editedTimeRef.current = false
    if (isDurationInputValid(timeInput)) updateDataTime(normalizeDurationInput(timeInput), true)
  }
  const applyCaptureLayout = async (captureLayout, resetTuning = false) => {
    if (isBusy) return
    setIsPreparing(true)
    const nextCapture = {
      ...capture,
      ...getCaptureLayoutPreset(captureLayout),
      captureLayout,
      ...(!resetTuning ? { threshold: capture.threshold, scale: capture.scale } : {}),
      imageDataUrl,
      dataMinutes,
      timeText: timeInput,
      timeZone: '',
      resultStale: true
    }
    onUpdateCapture(nextCapture)
    resetReview()
    setRawText('')
    setZones([])
    setCellSnippets({ teamA: [], teamB: [] })
    setPlayerSnippets({ teamA: [], teamB: [] })
    setTimeZone('')

    if (imageDataUrl) {
      try {
        const assets = await buildCropAssets(imageDataUrl, nextCapture)
        if (!mountedRef.current) return
        setZones(isSwapped ? [...assets.zones].reverse() : assets.zones)
        setCellSnippets(orientTeams(assets.cellSnippets))
        setPlayerSnippets(orientTeams(assets.playerSnippets))
        setTimeZone(assets.timeZone)
        onUpdateCapture({ ...nextCapture, ...assets.timeCrop, timeZone: assets.timeZone })
      } catch {
        setStatus(text.statusCropFailed)
        setIsPreparing(false)
        return
      }
    }
    setStatus(resetTuning ? text.statusCropPresetReset : text.statusCaptureLayoutChanged)
    setIsPreparing(false)
  }
  const resetCropPreset = () => applyCaptureLayout(capture.captureLayout, true)

  const clearWorkspace = () => {
    if (isBusy) return
    resetReview()
    setTimeInput('')
    setDataMinutes(0)
    onUpdateCapture({ ...capture, dataMinutes: 0, timeText: '', timeZone: '', resultStale: true })
    setCellSnippets({ teamA: [], teamB: [] })
    setPlayerSnippets({ teamA: [], teamB: [] })
    setZones([])
    setTimeZone('')
    setRawText('')
    setStatus(imageDataUrl ? text.statusImageReady : text.statusWaitingImage)
  }

  const handleImageFile = async file => {
    if (isBusy) return
    if (!file?.type?.startsWith('image/')) {
      setStatus(text.statusInvalidImage)
      return
    }

    setIsPreparing(true)
    let dataUrl
    try { dataUrl = await fileToDataUrl(file) }
    catch { setStatus(text.statusInvalidImage); setIsPreparing(false); return }
    if (!mountedRef.current) return
    resetReview()
    setIsSwapped(false)
    setRawText('')
    setTimeInput('')
    setDataMinutes(0)
    setImageDataUrl(dataUrl)
    onUpdateCapture({ ...capture, dataMinutes: 0, timeText: '', imageDataUrl: dataUrl, timeZone: '', resultStale: true, teamOrderSwapped: false })
    setZones([])
    setCellSnippets({ teamA: [], teamB: [] })
    setPlayerSnippets({ teamA: [], teamB: [] })
    setTimeZone('')
    setStatus(text.statusImageLoaded)
    setIsPreparing(false)
  }

  useEffect(() => {
    const handlePaste = event => {
      const items = event.clipboardData?.items || []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          handleImageFile(item.getAsFile())
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  })

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; runRef.current?.abort() }
  }, [])
  const closeWorkspace = () => { runRef.current?.abort(); onClose() }

  const cropImage = async () => {
    if (!imageDataUrl || isBusy) return
    setIsPreparing(true)
    setProgress(18)
    setStatus(text.statusPreparingCrop)
    try {
      const assets = await buildCropAssets(imageDataUrl, capture)
      if (!mountedRef.current) return
      setZones(isSwapped ? [...assets.zones].reverse() : assets.zones)
      setCellSnippets(orientTeams(assets.cellSnippets))
      setPlayerSnippets(orientTeams(assets.playerSnippets || { teamA: [], teamB: [] }))
      setTimeZone(assets.timeZone)
      onUpdateCapture({ ...capture, ...assets.timeCrop, timeZone: assets.timeZone })
      setStatus(text.statusCropReady)
    } catch {
      setStatus(text.statusCropFailed)
    } finally {
      if (mountedRef.current) { setIsPreparing(false); setProgress(0) }
    }
  }

  const runAutoOcr = async () => {
    if (!imageDataUrl || isBusy) return
    const controller = new AbortController()
    runRef.current = controller
    const isCurrent = () => mountedRef.current && runRef.current === controller
    resetReview()
    setIsProcessing(true)
    setProgress(0)
    setStatus(text.statusPreparingOcr)
    setTimeInput('')
    setDataMinutes(0)
    onUpdateCapture({ ...capture, dataMinutes: 0, timeText: '', resultStale: true })
    try {
      const result = await runStatsCaptureOcr(imageDataUrl, {
        capture, signal: controller.signal,
        onProgress: next => {
          if (!isCurrent()) return
          setProgress(prev => Math.max(prev, next.progress || 0))
          const team = next.team === 'teamA' ? text.teamA : text.teamB
          if (next.stage === 'row') setStatus(text.statusTeamRow(team, next.index + 1))
          else if (next.stage === 'cell') setStatus(text.statusCellRetry(team, next.index + 1))
          else if (next.stage === 'time') setStatus(text.statusReadingTime)
          else if (next.stage === 'loading') setStatus(text.statusLoadingEngine)
          if (next.assets) {
            setZones(isSwapped ? [...next.assets.zones].reverse() : next.assets.zones)
            setCellSnippets(orientTeams(next.assets.cellSnippets))
            setPlayerSnippets(orientTeams(next.assets.playerSnippets))
            setTimeZone(next.assets.timeZone)
          }
        }
      })
      if (!isCurrent() || controller.signal.aborted) return
      setRows(orientTeams({ teamA: result.teamA, teamB: result.teamB }))
      setDiagnostics(orientTeams(result.numericDiagnostics))
      setTimeReview(result.timeReview)
      const nextTime = result.timeReview?.value || ''
      setTimeInput(nextTime)
      const nextMinutes = parseDurationMinutes(nextTime)
      setDataMinutes(nextMinutes)
      const parts = result.rawText.split('\n\n---\n')
      setRawText(isSwapped ? parts.reverse().join('\n\n---\n') : result.rawText)
      setStale(false)
      onUpdateCapture({ ...capture, ...result.assets.timeCrop, timeZone: result.assets.timeZone,
        timeText: nextTime, dataMinutes: nextMinutes, resultStale: true })
      setStatus(result.reviewWarning ? text.statusReviewImage : text.statusRowOcrComplete)
    } catch (error) {
      if (isCurrent()) { setStatus(text.ocrError(error.code)); setProgress(0) }
    } finally {
      if (isCurrent()) { setIsProcessing(false); runRef.current = null }
    }
  }

  const parseText = () => {
    if (isBusy) return
    const chunks = String(rawText || '').split(/\n\s*\n|---+/).map(chunk => chunk.trim()).filter(Boolean)
    const lines = String(rawText || '').split('\n').map(line => line.trim()).filter(Boolean)

    const teamAText = chunks[0] || lines.slice(0, 5).join('\n')
    const teamBText = chunks[1] || lines.slice(5, 10).join('\n')

    setRows({
      teamA: parseStatsBlock(teamAText),
      teamB: parseStatsBlock(teamBText)
    })
    setDiagnostics({ teamA: [], teamB: [] })
    setBindingsReviewed(false)
    setStale(false)
    setStatus(text.statusTextParsed)
    setProgress(100)
  }

  const updateRow = (teamKey, index, field, value) => {
    if (isBusy) return
    setRows(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: onlyDigits(value) } : row
      ))
    }))
    setStale(false)
    editedCellsRef.current.add(teamKey + '-' + index + '-' + field)
    setDiagnostics(prev => {
      const teamDiagnostics = [...(prev[teamKey] || [])]
      teamDiagnostics[index] = { ...teamDiagnostics[index],
        [field]: { ...teamDiagnostics[index]?.[field], autoApply: false, reviewedValue: undefined } }
      return { ...prev, [teamKey]: teamDiagnostics }
    })
  }

  const swapTeams = () => {
    if (isBusy) return
    setRows(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setCellSnippets(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setPlayerSnippets(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setDiagnostics(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setZones(prev => [...prev].reverse())
    setRawText(prev => prev.split('\n\n---\n').reverse().join('\n\n---\n'))
    setBindingsReviewed(false)
    setIsSwapped(prev => !prev)
    onUpdateCapture({ ...capture, teamOrderSwapped: !isSwapped, resultStale: true })
  }

  const updateRowPlayer = (teamKey, index, playerId) => {
    if (isBusy) return
    setBindingsReviewed(false)
    setPlayerIds(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].map((id, rowIndex) => (rowIndex === index ? playerId : id))
    }))
  }

  const confirmCell = (teamKey, index, field) => {
    if (isBusy || !/^\d{1,6}$/.test(rows[teamKey][index][field])) return
    editedCellsRef.current.delete(teamKey + '-' + index + '-' + field)
    setDiagnostics(prev => ({
      ...prev, [teamKey]: (prev[teamKey] || []).map((row, rowIndex) => rowIndex === index
        ? { ...row, [field]: { ...row[field], reviewedValue: rows[teamKey][index][field] } } : row)
    }))
  }
  const commitCell = (teamKey, index, field) => {
    if (editedCellsRef.current.delete(teamKey + '-' + index + '-' + field)) confirmCell(teamKey, index, field)
  }
  const confirmRow = () => {
    if (!canReviewRow) return
    setDiagnostics(prev => reviewCaptureRow(prev, rows, activeRow.team, activeRow.index))
    CORE_STATS.forEach(stat => editedCellsRef.current.delete(activeRow.team + '-' + activeRow.index + '-' + stat.rowKey))
  }
  const confirmTime = () => {
    if (!isBusy && !timeInvalid) updateDataTime(normalizeDurationInput(timeInput), true)
  }
  const confirmAll = () => {
    if (isBusy) return
    setDiagnostics(reviewCaptureDiagnostics(diagnostics, rows))
    confirmTime()
  }
  const applyData = () => {
    if (isBusy || !validation.canApply) return
    const normalizedTime = normalizeDurationInput(timeInput)
    const minutes = parseDurationMinutes(normalizedTime)
    onUpdateCapture({ ...capture, dataMinutes: minutes, timeText: normalizedTime, timeZone, resultStale: false })
    onApplyRows(rows, playerIds, minutes)
  }
  const issueText = issue => {
    const prefix = issue.team ? `${issue.team === 'teamA' ? text.teamA : text.teamB} P${issue.index + 1} · ` : ''
    return `${prefix}${text.captureIssue(issue.kind)}${issue.field ? ` (${CORE_STATS.find(stat => stat.rowKey === issue.field)?.shortLabel})` : ''}`
  }

  // Layout and controls follow System's SubmissionPage / WorkbenchOcrScanner.
  const statLabel = stat => text.ocrStatLabels[stat.rowKey];
  const reviewTasks = [...validation.issues, ...validation.pending].map(issue => ({
    ...issue,
    focusKey: issue.team
      ? `${issue.team}-${issue.index}-${issue.field || 'player'}`
      : issue.kind === 'bindings' ? 'bindings'
        : issue.kind.startsWith('time') ? 'time' : 'scan'
  }));
  const focusedReview = reviewTasks.find(issue => issue.focusKey === focusedReviewKey);
  const rowMatch = focusedReviewKey.match(/^(teamA|teamB)-(\d+)-/);
  const activeRow = rowMatch ? { team: rowMatch[1], index: Number(rowMatch[2]) } : null;
  const canReviewRow = !isBusy && !stale && activeRow
    && validation.pending.some(issue => issue.team === activeRow.team && issue.index === activeRow.index)
    && !validation.issues.some(issue => issue.team === activeRow.team && issue.index === activeRow.index);
  const pendingReviewCount = validation.pending.length + Number(validation.issues.some(issue => issue.kind === 'bindings'));
  const correctionCount = validation.issues.filter(issue => issue.kind !== 'bindings').length;
  const recognitionStatus = !isBusy && progress === 100 && !stale
    ? validation.canApply ? text.statusReviewed : text.ocrReviewStatus(pendingReviewCount, correctionCount)
    : status;
  const focusNextReview = () => {
    const tasks = [...new Map(reviewTasks.map(issue => [issue.focusKey, issue])).values()];
    if (!tasks.length) return;
    const index = tasks.findIndex(issue => issue.focusKey === focusedReviewKey);
    const next = tasks[(index + 1) % tasks.length];
    const input = modalRef.current?.querySelector(`[data-ocr-field="${next.focusKey}"]`);
    input?.focus();
    input?.scrollIntoView({ block: 'nearest' });
  };

  const renderTeamSummary = summary => (
    <div className={styles.summaryRow} key={summary.key}>
      <span title={summary.name}>{summary.name}</span>
      <strong>{text.rowCount(summary.rows)}</strong>
      {CORE_STATS.map(stat => (
        <em key={stat.key}>
          <span>{statLabel(stat)}</span>
          <b>{formatStatNumber(summary.totals[stat.rowKey] || 0)}</b>
        </em>
      ))}
    </div>
  );

  const renderTable = (teamKey, team, label, sourcePosition) => (
    <section className={styles.statsPanel} aria-label={label}>
      <div className={styles.statsPanelHead}>
        <div>
          <span className={styles.statsSideLabel}>{label} · {sourcePosition}</span>
          <strong>{team?.name || label}</strong>
        </div>
        <em>{filledRows[teamKey]}/5</em>
      </div>
      <div className={styles.statsHeader}>
        <div>P</div>
        <div>{text.player}</div>
        {CORE_STATS.map(stat => <div className={styles[`head_${stat.rowKey}`]} key={stat.key}>{statLabel(stat)}</div>)}
      </div>
      <div className={styles.statsRows}>
        {rows[teamKey].map((row, index) => {
          const playerId = playerIds[teamKey]?.[index] || '';
          const playerIssue = validation.issues.some(issue => issue.team === teamKey && issue.index === index && ['player', 'duplicate'].includes(issue.kind));
          const usedElsewhere = new Set(Object.entries(playerIds).flatMap(([key, ids]) => ids.filter((_, i) => key !== teamKey || i !== index)));
          return (
            <div className={styles.playerBlock} data-active={activeRow?.team === teamKey && activeRow.index === index} key={`${teamKey}-${index}`}>
              <div className={styles.statsRow}>
                <div className={styles.playerIndex}>P{index + 1}</div>
                <div className={styles.playerField}>
                  <span className={styles.mobileFieldLabel}>{text.player}</span>
                  <select
                    className={`${styles.playerSelect} ${playerIssue ? styles.playerSelectWarning : ''}`}
                    value={playerId}
                    disabled={isBusy}
                    data-ocr-field={`${teamKey}-${index}-player`}
                    aria-label={`${label} P${index + 1} ${text.player}`}
                    aria-invalid={playerIssue || undefined}
                    title={playerOptions[teamKey].find(player => player.id === playerId)?.name || undefined}
                    onChange={event => updateRowPlayer(teamKey, index, event.target.value)}
                  >
                    <option value="">{text.unassigned}</option>
                    {playerOptions[teamKey].map(player => (
                      <option key={player.id} value={player.id} disabled={usedElsewhere.has(player.id) && player.id !== playerId}>
                        {player.name || player.battleTag || `${text.player} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  {playerSnippets[teamKey]?.[index] && <button type="button" className={styles.playerSnippet}
                    title={text.zoomPlayerIdScreenshot(label, index)} aria-label={text.zoomPlayerIdScreenshot(label, index)}
                    onClick={() => setZoomImage(playerSnippets[teamKey][index])}>
                    <img src={playerSnippets[teamKey][index]} alt="" />
                  </button>}
                </div>
                {CORE_STATS.map(stat => {
                  const pending = isCaptureCellPending(diagnostics[teamKey]?.[index]?.[stat.rowKey], row[stat.rowKey]);
                  const invalid = validation.issues.some(issue => issue.team === teamKey && issue.index === index && issue.field === stat.rowKey);
                  const reviewState = invalid ? 'invalid' : pending ? 'pending' : /^\d{1,6}$/.test(row[stat.rowKey]) ? 'valid' : 'empty';
                  const labelText = `${label} P${index + 1} ${statLabel(stat)}`;
                  return (
                    <div className={styles.statField} key={stat.key}>
                      <span className={styles.mobileFieldLabel}>{statLabel(stat)}</span>
                      <div className={styles.statCell}>
                        <input
                          className={styles.statInput}
                          value={row[stat.rowKey]} disabled={isBusy} inputMode="numeric"
                          data-ocr-field={`${teamKey}-${index}-${stat.rowKey}`}
                          data-review-state={reviewState}
                          aria-label={labelText} aria-invalid={invalid || undefined}
                          title={invalid ? text.captureIssue('missing') : pending ? text.checkNumber : reviewState === 'valid' ? text.reviewValid : undefined}
                          aria-description={pending ? text.checkNumber : undefined}
                          onFocus={event => event.target.select()}
                          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirmCell(teamKey, index, stat.rowKey); } }}
                          onBlur={() => commitCell(teamKey, index, stat.rowKey)}
                          onChange={event => updateRow(teamKey, index, stat.rowKey, event.target.value)}
                        />
                      </div>
                      {cellSnippets[teamKey]?.[index]?.[stat.rowKey] && <button type="button" className={styles.statCellPreview}
                        title={text.zoomStatScreenshot(label, index, statLabel(stat))}
                        aria-label={text.zoomStatScreenshot(label, index, statLabel(stat))}
                        onClick={() => setZoomImage(cellSnippets[teamKey][index][stat.rowKey])}>
                        <img src={cellSnippets[teamKey][index][stat.rowKey]} alt="" />
                      </button>}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="owbt-ocr-title"
        onFocusCapture={event => {
          if (event.target.dataset.ocrField) setFocusedReviewKey(event.target.dataset.ocrField);
        }}>
        <header className={styles.modalHead}>
          <div>
            <div className={styles.kicker}>{text.dataCapture}</div>
            <h2 className={styles.title} id="owbt-ocr-title">{text.statsOcrDesk}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={closeWorkspace}>{text.close}</button>
        </header>
        <main className={styles.workspace}>
          <aside className={styles.leftPane}>
            <button type="button" className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ''}`}
              disabled={isBusy} title={imageDataUrl ? text.zoomSourceScreenshot : text.uploadScreenshot}
              aria-label={imageDataUrl ? text.zoomSourceScreenshot : text.uploadScreenshot}
              onClick={() => imageDataUrl ? setZoomImage(imageDataUrl) : inputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={event => { event.preventDefault(); setIsDragging(false); handleImageFile(event.dataTransfer.files?.[0]); }}>
              {imageDataUrl ? <img className={styles.previewImage} src={imageDataUrl} alt="" /> : <span className={styles.uploadHint}>{text.pasteDropUploadScreenshot}</span>}
              {isProcessing && <div className={styles.progressTopBar}><div className={styles.progressTopFill} style={{ width: `${progress}%` }} /></div>}
            </button>
            <input type="file" ref={inputRef} className={styles.hiddenInput} accept="image/*"
              onChange={event => { handleImageFile(event.target.files?.[0]); event.target.value = ''; }} />
            {imageDataUrl && <button type="button" className={styles.primaryBtn} disabled={isBusy} onClick={() => inputRef.current?.click()}>{text.replaceScreenshot}</button>}
            <div className={styles.sourceActions}>
              <button type="button" className={styles.primaryBtn} disabled={!imageDataUrl || isBusy} onClick={cropImage}>{text.cropZones}</button>
              <button type="button" className={styles.swapBtn} disabled={isBusy} onClick={swapTeams}>{text.swapTeams}</button>
            </div>
            <button type="button" className={styles.scanBtn} data-ocr-field="scan" disabled={!imageDataUrl || isBusy} onClick={runAutoOcr}>
              {isProcessing ? text.scanning : text.autoOcr}
            </button>
            {isProcessing && <button type="button" className={styles.primaryBtn} onClick={() => runRef.current?.abort()}>{text.cancelOcr}</button>}
            <div className={styles.statusPanel}>
              <div className={styles.statusPanelHead}><span>{text.ocrStatus}</span><strong>{progress}%</strong></div>
              <div className={styles.progressTopTrack}><div className={styles.progressTopFill} style={{ width: `${progress}%` }} /></div>
              <details className={styles.recognitionDetails}>
                <summary className={styles.progressText} aria-label={text.recognitionDetails}>
                  <span role="status" aria-live="polite">{recognitionStatus}</span>
                  <span className={styles.detailsToggle}>{text.details}</span>
                </summary>
                <dl className={styles.recognitionMetrics}>
                  <div><dt>{text.numericRows}</dt><dd>{filledRows.teamA + filledRows.teamB}/10</dd></div>
                  <div><dt>{text.numericPending}</dt><dd>{validation.pending.length}</dd></div>
                  <div><dt>{text.dataTime}</dt><dd>{timeInput || text.empty}</dd></div>
                </dl>
              </details>
            </div>
            <section className={styles.timePreview}>
              <div className={styles.sidePanelHead}><span>{text.timePreview}</span></div>
              <button type="button" className={styles.timePreviewImage} disabled={!timeZone}
                title={timeZone ? text.zoomTimeCrop : text.cropZonesFirst} aria-label={text.zoomTimeCrop}
                onClick={() => timeZone && setZoomImage(timeZone)}>
                {timeZone ? <img src={timeZone} alt="" /> : <span>{text.noTimeCrop}</span>}
              </button>
            </section>
            {zones.length > 0 && <details className={styles.cropPreviewPanel}>
              <summary className={styles.sidePanelHead}><span>{text.cropPreview}</span><strong>{zones.length}</strong></summary>
              {zones.map((zone, index) => <button type="button" className={styles.zonePreview} key={index}
                aria-label={text.zoomOcrCropPreview(index)} onClick={() => setZoomImage(zone)}>
                <span>{index === 0 ? text.teamA : text.teamB}</span><img src={zone} alt="" />
              </button>)}
            </details>}
            <button type="button" className={styles.primaryBtn} disabled={isBusy} onClick={clearWorkspace}>{text.clearData}</button>
          </aside>
          <section className={styles.rightPane}>
            <div className={`${styles.rightHead} ${styles.rightHeadCompact}`}>
              <details className={`${styles.textPanel} ${styles.teamSummary}`}>
                <summary><span>{text.teamTotals}</span><strong>{text.captureRowCount(filledRows.teamA + filledRows.teamB)}</strong></summary>
                <div className={styles.summaryGrid}>{teamSummaries.map(renderTeamSummary)}</div>
              </details>
              <label className={styles.summaryTime}>
                <span>{text.dataTime}</span>
                <input value={timeInput} disabled={isBusy} aria-label={text.dataTime} data-ocr-field="time"
                  data-review-state={timeState} aria-invalid={timeInvalid || undefined}
                  title={timeInvalid ? text.captureIssue('time') : timePending ? text.checkTime : text.reviewValid}
                  aria-description={timePending ? text.checkTime : undefined}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirmTime(); } }}
                  onChange={event => updateDataTime(event.target.value)} onBlur={commitDataTime} placeholder={text.timePlaceholder} />
                {timePending && timeCandidates.length > 1 && <div className={styles.timeCandidates}>
                  <span>{text.timeCandidates}</span>
                  {timeCandidates.map(value => <button type="button" className={styles.timeOcrCandidate}
                    disabled={isBusy} key={value} aria-label={text.useTime(value)} onClick={() => updateDataTime(value, true)}>{value}</button>)}
                </div>}
              </label>
            </div>
            <div className={styles.topUtility}>
              <div className={styles.topStack}>
                <details className={styles.advancedCrop}>
                  <summary><span>{text.cropCalibration}</span><strong>{text.adjustLayout}</strong></summary>
                  <StatsCaptureCalibration capture={capture} timeCrop={timeCrop} activePanel={activeCropPanel} disabled={isBusy}
                    onPanelChange={setActiveCropPanel} onUpdateCapture={updateCapture} onApplyLayout={applyCaptureLayout}
                    onResetCrop={resetCropPreset} text={text} />
                </details>
                <details className={styles.textPanel}>
                  <summary><span>{text.externalOcrText}</span><strong>{rawTextLineCount ? text.lines(rawTextLineCount) : text.manual}</strong></summary>
                  <div className={styles.textEditor}>
                    <span>{text.manualFallback}</span>
                    <textarea value={rawText} disabled={isBusy} aria-label={text.externalOcrText}
                      onChange={event => setRawText(event.target.value)} placeholder={text.ocrTextPlaceholder} />
                    <button type="button" className={styles.parseTextBtn} disabled={!rawText.trim() || isBusy} onClick={parseText}>{text.parseText}</button>
                  </div>
                </details>
              </div>
            </div>
            <div className={styles.bindingsReview}>
              <label><input type="checkbox" checked={bindingsReviewed} disabled={isBusy} data-ocr-field="bindings"
                onChange={event => setBindingsReviewed(event.target.checked)} />{text.confirmBindings}</label>
              {validation.pending.length > 0 && <button type="button" className={styles.nextReviewBtn} disabled={isBusy} onClick={confirmAll}>{text.confirmAll}</button>}
            </div>
            <div className={styles.tablesWrap}>
              {renderTable('teamA', teamA, text.teamA, isSwapped ? text.sourceBottom : text.sourceTop)}
              {renderTable('teamB', teamB, text.teamB, isSwapped ? text.sourceTop : text.sourceBottom)}
            </div>
          </section>
        </main>
        <footer className={styles.footerBar}>
          <div className={styles.reviewStatus} role="status" aria-live="polite">
            <strong>{validation.canApply ? text.dataReady(formatDurationMinutes(dataMinutes))
              : text.reviewProgress(filledRows.teamA + filledRows.teamB, pendingReviewCount, correctionCount)}</strong>
            <span>{focusedReview ? issueText(focusedReview) : text.reviewHint}</span>
          </div>
          <button type="button" className={styles.nextReviewBtn} disabled={!canReviewRow}
            title={activeRow ? text.confirmRowTarget(activeRow.team === "teamA" ? text.teamA : text.teamB, activeRow.index) : text.selectReviewRow}
            aria-label={activeRow ? text.confirmRowTarget(activeRow.team === "teamA" ? text.teamA : text.teamB, activeRow.index) : text.confirmRow}
            onClick={confirmRow}>{text.confirmRow}</button>
          <button type="button" className={styles.nextReviewBtn} disabled={isBusy || !reviewTasks.length} onClick={focusNextReview}>{text.nextReview}</button>
          <button type="button" className={`${styles.applyBtn} ${!validation.canApply || isBusy ? styles.applyBtnDisabled : ''}`}
            disabled={isBusy || !validation.canApply} onClick={applyData}>{text.applyData}</button>
        </footer>
      </div>
      {zoomImage && <button type="button" className={styles.zoomOverlay} onClick={() => setZoomImage('')} aria-label={text.closeImagePreview}>
        <img src={zoomImage} alt="" />
      </button>}
    </div>
  );
}

export default StatsCaptureModal
