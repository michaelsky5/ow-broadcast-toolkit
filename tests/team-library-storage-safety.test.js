import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'
import {
  TEAM_LIBRARY_MAX_AVATAR_BYTES,
  TEAM_LIBRARY_MAX_LOGO_BYTES,
  TEAM_LIBRARY_STORAGE_ERROR_CODES,
  assertTeamLibraryRecordsSafe,
  assertTeamLibraryWriteSafe,
  createTeamLibraryWriteProjection,
  inspectTeamLibraryAssetSource,
  inspectTeamLibraryPastedImportText,
  inspectTeamLibraryRecord
} from '../src/team-library/teamLibraryStorageSafety.js'

const createDataImage = (bytes, mimeType = 'image/png') => (
  `data:${mimeType};base64,${Buffer.alloc(bytes).toString('base64')}`
)

const createTeam = (id, patch = {}) => ({
  id,
  name: `Team ${id}`,
  shortName: id.toUpperCase(),
  logo: '',
  players: [],
  ...patch
})

const hasCode = code => error => error?.code === code

describe('Team Library central storage safety', () => {
  test('accepts bounded image data and normal URLs but rejects unsafe sources', () => {
    assert.equal(
      inspectTeamLibraryAssetSource(createDataImage(1024), { kind: 'logo' }).bytes,
      1024
    )
    assert.equal(
      inspectTeamLibraryAssetSource('https://assets.example/team.png').sourceType,
      'url'
    )
    assert.equal(
      inspectTeamLibraryAssetSource('/teams/team.png').sourceType,
      'url'
    )

    assert.throws(
      () => inspectTeamLibraryAssetSource('data:text/html;base64,PGgxPkJvb208L2gxPg=='),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED)
    )
    assert.throws(
      () => inspectTeamLibraryAssetSource('blob:https://owbt.example/asset'),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED)
    )
    assert.throws(
      () => inspectTeamLibraryAssetSource(createDataImage(16), {
        allowDataUrl: false,
        kind: 'logo'
      }),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED)
    )
  })

  test('enforces separate hard limits for logos and player avatars', () => {
    assert.doesNotThrow(() => inspectTeamLibraryRecord(createTeam('safe', {
      logo: createDataImage(TEAM_LIBRARY_MAX_LOGO_BYTES),
      players: [{
        id: 'safe-player',
        name: 'Player',
        avatar: createDataImage(TEAM_LIBRARY_MAX_AVATAR_BYTES)
      }]
    })))

    assert.throws(
      () => inspectTeamLibraryRecord(createTeam('large-logo', {
        logo: createDataImage(TEAM_LIBRARY_MAX_LOGO_BYTES + 1)
      })),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_TOO_LARGE)
    )
    assert.throws(
      () => inspectTeamLibraryRecord(createTeam('large-avatar', {
        players: [{
          id: 'large-avatar-player',
          avatar: createDataImage(TEAM_LIBRARY_MAX_AVATAR_BYTES + 1)
        }]
      })),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_TOO_LARGE)
    )
  })

  test('blocks oversized teams, team counts, and projected total writes', () => {
    const teamA = createTeam('a')
    const teamB = createTeam('b')

    assert.throws(
      () => inspectTeamLibraryRecord(createTeam('large-team', {
        description: 'x'.repeat(1024)
      }), { maxTeamBytes: 256 }),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.TEAM_TOO_LARGE)
    )
    assert.throws(
      () => assertTeamLibraryRecordsSafe([teamA, teamB], { maxTeams: 1 }),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.TOO_MANY_TEAMS)
    )
    assert.throws(
      () => assertTeamLibraryWriteSafe(
        [teamA],
        [createTeam('b', { description: 'x'.repeat(1024) })],
        { maxTotalBytes: 512, maxTeamBytes: 2048 }
      ),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.LIBRARY_TOO_LARGE)
    )
  })

  test('projects updates and removals without double-counting replaced teams', () => {
    const existing = [
      createTeam('a', { description: 'old' }),
      createTeam('b')
    ]
    const incoming = createTeam('a', { description: 'new' })
    const projection = createTeamLibraryWriteProjection(existing, [incoming], ['b'])

    assert.equal(projection.length, 1)
    assert.equal(projection[0].id, 'a')
    assert.equal(projection[0].description, 'new')
    assert.equal(assertTeamLibraryWriteSafe(existing, [incoming], {
      removedIds: ['b']
    }).teamCount, 1)
  })

  test('rejects dangerous or oversized Data URLs before pasted text enters state', () => {
    const safeBackup = JSON.stringify({
      schemaVersion: 'owbt-team-library-v1',
      teams: [createTeam('safe', { logo: createDataImage(16) })]
    })
    assert.doesNotThrow(() => inspectTeamLibraryPastedImportText(safeBackup))

    assert.throws(
      () => inspectTeamLibraryPastedImportText(
        JSON.stringify({ logo: 'data:text/html;base64,PGgxPkJvb208L2gxPg==' })
      ),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_SOURCE_UNSUPPORTED)
    )
    assert.throws(
      () => inspectTeamLibraryPastedImportText(
        JSON.stringify({ logo: createDataImage(32) }),
        { maxAssetBytes: 16 }
      ),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.ASSET_TOO_LARGE)
    )
    assert.throws(
      () => inspectTeamLibraryPastedImportText('x'.repeat(64), { maxBytes: 32 }),
      hasCode(TEAM_LIBRARY_STORAGE_ERROR_CODES.PASTED_IMPORT_TOO_LARGE)
    )
  })

  test('wires hard validation to every write path and visible UI failure handling', async () => {
    const storageSource = await readFile(
      new URL('../src/team-library/teamLibraryStorage.js', import.meta.url),
      'utf8'
    )
    const pageSource = await readFile(
      new URL('../src/team-library/TeamLibraryPage.jsx', import.meta.url),
      'utf8'
    )

    assert.match(storageSource, /saveLibraryTeam[\s\S]*assertTeamLibraryWriteSafe/)
    assert.match(storageSource, /saveLibraryTeams[\s\S]*assertTeamLibraryWriteSafe/)
    assert.match(storageSource, /replaceLibraryTeams[\s\S]*assertTeamLibraryRecordsSafe/)
    assert.match(storageSource, /mergeLibraryTeamGroups[\s\S]*assertTeamLibraryWriteSafe/)
    assert.match(pageSource, /onPaste=\{event => handleAssetSourcePaste\(event, 'logo'\)\}/)
    assert.match(pageSource, /onPaste=\{event => handleAssetSourcePaste\(event, 'avatar'\)\}/)
    assert.match(pageSource, /onPaste=\{handleProjectImportPaste\}/)
    assert.doesNotMatch(pageSource, /catch \([^)]*Error\) \{[\s\S]{0,160}setError\(copy\.saveFailed\)/)
  })
})
