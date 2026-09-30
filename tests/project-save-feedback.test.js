import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import { createServer } from 'vite'

describe('project save feedback', () => {
  let vite
  let sync
  let storage
  let createDefaultProject
  let values
  let failedKeys
  let events
  const originalWindow = globalThis.window

  before(async () => {
    vite = await createServer({
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true }
    })
    sync = await vite.ssrLoadModule('/src/project/projectSync.js')
    storage = await vite.ssrLoadModule('/src/project/projectStorage.js')
    ;({ createDefaultProject } = await vite.ssrLoadModule('/src/project/defaultProject.js'))
  })

  beforeEach(() => {
    values = new Map()
    failedKeys = new Set()
    events = []
    globalThis.window = {
      localStorage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => {
          if (failedKeys.has(key)) throw new DOMException('Storage full', 'QuotaExceededError')
          values.set(key, String(value))
        },
        removeItem: key => values.delete(key)
      },
      dispatchEvent: event => {
        events.push(event.detail)
        return true
      }
    }
  })

  afterEach(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  })

  after(async () => {
    await vite?.close()
  })

  test('successful saves persist both streams and retain the existing live payloads', () => {
    const project = createDefaultProject()
    project.event.name = 'Saved project'

    assert.equal(sync.publishProjectState(project), true)
    assert.equal(sync.publishProgramState(project), true)
    assert.equal(JSON.parse(values.get(storage.OWBT_STORAGE_KEY)).event.name, 'Saved project')
    assert.equal(JSON.parse(values.get(storage.OWBT_PROGRAM_STORAGE_KEY)).event.name, 'Saved project')
    assert.deepEqual(events.map(event => event.type), [sync.OWBT_SYNC_EVENT, sync.OWBT_PROGRAM_SYNC_EVENT])
  })

  for (const stream of ['project', 'program']) {
    test(`${stream} save failure is reported while live updates and retry remain available`, t => {
      t.mock.method(console, 'error', () => {})
      const project = createDefaultProject()
      const publish = stream === 'project' ? sync.publishProjectState : sync.publishProgramState
      const key = stream === 'project' ? storage.OWBT_STORAGE_KEY : storage.OWBT_PROGRAM_STORAGE_KEY
      assert.equal(publish(project), true)
      const previousRaw = values.get(key)

      failedKeys.add(key)
      project.event.name = 'Unsaved change'
      assert.equal(publish(project), false)
      assert.equal(values.get(key), previousRaw)
      assert.equal(events.at(-1).project.event.name, 'Unsaved change')

      failedKeys.delete(key)
      assert.equal(publish(project), true)
      assert.equal(JSON.parse(values.get(key)).event.name, 'Unsaved change')
    })
  }
})
