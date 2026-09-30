import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { tryCopyText } from '../src/app/clipboard.js'

describe('clipboard writes in embedded browsers', () => {
  test('copies the complete payload when access succeeds', async () => {
    const writes = []
    assert.equal(await tryCopyText('complete package', { writeText: async text => writes.push(text) }), true)
    assert.deepEqual(writes, ['complete package'])
  })

  test('unavailable or rejected clipboard access allows manual copying', async () => {
    assert.equal(await tryCopyText('package', null), false)
    assert.equal(await tryCopyText('package', { writeText: async () => { throw new Error('Denied') } }), false)
  })

  test('a clipboard promise that never settles returns to the manual path', async () => {
    assert.equal(await tryCopyText('package', { writeText: () => new Promise(() => {}) }, 15), false)
  })
})
