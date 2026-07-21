import { getStartingFiveForTeam } from '../app/editors/roster/rosterEditorUtils'
import { getLibraryTeamIdentity, normalizeLibraryTeam } from './teamLibraryModel'

export const MATCH_PACKAGE_SCHEMA_VERSION = 'owbt-match-package-v1'
export const MATCH_PACKAGE_TEAM_COUNT = 2
export const MATCH_PACKAGE_MAX_BYTES = 2 * 1024 * 1024
export const MATCH_PACKAGE_IMPORT_MODES = Object.freeze({
  REFRESH: 'refresh',
  SWAP: 'swap',
  REPLACE: 'replace'
})
export const MATCH_PACKAGE_ERROR_CODES = Object.freeze({
  EMPTY: 'empty',
  INVALID_JSON: 'invalid-json',
  WRONG_KIND: 'wrong-kind',
  UNSUPPORTED_VERSION: 'unsupported-version',
  MISSING_TEAMS: 'missing-teams',
  DUPLICATE_TEAMS: 'duplicate-teams',
  TOO_LARGE: 'too-large'
})

const clean = value => String(value || '').trim()
const normalizeIdentityPart = value => clean(value).toLocaleLowerCase()

const createPackageError = (code, message) => {
  const error = new Error(message)
  error.code = code
  return error
}

export const getMatchPackageByteSize = value => (
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).byteLength
)

const assertPackageSize = text => {
  if (getMatchPackageByteSize(text) <= MATCH_PACKAGE_MAX_BYTES) return
  throw createPackageError(MATCH_PACKAGE_ERROR_CODES.TOO_LARGE, 'Match package exceeds the safe clipboard size.')
}

const assertDistinctTeams = (teamA, teamB) => {
  const teamAId = clean(teamA?.id)
  const teamBId = clean(teamB?.id)
  const teamAIdentity = getLibraryTeamIdentity(teamA)
  const teamBIdentity = getLibraryTeamIdentity(teamB)
  const sameId = Boolean(teamAId && teamAId === teamBId)
  const sameIdentity = Boolean(teamAIdentity && teamAIdentity === teamBIdentity)

  if (sameId || sameIdentity) {
    throw createPackageError(MATCH_PACKAGE_ERROR_CODES.DUPLICATE_TEAMS, 'Team A and Team B must be different teams.')
  }
}

const sanitizeId = value => clean(value)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')

const createUniqueId = (preferred, usedIds, fallback) => {
  const base = sanitizeId(preferred) || fallback
  let id = base
  let suffix = 2

  while (usedIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(id)
  return id
}

const reserveProjectId = (preferred, usedIds, fallback) => {
  const base = clean(preferred) || fallback
  let id = base
  let suffix = 2

  while (usedIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(id)
  return id
}

export const createMatchPackage = records => {
  if (!Array.isArray(records) || records.length !== MATCH_PACKAGE_TEAM_COUNT) {
    throw new Error('A match package requires exactly two teams.')
  }

  const teamA = normalizeLibraryTeam(records[0])
  const teamB = normalizeLibraryTeam(records[1])
  assertDistinctTeams(teamA, teamB)

  return {
    kind: 'owbt-match-package',
    schemaVersion: MATCH_PACKAGE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    teams: {
      teamA,
      teamB
    }
  }
}

export const stringifyMatchPackage = matchPackage => {
  const text = JSON.stringify(matchPackage)
  assertPackageSize(text)
  return text
}

export const parseMatchPackage = text => {
  if (typeof text === 'string' && !text.trim()) {
    throw createPackageError(MATCH_PACKAGE_ERROR_CODES.EMPTY, 'Match package text is empty.')
  }

  let payload = text
  if (typeof text === 'string') {
    assertPackageSize(text)
    try {
      payload = JSON.parse(text)
    } catch {
      throw createPackageError(MATCH_PACKAGE_ERROR_CODES.INVALID_JSON, 'Match package is not valid JSON.')
    }
  }

  if (payload?.kind !== 'owbt-match-package') {
    throw createPackageError(MATCH_PACKAGE_ERROR_CODES.WRONG_KIND, 'This is not an OWBT match package.')
  }

  if (payload?.schemaVersion !== MATCH_PACKAGE_SCHEMA_VERSION) {
    throw createPackageError(MATCH_PACKAGE_ERROR_CODES.UNSUPPORTED_VERSION, 'Unsupported OWBT match package version.')
  }

  if (!payload?.teams?.teamA || !payload?.teams?.teamB) {
    throw createPackageError(MATCH_PACKAGE_ERROR_CODES.MISSING_TEAMS, 'Match package is missing Team A or Team B.')
  }

  const teamA = normalizeLibraryTeam(payload.teams.teamA)
  const teamB = normalizeLibraryTeam(payload.teams.teamB)
  assertDistinctTeams(teamA, teamB)

  return {
    kind: 'owbt-match-package',
    schemaVersion: MATCH_PACKAGE_SCHEMA_VERSION,
    createdAt: clean(payload.createdAt) || new Date().toISOString(),
    teams: {
      teamA,
      teamB
    }
  }
}

const getPlayerIdentity = player => {
  const libraryPlayerId = normalizeIdentityPart(player?.libraryPlayerId || player?.id)
  const battleTag = normalizeIdentityPart(player?.battleTag)
  const nameRole = [player?.name, player?.role].map(normalizeIdentityPart).join('|')

  return { libraryPlayerId, battleTag, nameRole }
}

const findPreviousPlayerId = (player, index, previousPlayers, reservedPreviousIds) => {
  const identity = getPlayerIdentity(player)
  const candidates = previousPlayers.filter(candidate => !reservedPreviousIds.has(candidate.id))
  const matched = candidates.find(candidate => {
    const previousIdentity = getPlayerIdentity(candidate)
    if (identity.libraryPlayerId && previousIdentity.libraryPlayerId === identity.libraryPlayerId) return true
    if (identity.battleTag && previousIdentity.battleTag === identity.battleTag) return true
    return Boolean(identity.nameRole && previousIdentity.nameRole === identity.nameRole)
  }) || candidates.find(candidate => candidate === previousPlayers[index])

  if (!matched?.id) return ''
  reservedPreviousIds.add(matched.id)
  return matched.id
}

const createSideData = (record, teamId, usedPlayerIds, previousPlayers = []) => {
  const reservedPreviousIds = new Set()
  const players = record.players.map((player, index) => {
    const previousPlayerId = findPreviousPlayerId(player, index, previousPlayers, reservedPreviousIds)
    return {
      id: previousPlayerId
        ? reserveProjectId(previousPlayerId, usedPlayerIds, `${teamId}-player-${index + 1}`)
        : createUniqueId(
            `${teamId}-${player.id || player.name || `player-${index + 1}`}`,
            usedPlayerIds,
            `${teamId}-player-${index + 1}`
          ),
      libraryPlayerId: player.id,
      name: player.name || `Player ${index + 1}`,
      battleTag: player.battleTag || '',
      role: player.role,
      teamId,
      avatar: player.avatar || '',
      portraitXPct: player.portraitXPct,
      primaryHeroes: Array.isArray(player.primaryHeroes) ? player.primaryHeroes : []
    }
  })

  return {
    team: {
      id: teamId,
      libraryId: record.id,
      name: record.name,
      shortName: record.shortName,
      logo: record.logo,
      primaryColor: record.primaryColor,
      description: record.description,
      coach: record.coach,
      manager: record.manager,
      playerIds: players.map(player => player.id)
    },
    players
  }
}

const projectTeamMatchesRecord = (team, record) => {
  if (!team || !record) return false
  const projectLibraryId = normalizeIdentityPart(team.libraryId)
  const recordLibraryId = normalizeIdentityPart(record.id)

  if (projectLibraryId && recordLibraryId) return projectLibraryId === recordLibraryId
  return getLibraryTeamIdentity(team) === getLibraryTeamIdentity(record)
}

export const getMatchPackageImportMode = (project, rawPackage) => {
  const matchPackage = parseMatchPackage(rawPackage)
  const teams = new Map((project?.teams || []).map(team => [team.id, team]))
  const currentTeamA = teams.get(project?.currentMatch?.teamAId)
  const currentTeamB = teams.get(project?.currentMatch?.teamBId)
  const incomingTeamA = matchPackage.teams.teamA
  const incomingTeamB = matchPackage.teams.teamB

  if (
    projectTeamMatchesRecord(currentTeamA, incomingTeamA) &&
    projectTeamMatchesRecord(currentTeamB, incomingTeamB)
  ) return MATCH_PACKAGE_IMPORT_MODES.REFRESH

  if (
    projectTeamMatchesRecord(currentTeamA, incomingTeamB) &&
    projectTeamMatchesRecord(currentTeamB, incomingTeamA)
  ) return MATCH_PACKAGE_IMPORT_MODES.SWAP

  return MATCH_PACKAGE_IMPORT_MODES.REPLACE
}

const resetMapEntry = entry => ({
  ...(entry || {}),
  picker: '',
  winner: '',
  winnerSide: '',
  attackSide: '',
  bansA: [],
  bansB: [],
  banOrderMode: 'A_FIRST'
})

const resetStatsSettings = stats => {
  if (!stats || typeof stats !== 'object') return
  stats.activeSnapshotId = ''
  stats.mapSnapshots = []
  stats.ocrRows = { teamA: [], teamB: [] }
  stats.statsPlayerIds = { teamA: [], teamB: [] }
  if (Array.isArray(stats.metrics)) {
    stats.metrics.forEach(metric => {
      metric.teamA = '0'
      metric.teamB = '0'
    })
  }
  if (stats.capture && typeof stats.capture === 'object') {
    stats.capture.imageDataUrl = ''
    stats.capture.timeZone = ''
  }
}

const resetSceneMatchData = settings => {
  if (!settings || typeof settings !== 'object') return

  if (settings.roster) {
    settings.roster.activePlayerIds = { teamA: [], teamB: [] }
  }
  if (settings.casters?.interview) {
    Object.assign(settings.casters.interview, {
      teamSide: 'A',
      playerSlot: '',
      manualTeamName: '',
      manualSpeakerName: '',
      manualSpeakerRole: ''
    })
  }
  if (settings.teamData) {
    Object.assign(settings.teamData, {
      teamSide: 'A',
      playerSlot: 0,
      compareTeamSide: 'B',
      compareSlot: 0,
      heroOverrides: { A: {}, B: {} }
    })
  }
  if (settings.mvp) {
    Object.assign(settings.mvp, {
      teamSide: 'A',
      playerSlot: 0,
      heroOverride: ''
    })
  }
  resetStatsSettings(settings.stats)
}

const resetGraphicMatchData = graphics => {
  if (!graphics || typeof graphics !== 'object') return
  ;['cover', 'matchup', 'result'].forEach(mode => {
    const settings = graphics[mode]
    if (!settings || typeof settings !== 'object') return
    settings.useCurrentMatchData = true
    settings.snapshot = null
    if ('teamAId' in settings) settings.teamAId = ''
    if ('teamBId' in settings) settings.teamBId = ''
  })

  if (graphics.result) {
    Object.assign(graphics.result, {
      winner: '',
      scoreTeamA: '',
      scoreTeamB: '',
      mvp: '',
      note: ''
    })
  }
}

export const resetProjectForNewMatchPackage = draft => {
  const match = draft.currentMatch || (draft.currentMatch = {})
  const totalMaps = Math.max(1, (Number(match.ft) || 3) * 2 - 1)
  const previousLineup = Array.isArray(match.mapLineup) ? match.mapLineup : []
  const mapLineup = Array.from({ length: totalMaps }, (_, index) => resetMapEntry(previousLineup[index]))

  match.status = 'pending'
  match.score = { teamA: 0, teamB: 0 }
  match.currentMapIndex = 1
  match.currentRoundLabel = 'MAP 1'
  match.currentMapId = clean(mapLineup[0]?.mapId)
  match.mapLineup = mapLineup
  match.side = { teamA: 'none', teamB: 'none' }
  match.bansA = []
  match.bansB = []
  match.banOrderMode = 'A_FIRST'
  match.startingFive = { teamA: [], teamB: [] }
  match.substitutes = { teamA: [], teamB: [] }
  match.winner = ''
  match.winnerSide = ''
  match.result = {
    ...(match.result || {}),
    winnerTeamId: '',
    winnerSide: '',
    mvpPlayerId: '',
    note: ''
  }
  match.pause = { ...(match.pause || {}), visible: false }
  match.notice = { ...(match.notice || {}), visible: false }

  if (match.hud && typeof match.hud === 'object') {
    Object.assign(match.hud, {
      teamRecordA: '',
      teamRecordB: '',
      teamRecordAW: '',
      teamRecordAL: '',
      teamRecordBW: '',
      teamRecordBL: '',
      teamSeedA: '',
      teamSeedB: '',
      teamMetaA: '',
      teamMetaB: '',
      beginInfoEnabled: false,
      autoBeginTriggerAt: 0,
      keyPlayerTriggerAt: 0,
      keyPlayerSide: 'A',
      keyPlayerName: '',
      showBanPhase: false,
      heroBanTriggerAt: 0,
      activeComms: '',
      subIndexA: -1,
      subIndexB: -1,
      sponsorSpotlightIndex: 0,
      sponsorSpotlightTriggerAt: 0,
      showTicker: false,
      tickerTriggerAt: 0,
      tickerStopAt: 0
    })
  }

  resetSceneMatchData(draft.scenes?.settings)
  resetGraphicMatchData(draft.tools?.graphics)
}

export const applyMatchPackageToProject = (draft, rawPackage, options = {}) => {
  const matchPackage = parseMatchPackage(rawPackage)
  const previousTeamAId = clean(draft.currentMatch?.teamAId)
  const previousTeamBId = clean(draft.currentMatch?.teamBId)
  const usedTeamIds = new Set()
  const teamAId = reserveProjectId(previousTeamAId, usedTeamIds, 'team-a')
  const teamBId = reserveProjectId(previousTeamBId, usedTeamIds, 'team-b')
  const previousTeams = new Map((draft.teams || []).map(team => [team.id, team]))
  const getPreviousPlayers = teamId => {
    if (options.preservePlayerIds === false) return []
    const team = previousTeams.get(teamId)
    const players = draft.players || []
    if (Array.isArray(team?.playerIds) && team.playerIds.length) {
      const playersById = new Map(players.map(player => [player.id, player]))
      return team.playerIds.map(playerId => playersById.get(playerId)).filter(Boolean)
    }
    return players.filter(player => player.teamId === teamId)
  }
  const usedPlayerIds = new Set()
  const teamA = createSideData(matchPackage.teams.teamA, teamAId, usedPlayerIds, getPreviousPlayers(previousTeamAId))
  const teamB = createSideData(matchPackage.teams.teamB, teamBId, usedPlayerIds, getPreviousPlayers(previousTeamBId))

  draft.teams = [teamA.team, teamB.team]
  draft.players = [...teamA.players, ...teamB.players]
  draft.currentMatch.teamAId = teamAId
  draft.currentMatch.teamBId = teamBId
  draft.currentMatch.startingFive = {
    ...(draft.currentMatch.startingFive || {}),
    teamA: getStartingFiveForTeam(draft, teamAId),
    teamB: getStartingFiveForTeam(draft, teamBId)
  }

  return matchPackage
}
