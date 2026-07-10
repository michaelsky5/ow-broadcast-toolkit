export const FT_OPTIONS = [
  { value: 1, label: 'FT1', maps: 'FT1' },
  { value: 2, label: 'FT2', maps: 'FT2' },
  { value: 3, label: 'FT3', maps: 'FT3' },
  { value: 4, label: 'FT4', maps: 'FT4' }
]

export const MATCH_STATUS_OPTIONS = [
  { value: 'pending', label: '未开始', enLabel: 'Pending' },
  { value: 'live', label: '进行中', enLabel: 'Live' },
  { value: 'pause', label: '暂停', enLabel: 'Paused' },
  { value: 'break', label: '中场休息', enLabel: 'Break' },
  { value: 'finished', label: '已结束', enLabel: 'Finished' }
]

export const SIDE_OPTIONS = [
  { value: 'none', label: '无', enLabel: 'None' },
  { value: 'attack', label: '进攻', enLabel: 'Attack' },
  { value: 'defense', label: '防守', enLabel: 'Defense' }
]

export const createDefaultMatch = () => ({
  id: 'match-default',
  name: 'Showmatch',
  stage: 'Regular Season',
  ft: 3,
  status: 'pending',

  teamAId: 'team-a',
  teamBId: 'team-b',

  score: {
    teamA: 0,
    teamB: 0
  },

  currentMapId: 'ilios',
  currentMapIndex: 1,
  currentRoundLabel: 'MAP 1',
  mapLineup: [
    { mapId: 'ilios', type: 'control', name: 'Ilios', picker: '', winner: '', winnerSide: '', attackSide: '' },
    { mapId: 'kings-row', type: 'hybrid', name: "King's Row", picker: '', winner: '', winnerSide: '', attackSide: 'A' },
    { mapId: 'dorado', type: 'escort', name: 'Dorado', picker: '', winner: '', winnerSide: '', attackSide: 'B' },
    { mapId: 'colosseo', type: 'push', name: 'Colosseo', picker: '', winner: '', winnerSide: '', attackSide: '' },
    { mapId: 'suravasa', type: 'flashpoint', name: 'Suravasa', picker: '', winner: '', winnerSide: '', attackSide: '' }
  ],

  side: {
    teamA: 'none',
    teamB: 'none'
  },

  bansA: [],
  bansB: [],
  banOrderMode: 'A_FIRST',

  startingFive: {
    teamA: [],
    teamB: []
  },

  substitutes: {
    teamA: [],
    teamB: []
  },

  casters: [],

  hud: {
    visible: true,
    uiMode: 'NORMAL',
    hudMarginTop: 0,
    topEventLogoVisible: true,
    topEventLogo: '',
    topEventTitle: '',
    topMatchFormatVisible: true,
    topMatchFormatLabel: '',
    topSponsorVisible: false,
    eventLogoBg: '#2A2A2A',
    teamLogoBgA: '#2A2A2A',
    teamLogoBgB: '#2A2A2A',
    teamNameFontSize: 20,
    playerNameFontSize: 12,
    teamMetaMode: 'HIDDEN',
    teamRecordA: '',
    teamRecordB: '',
    teamRecordAW: '',
    teamRecordAL: '',
    teamRecordBW: '',
    teamRecordBL: '',
    teamSeedA: '',
    teamSeedB: '',
    teamMetaA: '',
    teamMetaB: '',
    showMap: true,
    showFt: true,
    showStage: true,
    showPlayers: true,
    compact: false,
    beginInfoEnabled: false,
    autoBeginTriggerAt: 0,
    keyPlayerTriggerAt: 0,
    keyPlayerSide: 'A',
    keyPlayerName: '',
    showBans: false,
    showBanPhase: false,
    heroBanTriggerAt: 0,
    activeComms: '',
    subIndexA: -1,
    subIndexB: -1,
    showTicker: false,
    tickerMode: 'ONCE',
    tickerText: ''
  },

  pause: {
    visible: false,
    title: 'TECHNICAL PAUSE',
    description: '比赛暂停中，请稍候。'
  },

  notice: {
    visible: false,
    title: 'NOTICE',
    text: ''
  },

  result: {
    winnerTeamId: '',
    mvpPlayerId: '',
    note: ''
  }
})
