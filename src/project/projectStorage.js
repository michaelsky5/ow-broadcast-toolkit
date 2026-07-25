import { createDefaultProject } from './defaultProject'
import { findUnsafeStoredMedia } from './projectStorageSafety'
import { normalizeProject, safeParseProject, touchProject } from './projectUtils'

export const OWBT_STORAGE_KEY = 'owbt.currentProject.v0.1'
export const OWBT_BACKUP_KEY = 'owbt.lastBackupProject.v0.1'
export const OWBT_PROGRAM_STORAGE_KEY = 'owbt.programProject.v0.1'
export const OWBT_STORAGE_ERROR_EVENT = 'owbt:storage-error'
export const OWBT_STORAGE_SUCCESS_EVENT = 'owbt:storage-success'
export const OWBT_MAX_STORED_PROJECT_BYTES = Math.floor(1.5 * 1024 * 1024)

const RECOVERABLE_PROJECT_INSPECTION_ERRORS = new Set([
  'UnsafeEmbeddedMediaError',
  'EmbeddedMediaTooLargeError',
  'ProjectTooLargeError'
])

let storageAvailability = null
let storageAvailabilityError = null

const createStorageUnavailableError = () => {
  const error = new Error('Browser storage is unavailable.')
  error.name = 'StorageUnavailableError'
  return error
}

const createProjectTooLargeError = serializedBytes => {
  const error = new Error(
    `Project size ${serializedBytes} exceeds the safe browser-storage limit ${OWBT_MAX_STORED_PROJECT_BYTES}.`
  )
  error.name = 'ProjectTooLargeError'
  return error
}

const createUnsafeMediaError = issue => {
  const error = new Error(
    issue.kind === 'embedded-media-too-large'
      ? `An embedded Data URL (${issue.bytes} bytes) exceeds the safe per-asset limit.`
      : 'Blob, Data video, and Data audio URLs cannot be persisted safely.'
  )
  error.name = issue.kind === 'embedded-media-too-large'
    ? 'EmbeddedMediaTooLargeError'
    : 'UnsafeEmbeddedMediaError'
  return error
}

export const isQuotaExceededError = error => {
  if (!error) return false

  const name = String(error.name || '')
  const code = Number(error.code || 0)

  return (
    name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22
    || code === 1014
  )
}

const getSerializedByteLength = value => {
  if (!value) return 0
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength
  return unescape(encodeURIComponent(value)).length
}

const createStorageResult = ({
  error = null,
  ok,
  operation,
  serializedBytes = 0
}) => ({
  ok,
  operation,
  name: error
    ? (isQuotaExceededError(error) ? 'QuotaExceededError' : String(error.name || 'StorageError'))
    : '',
  message: error ? String(error.message || error) : '',
  serializedBytes,
  quotaExceeded: isQuotaExceededError(error)
})

const dispatchStorageError = result => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return

  try {
    window.dispatchEvent(new CustomEvent(OWBT_STORAGE_ERROR_EVENT, {
      detail: {
        operation: result.operation,
        name: result.name,
        message: result.message,
        serializedBytes: result.serializedBytes,
        quotaExceeded: result.quotaExceeded
      }
    }))
  } catch (error) {
    console.error('[OWBT] Failed to dispatch storage error:', error)
  }
}

const dispatchStorageSuccess = result => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return

  try {
    window.dispatchEvent(new CustomEvent(OWBT_STORAGE_SUCCESS_EVENT, {
      detail: {
        operation: result.operation,
        serializedBytes: result.serializedBytes
      }
    }))
  } catch (error) {
    console.error('[OWBT] Failed to dispatch storage success:', error)
  }
}

const createFailedStorageResult = ({ error, operation, serializedBytes }) => {
  const result = createStorageResult({
    error: error || createStorageUnavailableError(),
    ok: false,
    operation,
    serializedBytes
  })
  dispatchStorageError(result)
  return result
}

export const inspectStoredProjectResult = project => {
  const operation = 'inspectStoredProject'
  if (!project) {
    return createStorageResult({
      error: new TypeError('A project is required.'),
      ok: false,
      operation
    })
  }

  let serialized

  try {
    const touchedProject = touchProject(project)
    const unsafeMedia = findUnsafeStoredMedia(touchedProject)
    if (unsafeMedia) {
      return createStorageResult({
        error: createUnsafeMediaError(unsafeMedia),
        ok: false,
        operation,
        serializedBytes: unsafeMedia.bytes
      })
    }
    serialized = JSON.stringify(touchedProject)
  } catch (error) {
    return createStorageResult({
      error,
      ok: false,
      operation
    })
  }

  const serializedBytes = getSerializedByteLength(serialized)
  if (serializedBytes > OWBT_MAX_STORED_PROJECT_BYTES) {
    return createStorageResult({
      error: createProjectTooLargeError(serializedBytes),
      ok: false,
      operation,
      serializedBytes
    })
  }

  return createStorageResult({
    ok: true,
    operation,
    serializedBytes
  })
}

export const isRecoverableStoredProjectInspection = inspection => (
  Boolean(inspection)
  && inspection.ok === false
  && RECOVERABLE_PROJECT_INSPECTION_ERRORS.has(inspection.name)
)

const saveProjectToStorage = ({ key, operation, project }) => {
  if (!project) {
    return createStorageResult({
      error: new TypeError('A project is required.'),
      ok: false,
      operation
    })
  }

  let serialized

  try {
    const touchedProject = touchProject(project)
    const unsafeMedia = findUnsafeStoredMedia(touchedProject)
    if (unsafeMedia) {
      return createFailedStorageResult({
        error: createUnsafeMediaError(unsafeMedia),
        operation,
        serializedBytes: unsafeMedia.bytes
      })
    }
    serialized = JSON.stringify(touchedProject)
  } catch (error) {
    console.error(`[OWBT] Failed to serialize project for ${operation}:`, error)
    return createFailedStorageResult({ error, operation, serializedBytes: 0 })
  }

  const serializedBytes = getSerializedByteLength(serialized)

  if (serializedBytes > OWBT_MAX_STORED_PROJECT_BYTES) {
    const error = createProjectTooLargeError(serializedBytes)
    console.error(`[OWBT] Refused oversized project for ${operation}:`, error)
    return createFailedStorageResult({ error, operation, serializedBytes })
  }

  if (!canUseStorage()) {
    const error = storageAvailabilityError || createStorageUnavailableError()
    console.error(`[OWBT] Failed to save project for ${operation}:`, error)
    return createFailedStorageResult({ error, operation, serializedBytes })
  }

  try {
    window.localStorage.setItem(key, serialized)
    const result = createStorageResult({ ok: true, operation, serializedBytes })
    dispatchStorageSuccess(result)
    return result
  } catch (error) {
    console.error(`[OWBT] Failed to save project for ${operation}:`, error)
    return createFailedStorageResult({ error, operation, serializedBytes })
  }
}

export const canUseStorage = () => {
  if (storageAvailability === true) return true

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      storageAvailability = false
      storageAvailabilityError = createStorageUnavailableError()
      return false
    }

    // Access itself throws in privacy/security modes. Avoid a probe write:
    // a full localStorage can still replace an existing value successfully.
    void window.localStorage.length
    storageAvailability = true
    storageAvailabilityError = null
    return true
  } catch (error) {
    storageAvailability = false
    storageAvailabilityError = error
    return false
  }
}

export const readStoredProjectRaw = () => {
  if (!canUseStorage()) return ''

  try {
    return window.localStorage.getItem(OWBT_STORAGE_KEY) || ''
  } catch (error) {
    console.error('[OWBT] Failed to read raw project:', error)
    return ''
  }
}

export const readStoredProgramProjectRaw = () => {
  if (!canUseStorage()) return ''

  try {
    return window.localStorage.getItem(OWBT_PROGRAM_STORAGE_KEY) || ''
  } catch (error) {
    console.error('[OWBT] Failed to read raw program project:', error)
    return ''
  }
}

export const loadStoredProject = () => {
  if (!canUseStorage()) return createDefaultProject()

  try {
    const raw = window.localStorage.getItem(OWBT_STORAGE_KEY)
    if (!raw) return createDefaultProject()
    return safeParseProject(raw) || createDefaultProject()
  } catch (error) {
    console.error('[OWBT] Failed to load stored project:', error)
    return createDefaultProject()
  }
}

export const loadStoredProgramProject = () => {
  if (!canUseStorage()) return loadStoredProject()

  try {
    const raw = window.localStorage.getItem(OWBT_PROGRAM_STORAGE_KEY)
    if (!raw) return loadStoredProject()
    return safeParseProject(raw) || loadStoredProject()
  } catch (error) {
    console.error('[OWBT] Failed to load stored Program project:', error)
    return loadStoredProject()
  }
}

export const saveStoredProjectResult = project => saveProjectToStorage({
  key: OWBT_STORAGE_KEY,
  operation: 'saveStoredProject',
  project
})

export const saveStoredProgramProjectResult = project => saveProjectToStorage({
  key: OWBT_PROGRAM_STORAGE_KEY,
  operation: 'saveStoredProgramProject',
  project
})

export const backupStoredProjectResult = project => saveProjectToStorage({
  key: OWBT_BACKUP_KEY,
  operation: 'backupStoredProject',
  project
})

export const saveStoredProject = project => saveStoredProjectResult(project).ok

export const saveStoredProgramProject = project => saveStoredProgramProjectResult(project).ok

export const backupStoredProject = project => backupStoredProjectResult(project).ok

export const loadBackupProject = () => {
  if (!canUseStorage()) return null

  try {
    const raw = window.localStorage.getItem(OWBT_BACKUP_KEY)
    if (!raw) return null

    return safeParseProject(raw)
  } catch (error) {
    console.error('[OWBT] Failed to load project backup:', error)
    return null
  }
}

export const clearStoredProject = () => {
  if (!canUseStorage()) return false

  try {
    window.localStorage.removeItem(OWBT_STORAGE_KEY)
    window.localStorage.removeItem(OWBT_PROGRAM_STORAGE_KEY)
    return true
  } catch (error) {
    console.error('[OWBT] Failed to clear project:', error)
    return false
  }
}

export const resetStoredProject = () => {
  return resetStoredProjectResult().project
}

export const resetStoredProjectResult = () => {
  const project = createDefaultProject()
  return saveProjectPairResult(project)
}

export const replaceStoredProject = project => {
  return replaceStoredProjectResult(project).project
}

export const replaceStoredProjectResult = project => {
  return saveProjectPairResult(normalizeProject(project))
}

const readRawStorageValue = key => {
  if (!canUseStorage()) throw storageAvailabilityError || createStorageUnavailableError()
  return window.localStorage.getItem(key)
}

const restoreRawStorageValue = (key, value) => {
  if (value === null) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, value)
}

function saveProjectPairResult(project) {
  let previousCurrent

  try {
    previousCurrent = readRawStorageValue(OWBT_STORAGE_KEY)
  } catch (error) {
    const current = createFailedStorageResult({
      error,
      operation: 'saveProjectPair',
      serializedBytes: 0
    })
    return {
      ok: false,
      project,
      current,
      program: current,
      rolledBack: false
    }
  }

  const current = saveStoredProjectResult(project)
  if (!current.ok) {
    return {
      ok: false,
      project,
      current,
      program: null,
      rolledBack: false
    }
  }

  const program = saveStoredProgramProjectResult(project)
  if (program.ok) {
    const result = {
      ok: true,
      project,
      current,
      program,
      rolledBack: false
    }
    dispatchStorageSuccess(createStorageResult({
      ok: true,
      operation: 'saveProjectPair',
      serializedBytes: current.serializedBytes + program.serializedBytes
    }))
    return result
  }

  try {
    restoreRawStorageValue(OWBT_STORAGE_KEY, previousCurrent)
    return {
      ok: false,
      project,
      current,
      program,
      rolledBack: true
    }
  } catch (error) {
    const rollback = createFailedStorageResult({
      error,
      operation: 'rollbackProjectPair',
      serializedBytes: 0
    })
    return {
      ok: false,
      project,
      current,
      program,
      rollback,
      rolledBack: false
    }
  }
}
