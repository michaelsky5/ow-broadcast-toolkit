import { CORE_STATS, formatDataMinutes, sumStatRows } from '../../../project/statsModel'

export const DEFAULT_CAPTURE = {
  xPct: 49,
  topPct: 18.5,
  bottomPct: 55.5,
  wPct: 26.2,
  hPct: 28.5,
  timeXPct: 88,
  timeYPct: 2.5,
  timeWPct: 12,
  timeHPct: 15,
  playerXPct: 33.5,
  playerWPct: 9,
  threshold: 165,
  scale: 3
}

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

const STATS_DATA_WIDTH_RATIO = 0.92

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

export const parseStatsCell = (text, statIndex) => {
  const tokens = normalizeOcrNumberText(text).match(/\d+/g) || []
  const value = onlyDigits(tokens.join(''))
  if (!value) return ''
  if (statIndex < 3 && Number(value) > 99) return ''
  return value
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

export const parseStatsLine = line => {
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
        {
          values,
          score: scoreStatValues(values)
        },
        {
          values: guardedValues,
          score: scoreStatValues(guardedValues) + 18
        }
      ]
    })
    .sort((a, b) => b.score - a.score)[0]

  return buildStatRow(parsed?.values || [])
}

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

export const buildCropAssets = (imageDataUrl, capture) => new Promise((resolve, reject) => {
  const img = new Image()

  img.onload = () => {
    const makeZone = yPct => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(capture.hPct) / 100)
      const scale = Math.max(1, Number(capture.scale) || DEFAULT_CAPTURE.scale)
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

    const makeSnips = yPct => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(capture.hPct) / 100)
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

    const makePlayerSnips = yPct => {
      const sourceY = img.height * (Number(yPct) / 100)
      const playerX = img.width * ((Number(capture.playerXPct ?? DEFAULT_CAPTURE.playerXPct) || DEFAULT_CAPTURE.playerXPct) / 100)
      const playerW = img.width * ((Number(capture.playerWPct ?? DEFAULT_CAPTURE.playerWPct) || DEFAULT_CAPTURE.playerWPct) / 100)
      const sourceH = img.height * (Number(capture.hPct) / 100)
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

    const makeRowZones = yPct => {
      const sourceX = img.width * (Number(capture.xPct) / 100)
      const sourceY = img.height * (Number(yPct) / 100)
      const sourceW = img.width * (Number(capture.wPct) / 100)
      const dataW = sourceW * STATS_DATA_WIDTH_RATIO
      const sourceH = img.height * (Number(capture.hPct) / 100)
      const rowH = sourceH / 5
      const scale = Math.max(1, Number(capture.scale) || DEFAULT_CAPTURE.scale)
      const threshold = Number(capture.threshold) || DEFAULT_CAPTURE.threshold

      return Array.from({ length: 5 }, (_, index) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        canvas.width = Math.max(1, Math.round(dataW * scale))
        canvas.height = Math.max(1, Math.round(rowH * scale))
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, sourceX, sourceY + index * rowH, dataW, rowH, 0, 0, canvas.width, canvas.height)

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = image.data

        for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
          const luma = 0.2126 * data[pixelIndex] + 0.7152 * data[pixelIndex + 1] + 0.0722 * data[pixelIndex + 2]
          const color = luma > threshold ? 0 : 255
          data[pixelIndex] = color
          data[pixelIndex + 1] = color
          data[pixelIndex + 2] = color
          data[pixelIndex + 3] = 255
        }

        ctx.putImageData(image, 0, 0)
        return canvas.toDataURL('image/png')
      })
    }

    const timeCrop = resolveTimeCrop(capture)
    const makeTimeZone = () => {
      const sourceX = img.width * (timeCrop.timeXPct / 100)
      const sourceY = img.height * (timeCrop.timeYPct / 100)
      const sourceW = img.width * (timeCrop.timeWPct / 100)
      const sourceH = img.height * (timeCrop.timeHPct / 100)
      const scale = 2.6
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = Math.max(1, Math.round(sourceW * scale))
      canvas.height = Math.max(1, Math.round(sourceH * scale))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png')
    }

    resolve({
      zones: [makeZone(capture.topPct), makeZone(capture.bottomPct)],
      timeZone: makeTimeZone(),
      timeCrop,
      snippets: {
        teamA: makeSnips(capture.topPct),
        teamB: makeSnips(capture.bottomPct)
      },
      playerSnippets: {
        teamA: makePlayerSnips(capture.topPct),
        teamB: makePlayerSnips(capture.bottomPct)
      },
      rowZones: {
        teamA: makeRowZones(capture.topPct),
        teamB: makeRowZones(capture.bottomPct)
      }
    })
  }

  img.onerror = reject
  img.src = imageDataUrl
})

export const getTeamTotals = rows => CORE_STATS.reduce((totals, stat) => ({
  ...totals,
  [stat.rowKey]: sumStatRows(rows, stat.rowKey)
}), {})

export const countFilledRows = rows => rows.filter(row => CORE_STATS.some(stat => row?.[stat.rowKey])).length
