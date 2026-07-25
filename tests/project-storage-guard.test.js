import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { createServer } from 'vite'

class TestCustomEvent extends Event {
  constructor(type, options = {}) {
    super(type)
    this.detail = options.detail
  }
}

const createMemoryStorage = () => {
  const values = new Map()
  let failure = null
  let failureKey = ''

  return {
    failWith: error => {
      failure = error
      failureKey = ''
    },
    failKeyWith: (key, error) => {
      failure = error
      failureKey = key
    },
    getItem: key => values.get(key) ?? null,
    get length() {
      return values.size
    },
    removeItem: key => values.delete(key),
    setItem: (key, value) => {
      if (failure && (!failureKey || failureKey === key)) throw failure
      values.set(key, String(value))
    }
  }
}

describe('project storage guard', () => {
  let projectStorage
  let projectSync
  let storage
  let vite

  before(async () => {
    vite = await createServer({
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true }
    })
    projectStorage = await vite.ssrLoadModule('/src/project/projectStorage.js')
    projectSync = await vite.ssrLoadModule('/src/project/projectSync.js')
  })

  after(async () => {
    await vite?.close()
    delete globalThis.window
    delete globalThis.CustomEvent
  })

  beforeEach(() => {
    storage = createMemoryStorage()
    globalThis.CustomEvent = TestCustomEvent
    globalThis.window = new EventTarget()
    window.localStorage = storage
    window.setInterval = setInterval
    window.clearInterval = clearInterval
  })

  test('keeps boolean saves compatible and exposes a structured success result', () => {
    const project = { meta: {}, event: { name: 'Test Event' } }
    const result = projectStorage.saveStoredProjectResult(project)

    assert.equal(result.ok, true)
    assert.equal(result.operation, 'saveStoredProject')
    assert.equal(result.name, '')
    assert.equal(result.serializedBytes > 0, true)
    assert.equal(projectStorage.saveStoredProgramProject(project), true)
  })

  test('emits a matching success event only after a storage write succeeds', () => {
    const events = []
    window.addEventListener(projectStorage.OWBT_STORAGE_SUCCESS_EVENT, event => {
      events.push(event.detail)
    })

    const result = projectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: 'Saved Event' }
    })

    assert.equal(result.ok, true)
    assert.deepEqual(events, [{
      operation: 'saveStoredProject',
      serializedBytes: result.serializedBytes
    }])

    const quotaError = new Error('Storage is full')
    quotaError.name = 'QuotaExceededError'
    storage.failWith(quotaError)
    projectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: 'Unsaved Event' }
    })
    assert.equal(events.length, 1)
  })

  test('inspects legacy embedded media without writing or dispatching a failure', () => {
    const errors = []
    const successes = []
    window.addEventListener(projectStorage.OWBT_STORAGE_ERROR_EVENT, event => {
      errors.push(event.detail)
    })
    window.addEventListener(projectStorage.OWBT_STORAGE_SUCCESS_EVENT, event => {
      successes.push(event.detail)
    })

    const result = projectStorage.inspectStoredProjectResult({
      meta: {},
      event: { name: 'Recovery Candidate' },
      scenes: {
        settings: {
          media: {
            activeVideoPath: 'data:video/mp4;base64,AAAA'
          }
        }
      }
    })

    assert.equal(result.ok, false)
    assert.equal(result.name, 'UnsafeEmbeddedMediaError')
    assert.equal(storage.length, 0)
    assert.deepEqual(errors, [])
    assert.deepEqual(successes, [])
  })

  test('routes every safely cleanable inspection failure into recovery', () => {
    const inspections = [
      projectStorage.inspectStoredProjectResult({
        meta: {},
        scenes: {
          settings: {
            media: {
              activeVideoPath: 'data:video/mp4;base64,AAAA'
            }
          }
        }
      }),
      projectStorage.inspectStoredProjectResult({
        meta: {},
        logo: `data:image/png;base64,${'A'.repeat(800 * 1024)}`
      }),
      projectStorage.inspectStoredProjectResult({
        meta: {},
        payload: 'x'.repeat(projectStorage.OWBT_MAX_STORED_PROJECT_BYTES)
      })
    ]

    assert.deepEqual(
      inspections.map(inspection => inspection.name),
      ['UnsafeEmbeddedMediaError', 'EmbeddedMediaTooLargeError', 'ProjectTooLargeError']
    )
    assert.equal(
      inspections.every(projectStorage.isRecoverableStoredProjectInspection),
      true
    )
    assert.equal(
      projectStorage.isRecoverableStoredProjectInspection({
        ok: false,
        name: 'StorageUnavailableError'
      }),
      false
    )
  })

  test('reports paired reset and import persistence instead of claiming success blindly', () => {
    const operations = []
    window.addEventListener(projectStorage.OWBT_STORAGE_SUCCESS_EVENT, event => {
      operations.push(event.detail.operation)
    })
    const reset = projectStorage.resetStoredProjectResult()
    const imported = projectStorage.replaceStoredProjectResult({
      meta: {},
      event: { name: 'Imported Event' }
    })

    assert.equal(reset.ok, true)
    assert.equal(reset.current.ok, true)
    assert.equal(reset.program.ok, true)
    assert.equal(imported.ok, true)
    assert.equal(imported.project.event.name, 'Imported Event')
    assert.equal(operations.filter(operation => operation === 'saveProjectPair').length, 2)
  })

  test('rejects a single oversized project before it can consume the origin quota', () => {
    const events = []
    window.addEventListener(projectStorage.OWBT_STORAGE_ERROR_EVENT, event => {
      events.push(event.detail)
    })

    const result = projectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: 'Oversized' },
      payload: 'x'.repeat(projectStorage.OWBT_MAX_STORED_PROJECT_BYTES)
    })

    assert.equal(result.ok, false)
    assert.equal(result.name, 'ProjectTooLargeError')
    assert.equal(result.serializedBytes > projectStorage.OWBT_MAX_STORED_PROJECT_BYTES, true)
    assert.equal(events.length, 1)
    assert.equal(events[0].name, 'ProjectTooLargeError')
  })

  test('preserves legacy embedded video on load but refuses to persist it silently', () => {
    const legacyProject = {
      meta: {},
      event: { name: 'Legacy video' },
      scenes: {
        settings: {
          media: {
            activeVideoPath: 'data:video/mp4;base64,AAAA',
            sourceName: 'legacy.mp4',
            sourceType: 'video/mp4'
          }
        }
      }
    }
    storage.setItem(projectStorage.OWBT_STORAGE_KEY, JSON.stringify(legacyProject))

    const loaded = projectStorage.loadStoredProject()
    assert.equal(
      loaded.scenes.settings.media.activeVideoPath,
      'data:video/mp4;base64,AAAA'
    )
    assert.equal(loaded.scenes.settings.media.sourceName, 'legacy.mp4')

    const result = projectStorage.saveStoredProjectResult(loaded)
    assert.equal(result.ok, false)
    assert.equal(result.name, 'UnsafeEmbeddedMediaError')
    assert.equal(
      JSON.parse(storage.getItem(projectStorage.OWBT_STORAGE_KEY)).scenes.settings.media.activeVideoPath,
      'data:video/mp4;base64,AAAA'
    )
  })

  test('rejects manually pasted oversized Data URLs even below the project limit', () => {
    const result = projectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: 'Large pasted asset' },
      logo: `data:image/png;base64,${'A'.repeat(800 * 1024)}`
    })

    assert.equal(result.ok, false)
    assert.equal(result.name, 'EmbeddedMediaTooLargeError')
  })

  test('normalizes legacy quota errors and emits one diagnostic event', () => {
    const quotaError = new Error('Storage is full')
    quotaError.name = 'NS_ERROR_DOM_QUOTA_REACHED'
    quotaError.code = 1014
    const events = []
    window.addEventListener(projectStorage.OWBT_STORAGE_ERROR_EVENT, event => {
      events.push(event.detail)
    })
    storage.failWith(quotaError)

    const result = projectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: '容量测试' }
    })

    assert.equal(result.ok, false)
    assert.equal(result.name, 'QuotaExceededError')
    assert.equal(result.quotaExceeded, true)
    assert.equal(result.serializedBytes > 0, true)
    assert.deepEqual(events, [{
      operation: 'saveStoredProject',
      name: 'QuotaExceededError',
      message: 'Storage is full',
      serializedBytes: result.serializedBytes,
      quotaExceeded: true
    }])
  })

  test('reports quota when the initial storage availability probe fails', async () => {
    const quotaError = new Error('No space remains')
    quotaError.name = 'QuotaExceededError'
    storage.failWith(quotaError)
    const events = []
    window.addEventListener('owbt:storage-error', event => {
      events.push(event.detail)
    })
    const freshProjectStorage = await vite.ssrLoadModule(
      `/src/project/projectStorage.js?quota-probe=${Date.now()}`
    )

    const result = freshProjectStorage.saveStoredProjectResult({
      meta: {},
      event: { name: 'Initial probe' }
    })

    assert.equal(result.ok, false)
    assert.equal(result.name, 'QuotaExceededError')
    assert.equal(result.serializedBytes > 0, true)
    assert.equal(events.length, 1)
    assert.equal(events[0].name, 'QuotaExceededError')
  })

  test('does not report or broadcast a project publish after persistence fails', () => {
    const quotaError = new Error('Quota exceeded')
    quotaError.name = 'QuotaExceededError'
    const syncEvents = []
    window.addEventListener(projectSync.OWBT_SYNC_EVENT, event => {
      syncEvents.push(event.detail)
    })
    storage.failWith(quotaError)

    const published = projectSync.publishProjectState({
      meta: {},
      event: { name: 'Unsaved' }
    })

    assert.equal(published, false)
    assert.deepEqual(syncEvents, [])
  })

  test('rolls Current back when the second half of a paired import fails', () => {
    const oldCurrent = JSON.stringify({ event: { name: 'Old Current' } })
    const oldProgram = JSON.stringify({ event: { name: 'Old Program' } })
    storage.setItem(projectStorage.OWBT_STORAGE_KEY, oldCurrent)
    storage.setItem(projectStorage.OWBT_PROGRAM_STORAGE_KEY, oldProgram)

    const quotaError = new Error('Program key is full')
    quotaError.name = 'QuotaExceededError'
    storage.failKeyWith(projectStorage.OWBT_PROGRAM_STORAGE_KEY, quotaError)

    const result = projectStorage.replaceStoredProjectResult({
      meta: {},
      event: { name: 'New Project' }
    })

    assert.equal(result.ok, false)
    assert.equal(result.rolledBack, true)
    assert.equal(storage.getItem(projectStorage.OWBT_STORAGE_KEY), oldCurrent)
    assert.equal(storage.getItem(projectStorage.OWBT_PROGRAM_STORAGE_KEY), oldProgram)
  })
})
