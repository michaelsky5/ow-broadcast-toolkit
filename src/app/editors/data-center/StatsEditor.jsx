import { useEffect, useRef, useState } from 'react'
import { downloadTextFile, getCurrentTeams } from '../../../project/projectUtils'
import {
  CORE_STATS,
  buildCoreMetricsFromRows,
  getMetricCategory,
  normalizeCoreMetrics,
  normalizeMapSnapshots,
  normalizeStatsRows,
  resolveStatsData,
  selectDisplayMetrics
} from '../../../project/statsModel'
import styles from '../shared/SceneEditor.styles.js'
import { EditorDialog } from '../shared/editorControls'
import { getPageEditorCopy } from '../shared/editorCopy'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'
import StatsCaptureModal from './StatsCaptureModal'
import StatsDataInputPanel from './StatsDataInputPanel'
import StatsMapDataStorePanel from './StatsMapDataStorePanel'
import StatsMetricBoardPanel from './StatsMetricBoardPanel'
import {
  DEFAULT_IMAGE_CROP,
  DISPLAY_MODE_OPTIONS,
  buildStatsCsv,
  buildStatsExport,
  createStatsFileName,
  fileToDataUrl
} from './statsEditorUtils'

const ACTIVE_CATEGORY = 'overall'

function StatsEditor({ project, language = 'en', onUpdateProject }) {
  const pageText = getPageEditorCopy(language)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [statsDialog, setStatsDialog] = useState(null)
  const imageInputRef = useRef(null)
  const settings = getSceneSettings(project, 'stats')
  const metrics = Array.isArray(settings.metrics) ? settings.metrics : []
  const mapSnapshots = normalizeMapSnapshots(settings.mapSnapshots)
  const statsData = resolveStatsData(settings, ACTIVE_CATEGORY)
  const coreMetrics = statsData.metrics
  const currentCoreMetrics = normalizeCoreMetrics(metrics, ACTIVE_CATEGORY)
  const displayMetrics = selectDisplayMetrics(coreMetrics)
  const dataMinutes = statsData.minutes
  const { teamA, teamB } = getCurrentTeams(project)
  const isCurrentSource = statsData.scope === 'current'
  const outputScope = ['map', 'cumulative'].includes(statsData.scope) ? statsData.scope : 'current'
  const statsImage = settings.capture?.imageDataUrl || ''
  const displayMode = settings.statsDisplayMode === 'image' ? 'image' : 'metrics'
  const imageCrop = { ...DEFAULT_IMAGE_CROP, ...(settings.imageCrop || {}) }
  const ocrRows = normalizeStatsRows(settings.ocrRows)
  const filledTeamARows = ocrRows.teamA.filter(row => CORE_STATS.some(stat => row[stat.rowKey])).length
  const filledTeamBRows = ocrRows.teamB.filter(row => CORE_STATS.some(stat => row[stat.rowKey])).length
  const hasOcrRows = ['teamA', 'teamB'].some(teamKey => (
    ocrRows[teamKey].some(row => CORE_STATS.some(stat => row[stat.rowKey]))
  ))

  const updateStatsSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'stats'), patch)
    })
  }

  const updateMetricEnabled = (metric, enabled) => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const source = Array.isArray(nextSettings.metrics) ? nextSettings.metrics : []
      const sourceIndex = source.findIndex(item => (
        getMetricCategory(item) === ACTIVE_CATEGORY
        && (item.key === metric.key || String(item.label || '').toLowerCase() === String(metric.label || '').toLowerCase())
      ))
      const currentMetric = currentCoreMetrics.find(item => item.key === metric.key) || metric
      const nextMetric = {
        key: metric.key,
        category: ACTIVE_CATEGORY,
        label: metric.label,
        teamA: currentMetric.teamA ?? '0',
        teamB: currentMetric.teamB ?? '0',
        enabled
      }

      if (sourceIndex >= 0) source[sourceIndex] = nextMetric
      else source.push(nextMetric)
      nextSettings.metrics = source
    })
  }

  const updateCapture = capture => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      nextSettings.capture = capture
      if (capture.dataMinutes !== undefined) nextSettings.dataMinutes = Number(capture.dataMinutes) || 0
    })
  }

  const applyStatsImageFile = async file => {
    if (!file?.type?.startsWith('image/')) return
    const imageDataUrl = await fileToDataUrl(file)

    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      nextSettings.capture = {
        ...(nextSettings.capture || {}),
        dataMinutes: Number(nextSettings.dataMinutes ?? nextSettings.capture?.dataMinutes ?? 10) || 0,
        imageDataUrl
      }
      nextSettings.imageCrop = {
        ...DEFAULT_IMAGE_CROP,
        ...(nextSettings.imageCrop || {})
      }
      nextSettings.statsDisplayMode = 'image'
    })
  }

  const updateImageCrop = patch => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      nextSettings.imageCrop = {
        ...DEFAULT_IMAGE_CROP,
        ...(nextSettings.imageCrop || {}),
        ...patch
      }
    })
  }

  const clearStatsImage = () => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      nextSettings.capture = {
        ...(nextSettings.capture || {}),
        imageDataUrl: ''
      }
      nextSettings.statsDisplayMode = 'metrics'
    })
  }

  const applyCaptureRows = (rawRows, playerIds = {}) => {
    const rows = normalizeStatsRows(rawRows)
    const normalizedPlayerIds = {
      teamA: Array.from({ length: 5 }, (_, index) => playerIds.teamA?.[index] || ''),
      teamB: Array.from({ length: 5 }, (_, index) => playerIds.teamB?.[index] || '')
    }
    const summedMetrics = buildCoreMetricsFromRows(rows, ACTIVE_CATEGORY)

    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const otherMetrics = (nextSettings.metrics || []).filter(metric => getMetricCategory(metric) !== ACTIVE_CATEGORY)
      nextSettings.ocrRows = rows
      nextSettings.statsPlayerIds = normalizedPlayerIds
      nextSettings.dataMinutes = Number(nextSettings.capture?.dataMinutes ?? nextSettings.dataMinutes ?? 10) || 0
      nextSettings.metrics = [...otherMetrics, ...summedMetrics]
    })
    setShowCaptureModal(false)
  }

  const clearCaptureRows = () => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const otherMetrics = (nextSettings.metrics || []).filter(metric => getMetricCategory(metric) !== ACTIVE_CATEGORY)

      nextSettings.ocrRows = normalizeStatsRows()
      nextSettings.metrics = [...otherMetrics, ...normalizeCoreMetrics([], ACTIVE_CATEGORY)]
      nextSettings.statsDataScope = 'current'
    })
  }

  const selectMapSnapshot = snapshotId => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const existing = normalizeMapSnapshots(nextSettings.mapSnapshots)
      const target = existing.find(snapshot => snapshot.id === snapshotId)

      if (!target) return
      nextSettings.activeSnapshotId = target.id
      nextSettings.statsDataScope = 'map'
    })
  }

  const deleteMapSnapshot = snapshotId => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const existing = normalizeMapSnapshots(nextSettings.mapSnapshots)
      const nextSnapshots = existing.filter(snapshot => snapshot.id !== snapshotId)

      nextSettings.mapSnapshots = nextSnapshots
      if (nextSettings.activeSnapshotId === snapshotId) {
        nextSettings.activeSnapshotId = nextSnapshots.at(-1)?.id || ''
        if (!nextSnapshots.length) nextSettings.statsDataScope = 'current'
      }
    })
  }

  const clearMapSnapshots = () => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')

      nextSettings.mapSnapshots = []
      nextSettings.activeSnapshotId = ''
      nextSettings.statsDataScope = 'current'
    })
  }

  const requestClearMapSnapshots = () => {
    if (!mapSnapshots.length) return

    setStatsDialog({
      kicker: pageText.statsMapStore,
      title: pageText.clearSavedMaps,
      message: pageText.clearSavedMapsMessage(mapSnapshots.length),
      tone: 'danger',
      confirmLabel: pageText.clearStore,
      cancelLabel: pageText.cancel,
      onConfirm: () => {
        clearMapSnapshots()
        setStatsDialog(null)
      },
      onCancel: () => setStatsDialog(null)
    })
  }

  const saveMapSnapshot = () => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'stats')
      const match = draft.currentMatch || {}
      const mapIndex = Number(match.currentMapIndex) || 1
      const entry = Array.isArray(match.mapLineup) ? match.mapLineup[mapIndex - 1] : null
      const snapshot = {
        id: `map-${mapIndex}-${Date.now()}`,
        category: ACTIVE_CATEGORY,
        mapIndex,
        roundLabel: match.currentRoundLabel || `MAP ${mapIndex}`,
        mapId: match.currentMapId || entry?.mapId || '',
        mapName: entry?.name || match.currentMapId || `Map ${mapIndex}`,
        minutes: Number(nextSettings.dataMinutes ?? nextSettings.capture?.dataMinutes ?? 10) || 0,
        savedAt: new Date().toISOString(),
        playerIds: {
          teamA: Array.from({ length: 5 }, (_, index) => (
            nextSettings.statsPlayerIds?.teamA?.[index] || match.startingFive?.teamA?.[index] || ''
          )),
          teamB: Array.from({ length: 5 }, (_, index) => (
            nextSettings.statsPlayerIds?.teamB?.[index] || match.startingFive?.teamB?.[index] || ''
          ))
        },
        ocrRows: normalizeStatsRows(nextSettings.ocrRows),
        metrics: normalizeCoreMetrics(nextSettings.metrics, ACTIVE_CATEGORY)
      }
      const existing = Array.isArray(nextSettings.mapSnapshots) ? nextSettings.mapSnapshots : []

      nextSettings.mapSnapshots = [
        ...existing.filter(item => Number(item.mapIndex) !== mapIndex),
        snapshot
      ].sort((a, b) => Number(a.mapIndex) - Number(b.mapIndex))
      nextSettings.activeSnapshotId = snapshot.id
    })
  }

  const exportStatsJson = () => {
    if (!mapSnapshots.length) return
    const payload = buildStatsExport(project, mapSnapshots)
    downloadTextFile(createStatsFileName(project, 'json'), JSON.stringify(payload, null, 2), 'application/json')
  }

  const exportStatsCsv = () => {
    if (!mapSnapshots.length) return
    downloadTextFile(createStatsFileName(project, 'csv'), buildStatsCsv(project, mapSnapshots), 'text/csv;charset=utf-8')
  }

  useEffect(() => {
    const handlePaste = event => {
      if (showCaptureModal) return
      const activeElement = document.activeElement
      const activeTag = activeElement?.tagName?.toLowerCase()
      const isTypingTarget = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || activeElement?.isContentEditable

      if (isTypingTarget) return

      const items = event.clipboardData?.items || []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) applyStatsImageFile(file)
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  })

  return (
    <>
      {showCaptureModal && (
        <StatsCaptureModal
          project={project}
          settings={settings}
          onApplyRows={applyCaptureRows}
          onClose={() => setShowCaptureModal(false)}
          onUpdateCapture={updateCapture}
          text={pageText}
        />
      )}
      {statsDialog && <EditorDialog {...statsDialog} />}

      <div className={styles.statsDeskStack}>
        <div className={styles.statsOutputModeBar}>
          {DISPLAY_MODE_OPTIONS.map(option => {
            const isActive = displayMode === option.value

            return (
              <button
                type="button"
                className={[
                  styles.showPackageModeButton,
                  isActive ? styles.showPackageModeActive : ''
                ].filter(Boolean).join(' ')}
                key={option.value}
                onClick={() => updateStatsSettings({ statsDisplayMode: option.value })}
              >
                <span>{option.value === 'image' ? pageText.imageMode : pageText.metricsMode}</span>
                <em>{option.value === 'image' ? pageText.screenshotOutput : pageText.teamBoardOutput}</em>
              </button>
            )
          })}
        </div>

        <div className={styles.statsWorkbench}>
          <StatsDataInputPanel
            displayMode={displayMode}
            statsImage={statsImage}
            isDraggingImage={isDraggingImage}
            setIsDraggingImage={setIsDraggingImage}
            imageInputRef={imageInputRef}
            applyStatsImageFile={applyStatsImageFile}
            openCaptureModal={() => setShowCaptureModal(true)}
            clearStatsImage={clearStatsImage}
            imageCrop={imageCrop}
            updateImageCrop={updateImageCrop}
            statsData={statsData}
            filledTeamARows={filledTeamARows}
            filledTeamBRows={filledTeamBRows}
            text={pageText}
          />

          <StatsMetricBoardPanel
            statsData={statsData}
            isCurrentSource={isCurrentSource}
            displayMetrics={displayMetrics}
            dataMinutes={dataMinutes}
            hasOcrRows={hasOcrRows}
            coreMetrics={coreMetrics}
            teamA={teamA}
            teamB={teamB}
            updateMetricEnabled={updateMetricEnabled}
            text={pageText}
          />

          <StatsMapDataStorePanel
            outputScope={outputScope}
            updateStatsSettings={updateStatsSettings}
            saveMapSnapshot={saveMapSnapshot}
            clearCaptureRows={clearCaptureRows}
            clearMapSnapshots={requestClearMapSnapshots}
            selectMapSnapshot={selectMapSnapshot}
            deleteMapSnapshot={deleteMapSnapshot}
            activeSnapshotId={settings.activeSnapshotId || ''}
            mapSnapshots={mapSnapshots}
            exportStatsJson={exportStatsJson}
            exportStatsCsv={exportStatsCsv}
            dataMinutes={dataMinutes}
            displayMetrics={displayMetrics}
            coreMetrics={coreMetrics}
            text={pageText}
          />
        </div>
      </div>
    </>
  )
}

export default StatsEditor
