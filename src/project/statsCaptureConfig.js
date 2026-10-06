// Observer scoreboard geometry shared with FryDeck and System.
const BASE_OBSERVER_CAPTURE = {
  xPct: 48,
  topPct: 17.5,
  bottomPct: 55,
  wPct: 25,
  hPct: 30.4,
  topHPct: 30.4,
  bottomHPct: 30.4,
  timeXPct: 88,
  timeYPct: 1.2,
  timeWPct: 12,
  timeHPct: 5,
  playerXPct: 32.5,
  bottomPlayerXPct: 32.5,
  playerWPct: 12,
  threshold: 165,
  scale: 3
}

const SINGLE_CAPTURE = { ...BASE_OBSERVER_CAPTURE }
const DOUBLE_CAPTURE = { ...BASE_OBSERVER_CAPTURE, xPct: 49, playerXPct: 31, bottomPlayerXPct: 31 }
const NO_PERKS_CAPTURE = { ...BASE_OBSERVER_CAPTURE, xPct: 46.5 }
const withSixteenTenVerticals = capture => ({
  ...capture,
  topPct: 20.7,
  topHPct: 27.5,
  bottomPct: 54.8,
  bottomHPct: 26.9
})

export const CAPTURE_LAYOUT_PRESETS = {
  spectatorSingleUltimate: SINGLE_CAPTURE,
  spectatorDoubleUltimate: DOUBLE_CAPTURE,
  spectatorNoUltimate: NO_PERKS_CAPTURE,
  spectatorSixteenTenSingleUltimate: withSixteenTenVerticals(SINGLE_CAPTURE),
  spectatorSixteenTenDoubleUltimate: withSixteenTenVerticals(DOUBLE_CAPTURE),
  spectatorSixteenTenNoUltimate: withSixteenTenVerticals(NO_PERKS_CAPTURE)
}

export const DEFAULT_CAPTURE_LAYOUT = 'spectatorDoubleUltimate'
export const DEFAULT_CAPTURE = {
  ...CAPTURE_LAYOUT_PRESETS[DEFAULT_CAPTURE_LAYOUT],
  captureLayout: DEFAULT_CAPTURE_LAYOUT
}

export const resolveCaptureLayout = layout => (
  Object.hasOwn(CAPTURE_LAYOUT_PRESETS, layout) ? layout : DEFAULT_CAPTURE_LAYOUT
)

export const getCaptureLayoutPreset = layout => ({
  ...CAPTURE_LAYOUT_PRESETS[resolveCaptureLayout(layout)]
})

export const getCaptureLayoutParts = layout => {
  const match = resolveCaptureLayout(layout).match(/^spectator(SixteenTen)?(SingleUltimate|DoubleUltimate|NoUltimate)$/)
  return {
    aspect: match[1] ? 'sixteenTen' : 'standard',
    mode: `${match[2].charAt(0).toLowerCase()}${match[2].slice(1)}`
  }
}

export const getCaptureLayoutForParts = (aspect, mode) => {
  const aspectKey = aspect === 'sixteenTen' ? 'SixteenTen' : ''
  const modeKey = {
    singleUltimate: 'SingleUltimate',
    doubleUltimate: 'DoubleUltimate',
    noUltimate: 'NoUltimate'
  }[mode] || 'DoubleUltimate'
  return resolveCaptureLayout(`spectator${aspectKey}${modeKey}`)
}

const LEGACY_CAPTURE_GEOMETRY = {
  xPct: 49,
  topPct: 18.5,
  bottomPct: 55.5,
  wPct: 26.2,
  hPct: 28.5,
  playerXPct: 33.5,
  playerWPct: 9
}

export const normalizeCaptureConfig = capture => {
  const source = capture || {}
  const captureLayout = resolveCaptureLayout(source.captureLayout)
  const legacyKeys = Object.keys(LEGACY_CAPTURE_GEOMETRY)
  const isLegacyDefault = legacyKeys.every(key => Number(source[key]) === LEGACY_CAPTURE_GEOMETRY[key])
  const normalizedSource = isLegacyDefault
    ? Object.fromEntries(Object.entries(source).filter(([key]) => !legacyKeys.includes(key)))
    : source
  const merged = { ...getCaptureLayoutPreset(captureLayout), ...normalizedSource, captureLayout }

  // Older custom calibrations used one height and one player axis for both teams.
  if (normalizedSource.hPct !== undefined && normalizedSource.topHPct === undefined) {
    merged.topHPct = normalizedSource.hPct
  }
  if (normalizedSource.hPct !== undefined && normalizedSource.bottomHPct === undefined) {
    merged.bottomHPct = normalizedSource.hPct
  }
  if (normalizedSource.playerXPct !== undefined && normalizedSource.bottomPlayerXPct === undefined) {
    merged.bottomPlayerXPct = normalizedSource.playerXPct
  }

  return merged
}
