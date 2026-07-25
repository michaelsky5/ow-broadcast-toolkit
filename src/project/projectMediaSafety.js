const clean = value => String(value || '').trim()

export const isEmbeddedVideoSource = value => /^(?:data|blob):/i.test(clean(value))

export const hasEmbeddedVideoReferences = settings => {
  if (isEmbeddedVideoSource(settings?.sourceUrl) || isEmbeddedVideoSource(settings?.activeVideoPath)) {
    return true
  }

  if ((Array.isArray(settings?.videoLibrary) ? settings.videoLibrary : []).some(item => isEmbeddedVideoSource(item?.path))) {
    return true
  }

  return (Array.isArray(settings?.videoPlaylist) ? settings.videoPlaylist : []).some(isEmbeddedVideoSource)
}

export const removeEmbeddedVideoReferences = settings => {
  const activeWasEmbedded = isEmbeddedVideoSource(settings?.activeVideoPath)
  const sourceWasEmbedded = isEmbeddedVideoSource(settings?.sourceUrl)
  const activeVideoPath = activeWasEmbedded ? '' : clean(settings?.activeVideoPath)
  const sourceUrl = sourceWasEmbedded ? '' : clean(settings?.sourceUrl)
  const videoLibrary = (Array.isArray(settings?.videoLibrary) ? settings.videoLibrary : [])
    .filter(item => !isEmbeddedVideoSource(item?.path))
  const videoPlaylist = (Array.isArray(settings?.videoPlaylist) ? settings.videoPlaylist : [])
    .filter(path => !isEmbeddedVideoSource(path))
  const removedActiveSource = activeWasEmbedded || sourceWasEmbedded
  const hasRemainingActiveSource = Boolean(activeVideoPath || sourceUrl)

  return {
    activeVideoPath,
    sourceUrl,
    videoLibrary,
    videoPlaylist,
    ...(
      removedActiveSource && !hasRemainingActiveSource
        ? { sourceName: '', sourceType: '' }
        : {}
    )
  }
}

// Kept for callers that explicitly request destructive cleanup. Loading,
// saving, and syncing must use sanitizeProjectEmbeddedVideoSources below,
// which intentionally preserves legacy embedded media.
export const normalizeMediaVideoReferences = removeEmbeddedVideoReferences

// Legacy Data/Blob media may be the only copy a user has. Normal project
// loading and persistence must therefore be lossless; MediaEditor offers the
// explicit cleanup action after warning the user.
export const sanitizeProjectEmbeddedVideoSources = project => project
