import { CORE_STATS, formatPer10, formatStatNumber } from '../../../project/statsModel'
import styles from '../shared/SceneEditor.styles.js'
import { Panel } from '../shared/editorControls'
import { formatDurationMinutes } from './statsCaptureUtils'

function StatsMetricBoardPanel({
  statsData,
  isCurrentSource,
  displayMetrics,
  dataMinutes,
  hasOcrRows,
  coreMetrics,
  teamA,
  teamB,
  updateMetricEnabled,
  text
}) {
  const displayMetricKeys = new Set(displayMetrics.map(metric => metric.key))

  return (
    <Panel title={text.statsMetricBoard} className={styles.statsMetricsPanel}>
      <div className={styles.statsBoardHeader}>
        <div>
          <span>{text.dataFeed}</span>
          <strong>{text.statsDataLabel(statsData)}</strong>
          <em>{isCurrentSource ? text.captureData : text.savedDataPreview}</em>
        </div>
        <div className={styles.statsBoardMeta}>
          <span>{text.shownCount(displayMetrics.length)}</span>
          <span>{formatDurationMinutes(dataMinutes)} {text.min}</span>
          <span>{hasOcrRows ? text.ocrReady : text.manual}</span>
        </div>
      </div>

      <div className={styles.statsMetricHeader}>
        <span>{text.show}</span>
        <span>{text.stat}</span>
        <span>{teamA?.shortName || text.teamA}</span>
        <span>{teamB?.shortName || text.teamB}</span>
        <span>{teamA?.shortName || 'A'} /10</span>
        <span>{teamB?.shortName || 'B'} /10</span>
        <span>{text.state}</span>
      </div>

      <div className={styles.statsMetricList}>
        {coreMetrics.map((metric, slotIndex) => {
          const isEnabled = metric.enabled !== false
          const stat = CORE_STATS.find(item => item.key === metric.key) || CORE_STATS[slotIndex]
          const isShown = isEnabled && displayMetricKeys.has(metric.key)

          return (
            <div className={styles.statsMetricRow} key={`metric-${metric.key}`}>
              <button
                type="button"
                className={isEnabled ? styles.activeMiniButton : styles.mutedMiniButton}
                onClick={() => updateMetricEnabled(metric, !isEnabled)}
              >
                {isEnabled ? text.on : text.off}
              </button>

              <div className={styles.statsMetricName}>
                <strong>{stat?.shortLabel || `M${slotIndex + 1}`}</strong>
              </div>

              <div className={styles.statsMetricValueCell}>{formatStatNumber(metric.teamA)}</div>
              <div className={styles.statsMetricValueCell}>{formatStatNumber(metric.teamB)}</div>
              <div className={styles.statsMetricRateCell}>{formatPer10(metric.teamA, dataMinutes)}</div>
              <div className={styles.statsMetricRateCell}>{formatPer10(metric.teamB, dataMinutes)}</div>

              <div className={`${styles.statsStateCell} ${isShown ? styles.statsStateActive : ''}`}>
                {isShown ? text.shown : text.hidden}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export default StatsMetricBoardPanel
