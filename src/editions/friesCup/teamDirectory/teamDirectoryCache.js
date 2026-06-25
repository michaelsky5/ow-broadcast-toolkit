import { createDefaultFriesCupEditionData, createDefaultFriesCupTeamDirectory } from '../defaultProject'

const getErrorMessage = error => String(error?.message || error || '').trim()

export const ensureFriesCupEditionData = project => {
  if (!project.editionData) project.editionData = {}
  if (!project.editionData.friesCup) project.editionData.friesCup = createDefaultFriesCupEditionData()
  if (!project.editionData.friesCup.teamDirectory) {
    project.editionData.friesCup.teamDirectory = createDefaultFriesCupTeamDirectory()
  }
  if (!project.editionData.friesCup.appliedTeams) project.editionData.friesCup.appliedTeams = {}
  if (!project.editionData.friesCup.legacyExtras) project.editionData.friesCup.legacyExtras = {}

  return project.editionData.friesCup
}

export const getTeamDirectoryCache = project => ({
  ...createDefaultFriesCupTeamDirectory(),
  ...(project?.editionData?.friesCup?.teamDirectory || {})
})

export const writeTeamDirectoryLoading = (project, config = {}) => {
  const friesCup = ensureFriesCupEditionData(project)

  friesCup.teamDirectory = {
    ...createDefaultFriesCupTeamDirectory(),
    ...friesCup.teamDirectory,
    status: 'LOADING',
    source: config.sourceType || friesCup.teamDirectory.source,
    seasonId: config.seasonId || friesCup.teamDirectory.seasonId,
    version: config.version || friesCup.teamDirectory.version,
    remoteBaseUrl: config.remoteBaseUrl || friesCup.teamDirectory.remoteBaseUrl,
    staticFallbackUrl: config.staticFallbackUrl ?? friesCup.teamDirectory.staticFallbackUrl,
    error: ''
  }

  return project
}

export const writeTeamDirectorySuccess = (project, fetchResult, directory, syncReport = null) => {
  const friesCup = ensureFriesCupEditionData(project)
  const teams = Array.isArray(directory.teams) ? directory.teams : []
  const sourceTeamMapping = teams.map(team => ({
    teamId: team.id,
    sourceTeamId: team.sourceTeamId || '',
    name: team.name || '',
    shortName: team.shortName || '',
    logo: team.logo || '',
    logoStatus: team.logoResolution?.status || team.extras?.logoResolution?.status || '',
    logoKey: team.logoResolution?.key || team.extras?.logoResolution?.key || '',
    stale: false
  }))
  const sourcePlayerMapping = teams.flatMap(team => (team.players || []).map(player => ({
    playerId: player.id,
    sourcePlayerId: player.sourcePlayerId || '',
    teamId: team.id,
    sourceTeamId: team.sourceTeamId || '',
    name: player.name || '',
    stale: false
  })))
  const counts = {
    teams: directory.counts?.teams ?? teams.length,
    players: directory.counts?.players ?? sourcePlayerMapping.length,
    matches: directory.counts?.matches ?? 0,
    playerTotals: directory.counts?.playerTotals ?? 0,
    teamReviews: directory.counts?.teamReviews ?? 0
  }

  friesCup.teamDirectory = {
    ...createDefaultFriesCupTeamDirectory(),
    status: 'READY',
    source: fetchResult.source || directory.source,
    sourceUrl: fetchResult.sourceUrl || directory.sourceUrl,
    seasonId: fetchResult.seasonId || directory.seasonId,
    version: fetchResult.version || directory.version,
    remoteBaseUrl: fetchResult.remoteBaseUrl || friesCup.teamDirectory?.remoteBaseUrl || '',
    staticFallbackUrl: friesCup.teamDirectory?.staticFallbackUrl || '',
    schemaVersion: fetchResult.schemaVersion || directory.schemaVersion,
    contractVersion: fetchResult.contractVersion || directory.contractVersion,
    checksum: fetchResult.checksum || '',
    fetchedAt: fetchResult.fetchedAt || new Date().toISOString(),
    updatedAt: fetchResult.updatedAt || directory.updatedAt || directory.reviewReadyAt || '',
    error: '',
    teams: [],
    counts,
    sourceTeamMapping: syncReport?.teamMappings || sourceTeamMapping,
    sourcePlayerMapping: syncReport?.playerMappings || sourcePlayerMapping,
    syncReport,
    rawMeta: directory.rawMeta || null,
    extras: directory.extras || {},
    unknownExtras: directory.extras || {},
    reviewReadyAt: directory.reviewReadyAt || '',
    reviewSchemaVersion: directory.reviewSchemaVersion || ''
  }

  return project
}

export const writeTeamDirectoryFailure = (project, error, config = {}) => {
  const friesCup = ensureFriesCupEditionData(project)
  const previous = friesCup.teamDirectory || createDefaultFriesCupTeamDirectory()

  friesCup.teamDirectory = {
    ...createDefaultFriesCupTeamDirectory(),
    ...previous,
    status: 'ERROR',
    source: config.sourceType || previous.source,
    seasonId: config.seasonId || previous.seasonId,
    version: config.version || previous.version,
    remoteBaseUrl: config.remoteBaseUrl || previous.remoteBaseUrl,
    staticFallbackUrl: config.staticFallbackUrl ?? previous.staticFallbackUrl,
    error: getErrorMessage(error),
    fetchedAt: new Date().toISOString()
  }

  return project
}
