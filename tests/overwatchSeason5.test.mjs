import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('Season 5 fresh defaults only use heroes in the selected player role', async t => {
  // OWBT source uses Vite-resolved extensionless imports, as its existing workflow tests do.
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, logLevel: 'error' })
  t.after(() => server.close())
  const { OW_HEROES, OW_HERO_BY_ID } = await server.ssrLoadModule('/src/data/overwatch/heroes.js')
  const { OW_DATA_VERSION } = await server.ssrLoadModule('/src/data/overwatch/version.js')
  const { createDefaultPlayers } = await server.ssrLoadModule('/src/project/defaults/defaultParticipants.js')
  assert.equal(OW_HEROES.length, 54)
  assert.equal(OW_HERO_BY_ID.sombra.role, 'support')
  assert.equal(OW_HERO_BY_ID.doctrine.role, 'support')
  assert.equal(OW_DATA_VERSION, 'owbt-2026.10-season5')
  for (const player of createDefaultPlayers()) {
    for (const heroId of player.primaryHeroes) {
      assert.equal(OW_HERO_BY_ID[heroId]?.role, player.role, player.id + ': ' + heroId)
    }
  }
})
