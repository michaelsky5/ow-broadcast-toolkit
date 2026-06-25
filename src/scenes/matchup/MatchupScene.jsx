import { OW_MAP_BY_ID } from '../../data/overwatch'
import { FRIES_CUP_CONFIG } from '../../editions/friesCup/config'
import { getCurrentTeams } from '../../project/projectUtils'
import { getBroadcastCompetitionName } from '../../project/branding'
import styles from './MatchupScene.module.css'

const COPY = {
  zh: {
    ready: 'UP NEXT',
    matchInfo: 'Match Card',
    map: 'Current Map',
    mode: 'Map Mode',
    stage: 'Stage',
    round: 'Round',
    series: 'Format',
    score: 'Series Score'
  },
  en: {
    ready: 'UP NEXT',
    matchInfo: 'Match Card',
    map: 'Current Map',
    mode: 'Map Mode',
    stage: 'Stage',
    round: 'Round',
    series: 'Format',
    score: 'Series Score'
  }
}

const getOverlayLanguage = project => {
  const language = project?.scenes?.settings?.matchup?.language || project?.event?.language || 'en'
  return language === 'zh' ? 'zh' : 'en'
}

const getTeamInitials = team => {
  const source = team?.shortName || team?.name || 'TBD'
  return String(source).slice(0, 4).toUpperCase()
}

const getTeamLogo = team => String(team?.logo || '').trim() || FRIES_CUP_CONFIG.defaultLogo

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = FRIES_CUP_CONFIG.defaultLogo
}

function TeamPanel({ team, side, score }) {
  const alignRight = side === 'right'
  const teamColor = team?.primaryColor || 'var(--theme-primary)'

  return (
    <section
      className={`${styles.teamPanel} ${alignRight ? styles.teamRight : styles.teamLeft}`}
      style={{ '--team-color': teamColor }}
    >
      <div className={styles.teamAccent} />

      <div className={styles.logoBox}>
        <img src={getTeamLogo(team)} alt={getTeamInitials(team)} onError={handleImageFallback} />
      </div>

      <div className={styles.teamText}>
        <div className={styles.teamLabel}>{alignRight ? 'TEAM B' : 'TEAM A'}</div>
        <h2>{team?.name || (alignRight ? 'Team B' : 'Team A')}</h2>
        <p>{team?.shortName || 'TBD'}</p>
      </div>

      <div className={styles.seriesScore}>
        <span>Score</span>
        <strong>{score}</strong>
      </div>
    </section>
  )
}

function InfoStrip({ items }) {
  return (
    <section className={styles.infoStrip}>
      {items.map(item => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value || '-'}</strong>
        </div>
      ))}
    </section>
  )
}

export default function MatchupScene({ project }) {
  const { teamA, teamB } = getCurrentTeams(project)
  const match = project.currentMatch || {}
  const settings = project.scenes?.settings?.matchup || {}
  const lang = getOverlayLanguage(project)
  const copy = COPY[lang]
  const map = OW_MAP_BY_ID[match.currentMapId]
  const competitionName = getBroadcastCompetitionName(project)

  const title = settings.title || 'UP NEXT'
  const shouldShowMap = settings.showMap !== false
  const mapName = lang === 'en' ? map?.en : map?.zh
  const modeName = lang === 'en' ? map?.modeEn : map?.modeZh
  const infoItems = [
    settings.showStage !== false ? { label: copy.stage, value: match.stage } : null,
    { label: copy.round, value: match.currentRoundLabel },
    settings.showFt !== false ? { label: copy.series, value: `FT${match.ft || 3}` } : null,
    shouldShowMap ? { label: copy.map, value: mapName || match.currentMapId } : null,
    shouldShowMap ? { label: copy.mode, value: modeName } : null
  ].filter(Boolean).slice(0, 4)

  const sceneStyle = {
    '--matchup-map-image': shouldShowMap && map?.image ? `url("${map.image}")` : 'none'
  }

  return (
    <div className={styles.scene} style={sceneStyle}>
      <div className={styles.mapLayer} />
      <div className={styles.darkLayer} />
      <div className={styles.gridLayer} />
      <div className={styles.frameGlow} />

      <header className={styles.topBar}>
        <div className={styles.brandMark}>
          <span />
          {competitionName}
        </div>
        <div>SHOW FLOW // MATCH READY</div>
        <div>{copy.ready}</div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleBlock}>
          <div className={styles.kicker}>{copy.matchInfo}</div>
          <h1>{title}</h1>
          <p>{project.event?.subtitle || FRIES_CUP_CONFIG.editionName}</p>
        </div>

        <div className={styles.matchCard}>
          <TeamPanel team={teamA} side="left" score={match.score?.teamA ?? 0} />

          <div className={styles.centerPanel}>
            <div className={styles.vsBox}>VS</div>
            <div className={styles.seriesTag}>FT{match.ft || 3}</div>
          </div>

          <TeamPanel team={teamB} side="right" score={match.score?.teamB ?? 0} />
        </div>

        <InfoStrip items={infoItems} />
      </main>

      <footer className={styles.footer}>
        <span>{FRIES_CUP_CONFIG.brandName} // SHOW FLOW // UP NEXT</span>
      </footer>
    </div>
  )
}
