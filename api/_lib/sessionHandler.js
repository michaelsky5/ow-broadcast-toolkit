import { createHash } from 'node:crypto'
import { createUpstashRedisAdapter } from './upstashRedis.js'

export const SESSION_TTL_SECONDS = 12 * 60 * 60
export const MAX_SESSION_PAYLOAD_BYTES = 1024 * 1024
export const SESSION_SCHEMA_VERSION = 'owbt-session-v1'
export const SESSION_CREATION_LIMIT = 60
export const SESSION_CREATION_WINDOW_SECONDS = 24 * 60 * 60

const SESSION_ID_PATTERN = /^[0-9a-f]{64}$/i
const WRITER_SECRET_PATTERN = /^[0-9a-f]{64}$/i
const SESSION_KEY_PREFIX = 'owbt:session:v2:'

class RequestError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.code = code
  }
}

const getHeader = (request, name) => {
  if (typeof request.headers?.get === 'function') {
    return request.headers.get(name) || ''
  }

  const key = name.toLowerCase()
  const value = request.headers?.[key] ?? request.headers?.[name]
  return Array.isArray(value) ? value[0] || '' : String(value || '')
}

const setResponseHeaders = (response, extraHeaders = {}) => {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Content-Type': 'application/json; charset=utf-8',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  }

  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value))
}

const sendJson = (response, status, body, extraHeaders) => {
  response.statusCode = status
  setResponseHeaders(response, extraHeaders)
  response.end(JSON.stringify(body))
}

const sendEmpty = (response, status, extraHeaders) => {
  response.statusCode = status
  setResponseHeaders(response, extraHeaders)
  response.end()
}

const sendError = (response, status, code, message, extraHeaders) => sendJson(
  response,
  status,
  { ok: false, error: { code, message } },
  extraHeaders
)

const getStoreConfig = env => {
  const url = String(env?.UPSTASH_REDIS_REST_URL || '').trim()
  const token = String(env?.UPSTASH_REDIS_REST_TOKEN || '').trim()
  if (!url || !token) return null

  try {
    if (new URL(url).protocol !== 'https:') return null
  } catch {
    return null
  }

  return { token, url }
}

const isSameOriginRequest = request => {
  const fetchSite = getHeader(request, 'sec-fetch-site').toLowerCase()
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false

  const origin = getHeader(request, 'origin')
  if (!origin) return true

  const host = (
    getHeader(request, 'x-forwarded-host')
    || getHeader(request, 'host')
  ).split(',')[0].trim()
  if (!host) return false

  const forwardedProtocol = getHeader(request, 'x-forwarded-proto').split(',')[0].trim()
  const protocol = forwardedProtocol || (request.socket?.encrypted ? 'https' : 'https')

  try {
    return new URL(origin).origin === `${protocol}://${host}`
  } catch {
    return false
  }
}

const requireBrowserWriteOrigin = request => {
  if (!getHeader(request, 'origin')) {
    throw new RequestError(
      403,
      'BROWSER_ORIGIN_REQUIRED',
      'Session writes require a same-origin browser request.'
    )
  }
}

const parseSessionId = request => {
  const value = request.query?.sessionId
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    throw new RequestError(400, 'INVALID_SESSION_ID', 'sessionId must be a 64-character hexadecimal token.')
  }
  return value.toLowerCase()
}

const parseWriterSecret = request => {
  const authorization = getHeader(request, 'authorization')
  const match = authorization.match(/^Bearer ([0-9a-f]{64})$/i)

  if (!match || !WRITER_SECRET_PATTERN.test(match[1])) {
    throw new RequestError(
      401,
      'INVALID_WRITER_SECRET',
      'A 64-character hexadecimal Bearer writer secret is required.'
    )
  }

  return match[1].toLowerCase()
}

const parseKnownRevision = request => {
  const queryRevision = request.query?.revision
  if (queryRevision !== undefined && queryRevision !== '') {
    const value = Number(queryRevision)
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RequestError(400, 'INVALID_REVISION', 'revision must be a positive integer.')
    }
    return value
  }

  const etag = getHeader(request, 'if-none-match').trim()
  const match = etag.match(/^(?:W\/)?"([1-9]\d*)"$/)
  return match ? Number(match[1]) : 0
}

const getByteLength = value => new TextEncoder().encode(value).byteLength

const readStreamBody = async request => {
  if (!request?.[Symbol.asyncIterator]) return ''

  const decoder = new TextDecoder()
  let body = ''
  let receivedBytes = 0

  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      receivedBytes += getByteLength(chunk)
      body += chunk
    } else {
      receivedBytes += chunk.byteLength
      body += decoder.decode(chunk, { stream: true })
    }

    if (receivedBytes > MAX_SESSION_PAYLOAD_BYTES) {
      throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Session payload exceeds 1 MiB.')
    }
  }

  return body + decoder.decode()
}

const validateSessionPayload = payload => {
  if (
    payload?.schemaVersion !== SESSION_SCHEMA_VERSION
    || !payload.project
    || typeof payload.project !== 'object'
    || Array.isArray(payload.project)
    || !payload.transitionSettings
    || typeof payload.transitionSettings !== 'object'
    || Array.isArray(payload.transitionSettings)
  ) {
    throw new RequestError(
      400,
      'INVALID_SESSION_SCHEMA',
      `Session payload must use ${SESSION_SCHEMA_VERSION} and include project and transitionSettings objects.`
    )
  }
}

const readPayload = async request => {
  const contentType = getHeader(request, 'content-type').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    throw new RequestError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.')
  }

  const contentLength = getHeader(request, 'content-length')
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      throw new RequestError(400, 'INVALID_CONTENT_LENGTH', 'Content-Length is invalid.')
    }
    if (Number(contentLength) > MAX_SESSION_PAYLOAD_BYTES) {
      throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Session payload exceeds 1 MiB.')
    }
  }

  let payload
  try {
    payload = request.body
  } catch {
    throw new RequestError(400, 'INVALID_JSON', 'Request body must contain valid JSON.')
  }
  if (payload === undefined) payload = await readStreamBody(request)
  if (payload instanceof Uint8Array) payload = new TextDecoder().decode(payload)

  if (typeof payload === 'string') {
    if (getByteLength(payload) > MAX_SESSION_PAYLOAD_BYTES) {
      throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Session payload exceeds 1 MiB.')
    }

    try {
      payload = JSON.parse(payload)
    } catch {
      throw new RequestError(400, 'INVALID_JSON', 'Request body must contain valid JSON.')
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestError(400, 'INVALID_PAYLOAD', 'Session payload must be a JSON object.')
  }

  let serialized
  try {
    serialized = JSON.stringify(payload)
  } catch {
    throw new RequestError(400, 'INVALID_PAYLOAD', 'Session payload must be JSON serializable.')
  }

  if (getByteLength(serialized) > MAX_SESSION_PAYLOAD_BYTES) {
    throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Session payload exceeds 1 MiB.')
  }

  validateSessionPayload(payload)
  return payload
}

const hashWriterSecret = secret => createHash('sha256').update(secret).digest('hex')

const getCreationRateKey = request => {
  const forwardedFor = (
    getHeader(request, 'x-vercel-forwarded-for')
    || getHeader(request, 'x-forwarded-for')
    || getHeader(request, 'x-real-ip')
    || 'unknown'
  ).split(',')[0].trim()
  const clientHash = createHash('sha256').update(forwardedFor).digest('hex').slice(0, 32)
  return `${SESSION_KEY_PREFIX}create-rate:${clientHash}`
}

const isStoredMeta = value => (
  value
  && value.version === 2
  && typeof value.updatedAt === 'string'
  && typeof value.writerHash === 'string'
  && /^[0-9a-f]{64}$/i.test(value.writerHash)
  && Number.isSafeInteger(value.revision)
  && value.revision >= 1
)

const isStoredPayload = value => {
  try {
    validateSessionPayload(value)
    return true
  } catch {
    return false
  }
}

const sessionResponse = (sessionId, meta, payload) => ({
  ok: true,
  sessionId,
  ...(payload ? { payload } : {}),
  revision: meta.revision,
  updatedAt: meta.updatedAt,
  expiresIn: SESSION_TTL_SECONDS
})

export const createSessionHandler = ({
  env = globalThis.process?.env || {},
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  storeFactory = createUpstashRedisAdapter
} = {}) => async (request, response) => {
  const method = String(request.method || '').toUpperCase()

  if (method !== 'GET' && method !== 'PUT') {
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Only GET and PUT are supported.', { Allow: 'GET, PUT' })
    return
  }

  try {
    if (!isSameOriginRequest(request)) {
      throw new RequestError(403, 'CROSS_ORIGIN_REQUEST', 'Cross-origin requests are not allowed.')
    }
    if (method === 'PUT') requireBrowserWriteOrigin(request)

    const sessionId = parseSessionId(request)
    const config = getStoreConfig(env)
    if (!config) {
      sendError(
        response,
        503,
        'SESSION_STORE_UNAVAILABLE',
        'Session storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      )
      return
    }

    const store = storeFactory({ ...config, fetchImpl })
    const keyBase = `${SESSION_KEY_PREFIX}${sessionId}`
    const metaKey = `${keyBase}:meta`
    const payloadKey = `${keyBase}:payload`

    if (method === 'GET') {
      const knownRevision = parseKnownRevision(request)
      const session = await store.readSession({
        knownRevision,
        metaKey,
        payloadKey
      })

      if (!session) {
        sendError(response, 404, 'SESSION_NOT_FOUND', 'Session was not found or has expired.')
        return
      }
      const { meta, payload } = session
      if (!isStoredMeta(meta)) throw new Error('Stored session metadata is malformed.')

      const responseHeaders = { ETag: `"${meta.revision}"` }
      if (session.notModified) {
        sendEmpty(response, 304, responseHeaders)
        return
      }

      if (!isStoredPayload(payload)) throw new Error('Stored session payload is malformed.')
      sendJson(response, 200, sessionResponse(sessionId, meta, payload), responseHeaders)
      return
    }

    const writerSecret = parseWriterSecret(request)
    if (hashWriterSecret(writerSecret) !== sessionId) {
      throw new RequestError(401, 'INVALID_WRITER_SECRET', 'Writer secret does not match this session.')
    }

    const payload = await readPayload(request)
    const initialRevision = Number(now())
    if (!Number.isSafeInteger(initialRevision) || initialRevision < 1) {
      throw new Error('Session clock did not provide a positive safe integer.')
    }
    const updatedAt = new Date(initialRevision).toISOString()
    const outcome = await store.writeSession({
      creationRateKey: getCreationRateKey(request),
      creationRateLimit: SESSION_CREATION_LIMIT,
      creationRateWindowSeconds: SESSION_CREATION_WINDOW_SECONDS,
      initialRevision,
      metaKey,
      payload,
      payloadKey,
      ttlSeconds: SESSION_TTL_SECONDS,
      updatedAt,
      writerHash: sessionId
    })

    if (outcome?.unauthorized) {
      throw new RequestError(401, 'INVALID_WRITER_SECRET', 'Writer secret does not match this session.')
    }
    if (outcome?.rateLimited) {
      sendError(
        response,
        429,
        'SESSION_CREATION_RATE_LIMITED',
        'Too many sessions were created from this network. Reuse the existing OBS URL or try again later.',
        { 'Retry-After': String(SESSION_CREATION_WINDOW_SECONDS) }
      )
      return
    }
    if (!Number.isSafeInteger(outcome?.revision) || outcome.revision < 1) {
      throw new Error('Session store did not confirm the update.')
    }

    const meta = {
      version: 2,
      writerHash: sessionId,
      revision: outcome.revision,
      updatedAt
    }
    sendJson(
      response,
      outcome.created ? 201 : 200,
      {
        ...sessionResponse(sessionId, meta),
        created: Boolean(outcome.created)
      },
      { ETag: `"${outcome.revision}"` }
    )
  } catch (error) {
    if (error instanceof RequestError) {
      sendError(response, error.status, error.code, error.message)
      return
    }

    console.error('[OWBT_SESSION] Session store request failed:', error)
    sendError(response, 503, 'SESSION_STORE_UNAVAILABLE', 'Session storage is temporarily unavailable.')
  }
}
