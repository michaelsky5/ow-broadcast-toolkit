import FriesMapPoolScene from '../legacy-fcol/FriesMapPoolScene'
import { OW_MAP_BY_ID, OW_MAPS_BY_MODE } from '../../data/overwatch'
import { getCurrentTeams } from '../../project/projectUtils'
import { getBroadcastCompetitionName } from '../../project/branding'

const clean = value => String(value || '').trim()

const getLegacyMode = map => clean(map?.modeKey || map?.mode || 'CONTROL').toUpperCase()

const getLegacyPicker = value => {
  const raw = clean(value).toUpperCase()
  if (raw === 'TEAMA' || raw === 'TEAM_A') return 'A'
  if (raw === 'TEAMB' || raw === 'TEAM_B') return 'B'
  if (raw === 'DRAW' || raw === 'TIE') return 'DRAW'
  if (raw === 'A' || raw === 'B') return raw
  return ''
}

const getSeriesMapCount = ft => {
  const value = Number(ft) || 3
  return value * 2 - 1
}

const isDrawMap = map => getLegacyPicker(map?.winnerSide || map?.winner) === 'DRAW'

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

const getCurrentMapEntry = match => {
  const currentMap = OW_MAP_BY_ID[match?.currentMapId]

  return {
    type: getLegacyMode(currentMap),
    name: clean(currentMap?.en || match?.currentMapId) || '',
    image: currentMap?.image || '',
    picker: getLegacyPicker(match?.picker),
    winner: '',
    winnerSide: ''
  }
}

const normalizeLegacyMapEntry = entry => {
  const source = OW_MAP_BY_ID[entry?.mapId || entry?.id] || null

  return {
    type: clean(entry?.type || source?.modeKey || source?.mode || 'CONTROL').toUpperCase(),
    name: clean(entry?.name || source?.en) || '',
    image: clean(entry?.image || source?.image),
    picker: getLegacyPicker(entry?.picker),
    winner: getLegacyPicker(entry?.winner),
    winnerSide: getLegacyPicker(entry?.winnerSide),
    bansA: Array.isArray(entry?.bansA) ? entry.bansA : [],
    bansB: Array.isArray(entry?.bansB) ? entry.bansB : [],
    banOrderMode: clean(entry?.banOrderMode) || 'A_FIRST',
    attackSide: getLegacyPicker(entry?.attackSide)
  }
}

const getLegacyMapLineup = match => {
  const totalMaps = getSeriesMapTotal(match)

  if (Array.isArray(match?.mapLineup) && match.mapLineup.length) {
    return Array.from({ length: totalMaps }).map((_, index) => (
      match.mapLineup[index]
        ? normalizeLegacyMapEntry(match.mapLineup[index])
        : { type: 'CONTROL', name: '', image: '', picker: '', winner: '' }
    ))
  }

  const lineup = Array.from({ length: totalMaps }).map(() => ({
    type: 'CONTROL',
    name: '',
    image: '',
    picker: '',
    winner: '',
    bansA: [],
    bansB: [],
    banOrderMode: 'A_FIRST'
  }))

  const index = Math.max(0, Math.min(totalMaps - 1, (Number(match?.currentMapIndex) || 1) - 1))
  lineup[index] = getCurrentMapEntry(match)

  return lineup
}

const getEventMapPool = settings => (
  Object.fromEntries(
    Object.entries(OW_MAPS_BY_MODE).map(([modeId, maps]) => {
      const configuredPool = settings?.eventMapPool?.[modeId]
      const mapIds = Array.isArray(configuredPool) && configuredPool.length
        ? configuredPool
        : maps.map(map => map.id)

      return [
        getLegacyMode(maps[0]),
        mapIds
          .map(mapId => OW_MAP_BY_ID[mapId])
          .filter(Boolean)
          .map(map => ({
            name: map.en,
            image: map.image,
            type: getLegacyMode(map)
          }))
      ]
    })
  )
)

const getEnabledMapTypes = settings => (
  Object.fromEntries(
    Object.entries(OW_MAPS_BY_MODE).map(([modeId, maps]) => [
      getLegacyMode(maps[0]),
      settings?.enabledMapTypes?.[modeId] !== false
    ])
  )
)

const buildLegacyMatchData = project => {
  const match = project?.currentMatch || {}
  const { teamA, teamB } = getCurrentTeams(project)
  const settings = project?.scenes?.settings?.['current-map'] || {}

  return {
    eventName: getBroadcastCompetitionName(project),
    mapPoolDisplayMode: clean(settings.displayMode || settings.mapPoolDisplayMode) || 'MATCH',
    mapMetaDisplayMode: clean(settings.mapMetaDisplayMode) || 'RESULT',
    mapBanDisplayMode: clean(settings.mapBanDisplayMode) || 'HIDE',
    showOverviewCurrent: Boolean(settings.showOverviewCurrent),
    info: clean(project?.event?.subtitle || match.stage) || 'Broadcast Toolkit',
    matchFormat: `FT${Number(match.ft) || 3}`,
    totalMaps: getSeriesMapTotal(match),
    currentMap: Number(match.currentMapIndex) || 1,
    mapLineup: getLegacyMapLineup(match),
    eventMapPool: getEventMapPool(settings),
    enabledMapTypes: getEnabledMapTypes(settings),
    teamA: clean(teamA?.name) || 'Team A',
    teamB: clean(teamB?.name) || 'Team B',
    teamShortA: clean(teamA?.shortName) || 'TMA',
    teamShortB: clean(teamB?.shortName) || 'TMB',
    scoreA: match.score?.teamA ?? 0,
    scoreB: match.score?.teamB ?? 0,
    bansA: match.bansA || [],
    bansB: match.bansB || [],
    banOrderMode: match.banOrderMode || 'A_FIRST',
    showBans: clean(settings.mapBanDisplayMode) === 'SHOW'
  }
}

export default function CurrentMapScene({ project }) {
  return <FriesMapPoolScene matchData={buildLegacyMatchData(project)} />
}
