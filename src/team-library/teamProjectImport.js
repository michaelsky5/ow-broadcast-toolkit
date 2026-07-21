import { normalizeImportedTeamDb } from '../app/editors/roster/rosterEditorUtils'
import { getTeamPlayers } from '../project/projectUtils'
import {
  createLibraryRecordFromProject,
  findLibraryTeamMatch,
  normalizeLibraryTeam
} from './teamLibraryModel'

export const MAX_OWBT_TEAM_SOURCE_BYTES = 24 * 1024 * 1024
export const MAX_TEAM_LIBRARY_BACKUP_BYTES = 128 * 1024 * 1024

const clean = value => String(value || '').trim()

const stripCodeFence = value => clean(value)
  .replace(/^\uFEFF/, '')
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/, '')

export const isOwbtTeamLibraryBackupText = value => (
  /["']schemaVersion["']\s*:\s*["']owbt-team-library-v\d+["']/i.test(
    stripCodeFence(value).slice(0, 8192)
  )
)

export const getOwbtTeamSourceByteLimit = value => (
  isOwbtTeamLibraryBackupText(value)
    ? MAX_TEAM_LIBRARY_BACKUP_BYTES
    : MAX_OWBT_TEAM_SOURCE_BYTES
)

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLikelyTeamRecord = value => {
  if (!isObject(value)) return false
  if (
    value.shortName || value.teamShortName || value.short_name || value.teamName || value.team_name ||
    value.logo || value.teamLogo || value.players || value.playerIds || value.player_ids
  ) return true

  return Boolean(value.name) && !(
    value.role || value.battleTag || value.battle_tag || value.teamId || value.team_id
  )
}

const isTeamArray = value => (
  Array.isArray(value) && value.length > 0 && value.some(isLikelyTeamRecord)
)

const isTeamRecordMap = value => {
  if (!isObject(value)) return false
  const records = Object.values(value)
  return records.length > 0 && records.some(isLikelyTeamRecord)
}

const getTeamCollection = value => {
  if (!isObject(value)) return null
  return value.teams || value.teamList || value.team_list || value.participants?.teams || null
}

const isTeamPayload = value => (
  isTeamArray(value) || (() => {
    const teams = getTeamCollection(value)
    return isTeamArray(teams) || isTeamRecordMap(teams)
  })()
)

const looksLikeJson = value => {
  const text = stripCodeFence(value)
  return text.startsWith('{') || text.startsWith('[') || text.startsWith('"{') || text.startsWith('"[')
}

const getJsonSlice = value => {
  const text = stripCodeFence(value)
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')
  const starts = [objectStart, arrayStart].filter(index => index >= 0)
  if (!starts.length) return ''

  const start = Math.min(...starts)
  const closing = text[start] === '{' ? '}' : ']'
  const end = text.lastIndexOf(closing)
  return end > start ? text.slice(start, end + 1) : ''
}

const parseJsonInput = input => {
  if (typeof input !== 'string') return input
  let text = stripCodeFence(input)
  let lastError = null

  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed === 'string' && looksLikeJson(parsed)) {
        text = stripCodeFence(parsed)
        continue
      }
      return parsed
    } catch (error) {
      lastError = error
      const sliced = depth === 0 ? getJsonSlice(text) : ''
      if (sliced && sliced !== text) {
        text = sliced
        continue
      }
      break
    }
  }

  const error = new Error(lastError?.message || 'Invalid JSON.')
  error.importCode = 'project-invalid-json'
  throw error
}

const findTeamPayload = payload => {
  const priorityKeys = [
    'project', 'owbtProject', 'projectData', 'data', 'payload', 'backup',
    'state', 'content', 'value', 'teamDatabase', 'teamDb', 'teams', 'teamList',
    'team_list', 'library', 'participants'
  ]
  const queue = [{ value: payload, depth: 0 }]
  const visited = new WeakSet()

  while (queue.length) {
    const entry = queue.shift()
    let value = entry.value
    if (typeof value === 'string' && entry.depth <= 4 && looksLikeJson(value)) {
      try {
        value = parseJsonInput(value)
      } catch {
        continue
      }
    }
    if (isTeamPayload(value)) return value
    if (!isObject(value) || entry.depth >= 5 || visited.has(value)) continue
    visited.add(value)

    const keys = [
      ...priorityKeys.filter(key => Object.prototype.hasOwnProperty.call(value, key)),
      ...Object.keys(value).filter(key => !priorityKeys.includes(key))
    ]
    keys.forEach(key => {
      const candidate = value[key]
      if (isObject(candidate) || Array.isArray(candidate) || (typeof candidate === 'string' && looksLikeJson(candidate))) {
        queue.push({ value: candidate, depth: entry.depth + 1 })
      }
    })
  }

  return null
}

const getSourceKind = (payload, source) => {
  const schema = clean(source?.schemaVersion || payload?.schemaVersion).toLocaleLowerCase()
  if (schema.startsWith('owbt-project')) return 'project'
  if (schema.startsWith('owbt-team-db')) return 'team-db'
  if (schema.startsWith('owbt-team-library')) return 'library-backup'
  return 'generic'
}

const getSourceName = (payload, source) => clean(
  source?.meta?.name ||
  source?.event?.name ||
  payload?.meta?.name ||
  payload?.event?.name ||
  source?.schemaVersion ||
  payload?.schemaVersion
)

export const parseOwbtTeamSource = (input, existingRecords = []) => {
  const payload = parseJsonInput(input)
  const source = findTeamPayload(payload)
  if (!source) {
    const error = new Error('No OWBT team data found.')
    error.importCode = 'project-no-team-data'
    throw error
  }

  const sourceKind = getSourceKind(payload, source)
  if (sourceKind === 'library-backup') {
    const sourceTeams = Array.isArray(source)
      ? source
      : Array.isArray(source.teams)
        ? source.teams
        : Object.values(source.teams || {})
    const records = sourceTeams.map(normalizeLibraryTeam)
    return {
      records,
      sourceKind,
      sourceName: getSourceName(payload, source),
      teamCount: records.length,
      playerCount: records.reduce((count, team) => count + team.players.length, 0),
      omittedPlayers: 0
    }
  }

  let normalizedProject = null
  try {
    normalizedProject = normalizeImportedTeamDb(source)
  } catch (cause) {
    const error = new Error(cause?.message || 'No valid OWBT teams found.')
    error.importCode = 'project-no-valid-teams'
    throw error
  }
  let omittedPlayers = 0
  const records = normalizedProject.teams.map(team => {
    const sourcePlayers = getTeamPlayers(normalizedProject, team.id)
    omittedPlayers += Math.max(0, sourcePlayers.length - 7)
    const existing = findLibraryTeamMatch({ ...team, id: '' }, existingRecords)
    return createLibraryRecordFromProject(
      normalizedProject,
      { ...team, libraryId: '' },
      existing
    ).record
  })

  return {
    records,
    sourceKind,
    sourceName: getSourceName(payload, source),
    teamCount: records.length,
    playerCount: records.reduce((count, team) => count + team.players.length, 0),
    omittedPlayers
  }
}
