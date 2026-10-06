import { CORE_STATS, formatDataMinutes, sumStatRows } from '../../../project/statsModel.js'
import { DEFAULT_CAPTURE, normalizeCaptureConfig } from '../../../project/statsCaptureConfig.js'
import { STATS_CELL_BOUNDARIES } from './statsCellOcr.js'

const PREVIOUS_PANEL_TIME_CROP = {
  timeXPct: 66.8,
  timeYPct: 13.8,
  timeWPct: 8.4,
  timeHPct: 3.8
}

const PREVIOUS_RIGHT_TIME_CROP = {
  timeXPct: 84,
  timeYPct: 13,
  timeWPct: 12,
  timeHPct: 5
}

const PREVIOUS_TALL_TIME_CROP = {
  timeXPct: 88,
  timeYPct: 2.5,
  timeWPct: 12,
  timeHPct: 15
}

const STATS_DATA_WIDTH_RATIO = 0.92

const getResolutionNormalizedScale = (img, scale) => {
  const baseScale = Number(scale) || DEFAULT_CAPTURE.scale
  const height = Number(img.height) || 1080
  return Math.max(1.2, Math.min(5, baseScale * (1080 / height)))
}

export const onlyDigits = value => String(value || '').replace(/[^\d]/g, '')

const roundPct = value => Math.round(Number(value) * 10) / 10

const getPanelTimeCrop = capture => {
  const xPct = Number(capture.xPct ?? DEFAULT_CAPTURE.xPct) || DEFAULT_CAPTURE.xPct
  const topPct = Number(capture.topPct ?? DEFAULT_CAPTURE.topPct) || DEFAULT_CAPTURE.topPct
  const wPct = Number(capture.wPct ?? DEFAULT_CAPTURE.wPct) || DEFAULT_CAPTURE.wPct
  const timeWPct = Number(capture.timeWPct ?? DEFAULT_CAPTURE.timeWPct) || DEFAULT_CAPTURE.timeWPct

  return {
    timeXPct: roundPct(Math.max(0, Math.min(100 - timeWPct, xPct + wPct - timeWPct))),
    timeYPct: roundPct(Math.max(0, topPct - 4.7)),
    timeWPct: roundPct(timeWPct),
    timeHPct: roundPct(Number(capture.timeHPct ?? DEFAULT_CAPTURE.timeHPct) || DEFAULT_CAPTURE.timeHPct)
  }
}

const isSameTimeCrop = (capture, crop) => (
  ['timeXPct', 'timeYPct', 'timeWPct', 'timeHPct'].every(key => (
    Number(capture?.[key]) === crop[key]
  ))
)

export const resolveTimeCrop = capture => {
  const panelCrop = getPanelTimeCrop(capture)
  const defaultCrop = {
    timeXPct: DEFAULT_CAPTURE.timeXPct,
    timeYPct: DEFAULT_CAPTURE.timeYPct,
    timeWPct: DEFAULT_CAPTURE.timeWPct,
    timeHPct: DEFAULT_CAPTURE.timeHPct
  }

  if (
    isSameTimeCrop(capture, panelCrop)
    || isSameTimeCrop(capture, PREVIOUS_PANEL_TIME_CROP)
    || isSameTimeCrop(capture, PREVIOUS_RIGHT_TIME_CROP)
    || isSameTimeCrop(capture, PREVIOUS_TALL_TIME_CROP)
  ) {
    return defaultCrop
  }

  return {
    timeXPct: roundPct(Number(capture.timeXPct ?? defaultCrop.timeXPct) || defaultCrop.timeXPct),
    timeYPct: roundPct(Number(capture.timeYPct ?? defaultCrop.timeYPct) || defaultCrop.timeYPct),
    timeWPct: roundPct(Number(capture.timeWPct ?? defaultCrop.timeWPct) || defaultCrop.timeWPct),
    timeHPct: roundPct(Number(capture.timeHPct ?? defaultCrop.timeHPct) || defaultCrop.timeHPct)
  }
}

export const parseDurationMinutes = value => {
  const text = String(value || '').trim().replace(/\uFF1A/g, ':')
  if (!text) return 0

  if (/^\d{3,4}$/.test(text)) {
    const minutes = Number(text.slice(0, -2)) || 0
    const seconds = Number(text.slice(-2)) || 0
    if (seconds < 60) return minutes + (seconds / 60)
  }

  if (text.includes(':')) {
    const [minutes = '0', seconds = '0'] = text.split(':')
    return (Number(minutes) || 0) + ((Number(seconds) || 0) / 60)
  }

  return Number(text) || 0
}

export const normalizeDurationInput = value => {
  const text = String(value || '').trim().replace(/\uFF1A/g, ':')
  if (!text) return ''

  if (/^\d{3,4}$/.test(text)) {
    const minutes = Number(text.slice(0, -2)) || 0
    const seconds = Number(text.slice(-2)) || 0
    if (seconds < 60) return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  if (text.includes(':')) {
    const [minutes = '0', seconds = '0'] = text.split(':')
    const numericMinutes = Number(minutes) || 0
    const numericSeconds = Math.max(0, Math.min(59, Number(seconds) || 0))
    return `${numericMinutes}:${String(numericSeconds).padStart(2, '0')}`
  }

  return text
}

export const formatDurationInput = value => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  const minutes = Math.floor(numeric)
  const seconds = Math.round((numeric - minutes) * 60)
  if (!seconds) return String(minutes)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const formatDurationMinutes = formatDataMinutes

export const parseMatchTimeOcr = value => {
  const source = String(value || '').normalize('NFKC').trim()
  if (!source) return ''

  const normalized = source
    .replace(/[OoQqDd]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Zz]/g, '2')
    .replace(/[Bb]/g, '8')
    // Keep offsets aligned with source so labels and repaired glyphs can be checked.
    .replace(/[.,;]/g, ':')

  const candidates = []
  const isFpsContext = index => (
    /FPS\s*[:=]?\s*$/i.test(source.slice(Math.max(0, index - 12), index))
    || /FPS$/i.test(source.slice(0, index + 1))
  )
  const addCandidate = (minutesText, secondsText, index, score, matchedText) => {
    if (isFpsContext(index)) return

    const minutes = Number(minutesText)
    const seconds = Number(secondsText)
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 99) return
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return

    const originalText = source.slice(index, index + matchedText.length)
    const repairedGlyphs = [...originalText].filter((char, offset) => (
      /\d/.test(matchedText[offset]) && !/\d/.test(char)
    )).length
    candidates.push({
      value: `${minutes}:${String(seconds).padStart(2, '0')}`,
      score: score - repairedGlyphs * 20 + (minutes > 0 && minutes <= 39 ? 10 : 0),
      index
    })
  }

  // Look ahead to include overlapping candidates: "I: 10:54" must not consume
  // the real time while treating the label's I as the minute in "1:10".
  for (const match of normalized.matchAll(/(?=((?<!\d)(\d{1,2})\s*:\s*(\d{2})(?!\d)))/g)) {
    addCandidate(match[2], match[3], match.index, 120, match[1])
  }

  for (const match of normalized.matchAll(/(?<!\d)(\d{1,2})\s+(\d{2})(?!\d)/g)) {
    addCandidate(match[1], match[2], match.index, 90, match[0])
  }

  for (const match of normalized.matchAll(/(?<!\d)(\d{3,4})(?!\d)/g)) {
    if (normalized.slice(0, match.index).trimEnd().endsWith(':')
      || normalized.slice(match.index + match[0].length).trimStart().startsWith(':')) continue
    addCandidate(match[1].slice(0, -2), match[1].slice(-2), match.index, 70, match[0])
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.value || ''
}

const normalizeOcrNumberText = value => (
  String(value || '')
    .replace(/[oOqQdDcC]/g, '0')
    .replace(/i/g, '9')
    .replace(/[lI|!]/g, '1')
    .replace(/[zZ]/g, '2')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8')
    .replace(/[\uFF0C\u3001]/g, ',')
    .replace(/[\uFF0E\u3002]/g, '.')
)

const extractNumberTokens = value => (
  normalizeOcrNumberText(value).match(/\d{1,3}(?:[,.]\d{3})+|\d+/g) || []
)

const tokenToValue = token => onlyDigits(token)
const tokenLooksLikeLargeStat = token => /[,.]/.test(String(token)) || tokenToValue(token).length >= 4

const buildStatRow = values => ({
  elim: values[0] || '',
  ast: values[1] || '',
  dth: values[2] || '',
  dmg: values[3] || '',
  heal: values[4] || '',
  block: values[5] || ''
})

const scoreStatValues = values => {
  if (values.length !== 6) return -1000

  const nums = values.map(value => Number(value) || 0)
  let score = values.filter(Boolean).length * 20

  nums.slice(0, 3).forEach(value => {
    if (value <= 80) score += 10
    else if (value <= 99) score += 2
    else score -= 220
  })

  nums.slice(3).forEach((value, index) => {
    if (value <= 120000) score += 6
    else score -= 28
    if (index < 2 && value >= 1000) score += 6
  })

  if (nums[3] >= nums[0]) score += 6
  if (nums[4] >= nums[1]) score += 3

  return score
}

const buildGuardedStatValues = tokens => {
  const values = Array.from({ length: 6 }, () => '')
  let smallIndex = 0
  let largeIndex = 3
  let largeStatsStarted = false

  tokens.forEach(token => {
    const value = tokenToValue(token)
    if (!value) return

    const numeric = Number(value) || 0

    if (!largeStatsStarted && smallIndex < 3 && numeric <= 99 && !tokenLooksLikeLargeStat(token)) {
      values[smallIndex] = value
      smallIndex += 1
      return
    }

    largeStatsStarted = true
    while (smallIndex < 3) smallIndex += 1

    if (largeIndex < values.length) {
      values[largeIndex] = value
      largeIndex += 1
    }
  })

  return values
}

const splitLargeStatTokens = tokens => {
  if (tokens.length <= 3) return tokens.map(tokenToValue)

  const outputs = []
  const visit = (index, groups) => {
    if (groups.length === 3) {
      if (index === tokens.length) outputs.push(groups)
      return
    }

    const remainingGroups = 3 - groups.length
    const remainingTokens = tokens.length - index
    const maxTake = remainingTokens - remainingGroups + 1

    for (let take = 1; take <= maxTake; take += 1) {
      const slice = tokens.slice(index, index + take)
      const continuationLooksValid = slice.slice(1).every(token => tokenToValue(token).length === 3)
      if (take > 1 && !continuationLooksValid) continue
      visit(index + take, [...groups, slice.map(tokenToValue).join('')])
    }
  }

  visit(0, [])

  if (!outputs.length) return tokens.slice(0, 3).map(tokenToValue)

  return outputs
    .map(groups => ({
      groups,
      score: groups.reduce((total, value) => {
        const length = String(value || '').length
        return total + (length >= 4 ? 6 : 0) - (length > 6 ? 12 : 0)
      }, 0)
    }))
    .sort((a, b) => b.score - a.score)[0].groups
}

export const parseStatsLineDetailed = line => {
  const baseTokens = extractNumberTokens(line)
  const tokenCandidates = [baseTokens]

  if (baseTokens.length > 6) {
    tokenCandidates.push(baseTokens.slice(1))
    tokenCandidates.push(baseTokens.slice(-6))
  }

  const parsed = tokenCandidates
    .flatMap(tokens => {
      const firstThree = tokens.slice(0, 3).map(tokenToValue)
      const largeStats = splitLargeStatTokens(tokens.slice(3))
      const values = [...firstThree, ...largeStats].slice(0, 6)
      const guardedValues = buildGuardedStatValues(tokens)

      return [
        { values, score: scoreStatValues(values) },
        { values: guardedValues, score: scoreStatValues(guardedValues) + 18 }
      ]
    })
    .sort((a, b) => b.score - a.score)[0]

  const values = parsed?.values || []

  return {
    row: buildStatRow(values),
    values,
    tokens: baseTokens,
    score: parsed?.score ?? -1000
  }
}

export const parseStatsLine = line => parseStatsLineDetailed(line).row

const CONSENSUS_STAT_FIELDS = ['elim', 'ast', 'dth', 'dmg', 'heal', 'block']

const cleanStatValue = value => String(value ?? '').replace(/,/g, '').trim()

export const mergeStatsCandidateRows = (preferredRow = {}, candidateRows = []) => {
  const merged = { ...preferredRow }

  CONSENSUS_STAT_FIELDS.forEach(field => {
    const counts = new Map()
    candidateRows.forEach(row => {
      const value = cleanStatValue(row?.[field])
      if (!value) return
      counts.set(value, (counts.get(value) || 0) + 1)
    })

    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1])
    const [winner, winnerCount = 0] = ranked[0] || []
    const runnerUpCount = ranked[1]?.[1] || 0
    if (winner && winnerCount >= 2 && winnerCount > runnerUpCount) {
      merged[field] = winner
    }
  })

  return merged
}

export const analyzeStatsCandidateRows = (selectedRow = {}, candidateRows = [], candidateMetadata = []) => Object.fromEntries(
  CONSENSUS_STAT_FIELDS.map(field => {
    const selectedValue = cleanStatValue(selectedRow?.[field])
    const values = candidateRows
      .map(row => cleanStatValue(row?.[field]))
      .filter(Boolean)
    const counts = values.reduce((result, value) => {
      result.set(value, (result.get(value) || 0) + 1)
      return result
    }, new Map())
    const alternatives = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([value, count]) => ({ value, count }))
    const supportCount = counts.get(selectedValue) || 0
    const observedCount = values.length
    const runnerUpCount = alternatives.find(item => item.value !== selectedValue)?.count || 0
    const agreement = observedCount ? supportCount / observedCount : 0
    const familyForCandidate = candidate => Number(candidate?.candidateIndex) === 3
      ? 'softInvert'
      : 'binary'
    const observedFamilies = new Set(
      candidateMetadata
        .filter(candidate => cleanStatValue(candidate?.parsed?.row?.[field] ?? candidate?.row?.[field]))
        .map(familyForCandidate)
    )
    const supportingFamilies = new Set(
      candidateMetadata
        .filter(candidate => cleanStatValue(candidate?.parsed?.row?.[field] ?? candidate?.row?.[field]) === selectedValue)
        .map(familyForCandidate)
    )
    const selectedConfidence = Math.max(0, ...candidateMetadata
      .filter(candidate => cleanStatValue(candidate?.parsed?.row?.[field] ?? candidate?.row?.[field]) === selectedValue)
      .map(candidate => Number(candidate?.confidence) || 0))
    const competingConfidence = Math.max(0, ...candidateMetadata
      .filter(candidate => {
        const value = cleanStatValue(candidate?.parsed?.row?.[field] ?? candidate?.row?.[field])
        return value && value !== selectedValue
      })
      .map(candidate => Number(candidate?.confidence) || 0))
    const hasCredibleIndependentDissent = observedFamilies.size >= 2
      && supportingFamilies.size < 2
      && competingConfidence >= Math.max(0, selectedConfidence - 12)
    const hasIndependentPreprocessingAgreement = !hasCredibleIndependentDissent

    return [field, {
      selectedValue,
      candidateCount: candidateRows.length,
      observedCount,
      supportCount,
      runnerUpCount,
      agreement,
      independentObservedCount: observedFamilies.size,
      independentSupportCount: supportingFamilies.size,
      selectedConfidence,
      competingConfidence,
      hasCredibleIndependentDissent,
      alternatives,
      autoApply: Boolean(
        selectedValue
        && supportCount >= 2
        && supportCount > runnerUpCount
        && hasIndependentPreprocessingAgreement
      )
    }]
  })
)

export const parseStatsBlock = text => {
  const lines = String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => extractNumberTokens(line).length >= 3)

  return Array.from({ length: 5 }, (_, index) => parseStatsLine(lines[index] || ''))
}

export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export const buildCropAssets = (imageDataUrl, captureInput = DEFAULT_CAPTURE) => new Promise((resolve, reject) => {
  const img = new Image()

  img.onload = () => {
    try {
    const capture = normalizeCaptureConfig(captureInput)
    const getTeamHPct = side => Number(capture[side === 'top' ? 'topHPct' : 'bottomHPct'] ?? capture.hPct)
    const makeZone = (yPct, hPct) => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(hPct) / 100)
      const scale = getResolutionNormalizedScale(img, capture.scale)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      canvas.width = Math.max(1, Math.round(dataW * scale))
      canvas.height = Math.max(1, Math.round(sourceH * scale))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, sourceX, sourceY, dataW, sourceH, 0, 0, canvas.width, canvas.height)

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = image.data
      const threshold = Number(capture.threshold) || DEFAULT_CAPTURE.threshold

      for (let index = 0; index < data.length; index += 4) {
        const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
        const color = luma > threshold ? 0 : 255
        data[index] = color
        data[index + 1] = color
        data[index + 2] = color
        data[index + 3] = 255
      }

      ctx.putImageData(image, 0, 0)
      return canvas.toDataURL('image/png')
    }

    const makeSnips = (yPct, hPct) => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(hPct) / 100)
      const rowH = sourceH / 5

      return Array.from({ length: 5 }, (_, index) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = Math.max(1, Math.round(dataW))
        canvas.height = Math.max(1, Math.round(rowH))
        ctx.drawImage(img, sourceX, sourceY + index * rowH, dataW, rowH, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/png')
      })
    }

    // Preview each original numeric cell without stretching its glyphs.
    const makeCellSnips = (yPct, hPct) => {
      const sourceX = img.width * Number(capture.xPct) / 100
      const sourceY = img.height * Number(yPct) / 100
      const dataW = img.width * Number(capture.wPct) / 100 * STATS_DATA_WIDTH_RATIO
      const rowH = img.height * Number(hPct) / 100 / 5
      return Array.from({ length: 5 }, (_, index) => Object.fromEntries(CORE_STATS.map((stat, fieldIndex) => {
        const left = STATS_CELL_BOUNDARIES[fieldIndex]
        const width = dataW * (STATS_CELL_BOUNDARIES[fieldIndex + 1] - left)
        const height = rowH * 0.6
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = Math.max(1, Math.round(width))
        canvas.height = Math.max(1, Math.round(height))
        ctx.drawImage(img, sourceX + dataW * left, sourceY + rowH * (index + 0.2),
          width, height, 0, 0, canvas.width, canvas.height)
        return [stat.rowKey, canvas.toDataURL('image/png')]
      })))
    }

    const makePlayerSnips = (yPct, hPct, side) => {
      const sourceY = img.height * (Number(yPct) / 100)
      const playerXPct = side === 'bottom' ? capture.bottomPlayerXPct : capture.playerXPct
      const playerX = img.width * (Number(playerXPct) / 100)
      const playerW = img.width * ((Number(capture.playerWPct ?? DEFAULT_CAPTURE.playerWPct) || DEFAULT_CAPTURE.playerWPct) / 100)
      const sourceH = img.height * (Number(hPct) / 100)
      const rowH = sourceH / 5

      return Array.from({ length: 5 }, (_, index) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = Math.max(1, Math.round(playerW))
        canvas.height = Math.max(1, Math.round(rowH))
        ctx.drawImage(img, playerX, sourceY + index * rowH, playerW, rowH, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/png')
      })
    }

    const postProcessRowImage = (image, variant, threshold) => {
      const data = image.data

      if (variant === 'softInvert') {
        for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
          const luma = 0.2126 * data[pixelIndex] + 0.7152 * data[pixelIndex + 1] + 0.0722 * data[pixelIndex + 2]
          const color = Math.max(0, Math.min(255, 255 - luma))
          data[pixelIndex] = color
          data[pixelIndex + 1] = color
          data[pixelIndex + 2] = color
          data[pixelIndex + 3] = 255
        }
        return
      }

      const nextThreshold = variant === 'looseBinary' ? Math.max(90, threshold - 28) : threshold

      for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
        const luma = 0.2126 * data[pixelIndex] + 0.7152 * data[pixelIndex + 1] + 0.0722 * data[pixelIndex + 2]
        const color = luma > nextThreshold ? 0 : 255
        data[pixelIndex] = color
        data[pixelIndex + 1] = color
        data[pixelIndex + 2] = color
        data[pixelIndex + 3] = 255
      }

      if (variant !== 'thickBinary') return

      const width = image.width
      const height = image.height
      const snapshot = new Uint8ClampedArray(data)

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const offset = (y * width + x) * 4
          if (snapshot[offset] > 12) continue

          const neighbors = [
            offset - 4,
            offset + 4,
            offset - width * 4,
            offset + width * 4
          ]
          neighbors.forEach(nextOffset => {
            data[nextOffset] = 0
            data[nextOffset + 1] = 0
            data[nextOffset + 2] = 0
            data[nextOffset + 3] = 255
          })
        }
      }
    }

    const makeRowZones = (yPct, hPct, variant = 'binary') => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(hPct) / 100)
      const rowH = sourceH / 5
      const scale = getResolutionNormalizedScale(img, Number(capture.scale))
      const threshold = Number(capture.threshold)

      return Array.from({ length: 5 }, (_, index) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        canvas.width = Math.max(1, Math.round(dataW * scale))
        canvas.height = Math.max(1, Math.round(rowH * scale))
        ctx.imageSmoothingEnabled = variant === 'softInvert'
        ctx.drawImage(img, sourceX, sourceY + index * rowH, dataW, rowH, 0, 0, canvas.width, canvas.height)

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        postProcessRowImage(image, variant, threshold)

        ctx.putImageData(image, 0, 0)
        return canvas.toDataURL('image/png')
      })
    }

    const makeRowZoneVariants = (yPct, hPct) => {
      const variants = ['looseBinary', 'thickBinary', 'softInvert']
      const rowsByVariant = variants.map(variant => makeRowZones(yPct, hPct, variant))

      return Array.from({ length: 5 }, (_, rowIndex) => (
        rowsByVariant.map(rows => rows[rowIndex]).filter(Boolean)
      ))
    }

    const timeCrop = resolveTimeCrop(capture)
    const isOrangeTimePixel = (red, green, blue) => (
      red >= 145 && green >= 25 && green <= 190
      && red - green >= 35 && red - blue >= 70
    )
    const makeTimeZone = (variant = 'original') => {
      const sourceX = img.width * (timeCrop.timeXPct / 100)
      const sourceY = img.height * (timeCrop.timeYPct / 100)
      const sourceW = img.width * (timeCrop.timeWPct / 100)
      const sourceH = img.height * (timeCrop.timeHPct / 100)
      const scale = getResolutionNormalizedScale(img, 2.6)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      canvas.width = Math.max(1, Math.round(sourceW * scale))
      canvas.height = Math.max(1, Math.round(sourceH * scale))
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height)

      if (variant !== 'original') {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = image.data

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index]
          const green = data[index + 1]
          const blue = data[index + 2]
          const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
          const isOrange = isOrangeTimePixel(red, green, blue)
          const isInk = variant === 'orangeMask' ? isOrange : luma >= 150
          const color = isInk ? 0 : 255

          data[index] = color
          data[index + 1] = color
          data[index + 2] = color
          data[index + 3] = 255
        }

        ctx.putImageData(image, 0, 0)
      }

      return canvas.toDataURL('image/png')
    }

    const makeIsolatedOrangeTimeZone = () => {
      const sourceX = img.width * (timeCrop.timeXPct / 100)
      const sourceY = img.height * (timeCrop.timeYPct / 100)
      const sourceW = Math.max(1, Math.round(img.width * (timeCrop.timeWPct / 100)))
      const sourceH = Math.max(1, Math.round(img.height * (timeCrop.timeHPct / 100)))
      const sourceCanvas = document.createElement('canvas')
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
      sourceCanvas.width = sourceW
      sourceCanvas.height = sourceH
      sourceCtx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)

      const sourceImage = sourceCtx.getImageData(0, 0, sourceW, sourceH)
      const sourceData = sourceImage.data
      let minX = sourceW
      let minY = sourceH
      let maxX = -1
      let maxY = -1
      let orangePixels = 0

      for (let y = 0; y < sourceH; y += 1) {
        for (let x = 0; x < sourceW; x += 1) {
          const offset = (y * sourceW + x) * 4
          if (!isOrangeTimePixel(sourceData[offset], sourceData[offset + 1], sourceData[offset + 2])) continue
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          orangePixels += 1
        }
      }

      if (orangePixels < 40 || maxX - minX < 12 || maxY - minY < 8) return ''

      const paddingX = Math.max(4, Math.round(sourceW * 0.015))
      const paddingY = Math.max(3, Math.round(sourceH * 0.08))
      minX = Math.max(0, minX - paddingX)
      minY = Math.max(0, minY - paddingY)
      maxX = Math.min(sourceW - 1, maxX + paddingX)
      maxY = Math.min(sourceH - 1, maxY + paddingY)

      const tightW = maxX - minX + 1
      const tightH = maxY - minY + 1
      const scale = getResolutionNormalizedScale(img, 5)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      canvas.width = Math.max(1, Math.round(tightW * scale))
      canvas.height = Math.max(1, Math.round(tightH * scale))
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(sourceCanvas, minX, minY, tightW, tightH, 0, 0, canvas.width, canvas.height)

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = image.data
      for (let index = 0; index < data.length; index += 4) {
        const color = isOrangeTimePixel(data[index], data[index + 1], data[index + 2]) ? 0 : 255
        data[index] = color
        data[index + 1] = color
        data[index + 2] = color
        data[index + 3] = 255
      }
      ctx.putImageData(image, 0, 0)
      return canvas.toDataURL('image/png')
    }

    const isolatedTimeZone = makeIsolatedOrangeTimeZone()

    resolve({
      zones: [makeZone(capture.topPct, getTeamHPct('top')), makeZone(capture.bottomPct, getTeamHPct('bottom'))],
      timeZone: makeTimeZone(),
      isolatedTimeZone,
      timeZoneVariants: [isolatedTimeZone, makeTimeZone('orangeMask'), makeTimeZone('brightBinary')].filter(Boolean),
      timeCrop,
      snippets: {
        teamA: makeSnips(capture.topPct, getTeamHPct('top')),
        teamB: makeSnips(capture.bottomPct, getTeamHPct('bottom'))
      },
      cellSnippets: {
        teamA: makeCellSnips(capture.topPct, getTeamHPct('top')),
        teamB: makeCellSnips(capture.bottomPct, getTeamHPct('bottom'))
      },
      playerSnippets: {
        teamA: makePlayerSnips(capture.topPct, getTeamHPct('top'), 'top'),
        teamB: makePlayerSnips(capture.bottomPct, getTeamHPct('bottom'), 'bottom')
      },
      rowZoneVariants: {
        teamA: makeRowZoneVariants(capture.topPct, getTeamHPct('top')),
        teamB: makeRowZoneVariants(capture.bottomPct, getTeamHPct('bottom'))
      },
      rowZones: {
        teamA: makeRowZones(capture.topPct, getTeamHPct('top')),
        teamB: makeRowZones(capture.bottomPct, getTeamHPct('bottom'))
      }
    })
    } catch (error) { reject(error) }
  }

  img.onerror = reject
  img.src = imageDataUrl
})

export const getTeamTotals = rows => CORE_STATS.reduce((totals, stat) => ({
  ...totals,
  [stat.rowKey]: sumStatRows(rows, stat.rowKey)
}), {})

export const countFilledRows = rows => rows.filter(row => CORE_STATS.some(stat => row?.[stat.rowKey])).length
