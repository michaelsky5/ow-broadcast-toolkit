const DEFAULT_MAX_DIMENSION = 512
const DEFAULT_TARGET_BYTES = 256 * 1024
const OUTPUT_QUALITIES = [0.88, 0.78, 0.68]

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = event => resolve(String(event.target?.result || ''))
  reader.onerror = () => reject(new Error('Failed to read image file.'))
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
    reject(new Error('Failed to decode image file.'))
  }
  image.src = objectUrl
})

const canvasToBlob = (canvas, type, quality) => new Promise(resolve => {
  canvas.toBlob(resolve, type, quality)
})

const getRasterSize = image => ({
  width: image.naturalWidth || image.width || 1,
  height: image.naturalHeight || image.height || 1
})

const fitInside = (width, height, maxDimension) => {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

const shouldKeepOriginalEncoding = file => (
  file.type === 'image/svg+xml' ||
  file.type === 'image/gif' ||
  /\.(?:svg|gif)$/i.test(file.name || '')
)

export const optimizeLibraryImage = async (file, options = {}) => {
  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION
  const targetBytes = options.targetBytes || DEFAULT_TARGET_BYTES
  const originalDataUrl = await readFileAsDataUrl(file)

  if (shouldKeepOriginalEncoding(file)) {
    return {
      dataUrl: originalDataUrl,
      originalBytes: file.size,
      outputBytes: file.size,
      compressed: false
    }
  }

  const image = await loadImage(file)
  const sourceSize = getRasterSize(image)
  const outputSize = fitInside(sourceSize.width, sourceSize.height, maxDimension)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) throw new Error('Canvas is unavailable.')

  canvas.width = outputSize.width
  canvas.height = outputSize.height
  context.drawImage(image, 0, 0, outputSize.width, outputSize.height)

  let optimizedBlob = null
  for (const quality of OUTPUT_QUALITIES) {
    const candidate = await canvasToBlob(canvas, 'image/webp', quality)
    if (!candidate) continue
    optimizedBlob = candidate
    if (candidate.size <= targetBytes) break
  }

  if (!optimizedBlob || (optimizedBlob.size >= file.size && outputSize.width === sourceSize.width && outputSize.height === sourceSize.height)) {
    return {
      dataUrl: originalDataUrl,
      originalBytes: file.size,
      outputBytes: file.size,
      width: sourceSize.width,
      height: sourceSize.height,
      compressed: false
    }
  }

  return {
    dataUrl: await readFileAsDataUrl(optimizedBlob),
    originalBytes: file.size,
    outputBytes: optimizedBlob.size,
    width: outputSize.width,
    height: outputSize.height,
    compressed: optimizedBlob.size < file.size || outputSize.width < sourceSize.width || outputSize.height < sourceSize.height
  }
}
