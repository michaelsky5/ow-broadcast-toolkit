import { getBroadcastCompetitionName } from '../../project/branding'
import { getCurrentTeams } from '../../project/projectUtils'
import {
  CORE_STATS,
  formatDataMinutes,
  formatPer10,
  normalizeCoreMetrics,
  resolveStatsData,
  selectDisplayMetrics,
  toStatNumber
} from '../../project/statsModel'
import styles from './StatsScene.module.css'

const clean = value => String(value || '').trim()

const DEFAULT_IMAGE_CROP = {
  xPct: 24,
  topPct: 18,
  bottomPct: 55.6,
  wPct: 52,
  hPct: 29.6
}

const toNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isReverseMetric = label => {
  const text = clean(label).toLowerCase()
  const stat = CORE_STATS.find(item => item.label.toLowerCase() === text || item.shortLabel.toLowerCase() === text)
  return stat?.reverse || text.includes('death') || text.includes('dth')
}

const getMetricState = metric => {
  const a = toStatNumber(metric.teamA)
  const b = toStatNumber(metric.teamB)
  const reverse = isReverseMetric(metric.label)
  const max = Math.max(Math.abs(a), Math.abs(b), 1)

  if (a === b) {
    return {
      winner: 'even',
      pctA: a > 0 ? 50 : 5,
      pctB: b > 0 ? 50 : 5
    }
  }

  const aWins = reverse ? a < b : a > b

  return {
    winner: aWins ? 'teamA' : 'teamB',
    pctA: Math.max(5, Math.min(100, (Math.abs(a) / max) * 100)),
    pctB: Math.max(5, Math.min(100, (Math.abs(b) / max) * 100))
  }
}

const getDisplayMetrics = (settings, statsData) => {
  const activeCategory = clean(settings.activeCategory || 'overall').toLowerCase()
  const categoryMetrics = normalizeCoreMetrics(statsData.metrics, activeCategory)
  const fallbackMetrics = normalizeCoreMetrics(settings.metrics, 'overall')
  const source = categoryMetrics.some(metric => toStatNumber(metric.teamA) || toStatNumber(metric.teamB))
    ? categoryMetrics
    : fallbackMetrics

  return selectDisplayMetrics(source).slice(0, 6)
}

const getTeamColor = (team, fallback) => clean(team?.primaryColor) || fallback || 'var(--theme-primary)'

const getTeamLogo = team => clean(team?.logo) || '/OW.svg'

function LogoImage({ team }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt=""
      onError={event => {
        if (event.currentTarget.dataset.fallbackApplied) return
        event.currentTarget.dataset.fallbackApplied = 'true'
        event.currentTarget.src = '/OW.svg'
      }}
    />
  )
}

function TeamLogo({ team }) {
  return (
    <div className={styles.logoBox}>
      <LogoImage team={team} />
    </div>
  )
}

function TeamSide({ team, side, score }) {
  const isRight = side === 'right'

  return (
    <section className={`${styles.teamSide} ${isRight ? styles.teamRight : styles.teamLeft}`}>
      <div className={styles.teamWatermark}>
        <LogoImage team={team} />
      </div>

      <div className={styles.teamBadge}>{isRight ? 'Team B' : 'Team A'}</div>
      <div className={styles.teamScore}>{score ?? 0}</div>

      <div className={styles.teamIdentity}>
        <TeamLogo team={team} />
        <div>
          <p>{team?.name || (isRight ? 'Team B' : 'Team A')}</p>
          <h2>{team?.shortName || (isRight ? 'TMB' : 'TMA')}</h2>
          <span>{team?.description || 'Overwatch Community Team'}</span>
        </div>
      </div>
    </section>
  )
}

function MetricCard({ metric, dataMinutes }) {
  const state = getMetricState(metric)
  const teamAWinning = state.winner === 'teamA'
  const teamBWinning = state.winner === 'teamB'
  const hasDataTime = Number(dataMinutes) > 0

  return (
    <article
      className={[
        styles.metricCard,
        teamAWinning ? styles.metricAWin : '',
        teamBWinning ? styles.metricBWin : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--metric-a-width': `${state.pctA}%`,
        '--metric-b-width': `${state.pctB}%`,
        '--metric-a-half': `${state.pctA / 2}%`,
        '--metric-b-half': `${state.pctB / 2}%`
      }}
    >
      <div className={styles.metricValues}>
        <strong>{clean(metric.teamA) || '0'}</strong>
        <span>{clean(metric.label) || 'Metric'}</span>
        <strong>{clean(metric.teamB) || '0'}</strong>
      </div>

      <div className={styles.advantageBar}>
        <div className={styles.barA} />
        <i />
        <div className={styles.barB} />
      </div>

      <div className={styles.metricFooter}>
        <span>
          {hasDataTime
            ? `${formatPer10(metric.teamA, dataMinutes)} /10   |   ${formatPer10(metric.teamB, dataMinutes)} /10`
            : teamAWinning ? 'Team A Advantage' : teamBWinning ? 'Team B Advantage' : 'Even Match'}
        </span>
      </div>
    </article>
  )
}

function ImageTeamRow({ team, side, score, imageSrc, crop, yPct }) {
  const isRight = side === 'right'
  const teamName = clean(team?.shortName || team?.name || (isRight ? 'TMB' : 'TMA')).toUpperCase()
  const fullName = clean(team?.name) || (isRight ? 'Team B' : 'Team A')
  const cropWidth = Math.max(1, toNumber(crop.wPct, DEFAULT_IMAGE_CROP.wPct))
  const cropHeight = Math.max(1, toNumber(crop.hPct, DEFAULT_IMAGE_CROP.hPct))
  const cropX = Math.max(0, toNumber(crop.xPct, DEFAULT_IMAGE_CROP.xPct))
  const cropY = Math.max(0, toNumber(yPct, DEFAULT_IMAGE_CROP.topPct))
  const cropAspect = `${(cropWidth * 16).toFixed(2)} / ${(cropHeight * 9).toFixed(2)}`

  return (
    <article className={`${styles.imageTeamRow} ${isRight ? styles.imageTeamRowRight : styles.imageTeamRowLeft}`}>
      <aside className={styles.imageTeamDock}>
        <div className={styles.imageLogoPanel}>
          <LogoImage team={team} />
        </div>
        <div className={styles.imageTeamBar}>
          <div>
            <span>{isRight ? 'Team B' : 'Team A'}</span>
            <strong>{teamName}</strong>
          </div>
          <b>{score ?? 0}</b>
        </div>
      </aside>

      <div className={styles.imageCropViewport} style={{ aspectRatio: cropAspect }}>
        {imageSrc ? (
          <img
            className={styles.statsCropImage}
            src={imageSrc}
            alt=""
            style={{
              width: `${10000 / cropWidth}%`,
              height: `${10000 / cropHeight}%`,
              transform: `translate(${-cropX}%, ${-cropY}%)`
            }}
          />
        ) : (
          <div className={styles.imageEmpty}>
            <strong>No Screenshot Loaded</strong>
            <span>Upload or paste a stats screenshot in the Data Center editor.</span>
          </div>
        )}
        <div className={styles.imageCropShade} />
        <span className={styles.imageFullName}>{fullName}</span>
      </div>
    </article>
  )
}

export default function StatsScene({ project }) {
  const settings = project?.scenes?.settings?.stats || {}
  const match = project?.currentMatch || {}
  const { teamA, teamB } = getCurrentTeams(project)
  const activeCategory = 'overall'
  const statsData = resolveStatsData(settings, activeCategory)
  const metrics = getDisplayMetrics(settings, statsData)
  const eventName = getBroadcastCompetitionName(project)
  const title = clean(settings.title) || 'TEAM COMPARISON'
  const subtitle = clean(settings.subtitle || project?.event?.subtitle) || 'MATCH DATA REPORT'
  const dataMinutes = statsData.minutes
  const hasDataMinutes = Number(dataMinutes) > 0
  const dataMinutesLabel = formatDataMinutes(dataMinutes)
  const statsImage = clean(settings.capture?.imageDataUrl)
  const showImageMode = settings.statsDisplayMode === 'image'
  const imageCrop = {
    ...DEFAULT_IMAGE_CROP,
    ...(settings.imageCrop || {})
  }

  return (
    <div
      className={styles.scene}
      style={{
        '--team-a-color': getTeamColor(teamA),
        '--team-b-color': getTeamColor(teamB)
      }}
    >
      <div className={styles.grid} />
      <div className={styles.diamondA} />
      <div className={styles.diamondB} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>OWBT // DATA REPORT</strong>
        </div>
        <em>{statsData.label} // Overall{hasDataMinutes ? ` // ${dataMinutesLabel} MIN` : ''}</em>
      </header>

      <main className={styles.shell}>
        <section className={styles.header}>
          <div>
            <p>{subtitle}</p>
            <h1>{title}</h1>
          </div>
        </section>

        {showImageMode ? (
          <section className={styles.imagePackage}>
            <div className={styles.imagePackageHeader}>
              <div>
                <span>Post-Match Data</span>
                <strong>{statsData.label}</strong>
              </div>
              <em>{hasDataMinutes ? `${dataMinutesLabel} MIN` : 'MAP DATA'} // SPLIT IMAGE</em>
            </div>

            <ImageTeamRow
              team={teamA}
              side="left"
              score={match.score?.teamA}
              imageSrc={statsImage}
              crop={imageCrop}
              yPct={imageCrop.topPct}
            />

            <div className={styles.statColumnStrip}>
              <span />
              <div>
                {['ELIM', 'AST', 'DTH', 'DMG', 'HEAL', 'MIT'].map(label => <strong key={label}>{label}</strong>)}
              </div>
            </div>

            <ImageTeamRow
              team={teamB}
              side="right"
              score={match.score?.teamB}
              imageSrc={statsImage}
              crop={imageCrop}
              yPct={imageCrop.bottomPct}
            />
          </section>
        ) : (
          <>
            <section className={styles.duelStage}>
              <TeamSide team={teamA} side="left" score={match.score?.teamA} />
              <div className={styles.vsCore}>
                <span>Team To Team</span>
                <strong>VS</strong>
                <em>FT{match.ft || 3}</em>
              </div>
              <TeamSide team={teamB} side="right" score={match.score?.teamB} />
            </section>

            <section className={`${styles.metricGrid} ${metrics.length <= 3 ? styles.metricGridCompact : ''}`}>
              {metrics.map((metric, index) => (
                <MetricCard dataMinutes={dataMinutes} metric={metric} key={`${metric.label}-${index}`} />
              ))}
            </section>
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <span>{eventName} // MATCH DATA</span>
      </footer>
    </div>
  )
}
