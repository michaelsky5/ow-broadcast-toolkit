import { ensureFriesCupEditionData } from './teamDirectoryCache'

const FC_SYSTEM_SOURCE = 'fc-system'

const clean = value => String(value || '').trim()
const normalizeKey = value => clean(value).toUpperCase()
const uniq = values => [...new Set(values.map(clean).filter(Boolean))]

const normalizeRole = role => {
  const value = clean(role).toLowerCase()
  if (value === 'dps' || value === 'attack') return 'damage'
  if (value === 'sup' || value === 'healer') return 'support'
  if (['tank', 'damage', 'support'].includes(value)) return value
  return value || 'damage'
}

const clone = value => {
  if (value === undefined) return undefined
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value))
  }
}

const getTeamSourceId = team => clean(
  team?.sourceTeamId ||
  team?.editionData?.friesCup?.sourceTeamId ||
  team?.editionData?.friesCup?.source?.sourceTeamId
)

const getPlayerSourceId = player => clean(
  player?.sourcePlayerId ||
  player?.editionData?.friesCup?.sourcePlayerId ||
  player?.editionData?.friesCup?.source?.sourcePlayerId
)

const getTeamShortKey = team => normalizeKey(team?.shortName || team?.team_short_name || team?.teamShortName)
const getTeamNameKey = team => normalizeKey(team?.name || team?.team_name || team?.teamName)
const getTeamMatchKeys = team => uniq([
  team?.id,
  getTeamSourceId(team),
  getTeamShortKey(team),
  getTeamNameKey(team)
]).map(normalizeKey)

const isFriesCupSystemTeam = team => (
  team?.source === FC_SYSTEM_SOURCE ||
  clean(team?.editionData?.friesCup?.source).startsWith('fc-system') ||
  Boolean(getTeamSourceId(team))
)

const isFriesCupSystemPlayer = player => (
  player?.source === FC_SYSTEM_SOURCE ||
  clean(player?.editionData?.friesCup?.source).startsWith('fc-system') ||
  Boolean(getPlayerSourceId(player))
)

const getManager = team => (
  clean(team?.extras?.manager) ||
  clean((team?.staff || []).find(item => item.role === 'manager')?.name)
)

const getCoach = team => (
  clean(team?.extras?.coaches?.[0]) ||
  clean((team?.staff || []).find(item => item.role === 'coach')?.name)
)

const getTeamLogoMeta = team => team?.editionData?.friesCup?.logo || {}

const shouldPreserveManualLogo = (target, source) => {
  const currentLogo = clean(target?.logo)
  const nextLogo = clean(source?.logo)
  const previousAutoLogo = clean(getTeamLogoMeta(target).resolvedUrl || getTeamLogoMeta(target).autoUrl)

  if (!currentLogo) return false
  if (currentLogo === nextLogo) return false
  if (previousAutoLogo && currentLogo === previousAutoLogo) return false

  return true
}

const getProjectLogoMeta = (team, logo) => {
  const resolution = team.logoResolution || team.extras?.logoResolution || {}

  return {
    status: resolution.status || (logo ? 'explicit' : 'missing'),
    source: resolution.source || '',
    key: resolution.key || '',
    filename: resolution.filename || '',
    fallbackKey: resolution.fallbackKey || '',
    resolvedUrl: logo || resolution.resolvedUrl || '',
    matchedBy: resolution.matchedBy || '',
    matchedValue: resolution.matchedValue || '',
    explicitLogo: resolution.explicitLogo || '',
    candidates: clone(resolution.candidates || [])
  }
}

const getManualLogoOverride = team => {
  const logo = clean(team?.logo)
  if (!logo) return null

  const logoMeta = getTeamLogoMeta(team)
  const previousAutoLogo = clean(logoMeta.autoUrl || logoMeta.resolvedUrl)
  const isManual = (
    logoMeta.status === 'manual' ||
    logoMeta.manualOverride === true ||
    (previousAutoLogo && logo !== previousAutoLogo)
  )

  return isManual
    ? {
        manualUrl: logo,
        autoUrl: previousAutoLogo,
        status: 'manual',
        manualOverride: true
      }
    : null
}

const collectManualLogoOverrides = teams => (teams || []).reduce((overrides, team) => {
  const override = getManualLogoOverride(team)
  if (!override) return overrides

  getTeamMatchKeys(team).forEach(key => {
    if (!overrides.has(key)) overrides.set(key, override)
  })

  return overrides
}, new Map())

const applyManualLogoOverride = (team, manualLogoOverrides) => {
  const override = getTeamMatchKeys(team)
    .map(key => manualLogoOverrides.get(key))
    .find(Boolean)

  if (!override) return team

  team.logo = override.manualUrl
  team.editionData.friesCup.logo = {
    ...(team.editionData.friesCup.logo || {}),
    ...override,
    resolvedUrl: override.manualUrl
  }

  return team
}

export const clearProjectFcSystemTeams = (project, options = {}) => {
  if (!project) return { deletedTeams: 0, deletedPlayers: 0, preservedActiveTeams: 0 }

  if (!Array.isArray(project.teams)) project.teams = []
  if (!Array.isArray(project.players)) project.players = []

  const preserveCurrentMatch = options.preserveCurrentMatch !== false
  const activeTeamIds = new Set(preserveCurrentMatch
    ? [project.currentMatch?.teamAId, project.currentMatch?.teamBId].map(clean).filter(Boolean)
    : [])
  const preservedTeamIds = new Set(project.teams
    .filter(team => isFriesCupSystemTeam(team) && activeTeamIds.has(team.id))
    .map(team => team.id))
  const removedTeamIds = new Set(project.teams
    .filter(team => isFriesCupSystemTeam(team) && !preservedTeamIds.has(team.id))
    .map(team => team.id))
  const removedPlayerIds = new Set(project.players
    .filter(player => isFriesCupSystemPlayer(player) && !preservedTeamIds.has(player.teamId))
    .map(player => player.id))

  project.teams = project.teams.filter(team => !removedTeamIds.has(team.id))
  project.players = project.players.filter(player => !removedPlayerIds.has(player.id))

  if (project.currentMatch?.startingFive) {
    project.currentMatch.startingFive.teamA = (project.currentMatch.startingFive.teamA || []).filter(id => !removedPlayerIds.has(id))
    project.currentMatch.startingFive.teamB = (project.currentMatch.startingFive.teamB || []).filter(id => !removedPlayerIds.has(id))
  }

  return {
    deletedTeams: removedTeamIds.size,
    deletedPlayers: removedPlayerIds.size,
    preservedActiveTeams: preservedTeamIds.size
  }
}

const toProjectPlayer = (player, team, context) => ({
  id: player.id,
  source: FC_SYSTEM_SOURCE,
  sourcePlayerId: player.sourcePlayerId || '',
  name: player.name || player.displayName || player.nickname || player.battletag || player.sourcePlayerId || 'FriesCup Player',
  battleTag: player.battletag || '',
  role: normalizeRole(player.role),
  teamId: team.id,
  avatar: player.avatar || '',
  portraitXPct: 50,
  primaryHeroes: [],
  stale: false,
  sourceUrl: context.sourceUrl || team.sourceUrl || '',
  seasonId: context.seasonId || team.seasonId || '',
  sourceVersion: context.version || team.version || '',
  updatedAt: team.updatedAt || context.updatedAt || '',
  editionData: {
    friesCup: {
      source: FC_SYSTEM_SOURCE,
      sourcePlayerId: player.sourcePlayerId || '',
      sourceTeamId: team.sourceTeamId || '',
      rank: player.rank || '',
      status: player.status || '',
      joinStage: player.joinStage || '',
      allowedFlex: player.allowedFlex ?? null,
      heroImage: player.heroImage || '',
      sourceUrl: context.sourceUrl || team.sourceUrl || '',
      seasonId: context.seasonId || team.seasonId || '',
      version: context.version || team.version || '',
      updatedAt: team.updatedAt || context.updatedAt || '',
      extras: clone(player.extras || {})
    }
  }
})

const toProjectTeam = (team, playerIds, context) => ({
  id: team.id,
  source: FC_SYSTEM_SOURCE,
  sourceTeamId: team.sourceTeamId || '',
  name: team.name || team.sourceTeamId || 'FriesCup Team',
  shortName: team.shortName || '',
  logo: team.logo || '',
  primaryColor: team.primaryColor || '',
  description: '',
  coach: getCoach(team),
  manager: getManager(team),
  playerIds,
  stale: false,
  sourceUrl: context.sourceUrl || team.sourceUrl || '',
  seasonId: context.seasonId || team.seasonId || '',
  sourceVersion: context.version || team.version || '',
  updatedAt: team.updatedAt || context.updatedAt || '',
  editionData: {
    friesCup: {
      source: FC_SYSTEM_SOURCE,
      sourceTeamId: team.sourceTeamId || '',
      sourceUrl: context.sourceUrl || team.sourceUrl || '',
      updatedAt: team.updatedAt || context.updatedAt || '',
      seasonId: context.seasonId || team.seasonId || '',
      version: context.version || team.version || '',
      logo: getProjectLogoMeta(team, team.logo || ''),
      staff: clone(team.staff || []),
      extras: clone(team.extras || {})
    }
  }
})

const updateProjectPlayer = (target, source) => {
  Object.assign(target, {
    source: FC_SYSTEM_SOURCE,
    sourcePlayerId: source.sourcePlayerId,
    name: source.name,
    battleTag: source.battleTag,
    role: source.role,
    teamId: source.teamId,
    avatar: source.avatar,
    portraitXPct: source.portraitXPct,
    primaryHeroes: source.primaryHeroes,
    stale: false,
    staleAt: '',
    sourceUrl: source.sourceUrl,
    seasonId: source.seasonId,
    sourceVersion: source.sourceVersion,
    updatedAt: source.updatedAt,
    editionData: source.editionData
  })
}

const updateProjectTeam = (target, source) => {
  const preserveManualLogo = shouldPreserveManualLogo(target, source)
  const manualLogo = preserveManualLogo ? target.logo : ''
  const nextEditionData = clone(source.editionData)

  if (preserveManualLogo) {
    nextEditionData.friesCup.logo = {
      ...(nextEditionData.friesCup.logo || {}),
      status: 'manual',
      manualOverride: true,
      manualUrl: manualLogo,
      autoUrl: source.logo || nextEditionData.friesCup.logo?.resolvedUrl || '',
      resolvedUrl: manualLogo
    }
  }

  Object.assign(target, {
    source: FC_SYSTEM_SOURCE,
    sourceTeamId: source.sourceTeamId,
    name: source.name,
    shortName: source.shortName,
    logo: preserveManualLogo ? manualLogo : source.logo,
    primaryColor: source.primaryColor,
    coach: source.coach,
    manager: source.manager,
    playerIds: source.playerIds,
    stale: false,
    staleAt: '',
    sourceUrl: source.sourceUrl,
    seasonId: source.seasonId,
    sourceVersion: source.sourceVersion,
    updatedAt: source.updatedAt,
    editionData: nextEditionData
  })
}

export const isProjectTeamFromFcSystem = isFriesCupSystemTeam
export const isProjectPlayerFromFcSystem = isFriesCupSystemPlayer

export const syncPublishedTeamsIntoProject = (project, directoryTeams = [], options = {}) => {
  if (!project) return { status: 'ERROR', createdTeams: 0, updatedTeams: 0, createdPlayers: 0, updatedPlayers: 0 }

  ensureFriesCupEditionData(project)
  if (!Array.isArray(project.teams)) project.teams = []
  if (!Array.isArray(project.players)) project.players = []

  const incomingTeams = Array.isArray(directoryTeams) ? directoryTeams.filter(team => team?.id) : []
  const manualLogoOverrides = collectManualLogoOverrides(project.teams.filter(isFriesCupSystemTeam))
  const context = {
    seasonId: clean(options.seasonId || options.fetchResult?.seasonId || options.directory?.seasonId),
    version: clean(options.version || options.fetchResult?.version || options.directory?.version),
    sourceUrl: clean(options.sourceUrl || options.fetchResult?.sourceUrl || options.directory?.sourceUrl),
    updatedAt: clean(options.updatedAt || options.fetchResult?.updatedAt || options.directory?.updatedAt)
  }
  const cleanupReport = clearProjectFcSystemTeams(project, { preserveCurrentMatch: true })
  const existingTeamById = new Map(project.teams.map(team => [team.id, team]))
  const existingTeamBySourceId = new Map(project.teams
    .filter(isFriesCupSystemTeam)
    .map(team => [getTeamSourceId(team), team])
    .filter(([sourceTeamId]) => sourceTeamId))
  const existingTeamByShortName = new Map(project.teams
    .filter(isFriesCupSystemTeam)
    .map(team => [getTeamShortKey(team), team])
    .filter(([shortName]) => shortName))
  const existingPlayerById = new Map(project.players.map(player => [player.id, player]))
  const existingPlayerBySourceId = new Map(project.players
    .filter(isFriesCupSystemPlayer)
    .map(player => [getPlayerSourceId(player), player])
    .filter(([sourcePlayerId]) => sourcePlayerId))
  const seenTeamIds = new Set()
  const seenSourceTeamIds = new Set()
  const seenPlayerIds = new Set()
  const seenSourcePlayerIds = new Set()
  const report = {
    status: 'READY',
    source: FC_SYSTEM_SOURCE,
    seasonId: context.seasonId,
    version: context.version,
    createdTeams: 0,
    updatedTeams: 0,
    deletedTeams: cleanupReport.deletedTeams,
    staleTeams: 0,
    createdPlayers: 0,
    updatedPlayers: 0,
    deletedPlayers: cleanupReport.deletedPlayers,
    stalePlayers: 0,
    preservedActiveTeams: cleanupReport.preservedActiveTeams,
    manualTeams: project.teams.filter(team => !isFriesCupSystemTeam(team)).length,
    manualPlayers: project.players.filter(player => !isFriesCupSystemPlayer(player)).length,
    teamCount: incomingTeams.length,
    playerCount: incomingTeams.reduce((sum, team) => sum + (team.players?.length || 0), 0),
    syncedAt: new Date().toISOString(),
    teamMappings: [],
    playerMappings: []
  }

  incomingTeams.forEach(directoryTeam => {
    const sourceTeamId = clean(directoryTeam.sourceTeamId)
    const directoryPlayers = Array.isArray(directoryTeam.players) ? directoryTeam.players.filter(player => player?.id) : []
    const playerIds = directoryPlayers.map(player => player.id)
    const nextTeam = applyManualLogoOverride(toProjectTeam(directoryTeam, playerIds, context), manualLogoOverrides)
    const shortNameKey = getTeamShortKey(nextTeam)
    const existingTeam = existingTeamById.get(nextTeam.id) || existingTeamBySourceId.get(sourceTeamId) || existingTeamByShortName.get(shortNameKey)
    let syncedTeam = nextTeam

    if (existingTeam && isFriesCupSystemTeam(existingTeam)) {
      updateProjectTeam(existingTeam, nextTeam)
      syncedTeam = existingTeam
      report.updatedTeams += 1
    } else if (!existingTeamById.has(nextTeam.id)) {
      project.teams.push(nextTeam)
      existingTeamById.set(nextTeam.id, nextTeam)
      report.createdTeams += 1
    } else {
      report.manualTeams += 1
      return
    }

    existingTeamById.set(syncedTeam.id, syncedTeam)
    if (syncedTeam.sourceTeamId) existingTeamBySourceId.set(syncedTeam.sourceTeamId, syncedTeam)
    if (getTeamShortKey(syncedTeam)) existingTeamByShortName.set(getTeamShortKey(syncedTeam), syncedTeam)

    seenTeamIds.add(syncedTeam.id)
    if (sourceTeamId) seenSourceTeamIds.add(sourceTeamId)
    report.teamMappings.push({
      teamId: syncedTeam.id,
      sourceTeamId,
      name: syncedTeam.name,
      shortName: syncedTeam.shortName,
      logo: syncedTeam.logo,
      logoStatus: syncedTeam.editionData?.friesCup?.logo?.status || '',
      logoKey: syncedTeam.editionData?.friesCup?.logo?.key || '',
      stale: false
    })

    directoryPlayers.forEach(directoryPlayer => {
      const nextPlayer = toProjectPlayer(directoryPlayer, syncedTeam, context)
      const sourcePlayerId = clean(directoryPlayer.sourcePlayerId)
      const existingPlayer = existingPlayerById.get(nextPlayer.id) || existingPlayerBySourceId.get(sourcePlayerId)

      if (existingPlayer && isFriesCupSystemPlayer(existingPlayer)) {
        updateProjectPlayer(existingPlayer, nextPlayer)
        report.updatedPlayers += 1
      } else if (!existingPlayerById.has(nextPlayer.id)) {
        project.players.push(nextPlayer)
        existingPlayerById.set(nextPlayer.id, nextPlayer)
        report.createdPlayers += 1
      } else {
        report.manualPlayers += 1
        return
      }

      seenPlayerIds.add(nextPlayer.id)
      if (sourcePlayerId) seenSourcePlayerIds.add(sourcePlayerId)
      existingPlayerById.set(nextPlayer.id, existingPlayer || nextPlayer)
      if (sourcePlayerId) existingPlayerBySourceId.set(sourcePlayerId, existingPlayer || nextPlayer)
      report.playerMappings.push({
        playerId: nextPlayer.id,
        sourcePlayerId,
        sourceTeamId,
        teamId: syncedTeam.id,
        name: nextPlayer.name,
        stale: false
      })
    })
  })

  project.teams.forEach(team => {
    if (!isFriesCupSystemTeam(team)) return
    const sourceTeamId = getTeamSourceId(team)
    if (seenTeamIds.has(team.id) || (sourceTeamId && seenSourceTeamIds.has(sourceTeamId))) return
    team.stale = true
    team.staleAt = report.syncedAt
    report.staleTeams += 1
  })

  project.players.forEach(player => {
    if (!isFriesCupSystemPlayer(player)) return
    const sourcePlayerId = getPlayerSourceId(player)
    if (seenPlayerIds.has(player.id) || (sourcePlayerId && seenSourcePlayerIds.has(sourcePlayerId))) return
    player.stale = true
    player.staleAt = report.syncedAt
    report.stalePlayers += 1
  })

  return report
}
