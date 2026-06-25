import { useMemo, useState } from 'react'
import { getTeamById } from '../../../project/projectUtils'
import { EditorDialog } from '../../../app/editors/shared/editorControls'
import { FRIES_CUP_CONFIG, getFriesCupTeamDirectoryConfig } from '../config'
import { fetchPublishedTeamData } from './publishedDataSource'
import { normalizePublishedTeamDirectory } from './normalizePublishedTeam'
import {
  getTeamDirectoryCache,
  writeTeamDirectoryFailure,
  writeTeamDirectorySuccess
} from './teamDirectoryCache'
import { applyPublishedTeamToProject } from './applyPublishedTeamToProject'
import styles from './FriesCupTeamDirectoryWorkspace.module.css'

const formatDateTime = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const getStatusLabel = (status, copy) => ({
  READY: copy.teamDirectoryStatusReady,
  LOADING: copy.teamDirectoryStatusLoading,
  ERROR: copy.teamDirectoryStatusError,
  IDLE: copy.teamDirectoryStatusIdle
}[status] || status || copy.teamDirectoryStatusIdle)

const getSourceLabel = (cache, copy) => {
  if (cache.source === 'static-fallback' || String(cache.sourceUrl || '').includes('/api/stats-data/')) {
    return copy.teamDirectorySourceFallback
  }
  return copy.teamDirectorySourceRemote
}

const getSearchText = team => [
  team.id,
  team.sourceTeamId,
  team.name,
  team.shortName,
  team.logo,
  ...(team.players || []).flatMap(player => [
    player.name,
    player.displayName,
    player.nickname,
    player.battletag,
    player.role
  ]),
  ...(team.staff || []).flatMap(staff => [
    staff.name,
    staff.role,
    staff.battletag,
    staff.raw
  ])
].join(' ').toLowerCase()

export default function FriesCupTeamDirectoryWorkspace({
  project,
  copy,
  onUpdateProject,
  onPushLog
}) {
  const [search, setSearch] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dialog, setDialog] = useState(null)
  const cache = getTeamDirectoryCache(project)
  const teams = useMemo(() => (
    Array.isArray(cache.teams) ? cache.teams : []
  ), [cache.teams])
  const teamBdUrl = project?.editionData?.friesCup?.teamBdUrl || FRIES_CUP_CONFIG.teamBdUrl
  const query = search.trim().toLowerCase()
  const visibleTeams = useMemo(() => (
    query ? teams.filter(team => getSearchText(team).includes(query)) : teams
  ), [query, teams])
  const selectedTeam = teams.find(team => team.id === selectedTeamId) || visibleTeams[0] || null
  const sourceConfig = getFriesCupTeamDirectoryConfig({
    seasonId: cache.seasonId,
    version: cache.version
  })

  const refreshDirectory = async () => {
    setIsRefreshing(true)

    try {
      const fetchResult = await fetchPublishedTeamData(sourceConfig)
      const directory = normalizePublishedTeamDirectory(fetchResult.data, fetchResult)

      onUpdateProject(draft => {
        writeTeamDirectorySuccess(draft, fetchResult, directory)
      }, { undoReason: 'REFRESH FC TEAM DIRECTORY' })

      if (!selectedTeamId && directory.teams?.[0]?.id) setSelectedTeamId(directory.teams[0].id)
      onPushLog?.(copy.teamDirectoryRefreshLog(directory.teams?.length || 0))
    } catch (error) {
      onUpdateProject(draft => {
        writeTeamDirectoryFailure(draft, error, sourceConfig)
      }, { skipUndo: true })
      onPushLog?.(copy.teamDirectoryRefreshFailedLog)
      setDialog({
        kicker: copy.teamDirectoryTitle,
        title: copy.teamDirectoryStatusError,
        message: error?.message || 'FC System published data load failed.',
        confirmLabel: copy.ok,
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

  const requestApplyTeam = side => {
    if (!selectedTeam) return

    const sideKey = side === 'B' ? 'teamB' : 'teamA'
    const currentTeam = getTeamById(project, project.currentMatch?.[`${sideKey}Id`])

    setDialog({
      kicker: copy.teamDirectoryTitle,
      title: copy.teamDirectoryConfirmTitle,
      message: copy.teamDirectoryConfirmMessage(side, selectedTeam.name || selectedTeam.shortName, currentTeam?.name || currentTeam?.shortName),
      tone: 'danger',
      confirmLabel: side === 'B' ? copy.teamDirectoryApplyB : copy.teamDirectoryApplyA,
      cancelLabel: copy.cancel,
      onCancel: () => setDialog(null),
      onConfirm: () => {
        onUpdateProject(draft => {
          applyPublishedTeamToProject(draft, selectedTeam, side, { overwriteExisting: true })
        }, { undoReason: `APPLY FC TEAM ${side}` })
        onPushLog?.(copy.teamDirectoryApplyLog(side, selectedTeam.name || selectedTeam.shortName || selectedTeam.sourceTeamId))
        setDialog(null)
      }
    })
  }

  return (
    <section className={styles.directory}>
      <header className={styles.header}>
        <div>
          <span>{copy.teamDirectoryDockMeta}</span>
          <h3>{copy.teamDirectoryTitle}</h3>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={openTeamBackend} disabled={!teamBdUrl}>
            {teamBdUrl ? copy.teamDirectoryOpenBackend : copy.teamDirectoryBackendMissing}
          </button>
          <button type="button" className={styles.primaryButton} onClick={refreshDirectory} disabled={isRefreshing}>
            {isRefreshing ? copy.teamDirectoryRefreshing : copy.teamDirectoryRefresh}
          </button>
        </div>
      </header>

      <section className={styles.statusGrid}>
        <div>
          <span>{copy.teamDirectorySource}</span>
          <strong>{getSourceLabel(cache, copy)}</strong>
          <em>{cache.sourceUrl || sourceConfig.remoteBaseUrl}</em>
        </div>
        <div>
          <span>{copy.teamDirectoryStatusReady}</span>
          <strong>{getStatusLabel(isRefreshing ? 'LOADING' : cache.status, copy)}</strong>
          <em>{cache.error || cache.checksum || '-'}</em>
        </div>
        <div>
          <span>{copy.teamDirectorySeason}</span>
          <strong>{cache.seasonId || sourceConfig.seasonId}</strong>
          <em>{cache.schemaVersion || '-'}</em>
        </div>
        <div>
          <span>{copy.teamDirectoryVersion}</span>
          <strong>{cache.version || sourceConfig.version}</strong>
          <em>{cache.contractVersion || '-'}</em>
        </div>
        <div>
          <span>{copy.teamDirectoryUpdatedAt}</span>
          <strong>{formatDateTime(cache.updatedAt) || copy.teamDirectoryUnknownUpdatedAt}</strong>
          <em>{cache.fetchedAt ? `${copy.teamDirectoryFetchedAt}: ${formatDateTime(cache.fetchedAt)}` : '-'}</em>
        </div>
        <div>
          <span>{copy.teamDirectoryTeams}</span>
          <strong>{visibleTeams.length} / {teams.length}</strong>
          <em>{copy.teamDirectoryPlayers}: {teams.reduce((sum, team) => sum + (team.players?.length || 0), 0)}</em>
        </div>
      </section>

      <section className={styles.body}>
        <aside className={styles.listPanel}>
          <label className={styles.searchField}>
            <span>{copy.teamDirectorySearch}</span>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={copy.teamDirectorySearchPlaceholder}
            />
          </label>

          <div className={styles.teamList}>
            {visibleTeams.map(team => (
              <button
                type="button"
                key={team.id}
                className={team.id === selectedTeam?.id ? styles.selectedTeam : ''}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <strong>{team.shortName || team.sourceTeamId}</strong>
                <span>{team.name}</span>
                <em>{team.players?.length || 0} / {team.staff?.length || 0}</em>
              </button>
            ))}
            {!teams.length && <div className={styles.emptyState}>{copy.teamDirectoryEmpty}</div>}
            {teams.length > 0 && !visibleTeams.length && <div className={styles.emptyState}>{copy.teamDirectoryNoMatch}</div>}
          </div>
        </aside>

        <section className={styles.detailPanel}>
          {selectedTeam ? (
            <>
              <div className={styles.teamHero}>
                <div className={styles.teamLogo}>
                  {selectedTeam.logo ? <img src={selectedTeam.logo} alt="" /> : <strong>{selectedTeam.shortName || selectedTeam.sourceTeamId}</strong>}
                </div>
                <div>
                  <span>{selectedTeam.sourceTeamId}</span>
                  <h4>{selectedTeam.name}</h4>
                  <p>{selectedTeam.shortName || '-'}</p>
                </div>
                <div className={styles.applyActions}>
                  <button type="button" onClick={() => requestApplyTeam('A')}>{copy.teamDirectoryApplyA}</button>
                  <button type="button" onClick={() => requestApplyTeam('B')}>{copy.teamDirectoryApplyB}</button>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <section>
                  <div className={styles.sectionTitle}>{copy.teamDirectoryPlayers}</div>
                  <div className={styles.playerList}>
                    {(selectedTeam.players || []).map(player => (
                      <div key={player.id} className={styles.playerRow}>
                        <span>{player.role}</span>
                        <strong>{player.name}</strong>
                        <em>{player.battletag || player.sourcePlayerId}</em>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className={styles.sectionTitle}>{copy.teamDirectoryStaff}</div>
                  <div className={styles.staffList}>
                    {(selectedTeam.staff || []).map(staff => (
                      <div key={staff.id} className={styles.staffRow}>
                        <span>{staff.role}</span>
                        <strong>{staff.name}</strong>
                        <em>{staff.battletag || staff.raw || '-'}</em>
                      </div>
                    ))}
                    {!(selectedTeam.staff || []).length && <div className={styles.emptyState}>-</div>}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className={styles.emptyDetail}>{copy.teamDirectorySelectTeam}</div>
          )}
        </section>
      </section>

      {dialog && <EditorDialog {...dialog} />}
    </section>
  )
}
