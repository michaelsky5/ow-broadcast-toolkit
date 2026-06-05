import { OW_HERO_BY_ID } from '../../data/overwatch'
import { getBroadcastCompetitionName } from '../../project/branding'
import { getCurrentTeams, getPlayerById, getStartingPlayers, getTeamPlayers } from '../../project/projectUtils'
import {
  CORE_STATS,
  formatDataMinutes,
  formatPer10,
  formatStatNumber,
  resolveStatsData,
  normalizeStatsRows,
  sumStatRows,
  toStatNumber
} from '../../project/statsModel'
import styles from './TeamDataScene.module.css'

const clean = value => String(value || '').trim()

const ROLE_LABEL = {
  tank: 'TANK',
  damage: 'DAMAGE',
  support: 'SUPPORT'
}

const getPlayersForSide = (project, team, side, playerIds) => {
  const starting = getStartingPlayers(project, side === 'B' ? 'teamB' : 'teamA')
  const roster = getTeamPlayers(project, team?.id)
  const fallback = (starting.length ? starting : roster).slice(0, 5)
  const sideKey = side === 'B' ? 'teamB' : 'teamA'
  const ids = playerIds?.[sideKey] || []

  return Array.from({ length: 5 }, (_, index) => getPlayerById(project, ids[index]) || fallback[index])
}

const getPlayerName = player => clean(player?.name || player?.nickname || player?.battleTag) || 'Player'

const getPlayerTag = player => clean(player?.battleTag || player?.id || player?.subtitle) || 'OW COMMUNITY'

const getRoleLabel = player => ROLE_LABEL[String(player?.role || '').toLowerCase()] || 'PLAYER'

const unique = values => [...new Set(values.map(clean).filter(Boolean))]

const getHeroSlug = value => {
  const text = clean(value)
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[_\s]+/g, '-')

  if (text === 'd-va') return 'dva'
  if (text === 'soldier-76' || text === 'soldier76') return 'soldier-76'
  if (text === 'junkerqueen') return 'junker-queen'
  if (text === 'wreckingball') return 'wrecking-ball'
  if (text === 'jetpackcat') return 'jetpack-cat'
  return text
}

const getHero = heroId => OW_HERO_BY_ID[clean(heroId)] || null

const getHeroRole = (player, hero) => {
  const role = String(hero?.role || player?.role || '').toLowerCase()
  return ROLE_LABEL[role] ? role : 'damage'
}

const getHeroAssetCandidates = (player, heroId, type = 'roster') => {
  const hero = getHero(heroId)
  const role = getHeroRole(player, hero)
  const slugCandidates = unique([
    hero?.id,
    getHeroSlug(hero?.id),
    hero?.assetKey,
    getHeroSlug(hero?.assetKey),
    getHeroSlug(hero?.en),
    getHeroSlug(heroId)
  ])

  const folder = type === 'icon' ? 'heroes' : 'roster'
  const directAsset = type === 'icon' ? hero?.icon : hero?.rosterIcon

  return unique([
    ...slugCandidates.map(slug => `/${folder}/${role}/${slug}.png`),
    directAsset
  ])
}

const getHeroIconCandidates = (player, heroId) => getHeroAssetCandidates(player, heroId, 'icon')

const getHeroOverride = (settings, side, slot) => settings?.heroOverrides?.[side]?.[slot] || ''

const getTeamDataStatsScope = settings => (settings?.statsDataScope === 'cumulative' ? 'cumulative' : 'current')

const getPlayerHeroId = (settings, side, slot, player) => (
  clean(getHeroOverride(settings, side, slot)) || (Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : '')
)

const getPlayerArtCandidates = (player, team, heroId = '') => {
  const activeHero = clean(heroId) || (Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : '')
  const rosterArt = activeHero ? getHeroAssetCandidates(player, activeHero, 'roster') : []
  const heroIcons = activeHero ? getHeroIconCandidates(player, activeHero) : []

  return unique([
    player?.playerImage,
    player?.heroImage,
    player?.rosterImage,
    player?.screenshot,
    player?.image,
    player?.photo,
    player?.avatar,
    ...rosterArt,
    ...heroIcons,
    team?.logo,
    '/OW.svg'
  ])
}

function SceneImage({ src, fallback = '/OW.svg', className = '', alt = '' }) {
  const candidates = unique(Array.isArray(src) ? [...src, fallback, '/OW.svg'] : [src, fallback, '/OW.svg'])

  return (
    <img
      alt={alt}
      className={className}
      data-source-index="0"
      src={candidates[0] || fallback}
      onError={event => {
        const currentIndex = Number(event.currentTarget.dataset.sourceIndex || 0)
        const nextSrc = candidates[currentIndex + 1]
        if (!nextSrc) return
        event.currentTarget.dataset.sourceIndex = String(currentIndex + 1)
        event.currentTarget.src = nextSrc
      }}
    />
  )
}

const getStatDisplay = (row, stat, minutes, mode) => (
  mode === 'per10' ? formatPer10(row?.[stat.rowKey], minutes) : formatStatNumber(row?.[stat.rowKey])
)

const getFilledRowCount = rows => (
  Math.max(1, (Array.isArray(rows) ? rows : [])
    .filter(row => CORE_STATS.some(stat => toStatNumber(row?.[stat.rowKey])))
    .length)
)

const getTeamAverageDisplay = (rows, stat, minutes, mode) => {
  const average = sumStatRows(rows, stat.rowKey) / getFilledRowCount(rows)
  return mode === 'per10' ? formatPer10(average, minutes) : formatStatNumber(average)
}

function SpotlightStatCard({ row, stat, minutes, mode }) {
  return (
    <div className={`${styles.spotlightStat} ${stat.reverse ? styles.spotlightStatMuted : ''}`}>
      <span>{stat.shortLabel}</span>
      <strong>{getStatDisplay(row, stat, minutes, mode)}</strong>
      <em>{stat.label}</em>
    </div>
  )
}

function TeamTotals({ rows, team, teamSide, mode, minutes }) {
  return (
    <aside className={styles.totalPanel}>
      <strong>{team?.shortName || teamSide}</strong>
      <div>
        {CORE_STATS.slice(0, 3).map(stat => (
          <span key={stat.key}>
            <em>{stat.shortLabel}</em>
            {mode === 'per10'
              ? formatPer10(sumStatRows(rows, stat.rowKey), minutes)
              : formatStatNumber(sumStatRows(rows, stat.rowKey))}
          </span>
        ))}
      </div>
    </aside>
  )
}

const clampSlot = value => Math.max(0, Math.min(4, Number(value) || 0))

const getRowsForSide = (rows, side) => (side === 'B' ? rows.teamB : rows.teamA)

const getTeamForSide = (teamA, teamB, side) => (side === 'B' ? teamB : teamA)

const getComparisonState = (leftRow, rightRow, stat) => {
  const leftRaw = toStatNumber(leftRow?.[stat.rowKey])
  const rightRaw = toStatNumber(rightRow?.[stat.rowKey])
  const max = Math.max(Math.abs(leftRaw), Math.abs(rightRaw), 1)
  const winner = leftRaw === rightRaw
    ? 'even'
    : stat.reverse
      ? leftRaw < rightRaw ? 'left' : 'right'
      : leftRaw > rightRaw ? 'left' : 'right'

  return {
    winner,
    leftPct: Math.max(5, Math.min(100, (Math.abs(leftRaw) / max) * 100)),
    rightPct: Math.max(5, Math.min(100, (Math.abs(rightRaw) / max) * 100))
  }
}

function SpotlightGraphic({ activeHeroId, activePlayer, activeRow, cardTag, eventName, minutes, mode, team, teamSide }) {
  const playerImage = getPlayerArtCandidates(activePlayer, team, activeHeroId)
  const totalLabel = mode === 'per10' ? 'PER 10 MINUTES' : 'TOTALS'
  const teamName = team?.name || `Team ${teamSide}`
  const teamShort = team?.shortName || teamSide

  return (
    <section className={styles.spotlightLayout}>
      <div className={styles.spotlightHero}>
        <SceneImage className={styles.playerPortraitImage} fallback={team?.logo || '/OW.svg'} src={playerImage} />
        <div className={styles.spotlightHeroShade} />
        <div className={styles.playerBackdropName}>
          {getPlayerName(activePlayer)}
        </div>
        <div className={styles.spotlightHeroInfo}>
          <div className={styles.spotlightTag}>{cardTag}</div>
          <h2>{getPlayerName(activePlayer)}</h2>
          <span>{getPlayerTag(activePlayer)}</span>
          <i />
        </div>
      </div>

      <div className={styles.spotlightInfo}>
        <div className={styles.playerNameBlock}>
          <p>Player Spotlight</p>
          <h1>{teamName}</h1>
          <span>{eventName} // {teamShort} // {getRoleLabel(activePlayer)}</span>
        </div>

        <div className={styles.playerMetaGrid}>
          <span>
            <em>TEAM</em>
            <strong>{teamShort}</strong>
          </span>
          <span>
            <em>ROLE</em>
            <strong>{getRoleLabel(activePlayer)}</strong>
          </span>
          <span>
            <em>TIME</em>
            <strong>{formatDataMinutes(minutes)} MIN</strong>
          </span>
          <span>
            <em>VIEW</em>
            <strong>{totalLabel}</strong>
          </span>
        </div>

        <div className={styles.spotlightStats}>
          {CORE_STATS.map(stat => (
            <SpotlightStatCard
              key={stat.key}
              minutes={minutes}
              mode={mode}
              row={activeRow}
              stat={stat}
            />
          ))}
        </div>

        <div className={styles.playerFlavor}>
          <strong>{getPlayerTag(activePlayer)}</strong>
          <span>{teamName} // {totalLabel}</span>
        </div>
      </div>
    </section>
  )
}

function MatchupStat({ leftRow, leftRows, rightRow, rightRows, stat, minutes, mode }) {
  const state = getComparisonState(leftRow, rightRow, stat)

  return (
    <article
      className={[
        styles.matchupStat,
        state.winner === 'left' ? styles.matchupLeftWin : '',
        state.winner === 'right' ? styles.matchupRightWin : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--match-left': `${state.leftPct}%`,
        '--match-right': `${state.rightPct}%`
      }}
    >
      <div className={styles.matchupValue}>
        <strong>{getStatDisplay(leftRow, stat, minutes, mode)}</strong>
        <em>TEAM AVG {getTeamAverageDisplay(leftRows, stat, minutes, mode)}</em>
      </div>
      <span>{stat.shortLabel}</span>
      <div className={`${styles.matchupValue} ${styles.matchupValueRight}`}>
        <strong>{getStatDisplay(rightRow, stat, minutes, mode)}</strong>
        <em>TEAM AVG {getTeamAverageDisplay(rightRows, stat, minutes, mode)}</em>
      </div>
      <div className={styles.matchupBars}>
        <i />
        <em />
      </div>
    </article>
  )
}

function PlayerMatchupGraphic({ left, leftRows, right, rightRows, minutes, mode }) {
  const leftImage = getPlayerArtCandidates(left.player, left.team, left.heroId)
  const rightImage = getPlayerArtCandidates(right.player, right.team, right.heroId)
  const modeLabel = mode === 'per10' ? 'PER 10 MINUTES' : 'TOTALS'
  const getPlayerEyebrow = entry => {
    const teamLabel = entry.team?.shortName || entry.side
    const battleTag = clean(entry.player?.battleTag)
    return battleTag ? `${teamLabel} // ${battleTag}` : teamLabel
  }

  return (
    <section className={styles.matchupLayout}>
      <div className={styles.matchupPoster}>
        <article className={`${styles.matchupPlayer} ${styles.matchupPlayerLeft}`}>
          <SceneImage fallback={left.team?.logo || '/OW.svg'} src={leftImage} />
          <div className={styles.matchupPlayerShade} />
          <div>
            <span>{getPlayerEyebrow(left)}</span>
            <h2>{getPlayerName(left.player)}</h2>
            <em>{getRoleLabel(left.player)} // {left.team?.name || `Team ${left.side}`}</em>
          </div>
        </article>

        <article className={`${styles.matchupPlayer} ${styles.matchupPlayerRight}`}>
          <SceneImage fallback={right.team?.logo || '/OW.svg'} src={rightImage} />
          <div className={styles.matchupPlayerShade} />
          <div>
            <span>{getPlayerEyebrow(right)}</span>
            <h2>{getPlayerName(right.player)}</h2>
            <em>{getRoleLabel(right.player)} // {right.team?.name || `Team ${right.side}`}</em>
          </div>
        </article>

        <div className={styles.matchupVs}>
          <span>Head To Head</span>
          <strong>VS</strong>
          <em>{modeLabel}</em>
        </div>
      </div>

      <div className={styles.matchupStatGrid}>
        {CORE_STATS.map(stat => (
          <MatchupStat
            key={stat.key}
            leftRow={left.row}
            leftRows={leftRows}
            minutes={minutes}
            mode={mode}
            rightRow={right.row}
            rightRows={rightRows}
            stat={stat}
          />
        ))}
      </div>
    </section>
  )
}

export default function TeamDataScene({ project }) {
  const settings = project?.scenes?.settings?.teamData || {}
  const statsSettings = project?.scenes?.settings?.stats || {}
  const statsData = resolveStatsData({ ...statsSettings, statsDataScope: getTeamDataStatsScope(settings) }, 'overall')
  const rows = normalizeStatsRows(statsData.rows)
  const { teamA, teamB } = getCurrentTeams(project)
  const teamSide = settings.teamSide || 'A'
  const compareTeamSide = settings.compareTeamSide || (teamSide === 'A' ? 'B' : 'A')
  const team = teamSide === 'B' ? teamB : teamA
  const activeRows = teamSide === 'B' ? rows.teamB : rows.teamA
  const players = getPlayersForSide(project, team, teamSide, statsData.playerIds)
  const selectedSlot = clampSlot(settings.playerSlot)
  const compareSlot = clampSlot(settings.compareSlot)
  const activePlayer = players[selectedSlot]
  const activeHeroId = getPlayerHeroId(settings, teamSide, selectedSlot, activePlayer)
  const activeRow = activeRows[selectedSlot] || {}
  const compareTeam = getTeamForSide(teamA, teamB, compareTeamSide)
  const comparePlayers = getPlayersForSide(project, compareTeam, compareTeamSide, statsData.playerIds)
  const compareRows = getRowsForSide(rows, compareTeamSide)
  const comparePlayer = comparePlayers[compareSlot]
  const compareHeroId = getPlayerHeroId(settings, compareTeamSide, compareSlot, comparePlayer)
  const compareRow = compareRows[compareSlot] || {}
  const eventName = getBroadcastCompetitionName(project)
  const title = clean(settings.title) || 'PLAYER DATA'
  const subtitle = clean(settings.subtitle || project?.event?.subtitle) || eventName
  const minutes = statsData.minutes
  const mode = settings.statView || 'per10'
  const rawDisplayMode = settings.displayMode === 'starboard' ? 'matchup' : settings.displayMode
  const displayMode = ['spotlight', 'matchup'].includes(rawDisplayMode) ? rawDisplayMode : 'spotlight'
  const rawCardTag = clean(settings.cardTag)
  const cardTag = rawCardTag === 'MVP PLAYER' ? 'STAR PLAYER' : rawCardTag || 'STAR PLAYER'
  const totalLabel = mode === 'per10' ? 'PER 10 MINUTES' : 'TOTALS'
  const activeRoleLabel = getRoleLabel(activePlayer)
  const compareRoleLabel = getRoleLabel(comparePlayer)
  const matchupRoleLabel = activeRoleLabel === compareRoleLabel
    ? activeRoleLabel
    : `${activeRoleLabel} VS ${compareRoleLabel}`
  const matchupHeaderLine = `${team?.name || `Team ${teamSide}`} VS ${compareTeam?.name || `Team ${compareTeamSide}`} // ${matchupRoleLabel} // ${totalLabel}`
  const leftEntry = { player: activePlayer, row: activeRow, team, side: teamSide, slot: selectedSlot, heroId: activeHeroId }
  const rightEntry = { player: comparePlayer, row: compareRow, team: compareTeam, side: compareTeamSide, slot: compareSlot, heroId: compareHeroId }

  return (
    <div className={styles.scene}>
      <div className={styles.grid} />
      <div className={styles.lightBand} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>OWBT // PLAYER DATA</strong>
        </div>
        <em>{subtitle} // {statsData.label} // {totalLabel}</em>
      </header>

      <main className={`${styles.content} ${displayMode === 'matchup' ? styles.contentMatchup : ''}`}>
        <section className={`${styles.hero} ${displayMode === 'matchup' ? styles.heroMatchup : ''}`}>
          {displayMode === 'spotlight' && (
            <div className={styles.teamMark}>
              <SceneImage fallback="/OW.svg" src={team?.logo || '/OW.svg'} />
            </div>
          )}

          <div className={styles.titleBlock}>
            <p>{eventName}</p>
            <h1>{displayMode === 'matchup' ? 'PLAYER MATCHUP' : title}</h1>
            <span>
              {displayMode === 'spotlight'
                ? `${cardTag} // ${getRoleLabel(activePlayer)} // ${totalLabel}`
                : matchupHeaderLine}
            </span>
          </div>

          {displayMode === 'spotlight' && (
            <TeamTotals
              minutes={minutes}
              mode={mode}
              rows={activeRows}
              team={team}
              teamSide={teamSide}
            />
          )}
        </section>

        {displayMode === 'matchup' ? (
          <PlayerMatchupGraphic
            left={leftEntry}
            leftRows={activeRows}
            minutes={minutes}
            mode={mode}
            right={rightEntry}
            rightRows={compareRows}
          />
        ) : (
          <SpotlightGraphic
            activeHeroId={activeHeroId}
            activePlayer={activePlayer}
            activeRow={activeRow}
            cardTag={cardTag}
            eventName={eventName}
            minutes={minutes}
            mode={mode}
            team={team}
            teamSide={teamSide}
          />
        )}
      </main>

      <footer className={styles.footer}>
        <span>SIX_CORE_STATS // PLAYER_PACKAGE</span>
      </footer>
    </div>
  )
}
