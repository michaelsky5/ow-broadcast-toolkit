import { useRef, useState } from 'react'
import { OW_ROLE_OPTIONS } from '../../../data/overwatch'
import { getTeamPlayers } from '../../../project/projectUtils'
import styles from '../shared/SceneEditor.styles.js'
import { getRosterEditorCopy } from '../shared/editorCopy'
import { EditorDialog, Field, Panel, SegmentedControl, ToggleField } from '../shared/editorControls'
import { ensureSceneSettings, getHeroLabel, getHeroOptionsByRole, getSceneSettings, getTeam } from '../shared/editorHelpers'
import TeamDatabaseEditor from './TeamDatabaseEditor'
import {
  MAX_ACTIVE_ROSTER_PLAYERS,
  MAX_ROSTER_PLAYERS,
  MIN_ACTIVE_ROSTER_PLAYERS,
  ROLE_SORT_ORDER,
  createEntityId,
  fileToDataUrl,
  getDefaultHeroForRole,
  getRoleCounts,
  getRosterOutputIds,
  getStartingFiveForTeam,
  getTeamDbLabel,
  getTeamDbNameKey,
  getUniqueId,
  normalizePortraitXPct,
  normalizeRosterRole,
  sanitizeId
} from './rosterEditorUtils'

const isSupportedLogoFile = file => (
  Boolean(file) &&
  (
    String(file.type || '').startsWith('image/') ||
    /\.(?:svg|png|jpe?g|webp|gif)$/i.test(file.name || '')
  )
)

function RosterEditor({ project, copy, text, language, activeSection = 'roster', onUpdateProject }) {
  const avatarInputRef = useRef(null)
  const teamLogoInputRef = useRef(null)
  const pendingAvatarSlotRef = useRef(null)
  const [draggingPlayerId, setDraggingPlayerId] = useState('')
  const [teamInfoExpanded, setTeamInfoExpanded] = useState(false)
  const [dialog, setDialog] = useState(null)
  const rosterText = getRosterEditorCopy(language)

  if (activeSection === 'teams') {
    return (
      <TeamDatabaseEditor
        project={project}
        copy={copy}
        text={text}
        language={language}
        rosterText={rosterText}
        onUpdateProject={onUpdateProject}
      />
    )
  }

  const settings = getSceneSettings(project, 'roster')
  const teamSide = String(settings.teamSide || 'A').toUpperCase() === 'B' ? 'B' : 'A'
  const sideKey = teamSide === 'B' ? 'teamB' : 'teamA'
  const team = getTeam(project, sideKey)
  const players = getTeamPlayers(project, team?.id).slice(0, MAX_ROSTER_PLAYERS)
  const rosterSlots = Array.from({ length: MAX_ROSTER_PLAYERS }, (_, index) => players[index] || null)
  const savedActivePlayerIds = settings.activePlayerIds?.[sideKey] || []
  const activePlayerIds = getRosterOutputIds(players, savedActivePlayerIds)
  const activePlayerIdSet = new Set(activePlayerIds)
  const activePlayers = activePlayerIds
    .map(playerId => players.find(player => player.id === playerId))
    .filter(Boolean)
  const themePrimaryColor = project.theme?.primary || '#FFD84A'
  const teamPrimaryColor = team?.primaryColor || themePrimaryColor
  const teamInfoActionLabel = language === 'zh'
    ? (teamInfoExpanded ? '收起' : '展开')
    : (teamInfoExpanded ? 'Collapse' : 'Expand')
  const showBattleTagColumn = true
  const roleCounts = getRoleCounts(activePlayers)

  const updateSetting = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'roster'), patch)
    })
  }

  const updateEventFullName = event => {
    const value = event.target.value
    onUpdateProject(draft => {
      draft.event.subtitle = value
      ensureSceneSettings(draft, 'roster').subtitle = value
    })
  }

  const updateTeam = field => event => {
    const value = event.target.value
    onUpdateProject(draft => {
      const target = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      if (target) target[field] = value
    })
  }

  const updateCurrentTeamLogo = value => {
    onUpdateProject(draft => {
      const target = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      if (target) target.logo = value
    })
  }

  const applyCurrentTeamLogoFile = async file => {
    if (!file) return

    if (!isSupportedLogoFile(file)) {
      setDialog({
        title: text.teamLogo,
        message: text.invalidLogoFile,
        confirmLabel: text.close,
        onConfirm: () => setDialog(null)
      })
      return
    }

    updateCurrentTeamLogo(await fileToDataUrl(file))
  }

  const updateRosterSlot = (slotIndex, playerId, patch) => {
    onUpdateProject(draft => {
      let target = draft.players.find(player => player.id === playerId)
      if (!target && slotIndex >= 0 && slotIndex < MAX_ROSTER_PLAYERS) {
        const targetTeam = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
        if (!targetTeam) return

        const role = normalizeRosterRole(patch.role)
        const id = createEntityId(`${targetTeam.id}-player`)
        target = {
          id,
          name: rosterText.defaultPlayerName(slotIndex + 1),
          battleTag: '',
          role,
          teamId: targetTeam.id,
          avatar: '',
          portraitXPct: 50,
          primaryHeroes: [getDefaultHeroForRole(role)].filter(Boolean)
        }
        draft.players.push(target)

        const nextPlayerIds = [...(targetTeam.playerIds || [])].filter(Boolean)
        nextPlayerIds.splice(slotIndex, 0, id)
        targetTeam.playerIds = nextPlayerIds.slice(0, MAX_ROSTER_PLAYERS)
      }

      if (target) Object.assign(target, patch)
    })
  }

  const selectPlayerAvatar = (slotIndex, playerId) => {
    pendingAvatarSlotRef.current = { slotIndex, playerId }
    avatarInputRef.current?.click()
  }

  const handlePlayerAvatarFile = async event => {
    const file = event.target.files?.[0]
    const pendingSlot = pendingAvatarSlotRef.current

    try {
      if (!file || !pendingSlot || !file.type.startsWith('image/')) return
      const avatar = await fileToDataUrl(file)
      updateRosterSlot(pendingSlot.slotIndex, pendingSlot.playerId, { avatar })
    } finally {
      pendingAvatarSlotRef.current = null
      event.target.value = ''
    }
  }

  const toggleRosterOutput = (playerId, nextActive) => {
    if (!playerId) return
    onUpdateProject(draft => {
      const draftSettings = ensureSceneSettings(draft, 'roster')
      const targetTeam = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      const targetPlayers = getTeamPlayers(draft, targetTeam?.id).slice(0, MAX_ROSTER_PLAYERS)
      const currentIds = getRosterOutputIds(targetPlayers, draftSettings.activePlayerIds?.[sideKey] || [])

      if (nextActive && currentIds.includes(playerId)) return
      if (!nextActive && !currentIds.includes(playerId)) return
      if (nextActive && currentIds.length >= MAX_ACTIVE_ROSTER_PLAYERS) return
      if (!nextActive && currentIds.length <= MIN_ACTIVE_ROSTER_PLAYERS) return

      draftSettings.activePlayerIds = {
        ...(draftSettings.activePlayerIds || {}),
        [sideKey]: nextActive
          ? [...currentIds, playerId]
          : currentIds.filter(id => id !== playerId)
      }
    })
  }

  const resetRosterOutput = () => {
    onUpdateProject(draft => {
      const draftSettings = ensureSceneSettings(draft, 'roster')
      const targetTeam = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      const defaultIds = getTeamPlayers(draft, targetTeam?.id)
        .slice(0, MIN_ACTIVE_ROSTER_PLAYERS)
        .map(player => player.id)

      draftSettings.activePlayerIds = {
        ...(draftSettings.activePlayerIds || {}),
        [sideKey]: defaultIds
      }
    })
  }

  const reorderPlayer = (sourcePlayerId, targetPlayerId) => {
    if (!sourcePlayerId || !targetPlayerId || sourcePlayerId === targetPlayerId) return

    onUpdateProject(draft => {
      const targetTeam = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      if (!targetTeam) return

      const previousPlayerIds = [...(targetTeam.playerIds || [])]
      const fromIndex = previousPlayerIds.indexOf(sourcePlayerId)
      const toIndex = previousPlayerIds.indexOf(targetPlayerId)
      if (fromIndex < 0 || toIndex < 0) return

      const nextPlayerIds = [...previousPlayerIds]
      const [movedPlayerId] = nextPlayerIds.splice(fromIndex, 1)
      nextPlayerIds.splice(toIndex, 0, movedPlayerId)
      targetTeam.playerIds = nextPlayerIds
    })
  }

  const sortPlayersByRole = () => {
    onUpdateProject(draft => {
      const targetTeam = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      if (!targetTeam) return

      const previousPlayerIds = [...(targetTeam.playerIds || [])]
      const originalOrder = new Map(previousPlayerIds.map((id, index) => [id, index]))
      const playerById = new Map(draft.players.map(player => [player.id, player]))
      const nextPlayerIds = [...previousPlayerIds].sort((a, b) => {
        const playerA = playerById.get(a)
        const playerB = playerById.get(b)
        const roleA = ROLE_SORT_ORDER[playerA?.role] ?? 99
        const roleB = ROLE_SORT_ORDER[playerB?.role] ?? 99
        return roleA - roleB || (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0)
      })

      targetTeam.playerIds = nextPlayerIds
    })
  }

  const saveTeamToDatabase = () => {
    if (!team) return

    let result = null
    onUpdateProject(draft => {
      const currentTeamId = draft.currentMatch[`${sideKey}Id`]
      const sourceTeam = draft.teams.find(item => item.id === currentTeamId)
      if (!sourceTeam) return

      const sourceKey = getTeamDbNameKey(sourceTeam)
      const duplicateTeam = sourceKey
        ? draft.teams.find(item => item.id !== sourceTeam.id && getTeamDbNameKey(item) === sourceKey)
        : null
      const sourcePlayers = getTeamPlayers(draft, sourceTeam.id).map(player => ({
        avatar: player.avatar || '',
        battleTag: player.battleTag || '',
        name: player.name || '',
        portraitXPct: normalizePortraitXPct(player.portraitXPct),
        primaryHeroes: [...(player.primaryHeroes || [])],
        role: normalizeRosterRole(player.role),
        teamId: sourceTeam.id
      }))

      if (!duplicateTeam) {
        sourceTeam.playerIds = getTeamPlayers(draft, sourceTeam.id).map(player => player.id)
        draft.currentMatch.startingFive[sideKey] = getStartingFiveForTeam(draft, sourceTeam.id)
        result = {
          title: rosterText.teamDbSaved,
          message: rosterText.teamDbSavedActiveMessage(getTeamDbLabel(sourceTeam))
        }
        return
      }

      const targetId = duplicateTeam.id
      const usedIds = new Set((draft.players || []).map(player => player.id))
      draft.players = (draft.players || []).filter(player => player.teamId !== targetId && player.teamId !== sourceTeam.id)
      sourcePlayers.forEach(player => usedIds.delete(player.id))

      const nextPlayerIds = sourcePlayers.map((player, index) => {
        const id = getUniqueId(
          `${targetId}-${sanitizeId(player.name) || `player-${index + 1}`}`,
          usedIds,
          `${targetId}-player`
        )
        draft.players.push({
          ...player,
          id,
          teamId: targetId
        })
        return id
      })

      Object.assign(duplicateTeam, {
        coach: sourceTeam.coach || '',
        description: sourceTeam.description || '',
        logo: sourceTeam.logo || '',
        manager: sourceTeam.manager || '',
        name: sourceTeam.name || '',
        playerIds: nextPlayerIds,
        primaryColor: sourceTeam.primaryColor || '',
        shortName: sourceTeam.shortName || ''
      })

      draft.teams = draft.teams.filter(item => item.id !== sourceTeam.id)
      ;['teamA', 'teamB'].forEach(matchSide => {
        if (draft.currentMatch[`${matchSide}Id`] === sourceTeam.id) {
          draft.currentMatch[`${matchSide}Id`] = targetId
        }
      })
      draft.currentMatch.startingFive.teamA = getStartingFiveForTeam(draft, draft.currentMatch.teamAId)
      draft.currentMatch.startingFive.teamB = getStartingFiveForTeam(draft, draft.currentMatch.teamBId)

      result = {
        title: rosterText.teamDbUpdated,
        message: rosterText.teamDbUpdatedMessage(getTeamDbLabel(duplicateTeam))
      }
    })

    setDialog({
      kicker: rosterText.rosterKicker,
      title: result?.title || rosterText.teamDbSaved,
      message: result?.message || rosterText.teamDbSavedMessage,
      confirmLabel: rosterText.ok,
      onConfirm: () => setDialog(null)
    })
  }

  return (
    <div className={styles.rosterDesk}>
      <div className={styles.rosterWorkspace}>
        <div className={styles.rosterRail}>
          <Panel title={rosterText.sceneCopy}>
            <Field label={text.eventSubtitle}>
              <input value={project.event.subtitle || settings.subtitle || ''} onChange={updateEventFullName} />
            </Field>

            <Field label={rosterText.teamTarget}>
              <SegmentedControl
                value={teamSide}
                options={[
                  { value: 'A', label: copy.teamA },
                  { value: 'B', label: copy.teamB }
                ]}
                onChange={value => updateSetting({ teamSide: value })}
              />
            </Field>

            <ToggleField
              label={language === 'zh' ? '显示赞助商' : 'Show Sponsors'}
              checked={settings.showSponsors !== false}
              onChange={checked => updateSetting({ showSponsors: checked })}
            />
          </Panel>

          <Panel title={rosterText.teamInfo}>
            <button
              type="button"
              className={styles.rosterTeamInfoDisclosure}
              aria-expanded={teamInfoExpanded}
              onClick={() => setTeamInfoExpanded(expanded => !expanded)}
            >
              <span
                className={styles.rosterTeamColorSwatch}
                style={{ '--roster-team-color': teamPrimaryColor }}
              />
              <span className={styles.rosterTeamInfoIdentity}>
                <strong>{team?.shortName || '-'}</strong>
                <em>{team?.name || team?.id || rosterText.teamLabel}</em>
              </span>
              <span className={styles.rosterTeamInfoAction}>{teamInfoActionLabel}</span>
            </button>

            {teamInfoExpanded && (
              <div className={styles.rosterTeamInfoFields}>
                <Field label={copy.teamName}>
                  <input value={team?.name || ''} onChange={updateTeam('name')} />
                </Field>
                <div className={styles.twoCol}>
                  <Field label={copy.teamShortName}>
                    <input value={team?.shortName || ''} onChange={updateTeam('shortName')} />
                  </Field>
                  <Field label={copy.teamPrimaryColor}>
                    <div className={styles.teamColorControl}>
                      <input type="color" value={teamPrimaryColor} onChange={updateTeam('primaryColor')} />
                      <button
                        type="button"
                        className={!team?.primaryColor ? styles.activeOutline : ''}
                        onClick={() => onUpdateProject(draft => {
                          const target = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
                          if (target) target.primaryColor = ''
                        })}
                      >
                        {rosterText.themeColor}
                      </button>
                    </div>
                  </Field>
                </div>
                <div className={styles.teamLogoSaveRow}>
                  <Field label={text.teamLogo}>
                    <div className={styles.teamLogoInputRow}>
                      <input value={team?.logo || ''} onChange={updateTeam('logo')} placeholder="/OW.svg" />
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
                        applyCurrentTeamLogoFile(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </Field>
                  <button type="button" className={styles.teamDbSaveButton} onClick={saveTeamToDatabase}>
                    {rosterText.saveTeamDb}
                  </button>
                </div>
                <div className={styles.teamStaffDesk}>
                  <div className={styles.teamStaffDeskHeader}>
                    <span>{rosterText.staff}</span>
                    <strong>{settings.showManager || settings.showCoach ? rosterText.show : rosterText.hide}</strong>
                  </div>
                  <div className={styles.teamStaffRow}>
                    <span>{rosterText.manager}</span>
                    <input value={team?.manager || ''} onChange={updateTeam('manager')} />
                    <button
                      type="button"
                      className={settings.showManager ? styles.activeOutline : ''}
                      onClick={() => updateSetting({ showManager: !settings.showManager })}
                    >
                      {settings.showManager ? rosterText.on : rosterText.off}
                    </button>
                  </div>
                  <div className={styles.teamStaffRow}>
                    <span>{rosterText.coach}</span>
                    <input value={team?.coach || ''} onChange={updateTeam('coach')} />
                    <button
                      type="button"
                      className={settings.showCoach ? styles.activeOutline : ''}
                      onClick={() => updateSetting({ showCoach: !settings.showCoach })}
                    >
                      {settings.showCoach ? rosterText.on : rosterText.off}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <Panel title={rosterText.playerList} className={styles.rosterPlayersPanel}>
          <div className={styles.rosterStatusStrip}>
            <div>
              <span>{rosterText.teamLabel}</span>
              <strong>{team?.name || team?.shortName || (teamSide === 'B' ? copy.teamB : copy.teamA)}</strong>
            </div>
            <div>
              <span>{rosterText.slots}</span>
              <strong>{MAX_ROSTER_PLAYERS}</strong>
            </div>
            <div>
              <span>{rosterText.active}</span>
              <strong>{activePlayers.length} / {MAX_ROSTER_PLAYERS}</strong>
            </div>
            <div>
              <span>{rosterText.tank}</span>
              <strong>{roleCounts.tank || 0}</strong>
            </div>
            <div>
              <span>{rosterText.damage}</span>
              <strong>{roleCounts.damage || 0}</strong>
            </div>
            <div>
              <span>{rosterText.support}</span>
              <strong>{roleCounts.support || 0}</strong>
            </div>
            <button type="button" onClick={sortPlayersByRole}>
              {rosterText.sortRole}
            </button>
            <button type="button" className={styles.primaryButton} onClick={resetRosterOutput}>
              {rosterText.reset}
            </button>
          </div>

          <div
            className={[
              styles.rosterPlayerHeader,
              !showBattleTagColumn ? styles.rosterPlayerHeaderNoBattleTag : ''
            ].filter(Boolean).join(' ')}
          >
            <span>{rosterText.slot}</span>
            <span>{text.player}</span>
            {showBattleTagColumn && <span>{rosterText.battleTag}</span>}
            <span>{text.role}</span>
            <span>{rosterText.primaryHero}</span>
            <span>{rosterText.portraitX}</span>
            <span>{text.avatarUrl}</span>
            <span>{rosterText.active}</span>
          </div>

          <div className={styles.rosterPlayerList}>
            {rosterSlots.map((player, index) => {
              const isPlayerActive = Boolean(player?.id && activePlayerIdSet.has(player.id))
              const canToggleActive = Boolean(player?.id) && (
                isPlayerActive
                  ? activePlayers.length > MIN_ACTIVE_ROSTER_PLAYERS
                  : activePlayers.length < MAX_ACTIVE_ROSTER_PLAYERS
              )
              const isMaxLocked = Boolean(player?.id && !isPlayerActive && activePlayers.length >= MAX_ACTIVE_ROSTER_PLAYERS)
              const roleHeroes = getHeroOptionsByRole(player?.role || 'damage')
              const primaryHero = player?.primaryHeroes?.[0] || ''
              const portraitXPct = normalizePortraitXPct(player?.portraitXPct)

              return (
                <div
                  className={[
                    styles.rosterPlayerRow,
                    !showBattleTagColumn ? styles.rosterPlayerRowNoBattleTag : '',
                    !isPlayerActive ? styles.rosterPlayerInactive : '',
                    draggingPlayerId === player?.id ? styles.rosterPlayerDragging : ''
                  ].join(' ')}
                  key={player?.id || `empty-slot-${index}`}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault()
                    const sourcePlayerId = event.dataTransfer.getData('text/plain') || draggingPlayerId
                    if (player?.id) reorderPlayer(sourcePlayerId, player.id)
                    setDraggingPlayerId('')
                  }}
                >
                  <div
                    className={styles.rosterIndex}
                    draggable={Boolean(player?.id)}
                    title={rosterText.dragToReorder}
                    onDragStart={event => {
                      if (!player?.id) return
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', player.id)
                      setDraggingPlayerId(player.id)
                    }}
                    onDragEnd={() => setDraggingPlayerId('')}
                  >
                    <strong>P{index + 1}</strong>
                    <span>{rosterText.slot}</span>
                  </div>
                  <Field label={text.player}>
                    <input value={player?.name || ''} onChange={event => updateRosterSlot(index, player?.id, { name: event.target.value })} />
                  </Field>
                  {showBattleTagColumn && (
                    <Field label={rosterText.battleTag}>
                      <input value={player?.battleTag || ''} onChange={event => updateRosterSlot(index, player?.id, { battleTag: event.target.value })} />
                    </Field>
                  )}
                  <Field label={text.role}>
                    <select
                      value={player?.role || 'damage'}
                      onChange={event => updateRosterSlot(index, player?.id, {
                        role: event.target.value,
                        primaryHeroes: [getHeroOptionsByRole(event.target.value)[0]?.id || '']
                      })}
                    >
                      {OW_ROLE_OPTIONS.map(role => (
                        <option key={role.value} value={role.value}>{language === 'en' ? role.enLabel : role.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={rosterText.primaryHero}>
                    <select value={primaryHero} onChange={event => updateRosterSlot(index, player?.id, { primaryHeroes: [event.target.value] })}>
                      <option value="">{text.empty}</option>
                      {roleHeroes.map(hero => (
                        <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={rosterText.portraitX}>
                    <div className={styles.rosterXControlWithReset}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={portraitXPct}
                        onChange={event => updateRosterSlot(index, player?.id, { portraitXPct: normalizePortraitXPct(event.target.value) })}
                      />
                      <button
                        type="button"
                        disabled={!player?.id}
                        onClick={() => updateRosterSlot(index, player?.id, { portraitXPct: 50 })}
                        title={rosterText.resetPortraitX}
                      >
                        R
                      </button>
                    </div>
                  </Field>
                  <Field label={text.avatarUrl}>
                    <div className={styles.rosterImageControl}>
                      <input value={player?.avatar || ''} onChange={event => updateRosterSlot(index, player?.id, { avatar: event.target.value })} />
                      <button type="button" onClick={() => selectPlayerAvatar(index, player?.id)}>
                        {rosterText.loadImage}
                      </button>
                    </div>
                  </Field>
                  <div className={styles.rosterRowActions}>
                    <button
                      type="button"
                      className={isPlayerActive ? styles.primaryButton : styles.secondaryButton}
                      disabled={!canToggleActive}
                      aria-pressed={isPlayerActive}
                      title={isMaxLocked ? rosterText.outputMaxHint : undefined}
                      onClick={() => toggleRosterOutput(player?.id, !isPlayerActive)}
                    >
                      {isPlayerActive ? rosterText.on : isMaxLocked ? rosterText.max : rosterText.off}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handlePlayerAvatarFile}
      />
      {dialog && <EditorDialog {...dialog} />}
    </div>
  )
}

export default RosterEditor
