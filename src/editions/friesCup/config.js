const SEASON_PRESETS = {
  FCA26: {
    label: 'FCA26 - Academy',
    name: 'Fries Cup Academy 2026',
    staticFallbackUrl: '/api/stats-data/friescup_db_review_ready.json'
  },
  FCR26: {
    label: 'FCR26 - Regular',
    name: 'Fries Cup Regular 2026',
    staticFallbackUrl: ''
  }
}

const env = import.meta.env || {}
const defaultSeasonId = env.VITE_FCUP_SYSTEM_SEASON_ID || 'FCA26'
const preset = SEASON_PRESETS[String(defaultSeasonId).toUpperCase()] || SEASON_PRESETS.FCA26

export const FRIES_CUP_CONFIG = {
  editionId: 'fries-cup',
  brandName: 'FRIES CUP',
  editionName: 'FriesCup Edition',
  consoleTitle: 'FRIES CUP CONSOLE',
  defaultLocale: 'zh',
  primaryColor: '#F4C320',
  defaultLogo: '/brand/fries-cup/fc_logo.png',
  projectExportPrefix: 'fries-cup-project',

  teamDirectory: {
    enabled: true,
    sourceType: 'fc-system-published',
    seasonId: defaultSeasonId,
    version: env.VITE_FCUP_SYSTEM_VERSION || 'latest',
    remoteBaseUrl: env.VITE_FCUP_SYSTEM_API_BASE_URL || '/api/admin-public',
    staticFallbackUrl: env.VITE_FCUP_SYSTEM_STATIC_FALLBACK_URL ?? preset.staticFallbackUrl,
    cacheKey: 'fries-cup-team-directory-cache',
    timeoutMs: Number(env.VITE_FCUP_SYSTEM_TIMEOUT_MS) || 12000,
    seasonPresets: SEASON_PRESETS
  },

  dataCenterUrl: env.VITE_FCUP_DATA_CENTER_URL || '',
  teamBdUrl: env.VITE_FCUP_TEAM_BD_URL || ''
}

export const getFriesCupTeamDirectoryConfig = (overrides = {}) => ({
  ...FRIES_CUP_CONFIG.teamDirectory,
  ...(overrides || {})
})

