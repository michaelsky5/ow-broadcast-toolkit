import { OW_HERO_BY_ID } from '../../data/overwatch'
import { getBroadcastCompetitionName } from '../../project/branding'
import { getCurrentTeams, getPlayerById, getStartingPlayers, getTeamPlayers } from '../../project/projectUtils'
import {
  CORE_STATS,
  formatDataMinutes,
  formatPer10,
  formatStatNumber,
  normalizeStatsRows,
  resolveStatsData,
  toStatNumber
} from '../../project/statsModel'
import styles from './MvpScene.module.css'
import SponsorLockup from '../shared/SponsorLockup'

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

const getTeamForSide = (teamA, teamB, side) => (side === 'B' ? teamB : teamA)

const getRowsForSide = (rows, side) => (side === 'B' ? rows.teamB : rows.teamA)

const clampSlot = value => Math.max(0, Math.min(4, Number(value) || 0))

const getPlayerName = player => clean(player?.name || player?.nickname || player?.battleTag) || 'Player'

const getBattleTag = player => clean(player?.battleTag)

const getRoleLabel = player => ROLE_LABEL[String(player?.role || '').toLowerCase()] || 'PLAYER'

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

const unique = values => [...new Set(values.map(clean).filter(Boolean))]

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

const getPlayerHeroId = (settings, player) => (
  clean(settings.heroOverride) || (Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : '')
)

const getPlayerArtCandidates = (player, team, heroId = '') => unique([
  player?.playerImage,
  player?.heroImage,
  player?.rosterImage,
  player?.screenshot,
  player?.image,
  player?.photo,
  player?.avatar,
  ...getHeroAssetCandidates(player, heroId, 'roster'),
  ...getHeroAssetCandidates(player, heroId, 'icon'),
  team?.logo,
  '/OW.svg'
])

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

const getMvpType = settings => (settings?.mvpType === 'map' ? 'map' : 'match')

const getMvpStatsDataScope = settings => {
  const scope = String(settings?.statsDataScope || 'follow').toLowerCase()
  if (scope === 'current' || scope === 'cumulative') return scope
  return getMvpType(settings) === 'match' ? 'cumulative' : 'current'
}

const getFeaturedStats = (row, settings) => {
  const selected = Array.isArray(settings.statKeys) ? settings.statKeys : []
  const ordered = selected
    .map(key => CORE_STATS.find(stat => stat.key === key))
    .filter(Boolean)

  if (ordered.length >= 3) return ordered.slice(0, 3)

  const fallback = CORE_STATS
    .filter(stat => !stat.reverse)
    .map(stat => ({ stat, value: toStatNumber(row?.[stat.rowKey]) }))
    .sort((a, b) => b.value - a.value)
    .map(item => item.stat)

  return unique([...ordered, ...fallback].map(stat => stat.key))
    .map(key => CORE_STATS.find(stat => stat.key === key))
    .filter(Boolean)
    .slice(0, 3)
}

export default function MvpScene({ project }) {
  const settings = project?.scenes?.settings?.mvp || {}
  const statsSettings = project?.scenes?.settings?.stats || {}
  const statsData = resolveStatsData({ ...statsSettings, statsDataScope: getMvpStatsDataScope(settings) }, 'overall')
  const rows = normalizeStatsRows(statsData.rows)
  const { teamA, teamB } = getCurrentTeams(project)
  const mvpType = getMvpType(settings)
  const teamSide = settings.teamSide || 'A'
  const team = getTeamForSide(teamA, teamB, teamSide)
  const players = getPlayersForSide(project, team, teamSide, statsData.playerIds)
  const selectedSlot = clampSlot(settings.playerSlot)
  const player = players[selectedSlot]
  const row = getRowsForSide(rows, teamSide)[selectedSlot] || {}
  const mode = settings.statView || 'per10'
  const heroId = getPlayerHeroId(settings, player)
  const hero = getHero(heroId)
  const heroLabel = hero?.en || clean(heroId) || 'Signature Hero'
  const playerImage = getPlayerArtCandidates(player, team, heroId)
  const eventName = getBroadcastCompetitionName(project)
  const packageLabel = mvpType === 'match' ? 'MATCH MVP' : 'MAP MVP'
  const title = clean(settings.title) || packageLabel
  const subtitle = clean(settings.subtitle || project?.event?.subtitle) || eventName
  const note = clean(settings.note) || 'CLUTCH PERFORMANCE'
  const totalLabel = mode === 'per10' ? 'PER 10 MINUTES' : 'TOTALS'
  const dataTimeLabel = statsData.minutes ? `${formatDataMinutes(statsData.minutes)} MIN` : 'LIVE DATA'
  const featuredStats = getFeaturedStats(row, settings)
  const playerName = getPlayerName(player)
  const battleTag = getBattleTag(player)
  const showBattleTag = battleTag && battleTag !== playerName

  return (
    <div className={styles.scene}>
      <div className={styles.grid} />
      <div className={styles.lightBand} />
      <div className={styles.scanline} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>OWBT // MVP PACKAGE</strong>
        </div>
        <em>{subtitle} // {statsData.label} // {totalLabel}</em>
      </header>

      <main className={styles.content}>
        <section className={styles.poster}>
          <div className={styles.posterFrame} />
          <SceneImage className={styles.heroImage} fallback={team?.logo || '/OW.svg'} src={playerImage} />
          <div className={styles.posterShade} />
          <div className={styles.giantText}>MVP</div>

          <div className={styles.mvpBadge}>
            <span>{title}</span>
          </div>

          <div className={styles.playerBlock}>
            <span>{eventName}</span>
            <h1>{playerName}</h1>
            <p>{showBattleTag ? `${battleTag} // ` : ''}{team?.shortName || teamSide} // {getRoleLabel(player)} // {heroLabel}</p>
            <i />
          </div>
        </section>

        <aside className={styles.infoPanel}>
          <div className={styles.railHeader}>
            <span>MVP Data</span>
            <strong>{statsData.label} // {dataTimeLabel}</strong>
          </div>

          <div className={styles.teamStrip}>
            <div className={styles.teamMark}>
              <SceneImage fallback="/OW.svg" src={team?.logo || '/OW.svg'} />
            </div>
            <div>
              <span>{team?.shortName || teamSide}</span>
              <strong>{team?.name || `Team ${teamSide}`}</strong>
            </div>
          </div>

          <div className={styles.featuredStats}>
            {featuredStats.map((stat, index) => (
              <article key={stat.key}>
                <span>0{index + 1}</span>
                <div>
                  <em>{stat.label}</em>
                  <strong>{getStatDisplay(row, stat, statsData.minutes, mode)}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.statGrid}>
            {CORE_STATS.map(stat => (
              <span key={stat.key}>
                <em>{stat.shortLabel}</em>
                <strong>{getStatDisplay(row, stat, statsData.minutes, mode)}</strong>
              </span>
            ))}
          </div>

          <div className={styles.noteBox}>
            <span>MVP NOTE</span>
            <strong>{note}</strong>
          </div>
        </aside>
      </main>

      <footer className={styles.footer}>
        <span>SIX_CORE_STATS // MVP_PACKAGE // {totalLabel}</span>
      </footer>

      {settings.showSponsors !== false && (
        <SponsorLockup className={styles.sponsorLockup} project={project} variant="compact" />
      )}
    </div>
  )
}
