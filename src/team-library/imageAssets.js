import { prepareProjectImage } from '../app/imageUpload'
import {
  TEAM_LIBRARY_MAX_AVATAR_BYTES,
  TEAM_LIBRARY_MAX_LOGO_BYTES,
  inspectTeamLibraryAssetSource
} from './teamLibraryStorageSafety'

const DEFAULT_MAX_DIMENSION = 512
const DEFAULT_TARGET_BYTES = 256 * 1024
const MAX_LIBRARY_IMAGE_INPUT_BYTES = 3 * 1024 * 1024
const IMAGE_MIME_BY_EXTENSION = Object.freeze({
  gif: 'image/gif',
  svg: 'image/svg+xml'
})

const withPassThroughMimeType = file => {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase() || ''
  const inferredType = IMAGE_MIME_BY_EXTENSION[extension]
  if (!inferredType || String(file?.type || '').toLowerCase() === inferredType) return file

  return new File([file], file.name, {
    lastModified: file.lastModified,
    type: inferredType
  })
}

export const optimizeLibraryImage = async (file, options = {}) => {
  const kind = options.kind === 'avatar' ? 'avatar' : 'logo'
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const targetBytes = options.targetBytes || DEFAULT_TARGET_BYTES
  const maxOutputBytes = options.maxOutputBytes || (
    kind === 'avatar' ? TEAM_LIBRARY_MAX_AVATAR_BYTES : TEAM_LIBRARY_MAX_LOGO_BYTES
  )
  const safeFile = withPassThroughMimeType(file)
  const result = await prepareProjectImage(safeFile, {
    maxDimension,
    minDimension: Math.min(maxDimension, options.minDimension || 256),
    maxInputBytes: MAX_LIBRARY_IMAGE_INPUT_BYTES,
    maxOutputBytes,
    maxPassthroughBytes: maxOutputBytes,
    targetBytes
  })

  inspectTeamLibraryAssetSource(result.dataUrl, { kind, maxBytes: maxOutputBytes })
  return result
}
