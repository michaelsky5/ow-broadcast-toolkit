import {
  OW_DEFAULT_EVENT_MAP_POOL,
  OW_HERO_BY_ID,
  OW_MAP_BY_ID,
  OW_MAPS_BY_MODE
} from '../../data/overwatch'
import { getCurrentTeams } from '../../project/projectUtils'
import { getBroadcastCompetitionName } from '../../project/branding'
import styles from './CurrentMapScene.module.css'

const clean = value => String(value || '').trim()
const upper = value => clean(value).toUpperCase()

const getMapCount = match => {
  const base = (Number(match?.ft) || 3) * 2 - 1
  const draws = (match?.mapLineup || []).slice(0, base)
    .filter(entry => ['DRAW', 'TIE'].includes(upper(entry?.winnerSide || entry?.winner))).length
  return base + draws
}

const normalizeMap = entry => {
  const source = OW_MAP_BY_ID[entry?.mapId || entry?.id] || null
  return {
    id: entry?.mapId || entry?.id || source?.id,
    name: clean(entry?.name || source?.en) || 'TBD',
    image: clean(entry?.image || source?.image),
    mode: upper(entry?.type || source?.modeEn || source?.modeKey || source?.mode) || 'TBD',
    picker: upper(entry?.picker),
    winner: upper(entry?.winnerSide || entry?.winner),
    bansA: Array.isArray(entry?.bansA) ? entry.bansA : [],
    bansB: Array.isArray(entry?.bansB) ? entry.bansB : [],
    banOrderMode: upper(entry?.banOrderMode)
  }
}

const getBanHero = entry => {
  const raw = clean(Array.isArray(entry) ? entry[0] : entry).toLowerCase()
  const heroId = raw.includes('/') ? raw.split('/')[1] : raw
  if (!heroId || heroId === 'tbd') return null
  const hero = OW_HERO_BY_ID[heroId]
  return {
    id: heroId,
    icon: hero?.icon || '/OW.svg'
  }
}

const getTeamTag = (side, teams) => {
  if (side === 'DRAW') return 'DRAW'
  const team = side === 'A' ? teams.teamA : side === 'B' ? teams.teamB : null
  return clean(team?.shortName || team?.name).toUpperCase()
}

const imageAssetFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = '/OW.svg'
}

function BanCard({ tag, ban, order, alignRight = false }) {
  return (
    <div className={`${styles.banChip} ${alignRight ? styles.banChipRight : ''}`}>
      <div className={styles.banHeroIcon}>
        <img src={ban.icon} alt="" onError={imageAssetFallback} />
        <strong>{order}</strong>
      </div>
      <div className={styles.banTeam}>
        <span>{tag}</span>
      </div>
    </div>
  )
}

const getLineup = match => {
  const count = getMapCount(match)
  const lineup = Array.isArray(match?.mapLineup) ? match.mapLineup : []
  return Array.from({ length: count }, (_, index) => {
    const entry = lineup[index]
    if (entry) return normalizeMap(entry)
    if (index === Math.max(0, (Number(match?.currentMapIndex) || 1) - 1)) {
      return normalizeMap({ mapId: match?.currentMapId })
    }
    return normalizeMap(null)
  })
}

const getPool = settings => Object.entries(OW_MAPS_BY_MODE).map(([modeId, maps]) => {
  const configured = settings?.eventMapPool?.[modeId]
  const ids = Array.isArray(configured) && configured.length
    ? configured
    : OW_DEFAULT_EVENT_MAP_POOL[modeId] || []
  return {
    id: modeId,
    enabled: settings?.enabledMapTypes?.[modeId] !== false,
    label: upper(maps[0]?.modeEn || maps[0]?.modeKey || modeId),
    maps: ids.map(id => OW_MAP_BY_ID[id]).filter(Boolean)
  }
}).filter(group => group.enabled)

const imageFallback = event => {
  event.currentTarget.style.display = 'none'
}

function MapCard({ map, index, currentIndex, teams, match, metaDisplayMode, banDisplayMode }) {
  const completed = index < currentIndex
  const current = index === currentIndex
  const future = index > currentIndex
  const winnerTag = getTeamTag(map.winner, teams)
  const pickerTag = getTeamTag(map.picker, teams)
  const showWinner = metaDisplayMode !== 'CLEAN' && completed && Boolean(winnerTag)
  const showPicker = metaDisplayMode === 'FULL' && current && Boolean(pickerTag)
  const status = completed ? 'COMPLETED' : current ? 'UP NEXT' : 'TBD'
  const emptyStateLabel = current ? 'AWAITING MAP SELECTION' : 'MAP TBD'
  const hasOwnBans = map.bansA.length > 0 || map.bansB.length > 0
  const banA = getBanHero(hasOwnBans ? map.bansA : current ? match.bansA : [])
  const banB = getBanHero(hasOwnBans ? map.bansB : current ? match.bansB : [])
  const showBans = banDisplayMode === 'SHOW' && map.id && (completed || current) && (banA || banB)
  const banOrderMode = map.banOrderMode || upper(match.banOrderMode) || 'A_FIRST'
  const orderA = banOrderMode === 'B_FIRST' ? '2ND' : '1ST'
  const orderB = banOrderMode === 'B_FIRST' ? '1ST' : '2ND'
  const teamATag = getTeamTag('A', teams) || 'TEAM A'
  const teamBTag = getTeamTag('B', teams) || 'TEAM B'
  const decisionSide = showWinner ? map.winner : showPicker ? map.picker : ''
  const decisionTeam = decisionSide === 'A' ? teams.teamA : decisionSide === 'B' ? teams.teamB : null
  const decisionTag = showWinner ? winnerTag : showPicker ? pickerTag : ''
  const decisionColor = clean(decisionTeam?.primaryColor) || 'var(--theme-primary)'
  const decisionLogo = decisionTeam ? clean(decisionTeam.logo) || '/OW.svg' : ''
  const footerStatus = completed
    ? winnerTag ? 'RESULT CONFIRMED' : 'MAP COMPLETE'
    : current
      ? map.id ? 'NEXT MAP' : 'AWAITING MAP PICK'
      : ''

  return (
    <article className={[
      styles.mapCard,
      current ? styles.currentCard : '',
      completed ? styles.completedCard : '',
      future ? styles.futureCard : '',
      map.id ? '' : styles.emptyCard
    ].filter(Boolean).join(' ')}>
      <div className={styles.cardStatus}><span>{String(index + 1).padStart(2, '0')}</span><strong>{status}</strong></div>
      <div className={styles.mapVisual}>
        {map.image && <img src={map.image} alt="" onError={imageFallback} />}
        {!map.id && (
          <div className={styles.emptyMark}>
            <span />
            <strong>{emptyStateLabel}</strong>
            <em>{current ? 'READY FOR MAP PICK' : `SEQUENCE SLOT ${String(index + 1).padStart(2, '0')}`}</em>
          </div>
        )}
        {(showWinner || showPicker) && (
          <div
            className={`${styles.decisionBadge} ${decisionTeam ? styles.decisionBadgeWithLogo : ''} ${showPicker ? styles.pickBadge : ''} ${decisionTag === 'DRAW' ? styles.drawBadge : ''}`}
            style={{ '--decision-color': decisionColor }}
          >
            {decisionTeam && (
              <div className={styles.decisionLogo}>
                <img src={decisionLogo} alt="" onError={imageAssetFallback} />
              </div>
            )}
            <div className={styles.decisionCopy}>
              <span>{decisionTag === 'DRAW' ? 'MAP RESULT' : showWinner ? 'MAP WINNER' : 'MAP PICK'}</span>
              <strong>{decisionTag}</strong>
            </div>
          </div>
        )}
        {showBans && (
          <div className={styles.banRail}>
            {banA && <BanCard tag={teamATag} ban={banA} order={orderA} />}
            {banB && <BanCard tag={teamBTag} ban={banB} order={orderB} alignRight />}
          </div>
        )}
        <div className={styles.visualShade} />
      </div>
      <div className={styles.cardCopy}>
        <span>{map.id ? map.mode : 'NOT SET'} // MAP {index + 1}</span>
        <strong>{map.id ? map.name : current ? 'SELECTING' : 'TBD'}</strong>
        {footerStatus && <em>{footerStatus}</em>}
      </div>
    </article>
  )
}

function MatchSequence({ match, teams, settings }) {
  const lineup = getLineup(match)
  const currentIndex = Math.max(0, Math.min(lineup.length - 1, (Number(match.currentMapIndex) || 1) - 1))
  const visibleLineup = lineup.slice(0, 7)
  const metaDisplayMode = upper(settings.mapMetaDisplayMode) || 'RESULT'
  const banDisplayMode = upper(settings.mapBanDisplayMode) || 'HIDE'
  return (
    <div
      className={`${styles.sequence} ${visibleLineup.length <= 3 ? styles.featureSequence : styles.compactSequence} ${visibleLineup.length === 1 ? styles.singleSequence : ''} ${visibleLineup.length >= 7 ? styles.denseSequence : ''}`}
      style={{ '--map-count': visibleLineup.length }}
    >
      {visibleLineup.map((map, index) => (
        <MapCard
          key={`${map.id || 'tbd'}-${index}`}
          map={map}
          index={index}
          currentIndex={currentIndex}
          teams={teams}
          match={match}
          metaDisplayMode={metaDisplayMode}
          banDisplayMode={banDisplayMode}
        />
      ))}
    </div>
  )
}

function MapPool({ settings, match }) {
  const groups = getPool(settings)
  const currentIndex = Math.max(0, (Number(match?.currentMapIndex) || 1) - 1)
  const lineup = Array.isArray(match?.mapLineup) ? match.mapLineup : []
  const currentEntry = lineup[currentIndex] || null
  const currentMapId = clean(currentEntry?.mapId || currentEntry?.id || match?.currentMapId)
  const currentMapName = upper(currentEntry?.name || OW_MAP_BY_ID[currentMapId]?.en)
  const playedEntries = lineup.slice(0, currentIndex)
  const playedMapIds = new Set(playedEntries.map(entry => clean(entry?.mapId || entry?.id)).filter(Boolean))
  const playedMapNames = new Set(playedEntries.map(entry => {
    const source = OW_MAP_BY_ID[entry?.mapId || entry?.id]
    return upper(entry?.name || source?.en)
  }).filter(Boolean))
  const showCurrent = Boolean(settings.showOverviewCurrent && (currentMapId || currentMapName))

  return (
    <div
      className={styles.poolGrid}
      style={{ '--pool-group-count': Math.max(1, groups.length) }}
    >
      {groups.map(group => (
        <section
          className={styles.poolGroup}
          key={group.id}
          style={{ '--pool-map-count': Math.max(1, group.maps.length) }}
        >
          <header><span /> <strong>{group.label}</strong><em>{group.maps.length} MAPS</em></header>
          <div>
            {group.maps.map((map, index) => {
              const isCurrent = showCurrent && (
                map.id === currentMapId || (!currentMapId && upper(map.en) === currentMapName)
              )
              const isPlayed = !isCurrent && (
                playedMapIds.has(map.id) || playedMapNames.has(upper(map.en))
              )

              return (
                <article
                  className={[
                    isCurrent ? styles.currentPoolMap : '',
                    isPlayed ? styles.playedPoolMap : ''
                  ].filter(Boolean).join(' ')}
                  key={`${map.id}-${index}`}
                  style={{ '--pool-image': `url("${map.image}")` }}
                  aria-current={isCurrent ? 'true' : undefined}
                  data-map-state={isCurrent ? 'current' : isPlayed ? 'played' : 'available'}
                >
                  {isCurrent && <em>UP NEXT</em>}
                  <span>{map.en}</span>
                  {isPlayed && <small>PLAYED</small>}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function CurrentMapScene({ project }) {
  const match = project?.currentMatch || {}
  const settings = project?.scenes?.settings?.['current-map'] || {}
  const teams = getCurrentTeams(project)
  const poolMode = upper(settings.displayMode || settings.mapPoolDisplayMode) === 'OVERVIEW'
  const competition = getBroadcastCompetitionName(project)

  return (
    <div className={styles.scene}>
      <div className={styles.atmosphere} />
      <div className={styles.grid} />
      <div className={styles.glow} />
      <div className={styles.diamondA} />
      <div className={styles.diamondB} />
      <div className={`${styles.techNumber} ${styles.techNumberA}`}>01</div>
      <div className={`${styles.techNumber} ${styles.techNumberB}`}>02</div>
      <header className={styles.topbar}>
        <div><span /> <strong>OWBT_MAP_INTERFACE</strong></div>
        <em>{poolMode ? 'MAP_POOL' : 'MATCH_SEQUENCE'} // STABLE</em>
      </header>
      <main className={`${styles.main} ${poolMode ? styles.poolMain : ''}`}>
        <section className={`${styles.heading} ${poolMode ? styles.poolHeading : ''}`}>
          <div>
            <span>{poolMode ? 'COMPETITION MAP MATRIX' : 'MATCH MAP SEQUENCE'}</span>
            <h1>{competition}</h1>
            <p>{poolMode ? 'OFFICIAL MAP POOL' : clean(project?.event?.subtitle || match.stage) || 'Broadcast Toolkit'}</p>
          </div>
          <aside className={styles.formatLockup}>
            <div className={styles.formatMeta}>
              <span />
              <div>
                <strong>MATCH FORMAT</strong>
                <em>FIRST TO</em>
              </div>
            </div>
            <div className={styles.formatValue}>
              <strong>FT{Number(match.ft) || 3}</strong>
            </div>
          </aside>
        </section>
        {poolMode ? <MapPool settings={settings} match={match} /> : <MatchSequence match={match} teams={teams} settings={settings} />}
      </main>
      <footer><span>OWBT // MAP CONTROL</span><em>{poolMode ? 'OFFICIAL MAP POOL' : 'LIVE MATCH DATA'}</em></footer>
    </div>
  )
}
