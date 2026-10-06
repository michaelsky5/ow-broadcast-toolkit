import { STAT_FIELDS as SCOREBOARD_OCR_STAT_FIELDS } from './statsCaptureReview.js'

// Relative to the numeric strip (E/A/D are narrower than DMG/H/MIT).
export const STATS_CELL_BOUNDARIES = [0, 0.125, 0.24, 0.385, 0.585, 0.79, 1]

export const parseStatsCellOcr = text => {
  const value = String(text ?? '').normalize('NFKC').trim()
  if (!/^(?:\d{1,6}|\d{1,3}(?:[, .]\d{3}){1,2})$/.test(value)) return ''
  const digits = value.replace(/\D/g, '')
  return digits.length <= 6 ? String(Number(digits)) : ''
}

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = src
})

export const buildStatsCellVariants = async (rowSnippet, field, grayscaleRow = '') => {
  const fieldIndex = SCOREBOARD_OCR_STAT_FIELDS.indexOf(field)
  if (!rowSnippet || fieldIndex < 0) return []
  const [img, preprocessedRow] = await Promise.all([
    loadImage(rowSnippet),
    grayscaleRow ? loadImage(grayscaleRow) : null
  ])
  const padding = 12

  return ['grayscale', 'contrast'].map(preprocessing => {
    // Reuse the row's grayscale pixels to avoid another resampling of thin strokes.
    const reuseGrayscale = preprocessing === 'grayscale' && preprocessedRow
    const source = reuseGrayscale || img
    const x = Math.round(source.width * STATS_CELL_BOUNDARIES[fieldIndex])
    const width = Math.round(source.width * STATS_CELL_BOUNDARIES[fieldIndex + 1]) - x
    const y = Math.round(source.height * 0.2)
    const height = Math.round(source.height * 0.6)
    const scale = reuseGrayscale ? 1 : Math.max(1.2, Math.min(5, 2 * 590 / source.width))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    canvas.width = w + padding * 2
    canvas.height = h + padding * 2
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, x, y, width, height, padding, padding, w, h)
    const image = ctx.getImageData(padding, padding, w, h)
    for (let index = 0; !reuseGrayscale && index < image.data.length; index += 4) {
      const luma = image.data[index] * 0.2126 + image.data[index + 1] * 0.7152 + image.data[index + 2] * 0.0722
      const color = preprocessing === 'contrast'
        ? 255 - Math.max(0, Math.min(255, (luma - 90) * 255 / 150))
        : 255 - luma
      image.data[index] = color
      image.data[index + 1] = color
      image.data[index + 2] = color
      image.data[index + 3] = 255
    }
    ctx.putImageData(image, padding, padding)
    return { preprocessing, image: canvas.toDataURL('image/png') }
  })
}

export const selectStatsCellCandidate = (diagnostic, candidates = []) => {
  const previousValue = String(diagnostic?.selectedValue ?? '')
  const reads = candidates.map(candidate => ({
    preprocessing: candidate.preprocessing,
    value: parseStatsCellOcr(candidate.text),
    confidence: Number(candidate.confidence) || 0
  }))
  const supported = new Set((diagnostic?.alternatives || []).map(item => item.value))
  const grayscale = reads.find(read => read.preprocessing === 'grayscale')
  const contrast = reads.find(read => read.preprocessing === 'contrast')
  const agreedValue = grayscale?.value && grayscale.value === contrast?.value
    && grayscale.confidence >= 80 && contrast.confidence >= 80
    && supported.has(grayscale.value)
    ? grayscale.value
    : ''

  // Both reads share the same pixels. Improve the suggestion, but keep the
  // existing human review requirement when the row OCR was ambiguous.
  return {
    previousValue,
    selectedValue: agreedValue || previousValue,
    changed: Boolean(agreedValue && agreedValue !== previousValue),
    candidates: reads
  }
}
