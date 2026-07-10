export const DEFAULT_SCENE_ORDER = [
  'live-hud',
  'current-map',
  'roster',
  'casters',
  'stats',
  'team-data',
  'mvp',
  'matchup',
  'starting-five',
  'result',
  'thanks',
  'countdown',
  'pause',
  'media'
]

export const createDefaultSceneSettings = () => ({
  opening: {
    title: '',
    subtitle: 'OVERWATCH COMMUNITY TOURNAMENT',
    competitionNameZh: '',
    competitionNameEn: '',
    statusLabel: 'STANDBY',
    showEventLogo: true
  },
  matchup: {
    title: 'UP NEXT',
    showStage: true,
    showFt: true,
    showMap: true,
    showSponsors: true
  },
  'starting-five': {
    title: 'STARTING FIVE',
    showHeroPool: true,
    startingLineupSide: '',
    startingLineupMode: 'LIST',
    startingLineupCalloutIndex: 0,
    startingLineupTriggerAt: 0
  },
  casters: {
    packageMode: 'CASTERS',
    title: 'BROADCAST TALENT',
    subtitle: 'CASTER DESK',
    showEventLogo: true,
    showSponsors: true,
    layoutMode: 'AUTO',
    showTitles: true,
    showSocial: true,
    showPortraits: true,
    showNumbers: true,
    showContext: true,
    staffSlotCapacity: 4,
    staffIds: ['staff-1', 'staff-2'],
    showContextScore: true,
    showContextMap: true,
    showContextBans: false,
    deskNote: {
      visible: false,
      note: 'MATCH DESK STANDBY'
    },
    interview: {
      visible: false,
      speakerMode: 'PLAYER',
      teamSide: 'A',
      playerSlot: '',
      title: 'POST-MATCH INTERVIEW',
      subtitle: 'VOICE INTERVIEW',
      status: 'VOICE CONNECTED',
      manualTeamName: '',
      manualSpeakerName: '',
      manualSpeakerRole: ''
    }
  },
  roster: {
    title: 'TEAM ROSTER',
    subtitle: 'OVERWATCH COMMUNITY TOURNAMENT',
    teamSide: 'A',
    activePlayerIds: {
      teamA: [],
      teamB: []
    },
    showManager: false,
    showCoach: false
  },
  stats: {
    title: 'TEAM COMPARISON',
    subtitle: 'MATCH DATA REPORT',
    note: 'MANUAL DATA BOARD',
    activeCategory: 'overall',
    statsDisplayMode: 'metrics',
    statsDataScope: 'current',
    activeSnapshotId: '',
    dataMinutes: 10,
    mapSnapshots: [],
    imageCrop: {
      xPct: 24,
      topPct: 18,
      bottomPct: 55.6,
      wPct: 52,
      hPct: 29.6
    },
    capture: {
      dataMinutes: 10,
      xPct: 49,
      topPct: 18.5,
      bottomPct: 55.5,
      wPct: 26.2,
      hPct: 28.5,
      timeXPct: 66.8,
      timeYPct: 13.8,
      timeWPct: 8.4,
      timeHPct: 3.8,
      playerXPct: 33.5,
      playerWPct: 9,
      timeText: '10',
      timeZone: '',
      threshold: 165,
      scale: 3,
      imageDataUrl: ''
    },
    ocrRows: {
      teamA: [],
      teamB: []
    },
    statsPlayerIds: {
      teamA: [],
      teamB: []
    },
    metrics: [
      { key: 'eliminations', category: 'overall', label: 'Eliminations', teamA: '0', teamB: '0', enabled: true },
      { key: 'assists', category: 'overall', label: 'Assists', teamA: '0', teamB: '0', enabled: true },
      { key: 'deaths', category: 'overall', label: 'Deaths', teamA: '0', teamB: '0', enabled: true },
      { key: 'damage', category: 'overall', label: 'Damage', teamA: '0', teamB: '0', enabled: true },
      { key: 'healing', category: 'overall', label: 'Healing', teamA: '0', teamB: '0', enabled: true },
      { key: 'mitigated', category: 'overall', label: 'Mitigated', teamA: '0', teamB: '0', enabled: true }
    ]
  },
  'current-map': {
    title: 'CURRENT MAP',
    showMode: true,
    displayMode: 'MATCH',
    mapMetaDisplayMode: 'RESULT',
    mapBanDisplayMode: 'HIDE',
    showOverviewCurrent: false
  },
  countdown: {
    displayMode: 'standby',
    eventNameLanguage: 'en',
    title: '',
    subtitle: 'OVERWATCH COMMUNITY TOURNAMENT',
    statusText: 'PLEASE STAND BY',
    finishedText: 'READY',
    durationSeconds: 600,
    targetTimestamp: 0,
    showEventLogo: true,
    showEventName: true,
    showStatus: true,
    showMatchCard: false,
    showSchedule: true,
    upcomingMatches: [],
    showSponsor: false,
    sponsorName: '',
    sponsorLogo: '',
    sponsorText: ''
  },
  media: {
    mode: 'HIGHLIGHT',
    title: '',
    highlightLabel: 'HIGHLIGHT',
    sourceUrl: '',
    sourceName: '',
    sourceType: '',
    activeVideoPath: '',
    videoLibrary: [],
    videoPlaylist: [],
    videoRenderMode: 'WEB',
    fitMode: 'cover',
    showHighlightLabel: true,
    autoPlay: true,
    loop: true,
    muted: true
  },
  teamData: {
    title: 'PLAYER DATA',
    subtitle: 'OVERWATCH COMMUNITY TOURNAMENT',
    teamSide: 'A',
    playerSlot: 0,
    compareTeamSide: 'B',
    compareSlot: 0,
    cardTag: 'STAR PLAYER',
    displayMode: 'spotlight',
    statView: 'per10',
    statsDataScope: 'current',
    heroOverrides: {
      A: {},
      B: {}
    }
  },
  mvp: {
    title: '',
    subtitle: 'OVERWATCH COMMUNITY TOURNAMENT',
    mvpType: 'match',
    teamSide: 'A',
    playerSlot: 0,
    heroOverride: '',
    statView: 'per10',
    statsDataScope: 'follow',
    note: 'CLUTCH PERFORMANCE',
    statKeys: ['eliminations', 'damage', 'healing']
  },
  'live-hud': {
    showTeamLogo: true,
    showMapName: true,
    showFt: true
  },
  pause: {
    title: 'TECHNICAL PAUSE',
    description: 'The match is paused. Please stand by.',
    statusLabel: 'STANDBY',
    showMatchFrame: true
  },
  result: {
    title: 'MATCH RESULT',
    showWinner: true
  },
  thanks: {
    title: 'THANKS FOR WATCHING',
    subtitle: 'SEE YOU NEXT MATCH',
    showSummary: true,
    showCredits: true
  }
})
