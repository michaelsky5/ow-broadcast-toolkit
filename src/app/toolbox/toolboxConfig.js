import { SCENE_REGISTRY } from '../../scenes/registry'

export const TOOLBOX_MODES = [
  { id: 'cover' },
  { id: 'matchup' },
  { id: 'result' },
  { id: 'assets' },
  { id: 'export-scene' }
]

export const EXPORT_PRESETS = [
  { id: '1080p', label: '1080P', size: '1920 x 1080', width: 1920, height: 1080 },
  { id: '4k', label: '4K', size: '3840 x 2160', width: 3840, height: 2160 },
  { id: '4-3', label: '4:3 HD', size: '1440 x 1080', width: 1440, height: 1080 },
  { id: 'custom', label: 'Custom', size: 'Manual' }
]

export const BASE_SCENE_WIDTH = 1920
export const BASE_SCENE_HEIGHT = 1080
export const STATIC_GRAPHIC_MODE_IDS = ['cover', 'matchup', 'result']

export const EXPORT_SCENE_GROUPS = [
  { id: 'core', sceneIds: ['live-hud', 'current-map', 'roster', 'casters'] },
  { id: 'show-flow', sceneIds: ['matchup', 'starting-five', 'result', 'thanks'] },
  { id: 'break', sceneIds: ['countdown', 'pause'] },
  { id: 'media', sceneIds: ['media'] },
  { id: 'data', sceneIds: ['stats', 'team-data', 'mvp'] },
]

export const getExportableScenes = project => {
  const enabledIds = Array.isArray(project?.scenes?.enabledSceneIds)
    ? project.scenes.enabledSceneIds
    : []
  const orderedIds = [
    ...(Array.isArray(project?.scenes?.order) ? project.scenes.order : []),
    ...enabledIds,
    ...SCENE_REGISTRY.filter(scene => scene.defaultEnabled).map(scene => scene.id)
  ]
  const seen = new Set()
  const orderedScenes = orderedIds
    .map(sceneId => SCENE_REGISTRY.find(scene => scene.id === sceneId))
    .filter(scene => {
      if (!scene || seen.has(scene.id)) return false
      seen.add(scene.id)
      return enabledIds.length ? enabledIds.includes(scene.id) || scene.defaultEnabled : scene.defaultEnabled
    })

  return orderedScenes.length ? orderedScenes : SCENE_REGISTRY.filter(scene => scene.defaultEnabled)
}

export const createSceneProject = (project, sceneId) => ({
  ...project,
  scenes: {
    ...project.scenes,
    activeSceneId: sceneId
  }
})
