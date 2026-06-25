import { ensureFriesCupEditionData } from './teamDirectoryCache'

const normalizeSide = side => String(side || '').toUpperCase() === 'B' ? 'B' : 'A'
const normalizeRole = role => {
  const value = String(role || '').trim().toLowerCase()
  if (['tank', 'damage', 'support'].includes(value)) return value
  if (value === 'dps') return 'damage'
  if (value === 'sup' || value === 'healer') return 'support'
  return 'damage'
}

const getStartingFiveForTeam = (players = []) => {
  const roleOrder = ['damage', 'damage', 'tank', 'support', 'support']
  const usedIds = new Set()
  const ordered = roleOrder
    .map(role => {
      const player = players.find(item => !usedIds.has(item.id) && normalizeRole(item.role) === role)
      if (player) usedIds.add(player.id)
      return player
    })
    .filter(Boolean)

  players.forEach(player => {
    if (!usedIds.has(player.id)) {
      ordered.push(player)
      usedIds.add(player.id)
    }
  })

  return ordered.slice(0, 5).map(player => player.id)
}

const assignIfAllowed = (target, field, value, overwriteExisting) => {
  if (value === undefined || value === null) return
  if (overwriteExisting || !target[field]) target[field] = value
}

const getLogoMeta = directoryTeam => ({
  ...(directoryTeam.logoResolution || directoryTeam.extras?.logoResolution || {}),
  resolvedUrl: directoryTeam.logo || directoryTeam.logoResolution?.resolvedUrl || ''
})

const toOwbtPlayer = (player, teamId) => ({
  id: player.id,
  name: player.name || player.displayName || player.nickname || player.battletag || player.sourcePlayerId,
  battleTag: player.battletag || '',
  role: normalizeRole(player.role),
  teamId,
  avatar: player.avatar || '',
  portraitXPct: 50,
  primaryHeroes: [],
  editionData: {
    friesCup: {
      source: player.source || 'fc-system-published',
      sourcePlayerId: player.sourcePlayerId || '',
      rank: player.rank || '',
      status: player.status || '',
      joinStage: player.joinStage || '',
      allowedFlex: player.allowedFlex ?? null,
      heroImage: player.heroImage || '',
      extras: player.extras || {}
    }
  }
})

export const applyPublishedTeamToProject = (project, directoryTeam, side, options = {}) => {
  if (!project || !directoryTeam?.id) return project

  const matchSide = normalizeSide(side)
  const sideKey = matchSide === 'B' ? 'teamB' : 'teamA'
  const overwriteExisting = options.overwriteExisting === true
  const friesCup = ensureFriesCupEditionData(project)
  const teamId = directoryTeam.id
  const players = Array.isArray(directoryTeam.players) ? directoryTeam.players : []
  const playerIds = players.map(player => player.id).filter(Boolean)
  const existingTeam = (project.teams || []).find(team => team.id === teamId)
  const manager = directoryTeam.extras?.manager || directoryTeam.staff?.find(item => item.role === 'manager')?.name || ''
  const coach = directoryTeam.extras?.coaches?.[0] || directoryTeam.staff?.find(item => item.role === 'coach')?.name || ''

  if (!project.teams) project.teams = []
  if (!project.players) project.players = []
  if (!project.currentMatch) project.currentMatch = {}
  if (!project.currentMatch.startingFive) project.currentMatch.startingFive = {}

  if (existingTeam) {
    assignIfAllowed(existingTeam, 'name', directoryTeam.name || '', overwriteExisting)
    assignIfAllowed(existingTeam, 'shortName', directoryTeam.shortName || '', overwriteExisting)
    assignIfAllowed(existingTeam, 'logo', directoryTeam.logo || '', overwriteExisting)
    assignIfAllowed(existingTeam, 'primaryColor', directoryTeam.primaryColor || '', overwriteExisting)
    assignIfAllowed(existingTeam, 'manager', manager, overwriteExisting)
    assignIfAllowed(existingTeam, 'coach', coach, overwriteExisting)
    existingTeam.playerIds = playerIds
    existingTeam.editionData = {
      ...(existingTeam.editionData || {}),
      friesCup: {
        source: directoryTeam.source || 'fc-system-published',
        sourceTeamId: directoryTeam.sourceTeamId || '',
        sourceUrl: directoryTeam.sourceUrl || '',
        updatedAt: directoryTeam.updatedAt || '',
        seasonId: directoryTeam.seasonId || '',
        version: directoryTeam.version || '',
        logo: getLogoMeta(directoryTeam),
        staff: directoryTeam.staff || [],
        extras: directoryTeam.extras || {}
      }
    }
  } else {
    project.teams.push({
      id: teamId,
      name: directoryTeam.name || directoryTeam.sourceTeamId || 'FriesCup Team',
      shortName: directoryTeam.shortName || '',
      logo: directoryTeam.logo || '',
      primaryColor: directoryTeam.primaryColor || '',
      description: '',
      coach,
      manager,
      playerIds,
      editionData: {
        friesCup: {
          source: directoryTeam.source || 'fc-system-published',
          sourceTeamId: directoryTeam.sourceTeamId || '',
          sourceUrl: directoryTeam.sourceUrl || '',
          updatedAt: directoryTeam.updatedAt || '',
          seasonId: directoryTeam.seasonId || '',
          version: directoryTeam.version || '',
          logo: getLogoMeta(directoryTeam),
          staff: directoryTeam.staff || [],
          extras: directoryTeam.extras || {}
        }
      }
    })
  }

  const existingPlayersById = new Map((project.players || []).map(player => [player.id, player]))
  players.forEach(player => {
    const existingPlayer = existingPlayersById.get(player.id)
    const nextPlayer = toOwbtPlayer(player, teamId)

    if (existingPlayer) {
      assignIfAllowed(existingPlayer, 'name', nextPlayer.name, overwriteExisting)
      assignIfAllowed(existingPlayer, 'battleTag', nextPlayer.battleTag, overwriteExisting)
      assignIfAllowed(existingPlayer, 'role', nextPlayer.role, overwriteExisting)
      assignIfAllowed(existingPlayer, 'avatar', nextPlayer.avatar, overwriteExisting)
      existingPlayer.teamId = teamId
      existingPlayer.editionData = nextPlayer.editionData
    } else {
      project.players.push(nextPlayer)
    }
  })

  project.currentMatch[`${sideKey}Id`] = teamId
  project.currentMatch.startingFive[sideKey] = getStartingFiveForTeam(
    playerIds.map(playerId => project.players.find(player => player.id === playerId)).filter(Boolean)
  )

  friesCup.appliedTeams[sideKey] = {
    teamId,
    sourceTeamId: directoryTeam.sourceTeamId || '',
    sourceUrl: directoryTeam.sourceUrl || '',
    appliedAt: new Date().toISOString(),
    overwriteExisting
  }

  return project
}
