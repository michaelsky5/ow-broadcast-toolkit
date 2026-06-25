import { useRef, useState } from 'react'
import { OW_ROLE_OPTIONS } from '../../../data/overwatch'
import { FRIES_CUP_CONFIG } from '../../../editions/friesCup/config'
import { clearProjectFcSystemTeams, isProjectTeamFromFcSystem } from '../../../editions/friesCup/teamDirectory/syncPublishedTeamsIntoProject'
import { downloadTextFile, getTeamPlayers } from '../../../project/projectUtils'
import styles from '../shared/SceneEditor.styles.js'
import { EditorDialog, Field, Panel } from '../shared/editorControls'
import { getHeroLabel, getHeroOptionsByRole } from '../shared/editorHelpers'
import {
  MAX_ROSTER_PLAYERS,
  ROLE_SORT_ORDER,
  buildTeamDbExport,
  createEntityId,
  fileToDataUrl,
  getDefaultHeroForRole,
  getRoleCounts,
  getStartingFiveForTeam,
  normalizeImportedTeamDb,
  normalizeRosterRole,
  readJsonFile
} from './rosterEditorUtils'

const isSupportedLogoFile = file => (
  Boolean(file) &&
  (
    String(file.type || '').startsWith('image/') ||
    /\.(?:svg|png|jpe?g|webp|gif)$/i.test(file.name || '')
  )
)

function TeamDatabaseEditor({ project, copy, text, language, rosterText, onUpdateProject, onPushLog }) {
  const importInputRef = useRef(null)
  const teamLogoInputRef = useRef(null)
  const [editingTeamId, setEditingTeamId] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [dialog, setDialog] = useState(null)
  const teams = project.teams || []
  const teamAId = project.currentMatch?.teamAId || ''
  const teamBId = project.currentMatch?.teamBId || ''
  const themePrimaryColor = project.theme?.primary || '#FFD84A'
  const editingTeam = teams.find(team => team.id === editingTeamId) || null
  const editingPlayers = editingTeam ? getTeamPlayers(project, editingTeam.id) : []
  const editingRoleCounts = getRoleCounts(editingPlayers)
  const editingActiveSlots = editingTeam
    ? [
        editingTeam.id === teamAId ? 'A' : '',
        editingTeam.id === teamBId ? 'B' : ''
      ].filter(Boolean)
    : []
  const closeDialog = () => setDialog(null)
  const searchNeedle = teamSearch.trim().toLowerCase()

  const teamRows = teams.map((team, teamIndex) => {
    const players = getTeamPlayers(project, team.id)
    const roleCounts = getRoleCounts(players)
    const activeSlots = [
      team.id === teamAId ? 'A' : '',
      team.id === teamBId ? 'B' : ''
    ].filter(Boolean)
    const staffCount = [team.manager, team.coach].filter(Boolean).length
    const isFcSystemTeam = isProjectTeamFromFcSystem(team)
    const sourceLabel = isFcSystemTeam ? 'FC SYSTEM' : 'MANUAL'
    const logoStatus = team.editionData?.friesCup?.logo?.status || (team.logo ? 'manual' : 'missing')
    const searchText = [
      team.id,
      team.source,
      team.sourceTeamId,
      team.name,
      team.shortName,
      team.logo,
      team.manager,
      team.coach,
      ...players.flatMap(player => [
        player.name,
        player.battleTag,
        player.role,
        ...(player.primaryHeroes || [])
      ])
    ].join(' ').toLowerCase()

    return {
      activeSlots,
      players,
      roleCounts,
      searchText,
      sourceLabel,
      staffCount,
      team,
      teamIndex,
      logoStatus
    }
  })
  const visibleTeamRows = searchNeedle
    ? teamRows.filter(row => row.searchText.includes(searchNeedle))
    : teamRows
  const fcSystemRows = teamRows.filter(row => isProjectTeamFromFcSystem(row.team))
  const activeFcSystemRows = fcSystemRows.filter(row => row.activeSlots.length)
  const removableFcSystemCount = Math.max(0, fcSystemRows.length - activeFcSystemRows.length)

  const updateTeam = (teamId, field) => event => {
    const value = event.target.value
    onUpdateProject(draft => {
      const target = draft.teams.find(item => item.id === teamId)
      if (target) target[field] = value
    })
  }

  const updateTeamLogo = (teamId, value) => {
    onUpdateProject(draft => {
      const target = draft.teams.find(item => item.id === teamId)
      if (target) target.logo = value
    })
  }

  const applyEditingTeamLogoFile = async file => {
    if (!file || !editingTeam) return

    if (!isSupportedLogoFile(file)) {
      setDialog({
        title: text.teamLogo,
        message: text.invalidLogoFile,
        confirmLabel: text.close,
        onConfirm: () => setDialog(null)
      })
      return
    }

    updateTeamLogo(editingTeam.id, await fileToDataUrl(file))
  }

  const updatePlayer = (playerId, patch) => {
    onUpdateProject(draft => {
      const target = draft.players.find(player => player.id === playerId)
      if (target) Object.assign(target, patch)
    })
  }

  const loadMatchTeam = (side, teamId) => {
    onUpdateProject(draft => {
      draft.currentMatch[`${side}Id`] = teamId
      draft.currentMatch.startingFive[side] = getStartingFiveForTeam(draft, teamId)
    }, { undoReason: `LOAD ${side.toUpperCase()} TEAM` })
    const team = teams.find(item => item.id === teamId)
    const sideLabel = side === 'teamB' ? 'B' : 'A'
    onPushLog?.(`设置 ${team?.shortName || team?.name || teamId} 为 ${sideLabel} 队`)
  }

  const requestLoadMatchTeam = (side, teamId) => {
    const currentTeamId = project.currentMatch?.[`${side}Id`] || ''
    if (!currentTeamId || currentTeamId === teamId) {
      loadMatchTeam(side, teamId)
      return
    }

    const team = teams.find(item => item.id === teamId)
    const currentTeam = teams.find(item => item.id === currentTeamId)
    const sideLabel = side === 'teamB' ? 'B' : 'A'
    const teamLabel = team?.shortName || team?.name || teamId
    const currentLabel = currentTeam?.shortName || currentTeam?.name || currentTeamId

    setDialog({
      kicker: rosterText.teamDbKicker,
      title: `设置 ${sideLabel} 队`,
      message: `将 ${teamLabel} 设置为 ${sideLabel} 队，当前 ${sideLabel} 队为 ${currentLabel}。继续？`,
      tone: 'danger',
      confirmLabel: side === 'teamB' ? rosterText.loadB : rosterText.loadA,
      cancelLabel: rosterText.cancel,
      onCancel: closeDialog,
      onConfirm: () => {
        loadMatchTeam(side, teamId)
        closeDialog()
      }
    })
  }

  const addTeam = () => {
    const id = createEntityId('team')

    onUpdateProject(draft => {
      const teamNumber = (draft.teams?.length || 0) + 1
      draft.teams.push({
        id,
        name: rosterText.defaultTeamName(teamNumber),
        shortName: `T${teamNumber}`,
        logo: '',
        primaryColor: '',
        description: '',
        coach: '',
        manager: '',
        playerIds: []
      })
    })
    setEditingTeamId(id)
  }

  const deleteTeam = teamId => {
    const team = teams.find(item => item.id === teamId)
    setDialog({
      kicker: rosterText.teamDbKicker,
      title: rosterText.deleteTeamTitle,
      message: rosterText.deleteTeamMessage(team?.shortName || team?.name || team?.id || rosterText.teamLabel),
      tone: 'danger',
      confirmLabel: rosterText.delete,
      cancelLabel: rosterText.cancel,
      onCancel: closeDialog,
      onConfirm: () => {
        onUpdateProject(draft => {
          if ((draft.teams || []).length <= 2) return
          if (draft.currentMatch.teamAId === teamId || draft.currentMatch.teamBId === teamId) return

          const removedPlayerIds = new Set((draft.players || [])
            .filter(player => player.teamId === teamId)
            .map(player => player.id))

          draft.teams = draft.teams.filter(team => team.id !== teamId)
          draft.players = draft.players.filter(player => player.teamId !== teamId)
          draft.currentMatch.startingFive.teamA = (draft.currentMatch.startingFive.teamA || []).filter(id => !removedPlayerIds.has(id))
          draft.currentMatch.startingFive.teamB = (draft.currentMatch.startingFive.teamB || []).filter(id => !removedPlayerIds.has(id))
        })
        if (editingTeamId === teamId) setEditingTeamId('')
        closeDialog()
      }
    })
  }

  const requestClearFcSystemTeams = () => {
    if (!removableFcSystemCount) return

    setDialog({
      kicker: 'FC SYSTEM',
      title: '清理 FC System 队伍',
      message: `将删除 ${removableFcSystemCount} 支非当前 A/B 的 FC System 队伍及其选手。手动队伍和当前 A/B 队会保留。继续？`,
      tone: 'danger',
      confirmLabel: '清理',
      cancelLabel: rosterText.cancel,
      onCancel: closeDialog,
      onConfirm: () => {
        let cleanupReport = null

        onUpdateProject(draft => {
          cleanupReport = clearProjectFcSystemTeams(draft, { preserveCurrentMatch: true })
        }, { undoReason: 'CLEAR FC SYSTEM TEAMS' })

        if (editingTeam && isProjectTeamFromFcSystem(editingTeam) && editingActiveSlots.length === 0) {
          setEditingTeamId('')
        }
        onPushLog?.(`清理 FC System 队伍 ${cleanupReport?.deletedTeams || removableFcSystemCount} 支`)
        closeDialog()
      }
    })
  }

  const addPlayerToTeam = teamId => {
    onUpdateProject(draft => {
      const targetTeam = draft.teams.find(item => item.id === teamId)
      if (!targetTeam) return

      const teamPlayers = getTeamPlayers(draft, teamId)
      if (teamPlayers.length >= MAX_ROSTER_PLAYERS) return

      const role = 'damage'
      const defaultHero = getDefaultHeroForRole(role)
      const id = createEntityId(`${teamId}-player`)

      draft.players.push({
        id,
        name: rosterText.defaultPlayerName(teamPlayers.length + 1),
        battleTag: '',
        role,
        teamId,
        avatar: '',
        portraitXPct: 50,
        primaryHeroes: defaultHero ? [defaultHero] : []
      })
      targetTeam.playerIds = [...new Set([
        ...teamPlayers.map(player => player.id),
        ...(targetTeam.playerIds || []),
        id
      ])]
    })
  }

  const removePlayerFromTeam = playerId => {
    onUpdateProject(draft => {
      draft.teams.forEach(team => {
        team.playerIds = (team.playerIds || []).filter(id => id !== playerId)
      })
      draft.currentMatch.startingFive.teamA = (draft.currentMatch.startingFive.teamA || []).filter(id => id !== playerId)
      draft.currentMatch.startingFive.teamB = (draft.currentMatch.startingFive.teamB || []).filter(id => id !== playerId)
      draft.players = draft.players.filter(player => player.id !== playerId)
    })
  }

  const sortTeams = () => {
    onUpdateProject(draft => {
      const activeTeamAId = draft.currentMatch?.teamAId || ''
      const activeTeamBId = draft.currentMatch?.teamBId || ''
      const originalOrder = new Map((draft.teams || []).map((team, index) => [team.id, index]))
      const getActiveRank = team => {
        if (team.id === activeTeamAId) return 0
        if (team.id === activeTeamBId) return 1
        return 2
      }
      const getSortLabel = team => `${team.shortName || ''} ${team.name || ''} ${team.id || ''}`.trim()

      draft.teams = [...(draft.teams || [])].sort((teamA, teamB) => {
        const activeRank = getActiveRank(teamA) - getActiveRank(teamB)
        if (activeRank) return activeRank

        const labelRank = getSortLabel(teamA).localeCompare(getSortLabel(teamB), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
        if (labelRank) return labelRank

        return (originalOrder.get(teamA.id) || 0) - (originalOrder.get(teamB.id) || 0)
      })
    })
  }

  const sortTeamPlayersByRole = teamId => {
    onUpdateProject(draft => {
      const targetTeam = draft.teams.find(item => item.id === teamId)
      if (!targetTeam) return

      const previousPlayerIds = getTeamPlayers(draft, teamId).map(player => player.id)
      const originalOrder = new Map(previousPlayerIds.map((id, index) => [id, index]))
      const playerById = new Map(draft.players.map(player => [player.id, player]))
      targetTeam.playerIds = previousPlayerIds.sort((a, b) => {
        const playerA = playerById.get(a)
        const playerB = playerById.get(b)
        const roleA = ROLE_SORT_ORDER[normalizeRosterRole(playerA?.role)] ?? 99
        const roleB = ROLE_SORT_ORDER[normalizeRosterRole(playerB?.role)] ?? 99
        return roleA - roleB || (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0)
      })
    })
  }

  const exportTeamDb = () => {
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`owbt-team-db-${date}.json`, JSON.stringify(buildTeamDbExport(project), null, 2))
  }

  const importTeamDb = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const payload = await readJsonFile(file)
      const imported = normalizeImportedTeamDb(payload)
      setDialog({
        kicker: rosterText.teamDbKicker,
        title: rosterText.importTeamDbTitle,
        message: rosterText.importTeamDbMessage(imported.teams.length),
        tone: 'danger',
        confirmLabel: rosterText.import,
        cancelLabel: rosterText.cancel,
        onCancel: closeDialog,
        onConfirm: () => {
          onUpdateProject(draft => {
            draft.teams = imported.teams
            draft.players = imported.players

            const teamAExists = draft.teams.some(team => team.id === draft.currentMatch.teamAId)
            const teamBExists = draft.teams.some(team => team.id === draft.currentMatch.teamBId)
            if (!teamAExists) draft.currentMatch.teamAId = draft.teams[0]?.id || ''
            if (!teamBExists) draft.currentMatch.teamBId = draft.teams[1]?.id || draft.teams[0]?.id || ''
            draft.currentMatch.startingFive.teamA = getStartingFiveForTeam(draft, draft.currentMatch.teamAId)
            draft.currentMatch.startingFive.teamB = getStartingFiveForTeam(draft, draft.currentMatch.teamBId)
          })
          setEditingTeamId('')
          closeDialog()
        }
      })
    } catch (error) {
      console.error('[OWBT] Failed to import Team DB:', error)
      setDialog({
        kicker: rosterText.teamDbKicker,
        title: rosterText.importFailedTitle,
        message: rosterText.invalidTeamDb,
        confirmLabel: rosterText.ok,
        onConfirm: closeDialog
      })
    }
  }

  return (
    <div className={styles.teamDbDesk}>
      <Panel title={rosterText.teamDatabase} className={styles.teamDbPanel}>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className={styles.teamDbFileInput}
          onChange={importTeamDb}
        />

        <div className={styles.teamDbToolbar}>
          <div className={styles.teamDbMetric}>
            <span>{rosterText.teams}</span>
            <strong>{visibleTeamRows.length} / {teams.length}</strong>
          </div>

          <div className={styles.teamDbMetric}>
            <span>{rosterText.players}</span>
            <strong>{project.players?.length || 0}</strong>
          </div>

          <label className={styles.teamDbSearch}>
            <span>{rosterText.search}</span>
            <input
              type="search"
              value={teamSearch}
              onChange={event => setTeamSearch(event.target.value)}
              placeholder={rosterText.searchPlaceholder}
            />
          </label>

          <button type="button" onClick={exportTeamDb}>
            {rosterText.exportDb}
          </button>

          <button type="button" onClick={() => importInputRef.current?.click()}>
            {rosterText.importDb}
          </button>

          <button type="button" onClick={sortTeams}>
            {rosterText.sortTeams}
          </button>

          <button
            type="button"
            className={styles.teamDbToolbarDanger}
            onClick={requestClearFcSystemTeams}
            disabled={!removableFcSystemCount}
          >
            清理 FC
          </button>

          <button type="button" className={styles.primaryButton} onClick={addTeam}>
            {rosterText.addTeam}
          </button>
        </div>

        <div className={styles.teamDbListHeader}>
          <span>#</span>
          <span>{rosterText.short}</span>
          <span>{rosterText.teamName}</span>
          <span>{rosterText.roster}</span>
          <span>{rosterText.roles}</span>
          <span>{rosterText.staff}</span>
          <span>{rosterText.status}</span>
          <span>{rosterText.action}</span>
        </div>

        <div className={styles.teamDbList}>
          {visibleTeamRows.map(({
            activeSlots,
            logoStatus,
            players,
            roleCounts,
            staffCount,
            sourceLabel,
            team,
            teamIndex
          }) => {
            const canDeleteTeam = teams.length > 2 && activeSlots.length === 0

            return (
              <div
                className={[
                  styles.teamDbListRow,
                  activeSlots.length ? styles.teamDbCardActive : '',
                  team.stale ? styles.teamDbCardStale : ''
                ].filter(Boolean).join(' ')}
                key={team.id}
              >
                <span>{teamIndex + 1}</span>
                <div className={styles.teamDbLogoMark} title={`Logo: ${logoStatus}`}>
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt=""
                      onError={event => {
                        event.currentTarget.hidden = true
                      }}
                    />
                  ) : (
                    <span>{team.shortName || '-'}</span>
                  )}
                </div>
                <strong>{team.shortName || '-'}</strong>
                <em>{team.name || team.id}</em>
                <span>{players.length} / {MAX_ROSTER_PLAYERS}</span>
                <span>{rosterText.roleSummary(roleCounts)}</span>
                <span>{staffCount ? rosterText.staffCount(staffCount) : '-'}</span>
                <span className={styles.teamDbSourceBadge}>{team.stale ? `${sourceLabel} / STALE` : sourceLabel}</span>

                <div className={styles.teamDbListActions}>
                  <button type="button" onClick={() => setEditingTeamId(team.id)}>
                    {rosterText.edit}
                  </button>
                  <button type="button" onClick={() => requestLoadMatchTeam('teamA', team.id)}>
                    A
                  </button>
                  <button type="button" onClick={() => requestLoadMatchTeam('teamB', team.id)}>
                    B
                  </button>
                  <button type="button" className={styles.dangerButton} disabled={!canDeleteTeam} onClick={() => deleteTeam(team.id)}>
                    {rosterText.deleteShort}
                  </button>
                </div>
              </div>
            )
          })}
          {!visibleTeamRows.length && (
            <div className={styles.teamDbEmptyState}>
              <span>{rosterText.noMatchingTeams}</span>
              <strong>{teamSearch}</strong>
            </div>
          )}
        </div>
      </Panel>

      {editingTeam && (
        <div className={styles.teamDbModalBackdrop} role="presentation">
          <section className={styles.teamDbModal} role="dialog" aria-modal="true">
            <header className={styles.teamDbModalHeader}>
              <div>
                <span>{rosterText.teamDbKicker}</span>
                <strong>{editingTeam.shortName || editingTeam.name || editingTeam.id}</strong>
              </div>
              <button type="button" onClick={() => setEditingTeamId('')}>
                {rosterText.close}
              </button>
            </header>

            <div className={styles.teamDbModalSummary}>
              <div>
                <span>{rosterText.short}</span>
                <strong>{editingTeam.shortName || '-'}</strong>
              </div>
              <div>
                <span>{rosterText.roster}</span>
                <strong>{editingPlayers.length} / {MAX_ROSTER_PLAYERS}</strong>
              </div>
              <div>
                <span>{rosterText.roles}</span>
                <strong>{rosterText.roleSummary(editingRoleCounts)}</strong>
              </div>
              <div>
                <span>{rosterText.status}</span>
                <strong>{editingActiveSlots.length ? rosterText.matchSlot(editingActiveSlots) : rosterText.library}</strong>
              </div>
            </div>

            <div className={styles.teamDbModalBody}>
              <div className={styles.teamDbTeamFields}>
                <Field label={copy.teamName}>
                  <input value={editingTeam.name || ''} onChange={updateTeam(editingTeam.id, 'name')} />
                </Field>

                <Field label={copy.teamShortName}>
                  <input value={editingTeam.shortName || ''} onChange={updateTeam(editingTeam.id, 'shortName')} />
                </Field>

                <Field label={copy.teamPrimaryColor}>
                  <div className={styles.teamColorControl}>
                    <input type="color" value={editingTeam.primaryColor || themePrimaryColor} onChange={updateTeam(editingTeam.id, 'primaryColor')} />
                    <button
                      type="button"
                      className={!editingTeam.primaryColor ? styles.activeOutline : ''}
                      onClick={() => onUpdateProject(draft => {
                        const target = draft.teams.find(item => item.id === editingTeam.id)
                        if (target) target.primaryColor = ''
                      })}
                    >
                      {rosterText.themeColor}
                    </button>
                  </div>
                </Field>

                <Field label={text.teamLogo}>
                  <div className={styles.teamLogoInputRow}>
                    <input value={editingTeam.logo || ''} onChange={updateTeam(editingTeam.id, 'logo')} placeholder={FRIES_CUP_CONFIG.defaultLogo} />
                    <button type="button" onClick={() => teamLogoInputRef.current?.click()}>
                      {text.uploadLogo}
                    </button>
                  </div>
                  <input
                    ref={teamLogoInputRef}
                    type="file"
                    accept="image/*,.svg"
                    hidden
                    onChange={event => {
                      applyEditingTeamLogoFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </Field>

                <Field label={rosterText.manager}>
                  <input value={editingTeam.manager || ''} onChange={updateTeam(editingTeam.id, 'manager')} />
                </Field>

                <Field label={rosterText.coach}>
                  <input value={editingTeam.coach || ''} onChange={updateTeam(editingTeam.id, 'coach')} />
                </Field>
              </div>

              <div className={styles.teamDbRosterBar}>
                <span>{rosterText.roster}</span>
                <strong>{editingPlayers.length} / {MAX_ROSTER_PLAYERS}</strong>
                <em>{rosterText.roleSummary(editingRoleCounts)}</em>
                <button type="button" onClick={() => addPlayerToTeam(editingTeam.id)} disabled={editingPlayers.length >= MAX_ROSTER_PLAYERS}>
                  {rosterText.add}
                </button>
              </div>

              <div className={styles.teamDbPlayerHeader}>
                <span>#</span>
                <span>{text.player}</span>
                <span>{rosterText.battleTag}</span>
                <span>{text.role}</span>
                <span>{rosterText.primaryHero}</span>
                <span />
              </div>

              <div className={styles.teamDbPlayerList}>
                {editingPlayers.map((player, index) => {
                  const role = normalizeRosterRole(player.role)
                  const roleHeroes = getHeroOptionsByRole(role)
                  const primaryHero = player.primaryHeroes?.[0] || ''

                  return (
                    <div className={styles.teamDbPlayerRow} key={player.id}>
                      <span>{index + 1}</span>
                      <input value={player.name || ''} onChange={event => updatePlayer(player.id, { name: event.target.value })} />
                      <input value={player.battleTag || ''} onChange={event => updatePlayer(player.id, { battleTag: event.target.value })} />
                      <select
                        value={role}
                        onChange={event => updatePlayer(player.id, {
                          role: event.target.value,
                          primaryHeroes: [getDefaultHeroForRole(event.target.value)].filter(Boolean)
                        })}
                      >
                        {OW_ROLE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{language === 'en' ? option.enLabel : option.label}</option>
                        ))}
                      </select>
                      <select value={primaryHero} onChange={event => updatePlayer(player.id, { primaryHeroes: [event.target.value] })}>
                        <option value="">{text.empty}</option>
                        {roleHeroes.map(hero => (
                          <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
                        ))}
                      </select>
                      <button type="button" className={styles.dangerButton} onClick={() => removePlayerFromTeam(player.id)}>
                        {rosterText.deleteShort}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <footer className={styles.teamDbModalActions}>
              <button type="button" onClick={() => requestLoadMatchTeam('teamA', editingTeam.id)}>
                {rosterText.loadA}
              </button>
              <button type="button" onClick={() => requestLoadMatchTeam('teamB', editingTeam.id)}>
                {rosterText.loadB}
              </button>
              <button type="button" onClick={() => sortTeamPlayersByRole(editingTeam.id)}>
                {rosterText.sortRole}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={teams.length <= 2 || editingTeam.id === teamAId || editingTeam.id === teamBId}
                onClick={() => deleteTeam(editingTeam.id)}
              >
                {rosterText.delTeam}
              </button>
            </footer>
          </section>
        </div>
      )}

      {dialog && <EditorDialog {...dialog} />}
    </div>
  )
}

export default TeamDatabaseEditor
