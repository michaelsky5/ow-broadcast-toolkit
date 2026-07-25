export class UpstashRedisError extends Error {
  constructor(message, options = {}) {
    super(message, options)
    this.name = 'UpstashRedisError'
  }
}

const WRITE_SESSION_SCRIPT = `
local metaRaw = redis.call('GET', KEYS[1])
local revision = tonumber(ARGV[7])
local created = 1

if metaRaw then
  local ok, meta = pcall(cjson.decode, metaRaw)
  if not ok or type(meta) ~= 'table' or meta.writerHash ~= ARGV[1] then
    return {-1, 0}
  end

  revision = (tonumber(meta.revision) or 0) + 1
  created = 0
else
  local createCount = redis.call('INCR', KEYS[3])
  if createCount == 1 then
    redis.call('EXPIRE', KEYS[3], ARGV[5])
  end
  if createCount > tonumber(ARGV[6]) then
    return {-2, 0}
  end
end

local meta = {
  version = 2,
  writerHash = ARGV[1],
  revision = revision,
  updatedAt = ARGV[2]
}

redis.call('SET', KEYS[1], cjson.encode(meta), 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return {created, revision}
`.trim()

const READ_SESSION_SCRIPT = `
local metaRaw = redis.call('GET', KEYS[1])
if not metaRaw then
  return {'', ''}
end

if ARGV[1] ~= '' then
  local ok, meta = pcall(cjson.decode, metaRaw)
  if ok and type(meta) == 'table' and tostring(meta.revision) == ARGV[1] then
    if redis.call('EXISTS', KEYS[2]) == 0 then
      return {metaRaw, '__OWBT_PAYLOAD_MISSING__'}
    end
    return {metaRaw, ''}
  end
end

local payloadRaw = redis.call('GET', KEYS[2])
return {metaRaw, payloadRaw or ''}
`.trim()

export const createUpstashRedisAdapter = ({
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 4000,
  token,
  url
}) => {
  const endpoint = String(url || '').replace(/\/+$/, '')

  if (!endpoint || !token || typeof fetchImpl !== 'function') {
    throw new UpstashRedisError('Upstash Redis REST configuration is incomplete.')
  }

  const execute = async command => {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      Math.max(250, Number(requestTimeoutMs) || 4000)
    )
    let response

    try {
      response = await fetchImpl(endpoint, {
        body: JSON.stringify(command),
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        redirect: 'error',
        signal: controller.signal
      })
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? 'Upstash Redis REST request timed out.'
        : 'Upstash Redis REST request failed.'
      throw new UpstashRedisError(message, { cause: error })
    } finally {
      globalThis.clearTimeout(timeout)
    }

    let body

    try {
      body = await response.json()
    } catch (error) {
      throw new UpstashRedisError('Upstash Redis REST returned invalid JSON.', { cause: error })
    }

    if (!response.ok || body?.error) {
      throw new UpstashRedisError(`Upstash Redis REST rejected the command (${response.status}).`)
    }

    return body?.result
  }

  return {
    async readSession({ knownRevision = 0, metaKey, payloadKey }) {
      const result = await execute([
        'EVAL',
        READ_SESSION_SCRIPT,
        2,
        metaKey,
        payloadKey,
        knownRevision ? String(knownRevision) : ''
      ])

      if (!Array.isArray(result) || result.length < 2) {
        throw new UpstashRedisError('Session read returned an invalid result.')
      }

      const metaRaw = String(result[0] || '')
      const payloadRaw = String(result[1] || '')
      if (!metaRaw) return null
      if (payloadRaw === '__OWBT_PAYLOAD_MISSING__') {
        throw new UpstashRedisError('Stored session payload is missing.')
      }

      let meta
      try {
        meta = JSON.parse(metaRaw)
      } catch (error) {
        throw new UpstashRedisError('Stored session metadata is invalid JSON.', { cause: error })
      }

      if (knownRevision && Number(meta?.revision) === Number(knownRevision) && !payloadRaw) {
        return { meta, notModified: true, payload: null }
      }
      if (!payloadRaw) {
        throw new UpstashRedisError('Stored session payload is missing.')
      }

      let payload
      try {
        payload = JSON.parse(payloadRaw)
      } catch (error) {
        throw new UpstashRedisError('Stored session payload is invalid JSON.', { cause: error })
      }

      return { meta, notModified: false, payload }
    },

    async writeSession({
      metaKey,
      payload,
      payloadKey,
      creationRateKey,
      creationRateLimit,
      creationRateWindowSeconds,
      initialRevision,
      ttlSeconds,
      updatedAt,
      writerHash
    }) {
      if (!Number.isSafeInteger(initialRevision) || initialRevision < 1) {
        throw new UpstashRedisError('Session initial revision must be a positive safe integer.')
      }

      const result = await execute([
        'EVAL',
        WRITE_SESSION_SCRIPT,
        3,
        metaKey,
        payloadKey,
        creationRateKey,
        writerHash,
        updatedAt,
        JSON.stringify(payload),
        ttlSeconds,
        creationRateWindowSeconds,
        creationRateLimit,
        initialRevision
      ])

      if (!Array.isArray(result) || result.length < 2) {
        throw new UpstashRedisError('Session write returned an invalid result.')
      }

      const created = Number(result[0])
      const revision = Number(result[1])
      if (created === -1) return { unauthorized: true }
      if (created === -2) return { rateLimited: true }
      if ((created !== 0 && created !== 1) || !Number.isSafeInteger(revision) || revision < 1) {
        throw new UpstashRedisError('Session write returned invalid metadata.')
      }

      return {
        created: created === 1,
        revision
      }
    }
  }
}
