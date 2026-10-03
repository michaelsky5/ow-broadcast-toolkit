import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { createServer } from 'vite'

describe('project startup storage recovery', () => {
  let vite
  let storage
  let sync
  let preferences
  let createDefaultProject
  let values
  let events
  let quotaFull
  let blockedReads
  const originalWindow = globalThis.window
  beforeEach(async () => {
    values = new Map()
    events = []
    quotaFull = false
    blockedReads = new Set()
    globalThis.window = {
      localStorage: {
        getItem: key => {
          if (blockedReads.has(key)) throw new DOMException('Read blocked', 'SecurityError')
          return values.get(key) ?? null
        },
        setItem: (key, value) => {
          if (quotaFull) throw new DOMException('Storage full', 'QuotaExceededError')
          values.set(key, String(value))
        },
        removeItem: key => values.delete(key)
      },
      dispatchEvent: event => { events.push(event.detail); return true },
      addEventListener: () => {}, removeEventListener: () => {},
      setInterval: () => 1, clearInterval: () => {}
    }
    vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
    storage = await vite.ssrLoadModule('/src/project/projectStorage.js')
    sync = await vite.ssrLoadModule('/src/project/projectSync.js')
    preferences = await vite.ssrLoadModule('/src/app/consolePreferences.js')
    ;({ createDefaultProject } = await vite.ssrLoadModule('/src/project/defaultProject.js'))
  })
  afterEach(async () => {
    await vite?.close()
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  })

  const seedDistinctStreams = () => {
    const draft = createDefaultProject()
    draft.event.name = 'EDITING_ONLY'
    draft.currentMatch.score.teamA = 2
    const program = createDefaultProject()
    program.event.name = 'ON_AIR'
    values.set(storage.OWBT_STORAGE_KEY, JSON.stringify(draft))
    values.set(storage.OWBT_PROGRAM_STORAGE_KEY, JSON.stringify(program))
    return { draft, program }
  }

  test('reads both saved streams when the first write probe fails and recovers without reload', t => {
    t.mock.method(console, 'error', () => {})
    const { draft, program } = seedDistinctStreams()
    quotaFull = true
    assert.equal(storage.canUseStorage(), false)
    assert.equal(storage.loadStoredProject().event.name, 'EDITING_ONLY')
    assert.equal(storage.loadStoredProgramProject().event.name, 'ON_AIR')
    assert.deepEqual(storage.getProjectLoadIssues(), [])
    assert.equal(sync.publishProjectState(draft), false)
    assert.equal(sync.publishProgramState(program), false)
    assert.equal(events.length, 2, 'write failures must retain live delivery after successful reads')
    quotaFull = false
    assert.equal(storage.canUseStorage(), true)
    assert.equal(sync.publishProjectState(draft), true)
    assert.equal(sync.publishProgramState(program), true)
  })

  test('preserves unreadable data, suppresses fallback delivery and independently retries both streams', t => {
    t.mock.method(console, 'error', () => {})
    seedDistinctStreams()
    const before = new Map(values)
    blockedReads.add(storage.OWBT_STORAGE_KEY)
    blockedReads.add(storage.OWBT_PROGRAM_STORAGE_KEY)
    const fallbackDraft = storage.loadStoredProject()
    const fallbackProgram = storage.loadStoredProgramProject()
    assert.equal(storage.getProjectLoadIssues().length, 2)
    assert.equal(sync.publishProjectState(fallbackDraft), false)
    assert.equal(sync.publishProgramState(fallbackProgram), false)
    assert.equal(events.length, 0)
    assert.deepEqual(values, before)
    blockedReads.clear()
    const draft = storage.loadStoredProject()
    const program = storage.loadStoredProgramProject()
    assert.equal(draft.currentMatch.score.teamA, 2)
    assert.equal(program.currentMatch.score.teamA, 0, 'restoration must not TAKE the editing draft')
    assert.deepEqual(storage.getProjectLoadIssues(), [])
    assert.equal(sync.publishProjectState(draft), true)
    assert.equal(sync.publishProgramState(program), true)
  })

  test('keeps malformed original data available until an explicit valid replacement', t => {
    t.mock.method(console, 'error', () => {})
    const { program } = seedDistinctStreams()
    const originalRaw = '{"schemaVersion":"owbt-project-v0.1","teams":{}}'
    values.set(storage.OWBT_STORAGE_KEY, originalRaw)
    const fallback = storage.loadStoredProject()
    assert.equal(storage.loadStoredProgramProject().event.name, 'ON_AIR')
    assert.equal(storage.getUnrestoredProjectText(storage.OWBT_STORAGE_KEY), originalRaw)
    assert.equal(sync.publishProjectState(fallback), false)
    assert.equal(values.get(storage.OWBT_STORAGE_KEY), originalRaw)
    assert.equal(sync.publishProgramState(program), true)
    const restored = createDefaultProject()
    restored.event.name = 'MANUALLY_RESTORED'
    storage.replaceStoredProject(restored)
    assert.deepEqual(storage.getProjectLoadIssues(), [])
    assert.equal(storage.loadStoredProject().event.name, 'MANUALLY_RESTORED')
  })

  test('does not substitute an un-TAKE draft for an unreadable Program', t => {
    t.mock.method(console, 'error', () => {})
    seedDistinctStreams()
    blockedReads.add(storage.OWBT_PROGRAM_STORAGE_KEY)
    assert.equal(storage.loadStoredProgramProject().currentMatch.score.teamA, 0)
    assert.equal(storage.isProjectReadBlocked(storage.OWBT_PROGRAM_STORAGE_KEY), true)
    assert.equal(storage.loadStoredProject().currentMatch.score.teamA, 2)
  })

  test('handles a throwing localStorage accessor throughout startup and subscriptions', t => {
    t.mock.method(console, 'error', () => {})
    Object.defineProperty(globalThis.window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Storage denied', 'SecurityError') }
    })
    assert.doesNotThrow(() => storage.loadStoredProject())
    assert.doesNotThrow(() => storage.loadStoredProgramProject())
    assert.equal(storage.loadBackupProject(), null)
    assert.equal(storage.readStoredProjectRaw(), '')
    assert.equal(storage.readStoredProgramProjectRaw(), '')
    assert.deepEqual(preferences.loadSceneTransitionSettings(), preferences.DEFAULT_SCENE_TRANSITION_SETTINGS)
    const unsubscribe = sync.subscribeProgramState(() => {})
    assert.doesNotThrow(unsubscribe)
    assert.equal(sync.publishProgramState(createDefaultProject()), false)
  })

  test('initializes a fresh profile without a recovery issue', () => {
    const draft = storage.loadStoredProject()
    const program = storage.loadStoredProgramProject()
    assert.equal(draft.schemaVersion, 'owbt-project-v0.1')
    assert.equal(program.event.name, draft.event.name)
    assert.deepEqual(storage.getProjectLoadIssues(), [])
    assert.equal(storage.saveStoredProject(draft), true)
    assert.equal(storage.saveStoredProgramProject(program), true)
  })
})
