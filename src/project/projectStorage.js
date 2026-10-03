import { createDefaultProject } from './defaultProject'
import { normalizeProject, safeParseProject, touchProject } from './projectUtils'

export const OWBT_STORAGE_KEY = 'owbt.currentProject.v0.1'
export const OWBT_BACKUP_KEY = 'owbt.lastBackupProject.v0.1'
export const OWBT_PROGRAM_STORAGE_KEY = 'owbt.programProject.v0.1'

const loadIssues = new Map()
export const getProjectLoadIssues = () => [...loadIssues]
  .filter(([key]) => key === OWBT_STORAGE_KEY || key === OWBT_PROGRAM_STORAGE_KEY)
  .map(([key, issue]) => ({ key, reason: issue.reason }))
export const isProjectReadBlocked = key => loadIssues.has(key)
export const getUnrestoredProjectText = key => loadIssues.get(key)?.raw || ''

export const canUseStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const testKey = '__owbt_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

const readRaw = key => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return ''
    return window.localStorage.getItem(key) || ''
  } catch (error) {
    console.error('[OWBT] Failed to read project storage:', error)
    return ''
  }
}

export const readStoredProjectRaw = () => readRaw(OWBT_STORAGE_KEY)
export const readStoredProgramProjectRaw = () => readRaw(OWBT_PROGRAM_STORAGE_KEY)

const loadProject = (key, missingFallback, failedFallback = createDefaultProject) => {
  let raw
  try {
    if (typeof window === 'undefined') return missingFallback()
    if (!window.localStorage) throw new Error('Project storage is unavailable.')
    raw = window.localStorage.getItem(key)
  } catch (error) {
    loadIssues.set(key, { reason: 'unavailable' })
    console.error('[OWBT] Failed to load project storage:', error)
    return failedFallback()
  }
  if (!raw) {
    loadIssues.delete(key)
    return missingFallback()
  }
  const project = safeParseProject(raw)
  if (!project) {
    loadIssues.set(key, { reason: 'invalid', raw })
    return failedFallback()
  }
  loadIssues.delete(key)
  return project
}

export const loadStoredProject = () => loadProject(OWBT_STORAGE_KEY, createDefaultProject)
export const loadStoredProgramProject = () => loadProject(OWBT_PROGRAM_STORAGE_KEY, loadStoredProject)

const saveProject = (key, project) => {
  if (!project || isProjectReadBlocked(key)) return false
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    window.localStorage.setItem(key, JSON.stringify(touchProject(project)))
    return true
  } catch (error) {
    console.error('[OWBT] Failed to save project:', error)
    return false
  }
}

export const saveStoredProject = project => saveProject(OWBT_STORAGE_KEY, project)
export const saveStoredProgramProject = project => saveProject(OWBT_PROGRAM_STORAGE_KEY, project)
export const backupStoredProject = project => saveProject(OWBT_BACKUP_KEY, project)
export const loadBackupProject = () => loadProject(OWBT_BACKUP_KEY, () => null, () => null)

export const clearStoredProject = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    window.localStorage.removeItem(OWBT_STORAGE_KEY)
    window.localStorage.removeItem(OWBT_PROGRAM_STORAGE_KEY)
    loadIssues.delete(OWBT_STORAGE_KEY)
    loadIssues.delete(OWBT_PROGRAM_STORAGE_KEY)
    return true
  } catch (error) {
    console.error('[OWBT] Failed to clear project:', error)
    return false
  }
}

export const replaceStoredProject = project => {
  const normalized = normalizeProject(project)
  // This path follows an explicit import/reset confirmation, unlike autosave.
  loadIssues.delete(OWBT_STORAGE_KEY)
  loadIssues.delete(OWBT_PROGRAM_STORAGE_KEY)
  saveStoredProject(normalized)
  saveStoredProgramProject(normalized)
  return normalized
}

export const resetStoredProject = () => replaceStoredProject(createDefaultProject())
