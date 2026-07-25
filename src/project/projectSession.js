import { findUnsafeStoredMedia } from './projectStorageSafety.js'

export const OWBT_SESSION_STORAGE_KEY = 'owbt.remoteSession.v1'
export const OWBT_SESSION_SCHEMA_VERSION = 'owbt-session-v1'

const SESSION_ID_PATTERN = /^[0-9a-f]{64}$/i
const WRITER_SECRET_PATTERN = /^[0-9a-f]{64}$/i
const DEFAULT_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const DEFAULT_REQUEST_TIMEOUT_MS = 5000

const publishStates = new Map()
let publishSequence = 0

export class ProjectSessionError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ProjectSessionError'
    this.code = code
    this.status = status
  }
}

export const isValidSessionId = value => SESSION_ID_PATTERN.test(String(value || ''))

export const isValidWriterSecret = value => WRITER_SECRET_PATTERN.test(String(value || ''))

const bytesToHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export const createSessionCredentials = async (cryptoImpl = globalThis.crypto) => {
  if (!cryptoImpl?.getRandomValues) {
    throw new ProjectSessionError('SECURE_RANDOM_UNAVAILABLE', 'Secure random generation is unavailable.')
  }
  if (!cryptoImpl?.subtle?.digest) {
    throw new ProjectSessionError('SECURE_HASH_UNAVAILABLE', 'Secure SHA-256 hashing is unavailable.')
  }

  const writerBytes = new Uint8Array(32)
  cryptoImpl.getRandomValues(writerBytes)
  const writerSecret = bytesToHex(writerBytes)
  let sessionDigest

  try {
    sessionDigest = await cryptoImpl.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(writerSecret)
    )
  } catch {
    throw new ProjectSessionError('SECURE_HASH_UNAVAILABLE', 'Secure SHA-256 hashing is unavailable.')
  }

  return {
    sessionId: bytesToHex(new Uint8Array(sessionDigest)),
    writerSecret
  }
}

export const loadSessionCredentials = storage => {
  try {
    const sessionStorage = storage === undefined ? globalThis.localStorage : storage
    const value = JSON.parse(sessionStorage?.getItem(OWBT_SESSION_STORAGE_KEY) || 'null')
    if (!isValidSessionId(value?.sessionId) || !isValidWriterSecret(value?.writerSecret)) return null
    return {
      sessionId: value.sessionId,
      writerSecret: value.writerSecret
    }
  } catch {
    return null
  }
}

export const saveSessionCredentials = (credentials, storage) => {
  if (!isValidSessionId(credentials?.sessionId) || !isValidWriterSecret(credentials?.writerSecret)) {
    return false
  }

  try {
    const sessionStorage = storage === undefined ? globalThis.localStorage : storage
    if (typeof sessionStorage?.setItem !== 'function') return false
    sessionStorage.setItem(OWBT_SESSION_STORAGE_KEY, JSON.stringify(credentials))
    return true
  } catch {
    return false
  }
}

export const clearSessionCredentials = storage => {
  try {
    const sessionStorage = storage === undefined ? globalThis.localStorage : storage
    if (typeof sessionStorage?.removeItem !== 'function') return false
    sessionStorage.removeItem(OWBT_SESSION_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export const getSessionIdFromLocation = (locationLike = globalThis.location) => {
  const searchValue = String(locationLike?.search || '')
  const searchId = new URLSearchParams(searchValue).get('session')
  if (isValidSessionId(searchId)) return searchId

  const hashValue = String(locationLike?.hash || '')
  const queryIndex = hashValue.indexOf('?')
  const hashId = queryIndex >= 0
    ? new URLSearchParams(hashValue.slice(queryIndex + 1)).get('session')
    : ''

  return isValidSessionId(hashId) ? hashId : ''
}

export const buildSessionOverlayUrl = (
  sessionId,
  locationLike = globalThis.location
) => {
  if (!isValidSessionId(sessionId)) return ''

  const url = new URL(
    `${locationLike?.origin || ''}${locationLike?.pathname || '/'}`,
    locationLike?.origin || 'https://owbt.invalid'
  )
  url.search = String(locationLike?.search || '')
  url.searchParams.delete('owbt-recover')
  url.searchParams.set('session', sessionId)
  url.hash = '#overlay'
  return url.toString()
}

const normalizeRevision = value => {
  const revision = Number(String(value ?? '').trim())
  return Number.isSafeInteger(revision) && revision >= 1 ? String(revision) : ''
}

const getResponseRevision = response => {
  const etag = response.headers?.get?.('etag') || ''
  return normalizeRevision(
    String(etag)
      .replace(/^W\//i, '')
      .replace(/^"|"$/g, '')
  )
}

const parseResponse = async (response, requestedRevision = '') => {
  if (response.status === 304) {
    return {
      ok: true,
      notModified: true,
      revision: getResponseRevision(response) || requestedRevision
    }
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new ProjectSessionError(
      'INVALID_SESSION_RESPONSE',
      'The session service returned invalid JSON.',
      response.status
    )
  }

  if (!response.ok || body?.ok === false) {
    throw new ProjectSessionError(
      body?.error?.code || `SESSION_HTTP_${response.status}`,
      body?.error?.message || 'The session request failed.',
      response.status
    )
  }

  return body
}

const requestSession = async ({
  fetchImpl = globalThis.fetch,
  method = 'GET',
  payload,
  revision,
  sessionId,
  signal: externalSignal,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  writerSecret
}) => {
  if (!isValidSessionId(sessionId)) {
    throw new ProjectSessionError('INVALID_SESSION_ID', 'The session identifier is invalid.')
  }
  if (method === 'PUT' && !isValidWriterSecret(writerSecret)) {
    throw new ProjectSessionError('INVALID_WRITER_SECRET', 'The session writer secret is invalid.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new ProjectSessionError('FETCH_UNAVAILABLE', 'Network requests are unavailable.')
  }

  const controller = new AbortController()
  let didTimeout = false
  const handleExternalAbort = () => controller.abort()
  if (externalSignal?.aborted) handleExternalAbort()
  else externalSignal?.addEventListener?.('abort', handleExternalAbort, { once: true })

  const timeout = globalThis.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)
  const requestedRevision = method === 'GET' ? normalizeRevision(revision) : ''
  const requestUrl = new URL(
    `/api/session/${encodeURIComponent(sessionId)}`,
    'https://owbt.invalid'
  )
  if (requestedRevision) requestUrl.searchParams.set('revision', requestedRevision)

  try {
    const response = await fetchImpl(`${requestUrl.pathname}${requestUrl.search}`, {
      cache: 'no-store',
      headers: method === 'PUT'
        ? {
            Authorization: `Bearer ${writerSecret}`,
            'Content-Type': 'application/json'
          }
        : {
            Accept: 'application/json',
            ...(requestedRevision ? { 'If-None-Match': `"${requestedRevision}"` } : {})
          },
      method,
      ...(method === 'PUT' ? { body: JSON.stringify(payload) } : {}),
      signal: controller.signal
    })
    return await parseResponse(response, requestedRevision)
  } catch (error) {
    if (error instanceof ProjectSessionError) throw error
    if (error?.name === 'AbortError') {
      if (!didTimeout && externalSignal?.aborted) {
        throw new ProjectSessionError('SESSION_ABORTED', 'The session request was cancelled.')
      }
      throw new ProjectSessionError('SESSION_TIMEOUT', 'The session request timed out.')
    }
    throw new ProjectSessionError('SESSION_NETWORK_ERROR', 'The session service is unreachable.')
  } finally {
    globalThis.clearTimeout(timeout)
    externalSignal?.removeEventListener?.('abort', handleExternalAbort)
  }
}

export const readSessionProgramState = (sessionId, options = {}) => requestSession({
  ...options,
  method: 'GET',
  sessionId
})

const sendSessionProgramState = (credentials, project, options = {}) => {
  const unsafeMedia = findUnsafeStoredMedia(project)
  if (unsafeMedia) {
    throw new ProjectSessionError(
      unsafeMedia.kind === 'embedded-media-too-large'
        ? 'EMBEDDED_MEDIA_TOO_LARGE'
        : 'UNSAFE_EMBEDDED_MEDIA',
      'The project contains embedded media that cannot be synchronized safely.'
    )
  }

  return requestSession({
    ...options,
    method: 'PUT',
    payload: {
    schemaVersion: OWBT_SESSION_SCHEMA_VERSION,
    sequence: ++publishSequence,
    source: options.source || 'console-program',
    project,
    transitionSettings: options.transitionSettings || {}
    },
    sessionId: credentials?.sessionId,
    writerSecret: credentials?.writerSecret
  })
}

const createPublishTask = (credentials, project, options) => {
  let resolve
  let reject
  const promise = new Promise((taskResolve, taskReject) => {
    resolve = taskResolve
    reject = taskReject
  })

  return {
    credentials,
    options,
    project,
    promise,
    reject,
    resolve
  }
}

const runPublishTask = async (sessionId, state, task) => {
  try {
    task.resolve(await sendSessionProgramState(task.credentials, task.project, task.options))
  } catch (error) {
    task.reject(error)
  } finally {
    if (state.pending) {
      const pending = state.pending
      state.pending = null
      void runPublishTask(sessionId, state, pending)
    } else {
      state.inFlight = false
      if (publishStates.get(sessionId) === state) publishStates.delete(sessionId)
    }
  }
}

export const publishSessionProgramState = (credentials, project, options = {}) => {
  const sessionId = String(credentials?.sessionId || '')
  if (!isValidSessionId(sessionId)) {
    return sendSessionProgramState(credentials, project, options)
  }

  let state = publishStates.get(sessionId)

  if (!state) {
    state = { inFlight: false, pending: null }
    publishStates.set(sessionId, state)
  }

  if (!state.inFlight) {
    const task = createPublishTask(credentials, project, options)
    state.inFlight = true
    void runPublishTask(sessionId, state, task)
    return task.promise
  }

  if (state.pending) {
    state.pending.credentials = credentials
    state.pending.project = project
    state.pending.options = options
    return state.pending.promise
  }

  state.pending = createPublishTask(credentials, project, options)
  return state.pending.promise
}

export const subscribeSessionProgramState = (sessionId, callback, options = {}) => {
  if (!isValidSessionId(sessionId) || typeof callback !== 'function') return () => {}

  const requestedPollInterval = Number(options.pollInterval || DEFAULT_POLL_INTERVAL_MS)
  const pollInterval = Number.isFinite(requestedPollInterval)
    ? Math.min(
        MAX_POLL_INTERVAL_MS,
        Math.max(DEFAULT_POLL_INTERVAL_MS, requestedPollInterval)
      )
    : DEFAULT_POLL_INTERVAL_MS
  const setTimer = options.setTimeoutImpl || globalThis.setTimeout
  const clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout
  let closed = false
  let consecutiveErrors = 0
  let lastRevision = ''
  let lastUpdatedAt = ''
  let lastVersionToken = ''
  let requestController = null
  let timer = null

  const schedule = delay => {
    if (closed) return
    timer = setTimer(poll, delay)
  }

  const poll = async () => {
    requestController = new AbortController()

    try {
      const response = await readSessionProgramState(sessionId, {
        ...options,
        revision: lastRevision,
        signal: requestController.signal
      })
      if (closed) return

      if (response?.notModified) {
        consecutiveErrors = 0
        options.onStatus?.({
          state: 'online',
          revision: lastRevision,
          updatedAt: lastUpdatedAt
        })
        return
      }

      const payload = response?.payload
      if (payload?.schemaVersion !== OWBT_SESSION_SCHEMA_VERSION || !payload.project) {
        throw new ProjectSessionError(
          'INVALID_SESSION_SCHEMA',
          'The remote session payload is incompatible.'
        )
      }

      const responseRevision = normalizeRevision(response.revision)
      const responseUpdatedAt = String(response.updatedAt || '')
      const sequence = String(payload.sequence ?? '')
      const versionToken = responseRevision
        ? `revision:${responseRevision}`
        : responseUpdatedAt
          ? `updatedAt:${responseUpdatedAt}`
          : sequence
            ? `sequence:${sequence}`
            : ''

      if (!versionToken || versionToken !== lastVersionToken) {
        lastVersionToken = versionToken
        lastRevision = responseRevision
        lastUpdatedAt = responseUpdatedAt
        callback(payload.project, payload)
      }
      consecutiveErrors = 0
      options.onStatus?.({
        state: 'online',
        revision: lastRevision,
        updatedAt: lastUpdatedAt
      })
    } catch (error) {
      if (!closed) {
        if (error?.code === 'SESSION_NOT_FOUND') {
          lastRevision = ''
          lastUpdatedAt = ''
          lastVersionToken = ''
        }
        consecutiveErrors += 1
        options.onStatus?.({
          state: error.code === 'SESSION_STORE_UNAVAILABLE' ? 'unavailable' : 'offline',
          code: error.code,
          error
        })
      }
    } finally {
      requestController = null
      const retryDelay = consecutiveErrors
        ? Math.min(MAX_POLL_INTERVAL_MS, pollInterval * (2 ** consecutiveErrors))
        : pollInterval
      schedule(retryDelay)
    }
  }

  void poll()

  return () => {
    closed = true
    requestController?.abort()
    if (timer) clearTimer(timer)
  }
}
