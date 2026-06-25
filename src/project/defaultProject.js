import { OW_DATA_VERSION } from '../data/overwatch'
import { applyFriesCupProjectDefaults } from '../editions/friesCup/defaultProject'
import { FRIES_CUP_CONFIG } from '../editions/friesCup/config'
import { createDefaultMatch } from '../match/defaultMatch'
import { DEFAULT_THEME } from '../theme/defaultTheme'
import { createDefaultCasters, createDefaultPlayers, createDefaultStaff, createDefaultTeams } from './defaults/defaultParticipants'
import { DEFAULT_SCENE_ORDER, createDefaultSceneSettings } from './defaults/defaultSceneSettings'

export const PROJECT_SCHEMA_VERSION = 'owbt-project-v0.1'

const createDefaultToolSettings = () => ({
  graphics: {
    cover: {
      useCurrentMatchData: true,
      eyebrow: 'LIVE BROADCAST',
      title: '',
      subtitle: '',
      stage: '',
      time: '',
      showTeams: true,
      titleScale: '',
      subtitleScale: '',
      teamShortScale: '',
      snapshot: null
    },
    matchup: {
      useCurrentMatchData: true,
      title: 'UP NEXT',
      stage: '',
      time: '',
      showFt: true,
      showMap: true,
      snapshot: null
    },
    result: {
      useCurrentMatchData: true,
      title: 'MATCH RESULT',
      winner: '',
      scoreTeamA: '',
      scoreTeamB: '',
      mvp: '',
      note: '',
      snapshot: null
    }
  }
})

const createDefaultAssetSettings = () => ({
  sponsors: {
    tickerText: '',
    videoAdUrl: '',
    videoAdName: '',
    videoAdType: '',
    logos: []
  }
})

export const createDefaultProject = () => applyFriesCupProjectDefaults({
  schemaVersion: PROJECT_SCHEMA_VERSION,

  meta: {
    id: 'fries-cup-project-default',
    name: 'FriesCup Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  event: {
    name: FRIES_CUP_CONFIG.brandName,
    nameZh: FRIES_CUP_CONFIG.brandName,
    nameEn: FRIES_CUP_CONFIG.brandName,
    subtitle: FRIES_CUP_CONFIG.editionName,
    logo: FRIES_CUP_CONFIG.defaultLogo,
    logoBackdrop: 'auto',
    organizerLogo: '',
    language: FRIES_CUP_CONFIG.defaultLocale,
    overlayLanguage: 'en',
    startupMotion: 'full',
    outputResolution: '1920x1080',
    transparentOverlay: true
  },

  theme: {
    ...DEFAULT_THEME
  },

  overwatch: {
    dataVersion: OW_DATA_VERSION
  },

  teams: createDefaultTeams(),
  players: createDefaultPlayers(),
  casters: createDefaultCasters(),
  staff: createDefaultStaff(),

  currentMatch: {
    ...createDefaultMatch(),
    startingFive: {
      teamA: ['a-dps-1', 'a-dps-2', 'a-tank', 'a-support-1', 'a-support-2'],
      teamB: ['b-dps-1', 'b-dps-2', 'b-tank', 'b-support-1', 'b-support-2']
    },
    casters: ['caster-1', 'caster-2']
  },

  scenes: {
    activeSceneId: 'countdown',
    enabledSceneIds: [...DEFAULT_SCENE_ORDER],
    order: [...DEFAULT_SCENE_ORDER],
    settings: createDefaultSceneSettings()
  },

  output: {
    width: 1920,
    height: 1080,
    scale: 1,
    transparent: true,
    overlayPath: '/overlay'
  },

  assets: {
    ...createDefaultAssetSettings()
  },

  tools: {
    ...createDefaultToolSettings()
  }
})
