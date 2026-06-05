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
import { getHeroLabel, getPlayerRoleLabel } from '../shared/editorHelpers'
import { formatDurationMinutes } from './statsCaptureUtils'

const TEAM_OPTIONS = ['A', 'B']
const MVP_TYPE_OPTIONS = ['map', 'match']
const STAT_VIEW_OPTIONS = ['per10', 'total']

const HERO_ROLE_ORDER = ['tank', 'damage', 'support']
const ALL_HERO_OPTIONS = HERO_ROLE_ORDER.flatMap(role => OW_HEROES_BY_ROLE[role] || [])

const getPlayersForSide = (project, team, side, playerIds) => {
  const starting = getStartingPlayers(project, side === 'B' ? 'teamB' : 'teamA')
  const roster = getTeamPlayers(project, team?.id)
  const fallback = (starting.length ? starting : roster).slice(0, 5)
  const sideKey = side === 'B' ? 'teamB' : 'teamA'
  const ids = playerIds?.[sideKey] || []

  return Array.from({ length: 5 }, (_, index) => getPlayerById(project, ids[index]) || fallback[index])
}

const getTeamForSide = (teamA, teamB, side) => (side === 'B' ? teamB : teamA)

const getRowsForSide = (rows, side) => (side === 'B' ? rows.teamB : rows.teamA)

const clampSlot = value => Math.max(0, Math.min(4, Number(value) || 0))

const getRoleLabel = (player, language) => getPlayerRoleLabel(player, language)

const getRosterHeroId = player => (Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : '') || ''

const getHeroOption = heroId => ALL_HERO_OPTIONS.find(hero => hero.id === heroId)

const getDisplayValue = (row, stat, minutes, statView) => (
  statView === 'per10' ? formatPer10(row?.[stat.rowKey], minutes) : formatStatNumber(row?.[stat.rowKey])
)

function MvpEditor({ project, language = 'en', onUpdateProject }) {
  const pageText = getPageEditorCopy(language)
  const settings = project.scenes?.settings?.mvp || {}
  const statsSettings = project.scenes?.settings?.stats || {}
  const statsData = resolveStatsData(statsSettings, 'overall')
  const rows = normalizeStatsRows(statsData.rows)
  const { teamA, teamB } = getCurrentTeams(project)
  const teamSide = settings.teamSide || 'A'
  const team = getTeamForSide(teamA, teamB, teamSide)
  const players = getPlayersForSide(project, team, teamSide, statsData.playerIds)
  const playerSlot = clampSlot(settings.playerSlot)
  const player = players[playerSlot]
  const row = getRowsForSide(rows, teamSide)[playerSlot] || {}
  const statView = settings.statView || 'per10'
  const statKeys = Array.isArray(settings.statKeys) && settings.statKeys.length
    ? settings.statKeys
    : ['eliminations', 'damage', 'healing']
  const selectedHero = getHeroOption(settings.heroOverride || getRosterHeroId(player))
  const selectedHeroLabel = selectedHero ? getHeroLabel(selectedHero, language) : ''
  const teamOptions = TEAM_OPTIONS.map(value => ({ value, label: value === 'B' ? pageText.teamB : pageText.teamA }))
  const mvpTypeOptions = MVP_TYPE_OPTIONS.map(value => ({ value, label: value === 'match' ? pageText.matchMvp : pageText.mapMvp }))
  const statViewOptions = STAT_VIEW_OPTIONS.map(value => ({ value, label: value === 'total' ? pageText.totals : pageText.per10 }))

  const updateMvpSettings = patch => {
    onUpdateProject(draft => {
      if (!draft.scenes.settings.mvp) draft.scenes.settings.mvp = {}
      Object.assign(draft.scenes.settings.mvp, patch)
    })
  }

  const updateStatKey = (index, value) => {
    const next = [...statKeys]
    next[index] = value
    updateMvpSettings({ statKeys: next })
  }

  return (
    <div className={styles.mvpWorkbench}>
      <Panel title={pageText.mvpControl} className={styles.mvpSetupPanel}>
        <div className={styles.mvpSetupGrid}>
          <div className={styles.statsControlBlock}>
            <span>{pageText.mvpType}</span>
            <SegmentedControl
              value={settings.mvpType || 'map'}
              options={mvpTypeOptions}
              onChange={value => updateMvpSettings({ mvpType: value })}
            />
          </div>

          <div className={styles.statsControlBlock}>
            <span>{pageText.valueMode}</span>
            <SegmentedControl
              value={statView}
              options={statViewOptions}
              onChange={value => updateMvpSettings({ statView: value })}
            />
          </div>
        </div>

        <details className={styles.mvpSubmenu}>
          <summary>{pageText.packageCopy}</summary>

          <div className={styles.mvpSubmenuBody}>
            <Field label={pageText.title}>
              <input
                value={settings.title || ''}
                placeholder={settings.mvpType === 'match' ? 'MATCH MVP' : 'MAP MVP'}
                onChange={event => updateMvpSettings({ title: event.target.value })}
              />
            </Field>

            <Field label={pageText.mvpNote}>
              <input
                value={settings.note || ''}
                placeholder="CLUTCH PERFORMANCE"
                onChange={event => updateMvpSettings({ note: event.target.value })}
              />
            </Field>
          </div>
        </details>

        <div className={styles.mvpStatusStrip}>
          <div>
            <span>{pageText.source}</span>
            <strong>{pageText.statsDataLabel(statsData)}</strong>
          </div>
          <div>
            <span>{pageText.time}</span>
            <strong>{formatDurationMinutes(statsData.minutes)}m</strong>
          </div>
        </div>
      </Panel>

      <Panel title={pageText.playerBuilder} className={styles.mvpSelectPanel}>
        <div className={styles.mvpSelectedCard}>
          <span>{settings.mvpType === 'match' ? pageText.matchMvp : pageText.mapMvp}</span>
          <strong>{player?.name || `${pageText.player} ${playerSlot + 1}`}</strong>
          <em>{team?.shortName || teamSide} // {getRoleLabel(player, language)} // {selectedHeroLabel || pageText.rosterHero}</em>
        </div>

        <div className={styles.statsControlBlock}>
          <span>{pageText.teamScope}</span>
          <SegmentedControl
            value={teamSide}
            options={teamOptions}
            onChange={value => updateMvpSettings({ teamSide: value, playerSlot: 0, heroOverride: '' })}
          />
        </div>

        <div className={styles.mvpSlotGrid}>
          {Array.from({ length: 5 }, (_, index) => {
            const slotPlayer = players[index]
            const isActive = index === playerSlot

            return (
              <button
                type="button"
                className={`${styles.mvpSlotCard} ${isActive ? styles.mvpSlotActive : ''}`}
                key={`mvp-player-${teamSide}-${index}`}
                onClick={() => updateMvpSettings({ playerSlot: index, heroOverride: '' })}
              >
                <span>P{index + 1}</span>
                <strong>{slotPlayer?.name || `${pageText.player} ${index + 1}`}</strong>
                <em>{getRoleLabel(slotPlayer, language)}</em>
              </button>
            )
          })}
        </div>

        <div className={styles.teamDataHeroOverride}>
          <Field label={pageText.hero}>
            <select value={settings.heroOverride || ''} onChange={event => updateMvpSettings({ heroOverride: event.target.value })}>
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
            disabled={!settings.heroOverride}
            onClick={() => updateMvpSettings({ heroOverride: '' })}
          >
            {pageText.default}
          </button>
        </div>
      </Panel>

      <Panel title={pageText.awardStats} className={styles.mvpStatsPanel}>
        <div className={styles.mvpFeatureGrid}>
          {Array.from({ length: 3 }, (_, index) => {
            const statKey = statKeys[index] || CORE_STATS[index]?.key
            const stat = CORE_STATS.find(item => item.key === statKey) || CORE_STATS[index]

            return (
              <div className={styles.mvpFeatureCard} key={`mvp-stat-${index}`}>
                <div className={styles.mvpFeatureTop}>
                  <span>0{index + 1}</span>
                  <select value={stat.key} onChange={event => updateStatKey(index, event.target.value)}>
                    {CORE_STATS.map(option => (
                      <option key={option.key} value={option.key}>{pageText.statLabel(option)}</option>
                    ))}
                  </select>
                </div>
                <strong>{getDisplayValue(row, stat, statsData.minutes, statView)}</strong>
              </div>
            )
          })}
        </div>

        <div className={styles.mvpAllStats}>
          {CORE_STATS.map(stat => (
            <span key={`mvp-all-${stat.key}`}>
              <em>{stat.shortLabel}</em>
              <strong>{getDisplayValue(row, stat, statsData.minutes, statView)}</strong>
            </span>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export default MvpEditor
