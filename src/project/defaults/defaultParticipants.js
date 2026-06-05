export const createDefaultTeams = () => [
  {
    id: 'team-a',
    name: 'Team A',
    shortName: 'TMA',
    logo: '',
    primaryColor: '',
    description: '',
    coach: '',
    manager: '',
    playerIds: ['a-dps-1', 'a-dps-2', 'a-tank', 'a-support-1', 'a-support-2']
  },
  {
    id: 'team-b',
    name: 'Team B',
    shortName: 'TMB',
    logo: '',
    primaryColor: '',
    description: '',
    coach: '',
    manager: '',
    playerIds: ['b-dps-1', 'b-dps-2', 'b-tank', 'b-support-1', 'b-support-2']
  }
]

export const createDefaultPlayers = () => [
  {
    id: 'a-tank',
    name: 'A Tank',
    battleTag: '',
    role: 'tank',
    teamId: 'team-a',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['dva', 'winston', 'reinhardt']
  },
  {
    id: 'a-dps-1',
    name: 'A Damage 1',
    battleTag: '',
    role: 'damage',
    teamId: 'team-a',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['tracer', 'genji', 'cassidy']
  },
  {
    id: 'a-dps-2',
    name: 'A Damage 2',
    battleTag: '',
    role: 'damage',
    teamId: 'team-a',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['ashe', 'sojourn', 'widowmaker']
  },
  {
    id: 'a-support-1',
    name: 'A Support 1',
    battleTag: '',
    role: 'support',
    teamId: 'team-a',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['ana', 'kiriko', 'juno']
  },
  {
    id: 'a-support-2',
    name: 'A Support 2',
    battleTag: '',
    role: 'support',
    teamId: 'team-a',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['lucio', 'brigitte', 'mercy']
  },
  {
    id: 'b-tank',
    name: 'B Tank',
    battleTag: '',
    role: 'tank',
    teamId: 'team-b',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['doomfist', 'sigma', 'ramattra']
  },
  {
    id: 'b-dps-1',
    name: 'B Damage 1',
    battleTag: '',
    role: 'damage',
    teamId: 'team-b',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['tracer', 'sombra', 'venture']
  },
  {
    id: 'b-dps-2',
    name: 'B Damage 2',
    battleTag: '',
    role: 'damage',
    teamId: 'team-b',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['hanzo', 'echo', 'pharah']
  },
  {
    id: 'b-support-1',
    name: 'B Support 1',
    battleTag: '',
    role: 'support',
    teamId: 'team-b',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['ana', 'baptiste', 'illari']
  },
  {
    id: 'b-support-2',
    name: 'B Support 2',
    battleTag: '',
    role: 'support',
    teamId: 'team-b',
    avatar: '',
    portraitXPct: 50,
    primaryHeroes: ['lucio', 'zenyatta', 'lifeweaver']
  }
]

export const createDefaultCasters = () => [
  {
    id: 'caster-1',
    name: 'Caster One',
    title: 'Commentator',
    avatar: '',
    description: ''
  },
  {
    id: 'caster-2',
    name: 'Caster Two',
    title: 'Commentator',
    avatar: '',
    description: ''
  },
  {
    id: 'caster-3',
    name: 'Caster Three',
    title: 'Commentator',
    avatar: '',
    description: ''
  },
  {
    id: 'caster-4',
    name: 'Caster Four',
    title: 'Commentator',
    avatar: '',
    description: ''
  }
]

export const createDefaultStaff = () => [
  {
    id: 'staff-1',
    name: 'Producer',
    title: 'Producer',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-2',
    name: 'Observer',
    title: 'Observer',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-3',
    name: 'Director',
    title: 'Director',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-4',
    name: 'Admin',
    title: 'Admin',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-5',
    name: 'Replay',
    title: 'Replay',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-6',
    name: 'Graphics',
    title: 'Graphics',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-7',
    name: 'Tech',
    title: 'Technical Director',
    avatar: '',
    description: ''
  },
  {
    id: 'staff-8',
    name: 'Observer 2',
    title: 'Observer',
    avatar: '',
    description: ''
  }
]
