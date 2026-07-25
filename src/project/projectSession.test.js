import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { describe, test } from 'node:test'
import {
  OWBT_SESSION_SCHEMA_VERSION,
  buildSessionOverlayUrl,
  clearSessionCredentials,
  createSessionCredentials,
  getSessionIdFromLocation,
  isValidSessionId,
  loadSessionCredentials,
  publishSessionProgramState,
  readSessionProgramState,
  saveSessionCredentials,
  subscribeSessionProgramState
} from './projectSession.js'

const SESSION_A = 'a'.repeat(64)
const SESSION_B = 'b'.repeat(64)
const SESSION_C = 'c'.repeat(64)
const WRITER_SECRET = '0123456789abcdef'.repeat(4)

const createCrypto = () => ({
  subtle: webcrypto.subtle,
  getRandomValues(bytes) {
    bytes.forEach((_, index) => {
      bytes[index] = index + 1
    })
    return bytes
  }
})

const createStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) || null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  }
}

const createHeaders = values => ({
  get(name) {
    return values?.[String(name).toLowerCase()] || null
  }
})

const jsonResponse = (status, body, headers = {}) => ({
  headers: createHeaders(headers),
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
})

const flushAsync = () => new Promise(resolve => globalThis.setTimeout(resolve, 0))

const createScheduler = () => {
  const scheduled = []
  const delays = []

  return {
    delays,
    scheduled,
    clearTimeoutImpl(token) {
      token.cancelled = true
    },
    async runNext() {
      const token = scheduled.shift()
      assert.ok(token, 'expected a scheduled poll')
      if (!token.cancelled) await token.callback()
    },
    setTimeoutImpl(callback, delay) {
      const token = { callback, cancelled: false, delay }
      delays.push(delay)
      scheduled.push(token)
      return token
    }
  }
}

const createCredentials = sessionId => ({
  sessionId,
  writerSecret: WRITER_SECRET
})

describe('project HTTPS session client', () => {
  test('derives a 64-hex session id from the SHA-256 of the writer secret', async () => {
    const credentials = await createSessionCredentials(createCrypto())
    const storage = createStorage()
    const expectedId = createHash('sha256')
      .update(credentials.writerSecret, 'utf8')
      .digest('hex')

    assert.equal(credentials.sessionId.length, 64)
    assert.equal(credentials.sessionId, expectedId)
    assert.equal(credentials.writerSecret.length, 64)
    assert.equal(isValidSessionId(credentials.sessionId), true)
    assert.equal(isValidSessionId('0'.repeat(32)), false)
    assert.equal(saveSessionCredentials(credentials, storage), true)
    assert.deepEqual(loadSessionCredentials(storage), credentials)
  })

  test('fails closed when the default localStorage getter is blocked', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const credentials = createCredentials(SESSION_A)

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        const error = new Error('Persistent storage is blocked')
        error.name = 'SecurityError'
        throw error
      }
    })

    try {
      assert.equal(loadSessionCredentials(), null)
      assert.equal(saveSessionCredentials(credentials), false)
      assert.equal(clearSessionCredentials(), false)
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
      } else {
        delete globalThis.localStorage
      }
    }
  })

  test('reads session ids from query or overlay hash and builds a clean overlay URL', () => {
    assert.equal(getSessionIdFromLocation({ search: `?session=${SESSION_A}`, hash: '#overlay' }), SESSION_A)
    assert.equal(getSessionIdFromLocation({ search: '', hash: `#overlay?session=${SESSION_A}` }), SESSION_A)
    assert.equal(
      buildSessionOverlayUrl(SESSION_A, {
        origin: 'https://owbt.fries-cup.com',
        pathname: '/',
        search: '?lang=zh&owbt-recover=123'
      }),
      `https://owbt.fries-cup.com/?lang=zh&session=${SESSION_A}#overlay`
    )
  })

  test('publishes authenticated program state and reads the public session', async () => {
    const credentials = createCredentials(SESSION_A)
    const requests = []
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      return jsonResponse(200, {
        ok: true,
        payload: options.method === 'PUT'
          ? JSON.parse(options.body)
          : { schemaVersion: OWBT_SESSION_SCHEMA_VERSION, project: { event: { name: 'Read' } } },
        revision: 1,
        updatedAt: '2026-07-25T12:00:00.000Z'
      })
    }

    const published = await publishSessionProgramState(credentials, { event: { name: 'Write' } }, {
      fetchImpl,
      transitionSettings: { sceneTransitionMode: 'cut' }
    })
    const read = await readSessionProgramState(credentials.sessionId, { fetchImpl })

    assert.equal(published.payload.project.event.name, 'Write')
    assert.equal(published.payload.schemaVersion, OWBT_SESSION_SCHEMA_VERSION)
    assert.match(requests[0].options.headers.Authorization, /^Bearer /)
    assert.equal(requests[0].options.cache, 'no-store')
    assert.equal(read.payload.project.event.name, 'Read')
    assert.equal(requests[1].options.method, 'GET')
  })

  test('refuses to upload embedded video or Blob media to the remote session', async () => {
    let fetchCalls = 0
    await assert.rejects(
      publishSessionProgramState(createCredentials(SESSION_A), {
        scenes: {
          settings: {
            media: {
              activeVideoPath: 'data:video/mp4;base64,AAAA'
            }
          }
        }
      }, {
        fetchImpl: async () => {
          fetchCalls += 1
          return jsonResponse(200, { ok: true })
        }
      }),
      error => error?.code === 'UNSAFE_EMBEDDED_MEDIA'
    )
    assert.equal(fetchCalls, 0)
  })

  test('keeps one in-flight PUT and replaces the pending snapshot with the latest state', async () => {
    const credentials = createCredentials(SESSION_B)
    const requests = []
    const releases = []
    const fetchImpl = (url, options) => new Promise(resolve => {
      requests.push({ url, options })
      releases.push(() => resolve(jsonResponse(200, {
        ok: true,
        payload: JSON.parse(options.body),
        revision: requests.length,
        updatedAt: `2026-07-25T12:00:0${requests.length}.000Z`
      })))
    })

    const first = publishSessionProgramState(credentials, { revision: 1 }, { fetchImpl })
    const pending = publishSessionProgramState(credentials, { revision: 2 }, { fetchImpl })
    const latest = publishSessionProgramState(credentials, { revision: 3 }, { fetchImpl })

    assert.equal(requests.length, 1)
    assert.equal(pending, latest)

    releases.shift()()
    await first
    await flushAsync()

    assert.equal(requests.length, 2)
    assert.equal(JSON.parse(requests[1].options.body).project.revision, 3)

    releases.shift()()
    const [pendingResult, latestResult] = await Promise.all([pending, latest])
    assert.equal(pendingResult.payload.project.revision, 3)
    assert.equal(latestResult.payload.project.revision, 3)
  })

  test('does not let a stalled session block publishing another session', async () => {
    let releaseStalled
    const requests = []
    const fetchImpl = (url, options) => {
      requests.push(url)
      if (url.includes(SESSION_A)) {
        return new Promise(resolve => {
          releaseStalled = () => resolve(jsonResponse(200, {
            ok: true,
            payload: JSON.parse(options.body),
            revision: 1
          }))
        })
      }
      return Promise.resolve(jsonResponse(200, {
        ok: true,
        payload: JSON.parse(options.body),
        revision: 1
      }))
    }

    const stalled = publishSessionProgramState(createCredentials(SESSION_A), { side: 'A' }, { fetchImpl })
    const independent = publishSessionProgramState(createCredentials(SESSION_C), { side: 'C' }, { fetchImpl })

    assert.equal((await independent).payload.project.side, 'C')
    assert.equal(requests.length, 2)
    releaseStalled()
    await stalled
  })

  test('sends a conditional revision and treats 304 as an unchanged success', async () => {
    const requests = []
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      return {
        headers: createHeaders({ etag: '"7"' }),
        ok: false,
        status: 304,
        json: async () => {
          throw new Error('304 must not parse a body')
        }
      }
    }

    const response = await readSessionProgramState(SESSION_A, {
      fetchImpl,
      revision: 7
    })

    assert.equal(response.notModified, true)
    assert.equal(response.revision, '7')
    assert.equal(requests[0].url, `/api/session/${SESSION_A}?revision=7`)
    assert.equal(requests[0].options.headers['If-None-Match'], '"7"')
  })

  test('deduplicates by revision and returns to a one-second poll after 304', async () => {
    const scheduler = createScheduler()
    const applied = []
    const statuses = []
    const requests = []
    const responses = [
      jsonResponse(200, {
        ok: true,
        payload: {
          schemaVersion: OWBT_SESSION_SCHEMA_VERSION,
          sequence: 1,
          project: { revision: 1 }
        },
        revision: 1,
        updatedAt: '2026-07-25T12:00:00.000Z'
      }),
      {
        headers: createHeaders({ etag: '"1"' }),
        ok: false,
        status: 304,
        json: async () => null
      }
    ]
    const stop = subscribeSessionProgramState(SESSION_A, project => {
      applied.push(project.revision)
    }, {
      clearTimeoutImpl: scheduler.clearTimeoutImpl,
      fetchImpl: async (url, options) => {
        requests.push({ url, options })
        return responses.shift()
      },
      onStatus: status => statuses.push(status),
      pollInterval: 750,
      setTimeoutImpl: scheduler.setTimeoutImpl
    })

    await flushAsync()
    assert.deepEqual(applied, [1])
    assert.equal(scheduler.delays[0], 1000)

    await scheduler.runNext()
    assert.deepEqual(applied, [1])
    assert.equal(scheduler.delays[1], 1000)
    assert.match(requests[1].url, /revision=1/)
    assert.equal(statuses.at(-1).state, 'online')
    stop()
  })

  test('forces a full read when an expired session is recreated with the same revision', async () => {
    const scheduler = createScheduler()
    const applied = []
    const requests = []
    const responses = [
      jsonResponse(200, {
        ok: true,
        payload: {
          schemaVersion: OWBT_SESSION_SCHEMA_VERSION,
          project: { name: 'before-expiry' }
        },
        revision: 1,
        updatedAt: '2026-07-25T00:00:00.000Z'
      }),
      jsonResponse(404, {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session expired.'
        }
      }),
      jsonResponse(200, {
        ok: true,
        payload: {
          schemaVersion: OWBT_SESSION_SCHEMA_VERSION,
          project: { name: 'after-recreation' }
        },
        revision: 1,
        updatedAt: '2026-07-25T13:00:00.000Z'
      })
    ]
    const stop = subscribeSessionProgramState(SESSION_A, project => {
      applied.push(project.name)
    }, {
      clearTimeoutImpl: scheduler.clearTimeoutImpl,
      fetchImpl: async (url, options) => {
        requests.push({ url, options })
        return responses.shift()
      },
      setTimeoutImpl: scheduler.setTimeoutImpl
    })

    await flushAsync()
    assert.deepEqual(applied, ['before-expiry'])

    await scheduler.runNext()
    assert.match(requests[1].url, /revision=1/)

    await scheduler.runNext()
    assert.equal(requests[2].url, `/api/session/${SESSION_A}`)
    assert.equal('If-None-Match' in requests[2].options.headers, false)
    assert.deepEqual(applied, ['before-expiry', 'after-recreation'])
    stop()
  })

  test('backs off failed polls to ten seconds and resets after success', async () => {
    const scheduler = createScheduler()
    const statuses = []
    let attempts = 0
    const stop = subscribeSessionProgramState(SESSION_B, () => {}, {
      clearTimeoutImpl: scheduler.clearTimeoutImpl,
      fetchImpl: async () => {
        attempts += 1
        if (attempts <= 4) throw new Error('offline')
        return jsonResponse(200, {
          ok: true,
          payload: {
            schemaVersion: OWBT_SESSION_SCHEMA_VERSION,
            project: { ready: true }
          },
          revision: 1
        })
      },
      onStatus: status => statuses.push(status),
      setTimeoutImpl: scheduler.setTimeoutImpl
    })

    await flushAsync()
    assert.deepEqual(scheduler.delays, [2000])
    await scheduler.runNext()
    await scheduler.runNext()
    await scheduler.runNext()
    assert.deepEqual(scheduler.delays, [2000, 4000, 8000, 10000])
    await scheduler.runNext()
    assert.equal(scheduler.delays.at(-1), 1000)
    assert.equal(statuses.at(-1).state, 'online')
    stop()
  })

  test('does not report online for an incompatible remote schema', async () => {
    const scheduler = createScheduler()
    const applied = []
    const statuses = []
    const stop = subscribeSessionProgramState(SESSION_C, project => applied.push(project), {
      clearTimeoutImpl: scheduler.clearTimeoutImpl,
      fetchImpl: async () => jsonResponse(200, {
        ok: true,
        payload: { schemaVersion: 'future-session', project: { unsafe: true } },
        revision: 1
      }),
      onStatus: status => statuses.push(status),
      setTimeoutImpl: scheduler.setTimeoutImpl
    })

    await flushAsync()
    assert.deepEqual(applied, [])
    assert.equal(statuses.at(-1).state, 'offline')
    assert.equal(statuses.at(-1).code, 'INVALID_SESSION_SCHEMA')
    assert.equal(scheduler.delays[0], 2000)
    await scheduler.runNext()
    assert.equal(scheduler.delays[1], 4000)
    stop()
  })

  test('aborts the active GET and schedules nothing after unsubscribe', async () => {
    const scheduler = createScheduler()
    let wasAborted = false
    const stop = subscribeSessionProgramState(SESSION_A, () => {}, {
      clearTimeoutImpl: scheduler.clearTimeoutImpl,
      fetchImpl: (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          wasAborted = true
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      }),
      setTimeoutImpl: scheduler.setTimeoutImpl
    })

    stop()
    await flushAsync()

    assert.equal(wasAborted, true)
    assert.equal(scheduler.scheduled.length, 0)
  })
})
