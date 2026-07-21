import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createDefaultProject } from '../project/defaultProject'
import { getCompetitionName } from '../project/branding'
import {
  exportProjectAsJson,
  readProjectFile,
  safeParseProject,
  stringifyProject
} from '../project/projectUtils'
import {
  loadStoredProgramProject,
  loadStoredProject,
  replaceStoredProject,
  resetStoredProject
} from '../project/projectStorage'
import { publishProgramState, publishProjectState } from '../project/projectSync'
import { applyThemeTokens } from '../theme/themeTokens'
import { OW_MAP_OPTIONS } from '../data/overwatch'
import { CONSOLE_SELECTOR_ITEMS, SCENE_REGISTRY, getConsoleSceneById, getSceneById } from '../scenes/registry'
import { getBundleDisplay, getSceneDisplay } from '../scenes/sceneCopy'
import OverlayPage from '../overlay/OverlayPage'
import ProgramPreview from '../overlay/ProgramPreview'
import { getAppCopy, getAppLanguage } from './appCopy'
import { APP_ROUTES, getAppRoute, getAppRouteHash, getAppRouteUrl } from './appRoute'
import IntroSplash from './IntroSplash'
import { isUsageNoticeAccepted } from './usageNotice'
import ConsoleEntry from './ConsoleEntry'
import {
  CONSOLE_SETTINGS_STORAGE_KEY,
  DEFAULT_SCENE_TRANSITION_SETTINGS,
  normalizeSceneTransitionSettings
} from './consolePreferences'
import { getOverlayUrl } from './overlayUrl'
import SceneEditor from './editors/SceneEditor'
import { getEditorChromeCopy } from './editors/shared/editorCopy'
import { EditorDialog } from './editors/shared/editorControls'
import ToolboxWorkspace from './toolbox/ToolboxWorkspace'
import {
  MATCH_PACKAGE_ERROR_CODES,
  MATCH_PACKAGE_IMPORT_MODES,
  MATCH_PACKAGE_SCHEMA_VERSION,
  applyMatchPackageToProject,
  getMatchPackageImportMode,
  resetProjectForNewMatchPackage,
  parseMatchPackage
} from '../team-library/matchPackage'
import styles from './App.module.css'

const TeamLibraryPage = lazy(() => import('../team-library/TeamLibraryPage'))

function LibraryLoadState({ failed = false, language = 'zh', onBack, onRetry }) {
  const isEnglish = language === 'en'

  return (
    <main className={styles.libraryLoadState} aria-live="polite">
      <div className={styles.libraryLoadCard}>
        <span>OWBT // TEAM LIBRARY</span>
        <h1>{failed
          ? (isEnglish ? 'Unable to load Team Library' : '素材仓库加载失败')
          : (isEnglish ? 'Loading Team Library' : '正在加载素材仓库')}</h1>
        <p>{failed
          ? (isEnglish
              ? 'A required page resource could not be loaded. Reload the page to try again.'
              : '页面资源加载失败，请重新加载后再试。')
          : (isEnglish ? 'Preparing local teams and assets…' : '正在准备本地队伍与素材…')}</p>
        {failed && (
          <div className={styles.libraryLoadActions}>
            <button type="button" onClick={onRetry}>{isEnglish ? 'Reload' : '重新加载'}</button>
            <button type="button" onClick={onBack}>{isEnglish ? 'Back' : '返回'}</button>
          </div>
        )}
      </div>
    </main>
  )
}

class LibraryLoadBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('[OWBT] Failed to load Team Library:', error, info)
  }

  render() {
    if (this.state.failed) {
      return (
        <LibraryLoadState
          failed
          language={this.props.language}
          onBack={this.props.onBack}
          onRetry={() => window.location.reload()}
        />
      )
    }

    return this.props.children
  }
}

const updateNested = (project, updater) => {
  const next = structuredClone(project)
  updater(next)
  return next
}

const PROJECT_SYNC_DEBOUNCE_MS = 180
const HOTKEY_COMMANDS = [
  { id: 'take', defaultKeys: 'Ctrl Alt T', labelKey: 'hotkeyTake' },
  { id: 'undo', defaultKeys: 'Ctrl Alt Z', labelKey: 'hotkeyUndo' },
  { id: 'swapTeams', defaultKeys: 'Ctrl Alt X', labelKey: 'hotkeySwapTeams' },
  { id: 'resetScore', defaultKeys: 'Ctrl Alt 0', labelKey: 'hotkeyResetScore' },
  { id: 'toolbox', defaultKeys: 'Ctrl Alt G', labelKey: 'hotkeyToolbox' },
  { id: 'setup', defaultKeys: 'Ctrl Alt S', labelKey: 'hotkeySetup' },
  { id: 'settings', defaultKeys: 'Ctrl Alt ,', labelKey: 'hotkeySettings' }
]
const DEFAULT_HOTKEYS = HOTKEY_COMMANDS.reduce((hotkeys, command) => {
  hotkeys[command.id] = command.defaultKeys
  return hotkeys
}, {})
const DEFAULT_CONSOLE_SETTINGS = {
  interfaceLanguage: '',
  hotkeysEnabled: true,
  disableHotkeysInInputs: true,
  confirmDangerActions: true,
  operationLogLimit: 6,
  startWorkspaceMode: 'production',
  ...DEFAULT_SCENE_TRANSITION_SETTINGS,
  hotkeys: DEFAULT_HOTKEYS,
  desktopAssetRoot: '',
  desktopExportDirectory: '',
  desktopObsScenePath: ''
}
const VALID_INTERFACE_LANGUAGES = ['zh', 'en']

const createTakeTransitionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const markTakeTransition = project => ({
  ...project,
  scenes: {
    ...(project?.scenes || {}),
    takeTransitionId: createTakeTransitionId()
  }
})

const getMatchPackageErrorMessage = (copy, error) => {
  switch (error?.code) {
    case MATCH_PACKAGE_ERROR_CODES.EMPTY:
      return copy.matchPackageEmpty
    case MATCH_PACKAGE_ERROR_CODES.INVALID_JSON:
      return copy.matchPackageInvalidJson
    case MATCH_PACKAGE_ERROR_CODES.WRONG_KIND:
      return copy.matchPackageWrongKind
    case MATCH_PACKAGE_ERROR_CODES.UNSUPPORTED_VERSION:
      return copy.matchPackageUnsupportedVersion
    case MATCH_PACKAGE_ERROR_CODES.MISSING_TEAMS:
      return copy.matchPackageMissingTeams
    case MATCH_PACKAGE_ERROR_CODES.DUPLICATE_TEAMS:
      return copy.matchPackageDuplicateTeams
    case MATCH_PACKAGE_ERROR_CODES.TOO_LARGE:
      return copy.matchPackageTooLarge
    default:
      return copy.matchPackageInvalid
  }
}

const setDocumentSurface = showOverlay => {
  if (typeof document === 'undefined') return
  const surface = showOverlay ? 'overlay' : 'console'
  document.documentElement.dataset.owbtSurface = surface
  document.body.dataset.owbtSurface = surface
}

const normalizeMainKey = key => {
  const raw = String(key || '').trim()
  const lower = raw.toLowerCase()
  if (!raw) return ''
  if (lower === 'esc') return 'Escape'
  if (lower === 'space' || raw === ' ') return 'Space'
  if (lower === 'comma') return ','
  if (lower === 'period') return '.'
  if (lower.startsWith('arrow')) return `Arrow${lower.slice(5, 6).toUpperCase()}${lower.slice(6)}`
  if (raw.length === 1) return raw.toUpperCase()
  return raw
}

const normalizeHotkeyText = value => {
  const tokens = String(value || '').replace(/\+/g, ' ').trim().split(/\s+/).filter(Boolean)
  const modifiers = []
  let mainKey = ''
  const aliases = {
    alt: 'Alt',
    option: 'Alt',
    control: 'Ctrl',
    ctrl: 'Ctrl',
    cmd: 'Meta',
    command: 'Meta',
    meta: 'Meta',
    shift: 'Shift',
    win: 'Meta',
    windows: 'Meta'
  }

  tokens.forEach(token => {
    const modifier = aliases[token.toLowerCase()]
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier)
      return
    }

    mainKey = normalizeMainKey(token)
  })

  if (!mainKey) return ''

  return ['Ctrl', 'Alt', 'Shift', 'Meta']
    .filter(modifier => modifiers.includes(modifier))
    .concat(mainKey)
    .join(' ')
}

const getHotkeyFromEvent = event => {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return ''

  const mainKey = normalizeMainKey(event.key)
  if (!mainKey) return ''

  return [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    mainKey
  ].filter(Boolean).join(' ')
}

const getHotkeyConflicts = hotkeys => {
  const usedByHotkey = new Map()
  const conflicts = new Set()

  HOTKEY_COMMANDS.forEach(command => {
    const hotkey = normalizeHotkeyText(hotkeys?.[command.id])
    if (!hotkey) return
    if (usedByHotkey.has(hotkey)) {
      conflicts.add(command.id)
      conflicts.add(usedByHotkey.get(hotkey))
      return
    }

    usedByHotkey.set(hotkey, command.id)
  })

  return conflicts
}

const getOperationLogLimit = settings => {
  const numeric = Number(settings?.operationLogLimit) || DEFAULT_CONSOLE_SETTINGS.operationLogLimit
  return Math.max(4, Math.min(12, Math.round(numeric)))
}

const normalizeConsoleSettings = settings => {
  const next = {
    ...DEFAULT_CONSOLE_SETTINGS,
    ...(settings || {})
  }

  next.hotkeysEnabled = next.hotkeysEnabled !== false
  next.disableHotkeysInInputs = next.disableHotkeysInInputs !== false
  next.confirmDangerActions = next.confirmDangerActions !== false
  next.operationLogLimit = getOperationLogLimit(next)
  next.interfaceLanguage = VALID_INTERFACE_LANGUAGES.includes(next.interfaceLanguage) ? next.interfaceLanguage : ''
  next.startWorkspaceMode = ['production', 'toolbox'].includes(next.startWorkspaceMode)
    ? next.startWorkspaceMode
    : DEFAULT_CONSOLE_SETTINGS.startWorkspaceMode
  Object.assign(next, normalizeSceneTransitionSettings(next))
  next.hotkeys = {
    ...DEFAULT_HOTKEYS,
    ...(next.hotkeys || {})
  }
  HOTKEY_COMMANDS.forEach(command => {
    next.hotkeys[command.id] = normalizeHotkeyText(next.hotkeys[command.id]) || command.defaultKeys
  })
  next.desktopAssetRoot = String(next.desktopAssetRoot || '')
  next.desktopExportDirectory = String(next.desktopExportDirectory || '')
  next.desktopObsScenePath = String(next.desktopObsScenePath || '')

  return next
}

const loadConsoleSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_CONSOLE_SETTINGS

  try {
    return normalizeConsoleSettings(JSON.parse(window.localStorage.getItem(CONSOLE_SETTINGS_STORAGE_KEY) || '{}'))
  } catch {
    return DEFAULT_CONSOLE_SETTINGS
  }
}

const saveConsoleSettings = settings => {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(CONSOLE_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeConsoleSettings(settings)))
}

const isTypingTarget = target => {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

const getStatusOptions = copy => [
  { value: 'pending', label: copy.statusPending },
  { value: 'live', label: copy.statusLive },
  { value: 'pause', label: copy.statusPause },
  { value: 'break', label: copy.statusBreak },
  { value: 'finished', label: copy.statusFinished }
]

const getUndoReasonLabel = (reason, copy) => {
  const key = String(reason || '').trim().toUpperCase()
  const reasonLabels = {
    EDIT: copy.logReasonEdit,
    TAKE: copy.logReasonTake,
    'SWAP TEAMS': copy.logReasonSwapTeams,
    'RESET PROJECT': copy.logReasonResetProject,
    'IMPORT PROJECT': copy.logReasonImportProject,
    'IMPORT MATCH PACKAGE': copy.logReasonImportMatchPackage
  }

  return reasonLabels[key] || reason || copy.logReasonAction
}

const getSceneName = (scene, language) => getSceneDisplay(scene, language).name
const getSceneMeta = (scene, language) => getSceneDisplay(scene, language).meta
const getBundleLabel = (item, language) => getBundleDisplay(item, language).label
const getBundleDescription = (item, language) => getBundleDisplay(item, language).description
const getRailToggleLabel = (open, language) => (
  language === 'zh'
    ? (open ? '收起' : '展开')
    : (open ? 'Collapse' : 'Expand')
)

const getModeLabel = (modes, modeId) => (
  modes?.find(mode => mode.id === modeId)?.label || ''
)

const getMapSelectorMode = project => {
  const displayMode = project.scenes?.settings?.['current-map']?.displayMode ||
    project.scenes?.settings?.['current-map']?.mapPoolDisplayMode

  return displayMode === 'OVERVIEW' ? 'pool' : 'flow'
}

const getCasterSelectorMode = project => (
  project.scenes?.settings?.casters?.packageMode === 'STAFF' ? 'staff' : 'casters'
)

const getMediaSelectorMode = project => (
  project.scenes?.settings?.media?.mode === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'
)

const getSelectorSceneMeta = (scene, language, project, sceneModeHints) => {
  const chrome = getEditorChromeCopy(language)
  const selectorModes = {
    'live-hud': ['liveModes', sceneModeHints?.['live-hud'] || 'match'],
    'current-map': ['mapModes', getMapSelectorMode(project)],
    roster: ['rosterModes', sceneModeHints?.roster || 'roster'],
    casters: ['casterModes', getCasterSelectorMode(project)],
    media: ['mediaModes', getMediaSelectorMode(project)]
  }
  const selectorMode = selectorModes[scene?.id]

  if (!selectorMode) return getSceneMeta(scene, language)

  return getModeLabel(chrome[selectorMode[0]], selectorMode[1]) || getSceneMeta(scene, language)
}

const flipSideToken = value => {
  const raw = String(value ?? '').trim()
  const normalized = raw.toUpperCase()
  if (normalized === 'A' || normalized === 'TEAMA' || normalized === 'TEAM_A') return 'B'
  if (normalized === 'B' || normalized === 'TEAMB' || normalized === 'TEAM_B') return 'A'
  return value
}

const flipBanOrderMode = value => {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'A_FIRST') return 'B_FIRST'
  if (normalized === 'B_FIRST') return 'A_FIRST'
  return value
}

const swapObjectFields = (target, leftKey, rightKey) => {
  if (!target || typeof target !== 'object') return
  if (!(leftKey in target) && !(rightKey in target)) return
  const leftValue = target[leftKey]
  target[leftKey] = target[rightKey]
  target[rightKey] = leftValue
}

const flipObjectSideField = (target, key) => {
  if (!target || typeof target !== 'object' || !(key in target)) return
  target[key] = flipSideToken(target[key])
}

const swapMetricSides = metrics => {
  if (!Array.isArray(metrics)) return
  metrics.forEach(metric => swapObjectFields(metric, 'teamA', 'teamB'))
}

const swapStatsSettings = stats => {
  if (!stats || typeof stats !== 'object') return

  swapObjectFields(stats.ocrRows, 'teamA', 'teamB')
  swapObjectFields(stats.statsPlayerIds, 'teamA', 'teamB')
  swapMetricSides(stats.metrics)

  if (Array.isArray(stats.mapSnapshots)) {
    stats.mapSnapshots.forEach(snapshot => {
      swapObjectFields(snapshot.ocrRows, 'teamA', 'teamB')
      swapObjectFields(snapshot.playerIds, 'teamA', 'teamB')
      swapMetricSides(snapshot.metrics)
    })
  }
}

const swapMapEntrySides = entry => {
  if (!entry || typeof entry !== 'object') return

  swapObjectFields(entry, 'bansA', 'bansB')
  entry.banOrderMode = flipBanOrderMode(entry.banOrderMode)
  ;['picker', 'winner', 'winnerSide', 'attackSide'].forEach(key => {
    flipObjectSideField(entry, key)
  })
}

const swapHudSides = hud => {
  if (!hud || typeof hud !== 'object') return

  ;[
    ['teamLogoBgA', 'teamLogoBgB'],
    ['teamRecordA', 'teamRecordB'],
    ['teamRecordAW', 'teamRecordBW'],
    ['teamRecordAL', 'teamRecordBL'],
    ['teamSeedA', 'teamSeedB'],
    ['teamMetaA', 'teamMetaB'],
    ['subIndexA', 'subIndexB']
  ].forEach(([leftKey, rightKey]) => swapObjectFields(hud, leftKey, rightKey))

  ;['activeComms', 'keyPlayerSide'].forEach(key => flipObjectSideField(hud, key))
}

const swapSceneSideSettings = settings => {
  if (!settings || typeof settings !== 'object') return

  const roster = settings.roster
  if (roster) {
    flipObjectSideField(roster, 'teamSide')
    swapObjectFields(roster.activePlayerIds, 'teamA', 'teamB')
  }

  const casters = settings.casters
  if (casters?.interview) flipObjectSideField(casters.interview, 'teamSide')

  const startingFive = settings['starting-five']
  if (startingFive) flipObjectSideField(startingFive, 'startingLineupSide')

  const teamData = settings.teamData
  if (teamData) {
    flipObjectSideField(teamData, 'teamSide')
    flipObjectSideField(teamData, 'compareTeamSide')
    swapObjectFields(teamData.heroOverrides, 'A', 'B')
  }

  const mvp = settings.mvp
  if (mvp) flipObjectSideField(mvp, 'teamSide')

  swapStatsSettings(settings.stats)
}

const swapGraphicTeamSettings = graphics => {
  if (!graphics || typeof graphics !== 'object') return
  ;['cover', 'matchup', 'result'].forEach(mode => {
    const settings = graphics[mode]
    if (!settings || typeof settings !== 'object') return

    swapObjectFields(settings, 'teamAId', 'teamBId')
    swapObjectFields(settings.snapshot, 'teamA', 'teamB')
    swapObjectFields(settings.snapshot?.score, 'teamA', 'teamB')

    if (mode === 'result') {
      swapObjectFields(settings, 'scoreTeamA', 'scoreTeamB')
      flipObjectSideField(settings, 'winner')
    }
  })
}

const swapProjectMatchSides = draft => {
  const match = draft.currentMatch
  if (!match) return

  swapObjectFields(match, 'teamAId', 'teamBId')
  swapObjectFields(match.score, 'teamA', 'teamB')
  swapObjectFields(match.side, 'teamA', 'teamB')
  swapObjectFields(match, 'bansA', 'bansB')
  swapObjectFields(match.startingFive, 'teamA', 'teamB')
  swapObjectFields(match.substitutes, 'teamA', 'teamB')

  match.banOrderMode = flipBanOrderMode(match.banOrderMode)
  ;['winner', 'winnerSide'].forEach(key => flipObjectSideField(match, key))
  if (match.result) flipObjectSideField(match.result, 'winnerSide')
  if (Array.isArray(match.mapLineup)) match.mapLineup.forEach(swapMapEntrySides)

  swapHudSides(match.hud)
  swapSceneSideSettings(draft.scenes?.settings)
  swapGraphicTeamSettings(draft.tools?.graphics)
}

export default function App() {
  const [route, setRoute] = useState(getAppRoute)
  const routeRef = useRef(route)
  const routeHashRef = useRef(typeof window === 'undefined' ? '' : window.location.hash)
  const routeBlockerRef = useRef(null)

  const onRouteBlockerChange = useCallback(blocker => {
    routeBlockerRef.current = typeof blocker === 'function' ? blocker : null
  }, [])

  const navigateRoute = useCallback((nextRoute, options = {}) => {
    const nextHash = getAppRouteHash(nextRoute)
    const method = options.replace === true ? 'replaceState' : 'pushState'
    if (window.location.hash !== nextHash) {
      window.history[method](null, '', getAppRouteUrl(window.location, nextHash))
    }
    routeHashRef.current = nextHash
    routeRef.current = nextRoute
    setRoute(nextRoute)
  }, [])

  useLayoutEffect(() => {
    setDocumentSurface(route === APP_ROUTES.OVERLAY)
  }, [route])

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = getAppRoute()
      const nextHash = window.location.hash

      if (nextRoute === routeRef.current) {
        routeHashRef.current = nextHash
        return
      }

      const canLeaveRoute = routeBlockerRef.current?.({
        from: routeRef.current,
        to: nextRoute,
        proceed: () => {
          window.history.replaceState(null, '', getAppRouteUrl(window.location, nextHash))
          routeHashRef.current = nextHash
          routeRef.current = nextRoute
          setRoute(nextRoute)
        }
      })
      if (canLeaveRoute === false) {
        window.history.replaceState(null, '', getAppRouteUrl(window.location, routeHashRef.current))
        return
      }

      routeHashRef.current = nextHash
      routeRef.current = nextRoute
      setRoute(nextRoute)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return route === APP_ROUTES.OVERLAY
    ? <OverlayPage />
    : (
        <ConsoleApp
          route={route}
          onNavigateRoute={navigateRoute}
          onRouteBlockerChange={onRouteBlockerChange}
        />
      )
}

function RailPanel({ title, children }) {
  return (
    <section className={`${styles.panel} ${styles.railPanel}`}>
      <div className={styles.railPanelTitle}>
        <span>{title}</span>
      </div>
      <div className={styles.railPanelBody}>{children}</div>
    </section>
  )
}

function ConsoleApp({ route, onNavigateRoute, onRouteBlockerChange }) {
  const controlMode = route === APP_ROUTES.CONTROL
  const [project, setProject] = useState(() => loadStoredProject() || createDefaultProject())
  const [programProject, setProgramProject] = useState(() => loadStoredProgramProject() || project)
  const [consoleScreen, setConsoleScreen] = useState(() => {
    if (route === APP_ROUTES.LIBRARY) {
      return isUsageNoticeAccepted() ? 'library' : 'intro'
    }
    if (controlMode) return 'workspace'
    return 'intro'
  })
  const [libraryReturnScreen, setLibraryReturnScreen] = useState('entry')
  const [libraryReturnRoute, setLibraryReturnRoute] = useState(APP_ROUTES.ROOT)
  const [previewSceneId, setPreviewSceneId] = useState(() => getConsoleSceneById(project.scenes.activeSceneId).id)
  const [editorSceneId, setEditorSceneId] = useState(() => getConsoleSceneById(project.scenes.activeSceneId).id)
  const [operationLog, setOperationLog] = useState([])
  const [undoStack, setUndoStack] = useState([])
  const [appDialog, setAppDialog] = useState(null)
  const [matchPackageNotice, setMatchPackageNotice] = useState(null)
  const [workspaceMode, setWorkspaceMode] = useState('production')
  const [entrySection, setEntrySection] = useState('system')
  const [sceneModeHints, setSceneModeHints] = useState({
    'live-hud': 'match',
    roster: controlMode ? 'teams' : 'roster'
  })
  const [consoleSettings, setConsoleSettings] = useState(loadConsoleSettings)
  const [rightRailCollapsed, setRightRailCollapsed] = useState(controlMode)
  const importInputRef = useRef(null)
  const projectTextRef = useRef(null)
  const matchPackageTextRef = useRef(null)
  const projectRef = useRef(project)
  const programProjectRef = useRef(programProject)
  const hotkeyActionsRef = useRef({})
  const consoleScreenRef = useRef(consoleScreen)
  const libraryReturnScreenRef = useRef(libraryReturnScreen)
  const previousRouteRef = useRef(route)
  const internalLibraryNavigationRef = useRef(false)
  const copy = getAppCopy(project, consoleSettings.interfaceLanguage)
  const language = getAppLanguage(project, consoleSettings.interfaceLanguage)
  const competitionName = getCompetitionName(project, language)
  const overlayUrl = getOverlayUrl(project)
  const statusOptions = getStatusOptions(copy)
  const showRightRailControls = workspaceMode === 'production'

  useEffect(() => {
    consoleScreenRef.current = consoleScreen
  }, [consoleScreen])

  useEffect(() => {
    libraryReturnScreenRef.current = libraryReturnScreen
  }, [libraryReturnScreen])

  useEffect(() => {
    const previousRoute = previousRouteRef.current

    if (route === APP_ROUTES.LIBRARY) {
      if (!internalLibraryNavigationRef.current) {
        setLibraryReturnRoute(previousRoute === APP_ROUTES.CONTROL ? APP_ROUTES.CONTROL : APP_ROUTES.ROOT)
        setLibraryReturnScreen(previousRoute === APP_ROUTES.CONTROL || consoleScreenRef.current === 'workspace' ? 'workspace' : 'entry')
      }
      internalLibraryNavigationRef.current = false
      setConsoleScreen(isUsageNoticeAccepted() ? 'library' : 'intro')
    } else if (route === APP_ROUTES.CONTROL) {
      setConsoleScreen('workspace')
      setWorkspaceMode('production')
      setSceneModeHints(previous => ({ ...previous, roster: 'teams' }))
      setRightRailCollapsed(true)
    } else if (previousRoute === APP_ROUTES.LIBRARY) {
      setConsoleScreen(consoleScreenRef.current === 'intro' ? 'intro' : libraryReturnScreenRef.current)
    } else if (previousRoute === APP_ROUTES.CONTROL) {
      setConsoleScreen('intro')
    }

    previousRouteRef.current = route
  }, [route])

  const programScene = useMemo(() => {
    return getSceneById(programProject.scenes.activeSceneId)
  }, [programProject.scenes.activeSceneId])

  const previewScene = useMemo(() => {
    return getSceneById(previewSceneId) || programScene
  }, [previewSceneId, programScene])

  const editorScene = useMemo(() => {
    return SCENE_REGISTRY.find(scene => scene.id === editorSceneId) || previewScene
  }, [editorSceneId, previewScene])

  const previewProject = useMemo(() => ({
    ...project,
    scenes: {
      ...project.scenes,
      activeSceneId: previewScene.id
    }
  }), [project, previewScene.id])

  const currentMap = OW_MAP_OPTIONS.find(map => map.id === project.currentMatch.currentMapId)
  const currentMapLabel = currentMap ? (language === 'en' ? currentMap.en : currentMap.zh) : project.currentMatch.currentMapId

  useEffect(() => {
    projectRef.current = project
    applyThemeTokens(project.theme)
    const syncTimer = window.setTimeout(() => {
      publishProjectState(projectRef.current, 'console')
    }, PROJECT_SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(syncTimer)
  }, [project])

  useEffect(() => {
    programProjectRef.current = programProject
    const syncTimer = window.setTimeout(() => {
      publishProgramState(programProjectRef.current, 'console-program')
    }, PROJECT_SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(syncTimer)
  }, [programProject])

  useEffect(() => {
    const flushProjectState = () => {
      publishProjectState(projectRef.current, 'console')
      publishProgramState(programProjectRef.current, 'console-program')
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushProjectState()
    }

    window.addEventListener('pagehide', flushProjectState)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      flushProjectState()
      window.removeEventListener('pagehide', flushProjectState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const pushUndoSnapshot = reason => {
    setUndoStack(prev => [{
      id: `${Date.now()}-${reason || 'edit'}`,
      reason,
      project: structuredClone(projectRef.current),
      programProject: structuredClone(programProjectRef.current),
      previewSceneId,
      editorSceneId,
      workspaceMode
    }, ...prev].slice(0, 12))
  }

  const updateProject = (updater, options = {}) => {
    if (!options.skipUndo) pushUndoSnapshot(options.undoReason || 'EDIT')

    const nextProject = updateNested(projectRef.current, updater)
    projectRef.current = nextProject
    setProject(nextProject)

    if (options.persistImmediately === true) {
      publishProjectState(nextProject, 'console')
    }

    if (options.live === true) {
      const nextProgramProject = updateNested(programProjectRef.current, options.programUpdater || updater)
      programProjectRef.current = nextProgramProject
      setProgramProject(nextProgramProject)

      if (options.persistImmediately === true) {
        publishProgramState(nextProgramProject, 'console-program')
      }
    }
  }

  const pushLog = message => {
    const time = new Date().toLocaleTimeString()
    setOperationLog(prev => (
      [{ id: `${Date.now()}-${message}`, time, message }, ...prev].slice(0, getOperationLogLimit(consoleSettings))
    ))
  }

  const updateConsoleSettings = patch => {
    setConsoleSettings(prev => {
      const next = normalizeConsoleSettings({ ...prev, ...patch })
      saveConsoleSettings(next)
      setOperationLog(log => log.slice(0, getOperationLogLimit(next)))
      return next
    })
  }

  const updateConsoleLanguage = value => {
    const nextLanguage = value === 'zh' ? 'zh' : 'en'
    updateConsoleSettings({ interfaceLanguage: nextLanguage })
    updateProject(draft => {
      draft.event.language = nextLanguage
    }, { skipUndo: true })
  }

  const resetConsoleSettings = () => updateConsoleSettings(DEFAULT_CONSOLE_SETTINGS)

  const enterWorkspace = () => {
    setConsoleScreen('workspace')
    setWorkspaceMode(consoleSettings.startWorkspaceMode === 'toolbox' ? 'toolbox' : 'production')
  }

  const openTeamLibrary = returnScreen => {
    const nextReturnScreen = returnScreen === 'workspace' ? 'workspace' : 'entry'
    setLibraryReturnScreen(nextReturnScreen)
    setLibraryReturnRoute(route === APP_ROUTES.CONTROL ? APP_ROUTES.CONTROL : APP_ROUTES.ROOT)
    internalLibraryNavigationRef.current = true
    setConsoleScreen('library')
    onNavigateRoute(APP_ROUTES.LIBRARY)
  }

  const closeTeamLibrary = () => {
    setConsoleScreen(libraryReturnScreen)
    onNavigateRoute(libraryReturnRoute, { replace: true })
  }

  const selectPreviewScene = scene => {
    setWorkspaceMode('production')
    setPreviewSceneId(scene.id)
    setEditorSceneId(scene.id)
    updateProject(draft => {
      draft.scenes.activeSceneId = scene.id
    }, { skipUndo: true })
    pushLog(copy.logPreview(getSceneName(scene, language)))
  }

  const openSetup = () => {
    setEntrySection('system')
    setConsoleScreen('entry')
    pushLog(copy.logOpenSetup)
  }

  const openToolbox = () => {
    setWorkspaceMode('toolbox')
    pushLog(copy.logOpenToolbox)
  }

  const openSettings = () => {
    setEntrySection('system')
    setConsoleScreen('entry')
    pushLog(copy.logOpenSettings)
  }

  const updateSceneModeHint = (sceneId, modeId) => {
    setSceneModeHints(prev => ({ ...prev, [sceneId]: modeId }))
  }

  const autoTakeProgramScene = (scene, options = {}) => {
    const previousProgramProject = programProjectRef.current
    const nextProject = {
      ...previousProgramProject,
      scenes: {
        ...previousProgramProject.scenes,
        activeSceneId: scene.id
      }
    }

    const isSameProgramScene = previousProgramProject.scenes?.activeSceneId === scene.id
    const nextProgramProject = options.suppressSameSceneTransition && isSameProgramScene
      ? nextProject
      : markTakeTransition(nextProject)
    programProjectRef.current = nextProgramProject
    setProgramProject(nextProgramProject)
    setPreviewSceneId('live-hud')
    pushLog(copy.logAutoTake(getSceneName(scene, language)))
  }

  const takePreviewToProgram = () => {
    pushUndoSnapshot('TAKE')
    const nextProgramProject = markTakeTransition(structuredClone(previewProject))
    programProjectRef.current = nextProgramProject
    setProgramProject(nextProgramProject)
    pushLog(copy.logTake(getSceneName(previewScene, language)))
  }

  const resetScore = () => {
    updateProject(draft => {
      draft.currentMatch.score.teamA = 0
      draft.currentMatch.score.teamB = 0
    }, { live: true })
    pushLog(copy.logResetScore)
  }

  const swapMatchSides = () => {
    updateProject(draft => {
      swapProjectMatchSides(draft)
    }, { live: true, undoReason: 'SWAP TEAMS' })
    pushLog(copy.logSwapTeams)
  }

  const undoLastAction = () => {
    const snapshot = undoStack[0]

    if (!snapshot) {
      pushLog(copy.undoEmpty)
      return
    }

    setUndoStack(prev => prev.slice(1))
    projectRef.current = snapshot.project
    programProjectRef.current = snapshot.programProject
    setProject(snapshot.project)
    setProgramProject(snapshot.programProject)
    setMatchPackageNotice(null)
    setPreviewSceneId(snapshot.previewSceneId)
    setEditorSceneId(snapshot.editorSceneId)
    setWorkspaceMode(snapshot.workspaceMode === 'toolbox' ? 'toolbox' : 'production')
    pushLog(copy.logUndo(getUndoReasonLabel(snapshot.reason, copy)))
  }

  const copyOverlayUrl = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(overlayUrl)
      pushLog(copy.logCopyOverlay)
    } catch {
      setAppDialog({
        kicker: 'Overlay',
        title: copy.copyUrl,
        message: `${copy.overlayUrl}: ${overlayUrl}`,
        confirmLabel: copy.ok,
        onConfirm: () => setAppDialog(null)
      })
    }
  }

  const performResetProject = () => {
    pushUndoSnapshot('RESET PROJECT')
    const next = resetStoredProject()
    projectRef.current = next
    programProjectRef.current = next
    setProject(next)
    setProgramProject(next)
    setMatchPackageNotice(null)
    setPreviewSceneId(next.scenes.activeSceneId)
    setEditorSceneId(next.scenes.activeSceneId)
    pushLog(copy.logResetProject)
  }

  const handleResetProject = () => {
    if (!consoleSettings.confirmDangerActions) {
      performResetProject()
      return
    }

    setAppDialog({
      kicker: copy.project,
      title: copy.resetProject,
      message: copy.resetProjectConfirm,
      tone: 'danger',
      confirmLabel: copy.resetProject,
      cancelLabel: copy.cancel,
      onCancel: () => setAppDialog(null),
      onConfirm: () => {
        setAppDialog(null)
        performResetProject()
      }
    })
  }

  const showImportError = error => {
    pushLog(copy.logImportFailed)
    setAppDialog({
      kicker: copy.project,
      title: copy.importFailedTitle,
      message: error?.message || copy.invalidProjectFile,
      confirmLabel: copy.ok,
      onConfirm: () => setAppDialog(null)
    })
  }

  const applyImportedProject = importedProject => {
    pushUndoSnapshot('IMPORT PROJECT')
    const next = replaceStoredProject(importedProject)
    projectRef.current = next
    programProjectRef.current = next
    setProject(next)
    setProgramProject(next)
    setMatchPackageNotice(null)
    setPreviewSceneId(getConsoleSceneById(next.scenes.activeSceneId).id)
    setEditorSceneId(getConsoleSceneById(next.scenes.activeSceneId).id)
    pushLog(copy.logImportProject)
  }

  const requestProjectImport = importedProject => {
    if (!consoleSettings.confirmDangerActions) {
      setAppDialog(null)
      applyImportedProject(importedProject)
      return
    }

    setAppDialog({
      kicker: copy.project,
      title: copy.importProject,
      message: copy.importProjectConfirm,
      tone: 'danger',
      confirmLabel: copy.importProject,
      cancelLabel: copy.cancel,
      onCancel: () => setAppDialog(null),
      onConfirm: () => {
        setAppDialog(null)
        applyImportedProject(importedProject)
      }
    })
  }

  const importProjectFile = async file => {
    try {
      requestProjectImport(await readProjectFile(file))
    } catch (error) {
      showImportError(error)
    }
  }

  const handleImportProject = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) importProjectFile(file)
  }

  const showProjectTextExport = (text, message = copy.exportProjectTextMessage) => {
    setAppDialog({
      kicker: copy.project,
      title: copy.exportProjectTextTitle,
      message,
      wide: true,
      children: (
        <textarea
          ref={projectTextRef}
          value={text}
          aria-label={copy.exportProjectTextTitle}
          readOnly
          spellCheck={false}
        />
      ),
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: copy.copyProjectText,
          tone: 'primary',
          onClick: async () => {
            let copied

            try {
              projectTextRef.current?.focus()
              projectTextRef.current?.select()
              copied = Boolean(document.execCommand?.('copy'))
            } catch {
              copied = false
            }

            if (!copied && navigator.clipboard?.writeText) {
              try {
                await navigator.clipboard.writeText(text)
                copied = true
              } catch {
                // OBS Browser Sources can expose the Clipboard API while denying writes.
                copied = false
              }
            }

            if (copied) {
              showProjectTextExport(text, copy.projectTextCopied)
              return
            }

            showProjectTextExport(text, copy.projectTextCopyFallback)
            window.setTimeout(() => {
              projectTextRef.current?.focus()
              projectTextRef.current?.select()
            }, 0)
          }
        }
      ]
    })
  }

  const showProjectTextImport = (
    initialText = '',
    message = copy.importProjectTextMessage
  ) => {
    setAppDialog({
      kicker: copy.project,
      title: copy.importProjectTextTitle,
      message,
      wide: true,
      children: (
        <textarea
          ref={projectTextRef}
          defaultValue={initialText}
          aria-label={copy.importProjectTextTitle}
          placeholder={copy.importProjectTextPlaceholder}
          spellCheck={false}
        />
      ),
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: copy.importProject,
          tone: 'primary',
          onClick: () => {
            const text = projectTextRef.current?.value || ''
            const importedProject = safeParseProject(text)
            if (!importedProject) {
              pushLog(copy.logImportFailed)
              showProjectTextImport(text, copy.invalidProjectFile)
              return
            }
            requestProjectImport(importedProject)
          }
        }
      ]
    })
  }

  const applyPastedMatchPackage = (matchPackage, importMode) => {
    updateProject(draft => {
      if (importMode === MATCH_PACKAGE_IMPORT_MODES.SWAP) {
        swapProjectMatchSides(draft)
      } else if (importMode === MATCH_PACKAGE_IMPORT_MODES.REPLACE) {
        resetProjectForNewMatchPackage(draft)
      }

      applyMatchPackageToProject(draft, matchPackage, {
        preservePlayerIds: importMode !== MATCH_PACKAGE_IMPORT_MODES.REPLACE
      })
    }, {
      persistImmediately: true,
      undoReason: 'IMPORT MATCH PACKAGE'
    })
    setAppDialog(null)
    setMatchPackageNotice({
      title: copy.matchPackageImported(matchPackage.teams.teamA.name, matchPackage.teams.teamB.name),
      message: importMode === MATCH_PACKAGE_IMPORT_MODES.REFRESH
        ? copy.matchPackageImportedRefreshMeta
        : importMode === MATCH_PACKAGE_IMPORT_MODES.SWAP
          ? copy.matchPackageImportedSwapMeta
          : copy.matchPackageImportedReplaceMeta
    })
    pushLog(copy.logImportMatchPackage)
  }

  const showMatchPackagePreview = matchPackage => {
    const importMode = getMatchPackageImportMode(project, matchPackage)
    const impact = importMode === MATCH_PACKAGE_IMPORT_MODES.REFRESH
      ? {
          message: copy.matchPackageRefreshMessage,
          label: copy.matchPackageRefreshImpactLabel,
          fields: copy.matchPackageRefreshImpact,
          confirm: copy.matchPackageRefreshConfirm
        }
      : importMode === MATCH_PACKAGE_IMPORT_MODES.SWAP
        ? {
            message: copy.matchPackageSwapMessage,
            label: copy.matchPackageSwapImpactLabel,
            fields: copy.matchPackageSwapImpact,
            confirm: copy.matchPackageSwapConfirm
          }
        : {
            message: copy.matchPackageReplaceMessage,
            label: copy.matchPackageReplaceImpactLabel,
            fields: copy.matchPackageReplaceImpact,
            confirm: copy.matchPackageReplaceConfirm
          }
    const previewTeams = [
      { side: copy.matchPackageSideA, team: matchPackage.teams.teamA },
      { side: copy.matchPackageSideB, team: matchPackage.teams.teamB }
    ]

    setAppDialog({
      kicker: copy.matchPackage,
      title: copy.matchPackagePreviewTitle,
      message: impact.message,
      wide: true,
      children: (
        <div className={styles.matchPackagePreview}>
          {previewTeams.map(({ side, team }) => (
            <article key={side}>
              <div className={styles.matchPackagePreviewMark} style={{ '--match-team-color': team.primaryColor || 'var(--theme-primary)' }}>
                {team.logo
                  ? <img src={team.logo} alt="" />
                  : <strong>{String(team.shortName || team.name || side).slice(0, 3)}</strong>}
              </div>
              <div>
                <span>{side}</span>
                <strong>{team.name}</strong>
                <em>{team.shortName} / {copy.matchPackagePlayers(team.players.length)}</em>
                <div className={styles.matchPackagePreviewRoster}>
                  <span>{copy.matchPackageRoster}</span>
                  <div>
                    {team.players.slice(0, 5).map((player, index) => (
                      <small key={`${player.id}-${index}`}>{player.name}</small>
                    ))}
                  </div>
                  <em className={team.players.length >= 5 ? styles.matchPackageLineupReady : styles.matchPackageLineupWarning}>
                    {team.players.length >= 5
                      ? copy.matchPackageLineupReady
                      : copy.matchPackageLineupShort(team.players.length)}
                  </em>
                </div>
              </div>
            </article>
          ))}
          <div
            className={`${styles.matchPackagePreservedState} ${
              importMode === MATCH_PACKAGE_IMPORT_MODES.REPLACE ? styles.matchPackageResetState : ''
            }`}
          >
            <span>{impact.label}</span>
            <strong>{impact.fields}</strong>
          </div>
        </div>
      ),
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: impact.confirm,
          tone: 'primary',
          onClick: () => applyPastedMatchPackage(matchPackage, importMode)
        }
      ]
    })
  }

  const showMatchPackageTextImport = (
    initialText = '',
    message = copy.matchPackagePasteMessage
  ) => {
    setAppDialog({
      kicker: copy.matchPackage,
      title: copy.matchPackagePasteTitle,
      message,
      wide: true,
      children: (
        <div className={styles.matchPackagePasteEditor}>
          <textarea
            key={`${message}-${initialText.length}`}
            ref={matchPackageTextRef}
            defaultValue={initialText}
            aria-label={copy.matchPackagePasteTitle}
            placeholder={copy.matchPackagePastePlaceholder}
            spellCheck={false}
          />
          <div>
            <span>{copy.matchPackageExpectedFormat}</span>
            <strong>{MATCH_PACKAGE_SCHEMA_VERSION}</strong>
          </div>
        </div>
      ),
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: copy.matchPackagePreview,
          tone: 'primary',
          onClick: () => {
            const text = matchPackageTextRef.current?.value || ''
            try {
              showMatchPackagePreview(parseMatchPackage(text))
            } catch (error) {
              showMatchPackageTextImport(text, getMatchPackageErrorMessage(copy, error))
            }
          }
        }
      ]
    })
  }

  const handlePasteMatchPackage = async () => {
    let text = ''
    let clipboardDenied = false
    setMatchPackageNotice(null)
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard unavailable')
      text = await navigator.clipboard.readText()
    } catch {
      // OBS browser docks can deny clipboard reads; the manual paste dialog remains available.
      clipboardDenied = true
    }

    if (!text.trim()) {
      showMatchPackageTextImport('', clipboardDenied ? copy.matchPackageClipboardDenied : copy.matchPackageClipboardEmpty)
      return
    }

    try {
      showMatchPackagePreview(parseMatchPackage(text))
    } catch (error) {
      showMatchPackageTextImport(text, getMatchPackageErrorMessage(copy, error))
    }
  }

  const handleExportProject = () => {
    setAppDialog({
      kicker: copy.project,
      title: copy.exportProject,
      message: copy.exportProjectFormatPrompt,
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: copy.projectJsonFile,
          onClick: () => {
            setAppDialog(null)
            exportProjectAsJson(project)
          }
        },
        {
          label: copy.projectPlainText,
          tone: 'primary',
          onClick: () => showProjectTextExport(stringifyProject(project))
        }
      ]
    })
  }

  const handleImportProjectChoice = () => {
    setAppDialog({
      kicker: copy.project,
      title: copy.importProject,
      message: copy.importProjectFormatPrompt,
      actions: [
        { label: copy.cancel, onClick: () => setAppDialog(null) },
        {
          label: copy.projectJsonFile,
          onClick: () => {
            setAppDialog(null)
            importInputRef.current?.click()
          }
        },
        {
          label: copy.projectPlainText,
          tone: 'primary',
          onClick: () => showProjectTextImport()
        }
      ]
    })
  }

  useEffect(() => {
    hotkeyActionsRef.current = {
      take: takePreviewToProgram,
      undo: undoLastAction,
      swapTeams: swapMatchSides,
      resetScore,
      toolbox: openToolbox,
      setup: openSetup,
      settings: openSettings
    }
  })

  useEffect(() => {
    if (consoleScreen !== 'workspace' || !consoleSettings.hotkeysEnabled) return undefined

    const handleKeyDown = event => {
      if (document.body.dataset.owbtRecordingHotkey === 'true') return
      if (consoleSettings.disableHotkeysInInputs && isTypingTarget(event.target)) return

      const hotkey = normalizeHotkeyText(getHotkeyFromEvent(event))
      const commandId = HOTKEY_COMMANDS.find(command => (
        normalizeHotkeyText(consoleSettings.hotkeys?.[command.id]) === hotkey
      ))?.id
      const command = hotkeyActionsRef.current[commandId]
      if (!command) return

      event.preventDefault()
      command()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    consoleScreen,
    consoleSettings.disableHotkeysInInputs,
    consoleSettings.hotkeys,
    consoleSettings.hotkeysEnabled
  ])

  if (consoleScreen === 'intro') {
    return (
      <IntroSplash
        project={project}
        languageOverride={consoleSettings.interfaceLanguage}
        duration={project.event?.startupMotion === 'reduced' ? 650 : 1450}
        onFinish={() => setConsoleScreen(route === APP_ROUTES.LIBRARY ? 'library' : 'entry')}
      />
    )
  }

  if (consoleScreen === 'entry') {
    return (
      <ConsoleEntry
        project={project}
        activeSection={entrySection}
        consoleLanguage={language}
        consoleSettingsPanel={(
          <ConsoleSettingsWorkspace
            copy={copy}
            language={language}
            settings={consoleSettings}
            onLanguageChange={updateConsoleLanguage}
            onReset={resetConsoleSettings}
            onUpdate={updateConsoleSettings}
          />
        )}
        onSectionChange={setEntrySection}
        onUpdateConsoleLanguage={updateConsoleLanguage}
        onUpdateProject={updateProject}
        onOpenTeamLibrary={() => openTeamLibrary('entry')}
        onEnterConsole={enterWorkspace}
      />
    )
  }

  if (consoleScreen === 'library') {
    return (
      <LibraryLoadBoundary language={language} onBack={closeTeamLibrary}>
        <Suspense fallback={<LibraryLoadState language={language} />}>
          <TeamLibraryPage
            project={project}
            language={language}
            onBack={closeTeamLibrary}
            onRouteBlockerChange={onRouteBlockerChange}
            onUpdateProject={updateProject}
          />
        </Suspense>
      </LibraryLoadBoundary>
    )
  }

  return (
    <div className={`${styles.app} ${controlMode ? styles.controlApp : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <img src="/OWBT.svg" alt="OWBT" />
          </div>
          <div className={styles.brandText}>
            <h1>Broadcast Toolkit</h1>
            <p className={styles.brandSubtitle}>{copy.brandSubtitle}</p>
            <p className={styles.brandCredit}>
              <span>Designed by</span>
              <strong>{copy.brandCredit}</strong>
            </p>
          </div>
        </div>

        <section className={`${styles.panel} ${styles.scenePanel}`}>
          <div className={styles.panelTitle}>{copy.scenes}</div>
          <div className={styles.sceneList}>
            {CONSOLE_SELECTOR_ITEMS.map(item => {
              if (item.type === 'scene') {
                const scene = item.scene
                const isPreview = scene.id === previewScene.id
                const isProgram = scene.id === programScene.id
                const isEditing = scene.id === editorScene.id

                return (
                  <button
                    key={scene.id}
                    className={[
                      styles.sceneBtn,
                      isEditing ? styles.editing : '',
                      isPreview ? styles.previewing : '',
                      isProgram ? styles.onAir : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => selectPreviewScene(scene)}
                  >
                    <span>{getSceneName(scene, language)}</span>
                    <em>{getSelectorSceneMeta(scene, language, project, sceneModeHints)}</em>
                    {isProgram && <strong>{copy.programBadge}</strong>}
                  </button>
                )
              }

              const bundlePreviewScene = item.scenes.find(scene => scene.id === previewScene.id)
              const bundleProgramScene = item.scenes.find(scene => scene.id === programScene.id)
              const fallbackScene = item.scenes.find(scene => scene.id === item.defaultSceneId) || item.scenes[0]
              const activeBundleScene = bundlePreviewScene || bundleProgramScene || fallbackScene
              const bundleHasPreview = Boolean(bundlePreviewScene)
              const bundleHasProgram = Boolean(bundleProgramScene)

              return (
                <div className={styles.sceneBundle} key={item.id}>
                  <button
                    className={[
                      styles.sceneBundleButton,
                      bundleHasPreview ? styles.previewing : '',
                      bundleHasProgram ? styles.onAir : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => selectPreviewScene(activeBundleScene)}
                    type="button"
                  >
                    <span>{getBundleLabel(item, language)}</span>
                    <em>{activeBundleScene ? getSceneName(activeBundleScene, language) : getBundleDescription(item, language)}</em>
                    {bundleHasProgram && <strong>{copy.programBadge}</strong>}
                  </button>

                </div>
              )
            })}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.workspaceDock}`} aria-label={copy.workspaceDock}>
          <div className={styles.workspaceDockTitle}>{copy.workspaceDock}</div>
          <div className={styles.workspaceDockActions}>
            <button type="button" onClick={openSetup}>
              <span>{copy.setupDock}</span>
              <em>{copy.setupDockMeta}</em>
            </button>
            <button type="button" onClick={() => openTeamLibrary('workspace')}>
              <span>{copy.assetLibraryDock}</span>
              <em>{copy.assetLibraryDockMeta}</em>
            </button>
            <button
              type="button"
              className={workspaceMode === 'toolbox' ? styles.activeDockButton : ''}
              onClick={openToolbox}
            >
              <span>{copy.toolbox}</span>
              <em>{copy.toolboxDockMeta}</em>
            </button>
          </div>
        </section>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.kicker}>OWBT CONSOLE</div>
            <h2>{competitionName}</h2>
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryAction} onClick={handlePasteMatchPackage}>{copy.pasteMatchPackage}</button>
            <button className={styles.primaryAction} onClick={copyOverlayUrl}>{copy.copyOverlayUrl}</button>
            <button className={styles.projectFileAction} onClick={handleExportProject}>{copy.exportProject}</button>
            <button className={styles.projectFileAction} onClick={handleImportProjectChoice}>{copy.importProject}</button>
            <button className={`${styles.dangerAction} ${styles.projectFileAction}`} onClick={handleResetProject}>{copy.resetProject}</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImportProject}
            />
          </div>
        </header>

        {matchPackageNotice && (
          <section className={styles.consoleNotice} role="status">
            <div>
              <span>{copy.matchPackage}</span>
              <strong>{matchPackageNotice.title}</strong>
              <em>{matchPackageNotice.message}</em>
            </div>
            <button type="button" aria-label={copy.dismissNotice} onClick={() => setMatchPackageNotice(null)}>×</button>
          </section>
        )}

        <section className={styles.statusGrid}>
          <div className={styles.statBox}>
            <span>{copy.programScene}</span>
            <strong>{getSceneName(programScene, language)}</strong>
          </div>
          <div className={styles.statBox}>
            <span>{copy.previewScene}</span>
            <strong>{getSceneName(previewScene, language)}</strong>
          </div>
          <div className={styles.statBox}>
            <span>{copy.ft}</span>
            <strong>FT{project.currentMatch.ft}</strong>
          </div>
          <div className={styles.statBox}>
            <span>{copy.map}</span>
            <strong>{currentMapLabel}</strong>
          </div>
          <div className={styles.statBox}>
            <span>{copy.status}</span>
            <strong>{statusOptions.find(option => option.value === project.currentMatch.status)?.label || project.currentMatch.status}</strong>
          </div>
          <div className={styles.statBox}>
            <span>{copy.score}</span>
            <strong>{project.currentMatch.score.teamA} : {project.currentMatch.score.teamB}</strong>
          </div>
          {showRightRailControls && (
            <button
              type="button"
              className={`${styles.statBox} ${styles.statusRailToggle}`}
              aria-controls="console-right-rail"
              aria-expanded={!rightRailCollapsed}
              onClick={() => setRightRailCollapsed(prev => !prev)}
            >
              <span>{language === 'zh' ? '控制栏' : 'Control Rail'}</span>
              <strong>{getRailToggleLabel(!rightRailCollapsed, language)}</strong>
            </button>
          )}
        </section>

        {workspaceMode === 'toolbox' ? (
          <ToolboxWorkspace
            project={project}
            language={language}
            programScene={programScene}
            onUpdateProject={updateProject}
          />
        ) : (
          <section className={`${styles.consoleBody} ${rightRailCollapsed ? styles.consoleBodyRailCollapsed : ''}`}>
            <div className={styles.productionColumn}>
              <section className={styles.monitorGrid}>
                <div className={styles.monitor}>
                  <div className={styles.monitorHeader}>
                    <span>{copy.preview}</span>
                    <strong>{getSceneName(previewScene, language)}</strong>
                  </div>
                  <ProgramPreview
                    project={previewProject}
                    transitionMode={consoleSettings.sceneTransitionMode}
                    transitionSpeed={consoleSettings.sceneTransitionSpeed}
                    transitionLogo={consoleSettings.sceneTransitionLogo}
                  />
                </div>

                <div className={`${styles.monitor} ${styles.programMonitor}`}>
                  <div className={styles.monitorHeader}>
                    <span>{copy.program}</span>
                    <strong>{getSceneName(programScene, language)}</strong>
                  </div>
                  <ProgramPreview
                    project={programProject}
                    transitionMode={consoleSettings.sceneTransitionMode}
                    transitionSpeed={consoleSettings.sceneTransitionSpeed}
                    transitionLogo={consoleSettings.sceneTransitionLogo}
                  />
                </div>
              </section>

              <SceneEditor
                project={project}
                scene={editorScene}
                copy={copy}
                language={language}
                statusOptions={statusOptions}
                onUpdateProject={updateProject}
                onSelectScene={sceneId => selectPreviewScene(SCENE_REGISTRY.find(scene => scene.id === sceneId) || previewScene)}
                onAutoTakeScene={(sceneId, options) => autoTakeProgramScene(SCENE_REGISTRY.find(scene => scene.id === sceneId) || previewScene, options)}
                onTakeToProgram={takePreviewToProgram}
                sceneModeHints={sceneModeHints}
                onSceneModeHintChange={updateSceneModeHint}
                controlMode={controlMode}
                canTakeToProgram
              />
            </div>

            {!rightRailCollapsed && (
              <aside className={styles.rightRail} id="console-right-rail">
                <RailPanel title={copy.quickActions}>
                  <div className={styles.quickActionGrid}>
                    <button onClick={swapMatchSides}>{copy.swapSides}</button>
                    <button disabled={!undoStack.length} onClick={undoLastAction}>{copy.undoAction}</button>
                    <button onClick={resetScore}>{copy.resetScore}</button>
                  </div>
                </RailPanel>

                <RailPanel title={copy.realTimeStatus}>
                  <div className={styles.infoGrid}>
                    <span>{copy.program}</span>
                    <strong>{getSceneName(programScene, language)}</strong>
                    <span>{copy.preview}</span>
                    <strong>{getSceneName(previewScene, language)}</strong>
                    <span>{copy.status}</span>
                    <strong>{statusOptions.find(option => option.value === project.currentMatch.status)?.label || project.currentMatch.status}</strong>
                    <span>{copy.map}</span>
                    <strong>{currentMapLabel}</strong>
                    <span>{copy.score}</span>
                    <strong>{project.currentMatch.score.teamA} : {project.currentMatch.score.teamB}</strong>
                  </div>
                </RailPanel>

                <RailPanel title={copy.operationLog}>
                  <div className={styles.logList}>
                    {operationLog.length === 0 ? (
                      <div className={styles.emptyLog}>{copy.noLog}</div>
                    ) : operationLog.map(item => (
                      <div className={styles.logItem} key={item.id}>
                        <span>{item.time}</span>
                        <strong>{item.message}</strong>
                      </div>
                    ))}
                  </div>
                </RailPanel>
              </aside>
            )}
          </section>
        )}
      </main>
      {appDialog && <EditorDialog {...appDialog} />}
    </div>
  )
}

function ConsoleSettingsWorkspace({ copy, language, settings, onLanguageChange, onReset, onUpdate }) {
  const [recordingCommandId, setRecordingCommandId] = useState('')
  const [copiedAddress, setCopiedAddress] = useState('')
  const hotkeyConflicts = useMemo(() => getHotkeyConflicts(settings.hotkeys), [settings.hotkeys])
  const surfaceBaseUrl = typeof window === 'undefined'
    ? ''
    : `${window.location.origin}${window.location.pathname}${window.location.search}`
  const surfaceAddresses = {
    library: `${surfaceBaseUrl}#library`,
    control: `${surfaceBaseUrl}#control`
  }
  const hotkeyRows = HOTKEY_COMMANDS.map(command => ({
    ...command,
    keys: settings.hotkeys?.[command.id] || command.defaultKeys,
    isConflict: hotkeyConflicts.has(command.id),
    label: copy[command.labelKey] || command.labelKey
  }))
  const startWorkspaceLabels = {
    production: copy.startWorkspaceProduction,
    toolbox: copy.startWorkspaceToolbox
  }
  const transitionModeLabels = {
    none: copy.transitionNone,
    cut: copy.transitionNone,
    simple: copy.transitionSimple,
    scan: copy.transitionScan
  }
  const transitionSpeedLabels = {
    fast: copy.transitionFast,
    normal: copy.transitionNormal,
    slow: copy.transitionSlow
  }
  const transitionLogoLabels = {
    off: copy.transitionLogoOff,
    event: copy.transitionLogoEvent,
    ow: copy.transitionLogoOw
  }
  const languageLabels = {
    zh: copy.zhShort,
    en: copy.enShort
  }

  useEffect(() => {
    if (!recordingCommandId) return undefined

    document.body.dataset.owbtRecordingHotkey = 'true'

    const handleKeyDown = event => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecordingCommandId('')
        return
      }

      const nextHotkey = normalizeHotkeyText(getHotkeyFromEvent(event))
      if (!nextHotkey) return

      onUpdate({
        hotkeys: {
          ...settings.hotkeys,
          [recordingCommandId]: nextHotkey
        }
      })
      setRecordingCommandId('')
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      if (document.body.dataset.owbtRecordingHotkey === 'true') delete document.body.dataset.owbtRecordingHotkey
    }
  }, [onUpdate, recordingCommandId, settings.hotkeys])

  const resetHotkey = command => {
    onUpdate({
      hotkeys: {
        ...settings.hotkeys,
        [command.id]: command.defaultKeys
      }
    })
  }

  const copySurfaceAddress = async addressId => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(surfaceAddresses[addressId])
      setCopiedAddress(addressId)
    } catch {
      setCopiedAddress('fallback')
    }
  }

  return (
    <section className={styles.consoleSettings}>
      <section className={`${styles.panel} ${styles.settingsOverview}`}>
        <div className={styles.panelTitle}>{copy.consoleSettings}</div>
        <div className={styles.settingsStatusGrid}>
          <div>
            <span>{copy.settingInterfaceLanguage}</span>
            <strong>{languageLabels[language] || language}</strong>
          </div>
          <div>
            <span>{copy.settingHotkeys}</span>
            <strong>{settings.hotkeysEnabled ? copy.settingOn : copy.settingOff}</strong>
          </div>
          <div>
            <span>{copy.settingStartWorkspace}</span>
            <strong>{startWorkspaceLabels[settings.startWorkspaceMode] || settings.startWorkspaceMode}</strong>
          </div>
          <div>
            <span>{copy.settingLogRows}</span>
            <strong>{settings.operationLogLimit}</strong>
          </div>
          <div>
            <span>{copy.settingSceneTransition}</span>
            <strong>{transitionModeLabels[settings.sceneTransitionMode] || settings.sceneTransitionMode}</strong>
          </div>
        </div>
        <div className={styles.settingsRuntimeGrid}>
          <div>
            <span>{copy.settingWebRuntime}</span>
            <strong>{copy.settingWebRuntimeMeta}</strong>
          </div>
          <div>
            <span>{copy.settingDesktopRuntime}</span>
            <strong>{copy.settingDesktopRuntimeMeta}</strong>
          </div>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.settingsAccessPanel}`}>
        <div className={styles.panelTitle}>{copy.settingAccessAddresses}</div>
        <p>{copy.settingAccessMeta}</p>
        <div className={styles.settingsAddressGrid}>
          {[
            { id: 'library', label: copy.settingLibraryAddress },
            { id: 'control', label: copy.settingControlAddress }
          ].map(address => (
            <label className={styles.settingsAddressRow} key={address.id}>
              <span>{address.label}</span>
              <input value={surfaceAddresses[address.id]} readOnly onFocus={event => event.target.select()} />
              <button type="button" onClick={() => copySurfaceAddress(address.id)}>
                {copiedAddress === address.id ? copy.settingAddressCopied : copy.copyAddress}
              </button>
            </label>
          ))}
        </div>
        {copiedAddress === 'fallback' && <em className={styles.settingsAddressFallback}>{copy.settingCopyFallback}</em>}
      </section>

      <section className={styles.settingsGridPanel}>
        <div className={`${styles.panel} ${styles.settingsPanel}`}>
          <div className={styles.panelTitle}>{copy.settingControls}</div>
          <div className={styles.settingsControlGrid}>
            <button
              type="button"
              className={`${styles.settingToggle} ${settings.hotkeysEnabled ? styles.settingToggleActive : ''}`}
              onClick={() => onUpdate({ hotkeysEnabled: !settings.hotkeysEnabled })}
            >
              <span>{copy.settingHotkeys}</span>
              <strong>{settings.hotkeysEnabled ? copy.settingOn : copy.settingOff}</strong>
            </button>
            <button
              type="button"
              className={`${styles.settingToggle} ${settings.disableHotkeysInInputs ? styles.settingToggleActive : ''}`}
              onClick={() => onUpdate({ disableHotkeysInInputs: !settings.disableHotkeysInInputs })}
            >
              <span>{copy.settingDisableInputs}</span>
              <strong>{settings.disableHotkeysInInputs ? copy.settingOn : copy.settingOff}</strong>
            </button>
            <button
              type="button"
              className={`${styles.settingToggle} ${settings.confirmDangerActions ? styles.settingToggleActive : ''}`}
              onClick={() => onUpdate({ confirmDangerActions: !settings.confirmDangerActions })}
            >
              <span>{copy.settingConfirmDanger}</span>
              <strong>{settings.confirmDangerActions ? copy.settingOn : copy.settingOff}</strong>
            </button>
          </div>

          <div className={styles.settingsFieldStack}>
            <div className={styles.settingsGroupLabel}>{copy.settingGlobalPreferences}</div>
            <div className={styles.settingsFieldRow}>
              <label className={styles.field}>
                <span>{copy.settingInterfaceLanguage}</span>
                <select
                  value={language}
                  onChange={event => onLanguageChange(event.target.value)}
                >
                  <option value="zh">{copy.zhShort}</option>
                  <option value="en">{copy.enShort}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.settingStartWorkspace}</span>
                <select
                  value={settings.startWorkspaceMode}
                  onChange={event => onUpdate({ startWorkspaceMode: event.target.value })}
                >
                  <option value="production">{copy.startWorkspaceProduction}</option>
                  <option value="toolbox">{copy.startWorkspaceToolbox}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.settingLogRows}</span>
                <select
                  value={settings.operationLogLimit}
                  onChange={event => onUpdate({ operationLogLimit: event.target.value })}
                >
                  {[4, 6, 8, 12].map(limit => (
                    <option key={limit} value={limit}>{limit}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.settingsGroupLabel}>{copy.settingTransitionPreferences}</div>
            <div className={styles.settingsFieldRow}>
              <label className={styles.field}>
                <span>{copy.settingSceneTransition}</span>
                <select
                  value={settings.sceneTransitionMode}
                  onChange={event => onUpdate({ sceneTransitionMode: event.target.value })}
                >
                  <option value="none">{copy.transitionNone}</option>
                  <option value="simple">{copy.transitionSimple}</option>
                  <option value="scan">{copy.transitionScan}</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.settingTransitionSpeed}</span>
                <select
                  value={settings.sceneTransitionSpeed}
                  onChange={event => onUpdate({ sceneTransitionSpeed: event.target.value })}
                >
                  {['fast', 'normal', 'slow'].map(speed => (
                    <option key={speed} value={speed}>{transitionSpeedLabels[speed]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>{copy.settingTransitionLogo}</span>
                <select
                  value={settings.sceneTransitionLogo}
                  onChange={event => onUpdate({ sceneTransitionLogo: event.target.value })}
                >
                  {['off', 'event', 'ow'].map(logo => (
                    <option key={logo} value={logo}>{transitionLogoLabels[logo]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button type="button" className={styles.settingsResetButton} onClick={onReset}>
            {copy.settingReset}
          </button>
        </div>

        <div className={`${styles.panel} ${styles.settingsPanel}`}>
          <div className={styles.panelTitle}>{copy.settingHotkeyMap}</div>
          <div className={styles.hotkeyList}>
            {hotkeyRows.map(row => (
              <div
                className={[
                  styles.hotkeyRow,
                  row.isConflict ? styles.hotkeyRowConflict : ''
                ].filter(Boolean).join(' ')}
                key={row.id}
              >
                <span>{recordingCommandId === row.id ? copy.hotkeyRecording : row.keys}</span>
                <strong>
                  {row.label}
                  {row.isConflict && <em>{copy.hotkeyConflict}</em>}
                </strong>
                <button type="button" onClick={() => setRecordingCommandId(row.id)}>
                  {recordingCommandId === row.id ? copy.hotkeyRecording : copy.hotkeyRecord}
                </button>
                <button type="button" onClick={() => resetHotkey(row)}>
                  {copy.hotkeyReset}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.settingsPanel} ${styles.desktopSettingsPanel}`}>
          <div className={styles.panelTitle}>{copy.settingDesktopOnly}</div>
          <div className={styles.desktopOnlyHeader}>
            <p>{copy.settingDesktopMeta}</p>
            <strong>{copy.settingDesktopLocked}</strong>
          </div>
          <div className={styles.settingsDesktopGrid}>
            <label className={`${styles.field} ${styles.desktopOnlyField}`}>
              <span>{copy.settingAssetRoot}</span>
              <input value={settings.desktopAssetRoot} placeholder="C:\\OWBT\\Assets" disabled readOnly />
            </label>
            <label className={`${styles.field} ${styles.desktopOnlyField}`}>
              <span>{copy.settingExportDirectory}</span>
              <input value={settings.desktopExportDirectory} placeholder="C:\\OWBT\\Exports" disabled readOnly />
            </label>
            <label className={`${styles.field} ${styles.desktopOnlyField}`}>
              <span>{copy.settingObsScenePath}</span>
              <input value={settings.desktopObsScenePath} placeholder="C:\\OWBT\\Scenes\\owbt.json" disabled readOnly />
            </label>
          </div>
        </div>
      </section>
    </section>
  )
}
