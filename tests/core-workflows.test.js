import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createServer } from 'vite'
import {
  APP_ROUTES,
  getAppRouteFromHash,
  getAppRouteHash,
  getAppRouteUrl
} from '../src/app/appRoute.js'
import {
  USAGE_NOTICE_STORAGE_KEY,
  acceptUsageNotice,
  isUsageNoticeAccepted
} from '../src/app/usageNotice.js'

const createMemoryStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  }
}

describe('application routes', () => {
  test('maps all supported hashes and treats unknown hashes as the root surface', () => {
    assert.equal(getAppRouteFromHash(''), APP_ROUTES.ROOT)
    assert.equal(getAppRouteFromHash('#library'), APP_ROUTES.LIBRARY)
    assert.equal(getAppRouteFromHash('#control'), APP_ROUTES.CONTROL)
    assert.equal(getAppRouteFromHash('#overlay'), APP_ROUTES.OVERLAY)
    assert.equal(getAppRouteFromHash('#overlay?scene=live-hud'), APP_ROUTES.OVERLAY)
    assert.equal(getAppRouteFromHash('#unknown'), APP_ROUTES.ROOT)
  })

  test('builds stable route hashes and preserves path plus query parameters', () => {
    assert.equal(getAppRouteHash(APP_ROUTES.ROOT), '')
    assert.equal(getAppRouteHash(APP_ROUTES.LIBRARY), '#library')
    assert.equal(getAppRouteHash(APP_ROUTES.CONTROL), '#control')
    assert.equal(getAppRouteHash(APP_ROUTES.OVERLAY), '#overlay')
    assert.equal(
      getAppRouteUrl({ pathname: '/console/', search: '?lang=zh' }, '#library'),
      '/console/?lang=zh#library'
    )
  })
})

describe('usage notice persistence', () => {
  test('records and reads acceptance from the supplied storage', () => {
    const storage = createMemoryStorage()
    assert.equal(isUsageNoticeAccepted(storage), false)
    assert.equal(acceptUsageNotice(storage), true)
    assert.equal(storage.getItem(USAGE_NOTICE_STORAGE_KEY), 'true')
    assert.equal(isUsageNoticeAccepted(storage), true)
  })

  test('fails closed when storage is unavailable or throws', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') }
    }
    assert.equal(isUsageNoticeAccepted(null), false)
    assert.equal(acceptUsageNotice(null), false)
    assert.equal(isUsageNoticeAccepted(brokenStorage), false)
    assert.equal(acceptUsageNotice(brokenStorage), false)
  })
})

describe('match package workflow', () => {
  let vite
  let matchPackage
  let teamLibraryModel
  let teamProjectImport

  before(async () => {
    vite = await createServer({
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true }
    })
    matchPackage = await vite.ssrLoadModule('/src/team-library/matchPackage.js')
    teamLibraryModel = await vite.ssrLoadModule('/src/team-library/teamLibraryModel.js')
    teamProjectImport = await vite.ssrLoadModule('/src/team-library/teamProjectImport.js')
  })

  after(async () => {
    await vite?.close()
  })

  const createTeam = (id, name, shortName) => ({
    id,
    name,
    shortName,
    primaryColor: '#4CD3B5',
    players: [
      { id: `${id}-tank`, name: `${name} Tank`, role: 'tank' },
      { id: `${id}-dps-1`, name: `${name} DPS 1`, role: 'damage' },
      { id: `${id}-dps-2`, name: `${name} DPS 2`, role: 'damage' },
      { id: `${id}-support-1`, name: `${name} Support 1`, role: 'support' },
      { id: `${id}-support-2`, name: `${name} Support 2`, role: 'support' }
    ]
  })

  test('round-trips two distinct teams and rejects duplicate sides', () => {
    const teamA = createTeam('library-a', 'Alpha', 'ALP')
    const teamB = createTeam('library-b', 'Bravo', 'BRV')
    const created = matchPackage.createMatchPackage([teamA, teamB])
    const parsed = matchPackage.parseMatchPackage(matchPackage.stringifyMatchPackage(created))

    assert.equal(parsed.teams.teamA.id, 'library-a')
    assert.equal(parsed.teams.teamB.id, 'library-b')
    assert.equal(parsed.teams.teamA.players.length, 5)
    assert.throws(
      () => matchPackage.createMatchPackage([teamA, teamA]),
      error => error.code === matchPackage.MATCH_PACKAGE_ERROR_CODES.DUPLICATE_TEAMS
    )
  })

  test('classifies refresh, swap, and replacement imports', () => {
    const teamA = createTeam('library-a', 'Alpha', 'ALP')
    const teamB = createTeam('library-b', 'Bravo', 'BRV')
    const teamC = createTeam('library-c', 'Charlie', 'CHR')
    const project = {
      teams: [
        { id: 'project-a', libraryId: 'library-a', name: 'Alpha', shortName: 'ALP' },
        { id: 'project-b', libraryId: 'library-b', name: 'Bravo', shortName: 'BRV' }
      ],
      currentMatch: { teamAId: 'project-a', teamBId: 'project-b' }
    }

    assert.equal(
      matchPackage.getMatchPackageImportMode(project, matchPackage.createMatchPackage([teamA, teamB])),
      matchPackage.MATCH_PACKAGE_IMPORT_MODES.REFRESH
    )
    assert.equal(
      matchPackage.getMatchPackageImportMode(project, matchPackage.createMatchPackage([teamB, teamA])),
      matchPackage.MATCH_PACKAGE_IMPORT_MODES.SWAP
    )
    assert.equal(
      matchPackage.getMatchPackageImportMode(project, matchPackage.createMatchPackage([teamA, teamC])),
      matchPackage.MATCH_PACKAGE_IMPORT_MODES.REPLACE
    )
  })

  test('resets match-only state while preserving format and event data', () => {
    const draft = {
      event: { name: 'Keep Event' },
      currentMatch: {
        ft: 3,
        status: 'live',
        score: { teamA: 2, teamB: 1 },
        currentMapIndex: 3,
        bansA: ['hero-a'],
        bansB: ['hero-b'],
        startingFive: { teamA: ['a'], teamB: ['b'] },
        substitutes: { teamA: ['sub-a'], teamB: ['sub-b'] },
        mapLineup: [{ mapId: 'ilios', winnerSide: 'A', bansA: ['hero-a'] }],
        result: { winnerSide: 'A', note: 'old result' },
        pause: { visible: true },
        notice: { visible: true },
        hud: { showBanPhase: true, activeComms: 'A' }
      },
      scenes: { settings: {} },
      tools: { graphics: {} }
    }

    matchPackage.resetProjectForNewMatchPackage(draft)

    assert.equal(draft.event.name, 'Keep Event')
    assert.equal(draft.currentMatch.ft, 3)
    assert.deepEqual(draft.currentMatch.score, { teamA: 0, teamB: 0 })
    assert.equal(draft.currentMatch.mapLineup.length, 5)
    assert.equal(draft.currentMatch.mapLineup[0].mapId, 'ilios')
    assert.deepEqual(draft.currentMatch.mapLineup[0].bansA, [])
    assert.deepEqual(draft.currentMatch.startingFive, { teamA: [], teamB: [] })
    assert.equal(draft.currentMatch.result.winnerSide, '')
    assert.equal(draft.currentMatch.pause.visible, false)
    assert.equal(draft.currentMatch.hud.showBanPhase, false)
  })

  test('allows larger library backups without raising the regular project import limit', () => {
    const backupHeader = JSON.stringify({
      schemaVersion: 'owbt-team-library-v1',
      exportedAt: '2026-07-21T00:00:00.000Z',
      teams: []
    })

    assert.equal(teamProjectImport.isOwbtTeamLibraryBackupText(backupHeader), true)
    assert.equal(
      teamProjectImport.getOwbtTeamSourceByteLimit(backupHeader),
      teamProjectImport.MAX_TEAM_LIBRARY_BACKUP_BYTES
    )
    assert.equal(
      teamProjectImport.getOwbtTeamSourceByteLimit(JSON.stringify({ schemaVersion: 'owbt-project-v1' })),
      teamProjectImport.MAX_OWBT_TEAM_SOURCE_BYTES
    )
    assert.equal(teamProjectImport.MAX_OWBT_TEAM_SOURCE_BYTES, 24 * 1024 * 1024)
    assert.equal(teamProjectImport.MAX_TEAM_LIBRARY_BACKUP_BYTES, 128 * 1024 * 1024)
  })

  test('round-trips a library backup as a non-destructive merge', () => {
    const original = {
      ...createTeam('library-a', 'Alpha', 'ALP'),
      logo: 'data:image/svg+xml;base64,PHN2Zy8+',
      coach: 'Coach Alpha',
      updatedAt: '2026-07-21T10:00:00.000Z'
    }
    const stale = {
      ...createTeam('library-a', 'Alpha', 'ALP'),
      logo: '',
      coach: 'Old Coach',
      updatedAt: '2026-07-20T10:00:00.000Z'
    }
    const unrelated = createTeam('library-b', 'Bravo', 'BRV')
    const backupText = JSON.stringify(teamLibraryModel.createLibraryBackup([original]))
    const parsed = teamProjectImport.parseOwbtTeamSource(backupText, [stale, unrelated])
    const mergePlan = teamLibraryModel.createLibraryMergePlan(parsed.records, [stale, unrelated], {
      preserveMissingFields: false
    })

    assert.equal(parsed.sourceKind, 'library-backup')
    assert.equal(mergePlan.additions, 0)
    assert.equal(mergePlan.updates, 1)
    assert.equal(mergePlan.records[0].id, 'library-a')
    assert.equal(mergePlan.records[0].logo, original.logo)
    assert.equal(mergePlan.records[0].coach, 'Coach Alpha')
    assert.equal(unrelated.id, 'library-b')
  })
})
