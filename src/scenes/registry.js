import CastersScene from './casters/CastersScene'
import CountdownScene from './countdown/CountdownScene'
import CurrentMapScene from './current-map/CurrentMapScene'
import LiveHudScene from './live-hud/LiveHudScene'
import MediaScene from './media/MediaScene'
import MatchupScene from './matchup/MatchupScene'
import MvpScene from './mvp/MvpScene'
import PauseScene from './pause/PauseScene'
import ResultScene from './result/ResultScene'
import RosterScene from './roster/RosterScene'
import StartingFiveScene from './starting-five/StartingFiveScene'
import StatsScene from './stats/StatsScene'
import TeamDataScene from './team-data/TeamDataScene'
import ThanksScene from './thanks/ThanksScene'

export const SCENE_REGISTRY = [
  {
    id: 'matchup',
    name: 'Up Next',
    enName: 'Up Next',
    category: 'show-flow',
    consoleGroup: 'show-flow',
    defaultEnabled: true,
    visibleInConsole: true,
    component: MatchupScene
  },
  {
    id: 'live-hud',
    name: 'Live',
    enName: 'Live',
    category: 'live',
    consoleGroup: 'core',
    defaultEnabled: true,
    visibleInConsole: true,
    component: LiveHudScene
  },
  {
    id: 'current-map',
    name: 'Map Setup',
    enName: 'Map Setup',
    category: 'match-control',
    consoleGroup: 'core',
    defaultEnabled: true,
    visibleInConsole: true,
    component: CurrentMapScene
  },
  {
    id: 'roster',
    name: 'Team Roster',
    enName: 'Team Roster',
    category: 'match-control',
    consoleGroup: 'core',
    defaultEnabled: true,
    visibleInConsole: true,
    component: RosterScene
  },
  {
    id: 'stats',
    name: 'Match Stats',
    enName: 'Match Stats',
    category: 'data',
    consoleGroup: 'data-center',
    defaultEnabled: true,
    visibleInConsole: true,
    component: StatsScene
  },
  {
    id: 'casters',
    name: 'Caster Desk',
    enName: 'Caster Desk',
    category: 'show',
    consoleGroup: 'core',
    defaultEnabled: true,
    visibleInConsole: true,
    component: CastersScene
  },
  {
    id: 'countdown',
    name: 'Break',
    enName: 'Break',
    category: 'break',
    consoleGroup: 'break-desk',
    defaultEnabled: true,
    visibleInConsole: true,
    component: CountdownScene
  },
  {
    id: 'media',
    name: 'Media',
    enName: 'Media',
    category: 'media',
    consoleGroup: 'media',
    defaultEnabled: true,
    visibleInConsole: true,
    component: MediaScene
  },
  {
    id: 'team-data',
    name: 'Player Data',
    enName: 'Player Data',
    category: 'data',
    consoleGroup: 'data-center',
    defaultEnabled: true,
    visibleInConsole: true,
    component: TeamDataScene
  },
  {
    id: 'mvp',
    name: 'MVP',
    enName: 'MVP',
    category: 'data',
    consoleGroup: 'data-center',
    defaultEnabled: true,
    visibleInConsole: true,
    component: MvpScene
  },
  {
    id: 'starting-five',
    name: 'Starting Five',
    enName: 'Starting Five',
    category: 'show-flow',
    consoleGroup: 'show-flow',
    defaultEnabled: true,
    visibleInConsole: true,
    component: StartingFiveScene
  },
  {
    id: 'pause',
    name: 'Technical Pause',
    enName: 'Technical Pause',
    category: 'break',
    consoleGroup: 'break-desk',
    defaultEnabled: true,
    visibleInConsole: true,
    component: PauseScene
  },
  {
    id: 'result',
    name: 'Result',
    enName: 'Result',
    category: 'show-flow',
    consoleGroup: 'show-flow',
    defaultEnabled: true,
    visibleInConsole: true,
    component: ResultScene
  },
  {
    id: 'thanks',
    name: 'Thanks',
    enName: 'Thanks',
    category: 'show-flow',
    consoleGroup: 'show-flow',
    defaultEnabled: true,
    visibleInConsole: true,
    component: ThanksScene
  }
]

export const CONSOLE_SCENES = SCENE_REGISTRY.filter(scene => scene.visibleInConsole)

const getConsoleScenesById = sceneIds => sceneIds
  .map(sceneId => CONSOLE_SCENES.find(scene => scene.id === sceneId))
  .filter(Boolean)

export const CONSOLE_SELECTOR_ITEMS = [
  { type: 'scene', id: 'live-hud', scene: CONSOLE_SCENES.find(scene => scene.id === 'live-hud') },
  { type: 'scene', id: 'current-map', scene: CONSOLE_SCENES.find(scene => scene.id === 'current-map') },
  { type: 'scene', id: 'roster', scene: CONSOLE_SCENES.find(scene => scene.id === 'roster') },
  { type: 'scene', id: 'casters', scene: CONSOLE_SCENES.find(scene => scene.id === 'casters') },
  {
    type: 'bundle',
    id: 'data-center',
    label: 'Data Center',
    description: 'Team / Player',
    defaultSceneId: 'stats',
    scenes: getConsoleScenesById(['stats', 'team-data', 'mvp'])
  },
  {
    type: 'bundle',
    id: 'break-desk',
    label: 'Break Desk',
    description: 'Standby / Countdown / Pause',
    defaultSceneId: 'countdown',
    scenes: getConsoleScenesById(['countdown', 'pause'])
  },
  { type: 'scene', id: 'media', scene: CONSOLE_SCENES.find(scene => scene.id === 'media') },
  {
    type: 'bundle',
    id: 'show-flow',
    label: 'Show Flow',
    description: 'Up Next / Lineup / Result / Thanks',
    defaultSceneId: 'matchup',
    scenes: getConsoleScenesById(['matchup', 'starting-five', 'result', 'thanks'])
  }
].filter(item => item.type === 'bundle' ? item.scenes.length : item.scene)

export const SCENE_BY_ID = SCENE_REGISTRY.reduce((acc, scene) => {
  acc[scene.id] = scene
  return acc
}, {})

const LEGACY_SCENE_FALLBACKS = {
  opening: 'countdown'
}

export const getSceneById = sceneId => (
  SCENE_BY_ID[sceneId] ||
  SCENE_BY_ID[LEGACY_SCENE_FALLBACKS[sceneId]] ||
  SCENE_BY_ID.countdown ||
  SCENE_REGISTRY[0]
)

export const getConsoleSceneById = sceneId => (
  CONSOLE_SCENES.find(scene => scene.id === sceneId) ||
  CONSOLE_SCENES.find(scene => scene.id === LEGACY_SCENE_FALLBACKS[sceneId]) ||
  CONSOLE_SCENES.find(scene => scene.id === 'countdown') ||
  CONSOLE_SCENES[0]
)
