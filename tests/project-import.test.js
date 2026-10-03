import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, describe, test } from 'node:test'
import { createServer } from 'vite'

describe('complete project import', () => {
  let vite
  let utils
  let validation
  let createDefaultProject
  before(async () => {
    vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
    utils = await vite.ssrLoadModule('/src/project/projectUtils.js')
    validation = await vite.ssrLoadModule('/src/project/projectValidation.js')
    ;({ createDefaultProject } = await vite.ssrLoadModule('/src/project/defaultProject.js'))
  })
  after(async () => { await vite?.close() })

  test('restores exported projects and the published v0.1-schema practice project', async () => {
    const project = createDefaultProject()
    project.event.name = 'Keep this community event'
    project.currentMatch.score = { teamA: 2, teamB: 1 }
    const parsed = utils.parseImportedProject(utils.stringifyProject(project))
    assert.equal(parsed.event.name, project.event.name)
    assert.deepEqual(parsed.currentMatch.score, project.currentMatch.score)
    assert.equal(utils.parseImportedProject(`\uFEFF  ${utils.stringifyProject(project)}  `).event.name, project.event.name)
    const practice = utils.parseImportedProject(await readFile(new URL('../public/guide/owbt-demo-project.txt', import.meta.url), 'utf8'))
    assert.equal(practice.schemaVersion, 'owbt-project-v0.1')
    assert.equal(practice.players.length, 10)
  })

  test('fills optional legacy fields and keeps legacy scene aliases compatible', () => {
    const project = createDefaultProject()
    delete project.assets
    delete project.tools
    delete project.staff
    delete project.currentMatch.startingFive
    project.scenes.activeSceneId = 'opening'
    project.scenes.enabledSceneIds = ['opening', 'live-hud']
    const parsed = utils.parseImportedProject(JSON.stringify(project))
    assert.equal(parsed.scenes.activeSceneId, 'countdown')
    assert.deepEqual(parsed.scenes.enabledSceneIds, ['countdown', 'live-hud'])
    assert.ok(Array.isArray(parsed.assets.sponsors.logos))
    assert.ok(Array.isArray(parsed.currentMatch.startingFive.teamA))
  })

  test('rejects unrelated backups, future formats, empty roots and invalid JSON', () => {
    for (const [text, expectedCode] of [
      ['null', 'INVALID_STRUCTURE'], ['[]', 'INVALID_STRUCTURE'], ['{}', 'UNSUPPORTED_VERSION'],
      ['{"schemaVersion":"owbt-match-package-v1"}', 'WRONG_PACKAGE'],
      ['{"schemaVersion":"owbt-team-library-v1"}', 'WRONG_LIBRARY'],
      ['{"schemaVersion":"owbt-project-v999"}', 'UNSUPPORTED_VERSION'],
      ['{"schemaVersion":"owbt-project-v0.1"}', 'INVALID_STRUCTURE'],
      ['{"teams":', 'INVALID_JSON']
    ]) {
      assert.throws(() => utils.parseImportedProject(text), error => error.code === expectedCode, text)
    }
  })

  test('rejects malformed fields that previously reached scene rendering', () => {
    for (const change of [
      project => { project.teams = {} },
      project => { project.players = [null] },
      project => { project.currentMatch.score = [] },
      project => { project.currentMatch.startingFive.teamA = {} },
      project => { project.currentMatch.mapLineup = [null] },
      project => { project.scenes.settings.stats.mapSnapshots = [{ ocrRows: { teamA: {} } }] },
      project => { project.scenes.settings.stats.metrics = [null] },
      project => { project.scenes.order = {} },
      project => { delete project.players }
    ]) {
      const project = createDefaultProject()
      change(project)
      assert.throws(() => utils.parseImportedProject(JSON.stringify(project)), error => error.code === 'INVALID_STRUCTURE')
    }
    assert.throws(() => utils.parseImportedProject('{"__proto__":{"polluted":true}}'), error => error.code === 'INVALID_STRUCTURE')
    assert.equal({}.polluted, undefined)
  })

  test('checks UTF-8 size before parsing and rejects oversized files before reading', async () => {
    const limit = validation.MAX_PROJECT_IMPORT_BYTES
    assert.throws(() => utils.parseImportedProject(' '.repeat(limit + 1)), error => error.code === 'TOO_LARGE')
    assert.throws(() => utils.parseImportedProject('界'.repeat(Math.floor(limit / 3) + 1)), error => error.code === 'TOO_LARGE')
    await assert.rejects(utils.readProjectFile({ size: limit + 1 }), error => error.code === 'TOO_LARGE')
  })

  test('uses the same validation for text and file imports', async () => {
    const originalFileReader = globalThis.FileReader
    globalThis.FileReader = class {
      readAsText(file) { this.onload({ target: { result: file.contents } }) }
    }
    try {
      const validText = JSON.stringify(createDefaultProject())
      const fromFile = await utils.readProjectFile({ size: validText.length, contents: validText })
      assert.equal(fromFile.meta.id, utils.parseImportedProject(validText).meta.id)
      await assert.rejects(utils.readProjectFile({ size: 2, contents: '{}' }), error => error.code === 'UNSUPPORTED_VERSION')
      await assert.rejects(utils.readProjectFile({ size: 4, contents: 'null' }), error => error.code === 'INVALID_STRUCTURE')
    } finally {
      if (originalFileReader === undefined) delete globalThis.FileReader
      else globalThis.FileReader = originalFileReader
    }
  })
})
