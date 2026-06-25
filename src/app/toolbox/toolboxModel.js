import { OW_MAP_BY_ID } from '../../data/overwatch'
import { FRIES_CUP_CONFIG } from '../../editions/friesCup/config'
import { getCompetitionName, getEventLogo, getEventLogoSource } from '../../project/branding'
import { getCurrentTeams, getTeamById } from '../../project/projectUtils'
import { BASE_SCENE_HEIGHT, BASE_SCENE_WIDTH } from './toolboxConfig'

export const clean = value => String(value || '').trim()
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export const expandHexColor = color => {
  const value = clean(color)
  if (!/^#[0-9a-f]{3}$/i.test(value)) return value

  return `#${value.slice(1).split('').map(char => `${char}${char}`).join('')}`
}

export const normalizeHexColor = (value, fallback = '') => {
  const color = expandHexColor(value)
  if (HEX_COLOR_PATTERN.test(color)) return color

  const fallbackColor = expandHexColor(fallback)
  return HEX_COLOR_PATTERN.test(fallbackColor) ? fallbackColor : ''
}

export const getCssColorVar = (name, value) => {
  const color = normalizeHexColor(value)
  return color ? { [name]: color } : {}
}

export const getEventLogoSourceLabel = source => {
  if (source === 'event') return 'Event Logo'
  if (source === 'organizer') return 'Organizer Logo'

  return 'Fallback FC'
}

export const getTeamLabel = team => clean(team?.name || team?.shortName) || 'TBD'

export const getTeamShort = team => {
  const shortName = clean(team?.shortName)
  if (shortName) return shortName.toUpperCase()

  return clean(team?.name).slice(0, 6).toUpperCase() || 'TBD'
}

export const toTeamSnapshot = team => ({
  id: clean(team?.id),
  name: getTeamLabel(team),
  shortName: getTeamShort(team),
  logo: clean(team?.logo),
  primaryColor: clean(team?.primaryColor)
})

export const getTeamSnapshotById = (project, teamId, fallback) => {
  const team = getTeamById(project, clean(teamId))
  return team ? toTeamSnapshot(team) : fallback
}

export const toScoreNumber = value => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export const toPercentNumber = value => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : null
}

export const clampPercent = (value, fallback = 100, min = 65, max = 125) => {
  const numeric = toPercentNumber(value)
  if (!Number.isFinite(numeric)) return fallback

  return Math.min(max, Math.max(min, numeric))
}

export const getShortAutoScale = value => {
  const length = clean(value).length
  if (length <= 3) return 1
  if (length === 4) return 0.9
  if (length === 5) return 0.8
  if (length === 6) return 0.72
  return 0.64
}

export const scaleClamp = (scale, min, preferred, max) => (
  `clamp(${Math.round(min * scale)}px, ${(preferred * scale).toFixed(3)}cqw, ${Math.round(max * scale)}px)`
)

export const getManualPercentScale = value => {
  const manualScale = toPercentNumber(value)
  return manualScale ? clampPercent(manualScale) / 100 : 1
}

export const getCoverTextScaleStyle = ({ subtitleScale, titleScale }) => {
  const title = getManualPercentScale(titleScale)
  const subtitle = getManualPercentScale(subtitleScale)

  return {
    '--toolbox-cover-title-font': scaleClamp(title, 58, 8.5, 150),
    '--toolbox-cover-title-clean-font': scaleClamp(title, 86, 10.8, 210),
    '--toolbox-cover-title-clean-no-label-font': scaleClamp(title, 112, 13.2, 252),
    '--toolbox-cover-subtitle-font': scaleClamp(subtitle, 13, 1.55, 24),
    '--toolbox-cover-subtitle-clean-font': scaleClamp(subtitle, 15, 1.7, 30),
    '--toolbox-cover-subtitle-clean-no-label-font': scaleClamp(subtitle, 18, 2.05, 38)
  }
}

export const getTeamShortScaleStyle = (team, teamShortScale) => {
  const manualScale = toPercentNumber(teamShortScale)
  const scale = manualScale ? clampPercent(manualScale) / 100 : getShortAutoScale(getTeamShort(team))

  return {
    '--toolbox-matchup-team-backdrop-font': scaleClamp(scale, 172, 23, 410),
    '--toolbox-matchup-team-ghost-font': scaleClamp(scale, 112, 14.5, 238),
    '--toolbox-matchup-team-short-font': scaleClamp(scale, 72, 10.8, 190),
    '--toolbox-cover-team-ghost-font': scaleClamp(scale, 78, 8.6, 150),
    '--toolbox-cover-team-short-font': scaleClamp(scale, 26, 3.4, 56)
  }
}

export const getGraphicSettings = (project, toolId) => (
  project?.tools?.graphics?.[toolId] || {}
)

export const createAssetId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const createSponsorLogo = () => ({
  id: createAssetId('sponsor'),
  name: '',
  logo: '',
  enabled: true
})

export const normalizeSponsorLogos = logos => {
  const source = Array.isArray(logos) ? logos : []
  const isLegacyEmptyDefault = source.length === 3 && source.every((slot, index) => (
    slot?.id === `sponsor-${index + 1}` &&
    !clean(slot.name) &&
    !clean(slot.logo) &&
    slot.enabled !== false
  ))

  if (isLegacyEmptyDefault) return []

  return source.map((slot, index) => ({
    id: clean(slot?.id) || `sponsor-${index + 1}`,
    name: clean(slot?.name),
    logo: clean(slot?.logo),
    enabled: slot?.enabled !== false
  }))
}

export const getAssetSettings = project => ({
  sponsors: {
    tickerText: clean(project?.assets?.sponsors?.tickerText),
    videoAdUrl: clean(project?.assets?.sponsors?.videoAdUrl),
    videoAdName: clean(project?.assets?.sponsors?.videoAdName),
    videoAdType: clean(project?.assets?.sponsors?.videoAdType),
    logos: normalizeSponsorLogos(project?.assets?.sponsors?.logos)
  }
})

export const ensureGraphicSettings = (draft, toolId) => {
  if (!draft.tools) draft.tools = {}
  if (!draft.tools.graphics) draft.tools.graphics = {}
  if (!draft.tools.graphics[toolId]) draft.tools.graphics[toolId] = {}
  return draft.tools.graphics[toolId]
}

export const ensureAssetSettings = draft => {
  if (!draft.assets) draft.assets = {}
  if (!draft.assets.sponsors) draft.assets.sponsors = {}
  if (!Array.isArray(draft.assets.sponsors.logos)) {
    draft.assets.sponsors.logos = []
  }

  return draft.assets
}

export const buildBaseContext = ({ language, programScene, project }) => {
  const { teamA, teamB } = getCurrentTeams(project)
  const map = OW_MAP_BY_ID[project.currentMatch?.currentMapId]

  return {
    eventName: getCompetitionName(project, language),
    eventLogo: getEventLogo(project),
    eventLogoSource: getEventLogoSource(project),
    eventSubtitle: clean(project.event?.subtitle) || FRIES_CUP_CONFIG.editionName.toUpperCase(),
    themeColor: clean(project.theme?.primary) || FRIES_CUP_CONFIG.primaryColor,
    teamA: toTeamSnapshot(teamA),
    teamB: toTeamSnapshot(teamB),
    score: project.currentMatch?.score || { teamA: 0, teamB: 0 },
    ft: `FT${project.currentMatch?.ft || 3}`,
    stage: clean(project.currentMatch?.stage) || 'MATCHDAY',
    currentMap: map?.en || project.currentMatch?.currentMapId || 'TBD',
    mapMode: map?.modeKey || 'MAP',
    programScene: programScene?.enName || 'Program'
  }
}

export const buildSnapshot = context => ({
  eventName: context.eventName,
  eventLogo: context.eventLogo,
  eventLogoSource: context.eventLogoSource,
  eventSubtitle: context.eventSubtitle,
  teamA: context.teamA,
  teamB: context.teamB,
  score: {
    teamA: toScoreNumber(context.score?.teamA),
    teamB: toScoreNumber(context.score?.teamB)
  },
  ft: context.ft,
  stage: context.stage,
  currentMap: context.currentMap,
  mapMode: context.mapMode,
  programScene: context.programScene
})

export const resolveToolContext = ({ activeModeId, baseContext, project, settings }) => {
  const useSnapshot = settings.useCurrentMatchData === false && settings.snapshot
  const source = useSnapshot
    ? settings.snapshot
    : baseContext
  const context = {
    ...baseContext,
    ...source,
    teamA: source.teamA || baseContext.teamA,
    teamB: source.teamB || baseContext.teamB,
    score: source.score || baseContext.score
  }

  if (activeModeId === 'cover') {
    return {
      ...context,
      eyebrow: clean(settings.eyebrow),
      title: clean(settings.title) || context.eventName,
      subtitle: clean(settings.subtitle) || context.eventSubtitle,
      stage: clean(settings.stage) || context.stage,
      ft: clean(settings.ft) || context.ft,
      time: clean(settings.time),
      showTeams: settings.showTeams === true,
      showDetails: settings.showDetails === true,
      showTime: settings.showTime !== false,
      titleScale: clean(settings.titleScale),
      subtitleScale: clean(settings.subtitleScale),
      teamShortScale: clean(settings.teamShortScale),
      eventLogoBg: clean(settings.eventLogoBg),
      teamLogoBg: clean(settings.teamLogoBg)
    }
  }

  if (activeModeId === 'matchup') {
    const teamA = useSnapshot
      ? context.teamA
      : getTeamSnapshotById(project, settings.teamAId, context.teamA)
    const teamB = useSnapshot
      ? context.teamB
      : getTeamSnapshotById(project, settings.teamBId, context.teamB)

    return {
      ...context,
      teamA,
      teamB,
      title: clean(settings.title) || 'UP NEXT',
      ft: clean(settings.ft) || context.ft,
      stage: clean(settings.stage) || context.stage,
      time: clean(settings.time),
      showFt: settings.showFt !== false,
      showMap: settings.showMap !== false,
      teamShortScale: clean(settings.teamShortScale),
      teamLogoBg: clean(settings.teamLogoBg)
    }
  }

  if (activeModeId === 'result') {
    const teamA = useSnapshot
      ? context.teamA
      : getTeamSnapshotById(project, settings.teamAId, context.teamA)
    const teamB = useSnapshot
      ? context.teamB
      : getTeamSnapshotById(project, settings.teamBId, context.teamB)
    const score = {
      teamA: clean(settings.scoreTeamA) === '' ? toScoreNumber(context.score?.teamA) : toScoreNumber(settings.scoreTeamA),
      teamB: clean(settings.scoreTeamB) === '' ? toScoreNumber(context.score?.teamB) : toScoreNumber(settings.scoreTeamB)
    }

    return {
      ...context,
      teamA,
      teamB,
      title: clean(settings.title) || 'MATCH RESULT',
      ft: clean(settings.ft) || context.ft,
      stage: clean(settings.stage) || context.stage,
      score,
      winner: clean(settings.winner),
      mvp: clean(settings.mvp),
      note: clean(settings.note),
      teamShortScale: clean(settings.teamShortScale),
      teamLogoBg: clean(settings.teamLogoBg)
    }
  }

  return context
}

export const slugify = value => (
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'owbt'
)

export const clampDimension = value => {
  const numeric = Number(value) || 0
  return Math.max(320, Math.min(7680, Math.round(numeric)))
}

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const formatExportTime = date => date.toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

export const getGreatestCommonDivisor = (left, right) => {
  let a = Math.abs(Number(left) || 0)
  let b = Math.abs(Number(right) || 0)

  while (b) {
    const next = b
    b = a % b
    a = next
  }

  return a || 1
}

export const formatAspectRatio = ({ width, height }) => {
  const divisor = getGreatestCommonDivisor(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

export const hasBaseSceneAspectRatio = exportSize => (
  Boolean(exportSize?.width && exportSize?.height)
  && Math.abs((exportSize.width * BASE_SCENE_HEIGHT) - (exportSize.height * BASE_SCENE_WIDTH)) < 1
)

export const getStaticExportLayoutSize = exportSize => {
  if (hasBaseSceneAspectRatio(exportSize)) {
    return {
      width: BASE_SCENE_WIDTH,
      height: BASE_SCENE_HEIGHT
    }
  }

  return {
    width: exportSize?.width || BASE_SCENE_WIDTH,
    height: exportSize?.height || BASE_SCENE_HEIGHT
  }
}

export const getPreviewAspectStyle = exportSize => (
  exportSize?.width && exportSize?.height
    ? { aspectRatio: `${exportSize.width} / ${exportSize.height}` }
    : undefined
)

export const getPreviewFrameStyle = (exportSize, exportRender = false) => {
  const aspectStyle = getPreviewAspectStyle(exportSize)

  if (!exportRender || !exportSize?.width || !exportSize?.height) return aspectStyle

  return {
    ...aspectStyle,
    width: `${exportSize.width}px`,
    height: `${exportSize.height}px`,
    minHeight: '0',
    maxWidth: 'none'
  }
}

export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export const isVideoSource = (source, sourceType = '') => (
  sourceType.startsWith('video/') || /\.(mp4|webm|ogg)(\?.*)?$/i.test(clean(source))
)
