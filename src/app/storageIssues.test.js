import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  getLatestStorageIssue,
  recordStorageIssue,
  resolveStorageIssue
} from './storageIssues.js'

describe('storage issue tracking', () => {
  test('a successful operation clears only its own failure', () => {
    const projectFailure = recordStorageIssue(new Map(), {
      operation: 'saveStoredProject',
      name: 'ProjectTooLargeError',
      serializedBytes: 2_000_000
    })
    const twoFailures = recordStorageIssue(projectFailure, {
      operation: 'saveConsoleSettings',
      name: 'QuotaExceededError',
      serializedBytes: 1_024
    })
    const settingsRecovered = resolveStorageIssue(twoFailures, 'saveConsoleSettings')

    assert.equal(settingsRecovered.size, 1)
    assert.deepEqual(getLatestStorageIssue(settingsRecovered), {
      operation: 'saveStoredProject',
      name: 'ProjectTooLargeError',
      serializedBytes: 2_000_000
    })
  })

  test('unrelated success cannot dismiss an unsaved operation', () => {
    const failures = recordStorageIssue(new Map(), {
      operation: 'saveStoredProgramProject',
      name: 'QuotaExceededError'
    })
    const unchanged = resolveStorageIssue(failures, 'saveConsoleSettings')

    assert.equal(unchanged, failures)
    assert.equal(unchanged.size, 1)
  })

  test('repeated failures update and move that operation to the latest position', () => {
    let failures = recordStorageIssue(new Map(), {
      operation: 'saveStoredProject',
      name: 'QuotaExceededError'
    })
    failures = recordStorageIssue(failures, {
      operation: 'saveStoredProgramProject',
      name: 'QuotaExceededError'
    })
    failures = recordStorageIssue(failures, {
      operation: 'saveStoredProject',
      name: 'ProjectTooLargeError',
      serializedBytes: 3_000_000
    })

    assert.equal(failures.size, 2)
    assert.equal(getLatestStorageIssue(failures).operation, 'saveStoredProject')
    assert.equal(getLatestStorageIssue(failures).serializedBytes, 3_000_000)
  })
})
