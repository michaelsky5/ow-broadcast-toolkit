import { useMemo, useState } from 'react'
import { FRIES_CUP_CONFIG, getFriesCupTeamDirectoryConfig } from '../config'
import { fetchPublishedTeamData } from './publishedDataSource'
import { normalizePublishedTeamDirectory } from './normalizePublishedTeam'
import { syncPublishedTeamsIntoProject, isProjectTeamFromFcSystem, isProjectPlayerFromFcSystem } from './syncPublishedTeamsIntoProject'
import {
  ensureFriesCupEditionData,
  getTeamDirectoryCache,
  writeTeamDirectoryFailure,
  writeTeamDirectorySuccess
} from './teamDirectoryCache'
import { EditorDialog } from '../../../app/editors/shared/editorControls'
import styles from './FriesCupSystemSourcePanel.module.css'

const formatDateTime = value => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const getStatusText = status => ({
  READY: '已同步',
  LOADING: '读取中',
  ERROR: '同步失败',
  IDLE: '未同步'
}[status] || status || '未同步')

const countFcSystemTeams = project => (project.teams || []).filter(isProjectTeamFromFcSystem).length
const countFcSystemPlayers = project => (project.players || []).filter(isProjectPlayerFromFcSystem).length

function FriesCupSystemSourcePanel({ project, onUpdateProject, embedded = false, compact = false }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dialog, setDialog] = useState(null)
  const cache = getTeamDirectoryCache(project)
  const fcTeamCount = countFcSystemTeams(project)
  const fcPlayerCount = countFcSystemPlayers(project)
  const teamBdUrl = project?.editionData?.friesCup?.teamBdUrl || FRIES_CUP_CONFIG.teamBdUrl
  const sourceConfig = useMemo(() => getFriesCupTeamDirectoryConfig({
    seasonId: cache.seasonId,
    version: cache.version,
    remoteBaseUrl: cache.remoteBaseUrl,
    staticFallbackUrl: cache.staticFallbackUrl
  }), [cache.remoteBaseUrl, cache.seasonId, cache.staticFallbackUrl, cache.version])
  const seasonPresets = FRIES_CUP_CONFIG.teamDirectory.seasonPresets || {}
  const activeSeasonId = cache.seasonId || FRIES_CUP_CONFIG.teamDirectory.seasonId
  const seasonOptions = Object.entries(seasonPresets)
  if (activeSeasonId && !seasonPresets[activeSeasonId]) {
    seasonOptions.unshift([activeSeasonId, { label: activeSeasonId }])
  }
  const syncReport = cache.syncReport || {}
  const counts = cache.counts || {}
  const publishedTeamCount = counts.teams || syncReport.teamCount || 0
  const publishedPlayerCount = counts.players || syncReport.playerCount || 0
  const hasSyncedTeams = publishedTeamCount > 0 && publishedPlayerCount > 0 && fcTeamCount > 0 && fcPlayerCount > 0
  const sourceStatus = isRefreshing
    ? 'LOADING'
    : cache.status === 'READY' && !hasSyncedTeams
      ? 'IDLE'
      : cache.status
  const syncStatusText = hasSyncedTeams ? `已同步 ${publishedTeamCount} 队 / ${publishedPlayerCount} 选手` : getStatusText(sourceStatus)

  const updateSourceField = (field, value) => {
    onUpdateProject(draft => {
      const friesCup = ensureFriesCupEditionData(draft)
      friesCup.teamDirectory[field] = value
    })
  }

  const updateSeasonId = value => {
    onUpdateProject(draft => {
      const friesCup = ensureFriesCupEditionData(draft)
      const preset = seasonPresets[value]
      friesCup.teamDirectory.seasonId = value
      friesCup.teamDirectory.staticFallbackUrl = preset?.staticFallbackUrl ?? ''
    })
  }

  const refreshSource = async () => {
    setIsRefreshing(true)

    try {
      const fetchResult = await fetchPublishedTeamData(sourceConfig)
      const directory = normalizePublishedTeamDirectory(fetchResult.data, fetchResult)

      onUpdateProject(draft => {
        const report = syncPublishedTeamsIntoProject(draft, directory.teams, {
          fetchResult,
          directory,
          seasonId: fetchResult.seasonId || sourceConfig.seasonId,
          version: fetchResult.version || sourceConfig.version,
          sourceUrl: fetchResult.sourceUrl,
          updatedAt: fetchResult.updatedAt || directory.updatedAt
        })
        writeTeamDirectorySuccess(draft, fetchResult, directory, report)
      }, { undoReason: 'SYNC FC SYSTEM TEAMS' })
    } catch (error) {
      onUpdateProject(draft => {
        writeTeamDirectoryFailure(draft, error, sourceConfig)
      }, { skipUndo: true })
      setDialog({
        kicker: 'FC SYSTEM',
        title: '同步失败',
        message: error?.message || 'FC System published data load failed.',
        confirmLabel: '确定',
        onConfirm: () => setDialog(null)
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const openTeamBackend = () => {
    if (!teamBdUrl) return
    window.open(teamBdUrl, '_blank', 'noopener,noreferrer')
  }

  const isCompact = embedded || compact

  return (
    <section className={embedded ? `${styles.panel} ${styles.embeddedPanel}` : compact ? `${styles.panel} ${styles.compactPanel}` : styles.panel}>
      <div className={styles.panelTitle}>
        <span>赛事数据源 / FC System</span>
        <strong>{syncStatusText}</strong>
      </div>

      {isCompact ? (
        <>
          <div className={styles.embeddedSummaryGrid}>
            <div>
              <span>当前数据源</span>
              <strong>FC System Published</strong>
              <em>{cache.source === 'static-fallback' ? 'Fallback' : 'Remote / no-store'}</em>
            </div>

            <label className={styles.field}>
              <span>Season ID</span>
              <select value={activeSeasonId} onChange={event => updateSeasonId(event.target.value)}>
                {seasonOptions.map(([seasonId, preset]) => (
                  <option key={seasonId} value={seasonId}>
                    {preset.label || seasonId}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Publish Version</span>
              <div className={styles.versionRow}>
                <input
                  value={cache.version || 'latest'}
                  onChange={event => updateSourceField('version', event.target.value)}
                  placeholder="latest"
                />
                <button type="button" onClick={() => updateSourceField('version', 'latest')}>LATEST</button>
              </div>
            </label>
          </div>

          <div className={styles.compactCountGrid}>
            <div>
              <span>队伍</span>
              <strong>{publishedTeamCount || fcTeamCount || 0}</strong>
            </div>
            <div>
              <span>选手</span>
              <strong>{publishedPlayerCount || fcPlayerCount || 0}</strong>
            </div>
            <div>
              <span>比赛</span>
              <strong>{counts.matches || 0}</strong>
            </div>
            <div>
              <span>统计</span>
              <strong>{counts.playerTotals || 0}</strong>
            </div>
          </div>

          <div className={styles.embeddedActionGrid}>
            <div>
              <span>更新时间</span>
              <strong>{formatDateTime(cache.updatedAt)}</strong>
              <em>{cache.error ? '使用上次缓存' : cache.fetchedAt ? '最近已检查' : '-'}</em>
            </div>
            <div>
              <span>同步状态</span>
              <strong>{syncStatusText}</strong>
              <em>{syncReport.staleTeams ? `${syncReport.staleTeams} stale` : '不覆盖 A/B 队'}</em>
            </div>
            <button type="button" className={styles.primaryButton} onClick={refreshSource} disabled={isRefreshing}>
              {isRefreshing ? '刷新中' : '刷新并同步'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <div>
              <span>当前数据源</span>
              <strong>FC System Published</strong>
              <em>{cache.source === 'static-fallback' ? '使用缓存 / fallback' : 'Remote / no-store'}</em>
            </div>

            <label className={styles.field}>
              <span>Season ID</span>
              <select value={activeSeasonId} onChange={event => updateSeasonId(event.target.value)}>
                {seasonOptions.map(([seasonId, preset]) => (
                  <option key={seasonId} value={seasonId}>
                    {preset.label || seasonId}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Publish Version</span>
              <div className={styles.versionRow}>
                <input
                  value={cache.version || 'latest'}
                  onChange={event => updateSourceField('version', event.target.value)}
                  placeholder="latest"
                />
                <button type="button" onClick={() => updateSourceField('version', 'latest')}>LATEST</button>
              </div>
            </label>

            <div>
              <span>更新时间</span>
              <strong>{formatDateTime(cache.updatedAt)}</strong>
              <em>{cache.error ? '使用上次缓存' : cache.fetchedAt ? '最近已检查' : '-'}</em>
            </div>
            <div>
              <span>队伍 / 选手</span>
              <strong>{publishedTeamCount} / {publishedPlayerCount}</strong>
              <em>{hasSyncedTeams ? '已同步到队伍库' : '等待同步到队伍库'}</em>
            </div>
            <div>
              <span>同步状态</span>
              <strong>{syncStatusText}</strong>
              <em>{syncReport.staleTeams ? `${syncReport.staleTeams} stale` : '不覆盖 A/B 队'}</em>
            </div>
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.primaryButton} onClick={refreshSource} disabled={isRefreshing}>
              {isRefreshing ? '刷新中' : '刷新并同步'}
            </button>
          </div>
        </>
      )}

      {!embedded && <details className={styles.advanced}>
        <summary>高级信息</summary>

        <div className={styles.sourceGrid}>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>API Base</span>
            <input
              value={cache.remoteBaseUrl || FRIES_CUP_CONFIG.teamDirectory.remoteBaseUrl}
              onChange={event => updateSourceField('remoteBaseUrl', event.target.value)}
              placeholder="/api/admin-public"
            />
          </label>

          <label className={`${styles.field} ${styles.wide}`}>
            <span>Static Fallback</span>
            <input
              value={cache.staticFallbackUrl ?? FRIES_CUP_CONFIG.teamDirectory.staticFallbackUrl}
              onChange={event => updateSourceField('staticFallbackUrl', event.target.value)}
              placeholder="/api/stats-data/friescup_db_review_ready.json"
            />
          </label>
        </div>

        <div className={styles.advancedGrid}>
          <div>
            <span>Schema</span>
            <strong>{cache.schemaVersion || '-'}</strong>
            <em>{cache.contractVersion || '-'}</em>
          </div>
          <div>
            <span>Source URL</span>
            <strong>{cache.sourceUrl || '-'}</strong>
            <em>{cache.checksum || '-'}</em>
          </div>
          <div>
            <span>Sync Report</span>
            <strong>+{syncReport.createdTeams || 0} / {syncReport.updatedTeams || 0}</strong>
            <em>stale: {syncReport.staleTeams || 0}</em>
          </div>
          <div>
            <span>Matches / Stats</span>
            <strong>{counts.matches || 0} / {counts.playerTotals || 0}</strong>
            <em>reviews: {counts.teamReviews || 0}</em>
          </div>
        </div>

        {cache.error && <p className={styles.errorDetail}>{cache.error}</p>}

        <button type="button" onClick={openTeamBackend} disabled={!teamBdUrl}>
          {teamBdUrl ? '打开队伍资料后台' : '队伍资料后台尚未配置'}
        </button>
      </details>}

      {dialog && <EditorDialog {...dialog} />}
    </section>
  )
}

export default FriesCupSystemSourcePanel
