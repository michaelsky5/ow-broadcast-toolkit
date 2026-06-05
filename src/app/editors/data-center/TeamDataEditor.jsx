import { OW_HEROES_BY_ROLE } from '../../../data/overwatch'
import { getCurrentTeams, getPlayerById, getStartingPlayers, getTeamPlayers } from '../../../project/projectUtils'
import {
  CORE_STATS,
  formatPer10,
  formatStatNumber,
  normalizeStatsRows,
  resolveStatsData
} from '../../../project/statsModel'
import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel, SegmentedControl } from '../shared/editorControls'
import { getPageEditorCopy } from '../shared/editorCopy'
import { ensureSceneSettings, getHeroLabel, getPlayerRoleLabel } from '../shared/editorHelpers'
import { formatDurationMinutes } from './statsCaptureUtils'

const TEAM_OPTIONS = ['A', 'B']
const STAT_VIEW_OPTIONS = ['per10', 'total']
const DISPLAY_MODE_OPTIONS = ['spotlight', 'matchup']
const CARD_TAG_OPTIONS = ['STAR PLAYER', 'FOCUS PLAYER', 'KEY PLAYER']

const HERO_ROLE_ORDER = ['tank', 'damage', 'support']
const ALL_HERO_OPTIONS = HERO_ROLE_ORDER.flatMap(role => OW_HEROES_BY_ROLE[role] || [])

const getPlayersForSide = (project, team, teamSide, playerIds) => {
  const starting = getStartingPlayers(project, teamSide === 'B' ? 'teamB' : 'teamA')
  const roster = getTeamPlayers(project, team?.id)
  const fallback = (starting.length ? starting : roster).slice(0, 5)
  const sideKey = teamSide === 'B' ? 'teamB' : 'teamA'
  const ids = playerIds?.[sideKey] || []

  return Array.from({ length: 5 }, (_, index) => getPlayerById(project, ids[index]) || fallback[index])
}

const getRowsForSide = (rows, teamSide) => (teamSide === 'B' ? rows.teamB : rows.teamA)

const getTeamForSide = (teamA, teamB, teamSide) => (teamSide === 'B' ? teamB : teamA)

const getDisplayValue = (row, stat, minutes, statView) => (
  statView === 'per10' ? formatPer10(row?.[stat.rowKey], minutes) : formatStatNumber(row?.[stat.rowKey])
)

const getRoleLabel = (player, language) => getPlayerRoleLabel(player, language)

const clampSlot = value => Math.max(0, Math.min(4, Number(value) || 0))

const getRosterHeroId = player => (Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : '') || ''

const getHeroOption = heroId => ALL_HERO_OPTIONS.find(hero => hero.id === heroId)

const getHeroOverrides = settings => ({
  A: { ...(settings.heroOverrides?.A || {}) },
  B: { ...(settings.heroOverrides?.B || {}) }
})

const getHeroOverride = (settings, teamSide, playerSlot) => (
  settings.heroOverrides?.[teamSide]?.[playerSlot] || ''
)

const normalizeDisplayMode = value => {
  const mode = value === 'starboard' ? 'matchup' : value
  return ['spotlight', 'matchup'].includes(mode) ? mode : 'spotlight'
}

const normalizeTeamSide = value => (value === 'B' ? 'B' : 'A')

const normalizeStatView = value => (value === 'total' ? 'total' : 'per10')

const normalizeCardTag = value => (value === 'MVP PLAYER' ? 'STAR PLAYER' : value || 'STAR PLAYER')

const normalizeTeamDataSettings = settings => {
  const teamSide = normalizeTeamSide(settings?.teamSide)

  return {
    displayMode: normalizeDisplayMode(settings?.displayMode),
    statView: normalizeStatView(settings?.statView),
    teamSide,
    playerSlot: clampSlot(settings?.playerSlot),
    compareTeamSide: settings?.compareTeamSide === 'A' || settings?.compareTeamSide === 'B'
      ? settings.compareTeamSide
      : teamSide === 'A' ? 'B' : 'A',
    compareSlot: clampSlot(settings?.compareSlot),
    cardTag: normalizeCardTag(settings?.cardTag),
    heroOverrides: getHeroOverrides(settings || {})
  }
}

const getDisplayModeLabel = (mode, pageText) => (mode === 'matchup' ? pageText.matchup : pageText.spotlight)

const getActiveHero = (settings, teamSide, playerSlot, player, language, fallbackLabel) => {
  const override = getHeroOverride(settings, teamSide, playerSlot)
  const rosterHero = getRosterHeroId(player)
  const hero = getHeroOption(override || rosterHero)

  return {
    id: override || rosterHero,
    override,
    label: hero ? getHeroLabel(hero, language) : fallbackLabel
  }
}

function TeamDataEditor({ project, language = 'en', onUpdateProject }) {
  const pageText = getPageEditorCopy(language)
  const settings = normalizeTeamDataSettings(project.scenes?.settings?.teamData)
  const statsSettings = project.scenes?.settings?.stats || {}
  const statsData = resolveStatsData(statsSettings, 'overall')
  const rows = normalizeStatsRows(statsData.rows)
  const { teamA, teamB } = getCurrentTeams(project)
  const displayMode = normalizeDisplayMode(settings.displayMode)
  const teamSide = normalizeTeamSide(settings.teamSide)
  const compareTeamSide = settings.compareTeamSide || (teamSide === 'A' ? 'B' : 'A')
  const playerSlot = clampSlot(settings.playerSlot)
  const compareSlot = clampSlot(settings.compareSlot)
  const activeTeam = getTeamForSide(teamA, teamB, teamSide)
  const compareTeam = getTeamForSide(teamA, teamB, compareTeamSide)
  const activeRows = getRowsForSide(rows, teamSide)
  const compareRows = getRowsForSide(rows, compareTeamSide)
  const activePlayers = getPlayersForSide(project, activeTeam, teamSide, statsData.playerIds)
  const comparePlayers = getPlayersForSide(project, compareTeam, compareTeamSide, statsData.playerIds)
  const activePlayer = activePlayers[playerSlot]
  const comparePlayer = comparePlayers[compareSlot]
  const activeRow = activeRows[playerSlot] || {}
  const filledRows = activeRows.filter(row => Object.values(row).some(Boolean)).length
  const compareFilledRows = compareRows.filter(row => Object.values(row).some(Boolean)).length
  const minutes = statsData.minutes
  const statView = normalizeStatView(settings.statView)
  const cardTag = normalizeCardTag(settings.cardTag)
  const activeHero = getActiveHero(settings, teamSide, playerSlot, activePlayer, language, pageText.rosterHero)
  const compareHero = getActiveHero(settings, compareTeamSide, compareSlot, comparePlayer, language, pageText.rosterHero)
  const teamOptions = TEAM_OPTIONS.map(value => ({ value, label: value === 'B' ? pageText.teamB : pageText.teamA }))
  const statViewOptions = STAT_VIEW_OPTIONS.map(value => ({ value, label: value === 'total' ? pageText.totals : pageText.per10 }))
  const displayModeOptions = DISPLAY_MODE_OPTIONS.map(value => ({ value, label: value === 'matchup' ? pageText.matchup : pageText.spotlight }))
  const cardTagOptions = CARD_TAG_OPTIONS.map(value => ({
    value,
    label: value === 'FOCUS PLAYER' ? pageText.focus : value === 'KEY PLAYER' ? pageText.key : pageText.star
  }))
  const cardTagLabel = cardTagOptions.find(option => option.value === cardTag)?.label || cardTag
  const getTeamSideLabel = value => (value === 'B' ? pageText.teamB : pageText.teamA)

  const updateTeamDataSettings = patch => {
    const nextSettings = normalizeTeamDataSettings({ ...settings, ...patch })

    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'teamData'), nextSettings)
    })
  }

  const updateHeroOverride = (teamKey, slot, value) => {
    const nextOverrides = getHeroOverrides(settings)

    if (value) nextOverrides[teamKey][slot] = value
    else delete nextOverrides[teamKey][slot]

    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'teamData'), normalizeTeamDataSettings({
        ...settings,
        heroOverrides: nextOverrides
      }))
    })
  }

  const swapPlayers = () => {
    updateTeamDataSettings({
      teamSide: compareTeamSide,
      playerSlot: compareSlot,
      compareTeamSide: teamSide,
      compareSlot: playerSlot
    })
  }

  const renderHeroOverride = (teamKey, slot, player, hero) => {
    const selectedHero = getHeroOption(hero.override || getRosterHeroId(player))
    const selectedHeroLabel = selectedHero ? getHeroLabel(selectedHero, language) : ''

    return (
      <div className={styles.teamDataHeroOverride}>
        <Field label={pageText.hero}>
          <select value={hero.override} onChange={event => updateHeroOverride(teamKey, slot, event.target.value)}>
            <option value="">{pageText.rosterDefault}{selectedHeroLabel ? ` / ${selectedHeroLabel}` : ''}</option>
            {HERO_ROLE_ORDER.map(role => (
              <optgroup key={role} label={role.toUpperCase()}>
                {(OW_HEROES_BY_ROLE[role] || []).map(option => (
                  <option key={option.id} value={option.id}>{getHeroLabel(option, language)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!hero.override}
          onClick={() => updateHeroOverride(teamKey, slot, '')}
        >
          {pageText.default}
        </button>
      </div>
    )
  }

  const renderSlotGrid = (teamKey, selectedSlot, settingKey, variant = 'default') => {
    const team = getTeamForSide(teamA, teamB, teamKey)
    const players = getPlayersForSide(project, team, teamKey, statsData.playerIds)

    return (
      <div className={`${styles.teamDataCompactSlots} ${variant === 'matchup' ? styles.teamDataMatchupSlotGrid : ''}`}>
        {Array.from({ length: 5 }, (_, index) => {
          const player = players[index]
          const isActive = index === selectedSlot

          return (
            <button
              type="button"
              className={`${styles.teamDataSlotCard} ${isActive ? styles.teamDataSlotActive : ''}`}
              key={`${teamKey}-slot-${index}`}
              onClick={() => updateTeamDataSettings({ [settingKey]: index })}
            >
              <span>P{index + 1}</span>
              <strong>{player?.name || `${pageText.player} ${index + 1}`}</strong>
              <em>{getRoleLabel(player, language)}</em>
            </button>
          )
        })}
      </div>
    )
  }

  const renderOutputRoster = ({ title, teamKey, players, sideRows, selectedSlot }) => (
    <div className={styles.teamDataOutputRoster}>
      <div className={styles.teamDataOutputRosterTitle}>
        <span>{title}</span>
        <strong>{pageText.rowCount(sideRows.filter(row => Object.values(row).some(Boolean)).length)}</strong>
      </div>

      <div className={styles.teamDataOutputHeader}>
        <span>P</span>
        <span>{pageText.player}</span>
        {CORE_STATS.map(stat => (
          <span key={`output-header-${teamKey}-${stat.key}`}>{stat.shortLabel}</span>
        ))}
      </div>

      <div className={styles.teamDataOutputRows}>
        {Array.from({ length: 5 }, (_, index) => {
          const player = players[index]
          const row = sideRows[index] || {}
          const isActive = index === selectedSlot

          return (
            <div
              className={`${styles.teamDataOutputRow} ${isActive ? styles.teamDataOutputRowActive : ''}`}
              key={`output-roster-${teamKey}-${index}`}
            >
              <strong>P{index + 1}</strong>
              <span>{player?.name || `${pageText.player} ${index + 1}`}</span>
              {CORE_STATS.map(stat => (
                <b key={`output-row-${teamKey}-${index}-${stat.key}`}>
                  {getDisplayValue(row, stat, minutes, statView)}
                </b>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderMatchupSide = ({ title, teamKey, slot, player, team, hero, settingKey, teamSettingKey }) => (
    <section className={styles.teamDataMatchupSide}>
      <div className={styles.teamDataMatchupHeader}>
        <div className={styles.teamDataActivePlayer}>
          <span>{title}</span>
          <strong>{player?.name || `${pageText.player} ${slot + 1}`}</strong>
          <em>{team?.shortName || teamKey} // {getRoleLabel(player, language)} // {hero.label}</em>
        </div>

        <SegmentedControl
          value={teamKey}
          options={teamOptions}
          onChange={value => updateTeamDataSettings({ [teamSettingKey]: value })}
        />
      </div>

      {renderSlotGrid(teamKey, slot, settingKey, 'matchup')}
      {renderHeroOverride(teamKey, slot, player, hero)}
    </section>
  )

  return (
    <div className={styles.teamDataDeskStack}>
      <div className={styles.statsOutputModeBar}>
        {displayModeOptions.map(option => {
          const isActive = displayMode === option.value

          return (
            <button
              type="button"
              className={[
                styles.showPackageModeButton,
                isActive ? styles.showPackageModeActive : ''
              ].filter(Boolean).join(' ')}
              key={option.value}
              onClick={() => updateTeamDataSettings({ displayMode: option.value })}
            >
              <span>{option.label}</span>
              <em>{option.value === 'matchup' ? pageText.matchupBuilder : pageText.playerBuilder}</em>
            </button>
          )
        })}
      </div>

      <div className={styles.teamDataWorkbench}>
        <Panel title={pageText.graphicControl} className={styles.teamDataSetupPanel}>
          <div className={styles.teamDataControlStack}>
            <div className={styles.statsControlBlock}>
              <span>{pageText.valueMode}</span>
              <SegmentedControl
                value={statView}
                options={statViewOptions}
                onChange={value => updateTeamDataSettings({ statView: value })}
              />
            </div>

            {displayMode === 'spotlight' && (
              <>
                <div className={styles.statsControlBlock}>
                  <span>{pageText.teamScope}</span>
                  <SegmentedControl
                    value={teamSide}
                    options={teamOptions}
                    onChange={value => updateTeamDataSettings({ teamSide: value })}
                  />
                </div>

                <div className={`${styles.statsControlBlock} ${styles.teamDataCardTagControl}`}>
                  <span>{pageText.cardTag}</span>
                  <SegmentedControl
                    value={cardTag}
                    options={cardTagOptions}
                    onChange={value => updateTeamDataSettings({ cardTag: value })}
                  />
                </div>
              </>
            )}
          </div>

          <div className={styles.teamDataStatusStrip}>
            <div>
              <span>{pageText.package}</span>
              <strong>{getDisplayModeLabel(displayMode, pageText)}</strong>
            </div>
            <div>
              <span>{pageText.rows}</span>
              <strong>{displayMode === 'matchup' ? pageText.rowComparison(filledRows, compareFilledRows) : pageText.rowCount(filledRows)}</strong>
            </div>
            <div>
              <span>{pageText.time}</span>
              <strong>{formatDurationMinutes(minutes)}m</strong>
            </div>
            <div>
              <span>{pageText.source}</span>
              <strong>{pageText.statsDataLabel(statsData)}</strong>
            </div>
          </div>
        </Panel>

        <Panel title={displayMode === 'matchup' ? pageText.matchupBuilder : pageText.playerBuilder} className={styles.teamDataPickerPanel}>
          {displayMode === 'spotlight' ? (
            <>
              <div className={styles.teamDataActivePlayer}>
                <span>{cardTagLabel}</span>
                <strong>{activePlayer?.name || `${pageText.player} ${playerSlot + 1}`}</strong>
                <em>{activeTeam?.shortName || teamSide} // {getRoleLabel(activePlayer, language)} // {activeHero.label}</em>
              </div>

              {renderHeroOverride(teamSide, playerSlot, activePlayer, activeHero)}

              <div className={styles.teamDataSlotGrid}>
                {renderSlotGrid(teamSide, playerSlot, 'playerSlot')}
              </div>
            </>
          ) : (
            <div className={styles.teamDataMatchupBuilder}>
              {renderMatchupSide({
                title: pageText.leftPlayer,
                teamKey: teamSide,
                slot: playerSlot,
                player: activePlayer,
                team: activeTeam,
                hero: activeHero,
                settingKey: 'playerSlot',
                teamSettingKey: 'teamSide'
              })}

              <div className={styles.teamDataMatchupActions}>
                <button type="button" className={styles.secondaryButton} onClick={swapPlayers}>
                  {pageText.swapPlayers}
                </button>
              </div>

              {renderMatchupSide({
                title: pageText.rightPlayer,
                teamKey: compareTeamSide,
                slot: compareSlot,
                player: comparePlayer,
                team: compareTeam,
                hero: compareHero,
                settingKey: 'compareSlot',
                teamSettingKey: 'compareTeamSide'
              })}
            </div>
          )}
        </Panel>

        <Panel title={pageText.graphicOutput} className={styles.statsMetricsPanel}>
          {displayMode === 'matchup' ? (
            <div className={styles.teamDataMatchupPreview}>
              <div className={styles.teamDataOutputRosterGrid}>
                {renderOutputRoster({
                  title: activeTeam?.shortName || getTeamSideLabel(teamSide),
                  teamKey: teamSide,
                  players: activePlayers,
                  sideRows: activeRows,
                  selectedSlot: playerSlot
                })}
                {renderOutputRoster({
                  title: compareTeam?.shortName || getTeamSideLabel(compareTeamSide),
                  teamKey: compareTeamSide,
                  players: comparePlayers,
                  sideRows: compareRows,
                  selectedSlot: compareSlot
                })}
              </div>
            </div>
          ) : (
            <div className={styles.teamDataOutputStack}>
              <div className={styles.teamDataPlayerPreview}>
                <div>
                  <span>{cardTagLabel}</span>
                  <strong>{activePlayer?.name || `${pageText.player} ${playerSlot + 1}`}</strong>
                  <em>{activeTeam?.shortName || teamSide} // {getRoleLabel(activePlayer, language)} // {activeHero.label}</em>
                </div>
                <div>
                  {CORE_STATS.map(stat => (
                    <span key={`active-player-${stat.key}`}>
                      <em>{stat.shortLabel}</em>
                      <strong>{getDisplayValue(activeRow, stat, minutes, statView)}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {renderOutputRoster({
                title: `${activeTeam?.shortName || getTeamSideLabel(teamSide)} ${pageText.playerRows}`,
                teamKey: teamSide,
                players: activePlayers,
                sideRows: activeRows,
                selectedSlot: playerSlot
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default TeamDataEditor
