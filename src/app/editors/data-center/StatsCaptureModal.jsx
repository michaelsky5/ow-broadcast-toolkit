import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentTeams, getStartingPlayers, getTeamPlayers } from '../../../project/projectUtils'
import { CORE_STATS, formatStatNumber, normalizeStatsRows } from '../../../project/statsModel'
import styles from '../shared/SceneEditor.styles.js'
import {
  DEFAULT_CAPTURE,
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
  parseStatsLine,
  resolveTimeCrop
} from './statsCaptureUtils'

function StatsCaptureModal({ project, settings, onApplyRows, onClose, onUpdateCapture, text }) {
  const { teamA, teamB } = getCurrentTeams(project)
  const inputRef = useRef(null)
  const sourceImage = settings.capture?.imageDataUrl || ''
  const capture = { ...DEFAULT_CAPTURE, ...(settings.capture || {}) }
  const timeCrop = resolveTimeCrop(capture)
  const [imageDataUrl, setImageDataUrl] = useState(sourceImage)
  const initialMinutes = Number(settings.dataMinutes ?? settings.capture?.dataMinutes ?? 10) || 0
  const [dataMinutes, setDataMinutes] = useState(initialMinutes)
  const [timeInput, setTimeInput] = useState(settings.capture?.timeText || formatDurationInput(initialMinutes))
  const [rows, setRows] = useState(() => normalizeStatsRows(settings.ocrRows))
  const [playerIds, setPlayerIds] = useState(() => ({
    teamA: Array.from({ length: 5 }, (_, index) => (
      settings.statsPlayerIds?.teamA?.[index] || getStartingPlayers(project, 'teamA')[index]?.id || ''
    )),
    teamB: Array.from({ length: 5 }, (_, index) => (
      settings.statsPlayerIds?.teamB?.[index] || getStartingPlayers(project, 'teamB')[index]?.id || ''
    ))
  }))
  const [snippets, setSnippets] = useState({ teamA: [], teamB: [] })
  const [playerSnippets, setPlayerSnippets] = useState({ teamA: [], teamB: [] })
  const [zones, setZones] = useState([])
  const [timeZone, setTimeZone] = useState(settings.capture?.timeZone || '')
  const [rawText, setRawText] = useState('')
  const [status, setStatus] = useState(sourceImage ? text.statusImageReady : text.statusWaitingImage)
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeCropPanel, setActiveCropPanel] = useState('stats')
  const [zoomImage, setZoomImage] = useState('')
  const workerRef = useRef(null)
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
  const cropPanelLabels = {
    stats: text.statsCrop,
    time: text.timeCrop,
    player: text.playerCrop
  }
  const updateCapture = patch => onUpdateCapture({ ...capture, dataMinutes, timeText: timeInput, timeZone, ...patch })
  const updateDataTime = value => {
    const minutes = parseDurationMinutes(value)
    setTimeInput(value)
    setDataMinutes(minutes)
    onUpdateCapture({ ...capture, dataMinutes: minutes, timeText: value, timeZone })
  }
  const commitDataTime = () => {
    const normalized = normalizeDurationInput(timeInput)
    updateDataTime(normalized)
  }
  const resetCropPreset = () => {
    const nextCapture = {
      ...DEFAULT_CAPTURE,
      imageDataUrl,
      dataMinutes,
      timeText: timeInput,
      timeZone
    }
    onUpdateCapture(nextCapture)
    setStatus(text.statusCropPresetReset)
  }

  const clearWorkspace = () => {
    setRows(normalizeStatsRows())
    setSnippets({ teamA: [], teamB: [] })
    setPlayerSnippets({ teamA: [], teamB: [] })
    setZones([])
    setTimeZone('')
    setRawText('')
    setStatus(imageDataUrl ? text.statusImageReady : text.statusWaitingImage)
  }

  const handleImageFile = async file => {
    if (!file?.type?.startsWith('image/')) {
      setStatus(text.statusInvalidImage)
      return
    }

    const dataUrl = await fileToDataUrl(file)
    setImageDataUrl(dataUrl)
    onUpdateCapture({ ...capture, dataMinutes, timeText: timeInput, imageDataUrl: dataUrl })
    setZones([])
    setSnippets({ teamA: [], teamB: [] })
    setPlayerSnippets({ teamA: [], teamB: [] })
    setTimeZone('')
    setStatus(text.statusImageLoaded)
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

  useEffect(() => () => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const cropImage = async () => {
    if (!imageDataUrl) return
    try {
      const assets = await buildCropAssets(imageDataUrl, capture)
      setZones(assets.zones)
      setSnippets(assets.snippets)
      setPlayerSnippets(assets.playerSnippets || { teamA: [], teamB: [] })
      setTimeZone(assets.timeZone)
      updateCapture({ ...assets.timeCrop, timeZone: assets.timeZone })
      setStatus(text.statusCropReady)
    } catch {
      setStatus(text.statusCropFailed)
    }
  }

  const runAutoOcr = async () => {
    if (!imageDataUrl || isProcessing) return

    setIsProcessing(true)
    setProgress(5)
    setStatus(text.statusPreparingOcr)

    try {
      const assets = await buildCropAssets(imageDataUrl, capture)
      setZones(assets.zones)
      setSnippets(assets.snippets)
      setPlayerSnippets(assets.playerSnippets || { teamA: [], teamB: [] })
      setTimeZone(assets.timeZone)
      updateCapture({ ...assets.timeCrop, timeZone: assets.timeZone })
      setProgress(20)

      const module = await import('tesseract.js')
      const Tesseract = module.default || module
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: message => {
          const pct = message.progress ? Math.round(message.progress * 100) : 0
          setProgress(Math.max(20, pct))
          if (message.status) setStatus(text.ocrWorkerStatus(message.status))
        }
      })

      workerRef.current = worker
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789,.: oOi',
        tessedit_pageseg_mode: '7',
        preserve_interword_spaces: '1'
      })

      const recognizeRows = async (teamKey, images) => {
        const rowTexts = []
        const parsedRows = []

        for (let index = 0; index < 5; index += 1) {
          setStatus(text.statusTeamRow(teamKey === 'teamA' ? text.teamA : text.teamB, index + 1))
          setProgress(20 + (teamKey === 'teamA' ? index : index + 5) * 7)

          const result = await worker.recognize(images[index])
          const recognizedText = result.data.text || ''
          rowTexts.push(recognizedText.trim())
          parsedRows.push(parseStatsLine(recognizedText))
        }

        return { rowTexts, parsedRows }
      }

      const teamAResult = await recognizeRows('teamA', assets.rowZones.teamA)
      const teamBResult = await recognizeRows('teamB', assets.rowZones.teamB)

      setRows({
        teamA: teamAResult.parsedRows,
        teamB: teamBResult.parsedRows
      })
      setRawText(`${teamAResult.rowTexts.join('\n')}\n\n---\n${teamBResult.rowTexts.join('\n')}`.trim())
      setProgress(100)
      setStatus(text.statusRowOcrComplete)
      await worker.terminate()
      workerRef.current = null
    } catch {
      setStatus(text.statusOcrFailed)
    } finally {
      setIsProcessing(false)
    }
  }

  const parseText = () => {
    const chunks = String(rawText || '').split(/\n\s*\n|---+/).map(chunk => chunk.trim()).filter(Boolean)
    const lines = String(rawText || '').split('\n').map(line => line.trim()).filter(Boolean)

    const teamAText = chunks[0] || lines.slice(0, 5).join('\n')
    const teamBText = chunks[1] || lines.slice(5, 10).join('\n')

    setRows({
      teamA: parseStatsBlock(teamAText),
      teamB: parseStatsBlock(teamBText)
    })
    setStatus(text.statusTextParsed)
  }

  const updateRow = (teamKey, index, field, value) => {
    setRows(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: onlyDigits(value) } : row
      ))
    }))
  }

  const swapTeams = () => {
    setRows(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setSnippets(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setPlayerSnippets(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
    setPlayerIds(prev => ({ teamA: prev.teamB, teamB: prev.teamA }))
  }

  const updateRowPlayer = (teamKey, index, playerId) => {
    setPlayerIds(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].map((id, rowIndex) => (rowIndex === index ? playerId : id))
    }))
  }

  const renderCropPreviewPanel = () => (
    <div className={styles.captureSidePreviewPanel}>
      <div className={styles.captureSidePreviewTitle}>
        <span>{text.cropPreview}</span>
        <strong>{zones.length ? text.stat : text.empty}</strong>
      </div>
      {zones.length ? (
        <div className={styles.captureSidePreviewStack}>
          {zones.map((zone, index) => (
            <button
              type="button"
              className={styles.captureSideZonePreview}
              aria-label={text.zoomOcrCropPreview(index)}
              onClick={() => setZoomImage(zone)}
              key={`side-zone-${index}`}
            >
              <img src={zone} alt="" />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.captureSidePreviewEmpty}>{text.noCropPreview}</div>
      )}
    </div>
  )

  const renderCropFields = () => {
    if (activeCropPanel === 'time') {
      return (
        <div className={styles.captureCropGrid}>
          <label><span>{text.timeXPct}</span><input type="number" value={timeCrop.timeXPct} onChange={event => updateCapture({ timeXPct: event.target.value })} /></label>
          <label><span>{text.timeYPct}</span><input type="number" value={timeCrop.timeYPct} onChange={event => updateCapture({ timeYPct: event.target.value })} /></label>
          <label><span>{text.timeWPct}</span><input type="number" value={timeCrop.timeWPct} onChange={event => updateCapture({ timeWPct: event.target.value })} /></label>
          <label><span>{text.timeHPct}</span><input type="number" value={timeCrop.timeHPct} onChange={event => updateCapture({ timeHPct: event.target.value })} /></label>
        </div>
      )
    }

    if (activeCropPanel === 'player') {
      return (
        <div className={styles.captureCropGrid}>
          <label><span>{text.playerXPct}</span><input type="number" value={capture.playerXPct} onChange={event => updateCapture({ playerXPct: event.target.value })} /></label>
          <label><span>{text.playerWPct}</span><input type="number" value={capture.playerWPct} onChange={event => updateCapture({ playerWPct: event.target.value })} /></label>
        </div>
      )
    }

    return (
      <div className={styles.captureCropGrid}>
        <label><span>{text.scale}</span><input type="number" min="1" value={capture.scale} onChange={event => updateCapture({ scale: event.target.value })} /></label>
        <label><span>{text.xPct}</span><input type="number" value={capture.xPct} onChange={event => updateCapture({ xPct: event.target.value })} /></label>
        <label><span>{text.wPct}</span><input type="number" value={capture.wPct} onChange={event => updateCapture({ wPct: event.target.value })} /></label>
        <label><span>{text.hPct}</span><input type="number" value={capture.hPct} onChange={event => updateCapture({ hPct: event.target.value })} /></label>
        <label><span>{text.topPct}</span><input type="number" value={capture.topPct} onChange={event => updateCapture({ topPct: event.target.value })} /></label>
        <label><span>{text.bottomPct}</span><input type="number" value={capture.bottomPct} onChange={event => updateCapture({ bottomPct: event.target.value })} /></label>
        <label><span>{text.threshold}</span><input type="number" value={capture.threshold} onChange={event => updateCapture({ threshold: event.target.value })} /></label>
      </div>
    )
  }

  const renderTable = (teamKey, team, label) => (
    <section className={styles.captureTeamTable}>
      <div className={styles.captureTeamTitle}>
        <span>{label}</span>
        <strong>{team?.name || label}</strong>
      </div>

      <div className={styles.captureTableHeader}>
        <span>P</span>
        <span>{text.player}</span>
        {CORE_STATS.map(stat => <span key={stat.key}>{stat.shortLabel}</span>)}
      </div>

      {rows[teamKey].map((row, index) => (
        <div className={styles.capturePlayerGroup} key={`${teamKey}-${index}`}>
          <div className={styles.capturePlayerRow}>
            <strong>P{index + 1}</strong>
            <select
              value={playerIds[teamKey]?.[index] || ''}
              onChange={event => updateRowPlayer(teamKey, index, event.target.value)}
            >
              <option value="">{text.unassigned}</option>
              {playerOptions[teamKey].map(player => (
                <option key={player.id} value={player.id}>
                  {player.name || player.battleTag || `${text.player} ${index + 1}`}
                </option>
              ))}
            </select>
            {CORE_STATS.map(stat => (
              <input
                key={stat.key}
                value={row[stat.rowKey]}
                onChange={event => updateRow(teamKey, index, stat.rowKey, event.target.value)}
              />
            ))}
          </div>
          {playerSnippets[teamKey]?.[index] && (
            <button
              type="button"
              className={styles.capturePlayerSnippet}
              style={{ backgroundImage: `url(${playerSnippets[teamKey][index]})` }}
              title={text.zoomPlayerIdScreenshot(label, index)}
              aria-label={text.zoomPlayerIdScreenshot(label, index)}
              onClick={() => setZoomImage(playerSnippets[teamKey][index])}
            />
          )}
          {snippets[teamKey]?.[index] && (
            <button
              type="button"
              className={styles.captureSnippet}
              style={{ backgroundImage: `url(${snippets[teamKey][index]})` }}
              title={text.zoomPlayerRowScreenshot(label, index)}
              aria-label={text.zoomPlayerRowScreenshot(label, index)}
              onClick={() => setZoomImage(snippets[teamKey][index])}
            />
          )}
        </div>
      ))}
    </section>
  )

  return (
    <div className={styles.captureModalBackdrop}>
      <div className={styles.captureModal}>
        <header className={styles.captureHeader}>
          <div>
            <span>{text.dataCapture}</span>
            <h3>{text.statsOcrDesk}</h3>
          </div>
          <button type="button" onClick={onClose}>{text.close}</button>
        </header>

        <main className={styles.captureWorkspace}>
          <aside className={styles.captureSourcePanel}>
            <button
              type="button"
              className={`${styles.captureDropzone} ${isDragging ? styles.captureDropzoneActive : ''}`}
              title={imageDataUrl ? text.zoomSourceScreenshot : text.uploadScreenshot}
              onClick={() => (imageDataUrl ? setZoomImage(imageDataUrl) : inputRef.current?.click())}
              onDragOver={event => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={event => {
                event.preventDefault()
                setIsDragging(false)
                handleImageFile(event.dataTransfer.files?.[0])
              }}
            >
              {imageDataUrl ? <img src={imageDataUrl} alt="" /> : <span>{text.pasteDropUploadScreenshot}</span>}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={event => {
                handleImageFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />

            <div className={styles.captureActionGrid}>
              <button type="button" className={styles.primaryButton} disabled={!imageDataUrl} onClick={cropImage}>
                {text.cropZones}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={swapTeams}>
                {text.swapTeams}
              </button>
            </div>

            <button
              type="button"
              className={`${styles.mutedActionButton} ${styles.captureAutoOcrButton} ${isProcessing ? styles.captureAutoOcrButtonActive : ''}`}
              disabled={!imageDataUrl || isProcessing}
              style={{ '--ocr-progress': `${progress}%` }}
              onClick={runAutoOcr}
            >
              <span>{text.autoOcr}</span>
              {isProcessing && <strong>{progress}%</strong>}
            </button>

            <div className={styles.captureTimeCard}>
              <div className={styles.captureTimeTitle}>
                <span>{text.timePreview}</span>
              </div>
              <button
                type="button"
                className={styles.captureTimePreview}
                disabled={!timeZone}
                title={timeZone ? text.zoomTimeCrop : text.cropZonesFirst}
                onClick={() => timeZone && setZoomImage(timeZone)}
              >
                {timeZone ? <img src={timeZone} alt="" /> : <span>{text.noTimeCrop}</span>}
              </button>
            </div>

            <div className={styles.captureStatus}>
              <span>{text.status}</span>
              <strong>{status}</strong>
            </div>

            <div className={styles.captureActionGrid}>
              <button type="button" className={styles.secondaryButton} onClick={resetCropPreset}>
                {text.resetCrop}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={clearWorkspace}>
                {text.clearData}
              </button>
            </div>

            {renderCropPreviewPanel()}
          </aside>

          <section className={styles.captureMainPanel}>
            <div className={styles.captureTopConsole}>
              <div className={styles.captureSummaryStrip}>
                {teamSummaries.map(summary => (
                  <div className={styles.captureSummaryTotal} key={summary.key}>
                    <span className={styles.captureSummaryTeams}>{summary.name}</span>
                    <strong className={styles.captureSummaryRows}>{text.rowCount(summary.rows)}</strong>
                    {CORE_STATS.map(stat => (
                      <em className={styles.captureSummaryMetric} key={stat.key}>
                        <span>{stat.shortLabel}</span>
                        <strong>{formatStatNumber(summary.totals[stat.rowKey] || 0)}</strong>
                      </em>
                    ))}
                  </div>
                ))}
              </div>

              <div className={styles.captureTopUtility}>
              <div className={styles.captureTopStack}>
                <details className={`${styles.captureAdvancedCrop} ${styles.captureCalibrationDrawer}`}>
                  <summary>
                    <span>{text.cropCalibration}</span>
                    <strong>{cropPanelLabels[activeCropPanel]}</strong>
                  </summary>
                  <div className={styles.captureCalibrationContent}>
                    <div className={styles.captureCalibrationTabs}>
                      {['stats', 'time', 'player'].map(mode => (
                        <button
                          type="button"
                          className={activeCropPanel === mode ? styles.captureCalibrationActive : ''}
                          onClick={() => setActiveCropPanel(mode)}
                          key={mode}
                        >
                          {cropPanelLabels[mode]}
                        </button>
                      ))}
                    </div>
                    {renderCropFields()}
                  </div>
                </details>

                <details className={styles.captureTextPanel}>
                  <summary>
                    <span>{text.externalOcrText}</span>
                    <strong>{rawTextLineCount ? text.lines(rawTextLineCount) : text.manual}</strong>
                  </summary>
                  <div className={styles.captureTextEditor}>
                    <span>{text.manualFallback}</span>
                    <textarea
                      value={rawText}
                      onChange={event => setRawText(event.target.value)}
                      placeholder={text.ocrTextPlaceholder}
                    />
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!rawText.trim()}
                      onClick={parseText}
                    >
                      {text.parseText}
                    </button>
                  </div>
                </details>
              </div>

              <label className={styles.captureSummaryTime}>
                <span>{text.dataTime}</span>
                <input
                  value={timeInput}
                  onChange={event => updateDataTime(event.target.value)}
                  onBlur={commitDataTime}
                  placeholder="10 or 10:30"
                />
                <em>{formatDurationMinutes(dataMinutes)} {text.min}</em>
              </label>
              </div>
            </div>

            <div className={styles.captureTables}>
              {renderTable('teamA', teamA, text.teamA)}
              {renderTable('teamB', teamB, text.teamB)}
            </div>
          </section>
        </main>

        <footer className={styles.captureFooter}>
          <span>{text.dataReady(formatDurationMinutes(dataMinutes))}</span>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => onApplyRows(rows, playerIds)}
          >
            {text.applyData}
          </button>
        </footer>
      </div>
      {zoomImage && (
        <button
          type="button"
          className={styles.captureImageZoomBackdrop}
          onClick={() => setZoomImage('')}
          aria-label={text.closeImagePreview}
        >
          <img src={zoomImage} alt="" />
        </button>
      )}
    </div>
  )
}

export default StatsCaptureModal
