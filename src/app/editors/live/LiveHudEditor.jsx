import { useState } from 'react'
import { OW_MAP_BY_ID, needsAttackDefense } from '../../../data/overwatch'
import { getBroadcastCompetitionName, getEventLogo } from '../../../project/branding'
import { getStartingPlayers, getTeamPlayers } from '../../../project/projectUtils'
import styles from '../shared/SceneEditor.styles.js'
import { getLiveEditorCopy } from '../shared/editorCopy'
import { Field, Panel, SegmentedControl, ToggleField } from '../shared/editorControls'
import {
  BAN_ROLE_OPTIONS,
  DEFAULT_BAN_ENTRY,
  buildBanEntry,
  ensureMapLineup,
  ensureSceneSettings,
  getHeroLabel,
  getHeroOptionsByRole,
  getMapLineupEntry,
  getPlayerRoleLabel,
  getTeam,
  normalizeBanList,
  parseBanEntry,
  updateMapLineupEntry
} from '../shared/editorHelpers'

const isHexColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
const safeColorValue = (value, fallback) => (isHexColor(value) ? String(value).trim() : fallback)
const safePanelColorValue = value => {
  const color = String(value || '').trim().toLowerCase()
  if (color === '#000000' || color === '#050505') return '#2A2A2A'
  return safeColorValue(value, '#2A2A2A')
}
const DEFAULT_HUD_OFFSET = 0
const DEFAULT_TOURNAMENT_HUD_OFFSET = 56
const DEFAULT_EVENT_LOGO_BG = '#2A2A2A'
const DEFAULT_PANEL_BG = '#2A2A2A'
const DEFAULT_TEAM_NAME_SIZE = 20
const DEFAULT_PLAYER_NAME_SIZE = 12
const clampNumber = (value, fallback, min, max) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}
const cleanWholeNumber = value => String(value ?? '').replace(/\D+/g, '')
const LIVE_TEAM_ROLE_ORDER = ['damage', 'damage', 'tank', 'support', 'support']
const parseRecordValue = value => {
  const text = String(value || '').trim().replace(/\s+/g, '')
  const match = text.match(/^(\d+)W?[-/]*(\d+)L?$/i)
  return match ? { w: match[1], l: match[2] } : { w: '', l: '' }
}
const normalizeLiveRole = role => {
  const value = String(role || '').trim().toLowerCase()
  if (['damage', 'dps', 'attack'].includes(value)) return 'damage'
  if (['tank', 'main tank', 'off tank'].includes(value)) return 'tank'
  if (['support', 'sup', 'healer'].includes(value)) return 'support'
  return value || 'damage'
}
const getDefaultStartingFive = (project, teamId) => {
  const players = getTeamPlayers(project, teamId)
  const usedIds = new Set()
  const orderedPlayers = LIVE_TEAM_ROLE_ORDER
    .map(role => {
      const player = players.find(item => !usedIds.has(item.id) && normalizeLiveRole(item.role) === role)
      if (player) usedIds.add(player.id)
      return player
    })
    .filter(Boolean)

  players.forEach(player => {
    if (!usedIds.has(player.id)) {
      orderedPlayers.push(player)
      usedIds.add(player.id)
    }
  })

  return orderedPlayers.slice(0, 5).map(player => player.id)
}
const getTeamSelectLabel = team => {
  const shortName = String(team?.shortName || '').trim()
  const name = String(team?.name || '').trim()
  const fallback = String(team?.id || 'Team').trim()

  if (shortName && name) return `${shortName} / ${name}`
  return shortName || name || fallback
}
const getRecordParts = (hud, suffix) => {
  const win = cleanWholeNumber(hud?.[`teamRecord${suffix}W`])
  const loss = cleanWholeNumber(hud?.[`teamRecord${suffix}L`])
  if (win || loss) return { w: win, l: loss }
  return parseRecordValue(hud?.[`teamRecord${suffix}`])
}
const buildRecordValue = record => {
  if (!record.w && !record.l) return ''
  return `${record.w || 0}W-${record.l || 0}L`
}

function PackageActionField({ label, actionLabel = 'Reset', onAction, children }) {
  return (
    <div className={styles.livePackageActionField}>
      <div className={styles.livePackageActionLabel}>
        <span>{label}</span>
        <button type="button" onClick={onAction}>{actionLabel}</button>
      </div>
      {children}
    </div>
  )
}

function LiveTeamControlPanel({
  side,
  project,
  copy,
  text,
  liveText,
  language,
  showSideControl,
  attackSide,
  onSetAttackSide,
  onSetMapWinner,
  onTriggerLineup,
  onUpdateProject,
  onUpdateLiveProject = onUpdateProject,
  teamInfoUnlocked,
  onToggleTeamInfoUnlocked
}) {
  const sideKey = side === 'B' ? 'teamB' : 'teamA'
  const team = getTeam(project, sideKey)
  const currentTeamId = project.currentMatch?.[`${sideKey}Id`] || ''
  const players = getTeamPlayers(project, team?.id)
  const teamOptions = project.teams || []
  const liveSlotPlayers = getStartingPlayers(project, sideKey)
  const banKey = side === 'B' ? 'bansB' : 'bansA'
  const banInfo = parseBanEntry(project.currentMatch?.[banKey]?.[0] || DEFAULT_BAN_ENTRY)
  const heroOptions = getHeroOptionsByRole(banInfo.role)
  const sideIsAttack = attackSide === side
  const sideLabel = sideIsAttack ? liveText.attackShort : liveText.defenseShort
  const subIndexKey = side === 'B' ? 'subIndexB' : 'subIndexA'
  const activeSubIndex = Number(project.currentMatch?.hud?.[subIndexKey])
  const safeActiveSubIndex = Number.isFinite(activeSubIndex) ? activeSubIndex : -1
  const isBanPanelActive = Boolean(project.currentMatch?.hud?.showBans)
  const sideName = side === 'B' ? liveText.teamB : liveText.teamA
  const teamShortName = team?.shortName || (side === 'B' ? 'TMB' : 'TMA')
  const isBFirst = project.currentMatch.banOrderMode === 'B_FIRST'
  const banOrderLabel = side === 'B'
    ? (isBFirst ? liveText.bFirst : liveText.bSecond)
    : (isBFirst ? liveText.aSecond : liveText.aFirst)

  const updateTeamField = field => event => {
    const value = event.target.value
    onUpdateProject(draft => {
      const target = draft.teams.find(item => item.id === draft.currentMatch[`${sideKey}Id`])
      if (target) target[field] = value
    })
  }

  const selectMatchTeam = event => {
    const nextTeamId = event.target.value
    if (!nextTeamId || nextTeamId === currentTeamId) return

    onUpdateLiveProject(draft => {
      draft.currentMatch[`${sideKey}Id`] = nextTeamId
      if (!draft.currentMatch.startingFive) draft.currentMatch.startingFive = { teamA: [], teamB: [] }
      draft.currentMatch.startingFive[sideKey] = getDefaultStartingFive(draft, nextTeamId)
      draft.currentMatch.hud = {
        ...(draft.currentMatch.hud || {}),
        [subIndexKey]: -1
      }
    }, { undoReason: `LOAD TEAM ${side}` })
  }

  const updateBan = patch => {
    const next = {
      ...banInfo,
      ...patch
    }

    onUpdateLiveProject(draft => {
      draft.currentMatch[banKey] = [buildBanEntry(next.role, next.hero)]
    })
  }

  const clearBan = () => {
    onUpdateLiveProject(draft => {
      draft.currentMatch[banKey] = []
    })
  }

  const setPlayerSlot = (index, playerId) => {
    onUpdateLiveProject(draft => {
      if (!draft.currentMatch.startingFive) draft.currentMatch.startingFive = { teamA: [], teamB: [] }
      if (!draft.currentMatch.startingFive[sideKey]) draft.currentMatch.startingFive[sideKey] = []
      draft.currentMatch.startingFive[sideKey][index] = playerId
    })
  }

  const triggerKeyPlayer = (index, playerId) => {
    const player = project.players.find(item => item.id === playerId)
    onUpdateLiveProject(draft => {
      draft.currentMatch.hud = {
        ...(draft.currentMatch.hud || {}),
        keyPlayerTriggerAt: Date.now(),
        keyPlayerSide: side,
        keyPlayerName: player?.name || `P${index + 1}`
      }
    })
  }

  const toggleSubPlayer = index => {
    onUpdateLiveProject(draft => {
      const hud = draft.currentMatch.hud || {}
      const current = Number(hud[subIndexKey])
      draft.currentMatch.hud = {
        ...hud,
        [subIndexKey]: Number.isFinite(current) && current === index ? -1 : index
      }
    })
  }

  return (
    <Panel title={liveText.teamControl(side)} className={styles.liveTeamPanel}>
      <div className={`${styles.liveTeamControlGrid} ${showSideControl ? '' : styles.noSideControl}`}>
        <label className={styles.liveSideBadge}>
          <span>{sideName}</span>
          <select
            aria-label={`${sideName} ${copy.teamPreset || 'Team'}`}
            value={currentTeamId}
            onChange={selectMatchTeam}
          >
            {!teamOptions.length && <option value="">{text.empty}</option>}
            {currentTeamId && !teamOptions.some(option => option.id === currentTeamId) && (
              <option value={currentTeamId}>{teamShortName}</option>
            )}
            {teamOptions.map(option => (
              <option key={option.id} value={option.id}>
                {getTeamSelectLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onTriggerLineup(side, 'LIST')}>{liveText.lineup}</button>
        <button type="button" onClick={() => onTriggerLineup(side, 'CALLOUT')}>{liveText.callout}</button>
        {showSideControl && (
          <button
            type="button"
            className={sideIsAttack ? styles.activeOutline : ''}
            onClick={() => onSetAttackSide(side)}
          >
            {sideLabel}
          </button>
        )}
        <button type="button" className={styles.primaryButton} onClick={() => onSetMapWinner(side)}>
          {liveText.winner}
        </button>
      </div>

      <div className={`${styles.liveTeamInfoRow} ${teamInfoUnlocked ? '' : styles.liveTeamInfoRowLocked}`}>
        <Field label={copy.teamName}>
          <input value={team?.name || ''} disabled={!teamInfoUnlocked} onChange={updateTeamField('name')} />
        </Field>
        <Field label={copy.teamShortName}>
          <input value={team?.shortName || ''} disabled={!teamInfoUnlocked} onChange={updateTeamField('shortName')} />
        </Field>
        <Field label={text.teamLogo}>
          <input value={team?.logo || ''} disabled={!teamInfoUnlocked} onChange={updateTeamField('logo')} placeholder="/OW.svg" />
        </Field>
        <button
          type="button"
          className={teamInfoUnlocked ? styles.liveTeamInfoUnlockActive : styles.liveTeamInfoUnlockButton}
          onClick={onToggleTeamInfoUnlocked}
          title={teamInfoUnlocked ? liveText.lockTeamFields : liveText.unlockTeamFields}
        >
          {teamInfoUnlocked ? liveText.lock : liveText.unlock}
        </button>
      </div>

      <div className={`${styles.liveBanPanel} ${isBanPanelActive ? styles.liveBanPanelActive : styles.liveBanPanelDimmed}`}>
        <div className={styles.sectionTitle}>{liveText.banTitle}</div>
        <button
          type="button"
          onClick={() => onUpdateLiveProject(draft => {
            draft.currentMatch.banOrderMode = draft.currentMatch.banOrderMode === 'B_FIRST' ? 'A_FIRST' : 'B_FIRST'
          })}
        >
          {banOrderLabel}
        </button>
        <select value={banInfo.role} onChange={event => updateBan({ role: event.target.value, hero: 'tbd' })}>
          {BAN_ROLE_OPTIONS.map(role => (
            <option key={role} value={role}>{getPlayerRoleLabel({ role }, language)}</option>
          ))}
        </select>
        <select value={banInfo.hero} onChange={event => updateBan({ hero: event.target.value })}>
          <option value="tbd">TBD</option>
          {heroOptions.map(hero => (
            <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
          ))}
        </select>
        <button type="button" className={styles.dangerButton} onClick={clearBan}>{liveText.clear}</button>
      </div>

      <div className={styles.livePlayersPanel}>
        <div className={styles.sectionTitle}>{liveText.currentPlayers}</div>
        <div className={styles.livePlayersGrid}>
          {Array.from({ length: 5 }).map((_, index) => {
            const selectedPlayerId = liveSlotPlayers[index]?.id || ''
            const isSubActive = safeActiveSubIndex === index

            return (
              <div className={styles.livePlayerSlot} key={`${side}-player-${index}`}>
                <span>{liveText.playerSlot(index)}</span>
                <select
                  value={selectedPlayerId}
                  onChange={event => setPlayerSlot(index, event.target.value)}
                >
                  <option value="">{text.empty}</option>
                  {players.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
                <div className={styles.livePlayerActions}>
                  <button type="button" onClick={() => triggerKeyPlayer(index, selectedPlayerId)}>
                    {liveText.key}
                  </button>
                  <button
                    type="button"
                    className={isSubActive ? styles.activeOutline : ''}
                    onClick={() => toggleSubPlayer(index)}
                  >
                    {isSubActive ? liveText.in : liveText.sub}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}


function LiveHudPackagePanel({ project, hud, liveText, updateHud }) {
  const uiMode = hud.uiMode === 'TOURNAMENT' ? 'TOURNAMENT' : 'NORMAL'
  const teamMetaMode = hud.teamMetaMode || 'HIDDEN'
  const recordA = getRecordParts(hud, 'A')
  const recordB = getRecordParts(hud, 'B')
  const teamNameFontSize = clampNumber(hud.teamNameFontSize, DEFAULT_TEAM_NAME_SIZE, 14, 28)
  const playerNameFontSize = clampNumber(hud.playerNameFontSize, DEFAULT_PLAYER_NAME_SIZE, 9, 16)
  const topEventLogoVisible = hud.topEventLogoVisible !== false
  const topMatchFormatVisible = hud.topMatchFormatVisible !== false
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)
  const matchFormat = `FT${Number(project.currentMatch?.ft) || 3}`

  const setUiMode = value => {
    const nextMode = value === 'TOURNAMENT' ? 'TOURNAMENT' : 'NORMAL'
    const currentOffset = Number(hud.hudMarginTop)

    updateHud({
      uiMode: nextMode,
      hudMarginTop: nextMode === 'TOURNAMENT'
        ? (Number.isFinite(currentOffset) && currentOffset > 0 ? currentOffset : DEFAULT_TOURNAMENT_HUD_OFFSET)
        : DEFAULT_HUD_OFFSET
    })
  }

  const clearTeamStatusFields = () => {
    updateHud({
      teamRecordA: '',
      teamRecordB: '',
      teamRecordAW: '',
      teamRecordAL: '',
      teamRecordBW: '',
      teamRecordBL: '',
      teamSeedA: '',
      teamSeedB: '',
      teamMetaA: '',
      teamMetaB: ''
    })
  }

  const updateRecord = (suffix, key, value) => {
    const current = getRecordParts(hud, suffix)
    const next = {
      ...current,
      [key.toLowerCase()]: cleanWholeNumber(value)
    }

    updateHud({
      [`teamRecord${suffix}W`]: next.w,
      [`teamRecord${suffix}L`]: next.l,
      [`teamRecord${suffix}`]: buildRecordValue(next)
    })
  }

  const renderTeamMetaFields = () => {
    if (teamMetaMode === 'HIDDEN') {
      return (
        <div className={styles.livePackageNote}>
          <span>{liveText.teamStatus}</span>
          <strong>{liveText.statusHiddenNote}</strong>
        </div>
      )
    }

    if (teamMetaMode === 'RECORD') {
      return (
        <div className={styles.livePackageRecordGrid}>
          <Field label={liveText.teamAWins}>
            <input
              type="number"
              min="0"
              value={recordA.w}
              onChange={event => updateRecord('A', 'W', event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={liveText.teamALosses}>
            <input
              type="number"
              min="0"
              value={recordA.l}
              onChange={event => updateRecord('A', 'L', event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={liveText.teamBWins}>
            <input
              type="number"
              min="0"
              value={recordB.w}
              onChange={event => updateRecord('B', 'W', event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={liveText.teamBLosses}>
            <input
              type="number"
              min="0"
              value={recordB.l}
              onChange={event => updateRecord('B', 'L', event.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
      )
    }

    if (teamMetaMode === 'SEED') {
      return (
        <div className={styles.livePackagePairGrid}>
          <Field label={liveText.teamASeed}>
            <input
              value={hud.teamSeedA || ''}
              onChange={event => updateHud({ teamSeedA: event.target.value })}
              placeholder="#1"
            />
          </Field>
          <Field label={liveText.teamBSeed}>
            <input
              value={hud.teamSeedB || ''}
              onChange={event => updateHud({ teamSeedB: event.target.value })}
              placeholder="#8"
            />
          </Field>
        </div>
      )
    }

    return (
      <div className={styles.livePackagePairGrid}>
        <Field label={liveText.teamALabel}>
          <input
            value={hud.teamMetaA || ''}
            onChange={event => updateHud({ teamMetaA: event.target.value })}
            placeholder="LOWER FINAL"
          />
        </Field>
        <Field label={liveText.teamBLabel}>
          <input
            value={hud.teamMetaB || ''}
            onChange={event => updateHud({ teamMetaB: event.target.value })}
            placeholder="TOP SEED"
          />
        </Field>
      </div>
    )
  }

  return (
    <div className={styles.livePackageGrid}>
      <Panel title={liveText.liveSetup} className={styles.livePackagePanel}>
        <div className={styles.livePackageStack}>
          <div className={styles.livePackageTopRow}>
            <Field label={liveText.liveMode}>
              <SegmentedControl
                value={uiMode}
                options={[
                  { value: 'NORMAL', label: liveText.genericMode },
                  { value: 'TOURNAMENT', label: liveText.tournamentMode }
                ]}
                onChange={setUiMode}
              />
            </Field>

            <div className={styles.livePackageCapsuleField}>
              <span>{liveText.topEventCapsule}</span>
              <div className={styles.livePackageToggleRow}>
                <ToggleField
                  label={liveText.showEventLogo}
                  checked={topEventLogoVisible}
                  onChange={checked => updateHud({ topEventLogoVisible: checked })}
                />
                <ToggleField
                  label={liveText.showFtLabel}
                  checked={topMatchFormatVisible}
                  onChange={checked => updateHud({ topMatchFormatVisible: checked })}
                />
              </div>
            </div>
          </div>

          <div className={styles.livePackageThreeGrid}>
            <PackageActionField
              label={liveText.centerText}
              actionLabel={liveText.auto}
              onAction={() => updateHud({ topEventTitle: '' })}
            >
              <input
                value={hud.topEventTitle || ''}
                onChange={event => updateHud({ topEventTitle: event.target.value })}
                placeholder={eventName}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.logoSource}
              actionLabel={liveText.eventAction}
              onAction={() => updateHud({ topEventLogo: '', topEventLogoVisible: true })}
            >
              <input
                value={hud.topEventLogo || ''}
                disabled={!topEventLogoVisible}
                onChange={event => updateHud({ topEventLogo: event.target.value })}
                placeholder={eventLogo || '/OW.svg'}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.ftLabel}
              actionLabel={liveText.auto}
              onAction={() => updateHud({ topMatchFormatLabel: '', topMatchFormatVisible: true })}
            >
              <input
                value={hud.topMatchFormatLabel || ''}
                disabled={!topMatchFormatVisible}
                onChange={event => updateHud({ topMatchFormatLabel: event.target.value })}
                placeholder={matchFormat}
              />
            </PackageActionField>
          </div>

          <div className={styles.livePackageThreeGrid}>
            <PackageActionField
              label={liveText.hudYOffset}
              actionLabel={liveText.reset}
              onAction={() => updateHud({
                hudMarginTop: uiMode === 'TOURNAMENT' ? DEFAULT_TOURNAMENT_HUD_OFFSET : DEFAULT_HUD_OFFSET
              })}
            >
              <input
                type="number"
                min="0"
                max="120"
                value={Number(hud.hudMarginTop) || 0}
                onChange={event => updateHud({ hudMarginTop: Number(event.target.value) || 0 })}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.teamNameSize}
              actionLabel={liveText.reset}
              onAction={() => updateHud({ teamNameFontSize: DEFAULT_TEAM_NAME_SIZE })}
            >
              <input
                type="number"
                min="14"
                max="28"
                value={teamNameFontSize}
                onChange={event => updateHud({ teamNameFontSize: clampNumber(event.target.value, DEFAULT_TEAM_NAME_SIZE, 14, 28) })}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.playerNameSize}
              actionLabel={liveText.reset}
              onAction={() => updateHud({ playerNameFontSize: DEFAULT_PLAYER_NAME_SIZE })}
            >
              <input
                type="number"
                min="9"
                max="16"
                value={playerNameFontSize}
                onChange={event => updateHud({ playerNameFontSize: clampNumber(event.target.value, DEFAULT_PLAYER_NAME_SIZE, 9, 16) })}
              />
            </PackageActionField>
          </div>

          <div className={styles.livePackageThreeGrid}>
            <PackageActionField
              label={liveText.eventLogoBg}
              actionLabel={liveText.reset}
              onAction={() => updateHud({ eventLogoBg: DEFAULT_EVENT_LOGO_BG })}
            >
              <input
                type="color"
                value={safeColorValue(hud.eventLogoBg, DEFAULT_EVENT_LOGO_BG)}
                onChange={event => updateHud({ eventLogoBg: event.target.value })}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.teamALogoBg}
              actionLabel={liveText.reset}
              onAction={() => updateHud({ teamLogoBgA: DEFAULT_PANEL_BG })}
            >
              <input
                type="color"
                value={safePanelColorValue(hud.teamLogoBgA)}
                onChange={event => updateHud({ teamLogoBgA: event.target.value })}
              />
            </PackageActionField>
            <PackageActionField
              label={liveText.teamBLogoBg}
              actionLabel={liveText.reset}
              onAction={() => updateHud({ teamLogoBgB: DEFAULT_PANEL_BG })}
            >
              <input
                type="color"
                value={safePanelColorValue(hud.teamLogoBgB)}
                onChange={event => updateHud({ teamLogoBgB: event.target.value })}
              />
            </PackageActionField>
          </div>
        </div>
      </Panel>

      <Panel title={liveText.teamStatus} className={`${styles.livePackagePanel} ${styles.liveStatusPanel}`}>
        <div className={styles.livePackageStack}>
          <Field label={liveText.displayMode}>
            <SegmentedControl
              value={teamMetaMode}
              options={[
                { value: 'HIDDEN', label: liveText.hidden },
                { value: 'RECORD', label: liveText.record },
                { value: 'SEED', label: liveText.seed },
                { value: 'CUSTOM', label: liveText.custom }
              ]}
              onChange={value => updateHud({ teamMetaMode: value })}
            />
          </Field>
          {renderTeamMetaFields()}
          {teamMetaMode !== 'HIDDEN' && (
            <button type="button" className={styles.livePackageClearButton} onClick={clearTeamStatusFields}>
              {liveText.clearStatus}
            </button>
          )}
        </div>
      </Panel>
    </div>
  )
}


function LiveHudEditor({ project, copy, text, language, activeSection = 'match', onUpdateProject, onAutoTakeScene }) {
  const hud = project.currentMatch.hud || {}
  const [resetArmed, setResetArmed] = useState(false)
  const [teamInfoUnlocked, setTeamInfoUnlocked] = useState(false)
  const editorTab = activeSection === 'package' ? 'package' : 'match'
  const liveText = getLiveEditorCopy(language)
  const currentMapIndex = Math.max(0, (Number(project.currentMatch.currentMapIndex) || 1) - 1)
  const currentMap = OW_MAP_BY_ID[project.currentMatch.currentMapId]
  const showAttackDefense = needsAttackDefense(currentMap?.mode)
  const attackSide = project.currentMatch.mapLineup?.[currentMapIndex]?.attackSide || ''
  const activeComms = hud.activeComms || ''

  const updateLiveProject = (updater, options = {}) => {
    onUpdateProject(updater, {
      live: true,
      ...options
    })
  }

  const updateHud = (patch, options = {}) => {
    onUpdateProject(draft => {
      draft.currentMatch.hud = {
        ...(draft.currentMatch.hud || {}),
        ...patch
      }
    }, options)
  }

  const updateLiveHud = patch => updateHud(patch, { live: true })

  const setMapWinner = side => {
    updateLiveProject(draft => {
      const currentEntry = getMapLineupEntry(draft.currentMatch, currentMapIndex)

      updateMapLineupEntry(draft, currentMapIndex, {
        winner: side,
        winnerSide: side,
        bansA: normalizeBanList(draft.currentMatch.bansA),
        bansB: normalizeBanList(draft.currentMatch.bansB),
        banOrderMode: draft.currentMatch.banOrderMode || 'A_FIRST',
        attackSide: currentEntry.attackSide || attackSide
      })

      const lineup = ensureMapLineup(draft)
      draft.currentMatch.score.teamA = lineup.filter(map => (map.winnerSide || map.winner) === 'A').length
      draft.currentMatch.score.teamB = lineup.filter(map => (map.winnerSide || map.winner) === 'B').length
      draft.currentMatch.bansA = []
      draft.currentMatch.bansB = []
      draft.currentMatch.banOrderMode = 'A_FIRST'
      draft.currentMatch.hud = {
        ...(draft.currentMatch.hud || {}),
        showBans: false,
        showBanPhase: false,
        heroBanTriggerAt: 0,
        autoBeginTriggerAt: 0
      }
      draft.currentMatch.result = {
        ...(draft.currentMatch.result || {}),
        winnerTeamId: side === 'B' ? draft.currentMatch.teamBId : draft.currentMatch.teamAId
      }
    })
    onAutoTakeScene?.('result')
  }

  const setAttackSide = side => {
    updateLiveProject(draft => {
      draft.currentMatch.side.teamA = side === 'A' ? 'attack' : side === 'B' ? 'defense' : 'none'
      draft.currentMatch.side.teamB = side === 'B' ? 'attack' : side === 'A' ? 'defense' : 'none'
      updateMapLineupEntry(draft, currentMapIndex, { attackSide: side })
    })
  }

  const triggerLineup = (side, mode = 'LIST') => {
    const nextSide = side === 'B' ? 'B' : 'A'
    const nextMode = mode === 'CALLOUT' ? 'CALLOUT' : 'LIST'

    updateLiveProject(draft => {
      const settings = ensureSceneSettings(draft, 'starting-five')
      const previousSide = String(settings.startingLineupSide || '').toUpperCase()
      const previousMode = String(settings.startingLineupMode || '').toUpperCase()
      const previousIndex = Number(settings.startingLineupCalloutIndex)
      const nextCalloutIndex = nextMode === 'CALLOUT'
        ? (previousSide === nextSide && previousMode === 'CALLOUT' ? ((Number.isFinite(previousIndex) ? previousIndex : -1) + 1) % 5 : 0)
        : -1

      settings.startingLineupSide = nextSide
      settings.startingLineupMode = nextMode
      settings.startingLineupCalloutIndex = nextCalloutIndex
      settings.startingLineupTriggerAt = Date.now()
    })
    onAutoTakeScene?.('starting-five')
  }

  const resetScoresAndMapResults = () => {
    if (!resetArmed) {
      setResetArmed(true)
      window.setTimeout(() => setResetArmed(false), 2600)
      return
    }

    updateLiveProject(draft => {
      ensureMapLineup(draft).forEach(map => {
        map.winner = ''
        map.winnerSide = ''
        map.bansA = []
        map.bansB = []
        map.banOrderMode = 'A_FIRST'
      })
      draft.currentMatch.score.teamA = 0
      draft.currentMatch.score.teamB = 0
      draft.currentMatch.bansA = []
      draft.currentMatch.bansB = []
      draft.currentMatch.banOrderMode = 'A_FIRST'
      draft.currentMatch.currentMapIndex = 1
      draft.currentMatch.currentRoundLabel = 'MAP 1'
      draft.currentMatch.hud = {
        ...(draft.currentMatch.hud || {}),
        showBanPhase: false,
        heroBanTriggerAt: 0,
        autoBeginTriggerAt: 0,
        keyPlayerTriggerAt: 0,
        subIndexA: -1,
        subIndexB: -1
      }
    })
    setResetArmed(false)
  }

  const toggleBanMode = () => {
    updateLiveProject(draft => {
      const hudState = draft.currentMatch.hud || {}
      const nextShowBans = !hudState.showBans

      draft.currentMatch.hud = {
        ...hudState,
        showBans: nextShowBans,
        showBanPhase: nextShowBans ? Boolean(hudState.showBanPhase) : false
      }
    })
  }

  const toggleBanPhase = () => {
    updateLiveProject(draft => {
      const hudState = draft.currentMatch.hud || {}
      const isClosingBanPhase = Boolean(hudState.showBanPhase)
      const now = Date.now()

      draft.currentMatch.hud = {
        ...hudState,
        showBans: true,
        showBanPhase: !isClosingBanPhase,
        heroBanTriggerAt: isClosingBanPhase ? hudState.heroBanTriggerAt || 0 : now,
        autoBeginTriggerAt: isClosingBanPhase && hudState.beginInfoEnabled
          ? now
          : hudState.autoBeginTriggerAt || 0
      }
    })
  }

  return (
    <div className={styles.liveDesk}>
      {editorTab === 'package' ? (
        <LiveHudPackagePanel project={project} hud={hud} liveText={liveText} updateHud={updateHud} />
      ) : (
        <>
      <div className={styles.liveMainGrid}>
        <LiveTeamControlPanel
          side="A"
          project={project}
          copy={copy}
          text={text}
          liveText={liveText}
          language={language}
          showSideControl={showAttackDefense}
          attackSide={attackSide}
          onSetAttackSide={setAttackSide}
          onSetMapWinner={setMapWinner}
          onTriggerLineup={triggerLineup}
          onUpdateLiveProject={updateLiveProject}
          onUpdateProject={onUpdateProject}
          teamInfoUnlocked={teamInfoUnlocked}
          onToggleTeamInfoUnlocked={() => setTeamInfoUnlocked(value => !value)}
        />

        <Panel title={liveText.liveCoreControl} className={styles.liveCorePanel}>
          <div className={styles.coreControlGroup}>
            <div className={styles.coreScoreBox}>
              <span>{copy.teamA}</span>
              <strong>{project.currentMatch.score.teamA}</strong>
              <em>:</em>
              <strong>{project.currentMatch.score.teamB}</strong>
              <span>{copy.teamB}</span>
            </div>

            <div className={styles.coreScoreControls}>
              <button
                type="button"
                onClick={() => updateLiveProject(draft => {
                  draft.currentMatch.score.teamA = Math.max(0, draft.currentMatch.score.teamA - 1)
                })}
              >
                -1
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => updateLiveProject(draft => {
                  draft.currentMatch.score.teamA += 1
                })}
              >
                +1
              </button>
              <button
                type="button"
                className={resetArmed ? styles.dangerActive : styles.dangerButton}
                title={liveText.resetScoreLabel}
                aria-label={liveText.resetScoreLabel}
                onClick={resetScoresAndMapResults}
              >
                {resetArmed ? liveText.resetConfirm : liveText.resetScore}
              </button>
              <button
                type="button"
                onClick={() => updateLiveProject(draft => {
                  draft.currentMatch.score.teamB = Math.max(0, draft.currentMatch.score.teamB - 1)
                })}
              >
                -1
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => updateLiveProject(draft => {
                  draft.currentMatch.score.teamB += 1
                })}
              >
                +1
              </button>
            </div>
          </div>

          <div className={styles.coreControlGroup}>
            <div className={styles.sectionTitle}>{liveText.voiceComms}</div>
            <SegmentedControl
              value={activeComms}
              options={[
                { value: 'A', label: liveText.teamA },
                { value: '', label: text.off },
                { value: 'B', label: liveText.teamB }
              ]}
              onChange={value => updateLiveHud({ activeComms: value })}
            />
          </div>

          <div className={styles.coreControlGroup}>
            <div className={styles.liveTriggerGrid}>
              <button
                type="button"
                className={hud.beginInfoEnabled ? styles.activeOutline : ''}
                onClick={() => updateLiveHud({ beginInfoEnabled: !hud.beginInfoEnabled })}
              >
                {liveText.autoBegin}
              </button>
              <button
                type="button"
                className={hud.showPlayers !== false ? styles.activeOutline : ''}
                onClick={() => updateLiveHud({ showPlayers: hud.showPlayers === false })}
              >
                {liveText.nameInfo}
              </button>
            </div>
          </div>

          <div className={styles.coreControlGroup}>
            <div className={styles.liveTriggerGrid}>
              <button
                type="button"
                className={hud.showBans ? styles.dangerActive : ''}
                onClick={toggleBanMode}
              >
                {liveText.banMode}
              </button>
              <button
                type="button"
                className={hud.showBanPhase ? styles.dangerActive : styles.dangerButton}
                onClick={toggleBanPhase}
              >
                {hud.showBanPhase ? liveText.closeBan : liveText.banPhase}
              </button>
            </div>
          </div>
        </Panel>

        <LiveTeamControlPanel
          side="B"
          project={project}
          copy={copy}
          text={text}
          liveText={liveText}
          language={language}
          showSideControl={showAttackDefense}
          attackSide={attackSide}
          onSetAttackSide={setAttackSide}
          onSetMapWinner={setMapWinner}
          onTriggerLineup={triggerLineup}
          onUpdateLiveProject={updateLiveProject}
          onUpdateProject={onUpdateProject}
          teamInfoUnlocked={teamInfoUnlocked}
          onToggleTeamInfoUnlocked={() => setTeamInfoUnlocked(value => !value)}
        />
      </div>

      <div className={styles.liveUtilityGrid}>
        <Panel title={liveText.tickerControl} className={`${styles.liveToolsPanel} ${styles.liveTickerPanel}`}>
          <div className={styles.liveTickerGrid}>
            <Field label={text.tickerMode}>
              <SegmentedControl
                value={hud.tickerMode || 'ONCE'}
                options={[
                  { value: 'ONCE', label: text.once },
                  { value: 'INFINITE', label: text.loop }
                ]}
                onChange={value => updateLiveHud({ tickerMode: value })}
              />
            </Field>

            <button
              type="button"
              className={hud.showTicker ? styles.dangerActive : styles.tickerToggleButton}
              onClick={() => updateLiveHud({ showTicker: !hud.showTicker })}
            >
              {hud.showTicker ? liveText.tickerOff : liveText.tickerOn}
            </button>

            <Field label={text.tickerText}>
              <input
                value={hud.tickerText || ''}
                onChange={event => updateLiveHud({ tickerText: event.target.value })}
                placeholder={liveText.tickerPlaceholder}
              />
            </Field>
          </div>
        </Panel>
      </div>
        </>
      )}
    </div>
  )
}


export default LiveHudEditor
