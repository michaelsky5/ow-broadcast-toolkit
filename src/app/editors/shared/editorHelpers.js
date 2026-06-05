import {
  OW_HEROES_BY_ROLE,
  OW_MAP_BY_ID,
  OW_MAP_OPTIONS,
  OW_MAPS_BY_MODE,
  OW_ROLE_BY_ID
} from '../../../data/overwatch'

const BAN_ROLE_OPTIONS = ['tank', 'damage', 'support']
const DEFAULT_BAN_ENTRY = 'damage/tbd'

const parseBanEntry = entry => {
  const raw = Array.isArray(entry) ? entry[0] : entry
  const text = String(raw || DEFAULT_BAN_ENTRY).trim().toLowerCase()
  if (!text || !text.includes('/')) return { role: 'damage', hero: text || 'tbd' }

  const [role, hero] = text.split('/')

  return {
    role: BAN_ROLE_OPTIONS.includes(role) ? role : 'damage',
    hero: hero || 'tbd'
  }
}

const buildBanEntry = (role, hero) => `${role || 'damage'}/${hero || 'tbd'}`

const normalizeBanList = bans => (
  (Array.isArray(bans) ? bans : [])
    .filter(entry => {
      const parsed = parseBanEntry(entry)
      return parsed.hero && parsed.hero !== 'tbd'
    })
)

const getTeam = (project, side) => {
  const teamId = project.currentMatch?.[`${side}Id`]
  return project.teams.find(team => team.id === teamId) || null
}

const getSceneSettings = (project, sceneId) => project.scenes?.settings?.[sceneId] || {}

const ensureSceneSettings = (draft, sceneId) => {
  if (!draft.scenes.settings[sceneId]) draft.scenes.settings[sceneId] = {}
  return draft.scenes.settings[sceneId]
}

const getMapLabel = (map, language) => (
  language === 'en' ? `${map.en} / ${map.modeEn}` : `${map.zh} / ${map.modeZh}`
)

const getPlayerRoleLabel = (player, language) => {
  const role = OW_ROLE_BY_ID[player?.role]
  if (!role) return player?.role || '-'
  return language === 'en' ? role.shortEn : role.shortZh
}

const getHeroLabel = (hero, language) => (
  language === 'en' ? hero.en : hero.zh
)

const getModeLabel = (mode, language) => (
  language === 'en' ? mode.enLabel : mode.label
)

const normalizeModeId = value => {
  const raw = String(value || '').trim().toLowerCase()
  if (OW_MAPS_BY_MODE[raw]) return raw
  if (raw.includes('escort')) return 'escort'
  if (raw.includes('hybrid')) return 'hybrid'
  if (raw.includes('push')) return 'push'
  if (raw.includes('flashpoint')) return 'flashpoint'
  if (raw.includes('clash')) return 'clash'
  return 'control'
}

const getTeamLabel = (team, fallback) => {
  if (!team) return fallback
  return `${team.shortName || fallback} / ${team.name || fallback}`
}

const getSeriesMapCount = ft => {
  const value = Number(ft) || 3
  return value * 2 - 1
}

const isDrawMap = map => String(map?.winnerSide || map?.winner || '').trim().toUpperCase() === 'DRAW'

const getSeriesMapTotal = (ft, mapLineup) => {
  const baseTotal = getSeriesMapCount(ft)
  if (!Array.isArray(mapLineup) || !mapLineup.length) return baseTotal

  let total = baseTotal
  for (let index = 0; index < Math.min(mapLineup.length, total); index += 1) {
    if (isDrawMap(mapLineup[index])) total += 1
  }

  return total
}

const getMapEntryFromId = mapId => {
  const map = OW_MAP_BY_ID[mapId] || OW_MAP_OPTIONS[0]
  return {
    mapId: map?.id || '',
    type: map?.mode || 'control',
    name: map?.en || '',
    image: map?.image || '',
    picker: '',
    winner: '',
    winnerSide: '',
    attackSide: '',
    bansA: [],
    bansB: [],
    banOrderMode: 'A_FIRST'
  }
}

const getMapLineupEntry = (match, index) => {
  const fallbackMap = index === Math.max(0, Number(match.currentMapIndex || 1) - 1)
    ? getMapEntryFromId(match.currentMapId)
    : getMapEntryFromId(OW_MAP_OPTIONS[index % OW_MAP_OPTIONS.length]?.id)

  return {
    ...fallbackMap,
    ...(match.mapLineup?.[index] || {}),
    type: normalizeModeId(match.mapLineup?.[index]?.type || fallbackMap.type)
  }
}

const ensureMapLineup = draft => {
  if (!Array.isArray(draft.currentMatch.mapLineup)) draft.currentMatch.mapLineup = []
  const totalMaps = getSeriesMapTotal(draft.currentMatch.ft, draft.currentMatch.mapLineup)

  while (draft.currentMatch.mapLineup.length < totalMaps) {
    draft.currentMatch.mapLineup.push(getMapEntryFromId(OW_MAP_OPTIONS[draft.currentMatch.mapLineup.length % OW_MAP_OPTIONS.length]?.id))
  }

  draft.currentMatch.mapLineup = draft.currentMatch.mapLineup.slice(0, totalMaps)
  draft.currentMatch.currentMapIndex = Math.max(1, Math.min(totalMaps, Number(draft.currentMatch.currentMapIndex) || 1))
  return draft.currentMatch.mapLineup
}

const updateMapLineupEntry = (draft, index, patch) => {
  const lineup = ensureMapLineup(draft)
  lineup[index] = {
    ...getMapLineupEntry(draft.currentMatch, index),
    ...(lineup[index] || {}),
    ...patch
  }

  ensureMapLineup(draft)
}

const setCurrentMapIndex = (draft, index) => {
  const totalMaps = getSeriesMapTotal(draft.currentMatch.ft, draft.currentMatch.mapLineup)
  const nextIndex = Math.max(1, Math.min(totalMaps, Number(index) || 1))
  const entry = getMapLineupEntry(draft.currentMatch, nextIndex - 1)

  draft.currentMatch.currentMapIndex = nextIndex
  draft.currentMatch.currentRoundLabel = `MAP ${nextIndex}`
  if (entry.mapId) draft.currentMatch.currentMapId = entry.mapId
  draft.currentMatch.bansA = normalizeBanList(entry.bansA)
  draft.currentMatch.bansB = normalizeBanList(entry.bansB)
  draft.currentMatch.banOrderMode = entry.banOrderMode || 'A_FIRST'
  draft.currentMatch.hud = {
    ...(draft.currentMatch.hud || {}),
    showBanPhase: false
  }
}

const getTeamSideOptions = (project, text) => {
  const teamA = getTeam(project, 'teamA')
  const teamB = getTeam(project, 'teamB')

  return [
    { value: '', label: text.empty },
    { value: 'A', label: getTeamLabel(teamA, 'Team A') },
    { value: 'B', label: getTeamLabel(teamB, 'Team B') }
  ]
}

const getHeroOptionsByRole = role => OW_HEROES_BY_ROLE[role || 'damage'] || []

export {
  BAN_ROLE_OPTIONS,
  DEFAULT_BAN_ENTRY,
  parseBanEntry,
  buildBanEntry,
  normalizeBanList,
  getTeam,
  getSceneSettings,
  ensureSceneSettings,
  getMapLabel,
  getPlayerRoleLabel,
  getHeroLabel,
  getModeLabel,
  normalizeModeId,
  getTeamLabel,
  getSeriesMapCount,
  getSeriesMapTotal,
  isDrawMap,
  getMapEntryFromId,
  getMapLineupEntry,
  ensureMapLineup,
  updateMapLineupEntry,
  setCurrentMapIndex,
  getTeamSideOptions,
  getHeroOptionsByRole
}
