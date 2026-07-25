import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createUndoSnapshotResult } from './projectUndo.js'

describe('project undo snapshot safety', () => {
  test('returns a complete snapshot result that is independent from live state', () => {
    const project = { event: { name: 'Current' } }
    const programProject = { event: { name: 'Program' } }
    const result = createUndoSnapshotResult({
      createdAt: 123,
      editorSceneId: 'media',
      previewSceneId: 'media',
      programProject,
      project,
      reason: 'IMPORT PROJECT',
      workspaceMode: 'production'
    })

    assert.equal(result.ok, true)
    assert.equal(result.snapshot.id, '123-IMPORT PROJECT')
    assert.notEqual(result.snapshot.project, project)
    assert.notEqual(result.snapshot.programProject, programProject)
    assert.equal(result.snapshot.project.event.name, 'Current')
  })

  test('rejects a snapshot over budget before cloning it', () => {
    let cloneCalls = 0
    const result = createUndoSnapshotResult({
      clone: value => {
        cloneCalls += 1
        return value
      },
      maxBytes: 64,
      programProject: { payload: 'y'.repeat(80) },
      project: { payload: 'x'.repeat(80) }
    })

    assert.equal(result.ok, false)
    assert.equal(result.code, 'SNAPSHOT_TOO_LARGE')
    assert.equal(cloneCalls, 0)
  })

  test('reports clone failures instead of claiming an undo snapshot exists', () => {
    const result = createUndoSnapshotResult({
      clone: () => {
        throw new Error('Cannot clone')
      },
      programProject: { event: {} },
      project: { event: {} }
    })

    assert.equal(result.ok, false)
    assert.equal(result.code, 'SNAPSHOT_CLONE_FAILED')
  })
})
