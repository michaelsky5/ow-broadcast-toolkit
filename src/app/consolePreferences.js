export const CONSOLE_SETTINGS_STORAGE_KEY = 'owbt-console-settings-v1'

export const DEFAULT_SCENE_TRANSITION_SETTINGS = {
  sceneTransitionMode: 'scan',
  sceneTransitionSpeed: 'normal',
  sceneTransitionLogo: 'off'
}

export const SCENE_TRANSITION_MODES = ['none', 'simple', 'scan']
export const SCENE_TRANSITION_SPEEDS = ['fast', 'normal', 'slow']
export const SCENE_TRANSITION_LOGOS = ['off', 'event', 'ow']

export const normalizeSceneTransitionSettings = settings => {
  const requestedMode = settings?.sceneTransitionMode === 'cut' ? 'none' : settings?.sceneTransitionMode
  const mode = SCENE_TRANSITION_MODES.includes(requestedMode)
    ? requestedMode
    : DEFAULT_SCENE_TRANSITION_SETTINGS.sceneTransitionMode
  const speed = SCENE_TRANSITION_SPEEDS.includes(settings?.sceneTransitionSpeed)
    ? settings.sceneTransitionSpeed
    : DEFAULT_SCENE_TRANSITION_SETTINGS.sceneTransitionSpeed
  const logo = SCENE_TRANSITION_LOGOS.includes(settings?.sceneTransitionLogo)
    ? settings.sceneTransitionLogo
    : DEFAULT_SCENE_TRANSITION_SETTINGS.sceneTransitionLogo

  return {
    sceneTransitionMode: mode,
    sceneTransitionSpeed: speed,
    sceneTransitionLogo: logo
  }
}

export const loadSceneTransitionSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SCENE_TRANSITION_SETTINGS
  }

  try {
    const raw = JSON.parse(window.localStorage.getItem(CONSOLE_SETTINGS_STORAGE_KEY) || '{}')
    return normalizeSceneTransitionSettings(raw)
  } catch {
    return DEFAULT_SCENE_TRANSITION_SETTINGS
  }
}
