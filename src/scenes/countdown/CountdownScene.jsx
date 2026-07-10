import { useEffect, useMemo, useState } from 'react'
import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import { getCurrentTeams } from '../../project/projectUtils'
import styles from './CountdownScene.module.css'

const clean = value => String(value || '').trim()

const EMPTY_COUNTDOWN_SETTINGS = {}
const STANDBY_TITLE = 'BROADCAST STANDBY'
const COUNTDOWN_TITLE = 'BROADCAST BEGINS IN'
const SCHEDULE_MATCH_FIELDS = [
  'time',
  'stage',
  'teamA',
  'teamB',
  'logoA',
  'logoB',
  'logoBgA',
  'logoBgB',
  'scoreA',
  'scoreB'
]

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.style.display = 'none'
}

const getRemainingSeconds = (settings, now) => {
  const target = Number(settings?.targetTimestamp) || 0
  if (target > 0) return Math.max(0, Math.floor((target - now) / 1000))
  return Math.max(0, Number(settings?.durationSeconds) || 0)
}

const formatTime = totalSeconds => {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(seconds / 60)
  return {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds % 60).padStart(2, '0')
  }
}

const normalizeMode = value => (
  ['standby', 'full', 'video'].includes(value) ? value : 'standby'
)

const getInitials = value => {
  const text = clean(value)
  if (!text) return 'TBD'
  return text.split(/\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase()
}

const getDisplayNameFromPath = path => {
  const source = clean(path)
  if (!source) return ''

  const withoutQuery = source.split('?')[0]
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() || ''
}

const getCleanVideoSource = project => {
  const media = project?.scenes?.settings?.media || {}
  const library = Array.isArray(media.videoLibrary) ? media.videoLibrary : []
  const playlist = Array.isArray(media.videoPlaylist) ? media.videoPlaylist.map(clean).filter(Boolean) : []
  const source = clean(media.activeVideoPath) || playlist[0] || ''
  const libraryItem = library.find(item => clean(item.path) === source)

  return {
    name: clean(libraryItem?.name || media.sourceName) || getDisplayNameFromPath(source) || 'CLEAN VIDEO',
    source,
    muted: media.muted !== false,
    loop: media.loop !== false
  }
}

const getReadableTextColor = color => {
  const value = clean(color).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#ffffff'
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156 ? '#050505' : '#ffffff'
}

const buildFallbackMatch = (project, teamA, teamB) => ({
  time: '',
  stage: project?.currentMatch?.stage || '',
  teamA: teamA?.shortName || teamA?.name || 'TEAM A',
  teamB: teamB?.shortName || teamB?.name || 'TEAM B',
  logoA: teamA?.logo || '',
  logoB: teamB?.logo || '',
  logoBgA: teamA?.primaryColor || '#101010',
  logoBgB: teamB?.primaryColor || '#101010',
  scoreA: '',
  scoreB: ''
})

const isEmptyConfiguredMatch = match => (
  match?.enabled === false && SCHEDULE_MATCH_FIELDS.every(field => !clean(match?.[field]))
)

const getScheduleMatches = (settings, project, teamA, teamB) => {
  const configured = Array.isArray(settings.upcomingMatches)
    ? settings.upcomingMatches.filter(match => match && !isEmptyConfiguredMatch(match))
    : []
  const source = configured.length
    ? configured.filter(match => match?.enabled !== false)
    : [buildFallbackMatch(project, teamA, teamB)]

  return source.slice(0, 4).map(match => ({
    time: clean(match.time),
    stage: clean(match.stage),
    teamA: clean(match.teamA) || 'TBD',
    teamB: clean(match.teamB) || 'TBD',
    logoA: clean(match.logoA),
    logoB: clean(match.logoB),
    logoBgA: clean(match.logoBgA) || '#101010',
    logoBgB: clean(match.logoBgB) || '#101010',
    scoreA: clean(match.scoreA),
    scoreB: clean(match.scoreB)
  }))
}

function LogoCell({ source, label }) {
  return (
    <div className={styles.scheduleLogoCell}>
      {source ? (
        <img src={source} alt="" onError={handleImageFallback} />
      ) : (
        <span>{getInitials(label)}</span>
      )}
    </div>
  )
}

function ScheduleBoard({ matches, compact = false, dense = false, featured = false }) {
  if (!matches.length) return null

  if (matches.length === 1 && (!compact || featured)) {
    const match = matches[0]
    const hasScore = match.scoreA !== '' && match.scoreB !== ''

    return (
      <section className={`${styles.scheduleSingle} ${featured ? styles.scheduleSingleFeatured : ''}`}>
        <div className={styles.scheduleMetaTag}>
          <span>{match.time ? `TIME // ${match.time}` : 'UPCOMING'}</span>
          {match.stage && <em>{match.stage}</em>}
        </div>

        <div className={styles.scheduleSingleCard}>
          <div
            className={styles.scheduleSingleTeam}
            style={{
              '--schedule-logo-bg': match.logoBgA,
              '--schedule-team-text': getReadableTextColor(match.logoBgA)
            }}
          >
            <LogoCell source={match.logoA} label={match.teamA} />
            <strong>{match.teamA}</strong>
          </div>

          <div className={styles.scheduleScoreBand}>
            {hasScore ? (
              <>
                <strong>{match.scoreA}</strong>
                <span>VS</span>
                <strong>{match.scoreB}</strong>
              </>
            ) : (
              <span>VS</span>
            )}
          </div>

          <div
            className={styles.scheduleSingleTeam}
            style={{
              '--schedule-logo-bg': match.logoBgB,
              '--schedule-team-text': getReadableTextColor(match.logoBgB)
            }}
          >
            <LogoCell source={match.logoB} label={match.teamB} />
            <strong>{match.teamB}</strong>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`${styles.scheduleList} ${compact ? styles.scheduleListCompact : ''} ${dense ? styles.scheduleListDense : ''}`}>
      {matches.map((match, index) => {
        const hasScore = match.scoreA !== '' && match.scoreB !== ''
        const stageLabel = match.stage || 'NEXT MATCH'
        const timeLabel = match.time || 'UPCOMING'

        return (
          <article className={styles.scheduleItem} key={`${index}-${match.teamA}-${match.teamB}`}>
            <div className={styles.scheduleMetaTag}>
              <span>{timeLabel}</span>
              <em>{stageLabel}</em>
            </div>

            <div className={styles.scheduleItemRow}>
              <div className={styles.scheduleItemTeam}>
                <div className={styles.scheduleMiniLogo} style={{ '--schedule-logo-bg': match.logoBgA }}>
                  <LogoCell source={match.logoA} label={match.teamA} />
                </div>
                <strong>{match.teamA}</strong>
              </div>

              <div className={`${styles.scheduleMiniScore} ${hasScore ? styles.scheduleMiniScoreWide : ''}`}>
                {hasScore ? (
                  <>
                    <strong>{match.scoreA}</strong>
                    <span>VS</span>
                    <strong>{match.scoreB}</strong>
                  </>
                ) : (
                  <span>VS</span>
                )}
              </div>

              <div className={`${styles.scheduleItemTeam} ${styles.scheduleItemTeamRight}`}>
                <strong>{match.teamB}</strong>
                <div className={styles.scheduleMiniLogo} style={{ '--schedule-logo-bg': match.logoBgB }}>
                  <LogoCell source={match.logoB} label={match.teamB} />
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

const getSponsorContent = (project, settings) => {
  const sponsorSlots = Array.isArray(project?.assets?.sponsors?.logos)
    ? project.assets.sponsors.logos
    : []
  const assetSponsors = sponsorSlots
    .filter(slot => slot?.enabled !== false && (clean(slot?.logo) || clean(slot?.name)))
    .map((slot, index) => ({
      id: clean(slot?.id) || `sponsor-${index + 1}`,
      name: clean(slot?.name),
      logo: clean(slot?.logo)
    }))
  const legacyName = clean(settings.sponsorName)
  const legacyLogo = clean(settings.sponsorLogo)
  const sponsors = assetSponsors.length
    ? assetSponsors
    : (legacyName || legacyLogo ? [{ id: 'countdown-sponsor', name: legacyName, logo: legacyLogo }] : [])
  const text = clean(settings.sponsorText) || clean(project?.assets?.sponsors?.tickerText)

  return {
    visible: settings.showSponsor === true && Boolean(sponsors.length || text),
    sponsors,
    text
  }
}

function TopbarSponsorLockup({ sponsor }) {
  if (!sponsor?.visible) return null

  return (
    <aside className={styles.topbarSponsorLockup} title={sponsor.text || sponsor.sponsors?.map(item => item.name).filter(Boolean).join(' × ')}>
      <span>Presented By</span>
      <div className={styles.topbarSponsorBrands}>
        {sponsor.sponsors?.map((item, index) => (
          <div className={styles.topbarSponsorBrandGroup} key={item.id}>
            <div className={styles.topbarSponsorBrand}>
              {item.logo && <img src={item.logo} alt={item.name} onError={handleImageFallback} />}
              {item.name && <strong>{item.name}</strong>}
            </div>
            {index < sponsor.sponsors.length - 1 && <i aria-hidden="true">×</i>}
          </div>
        ))}
        {!sponsor.sponsors?.length && sponsor.text && <strong>{sponsor.text}</strong>}
      </div>
    </aside>
  )
}

function VideoFrame({ cleanVideo }) {
  return (
    <section className={styles.videoFrame}>
      <div className={styles.videoCorners} />
      {cleanVideo.source ? (
        <video
          key={cleanVideo.source}
          src={cleanVideo.source}
          autoPlay
          muted={cleanVideo.muted}
          loop={cleanVideo.loop}
          playsInline
        />
      ) : (
        <div className={styles.videoPlaceholder}>
          <strong>Clean Video</strong>
          <span>No active video source</span>
        </div>
      )}
      <div className={styles.videoShade} />
      <span className={styles.videoLabel}>{cleanVideo.name}</span>
    </section>
  )
}

function EventMark({ eventLogo, eventName, subtitle, settings, compact = false }) {
  const showLogo = settings.showEventLogo !== false
  const showEventName = settings.showEventName !== false
  const eventNameVisualLength = Array.from(clean(eventName)).reduce((length, character) => (
    length + ((character.codePointAt(0) ?? 0) > 0xff ? 2 : 1)
  ), 0)
  const eventNameSizeClass = eventNameVisualLength > 30
    ? styles.eventNameLong
    : eventNameVisualLength > 20
      ? styles.eventNameMedium
      : ''

  return (
    <div className={`${styles.eventIdentityGroup} ${compact ? styles.eventIdentityGroupCompact : ''}`}>
      <div className={`${styles.eventMark} ${compact ? styles.eventMarkCompact : ''} ${showLogo ? '' : styles.eventMarkNoLogo}`}>
        {showLogo && (
          <div className={styles.eventLogoBox}>
            <img src={eventLogo || '/OW.svg'} alt="" onError={handleImageFallback} />
          </div>
        )}
        <div>
          <p>{subtitle}</p>
          {showEventName && <h1 className={eventNameSizeClass} title={eventName}>{eventName}</h1>}
        </div>
      </div>
    </div>
  )
}

function TimerBlock({ title, timer, outputStatus, settings, compact = false }) {
  const showStatus = settings.showStatus !== false

  return (
    <section className={`${styles.timerBlock} ${compact ? styles.timerBlockCompact : ''}`}>
      <span className={styles.timerLabel}>{title}</span>
      <div className={styles.timer}>
        <strong>{timer.minutes}</strong>
        <em>:</em>
        <strong>{timer.seconds}</strong>
      </div>
      <div className={styles.progressLine} />
      {showStatus && (
        <div className={styles.status}>
          <span />
          <strong>{outputStatus}</strong>
        </div>
      )}
    </section>
  )
}

function StandbyPanel({ eventLogo, eventName, title, subtitle, status, settings }) {
  const showLogo = settings.showEventLogo !== false
  const showEventName = settings.showEventName !== false
  const showStatus = settings.showStatus !== false

  return (
    <main className={styles.standbyContent}>
      <section className={styles.standbyPanel}>
        <div className={styles.standbyBackdrop}>
          <span>{eventName}</span>
        </div>

        <div className={styles.standbyRail}>
          {showLogo && (
            <div className={styles.standbyLogo}>
              <img src={eventLogo || '/OW.svg'} alt="" onError={handleImageFallback} />
            </div>
          )}
          <strong>STANDBY</strong>
        </div>

        <div className={styles.standbyCopy}>
          {showStatus && (
            <span className={styles.standbyStatus}>
              <i />
              {status}
            </span>
          )}
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {showEventName && <em>{eventName}</em>}
        </div>

      </section>
    </main>
  )
}

export default function CountdownScene({ project }) {
  const settings = project?.scenes?.settings?.countdown ?? EMPTY_COUNTDOWN_SETTINGS
  const [now, setNow] = useState(() => Date.now())
  const { teamA, teamB } = getCurrentTeams(project)
  const fallbackEventName = getBroadcastCompetitionName(project)
  const eventName = settings.eventNameLanguage === 'zh'
    ? clean(project?.event?.nameZh) || fallbackEventName
    : clean(project?.event?.nameEn) || fallbackEventName
  const eventLogo = getEventLogo(project)
  const displayMode = normalizeMode(settings.displayMode)
  const isStandbyMode = displayMode === 'standby'
  const isVideoMode = displayMode === 'video'
  const remaining = useMemo(() => getRemainingSeconds(settings, now), [settings, now])
  const timer = useMemo(() => formatTime(remaining), [remaining])
  const rawTitle = clean(settings.title)
  const title = isStandbyMode && rawTitle === COUNTDOWN_TITLE
    ? STANDBY_TITLE
    : !isStandbyMode && rawTitle === STANDBY_TITLE
      ? COUNTDOWN_TITLE
      : rawTitle || (isStandbyMode ? STANDBY_TITLE : COUNTDOWN_TITLE)
  const subtitle = clean(project?.event?.subtitle || settings.subtitle) || eventName
  const status = clean(settings.statusText) || 'PLEASE STAND BY'
  const outputStatus = remaining <= 0 && !isStandbyMode ? clean(settings.finishedText) || 'READY' : status
  const modeLabel = isStandbyMode ? 'STANDBY' : isVideoMode ? 'BREAK VIDEO' : 'INTERMISSION'
  const showSchedule = !isStandbyMode && settings.showSchedule !== false
  const scheduleMatches = getScheduleMatches(settings, project, teamA, teamB)
  const denseSchedule = scheduleMatches.length >= 4
  const cleanVideo = useMemo(() => getCleanVideoSource(project), [project])
  const sponsor = getSponsorContent(project, settings)

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => window.clearInterval(id)
  }, [])

  return (
    <div className={styles.scene}>
      <div className={styles.grid} />
      <div className={styles.diamondA} />
      <div className={styles.diamondB} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>{modeLabel}</strong>
        </div>
        {sponsor.visible
          ? <TopbarSponsorLockup sponsor={sponsor} />
          : <em>{settings.showEventName !== false ? eventName : modeLabel}</em>}
      </header>

      {isStandbyMode ? (
        <StandbyPanel
          eventLogo={eventLogo}
          eventName={eventName}
          title={title}
          subtitle={subtitle}
          status={outputStatus}
          settings={settings}
        />
      ) : isVideoMode ? (
        <main className={styles.videoContent}>
          <VideoFrame cleanVideo={cleanVideo} />

          <aside className={styles.videoSide}>
            <section className={styles.videoTimerCard}>
              <EventMark eventLogo={eventLogo} eventName={eventName} subtitle={subtitle} settings={settings} compact />
              <TimerBlock title={title} timer={timer} outputStatus={outputStatus} settings={settings} compact />
            </section>

            {showSchedule && (
              <ScheduleBoard
                matches={scheduleMatches}
                compact={scheduleMatches.length > 1}
                dense={denseSchedule}
                featured={scheduleMatches.length === 1}
              />
            )}
          </aside>
        </main>
      ) : (
        <main className={`${styles.fullContent} ${showSchedule ? '' : styles.fullContentNoSchedule}`}>
          <section className={styles.fullTimerColumn}>
            <EventMark eventLogo={eventLogo} eventName={eventName} subtitle={subtitle} settings={settings} />
            <TimerBlock title={title} timer={timer} outputStatus={outputStatus} settings={settings} />
          </section>

          {showSchedule && (
            <aside className={styles.fullScheduleColumn}>
              <ScheduleBoard matches={scheduleMatches} />
            </aside>
          )}
        </main>
      )}

      {!isStandbyMode && (
        <footer className={styles.footer}>
          <span>{modeLabel}</span>
          {settings.showStatus !== false && <strong>{outputStatus}</strong>}
        </footer>
      )}
    </div>
  )
}
