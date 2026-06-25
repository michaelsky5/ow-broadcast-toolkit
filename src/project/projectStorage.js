import { createDefaultProject } from './defaultProject'
import { normalizeProject, safeParseProject, touchProject } from './projectUtils'

export const OWBT_STORAGE_KEY = 'fries-cup.currentProject.v0.1'
export const OWBT_BACKUP_KEY = 'fries-cup.lastBackupProject.v0.1'
export const OWBT_PROGRAM_STORAGE_KEY = 'fries-cup.programProject.v0.1'

let storageAvailability = null

export const canUseStorage = () => {
  if (storageAvailability !== null) return storageAvailability

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      storageAvailability = false
      return false
    }

    const testKey = '__owbt_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    storageAvailability = true
    return true
  } catch {
    storageAvailability = false
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

  const raw = window.localStorage.getItem(OWBT_STORAGE_KEY)
  if (!raw) return createDefaultProject()

  const project = safeParseProject(raw)
  return project || createDefaultProject()
}

export const loadStoredProgramProject = () => {
  if (!canUseStorage()) return loadStoredProject()

  const raw = window.localStorage.getItem(OWBT_PROGRAM_STORAGE_KEY)
  if (!raw) return loadStoredProject()

  const project = safeParseProject(raw)
  return project || loadStoredProject()
}

export const saveStoredProject = project => {
  if (!canUseStorage() || !project) return false

  try {
    const finalProject = touchProject(project)
    window.localStorage.setItem(OWBT_STORAGE_KEY, JSON.stringify(finalProject))
    return true
  } catch (error) {
    console.error('[OWBT] Failed to save project:', error)
    return false
  }
}

export const saveStoredProgramProject = project => {
  if (!canUseStorage() || !project) return false

  try {
    const finalProject = touchProject(project)
    window.localStorage.setItem(OWBT_PROGRAM_STORAGE_KEY, JSON.stringify(finalProject))
    return true
  } catch (error) {
    console.error('[OWBT] Failed to save program project:', error)
    return false
  }
}

export const backupStoredProject = project => {
  if (!canUseStorage() || !project) return false

  try {
    window.localStorage.setItem(OWBT_BACKUP_KEY, JSON.stringify(touchProject(project)))
    return true
  } catch (error) {
    console.error('[OWBT] Failed to backup project:', error)
    return false
  }
}

export const loadBackupProject = () => {
  if (!canUseStorage()) return null

  const raw = window.localStorage.getItem(OWBT_BACKUP_KEY)
  if (!raw) return null

  return safeParseProject(raw)
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
  const project = createDefaultProject()
  saveStoredProject(project)
  saveStoredProgramProject(project)
  return project
}

export const replaceStoredProject = project => {
  const normalized = normalizeProject(project)
  saveStoredProject(normalized)
  saveStoredProgramProject(normalized)
  return normalized
}
