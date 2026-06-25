import { applyFriesCupProjectDefaults } from '../defaultProject'

const clean = value => String(value || '').trim()
const normalizeRole = role => {
  const value = clean(role).toLowerCase()
  if (['tank', 'damage', 'support'].includes(value)) return value
  if (value === 'dps') return 'damage'
  if (value === 'sup' || value === 'healer') return 'support'
  return 'damage'
}

export const isLikelyLegacyFriesCupProject = payload => {
  const matchData = payload?.matchData || payload
  return Boolean(
    matchData?.teamA ||
    matchData?.teamB ||
    matchData?.rosterPlayersA ||
    matchData?.rosterPlayersB ||
    matchData?.rosterPresetLibrary
  )
}

const convertLegacyPlayer = (player, teamId, side, index) => ({
  id: `legacy-fc:${side}:player-${index + 1}`,
  name: clean(player?.nickname || player?.name || player?.displayName) || `Player ${index + 1}`,
  battleTag: clean(player?.battleTag || player?.battle_tag || player?.battletag),
  role: normalizeRole(player?.role),
  teamId,
  avatar: clean(player?.avatar || player?.heroImage || player?.portrait || player?.player_image),
  portraitXPct: 50,
  primaryHeroes: [clean(player?.hero)].filter(Boolean),
  editionData: {
    friesCup: {
      source: 'legacy-fc-project',
      extras: { raw: player || {} }
    }
  }
})

const convertLegacyTeam = (matchData, side) => {
  const suffix = side === 'A' ? 'A' : 'B'
  const teamId = `legacy-fc:team-${suffix.toLowerCase()}`
  const players = (Array.isArray(matchData?.[`rosterPlayers${suffix}`]) ? matchData[`rosterPlayers${suffix}`] : [])
    .map((player, index) => convertLegacyPlayer(player, teamId, suffix, index))
  const staff = matchData?.[`rosterStaff${suffix}`] || {}

  return {
    team: {
      id: teamId,
      name: clean(matchData?.[`team${suffix}`]) || `Team ${suffix}`,
      shortName: clean(matchData?.[`teamShort${suffix}`]) || `T${suffix}`,
      logo: clean(matchData?.[`logo${suffix}`]),
      primaryColor: '',
      description: '',
      coach: Array.isArray(staff.coaches) ? clean(staff.coaches[0]?.nickname || staff.coaches[0]?.name) : '',
      manager: clean(staff.manager?.nickname || staff.manager?.name || staff.manager),
      playerIds: players.map(player => player.id),
      editionData: {
        friesCup: {
          source: 'legacy-fc-project',
          staff,
          extras: {
            logoBg: matchData?.[`logoBg${suffix}`] || ''
          }
        }
      }
    },
    players
  }
}

export const convertLegacyFriesCupProject = (payload, baseProject) => {
  if (!isLikelyLegacyFriesCupProject(payload)) {
    return { project: null, warnings: [] }
  }

  const matchData = payload?.matchData || payload
  const next = applyFriesCupProjectDefaults(structuredClone(baseProject))
  const teamA = convertLegacyTeam(matchData, 'A')
  const teamB = convertLegacyTeam(matchData, 'B')
  const knownFields = new Set([
    'teamA',
    'teamB',
    'teamShortA',
    'teamShortB',
    'logoA',
    'logoB',
    'logoBgA',
    'logoBgB',
    'rosterPlayersA',
    'rosterPlayersB',
    'rosterStaffA',
    'rosterStaffB'
  ])
  const unknownMatchData = Object.entries(matchData || {}).reduce((extras, [key, value]) => {
    if (!knownFields.has(key)) extras[key] = value
    return extras
  }, {})

  next.teams = [teamA.team, teamB.team]
  next.players = [...teamA.players, ...teamB.players]
  next.currentMatch.teamAId = teamA.team.id
  next.currentMatch.teamBId = teamB.team.id
  next.currentMatch.startingFive.teamA = teamA.players.slice(0, 5).map(player => player.id)
  next.currentMatch.startingFive.teamB = teamB.players.slice(0, 5).map(player => player.id)
  next.editionData.friesCup.legacyExtras = {
    importedAt: new Date().toISOString(),
    warnings: ['LEGACY_FC_PARTIAL_IMPORT'],
    matchData: unknownMatchData,
    rawProject: payload
  }

  return {
    project: next,
    warnings: ['LEGACY_FC_PARTIAL_IMPORT']
  }
}

