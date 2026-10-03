import { createDefaultProject, PROJECT_SCHEMA_VERSION } from './defaultProject'

export const MAX_PROJECT_IMPORT_BYTES = 64 * 1024 * 1024
export const PROJECT_IMPORT_ERROR_CODES = {
  INVALID_JSON: 'INVALID_JSON',
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  WRONG_PACKAGE: 'WRONG_PACKAGE',
  WRONG_LIBRARY: 'WRONG_LIBRARY',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  TOO_LARGE: 'TOO_LARGE'
}

export class ProjectImportError extends Error {
  constructor(code, path = '') {
    super(`Invalid OWBT project: ${code}${path ? ` (${path})` : ''}`)
    this.name = 'ProjectImportError'
    this.code = code
    this.path = path
  }
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalidStructure = path => { throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.INVALID_STRUCTURE, path) }
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

// Validate supplied fields before merging defaults. Missing optional fields in old
// projects can still be filled by normalizeProject; malformed containers cannot.
const validateShape = (value, template, path) => {
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) invalidStructure(path)
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`
      if (template.length) validateShape(item, template[0], itemPath)
      else if (item === null || Array.isArray(item)) invalidStructure(itemPath)
    })
    return
  }
  if (isRecord(template)) {
    if (!isRecord(value)) invalidStructure(path)
    Object.entries(template).forEach(([key, childTemplate]) => {
      if (hasOwn(value, key)) validateShape(value[key], childTemplate, path ? `${path}.${key}` : key)
    })
    return
  }
  // Snapshots are optional objects whose default is null.
  if (template === null) {
    if (value !== null && !isRecord(value)) invalidStructure(path)
    return
  }
  if (typeof template === 'number') {
    if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value))) invalidStructure(path)
    return
  }
  if (typeof template === 'boolean') {
    if (typeof value !== 'boolean') invalidStructure(path)
    return
  }
  if (typeof value !== 'string') {
    // Earlier data-board exports may contain numeric stat values.
    if (!/\.metrics\[\d+\]\.team[AB]$/.test(path) || typeof value !== 'number' || !Number.isFinite(value)) invalidStructure(path)
  }
}

const validateAdditionalContainers = project => {
  for (const [index, map] of (project.currentMatch?.mapLineup || []).entries()) {
    for (const key of ['bansA', 'bansB']) {
      if (hasOwn(map, key) && (!Array.isArray(map[key]) || map[key].some(id => typeof id !== 'string'))) {
        invalidStructure(`currentMatch.mapLineup[${index}].${key}`)
      }
    }
  }
  for (const [index, snapshot] of (project.scenes?.settings?.stats?.mapSnapshots || []).entries()) {
    if (!isRecord(snapshot)) invalidStructure(`scenes.settings.stats.mapSnapshots[${index}]`)
    for (const key of ['ocrRows', 'playerIds']) {
      if (!hasOwn(snapshot, key)) continue
      if (!isRecord(snapshot[key])) invalidStructure(`scenes.settings.stats.mapSnapshots[${index}].${key}`)
      for (const side of ['teamA', 'teamB']) {
        if (hasOwn(snapshot[key], side) && !Array.isArray(snapshot[key][side])) {
          invalidStructure(`scenes.settings.stats.mapSnapshots[${index}].${key}.${side}`)
        }
      }
    }
    if (hasOwn(snapshot, 'metrics') && !Array.isArray(snapshot.metrics)) invalidStructure(`scenes.settings.stats.mapSnapshots[${index}].metrics`)
  }
}

export const parseProjectData = (text, { importing = false } = {}) => {
  if (typeof text !== 'string') invalidStructure('project')
  if (importing && (text.length > MAX_PROJECT_IMPORT_BYTES || new TextEncoder().encode(text).byteLength > MAX_PROJECT_IMPORT_BYTES)) {
    throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.TOO_LARGE)
  }
  let data
  try {
    data = JSON.parse(text.trim(), (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') invalidStructure(key)
      return value
    })
  } catch (error) {
    if (error instanceof ProjectImportError) throw error
    throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.INVALID_JSON)
  }
  if (!isRecord(data)) invalidStructure('project')
  if (String(data.schemaVersion || '').startsWith('owbt-match-package-')) throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.WRONG_PACKAGE)
  if (String(data.schemaVersion || '').startsWith('owbt-team-library-')) throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.WRONG_LIBRARY)
  if ((importing || hasOwn(data, 'schemaVersion')) && data.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectImportError(PROJECT_IMPORT_ERROR_CODES.UNSUPPORTED_VERSION)
  }
  if (importing) {
    for (const key of ['event', 'teams', 'players', 'currentMatch', 'scenes']) {
      if (!hasOwn(data, key)) invalidStructure(key)
    }
  }
  if (!['event', 'currentMatch', 'teams', 'scenes'].some(key => hasOwn(data, key))) invalidStructure('project')
  validateShape(data, createDefaultProject(), '')
  validateAdditionalContainers(data)
  return data
}
