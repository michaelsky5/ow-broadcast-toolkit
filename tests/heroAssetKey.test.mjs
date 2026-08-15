import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveHeroAssetKey } from '../src/data/overwatch/heroAssetKey.js'

test('resolves hero ids to asset keys while preserving legacy asset values', () => {
  const heroById = {
    dmon: { id: 'dmon', assetKey: 'd.mon' },
    dva: { id: 'dva', assetKey: 'dva' }
  }

  assert.equal(resolveHeroAssetKey('dmon', heroById), 'd.mon')
  assert.equal(resolveHeroAssetKey('DVA', heroById), 'dva')
  assert.equal(resolveHeroAssetKey('d.mon', heroById), 'd.mon')
  assert.equal(resolveHeroAssetKey('', heroById), '')
})
