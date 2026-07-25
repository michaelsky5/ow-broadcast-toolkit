export const TEAM_LIBRARY_MAX_LOGO_BYTES = 384 * 1024
export const TEAM_LIBRARY_MAX_AVATAR_BYTES = 192 * 1024
export const TEAM_LIBRARY_MAX_TEAM_BYTES = 3 * 1024 * 1024
export const TEAM_LIBRARY_MAX_TOTAL_BYTES = 24 * 1024 * 1024
export const TEAM_LIBRARY_MAX_TEAMS = 256
export const TEAM_LIBRARY_MAX_PASTED_IMPORT_BYTES = 4 * 1024 * 1024
export const TEAM_LIBRARY_MAX_ASSET_SOURCE_BYTES = 8 * 1024

export const TEAM_LIBRARY_STORAGE_ERROR_CODES = Object.freeze({
  ASSET_SOURCE_UNSUPPORTED: 'asset-source-unsupported',
  ASSET_TOO_LARGE: 'asset-too-large',
  TEAM_TOO_LARGE: 'team-too-large',
  LIBRARY_TOO_LARGE: 'library-too-large',
  TOO_MANY_TEAMS: 'too-many-teams',
  PASTED_IMPORT_TOO_LARGE: 'pasted-import-too-large'
})

const SUPPORTED_DATA_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp'
])

const clean = value => String(value || '').trim()

export class TeamLibraryStorageError extends Error {
  constructor(code, details = {}) {
    super(code)
    this.name = 'TeamLibraryStorageError'
    this.code = code
    this.details = details
  }
}

export const getTeamLibraryUtf8Bytes = value => {
  const text = String(value || '')
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).byteLength
  return unescape(encodeURIComponent(text)).length
}

const getAssetLimit = (kind, options = {}) => (
  Number(options.maxBytes) ||
  (kind === 'avatar' ? TEAM_LIBRARY_MAX_AVATAR_BYTES : TEAM_LIBRARY_MAX_LOGO_BYTES)
)

const inspectDataImageUrl = (source, kind, options) => {
  if (options.allowDataUrl === false) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED,
      { kind, sourceType: 'data-url' }
    )
  }

  const commaIndex = source.indexOf(',')
  const metadata = commaIndex >= 0 ? source.slice(5, commaIndex).toLowerCase() : ''
  const metadataParts = metadata.split(';')
  const mimeType = metadataParts[0]
  const payload = commaIndex >= 0 ? source.slice(commaIndex + 1) : ''
  const base64 = metadataParts.slice(1).includes('base64')
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  const bytes = Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
  const maxBytes = getAssetLimit(kind, options)

  if (
    commaIndex < 0 ||
    !SUPPORTED_DATA_IMAGE_TYPES.has(mimeType) ||
    !base64 ||
    metadataParts.some((part, index) => index > 0 && part !== 'base64')
  ) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED,
      { kind, sourceType: 'data-url' }
    )
  }

  if (bytes > maxBytes) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_TOO_LARGE,
      { bytes, kind, maxBytes }
    )
  }

  if (payload.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(payload)) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED,
      { kind, sourceType: 'data-url' }
    )
  }

  return { bytes, kind, sourceType: 'data-url' }
}

export const inspectTeamLibraryAssetSource = (value, options = {}) => {
  const source = clean(value)
  const kind = options.kind === 'avatar' ? 'avatar' : 'logo'
  if (!source) return { bytes: 0, kind, sourceType: 'empty' }

  if (/^data:/i.test(source)) return inspectDataImageUrl(source, kind, options)

  const sourceBytes = getTeamLibraryUtf8Bytes(source)
  const maxSourceBytes = Number(options.maxSourceBytes) || TEAM_LIBRARY_MAX_ASSET_SOURCE_BYTES
  const scheme = source.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase() || ''
  const unsupportedScheme = scheme && scheme !== 'http' && scheme !== 'https'

  if (
    sourceBytes > maxSourceBytes ||
    /^\/\//.test(source) ||
    /^\\\\/.test(source) ||
    unsupportedScheme
  ) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED,
      { bytes: sourceBytes, kind, maxBytes: maxSourceBytes, sourceType: scheme || 'url' }
    )
  }

  return { bytes: sourceBytes, kind, sourceType: 'url' }
}

export const inspectTeamLibraryRecord = (team, options = {}) => {
  inspectTeamLibraryAssetSource(team?.logo, {
    kind: 'logo',
    maxBytes: options.maxLogoBytes
  })

  const players = Array.isArray(team?.players) ? team.players : []
  players.forEach(player => {
    inspectTeamLibraryAssetSource(player?.avatar, {
      kind: 'avatar',
      maxBytes: options.maxAvatarBytes
    })
  })

  const bytes = getTeamLibraryUtf8Bytes(JSON.stringify(team || {}))
  const maxBytes = Number(options.maxTeamBytes) || TEAM_LIBRARY_MAX_TEAM_BYTES
  if (bytes > maxBytes) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.TEAM_TOO_LARGE,
      {
        bytes,
        maxBytes,
        teamId: clean(team?.id),
        teamName: clean(team?.name || team?.shortName)
      }
    )
  }

  return { bytes, playerCount: players.length }
}

const inspectProjectedLibrary = (records, options = {}) => {
  const maxTeams = Number(options.maxTeams) || TEAM_LIBRARY_MAX_TEAMS
  if (records.length > maxTeams) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.TOO_MANY_TEAMS,
      { count: records.length, maxTeams }
    )
  }

  const bytes = getTeamLibraryUtf8Bytes(JSON.stringify(records))
  const maxBytes = Number(options.maxTotalBytes) || TEAM_LIBRARY_MAX_TOTAL_BYTES
  if (bytes > maxBytes) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.LIBRARY_TOO_LARGE,
      { bytes, maxBytes }
    )
  }

  return { bytes, teamCount: records.length }
}

export const assertTeamLibraryRecordsSafe = (records, options = {}) => {
  const teams = Array.from(records || [])
  teams.forEach(team => inspectTeamLibraryRecord(team, options))
  return inspectProjectedLibrary(teams, options)
}

export const createTeamLibraryWriteProjection = (
  existingRecords,
  incomingRecords,
  removedIds = []
) => {
  const recordsById = new Map(
    Array.from(existingRecords || [])
      .filter(record => clean(record?.id))
      .map(record => [clean(record.id), record])
  )

  Array.from(removedIds || []).forEach(teamId => recordsById.delete(clean(teamId)))
  Array.from(incomingRecords || []).forEach(record => {
    const teamId = clean(record?.id)
    if (teamId) recordsById.set(teamId, record)
  })

  return [...recordsById.values()]
}

export const assertTeamLibraryWriteSafe = (
  existingRecords,
  incomingRecords,
  options = {}
) => {
  const incoming = Array.from(incomingRecords || [])
  incoming.forEach(team => inspectTeamLibraryRecord(team, options))
  const projection = createTeamLibraryWriteProjection(
    existingRecords,
    incoming,
    options.removedIds
  )

  return {
    projection,
    ...inspectProjectedLibrary(projection, options)
  }
}

const findDataUrlEnd = (text, start) => {
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' || character === "'" || character === '\\' || /\s/.test(character)) {
      return index
    }
  }
  return text.length
}

export const inspectTeamLibraryPastedImportText = (value, options = {}) => {
  const text = String(value || '')
  const bytes = getTeamLibraryUtf8Bytes(text)
  const maxBytes = Number(options.maxBytes) || TEAM_LIBRARY_MAX_PASTED_IMPORT_BYTES

  if (bytes > maxBytes) {
    throw new TeamLibraryStorageError(
      TEAM_LIBRARY_STORAGE_ERROR_CODES.PASTED_IMPORT_TOO_LARGE,
      { bytes, maxBytes }
    )
  }

  const lowerText = text.toLowerCase()
  let searchFrom = 0
  while (searchFrom < text.length) {
    const start = lowerText.indexOf('data:', searchFrom)
    if (start < 0) break
    const previous = start > 0 ? text[start - 1] : ''
    if (/[a-z0-9_-]/i.test(previous)) {
      searchFrom = start + 5
      continue
    }

    const end = findDataUrlEnd(text, start)
    inspectTeamLibraryAssetSource(text.slice(start, end), {
      kind: 'logo',
      maxBytes: options.maxAssetBytes
    })
    searchFrom = end
  }

  return { bytes }
}
