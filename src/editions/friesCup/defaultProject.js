import { FRIES_CUP_CONFIG } from './config'
import { createFriesCupTheme } from './theme'

export const createDefaultFriesCupTeamDirectory = () => ({
  status: 'IDLE',
  source: FRIES_CUP_CONFIG.teamDirectory.sourceType,
  sourceUrl: '',
  seasonId: FRIES_CUP_CONFIG.teamDirectory.seasonId,
  version: FRIES_CUP_CONFIG.teamDirectory.version,
  remoteBaseUrl: FRIES_CUP_CONFIG.teamDirectory.remoteBaseUrl,
  staticFallbackUrl: FRIES_CUP_CONFIG.teamDirectory.staticFallbackUrl,
  schemaVersion: '',
  contractVersion: '',
  checksum: '',
  fetchedAt: '',
  updatedAt: '',
  error: '',
  teams: [],
  rawMeta: null,
  counts: {
    teams: 0,
    players: 0,
    matches: 0,
    playerTotals: 0,
    teamReviews: 0
  },
  sourceTeamMapping: [],
  sourcePlayerMapping: [],
  syncReport: null,
  unknownExtras: {}
})

export const createDefaultFriesCupEditionData = () => ({
  editionId: FRIES_CUP_CONFIG.editionId,
  brandName: FRIES_CUP_CONFIG.brandName,
  editionName: FRIES_CUP_CONFIG.editionName,
  projectExportPrefix: FRIES_CUP_CONFIG.projectExportPrefix,
  teamDirectory: createDefaultFriesCupTeamDirectory(),
  appliedTeams: {},
  legacyExtras: {}
})

export const applyFriesCupProjectDefaults = project => {
  const next = project || {}
  const existingFriesCup = next.editionData?.friesCup || {}
  const existingTeamDirectory = existingFriesCup.teamDirectory || {}

  next.editionId = FRIES_CUP_CONFIG.editionId
  next.meta = {
    ...(next.meta || {}),
    name: next.meta?.name || 'FriesCup Project'
  }
  next.event = {
    ...(next.event || {}),
    name: next.event?.name || FRIES_CUP_CONFIG.brandName,
    nameZh: next.event?.nameZh || FRIES_CUP_CONFIG.brandName,
    nameEn: next.event?.nameEn || FRIES_CUP_CONFIG.brandName,
    subtitle: next.event?.subtitle || FRIES_CUP_CONFIG.editionName,
    logo: next.event?.logo || FRIES_CUP_CONFIG.defaultLogo,
    language: next.event?.language || FRIES_CUP_CONFIG.defaultLocale
  }
  next.theme = createFriesCupTheme()
  next.editionData = {
    ...(next.editionData || {}),
    friesCup: {
      ...createDefaultFriesCupEditionData(),
      ...existingFriesCup,
      projectExportPrefix: FRIES_CUP_CONFIG.projectExportPrefix,
      teamDirectory: {
        ...createDefaultFriesCupTeamDirectory(),
        ...existingTeamDirectory,
        seasonId: existingTeamDirectory.seasonId || FRIES_CUP_CONFIG.teamDirectory.seasonId,
        version: existingTeamDirectory.version || FRIES_CUP_CONFIG.teamDirectory.version,
        remoteBaseUrl: existingTeamDirectory.remoteBaseUrl || FRIES_CUP_CONFIG.teamDirectory.remoteBaseUrl,
        staticFallbackUrl: existingTeamDirectory.staticFallbackUrl ?? FRIES_CUP_CONFIG.teamDirectory.staticFallbackUrl
      }
    }
  }

  if (next.scenes?.settings?.opening) {
    next.scenes.settings.opening.competitionNameEn ||= FRIES_CUP_CONFIG.brandName
    next.scenes.settings.opening.competitionNameZh ||= FRIES_CUP_CONFIG.brandName
    next.scenes.settings.opening.subtitle ||= FRIES_CUP_CONFIG.editionName.toUpperCase()
  }

  return next
}
