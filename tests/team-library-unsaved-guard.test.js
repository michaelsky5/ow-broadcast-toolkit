import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

const pageSource = await readFile(
  new URL('../src/team-library/TeamLibraryPage.jsx', import.meta.url),
  'utf8'
)

describe('team library unsaved-draft guards', () => {
  test('routes saved-snapshot and duplicate-cleanup actions through the shared confirmation', () => {
    assert.match(pageSource, /onClick=\{\(\) => requestProtectedAction\('duplicate-cleanup'\)\}/)
    assert.match(pageSource, /onClick=\{\(\) => requestProtectedAction\('match-package-copy'\)\}/)
    assert.match(pageSource, /onClick=\{\(\) => requestProtectedAction\('backup-export'\)\}/)
  })

  test('restores the saved record before continuing a discarded action', () => {
    assert.match(
      pageSource,
      /setDraftTeam\(storedActiveTeam \? structuredClone\(storedActiveTeam\) : null\)/
    )
    assert.match(pageSource, /navigation\?\.kind === 'duplicate-cleanup'/)
    assert.match(pageSource, /navigation\?\.kind === 'match-package-copy'/)
    assert.match(pageSource, /navigation\?\.kind === 'backup-export'/)
  })
})
