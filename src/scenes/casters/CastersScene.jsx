import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import { OW_HERO_BY_ID, OW_MAP_BY_ID } from '../../data/overwatch'
import { getCurrentTeams, getStartingPlayers } from '../../project/projectUtils'
import styles from './CastersScene.module.css'

const clean = value => String(value || '').trim()

const DEFAULT_INTERVIEW_SETTINGS = {
  visible: false,
  speakerMode: 'PLAYER',
  teamSide: 'A',
  playerSlot: '',
  title: 'POST-MATCH INTERVIEW',
  subtitle: 'VOICE INTERVIEW',
  status: 'VOICE CONNECTED',
  manualTeamName: '',
  manualSpeakerName: '',
  manualSpeakerRole: ''
}

const DEFAULT_DESK_NOTE_SETTINGS = {
  visible: false,
  note: 'MATCH DESK STANDBY'
}

const getInitials = value => (
  clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || 'OW'
)

const normalizePerson = (person, index, packageMode) => ({
  id: person?.id || `${packageMode === 'STAFF' ? 'staff' : 'caster'}-${index + 1}`,
  name: clean(person?.name) || `${packageMode === 'STAFF' ? 'Staff' : 'Caster'} ${index + 1}`,
  title: clean(person?.title) || (packageMode === 'STAFF' ? 'Production' : 'Commentator'),
  social: clean(person?.social || person?.description),
  avatar: clean(person?.avatar)
})

const imageFallback = event => {
  event.currentTarget.onerror = null
  event.currentTarget.src = '/OW.svg'
}

const getCurrentMapEntry = match => {
  const index = Math.max(0, Number(match?.currentMapIndex || 1) - 1)
  return Array.isArray(match?.mapLineup) ? match.mapLineup[index] || null : null
}

const getCurrentMapLabel = match => {
  const entry = getCurrentMapEntry(match)
  const map = OW_MAP_BY_ID[entry?.mapId || entry?.id || match?.currentMapId]
  return clean(entry?.name) || map?.en || clean(match?.currentMapId) || 'TBD'
}

const parseBanEntry = entry => {
  const [role = 'damage', hero = ''] = clean(entry).toLowerCase().split('/')
  return {
    role,
    hero
  }
}

const getBanLabel = entry => {
  const { hero, role } = parseBanEntry(entry)
  if (!hero || hero === 'tbd') return ''
  const heroData = OW_HERO_BY_ID[hero]
  return heroData?.en || `${role} ${hero}`.toUpperCase()
}

const getCurrentBans = match => {
  const entry = getCurrentMapEntry(match)
  const bansA = Array.isArray(entry?.bansA) && entry.bansA.length ? entry.bansA : match?.bansA
  const bansB = Array.isArray(entry?.bansB) && entry.bansB.length ? entry.bansB : match?.bansB

  return {
    bansA: (Array.isArray(bansA) ? bansA : []).map(getBanLabel).filter(Boolean),
    bansB: (Array.isArray(bansB) ? bansB : []).map(getBanLabel).filter(Boolean)
  }
}

const getTeamShort = (team, fallback) => clean(team?.shortName) || clean(team?.name) || fallback

const getTeamLogo = team => clean(team?.logo) || '/OW.svg'

const getSponsorSlots = project => (
  Array.isArray(project?.assets?.sponsors?.logos)
    ? project.assets.sponsors.logos
      .filter(slot => slot?.enabled !== false && (clean(slot?.logo) || clean(slot?.name)))
      .slice(0, 4)
    : []
)

const getPrimaryHeroLabel = player => {
  const heroId = Array.isArray(player?.primaryHeroes) ? player.primaryHeroes[0] : player?.primaryHero
  const hero = OW_HERO_BY_ID[heroId]
  return hero?.en || clean(heroId)
}

const getInterviewPayload = (project, settings) => {
  const interview = { ...DEFAULT_INTERVIEW_SETTINGS, ...(settings.interview || {}) }
  const { teamA, teamB } = getCurrentTeams(project)
  const teamSide = interview.teamSide === 'B' ? 'B' : 'A'
  const team = teamSide === 'B' ? teamB : teamA
  const players = getStartingPlayers(project, teamSide === 'B' ? 'teamB' : 'teamA')
  const playerSlot = interview.playerSlot === 0 || interview.playerSlot ? Number(interview.playerSlot) : -1
  const player = playerSlot >= 0 ? players[playerSlot] : null
  const teamShort = getTeamShort(team, `Team ${teamSide}`)
  const speakerMode = clean(interview.speakerMode) || 'PLAYER'
  const speakerName = clean(interview.manualSpeakerName) ||
    (speakerMode === 'TEAM'
      ? `${teamShort} Team`
      : speakerMode === 'REPRESENTATIVE'
        ? `${teamShort} Rep`
        : clean(player?.name) || 'Player')
  const speakerRole = clean(interview.manualSpeakerRole) ||
    (speakerMode === 'TEAM'
      ? 'Team Statement'
      : speakerMode === 'REPRESENTATIVE'
        ? 'Team Representative'
        : clean(player?.role) || 'Player')

  return {
    ...interview,
    team,
    teamSide,
    teamShort: clean(interview.manualTeamName) || teamShort,
    teamName: clean(team?.name) || teamShort,
    speakerName,
    speakerRole,
    hero: speakerMode === 'PLAYER' ? getPrimaryHeroLabel(player) : ''
  }
}

const getActivePeople = (project, settings, packageMode) => {
  const people = packageMode === 'STAFF' ? project?.staff || [] : project?.casters || []
  const explicitIds = packageMode === 'STAFF'
    ? settings?.staffIds
    : project?.currentMatch?.casters
  const hasExplicitIds = Array.isArray(explicitIds)
  const visibleIdSet = new Set(hasExplicitIds ? explicitIds : [])
  const selected = hasExplicitIds ? people.filter(person => visibleIdSet.has(person.id)) : []
  const maxPeople = packageMode === 'STAFF'
    ? (Number(settings?.staffSlotCapacity) === 8 ? 8 : 4)
    : 4

  return (hasExplicitIds ? selected : people)
    .map((person, index) => normalizePerson(person, index, packageMode))
    .filter(person => person.name || person.avatar)
    .slice(0, maxPeople)
}

export default function CastersScene({ project }) {
  const settings = project?.scenes?.settings?.casters || {}
  const match = project?.currentMatch || {}
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)
  const sponsorSlots = getSponsorSlots(project)
  const sponsorText = clean(project?.assets?.sponsors?.tickerText)
  const { teamA, teamB } = getCurrentTeams(project)
  const packageMode = settings.packageMode === 'STAFF' ? 'STAFF' : 'CASTERS'
  const casters = getActivePeople(project, settings, packageMode)
  const title = clean(settings.title) || (packageMode === 'STAFF' ? 'PRODUCTION STAFF' : 'BROADCAST TALENT')
  const subtitle = clean(settings.subtitle || project?.event?.subtitle) || (packageMode === 'STAFF' ? 'STAFF DESK' : 'CASTER DESK')
  const layoutMode = String(settings.layoutMode || 'AUTO').toUpperCase()
  const useGridLayout = layoutMode === 'GRID' || (layoutMode !== 'FEATURE' && casters.length >= 3) || casters.length > 2
  const showTitles = settings.showTitles !== false
  const showSocial = settings.showSocial !== false
  const showPortraits = settings.showPortraits !== false
  const showNumbers = settings.showNumbers !== false
  const deskNote = { ...DEFAULT_DESK_NOTE_SETTINGS, ...(settings.deskNote || {}) }
  const lowerThirdMode = packageMode === 'STAFF'
    ? ''
    : settings.interview?.visible === true
      ? 'interview'
      : deskNote.visible === true
        ? 'deskNote'
        : settings.showContext !== false
          ? 'context'
          : ''
  const showContext = lowerThirdMode === 'context'
  const showInterview = lowerThirdMode === 'interview'
  const showDeskNote = lowerThirdMode === 'deskNote'
  const layoutClass = useGridLayout ? styles.gridCards : styles.featureCards
  const currentMapLabel = getCurrentMapLabel(match)
  const { bansA, bansB } = getCurrentBans(match)
  const hasContextBans = bansA.length > 0 || bansB.length > 0
  const scoreLabel = `${match.score?.teamA ?? 0}:${match.score?.teamB ?? 0}`
  const teamALabel = getTeamShort(teamA, 'TMA')
  const teamBLabel = getTeamShort(teamB, 'TMB')
  const interview = getInterviewPayload(project, settings)
  const cardsClassName = [
    styles.cards,
    layoutClass,
    packageMode === 'STAFF' ? styles.staffCards : '',
    packageMode === 'STAFF' && casters.length <= 4 ? styles.staffFewCards : '',
    packageMode === 'STAFF' && casters.length === 4 ? styles.staffFourCards : '',
    showContext ? styles.cardsWithContext : '',
    showInterview ? styles.cardsWithInterview : '',
    showDeskNote ? styles.cardsWithDeskNote : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.scene}>
      <div className={styles.grid} />
      <div className={styles.diamondA} />
      <div className={styles.diamondB} />

      <header className={styles.topbar}>
        <div className={styles.interfaceLabel}>
          <span />
          <strong>{packageMode === 'STAFF' ? 'OWBT_STAFF_INTERFACE' : 'OWBT_CASTER_INTERFACE'}</strong>
        </div>
        <em>{packageMode === 'STAFF' ? 'STAFF_CARD // STABLE' : 'CASTER_CARD // STABLE'}</em>
      </header>

      <section className={styles.brandBlock}>
        <div className={styles.logoMark}>
          {settings.showEventLogo !== false && eventLogo ? (
            <img src={eventLogo} alt="" onError={imageFallback} />
          ) : (
            <strong>OW</strong>
          )}
        </div>
        <div>
          <p>{title}</p>
          <h1>{eventName}</h1>
          <span>{subtitle}</span>
        </div>
      </section>

      {settings.showSponsors !== false && sponsorSlots.length > 0 && (
        <aside className={styles.sponsorRail} aria-label="Event sponsors">
          <div className={styles.sponsorHeading}>
            <span>Supported By</span>
            {sponsorText && <strong>{sponsorText}</strong>}
          </div>
          <div className={styles.sponsorLogos}>
            {sponsorSlots.map((sponsor, index) => (
              <div className={styles.sponsorSlot} key={sponsor.id || `${sponsor.name}-${index}`}>
                {clean(sponsor.logo) && (
                  <img src={sponsor.logo} alt={clean(sponsor.name) || `Sponsor ${index + 1}`} />
                )}
                <strong>{clean(sponsor.name) || `Sponsor ${index + 1}`}</strong>
              </div>
            ))}
          </div>
        </aside>
      )}

      {showDeskNote && (
        <aside className={styles.deskNoteBox}>
          <span>Desk Note</span>
          <strong>{clean(deskNote.note) || 'MATCH DESK STANDBY'}</strong>
        </aside>
      )}

      {showContext && (
        <aside className={styles.matchContext}>
          <div className={styles.contextTitle}>Match Context</div>
          <div className={styles.contextTeams}>
            <div>
              <img src={getTeamLogo(teamA)} alt="" onError={imageFallback} />
              <span>{teamALabel}</span>
            </div>
            <strong>{scoreLabel}</strong>
            <div>
              <img src={getTeamLogo(teamB)} alt="" onError={imageFallback} />
              <span>{teamBLabel}</span>
            </div>
          </div>

          <div className={styles.contextMeta}>
            <div>
              <span>Map</span>
              <strong>{currentMapLabel}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>FT{match.ft || 3}</strong>
            </div>
          </div>

          {hasContextBans && (
            <div className={styles.contextBans}>
              <div>
                <span>{teamALabel} BAN</span>
                <strong>{bansA.length ? bansA.join(' / ') : 'None'}</strong>
              </div>
              <div>
                <span>{teamBLabel} BAN</span>
                <strong>{bansB.length ? bansB.join(' / ') : 'None'}</strong>
              </div>
            </div>
          )}
        </aside>
      )}

      <main className={cardsClassName}>
        {casters.length ? casters.map((caster, index) => (
          <article
            className={`${styles.casterCard} ${!showPortraits ? styles.noPortraitCard : ''}`}
            key={caster.id || index}
            style={{ '--card-index': index }}
          >
            {showNumbers && <div className={styles.number}>{String(index + 1).padStart(2, '0')}</div>}
            {showPortraits && (
              <div className={styles.portrait}>
                {caster.avatar ? (
                  <img src={caster.avatar} alt={caster.name} onError={imageFallback} />
                ) : (
                  <div className={styles.avatarFallback}>
                    <img src={eventLogo || '/OW.svg'} alt="" onError={imageFallback} />
                    <strong>{getInitials(caster.name)}</strong>
                  </div>
                )}
              </div>
            )}
            <div className={styles.casterInfo}>
              {showTitles && <span>{caster.title}</span>}
              <strong>{caster.name}</strong>
              {showSocial && <em>{caster.social || 'ON BROADCAST'}</em>}
            </div>
          </article>
        )) : (
          <div className={styles.emptyState}>
            <span />
            <strong>{packageMode === 'STAFF' ? 'No Staff Loaded' : 'No Casters Loaded'}</strong>
            <p>{packageMode === 'STAFF' ? 'Production crew standby.' : 'Broadcast talent standby.'}</p>
          </div>
        )}
      </main>

      {showInterview && (
        <section className={styles.interviewBox}>
          <div className={styles.interviewTeamBlock}>
            <span>{interview.subtitle || 'VOICE INTERVIEW'}</span>
            <strong>{interview.teamShort}</strong>
            <em>{interview.teamName}</em>
          </div>

          <div className={styles.interviewSpeakerBlock}>
            <div className={styles.interviewLogo}>
              <img src={getTeamLogo(interview.team)} alt="" onError={imageFallback} />
            </div>
            <div>
              <span>{interview.title || 'POST-MATCH INTERVIEW'}</span>
              <strong>{interview.speakerName}</strong>
              <p>
                {interview.speakerRole}
                {interview.hero ? ` // ${interview.hero}` : ''}
              </p>
            </div>
          </div>

          <div className={styles.interviewStatusBlock}>
            <span>Audio Status</span>
            <strong>{interview.status || 'VOICE CONNECTED'}</strong>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>{subtitle}</span>
      </footer>
    </div>
  )
}
