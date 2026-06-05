import { OW_MAP_BY_ID } from '../../data/overwatch'
import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import { getCurrentTeams } from '../../project/projectUtils'
import styles from './PauseScene.module.css'

const clean = value => String(value || '').trim()

const getTeamName = (team, fallback) => clean(team?.name) || fallback
const getTeamShort = (team, fallback) => clean(team?.shortName) || fallback
const getTeamLogo = team => clean(team?.logo) || '/OW.svg'

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = '/OW.svg'
}

function TeamStrip({ team, side, score }) {
  const fallback = side === 'A' ? 'Team A' : 'Team B'

  return (
    <div className={styles.teamStrip} style={{ '--team-color': team?.primaryColor || 'var(--theme-primary)' }}>
      <div className={styles.teamLogo}>
        <img src={getTeamLogo(team)} alt="" onError={handleImageFallback} />
      </div>

      <div className={styles.teamText}>
        <span>TEAM {side}</span>
        <strong>{getTeamName(team, fallback)}</strong>
        <em>{getTeamShort(team, side)}</em>
      </div>

      <div className={styles.scoreBox}>{score}</div>
    </div>
  )
}

export default function PauseScene({ project }) {
  const settings = project?.scenes?.settings?.pause || {}
  const match = project?.currentMatch || {}
  const pause = match.pause || {}
  const { teamA, teamB } = getCurrentTeams(project)
  const map = OW_MAP_BY_ID[match.currentMapId]
  const title = clean(settings.title || pause.title) || 'TECHNICAL PAUSE'
  const description = clean(settings.description || pause.description) || 'Match paused. Please stand by.'
  const statusLabel = clean(settings.statusLabel) || 'STANDBY'
  const showMatchFrame = settings.showMatchFrame !== false
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)

  return (
    <div className={styles.scene}>
      <div className={styles.gridLayer} />
      <div className={styles.scanLayer} />
      <div className={styles.glowLayer} />

      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <div className={styles.eventLogo}>
            <img src={eventLogo || '/OW.svg'} alt="" onError={handleImageFallback} />
          </div>
          <div>
            <span>{eventName}</span>
            <strong>OWBT LIVE CONTROL</strong>
          </div>
        </div>

        <div className={styles.statusPill}>{statusLabel}</div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.kicker}>BROADCAST HOLD</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>

        {showMatchFrame && (
          <section className={styles.matchFrame}>
            <TeamStrip team={teamA} side="A" score={match.score?.teamA ?? 0} />

            <div className={styles.centerStack}>
              <span>{match.currentRoundLabel || `MAP ${match.currentMapIndex || 1}`}</span>
              <strong>{map?.en || match.currentMapId || 'TBD'}</strong>
              <em>{match.stage || 'MATCH STAGE'}</em>
            </div>

            <TeamStrip team={teamB} side="B" score={match.score?.teamB ?? 0} />
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <span>1920 x 1080 PROGRAM CANVAS</span>
      </footer>
    </div>
  )
}
