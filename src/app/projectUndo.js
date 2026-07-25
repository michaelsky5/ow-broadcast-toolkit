export const UNDO_MEMORY_BUDGET_BYTES = 8 * 1024 * 1024

const estimateJsonBytes = value => {
  try {
    const serialized = JSON.stringify(value)
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(serialized).byteLength
    }
    return unescape(encodeURIComponent(serialized)).length
  } catch {
    return 0
  }
}

export const createUndoSnapshotResult = ({
  clone = structuredClone,
  createdAt = Date.now(),
  editorSceneId = '',
  maxBytes = UNDO_MEMORY_BUDGET_BYTES,
  previewSceneId = '',
  programProject,
  project,
  reason = 'EDIT',
  workspaceMode = 'production'
}) => {
  const approxBytes = estimateJsonBytes(project) + estimateJsonBytes(programProject)

  if (!approxBytes) {
    return {
      ok: false,
      code: 'SNAPSHOT_NOT_SERIALIZABLE',
      approxBytes
    }
  }

  if (approxBytes > maxBytes) {
    return {
      ok: false,
      code: 'SNAPSHOT_TOO_LARGE',
      approxBytes
    }
  }

  try {
    const normalizedReason = reason || 'EDIT'
    return {
      ok: true,
      snapshot: {
        id: `${createdAt}-${normalizedReason}`,
        createdAt,
        reason: normalizedReason,
        approxBytes,
        project: clone(project),
        programProject: clone(programProject),
        previewSceneId,
        editorSceneId,
        workspaceMode
      }
    }
  } catch {
    return {
      ok: false,
      code: 'SNAPSHOT_CLONE_FAILED',
      approxBytes
    }
  }
}
