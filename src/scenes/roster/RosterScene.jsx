import { OW_HERO_BY_ID, OW_ROLE_BY_ID } from '../../data/overwatch'
import { FRIES_CUP_CONFIG } from '../../editions/friesCup/config'
import { getBroadcastCompetitionName } from '../../project/branding'
import { getCurrentTeams, getTeamPlayers } from '../../project/projectUtils'
import styles from './RosterScene.module.css'

const clean = value => String(value || '').trim()
const MIN_ROSTER_OUTPUT_PLAYERS = 5
const MAX_ROSTER_OUTPUT_PLAYERS = 7
const MAX_ROSTER_SLOTS = 7

const getPortraitXPct = player => {
  const number = Number(player?.portraitXPct)
  if (!Number.isFinite(number)) return 50
  return Math.max(0, Math.min(100, number))
}

const getRoleLabel = role => {
  const option = OW_ROLE_BY_ID[role]
  return (option?.shortEn || role || 'ROLE').toUpperCase()
}

const getHeroImage = player => {
  const hero = OW_HERO_BY_ID[player?.primaryHeroes?.[0]]
  return clean(player?.avatar) || clean(hero?.rosterIcon || hero?.icon) || FRIES_CUP_CONFIG.defaultLogo
}

const getTeamForSide = (project, side) => {
  const teams = getCurrentTeams(project)
  return side === 'B' ? teams.teamB : teams.teamA
}

const getRosterOutputPlayers = (project, team, side) => {
  const sideKey = side === 'B' ? 'teamB' : 'teamA'
  const rosterPlayers = getTeamPlayers(project, team?.id).slice(0, MAX_ROSTER_SLOTS)
  const savedIds = project?.scenes?.settings?.roster?.activePlayerIds?.[sideKey] || []
  const activeIdSet = new Set(savedIds)
  const selectedPlayers = rosterPlayers
    .filter(player => activeIdSet.has(player.id))
    .slice(0, MAX_ROSTER_OUTPUT_PLAYERS)
  const selectedIds = new Set(selectedPlayers.map(player => player.id))
  const targetCount = selectedPlayers.length > MIN_ROSTER_OUTPUT_PLAYERS
    ? Math.min(MAX_ROSTER_OUTPUT_PLAYERS, selectedPlayers.length)
    : MIN_ROSTER_OUTPUT_PLAYERS

  return [
    ...selectedPlayers,
    ...rosterPlayers.filter(player => !selectedIds.has(player.id))
  ].slice(0, Math.min(targetCount, rosterPlayers.length))
}

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = FRIES_CUP_CONFIG.defaultLogo
}

export default function RosterScene({ project }) {
  const settings = project?.scenes?.settings?.roster || {}
  const side = String(settings.teamSide || 'A').toUpperCase() === 'B' ? 'B' : 'A'
  const team = getTeamForSide(project, side)
  const players = getRosterOutputPlayers(project, team, side)
  const eventName = getBroadcastCompetitionName(project)
  const title = clean(settings.title) || 'TEAM ROSTER'
  const subtitle = clean(project.event?.subtitle || settings.subtitle) || eventName
  const teamName = clean(team?.name) || `Team ${side}`
  const teamShort = clean(team?.shortName) || `T${side}`
  const teamLogo = clean(team?.logo) || FRIES_CUP_CONFIG.defaultLogo
  const teamColor = clean(team?.primaryColor) || 'var(--theme-primary)'
  const managerName = clean(team?.manager)
  const coachName = clean(team?.coach)
  const showManager = Boolean(settings.showManager)
  const showCoach = Boolean(settings.showCoach)
  const hasStaffMeta = showManager || showCoach

  return (
    <div className={styles.scene} style={{ '--team-color': teamColor }}>
      <div className={styles.grid} />
      <div className={styles.diamondA} />
      <div className={styles.diamondB} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>FRIES_CUP_ROSTER_INTERFACE</strong>
        </div>
        <em>TEAM_ROSTER // READY</em>
      </header>

      <section className={styles.hero}>
        <div className={styles.logoBox}>
          <img src={teamLogo} alt="" onError={handleImageFallback} />
        </div>
        <div className={styles.heroCopy}>
          <p>{subtitle}</p>
          <h1>{teamName}</h1>
          <div className={styles.metaLine}>
            <span>{title}</span>
            <strong>{teamShort}</strong>
            <em>{players.length} PLAYERS</em>
          </div>
        </div>
        {hasStaffMeta && (
          <aside className={styles.staffCards}>
            {showManager && (
              <div className={styles.staffCard}>
                <span>Manager</span>
                <strong>{managerName || '-'}</strong>
              </div>
            )}
            {showCoach && (
              <div className={styles.staffCard}>
                <span>Coach</span>
                <strong>{coachName || '-'}</strong>
              </div>
            )}
          </aside>
        )}
      </section>

      <main className={styles.rosterGrid} style={{ '--player-count': Math.max(players.length, 5) }}>
        {players.length ? players.map((player, index) => {
          const battleTag = clean(player.battleTag)

          return (
            <article
              className={styles.playerCard}
              key={player.id || index}
              style={{ '--card-index': index, '--portrait-x': `${getPortraitXPct(player)}%` }}
            >
              <div className={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</div>
              <div className={styles.portrait}>
                <img src={getHeroImage(player)} alt="" />
              </div>
              <div className={styles.playerInfo}>
                <span>{getRoleLabel(player.role)}</span>
                <strong>{clean(player.name) || `PLAYER ${index + 1}`}</strong>
                {battleTag && <em>{battleTag}</em>}
              </div>
            </article>
          )
        }) : (
          <div className={styles.emptyState}>
            <span />
            <strong>No Roster Loaded</strong>
            <p>Load players in Team DB.</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <span>{eventName}</span>
      </footer>
    </div>
  )
}
