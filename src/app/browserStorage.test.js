import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getBrowserLocalStorage } from './browserStorage.js'

describe('browser storage access', () => {
  test('returns the available localStorage object', () => {
    const storage = { getItem: () => null }
    assert.equal(getBrowserLocalStorage({ localStorage: storage }), storage)
  })

  test('fails closed when the localStorage getter throws', () => {
    const hostileWindow = {}
    Object.defineProperty(hostileWindow, 'localStorage', {
      get() {
        const error = new Error('Blocked by browser policy')
        error.name = 'SecurityError'
        throw error
      }
    })

    assert.equal(getBrowserLocalStorage(hostileWindow), null)
  })
})
