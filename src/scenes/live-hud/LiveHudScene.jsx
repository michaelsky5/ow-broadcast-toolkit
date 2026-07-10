import FriesMatchLiveHUD from '../legacy-fcol/FriesMatchLiveHUD'
import { OW_HERO_BY_ID, OW_MAP_BY_ID } from '../../data/overwatch'
import { getCurrentTeams, getStartingPlayers } from '../../project/projectUtils'
import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'

const clean = value => String(value || '').trim()
const DEFAULT_LOGO = '/OW.svg'
const DEFAULT_DARK = '#2A2A2A'

const isHexColor = value => /^#[0-9a-f]{6}$/i.test(clean(value))
const getHudColor = (value, fallback) => (isHexColor(value) ? clean(value) : fallback)
const getHudPanelColor = value => {
  const color = clean(value).toLowerCase()
  if (color === '#000000' || color === '#050505') return DEFAULT_DARK
  return getHudColor(value, DEFAULT_DARK)
}
const getHudNumber = (value, fallback, min, max) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

const getSeriesMapCount = ft => {
  const value = Number(ft) || 3
  return value * 2 - 1
}

const isDrawMap = map => String(map?.winnerSide || map?.winner || '').trim().toUpperCase() === 'DRAW'

const getSeriesMapTotal = match => {
  const baseTotal = getSeriesMapCount(match?.ft)
  const lineup = match?.mapLineup
  if (!Array.isArray(lineup) || !lineup.length) return baseTotal

  let total = baseTotal
  for (let index = 0; index < Math.min(lineup.length, total); index += 1) {
    if (isDrawMap(lineup[index])) total += 1
  }

  return total
}

const getTeamLogo = team => clean(team?.logo) || DEFAULT_LOGO

const getPlayerName = player => clean(player?.name) || '-'

const getRosterPlayer = player => {
  const heroId = player?.primaryHeroes?.[0]
  const hero = heroId ? OW_HERO_BY_ID[heroId] : null

  return {
    id: player?.id,
    nickname: getPlayerName(player),
    name: getPlayerName(player),
    battleTag: clean(player?.battleTag),
    role: player?.role || '',
    hero: hero?.id || ''
  }
}

const getAttackSide = match => {
  if (match?.side?.teamA === 'attack') return 'A'
  if (match?.side?.teamB === 'attack') return 'B'
  return ''
}

const getCompactRecordLabel = (hud, suffix) => {
  const win = clean(hud?.[`teamRecord${suffix}W`])
  const loss = clean(hud?.[`teamRecord${suffix}L`])
  if (win || loss) return `${win || 0}-${loss || 0}`

  const value = hud?.[`teamRecord${suffix}`]
  const text = clean(value).replace(/\s+/g, '')
  const match = text.match(/^(\d+)W?[-/]*(\d+)L?$/i)
  return match ? `${match[1]}-${match[2]}` : clean(value)
}

const getSeedLabel = value => {
  const seed = clean(value)
  if (!seed) return ''
  if (seed.startsWith('#')) {
    const rawSeed = seed.slice(1)
    const normalizedRawSeed = /^\d+$/.test(rawSeed) ? String(Number(rawSeed)) : rawSeed
    return `#${normalizedRawSeed}`.toUpperCase()
  }

  const seedMatch = seed.match(/^seed\s*#?\s*(.+)$/i)
  const seedValue = seedMatch ? seedMatch[1] : seed
  const normalizedSeed = /^\d+$/.test(seedValue) ? String(Number(seedValue)) : seedValue
  return `#${normalizedSeed}`.toUpperCase()
}

const getTeamMetaLabel = (hud, side) => {
  const suffix = side === 'B' ? 'B' : 'A'
  const mode = String(hud?.teamMetaMode || 'HIDDEN').toUpperCase()

  if (mode === 'RECORD') return getCompactRecordLabel(hud, suffix)
  if (mode === 'CUSTOM') return clean(hud?.[`teamMeta${suffix}`])

  if (mode === 'SEED') {
    return getSeedLabel(hud?.[`teamSeed${suffix}`])
  }

  return ''
}

const getLegacyMapLineup = match => {
  const totalMaps = getSeriesMapTotal(match)
  const currentMap = OW_MAP_BY_ID[match?.currentMapId]

  if (Array.isArray(match?.mapLineup) && match.mapLineup.length) {
    return Array.from({ length: totalMaps }).map((_, index) => {
      const entry = match.mapLineup[index]
      const source = OW_MAP_BY_ID[entry?.mapId || entry?.id] || null

      return {
        type: clean(entry?.type || source?.modeKey || source?.mode || 'CONTROL').toUpperCase(),
        name: clean(entry?.name || source?.en) || '',
        attackSide: clean(entry?.attackSide || getAttackSide(match)),
        winner: clean(entry?.winner),
        winnerSide: clean(entry?.winnerSide || entry?.winner),
        bansA: entry?.bansA || [],
        bansB: entry?.bansB || [],
        banOrderMode: entry?.banOrderMode || 'A_FIRST'
      }
    })
  }

  const lineup = Array.from({ length: totalMaps }).map(() => ({
    type: 'CONTROL',
    name: '',
    winner: '',
    winnerSide: '',
    attackSide: '',
    bansA: [],
    bansB: [],
    banOrderMode: 'A_FIRST'
  }))

  const index = Math.max(0, Math.min(totalMaps - 1, (Number(match?.currentMapIndex) || 1) - 1))
  lineup[index] = {
    type: clean(currentMap?.modeKey || currentMap?.mode || 'CONTROL').toUpperCase(),
    name: clean(currentMap?.en || match?.currentMapId) || 'TBD',
    attackSide: getAttackSide(match),
    winner: '',
    winnerSide: '',
    bansA: [],
    bansB: [],
    banOrderMode: 'A_FIRST'
  }

  return lineup
}

const buildLegacyMatchData = project => {
  const match = project?.currentMatch || {}
  const hud = match.hud || {}
  const { teamA, teamB } = getCurrentTeams(project)
  const playersA = getStartingPlayers(project, 'teamA')
  const playersB = getStartingPlayers(project, 'teamB')
  const uiMode = hud.uiMode === 'TOURNAMENT' ? 'TOURNAMENT' : 'NORMAL'
  const teamMetaMode = String(hud.teamMetaMode || 'HIDDEN').toUpperCase()
  const hudMarginTop = Number(hud.hudMarginTop)
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)
  const matchFormat = `FT${Number(match.ft) || 3}`
  const sponsor = Array.isArray(project?.assets?.sponsors?.logos)
    ? project.assets.sponsors.logos.find(slot => slot?.enabled !== false && clean(slot?.logo))
    : null
  const sponsorLogo = clean(sponsor?.logo)

  return {
    uiMode,
    info: eventName,
    stingerLogo: eventLogo,
    matchFormat,
    topEventTitle: clean(hud.topEventTitle) || eventName,
    topEventLogo: clean(hud.topEventLogo) || eventLogo,
    topMatchFormatLabel: clean(hud.topMatchFormatLabel) || matchFormat,
    showTopEventLogo: hud.topEventLogoVisible !== false,
    showTopMatchFormat: hud.topMatchFormatVisible !== false,
    topSponsorLogo: sponsorLogo,
    topSponsorName: clean(sponsor?.name),
    showTopSponsor: hud.topSponsorVisible === true && Boolean(sponsorLogo),
    totalMaps: getSeriesMapTotal(match),
    pointsToWin: Number(match.ft) || 3,
    hudMarginTop: Number.isFinite(hudMarginTop) ? hudMarginTop : (uiMode === 'TOURNAMENT' ? 56 : 0),
    eventLogoBg: getHudColor(hud.eventLogoBg, DEFAULT_DARK),
    teamNameFontSize: getHudNumber(hud.teamNameFontSize, 20, 14, 28),
    playerNameFontSize: getHudNumber(hud.playerNameFontSize, 12, 9, 16),
    beginInfoEnabled: Boolean(hud.beginInfoEnabled),
    autoBeginTriggerAt: hud.autoBeginTriggerAt || 0,
    keyPlayerTriggerAt: hud.keyPlayerTriggerAt || 0,
    keyPlayerSide: hud.keyPlayerSide || 'A',
    keyPlayerName: hud.keyPlayerName || '',
    showBanPhase: Boolean(hud.showBanPhase),
    heroBanTriggerAt: hud.heroBanTriggerAt || 0,
    showBans: Boolean(hud.showBans),
    showPlayers: hud.showPlayers !== false,
    showTicker: Boolean(hud.showTicker),
    tickerMode: hud.tickerMode || 'ONCE',
    tickerText: hud.tickerText || '',
    activeComms: hud.activeComms || '',
    teamA: clean(teamA?.name) || 'Team A',
    teamB: clean(teamB?.name) || 'Team B',
    teamShortA: clean(teamA?.shortName) || 'TMA',
    teamShortB: clean(teamB?.shortName) || 'TMB',
    teamMetaMode,
    teamMetaA: getTeamMetaLabel(hud, 'A'),
    teamMetaB: getTeamMetaLabel(hud, 'B'),
    logoA: getTeamLogo(teamA),
    logoB: getTeamLogo(teamB),
    logoBgA: getHudPanelColor(hud.teamLogoBgA),
    logoBgB: getHudPanelColor(hud.teamLogoBgB),
    scoreA: match.score?.teamA ?? 0,
    scoreB: match.score?.teamB ?? 0,
    bansA: match.bansA || [],
    bansB: match.bansB || [],
    banOrderMode: match.banOrderMode || 'A_FIRST',
    currentMap: Number(match.currentMapIndex) || 1,
    mapLineup: getLegacyMapLineup(match),
    playersA: Array.from({ length: 5 }).map((_, index) => getPlayerName(playersA[index])),
    playersB: Array.from({ length: 5 }).map((_, index) => getPlayerName(playersB[index])),
    rosterPlayersA: playersA.map(getRosterPlayer),
    rosterPlayersB: playersB.map(getRosterPlayer),
    subIndexA: Number.isFinite(Number(hud.subIndexA)) ? Number(hud.subIndexA) : -1,
    subIndexB: Number.isFinite(Number(hud.subIndexB)) ? Number(hud.subIndexB) : -1
  }
}

export default function LiveHudScene({ project }) {
  if (project?.currentMatch?.hud?.visible === false) {
    return <div style={{ width: '1920px', height: '1080px', background: 'transparent' }} />
  }

  return <FriesMatchLiveHUD matchData={buildLegacyMatchData(project)} isActive />
}
