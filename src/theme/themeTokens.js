import { DEFAULT_THEME } from './defaultTheme'
import { alpha, darken, lighten, normalizeHex } from './colorUtils'

const LEGACY_DEFAULT_FONT =
  'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const createThemeTokens = themeInput => {
  const theme = {
    ...DEFAULT_THEME,
    ...(themeInput || {})
  }

  if (!theme.fontFamily || theme.fontFamily === LEGACY_DEFAULT_FONT) {
    theme.fontFamily = DEFAULT_THEME.fontFamily
  }

  const primary = normalizeHex(theme.primary)

  return {
    ...theme,

    primary,
    primaryLight: lighten(primary, 0.22),
    primarySoft: alpha(primary, 0.14),
    primarySofter: alpha(primary, 0.08),
    primaryStrong: darken(primary, 0.18),
    primaryDark: darken(primary, 0.36),
    primaryGlow: alpha(primary, theme.glowStrength ?? 0.38),
    primaryBorder: alpha(primary, 0.45),

    shadowPrimary: `0 0 32px ${alpha(primary, 0.25)}`,
    shadowPrimaryStrong: `0 0 54px ${alpha(primary, 0.42)}`,

    backgroundGradient: `
      radial-gradient(circle at 16% 12%, ${alpha(primary, 0.22)}, transparent 32%),
      radial-gradient(circle at 82% 18%, ${alpha(primary, 0.14)}, transparent 28%),
      linear-gradient(135deg, ${theme.background}, #0A0A0A 52%, #020202)
    `,

    panelGradient: `linear-gradient(135deg, ${alpha(primary, 0.08)}, rgba(255,255,255,0.035))`,

    blueSideSoft: alpha(theme.blueSide, 0.16),
    redSideSoft: alpha(theme.redSide, 0.16),
    dangerSoft: alpha(theme.danger, 0.16)
  }
}

export const applyThemeTokens = themeInput => {
  const tokens = createThemeTokens(themeInput)
  const root = document.documentElement

  Object.entries(tokens).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
    root.style.setProperty(`--theme-${cssKey}`, String(value))
  })

  return tokens
}
