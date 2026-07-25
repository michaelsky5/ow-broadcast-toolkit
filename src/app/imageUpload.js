export const PROJECT_IMAGE_TARGET_BYTES = 256 * 1024
export const PROJECT_IMAGE_MAX_OUTPUT_BYTES = 384 * 1024
export const PROJECT_IMAGE_MAX_PASSTHROUGH_BYTES = 256 * 1024
export const PROJECT_IMAGE_MAX_INPUT_BYTES = 12 * 1024 * 1024
export const PROJECT_IMAGE_MAX_SOURCE_PIXELS = 24_000_000

const DEFAULT_MAX_DIMENSION = 1280
const DEFAULT_MIN_DIMENSION = 512
const OUTPUT_QUALITIES = [0.86, 0.76, 0.66, 0.56]
const RESIZE_STEPS = [1, 0.86, 0.72, 0.6]

export class ProjectImageUploadError extends Error {
  constructor(code, details = {}) {
    super(code)
    this.name = 'ProjectImageUploadError'
    this.code = code
    this.details = details
  }
}

const clean = value => String(value || '').trim()

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = event => resolve(String(event.target?.result || ''))
  reader.onerror = () => reject(new ProjectImageUploadError('read-failed'))
  reader.readAsDataURL(file)
})

const loadImage = file => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  image.onload = () => {
    URL.revokeObjectURL(objectUrl)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new ProjectImageUploadError('decode-failed'))
  }
  image.src = objectUrl
})

const canvasToBlob = (canvas, type, quality) => new Promise(resolve => {
  canvas.toBlob(resolve, type, quality)
})

const getFileExtension = file => clean(file?.name).split('.').pop()?.toLowerCase() || ''

const normalizeImageDimension = value => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.floor(numeric)) : 1
}

export const isProjectImageFile = file => {
  if (!file) return false
  if (clean(file.type).toLowerCase().startsWith('image/')) return true
  return ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(getFileExtension(file))
}

export const keepsOriginalImageEncoding = file => {
  const type = clean(file?.type).toLowerCase()
  const extension = getFileExtension(file)
  return type === 'image/svg+xml' || type === 'image/gif' || extension === 'svg' || extension === 'gif'
}

export const fitProjectImageDimensions = (width, height, maxDimension) => {
  const safeWidth = normalizeImageDimension(width)
  const safeHeight = normalizeImageDimension(height)
  const safeMax = Math.max(1, Number(maxDimension) || DEFAULT_MAX_DIMENSION)
  const scale = Math.min(1, safeMax / Math.max(safeWidth, safeHeight))

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale))
  }
}

export const inspectProjectImageSource = (width, height, options = {}) => {
  const safeWidth = normalizeImageDimension(width)
  const safeHeight = normalizeImageDimension(height)
  const maxDimension = Math.max(1, Number(options.maxDimension) || DEFAULT_MAX_DIMENSION)
  const maxSourcePixels = Math.max(
    1,
    Number(options.maxSourcePixels) || PROJECT_IMAGE_MAX_SOURCE_PIXELS
  )
  const pixels = safeWidth * safeHeight

  return {
    width: safeWidth,
    height: safeHeight,
    pixels,
    maxSourcePixels,
    exceedsMaxDimension: Math.max(safeWidth, safeHeight) > maxDimension,
    exceedsSourcePixelLimit: pixels > maxSourcePixels
  }
}

export const canKeepOriginalProjectRaster = ({
  candidateBytes = Number.POSITIVE_INFINITY,
  fileBytes,
  maxDimension = DEFAULT_MAX_DIMENSION,
  maxOutputBytes = PROJECT_IMAGE_MAX_OUTPUT_BYTES,
  sourceHeight,
  sourceWidth
}) => {
  const width = Number(sourceWidth)
  const height = Number(sourceHeight)
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return false
  }

  const source = inspectProjectImageSource(width, height, { maxDimension })
  const safeFileBytes = Math.max(0, Number(fileBytes) || 0)
  const safeCandidateBytes = Number(candidateBytes)

  return (
    !source.exceedsMaxDimension &&
    safeFileBytes <= Math.max(0, Number(maxOutputBytes) || 0) &&
    (
      !Number.isFinite(safeCandidateBytes) ||
      safeFileBytes <= Math.max(0, safeCandidateBytes)
    )
  )
}

const formatBytes = bytes => {
  const value = Math.max(0, Number(bytes) || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const formatMegapixels = pixels => {
  const value = Math.max(0, Number(pixels) || 0) / 1_000_000
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MP`
}

const getErrorLimit = error => error?.details?.maxBytes || PROJECT_IMAGE_MAX_OUTPUT_BYTES

export const getProjectImageUploadErrorMessage = (error, language = 'en') => {
  const isChinese = String(language).toLowerCase().startsWith('zh')
  const code = error?.code || 'processing-failed'
  const limit = formatBytes(getErrorLimit(error))
  const sourcePixelLimit = formatMegapixels(
    error?.details?.maxPixels || PROJECT_IMAGE_MAX_SOURCE_PIXELS
  )
  const sourceDimensions = error?.details?.width && error?.details?.height
    ? `${error.details.width}×${error.details.height}`
    : ''

  const messages = isChinese
    ? {
        'unsupported-file': '请选择 PNG、JPEG、WebP、AVIF、SVG 或 GIF 图片。',
        'input-too-large': `原始图片超过安全上限 ${limit}，请先在本地缩小图片。`,
        'source-pixels-too-large': `图片分辨率${sourceDimensions ? ` ${sourceDimensions}` : ''}超过 ${sourcePixelLimit} 安全上限，请先在本地缩小尺寸。`,
        'passthrough-too-large': `SVG/GIF 不会自动压缩，文件必须小于 ${limit}。请精简文件或改用 PNG/WebP。`,
        'output-too-large': `图片无法安全压缩到 ${limit} 以内，请降低分辨率或改用更简单的图片。`,
        'decode-failed': '浏览器无法解析这张图片，请重新导出为 PNG、JPEG 或 WebP。',
        'canvas-unavailable': `浏览器无法压缩图片；仅允许直接保存小于 ${limit} 的文件。`,
        'read-failed': '浏览器读取图片失败，请重新选择文件。',
        'processing-failed': '图片处理失败，请使用尺寸更小的 PNG、JPEG 或 WebP。'
      }
    : {
        'unsupported-file': 'Choose a PNG, JPEG, WebP, AVIF, SVG, or GIF image.',
        'input-too-large': `The original image exceeds the ${limit} safety limit. Resize it locally first.`,
        'source-pixels-too-large': `The image resolution${sourceDimensions ? ` (${sourceDimensions})` : ''} exceeds the ${sourcePixelLimit} safety limit. Resize its dimensions locally first.`,
        'passthrough-too-large': `SVG and GIF files are not recompressed and must be smaller than ${limit}. Simplify the file or use PNG/WebP.`,
        'output-too-large': `The image could not be safely compressed below ${limit}. Reduce its resolution or use a simpler image.`,
        'decode-failed': 'The browser could not decode this image. Re-export it as PNG, JPEG, or WebP.',
        'canvas-unavailable': `The browser cannot compress images; only files smaller than ${limit} can be stored directly.`,
        'read-failed': 'The browser could not read this image. Choose the file again.',
        'processing-failed': 'Image processing failed. Use a smaller PNG, JPEG, or WebP image.'
      }

  return messages[code] || messages['processing-failed']
}

export const getBilingualProjectImageUploadErrorMessage = error => (
  `${getProjectImageUploadErrorMessage(error, 'zh')}\n${getProjectImageUploadErrorMessage(error, 'en')}`
)

const createCanvas = (width, height, errorDetails = {}) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new ProjectImageUploadError('canvas-unavailable', errorDetails)

  canvas.width = width
  canvas.height = height
  return { canvas, context }
}

const compressRasterImage = async (file, options) => {
  const image = await loadImage(file)
  const sourceWidth = image.naturalWidth || image.width || 1
  const sourceHeight = image.naturalHeight || image.height || 1
  const source = inspectProjectImageSource(sourceWidth, sourceHeight, options)

  if (source.exceedsSourcePixelLimit) {
    throw new ProjectImageUploadError('source-pixels-too-large', {
      height: source.height,
      maxPixels: source.maxSourcePixels,
      pixels: source.pixels,
      width: source.width
    })
  }

  let bestCandidate = null

  for (const step of RESIZE_STEPS) {
    const requestedMax = Math.max(options.minDimension, Math.round(options.maxDimension * step))
    const outputSize = fitProjectImageDimensions(source.width, source.height, requestedMax)
    const { canvas, context } = createCanvas(outputSize.width, outputSize.height, {
      maxDimension: options.maxDimension,
      sourceHeight: source.height,
      sourceWidth: source.width
    })
    context.drawImage(image, 0, 0, outputSize.width, outputSize.height)

    for (const quality of OUTPUT_QUALITIES) {
      const candidate = await canvasToBlob(canvas, 'image/webp', quality)
      if (!candidate) continue

      if (!bestCandidate || candidate.size < bestCandidate.blob.size) {
        bestCandidate = {
          blob: candidate,
          width: outputSize.width,
          height: outputSize.height
        }
      }

      if (candidate.size <= options.targetBytes) {
        return { candidate: bestCandidate, source }
      }
    }

    if (Math.max(outputSize.width, outputSize.height) <= options.minDimension) break
  }

  return { candidate: bestCandidate, source }
}

export const prepareProjectImage = async (file, options = {}) => {
  const targetBytes = options.targetBytes || PROJECT_IMAGE_TARGET_BYTES
  const maxOutputBytes = options.maxOutputBytes || PROJECT_IMAGE_MAX_OUTPUT_BYTES
  const maxPassthroughBytes = options.maxPassthroughBytes || PROJECT_IMAGE_MAX_PASSTHROUGH_BYTES
  const maxInputBytes = options.maxInputBytes || PROJECT_IMAGE_MAX_INPUT_BYTES
  const maxSourcePixels = options.maxSourcePixels || PROJECT_IMAGE_MAX_SOURCE_PIXELS
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const minDimension = Math.min(maxDimension, options.minDimension || DEFAULT_MIN_DIMENSION)
  const readDataUrl = options.readDataUrl || readFileAsDataUrl

  if (!isProjectImageFile(file)) {
    throw new ProjectImageUploadError('unsupported-file')
  }

  if (file.size > maxInputBytes) {
    throw new ProjectImageUploadError('input-too-large', { maxBytes: maxInputBytes })
  }

  if (keepsOriginalImageEncoding(file)) {
    if (file.size > maxPassthroughBytes) {
      throw new ProjectImageUploadError('passthrough-too-large', { maxBytes: maxPassthroughBytes })
    }

    return {
      dataUrl: await readDataUrl(file),
      originalBytes: file.size,
      outputBytes: file.size,
      compressed: false
    }
  }

  let compression
  try {
    compression = await compressRasterImage(file, {
      maxDimension,
      maxSourcePixels,
      minDimension,
      targetBytes
    })
  } catch (error) {
    if (
      error?.code === 'canvas-unavailable' &&
      canKeepOriginalProjectRaster({
        fileBytes: file.size,
        maxDimension,
        maxOutputBytes,
        sourceHeight: error.details?.sourceHeight,
        sourceWidth: error.details?.sourceWidth
      })
    ) {
      return {
        dataUrl: await readDataUrl(file),
        originalBytes: file.size,
        outputBytes: file.size,
        compressed: false
      }
    }
    throw error instanceof ProjectImageUploadError
      ? error
      : new ProjectImageUploadError('processing-failed')
  }

  const candidate = compression?.candidate || null
  const source = compression?.source || inspectProjectImageSource(1, 1, {
    maxDimension,
    maxSourcePixels
  })

  if (!candidate) {
    if (canKeepOriginalProjectRaster({
      fileBytes: file.size,
      maxDimension,
      maxOutputBytes,
      sourceHeight: source.height,
      sourceWidth: source.width
    })) {
      return {
        dataUrl: await readDataUrl(file),
        originalBytes: file.size,
        outputBytes: file.size,
        compressed: false
      }
    }
    throw new ProjectImageUploadError('processing-failed', { maxBytes: maxOutputBytes })
  }

  if (canKeepOriginalProjectRaster({
    candidateBytes: candidate.blob.size,
    fileBytes: file.size,
    maxDimension,
    maxOutputBytes,
    sourceHeight: source.height,
    sourceWidth: source.width
  })) {
    return {
      dataUrl: await readDataUrl(file),
      originalBytes: file.size,
      outputBytes: file.size,
      compressed: false
    }
  }

  if (candidate.blob.size > maxOutputBytes) {
    throw new ProjectImageUploadError('output-too-large', { maxBytes: maxOutputBytes })
  }

  return {
    dataUrl: await readDataUrl(candidate.blob),
    originalBytes: file.size,
    outputBytes: candidate.blob.size,
    width: candidate.width,
    height: candidate.height,
    compressed: true
  }
}
