import { createDefaultProject, PROJECT_SCHEMA_VERSION } from './defaultProject'
import { DEFAULT_COMPETITION_NAME_EN, DEFAULT_COMPETITION_NAME_ZH } from './branding'

export const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const LEGACY_SCENE_FALLBACKS = {
  opening: 'countdown'
}

const normalizeSceneId = sceneId => LEGACY_SCENE_FALLBACKS[sceneId] || sceneId
const clean = value => String(value || '').trim()

const isLegacyDefaultBrand = project => (
  clean(project?.meta?.name) === 'Fries Cup Project' &&
  clean(project?.event?.name) === 'Fries Cup' &&
  clean(project?.event?.nameEn) === 'Fries Cup' &&
  clean(project?.event?.nameZh) === 'Fries Cup'
)

const normalizeLegacyDefaultBrand = project => {
  if (!isLegacyDefaultBrand(project)) return project

  return {
    ...project,
    meta: {
      ...(project.meta || {}),
      name: 'OWBT Project'
    },
    event: {
      ...(project.event || {}),
      name: DEFAULT_COMPETITION_NAME_EN,
      nameEn: DEFAULT_COMPETITION_NAME_EN,
      nameZh: DEFAULT_COMPETITION_NAME_ZH
    },
    scenes: {
      ...(project.scenes || {}),
      settings: {
        ...(project.scenes?.settings || {}),
        opening: {
          ...(project.scenes?.settings?.opening || {}),
          competitionNameEn: '',
          competitionNameZh: ''
        }
      }
    }
  }
}

const normalizeSceneIdList = sceneIds => {
  const seen = new Set()

  return (Array.isArray(sceneIds) ? sceneIds : [])
    .map(normalizeSceneId)
    .filter(sceneId => {
      if (!sceneId || seen.has(sceneId)) return false
      seen.add(sceneId)
      return true
    })
}

export const deepMerge = (base, override) => {
  if (Array.isArray(base) || Array.isArray(override)) return override !== undefined ? override : base
  if (!isPlainObject(base) || !isPlainObject(override)) return override !== undefined ? override : base

  const output = { ...base }
  Object.keys(override).forEach(key => {
    output[key] = deepMerge(base[key], override[key])
  })
  return output
}

export const touchProject = project => ({
  ...project,
  meta: {
    ...(project?.meta || {}),
    updatedAt: new Date().toISOString()
  }
})

export const normalizeProject = rawProject => {
  const fallback = createDefaultProject()
  const source = isPlainObject(rawProject) ? rawProject : {}
  const merged = normalizeLegacyDefaultBrand(deepMerge(fallback, source))

  return {
    ...merged,
    schemaVersion: merged.schemaVersion || PROJECT_SCHEMA_VERSION,
    meta: {
      ...fallback.meta,
      ...(merged.meta || {}),
      updatedAt: new Date().toISOString()
    },
    scenes: {
      ...merged.scenes,
      activeSceneId: normalizeSceneId(merged.scenes?.activeSceneId || fallback.scenes.activeSceneId),
      enabledSceneIds: normalizeSceneIdList(merged.scenes?.enabledSceneIds),
      order: normalizeSceneIdList(merged.scenes?.order)
    }
  }
}

export const safeParseProject = jsonText => {
  try {
    return normalizeProject(JSON.parse(jsonText))
  } catch (error) {
    console.error('[OWBT] Failed to parse project JSON:', error)
    return null
  }
}

export const createProjectFileName = project => {
  const name = String(project?.meta?.name || project?.event?.name || 'owbt-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  const date = new Date().toISOString().slice(0, 10)
  return `${name || 'owbt-project'}-${date}.json`
}

export const stringifyProject = project => JSON.stringify(touchProject(project), null, 2)

export const downloadTextFile = (filename, text, mime = 'application/json') => {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const exportProjectAsJson = project => {
  const finalProject = touchProject(project)
  downloadTextFile(createProjectFileName(finalProject), JSON.stringify(finalProject, null, 2))
}

export const readProjectFile = file => new Promise((resolve, reject) => {
  if (!file) {
    reject(new Error('No project file selected.'))
    return
  }

  const reader = new FileReader()

  reader.onload = event => {
    const project = safeParseProject(event.target?.result || '')
    if (!project) reject(new Error('Invalid OWBT project file.'))
    else resolve(project)
  }

  reader.onerror = () => reject(new Error('Failed to read project file.'))
  reader.readAsText(file)
})

export const getTeamById = (project, teamId) => project?.teams?.find(team => team.id === teamId) || null
export const getPlayerById = (project, playerId) => project?.players?.find(player => player.id === playerId) || null
export const getCasterById = (project, casterId) => project?.casters?.find(caster => caster.id === casterId) || null

export const getCurrentTeams = project => {
  const match = project?.currentMatch || {}
  return {
    teamA: getTeamById(project, match.teamAId),
    teamB: getTeamById(project, match.teamBId)
  }
}

export const getTeamPlayers = (project, teamId) => {
  const team = getTeamById(project, teamId)
  const ids = team?.playerIds || []
  const orderedPlayers = ids.map(id => getPlayerById(project, id)).filter(Boolean)

  if (orderedPlayers.length || ids.length) return orderedPlayers

  return (project?.players || []).filter(player => player.teamId === teamId)
}

const normalizeRosterRole = role => {
  const value = String(role || '').trim().toLowerCase()
  if (['damage', 'dps', 'attack'].includes(value)) return 'damage'
  if (['tank', 'main tank', 'off tank'].includes(value)) return 'tank'
  if (['support', 'sup', 'healer'].includes(value)) return 'support'
  return value || 'damage'
}

const LIVE_HUD_ROLE_ORDER = ['damage', 'damage', 'tank', 'support', 'support']

const orderPlayersForLiveHud = players => {
  const usedIds = new Set()

  const ordered = LIVE_HUD_ROLE_ORDER
    .map(role => {
      const player = players.find(item => !usedIds.has(item.id) && normalizeRosterRole(item.role) === role)
      if (player) usedIds.add(player.id)
      return player
    })
    .filter(Boolean)

  players.forEach(player => {
    if (!usedIds.has(player.id)) {
      ordered.push(player)
      usedIds.add(player.id)
    }
  })

  return ordered
}

export const getRosterOrderedPlayers = (project, side = 'teamA') => {
  const teamId = project?.currentMatch?.[`${side}Id`]
  return orderPlayersForLiveHud(getTeamPlayers(project, teamId))
}

export const getStartingPlayers = (project, side = 'teamA') => {
  const rosterPlayers = getRosterOrderedPlayers(project, side)
  const slotIds = Array.from({ length: 5 }, (_, index) => project?.currentMatch?.startingFive?.[side]?.[index] || '')
  const usedIds = new Set()
  let fallbackIndex = 0

  const getFallbackPlayer = () => {
    while (fallbackIndex < rosterPlayers.length) {
      const player = rosterPlayers[fallbackIndex]
      fallbackIndex += 1

      if (player?.id && !usedIds.has(player.id)) {
        usedIds.add(player.id)
        return player
      }
    }

    return null
  }

  return slotIds.map(playerId => {
    const player = playerId ? getPlayerById(project, playerId) : null

    if (player?.id && !usedIds.has(player.id)) {
      usedIds.add(player.id)
      return player
    }

    return getFallbackPlayer()
  }).filter(Boolean)
}
