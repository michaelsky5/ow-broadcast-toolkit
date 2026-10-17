import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createServer } from 'vite'

describe('event roster limits and complete team transfers', () => {
  let vite
  let library
  let csv
  let sourceImport
  let packages
  let projectUtils
  let rosterUtils
  let rules

  before(async () => {
    vite = await createServer({
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true }
    })
    library = await vite.ssrLoadModule('/src/team-library/teamLibraryModel.js')
    csv = await vite.ssrLoadModule('/src/team-library/teamLibraryCsv.js')
    sourceImport = await vite.ssrLoadModule('/src/team-library/teamProjectImport.js')
    packages = await vite.ssrLoadModule('/src/team-library/matchPackage.js')
    projectUtils = await vite.ssrLoadModule('/src/project/projectUtils.js')
    rosterUtils = await vite.ssrLoadModule('/src/app/editors/roster/rosterEditorUtils.js')
    rules = await vite.ssrLoadModule('/src/project/rosterRules.js')
  })

  after(async () => { await vite?.close() })

  const createTeam = (id, count = 8) => ({
    id,
    name: `Team ${id}`,
    shortName: id.toUpperCase(),
    players: Array.from({ length: count }, (_, index) => ({
      id: `${id}-${index + 1}`,
      name: `Player ${id} ${index + 1}`,
      battleTag: `${id}${index + 1}#1234`,
      role: ['tank', 'damage', 'damage', 'support', 'support'][index % 5]
    }))
  })

  test('keeps the eighth player through library normalization, backups and JSON imports', () => {
    const team = createTeam('alpha')
    const normalized = library.normalizeLibraryTeam(team)
    assert.equal(normalized.players.length, 8)
    const backup = library.createLibraryBackup([normalized])
    assert.equal(library.normalizeLibraryBackup(JSON.parse(JSON.stringify(backup)))[0].players.length, 8)
    const imported = sourceImport.parseOwbtTeamSource(JSON.stringify(backup))
    assert.equal(imported.records[0].players[7].battleTag, 'alpha8#1234')
    assert.equal(imported.omittedPlayers, 0)
    const teamDb = sourceImport.parseOwbtTeamSource({ schemaVersion: 'owbt-team-db-v1', teams: [team] })
    assert.equal(teamDb.records[0].players.length, 8)
    assert.equal(teamDb.omittedPlayers, 0)
  })

  test('imports all eight players from team CSV and a player CSV update', () => {
    const team = createTeam('alpha')
    const input = [
      'teamName,shortName,playerName,battleTag,role',
      ...team.players.map(player => `${team.name},${team.shortName},${player.name},${player.battleTag},${player.role}`)
    ].join('\n')
    const imported = csv.parseTeamLibraryCsv(input)
    assert.equal(imported.records[0].players.length, 8)
    assert.equal(imported.omittedPlayers, 0)
    const existing = { ...team, players: team.players.slice(0, 7) }
    const updated = csv.parseTeamPlayerCsv(input, [existing])
    assert.equal(updated.records[0].players.length, 8)
    assert.equal(updated.addedPlayers, 1)
    assert.equal(updated.omittedPlayers, 0)
  })

  test('keeps complete rosters through a package, project export and team database export; starters stay five', () => {
    const matchPackage = packages.createMatchPackage([createTeam('alpha'), createTeam('bravo')])
    const parsed = packages.parseMatchPackage(packages.stringifyMatchPackage(matchPackage))
    assert.equal(parsed.teams.teamA.players.length, 8)
    const project = projectUtils.normalizeProject({ event: { rosterLimit: 8 } })
    packages.applyMatchPackageToProject(project, parsed)
    for (const side of ['teamA', 'teamB']) {
      const players = projectUtils.getTeamPlayers(project, project.currentMatch[`${side}Id`])
      assert.equal(players.length, 8)
      assert.equal(project.currentMatch.startingFive[side].length, 5)
      assert.equal(rosterUtils.getStartingFiveForTeam(project, project.currentMatch[`${side}Id`]).length, 5)
    }
    const restored = projectUtils.safeParseProject(projectUtils.stringifyProject(project))
    assert.equal(restored.event.rosterLimit, 8)
    assert.equal(projectUtils.getTeamPlayers(restored, restored.currentMatch.teamAId).length, 8)
    assert.equal(rosterUtils.buildTeamDbExport(restored).teams[0].players.length, 8)
    assert.equal(library.createLibraryRecordFromProject(restored, restored.teams[0]).record.players.length, 8)
  })

  test('merges duplicate teams without discarding players past the old seven-player ceiling', () => {
    const complete = createTeam('alpha')
    const first = { ...complete, players: complete.players.slice(0, 7) }
    const second = { ...complete, id: 'alpha-copy', players: complete.players.slice(7) }
    const merged = library.mergeLibraryDuplicateGroup([first, second], first.id)
    assert.equal(merged.record.players.length, 8)
    assert.deepEqual(merged.omittedPlayers, [])
    const plan = library.createLibraryMergePlan([second], [first], { preserveMissingFields: true })
    assert.equal(plan.records[0].players.length, 8)
  })

  test('defaults legacy projects to seven and validates the event setting without trimming data', () => {
    assert.equal(projectUtils.normalizeProject({}).event.rosterLimit, 7)
    for (const value of [undefined, null, '', 'invalid', Infinity]) {
      assert.equal(rules.normalizeRosterLimit(value), 7)
    }
    assert.equal(rules.normalizeRosterLimit('8'), 8)
    assert.equal(rules.normalizeRosterLimit(3), 5)
    assert.equal(rules.normalizeRosterLimit(99), 12)
    const project = projectUtils.normalizeProject({ event: { rosterLimit: 7 } })
    packages.applyMatchPackageToProject(project, packages.createMatchPackage([createTeam('alpha'), createTeam('bravo')]))
    assert.equal(project.event.rosterLimit, 7)
    assert.equal(projectUtils.getTeamPlayers(project, project.currentMatch.teamAId).length, 8)
  })

  test('lowering and restoring the limit preserves all players and output selections', () => {
    const project = projectUtils.normalizeProject({ event: { rosterLimit: 8 } })
    packages.applyMatchPackageToProject(project, packages.createMatchPackage([createTeam('alpha'), createTeam('bravo')]))
    const players = projectUtils.getTeamPlayers(project, project.currentMatch.teamAId)
    const selected = players.map(player => player.id)
    project.scenes.settings.roster.activePlayerIds.teamA = [...selected]
    assert.equal(rules.getRosterOutputIds(players, selected, rules.getRosterLimit(project)).length, 8)

    project.event.rosterLimit = 7
    const restored = projectUtils.safeParseProject(projectUtils.stringifyProject(project))
    const restoredPlayers = projectUtils.getTeamPlayers(restored, restored.currentMatch.teamAId)
    const savedIds = restored.scenes.settings.roster.activePlayerIds.teamA
    assert.equal(restoredPlayers.length, 8)
    assert.deepEqual(savedIds, selected)
    assert.equal(rules.getRosterOutputIds(restoredPlayers, savedIds, rules.getRosterLimit(restored)).length, 7)
    restored.event.rosterLimit = 8
    assert.equal(rules.getRosterOutputIds(restoredPlayers, savedIds, rules.getRosterLimit(restored)).length, 8)

    // A seven-player output can include the eighth member of the stored roster.
    assert.ok(rules.getRosterOutputIds(players, selected.slice(1), 7).includes(players[7].id))
    assert.equal(rules.getRosterOutputIds(players, ['missing', selected[7], selected[7]], 8).length, 5)
  })

  test('can replace a selected player at the five-player limit without changing the stored roster', () => {
    const players = createTeam('alpha').players
    const selected = players.slice(0, 5).map(player => player.id)
    const nextIds = rules.toggleRosterOutputId(players, selected, players[7].id, true, 5)
    assert.deepEqual(nextIds, [...selected.slice(0, 4), players[7].id])
    assert.equal(players.length, 8)
    assert.equal(rules.toggleRosterOutputId(players, selected, selected[0], false, 5), null)
    assert.equal(rules.toggleRosterOutputId(players, selected, 'unknown', true, 5), null)
    assert.equal(rules.toggleRosterOutputId(players, players.slice(0, 7).map(player => player.id), players[7].id, true, 7), null)
  })

  // Exercise scene rendering in the real browser; mapped-drive SSR cannot resolve React's JSX runtime.
  test('supports complete selections at each event limit without changing the five-player lineup', () => {
    const project = projectUtils.normalizeProject({ event: { rosterLimit: 12 } })
    packages.applyMatchPackageToProject(project, packages.createMatchPackage([createTeam('alpha', 12), createTeam('bravo', 12)]))
    const players = projectUtils.getTeamPlayers(project, project.currentMatch.teamAId)
    const selected = players.map(player => player.id)
    for (let limit = 5; limit <= 12; limit += 1) {
      assert.equal(rules.getRosterOutputIds(players, selected, limit).length, limit)
    }
    assert.equal(project.currentMatch.startingFive.teamA.length, 5)
    assert.equal(projectUtils.getTeamPlayers(project, project.currentMatch.teamAId).length, 12)
  })
})
