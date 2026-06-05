import styles from '../shared/SceneEditor.styles.js'
import { Panel, SegmentedControl } from '../shared/editorControls'
import { formatDurationMinutes } from './statsCaptureUtils'
import { DATA_SCOPE_OPTIONS } from './statsEditorUtils'

function StatsMapDataStorePanel({
  outputScope,
  updateStatsSettings,
  saveMapSnapshot,
  clearCaptureRows,
  clearMapSnapshots,
  selectMapSnapshot,
  deleteMapSnapshot,
  activeSnapshotId,
  mapSnapshots,
  exportStatsJson,
  exportStatsCsv,
  dataMinutes,
  displayMetrics,
  coreMetrics,
  text
}) {
  const hasSavedMaps = mapSnapshots.length > 0
  const dataScopeOptions = DATA_SCOPE_OPTIONS.map(option => (
    option.value === 'current'
      ? { ...option, label: text.current }
      : { ...option, label: option.value === 'map' ? text.savedScope : text.total, disabled: !hasSavedMaps }
  ))

  return (
    <Panel title={text.statsMapStore} className={styles.statsMapPanel}>
      <div className={styles.statsControlStack}>
        <div className={styles.statsStoreTopGrid}>
          <div className={styles.statsControlBlock}>
            <span>{text.dataFeed}</span>
            <SegmentedControl
              value={outputScope}
              options={dataScopeOptions}
              onChange={value => updateStatsSettings({ statsDataScope: value })}
            />
          </div>
        </div>

        <div className={styles.statsStoreActionGrid}>
          <button type="button" className={styles.secondaryButton} onClick={saveMapSnapshot}>
            {text.saveCurrentMap}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={clearCaptureRows}>
            {text.clearOcrRows}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={!mapSnapshots.length} onClick={exportStatsJson}>
            {text.exportJson}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={!mapSnapshots.length} onClick={exportStatsCsv}>
            {text.exportCsv}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={!mapSnapshots.length}
            onClick={clearMapSnapshots}
          >
            {text.clearStore}
          </button>
        </div>

        <div className={`${styles.statsSummary} ${styles.statsStoreSummary}`}>
          <div>
            <span>{text.time}</span>
            <strong>{formatDurationMinutes(dataMinutes)}</strong>
          </div>
          <div>
            <span>{text.metrics}</span>
            <strong>{displayMetrics.length}/{coreMetrics.filter(metric => metric.enabled !== false).length}</strong>
          </div>
          <div>
            <span>{text.saved}</span>
            <strong>{mapSnapshots.length}</strong>
          </div>
        </div>

        <div className={styles.statsSnapshotList}>
          {mapSnapshots.map(snapshot => (
            <div
              className={snapshot.id === activeSnapshotId ? styles.statsSnapshotActive : ''}
              key={snapshot.id}
            >
              <strong>{text.mapNumber(snapshot.mapIndex)}</strong>
              <span>{snapshot.mapName || snapshot.roundLabel}</span>
              <div className={styles.statsSnapshotActions}>
                <button type="button" onClick={() => selectMapSnapshot(snapshot.id)}>
                  {text.view}
                </button>
                <button type="button" className={styles.dangerButton} onClick={() => deleteMapSnapshot(snapshot.id)}>
                  {text.deleteShort}
                </button>
              </div>
            </div>
          ))}
          {!mapSnapshots.length && <p>{text.noSavedMapData}</p>}
        </div>
      </div>
    </Panel>
  )
}

export default StatsMapDataStorePanel
