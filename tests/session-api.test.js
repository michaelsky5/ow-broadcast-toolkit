import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, test } from 'node:test'
import {
  MAX_SESSION_PAYLOAD_BYTES,
  SESSION_CREATION_LIMIT,
  SESSION_CREATION_WINDOW_SECONDS,
  SESSION_SCHEMA_VERSION,
  SESSION_TTL_SECONDS,
  createSessionHandler
} from '../api/_lib/sessionHandler.js'
import { createUpstashRedisAdapter } from '../api/_lib/upstashRedis.js'

const WRITER_SECRET = '0123456789abcdef'.repeat(4)
const OTHER_SECRET = 'fedcba9876543210'.repeat(4)
const SESSION_ID = createHash('sha256').update(WRITER_SECRET).digest('hex')
const TEST_NOW_MS = Date.parse('2026-07-25T12:00:00.000Z')
const ENV = {
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'server-only-token'
}
const SAME_ORIGIN_HEADERS = {
  host: 'owbt.fries-cup.com',
  origin: 'https://owbt.fries-cup.com',
  'sec-fetch-site': 'same-origin',
  'x-vercel-forwarded-for': '203.0.113.10',
  'x-forwarded-proto': 'https'
}

const createPayload = sequence => ({
  schemaVersion: SESSION_SCHEMA_VERSION,
  sequence,
  source: 'test',
  project: { event: { name: 'Fries Cup' }, sequence },
  transitionSettings: {}
})

const createStore = () => {
  const meta = new Map()
  const payloads = new Map()
  const writes = []
  let payloadReads = 0

  return {
    meta,
    payloads,
    writes,
    get payloadReads() {
      return payloadReads
    },
    async readSession({ knownRevision, metaKey, payloadKey }) {
      if (!meta.has(metaKey)) return null
      const storedMeta = structuredClone(meta.get(metaKey))
      if (knownRevision && Number(knownRevision) === storedMeta.revision) {
        return {
          meta: storedMeta,
          notModified: true,
          payload: null
        }
      }

      payloadReads += 1
      return {
        meta: storedMeta,
        notModified: false,
        payload: payloads.has(payloadKey) ? structuredClone(payloads.get(payloadKey)) : null
      }
    },
    async writeSession(value) {
      writes.push(structuredClone(value))
      const existing = meta.get(value.metaKey)
      if (existing && existing.writerHash !== value.writerHash) return { unauthorized: true }

      const revision = existing
        ? Number(existing.revision) + 1
        : value.initialRevision
      meta.set(value.metaKey, {
        version: 2,
        writerHash: value.writerHash,
        revision,
        updatedAt: value.updatedAt
      })
      payloads.set(value.payloadKey, structuredClone(value.payload))
      return {
        created: !existing,
        revision
      }
    }
  }
}

const createResponse = () => {
  const headers = new Map()

  return {
    body: '',
    headers,
    statusCode: 0,
    end(value = '') {
      this.body = String(value)
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value))
    }
  }
}

const invoke = async (handler, {
  body,
  headers = {},
  method = 'GET',
  query = {},
  sessionId = SESSION_ID
} = {}) => {
  const response = createResponse()
  await handler({
    body,
    headers,
    method,
    query: { sessionId, ...query }
  }, response)

  return {
    body: response.body ? JSON.parse(response.body) : null,
    headers: response.headers,
    status: response.statusCode
  }
}

const createTestHandler = (store, options = {}) => createSessionHandler({
  env: ENV,
  now: () => TEST_NOW_MS,
  storeFactory: () => store,
  ...options
})

const putSession = (handler, {
  payload = createPayload(1),
  secret = WRITER_SECRET,
  sessionId = SESSION_ID
} = {}) => invoke(handler, {
  body: payload,
  headers: {
    ...SAME_ORIGIN_HEADERS,
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json'
  },
  method: 'PUT',
  sessionId
})

describe('HTTPS session API', () => {
  test('fails clearly without Upstash env and never creates a fallback store', async () => {
    let storeFactoryCalls = 0
    const handler = createSessionHandler({
      env: {},
      storeFactory: () => {
        storeFactoryCalls += 1
        return createStore()
      }
    })

    const result = await invoke(handler)

    assert.equal(result.status, 503)
    assert.equal(result.body.error.code, 'SESSION_STORE_UNAVAILABLE')
    assert.match(result.body.error.message, /UPSTASH_REDIS_REST_URL/)
    assert.equal(storeFactoryCalls, 0)
    assert.match(result.headers.get('cache-control'), /no-store/)
  })

  test('rejects invalid ids, cross-origin requests, and origin-less writes', async () => {
    const handler = createTestHandler(createStore())

    const invalidId = await invoke(handler, { sessionId: 'predictable-room' })
    assert.equal(invalidId.status, 400)
    assert.equal(invalidId.body.error.code, 'INVALID_SESSION_ID')

    const crossOrigin = await invoke(handler, {
      headers: {
        host: 'owbt.fries-cup.com',
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
        'x-forwarded-proto': 'https'
      }
    })
    assert.equal(crossOrigin.status, 403)
    assert.equal(crossOrigin.body.error.code, 'CROSS_ORIGIN_REQUEST')

    const noOriginWrite = await invoke(handler, {
      body: createPayload(1),
      headers: {
        authorization: `Bearer ${WRITER_SECRET}`,
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
    assert.equal(noOriginWrite.status, 403)
    assert.equal(noOriginWrite.body.error.code, 'BROWSER_ORIGIN_REQUIRED')
  })

  test('binds the session id to the writer secret and atomically advances revisions', async () => {
    const store = createStore()
    const handler = createTestHandler(store)

    const created = await putSession(handler)
    assert.equal(created.status, 201)
    assert.equal(created.body.created, true)
    assert.equal(created.body.revision, TEST_NOW_MS)
    assert.equal('payload' in created.body, false)
    assert.equal(created.body.expiresIn, SESSION_TTL_SECONDS)
    assert.equal(store.writes[0].ttlSeconds, 12 * 60 * 60)
    assert.equal(store.writes[0].initialRevision, TEST_NOW_MS)
    assert.equal(store.writes[0].writerHash, SESSION_ID)
    assert.equal(JSON.stringify(store.writes[0]).includes(WRITER_SECRET), false)

    const wrongSecret = await putSession(handler, {
      payload: createPayload(2),
      secret: OTHER_SECRET
    })
    assert.equal(wrongSecret.status, 401)
    assert.equal(wrongSecret.body.error.code, 'INVALID_WRITER_SECRET')

    const updated = await putSession(handler, { payload: createPayload(3) })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.created, false)
    assert.equal(updated.body.revision, TEST_NOW_MS + 1)
  })

  test('returns a payload only when its revision changed', async () => {
    const store = createStore()
    const handler = createTestHandler(store)
    await putSession(handler)

    const initial = await invoke(handler)
    assert.equal(initial.status, 200)
    assert.deepEqual(initial.body.payload, createPayload(1))
    assert.equal(initial.body.revision, TEST_NOW_MS)
    assert.equal(initial.headers.get('etag'), `"${TEST_NOW_MS}"`)
    assert.equal(store.payloadReads, 1)

    const unchanged = await invoke(handler, {
      headers: { 'if-none-match': `"${TEST_NOW_MS}"` },
      query: { revision: String(TEST_NOW_MS) }
    })
    assert.equal(unchanged.status, 304)
    assert.equal(unchanged.body, null)
    assert.equal(store.payloadReads, 1)
    assert.match(unchanged.headers.get('cache-control'), /no-store/)

    await putSession(handler, { payload: createPayload(2) })
    const changed = await invoke(handler, { query: { revision: String(TEST_NOW_MS) } })
    assert.equal(changed.status, 200)
    assert.equal(changed.body.revision, TEST_NOW_MS + 1)
    assert.deepEqual(changed.body.payload, createPayload(2))
    assert.equal(store.payloadReads, 2)
  })

  test('does not reuse a revision when an expired session is recreated between polls', async () => {
    const store = createStore()
    let currentTime = TEST_NOW_MS
    const handler = createTestHandler(store, { now: () => currentTime })

    const created = await putSession(handler, { payload: createPayload(1) })
    const expiredRevision = created.body.revision

    store.meta.clear()
    store.payloads.clear()
    currentTime += (SESSION_TTL_SECONDS * 1000) + 1

    const recreated = await putSession(handler, { payload: createPayload(2) })
    assert.equal(recreated.status, 201)
    assert.equal(recreated.body.created, true)
    assert.equal(recreated.body.revision, currentTime)
    assert.notEqual(recreated.body.revision, expiredRevision)

    const nextPoll = await invoke(handler, {
      query: { revision: String(expiredRevision) }
    })
    assert.equal(nextPoll.status, 200)
    assert.equal(nextPoll.body.revision, currentTime)
    assert.deepEqual(nextPoll.body.payload, createPayload(2))
  })

  test('returns 429 when the atomic creation quota is exhausted', async () => {
    const store = createStore()
    store.writeSession = async () => ({ rateLimited: true })
    const handler = createTestHandler(store)

    const result = await putSession(handler)

    assert.equal(result.status, 429)
    assert.equal(result.body.error.code, 'SESSION_CREATION_RATE_LIMITED')
    assert.equal(
      result.headers.get('retry-after'),
      String(SESSION_CREATION_WINDOW_SECONDS)
    )
  })

  test('rejects invalid schemas and payloads larger than 1 MiB before writing', async () => {
    const store = createStore()
    const handler = createTestHandler(store)

    const wrongType = await invoke(handler, {
      body: 'hello',
      headers: {
        ...SAME_ORIGIN_HEADERS,
        authorization: `Bearer ${WRITER_SECRET}`,
        'content-type': 'text/plain'
      },
      method: 'PUT'
    })
    assert.equal(wrongType.status, 415)

    const invalidSchema = await putSession(handler, { payload: { project: {} } })
    assert.equal(invalidSchema.status, 400)
    assert.equal(invalidSchema.body.error.code, 'INVALID_SESSION_SCHEMA')

    const tooLarge = await putSession(handler, {
      payload: {
        ...createPayload(1),
        data: 'x'.repeat(MAX_SESSION_PAYLOAD_BYTES)
      }
    })
    assert.equal(tooLarge.status, 413)
    assert.equal(tooLarge.body.error.code, 'PAYLOAD_TOO_LARGE')
    assert.equal(store.writes.length, 0)
  })

  test('returns INVALID_JSON when the Vercel request body getter rejects malformed JSON', async () => {
    const store = createStore()
    const handler = createTestHandler(store)
    const response = createResponse()
    const request = {
      headers: {
        ...SAME_ORIGIN_HEADERS,
        authorization: `Bearer ${WRITER_SECRET}`,
        'content-type': 'application/json'
      },
      method: 'PUT',
      query: { sessionId: SESSION_ID }
    }
    Object.defineProperty(request, 'body', {
      get() {
        throw new SyntaxError('Malformed JSON')
      }
    })

    await handler(request, response)

    assert.equal(response.statusCode, 400)
    assert.equal(JSON.parse(response.body).error.code, 'INVALID_JSON')
    assert.equal(store.writes.length, 0)
  })

  test('uses one atomic Upstash EVAL for metadata and payload with a hard timeout signal', async () => {
    const requests = []
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: [1, TEST_NOW_MS] })
      }
    }
    const redis = createUpstashRedisAdapter({
      fetchImpl,
      token: 'upstash-token',
      url: 'https://example.upstash.io/'
    })
    const writeOptions = {
      metaKey: 'session:meta',
      payload: createPayload(1),
      payloadKey: 'session:payload',
      creationRateKey: 'session:create-rate',
      creationRateLimit: SESSION_CREATION_LIMIT,
      creationRateWindowSeconds: SESSION_CREATION_WINDOW_SECONDS,
      initialRevision: TEST_NOW_MS,
      ttlSeconds: SESSION_TTL_SECONDS,
      updatedAt: '2026-07-25T12:00:00.000Z',
      writerHash: SESSION_ID
    }

    const result = await redis.writeSession(writeOptions)

    assert.deepEqual(result, { created: true, revision: TEST_NOW_MS })
    assert.equal(requests[0].url, 'https://example.upstash.io')
    assert.equal(requests[0].options.headers.Authorization, 'Bearer upstash-token')
    assert.ok(requests[0].options.signal instanceof AbortSignal)

    const command = JSON.parse(requests[0].options.body)
    assert.equal(command[0], 'EVAL')
    assert.equal(command[2], 3)
    assert.equal(command[3], 'session:meta')
    assert.equal(command[4], 'session:payload')
    assert.equal(command[5], 'session:create-rate')
    assert.equal(command[6], SESSION_ID)
    assert.equal(command.at(-4), SESSION_TTL_SECONDS)
    assert.equal(command.at(-3), SESSION_CREATION_WINDOW_SECONDS)
    assert.equal(command.at(-2), SESSION_CREATION_LIMIT)
    assert.equal(command.at(-1), TEST_NOW_MS)

    await assert.rejects(
      redis.writeSession({ ...writeOptions, initialRevision: 0 }),
      /positive safe integer/
    )
    assert.equal(requests.length, 1)
  })

  test('reads metadata and payload in one atomic Upstash script', async () => {
    const requests = []
    const meta = {
      version: 2,
      writerHash: SESSION_ID,
      revision: 3,
      updatedAt: '2026-07-25T12:00:00.000Z'
    }
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: [JSON.stringify(meta), JSON.stringify(createPayload(3))]
        })
      }
    }
    const redis = createUpstashRedisAdapter({
      fetchImpl,
      token: 'upstash-token',
      url: 'https://example.upstash.io'
    })

    const result = await redis.readSession({
      knownRevision: 2,
      metaKey: 'session:meta',
      payloadKey: 'session:payload'
    })

    assert.equal(result.notModified, false)
    assert.equal(result.meta.revision, 3)
    assert.deepEqual(result.payload, createPayload(3))
    const command = JSON.parse(requests[0].options.body)
    assert.equal(command[0], 'EVAL')
    assert.equal(command[2], 2)
    assert.equal(command[3], 'session:meta')
    assert.equal(command[4], 'session:payload')
    assert.equal(command[5], '2')
  })

  test('does not return 304 when Redis metadata survives without its payload', async () => {
    const meta = {
      version: 2,
      writerHash: SESSION_ID,
      revision: TEST_NOW_MS,
      updatedAt: '2026-07-25T12:00:00.000Z'
    }
    const redis = createUpstashRedisAdapter({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: [JSON.stringify(meta), '__OWBT_PAYLOAD_MISSING__']
        })
      }),
      token: 'upstash-token',
      url: 'https://example.upstash.io'
    })

    await assert.rejects(
      redis.readSession({
        knownRevision: TEST_NOW_MS,
        metaKey: 'session:meta',
        payloadKey: 'session:payload'
      }),
      /payload is missing/
    )
  })
})
