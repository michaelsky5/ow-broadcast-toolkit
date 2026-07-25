import { normalizeProject } from './projectUtils'
import {
  OWBT_PROGRAM_STORAGE_KEY,
  OWBT_STORAGE_KEY,
  saveStoredProgramProject,
  saveStoredProject
} from './projectStorage'

export const OWBT_SYNC_CHANNEL = 'owbt.project.sync.v0.1'
export const OWBT_SYNC_EVENT = 'OWBT_PROJECT_STATE'
export const OWBT_SYNC_PULSE_KEY = 'owbt.project.syncPulse.v0.1'
export const OWBT_PROGRAM_SYNC_EVENT = 'OWBT_PROGRAM_PROJECT_STATE'
export const OWBT_PROGRAM_SYNC_PULSE_KEY = 'owbt.programProject.syncPulse.v0.1'

let sharedChannel = null
let publishSeq = 0

const canUseWindow = () => typeof window !== 'undefined'
const canUseStorage = () => canUseWindow() && !!window.localStorage
const canUseBroadcastChannel = () => canUseWindow() && 'BroadcastChannel' in window

const getSharedChannel = () => {
  if (!canUseBroadcastChannel()) return null
  if (!sharedChannel) sharedChannel = new BroadcastChannel(OWBT_SYNC_CHANNEL)
  return sharedChannel
}

const readStoredRaw = storageKey => {
  if (!canUseStorage()) return ''
  try {
    return window.localStorage.getItem(storageKey) || ''
  } catch {
    return ''
  }
}

const readStoredProjectRaw = () => readStoredRaw(OWBT_STORAGE_KEY)

const readStoredProgramProjectRaw = () => readStoredRaw(OWBT_PROGRAM_STORAGE_KEY)

const readStoredFromKey = storageKey => {
  const raw = readStoredRaw(storageKey)
  if (!raw) return null

  try {
    return normalizeProject(JSON.parse(raw))
  } catch (error) {
    console.warn('[OWBT_SYNC] Failed to parse stored project:', error)
    return null
  }
}

const readStoredProject = () => readStoredFromKey(OWBT_STORAGE_KEY)

const readStoredProgramProject = () => readStoredFromKey(OWBT_PROGRAM_STORAGE_KEY)

export const createProjectPayload = (project, source = 'console', type = OWBT_SYNC_EVENT) => ({
  type,
  source,
  project,
  timestamp: Date.now(),
  sequence: ++publishSeq
})

const publishState = ({
  eventType,
  project,
  pulseKey,
  saveProject,
  source
}) => {
  if (!canUseWindow() || !project) return false

  const payload = createProjectPayload(project, source, eventType)

  saveProject(payload.project)

  try {
    window.localStorage?.setItem(pulseKey, JSON.stringify({
      type: eventType,
      source,
      timestamp: payload.timestamp,
      sequence: payload.sequence
    }))
  } catch {
    // ignore pulse failures
  }

  try {
    window.dispatchEvent(new CustomEvent(OWBT_SYNC_EVENT, { detail: payload }))
  } catch {
    // ignore custom event failures
  }

  try {
    getSharedChannel()?.postMessage(payload)
  } catch (error) {
    console.warn('[OWBT_SYNC] BroadcastChannel post failed:', error)
  }

  return true
}

export const publishProjectState = (project, source = 'console') => publishState({
  eventType: OWBT_SYNC_EVENT,
  project,
  pulseKey: OWBT_SYNC_PULSE_KEY,
  saveProject: saveStoredProject,
  source
})

export const publishProgramState = (project, source = 'console') => publishState({
  eventType: OWBT_PROGRAM_SYNC_EVENT,
  project,
  pulseKey: OWBT_PROGRAM_SYNC_PULSE_KEY,
  saveProject: saveStoredProgramProject,
  source
})

const subscribeState = ({
  callback,
  eventType,
  options,
  pulseKey,
  readStored,
  readStoredRaw,
  storageKey
}) => {
  if (!canUseWindow() || typeof callback !== 'function') return () => {}

  const ignoreSource = options.ignoreSource || ''
  const pollInterval = Number(options.pollInterval || 500)

  let lastRaw = readStoredRaw()
  let lastTimestamp = 0
  let channel = null

  const applyProject = (project, payload = {}) => {
    if (!project) return
    if (ignoreSource && payload.source === ignoreSource) return

    const timestamp = Number(payload.timestamp || 0)
    if (timestamp && lastTimestamp && timestamp < lastTimestamp) return
    if (timestamp) lastTimestamp = timestamp

    callback(normalizeProject(project), payload)
  }

  const applyPayload = payload => {
    if (!payload || payload.type !== eventType) return
    applyProject(payload.project || readStored(), payload)
  }

  const applyStoredProject = payload => {
    const raw = readStoredRaw()
    if (!raw || raw === lastRaw) return
    lastRaw = raw
    applyProject(readStored(), payload)
  }

  const handleCustomEvent = event => applyPayload(event.detail)

  const handleStorage = event => {
    if (!event.key) return

    if (event.key === storageKey) {
      applyStoredProject({
        type: eventType,
        source: 'storage',
        timestamp: Date.now()
      })
      return
    }

    if (event.key === pulseKey) {
      let pulse

      try {
        pulse = event.newValue ? JSON.parse(event.newValue) : null
      } catch {
        pulse = null
      }

      applyStoredProject({
        type: eventType,
        source: pulse?.source || 'pulse',
        timestamp: pulse?.timestamp || Date.now(),
        sequence: pulse?.sequence || ''
      })
    }
  }

  window.addEventListener(OWBT_SYNC_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorage)

  if (canUseBroadcastChannel()) {
    channel = new BroadcastChannel(OWBT_SYNC_CHANNEL)
    channel.onmessage = event => applyPayload(event.data)
  }

  const pollTimer = window.setInterval(() => {
    applyStoredProject({
      type: eventType,
      source: 'poll',
      timestamp: Date.now()
    })
  }, pollInterval)

  return () => {
    window.removeEventListener(OWBT_SYNC_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorage)
    window.clearInterval(pollTimer)

    if (channel) {
      channel.close()
      channel = null
    }
  }
}

export const subscribeProjectState = (callback, options = {}) => subscribeState({
  callback,
  eventType: OWBT_SYNC_EVENT,
  options,
  pulseKey: OWBT_SYNC_PULSE_KEY,
  readStored: readStoredProject,
  readStoredRaw: readStoredProjectRaw,
  storageKey: OWBT_STORAGE_KEY
})

export const subscribeProgramState = (callback, options = {}) => subscribeState({
  callback,
  eventType: OWBT_PROGRAM_SYNC_EVENT,
  options,
  pulseKey: OWBT_PROGRAM_SYNC_PULSE_KEY,
  readStored: readStoredProgramProject,
  readStoredRaw: readStoredProgramProjectRaw,
  storageKey: OWBT_PROGRAM_STORAGE_KEY
})
