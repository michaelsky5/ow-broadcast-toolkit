import { getTeamPlayers } from '../project/projectUtils'
import {
  MAX_ROSTER_PLAYERS,
  getDefaultHeroForRole,
  normalizePortraitXPct,
  normalizeRosterRole
} from '../app/editors/roster/rosterEditorUtils'

export const MAX_PROJECT_TEAMS = 2
export const TEAM_LIBRARY_SCHEMA_VERSION = 'owbt-team-library-v1'

const clean = value => String(value || '').trim()
const createId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const normalizeIdentityPart = value => clean(value).toLocaleLowerCase().replace(/\s+/g, ' ')

export const getLibraryTeamIdentity = team => {
  const name = normalizeIdentityPart(team?.name || team?.teamName)
  const shortName = normalizeIdentityPart(team?.shortName || team?.teamShortName || team?.code)
  return name && shortName ? `${name}::${shortName}` : ''
}

export const findLibraryTeamMatch = (candidate, records, excludeId = '') => {
  const candidateId = clean(candidate?.id)
  const identity = getLibraryTeamIdentity(candidate)
  return (records || []).find(record => {
    if (record.id === excludeId) return false
    if (candidateId && record.id === candidateId) return true
    return Boolean(identity && getLibraryTeamIdentity(record) === identity)
  }) || null
}

export const getLibraryDuplicateGroups = records => {
  const groups = new Map()
  ;(records || []).forEach(record => {
    const identity = getLibraryTeamIdentity(record)
    if (!identity) return
    groups.set(identity, [...(groups.get(identity) || []), record])
  })
  return [...groups.values()].filter(group => group.length > 1)
}

const newerLibraryRecord = (left, right) => {
  const leftTime = Date.parse(left?.updatedAt || '') || 0
  const rightTime = Date.parse(right?.updatedAt || '') || 0
  return rightTime >= leftTime ? right : left
}

const getLibraryPlayerIdentities = player => {
  const sourceId = normalizeIdentityPart(player?.sourcePlayerId)
  const battleTag = normalizeIdentityPart(player?.battleTag)
  const name = normalizeIdentityPart(player?.name)
  const role = normalizeIdentityPart(player?.role)
  return [
    sourceId ? `source:${sourceId}` : '',
    battleTag ? `battle:${battleTag}` : '',
    name ? `name:${name}::${role}` : ''
  ].filter(Boolean)
}

const mergeMissingPlayerFields = (keeper, fallback) => ({
  ...keeper,
  sourcePlayerId: keeper.sourcePlayerId || fallback.sourcePlayerId,
  name: keeper.name || fallback.name,
  battleTag: keeper.battleTag || fallback.battleTag,
  avatar: keeper.avatar || fallback.avatar,
  primaryHeroes: [...new Set([...(keeper.primaryHeroes || []), ...(fallback.primaryHeroes || [])])]
})

const findMatchingLibraryPlayer = (candidate, records) => {
  const candidateIdentities = new Set(getLibraryPlayerIdentities(candidate))
  if (!candidateIdentities.size) return null

  return (records || []).find(record => (
    getLibraryPlayerIdentities(record).some(identity => candidateIdentities.has(identity))
  )) || null
}

const preserveMissingLibraryFields = (incoming, existing) => {
  if (!existing) return incoming

  const existingTeam = normalizeLibraryTeam(existing)
  const incomingTeam = normalizeLibraryTeam(incoming)
  const matchedExistingPlayerIds = new Set()
  const players = incomingTeam.players.length
    ? incomingTeam.players.map((player, index) => {
        const previous = findMatchingLibraryPlayer(player, existingTeam.players)
        if (!previous) return player
        matchedExistingPlayerIds.add(previous.id)

        return normalizeLibraryPlayer({
          ...player,
          id: previous.id,
          sourcePlayerId: player.sourcePlayerId || previous.sourcePlayerId,
          avatar: player.avatar || previous.avatar,
          primaryHeroes: player.primaryHeroes?.length ? player.primaryHeroes : previous.primaryHeroes
        }, incomingTeam.id, index)
      })
    : existingTeam.players.map((player, index) => normalizeLibraryPlayer(player, incomingTeam.id, index))

  if (incomingTeam.players.length) {
    existingTeam.players.forEach(player => {
      if (players.length >= MAX_ROSTER_PLAYERS || matchedExistingPlayerIds.has(player.id)) return
      players.push(normalizeLibraryPlayer(player, incomingTeam.id, players.length))
    })
  }

  return normalizeLibraryTeam({
    ...incomingTeam,
    logo: incomingTeam.logo || existingTeam.logo,
    primaryColor: incomingTeam.primaryColor || existingTeam.primaryColor,
    description: incomingTeam.description || existingTeam.description,
    coach: incomingTeam.coach || existingTeam.coach,
    manager: incomingTeam.manager || existingTeam.manager,
    players
  })
}

export const createEmptyLibraryTeam = index => ({
  id: createId('library-team'),
  sourceTeamId: '',
  name: `Team ${index || 1}`,
  shortName: `T${index || 1}`,
  logo: '',
  primaryColor: '',
  description: '',
  coach: '',
  manager: '',
  players: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

export const createEmptyLibraryPlayer = (team, index) => {
  const role = 'damage'

  return {
    id: createId('library-player'),
    sourcePlayerId: '',
    name: `Player ${index || 1}`,
    battleTag: '',
    role,
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: [getDefaultHeroForRole(role)].filter(Boolean),
    teamLibraryId: team?.id || ''
  }
}

const normalizeLibraryPlayer = (player, teamLibraryId, index) => ({
  id: clean(player?.id) || createId('library-player'),
  sourcePlayerId: clean(player?.sourcePlayerId),
  name: clean(player?.name) || `Player ${index + 1}`,
  battleTag: clean(player?.battleTag),
  role: normalizeRosterRole(player?.role),
  avatar: clean(player?.avatar),
  portraitXPct: normalizePortraitXPct(player?.portraitXPct),
  primaryHeroes: Array.isArray(player?.primaryHeroes)
    ? player.primaryHeroes.filter(Boolean)
    : [player?.primaryHero].filter(Boolean),
  teamLibraryId
})

export const normalizeLibraryTeam = (team, index = 0) => {
  const id = clean(team?.id) || createId('library-team')
  const players = Array.isArray(team?.players) ? team.players : []

  return {
    id,
    sourceTeamId: clean(team?.sourceTeamId || team?.teamId),
    name: clean(team?.name || team?.teamName) || `Team ${index + 1}`,
    shortName: clean(team?.shortName || team?.teamShortName || team?.code) || `T${index + 1}`,
    logo: clean(team?.logo || team?.teamLogo),
    primaryColor: clean(team?.primaryColor || team?.color),
    description: clean(team?.description),
    coach: clean(team?.coach),
    manager: clean(team?.manager),
    players: players.slice(0, MAX_ROSTER_PLAYERS).map((player, playerIndex) => (
      normalizeLibraryPlayer(player, id, playerIndex)
    )),
    createdAt: clean(team?.createdAt) || new Date().toISOString(),
    updatedAt: clean(team?.updatedAt) || new Date().toISOString()
  }
}

export const createLibraryRecordFromProject = (project, team, existingRecord = null) => {
  const now = new Date().toISOString()
  const recordId = clean(team?.libraryId || existingRecord?.id) || createId('library-team')
  const previousPlayers = new Map((existingRecord?.players || []).map(player => [
    clean(player.sourcePlayerId || player.id),
    player
  ]))
  const playerLinks = {}
  const players = getTeamPlayers(project, team.id).slice(0, MAX_ROSTER_PLAYERS).map((player, index) => {
    const previous = previousPlayers.get(clean(player.id))
    const libraryPlayerId = clean(player.libraryPlayerId || previous?.id) || createId('library-player')
    playerLinks[player.id] = libraryPlayerId

    return normalizeLibraryPlayer({
      ...player,
      id: libraryPlayerId,
      sourcePlayerId: player.id,
      avatar: player.avatar || previous?.avatar,
      primaryHeroes: player.primaryHeroes?.length ? player.primaryHeroes : previous?.primaryHeroes
    }, recordId, index)
  })

  const importedRecord = normalizeLibraryTeam({
    ...team,
    id: recordId,
    sourceTeamId: team.id,
    players,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now
  })

  return {
    record: preserveMissingLibraryFields(importedRecord, existingRecord),
    teamLibraryId: recordId,
    playerLinks
  }
}

export const createLibraryBackup = records => ({
  schemaVersion: TEAM_LIBRARY_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  teams: records.map(normalizeLibraryTeam)
})

export const normalizeLibraryBackup = payload => {
  const teams = Array.isArray(payload) ? payload : payload?.teams
  if (!Array.isArray(teams) || !teams.length) throw new Error('Invalid OWBT team library backup.')
  return teams.map(normalizeLibraryTeam)
}

export const createLibraryMergePlan = (incomingRecords, existingRecords, options = {}) => {
  const existing = (existingRecords || []).map(normalizeLibraryTeam)
  const generatedShortNameIds = new Set(options.generatedShortNameIds || [])
  const deduplicated = []
  const duplicateNames = []

  ;(incomingRecords || []).map(normalizeLibraryTeam).forEach(record => {
    const identity = getLibraryTeamIdentity(record)
    const duplicateIndex = deduplicated.findIndex(candidate => (
      candidate.id === record.id || (identity && getLibraryTeamIdentity(candidate) === identity)
    ))

    if (duplicateIndex < 0) {
      deduplicated.push(record)
      return
    }

    duplicateNames.push(record.name)
    deduplicated[duplicateIndex] = newerLibraryRecord(deduplicated[duplicateIndex], record)
  })

  const rows = deduplicated.map(incoming => {
    const identityMatch = findLibraryTeamMatch(incoming, existing)
    const generatedShortName = generatedShortNameIds.has(incoming.id)
    const nameMatches = generatedShortName && !identityMatch
      ? existing.filter(record => normalizeIdentityPart(record.name) === normalizeIdentityPart(incoming.name))
      : []
    const matched = identityMatch || (nameMatches.length === 1 ? nameMatches[0] : null)
    const importedRecord = normalizeLibraryTeam({
      ...incoming,
      id: matched?.id || incoming.id,
      shortName: generatedShortName && matched?.shortName ? matched.shortName : incoming.shortName,
      sourceTeamId: incoming.sourceTeamId || matched?.sourceTeamId,
      createdAt: matched?.createdAt || incoming.createdAt
    })
    const record = matched && options.preserveMissingFields
      ? preserveMissingLibraryFields(importedRecord, matched)
      : importedRecord

    return {
      action: matched ? 'update' : 'add',
      matchReason: matched?.id === incoming.id
        ? 'id'
        : identityMatch
          ? 'identity'
          : matched
            ? 'name'
            : 'new',
      incoming,
      existing: matched,
      record
    }
  })

  return {
    rows,
    records: rows.map(row => row.record),
    additions: rows.filter(row => row.action === 'add').length,
    updates: rows.filter(row => row.action === 'update').length,
    duplicates: duplicateNames.length,
    duplicateNames
  }
}

export const mergeLibraryDuplicateGroup = (rawGroup, keeperId) => {
  const group = (rawGroup || []).map(normalizeLibraryTeam)
  const keeper = group.find(team => team.id === keeperId) || group[0]
  if (!keeper || group.length < 2) throw new Error('A duplicate merge requires at least two teams.')

  const duplicates = group.filter(team => team.id !== keeper.id)
  const mergedPlayers = keeper.players.map(player => ({ ...player }))
  const playerIndexByIdentity = new Map()
  const playerIdMap = {}
  const omittedPlayers = []

  mergedPlayers.forEach((player, index) => {
    getLibraryPlayerIdentities(player).forEach(identity => playerIndexByIdentity.set(identity, index))
    playerIdMap[player.id] = player.id
  })

  duplicates.forEach(team => {
    team.players.forEach(player => {
      const identities = getLibraryPlayerIdentities(player)
      const existingIndex = identities
        .map(identity => playerIndexByIdentity.get(identity))
        .find(index => index !== undefined)

      if (existingIndex !== undefined) {
        const existingPlayer = mergedPlayers[existingIndex]
        mergedPlayers[existingIndex] = mergeMissingPlayerFields(existingPlayer, player)
        identities.forEach(identity => playerIndexByIdentity.set(identity, existingIndex))
        playerIdMap[player.id] = existingPlayer.id
        return
      }

      if (mergedPlayers.length >= MAX_ROSTER_PLAYERS) {
        playerIdMap[player.id] = ''
        omittedPlayers.push(player.name)
        return
      }

      const nextPlayer = { ...player, teamLibraryId: keeper.id }
      mergedPlayers.push(nextPlayer)
      identities.forEach(identity => playerIndexByIdentity.set(identity, mergedPlayers.length - 1))
      playerIdMap[player.id] = nextPlayer.id
    })
  })

  const fillFields = ['sourceTeamId', 'logo', 'primaryColor', 'description', 'coach', 'manager']
  const mergedTeam = { ...keeper }
  duplicates.forEach(team => {
    fillFields.forEach(field => {
      if (!clean(mergedTeam[field]) && clean(team[field])) mergedTeam[field] = team[field]
    })
  })

  return {
    record: normalizeLibraryTeam({
      ...mergedTeam,
      players: mergedPlayers,
      updatedAt: new Date().toISOString()
    }),
    keeperId: keeper.id,
    removedIds: duplicates.map(team => team.id),
    playerIdMap,
    omittedPlayers
  }
}

export const estimateLibraryBytes = records => new Blob([
  JSON.stringify(createLibraryBackup(records))
]).size
