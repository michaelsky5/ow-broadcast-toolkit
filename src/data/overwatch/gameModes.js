export const OW_GAME_MODES = [
  {
    id: 'control',
    key: 'CONTROL',
    zh: '占领要点',
    en: 'Control',
    assetKey: 'control',
    needsAttackDefense: false
  },
  {
    id: 'escort',
    key: 'ESCORT',
    zh: '运载目标',
    en: 'Escort',
    assetKey: 'escort',
    needsAttackDefense: true
  },
  {
    id: 'hybrid',
    key: 'HYBRID',
    zh: '攻击/护送',
    en: 'Hybrid',
    assetKey: 'hybrid',
    needsAttackDefense: true
  },
  {
    id: 'push',
    key: 'PUSH',
    zh: '机动推进',
    en: 'Push',
    assetKey: 'push',
    needsAttackDefense: false
  },
  {
    id: 'flashpoint',
    key: 'FLASHPOINT',
    zh: '闪点作战',
    en: 'Flashpoint',
    assetKey: 'flashpoint',
    needsAttackDefense: false
  },
  {
    id: 'clash',
    key: 'CLASH',
    zh: '交锋',
    en: 'Clash',
    assetKey: 'clash',
    assetExt: 'svg',
    needsAttackDefense: false
  }
]

export const OW_GAME_MODE_OPTIONS = OW_GAME_MODES.map(mode => ({
  value: mode.id,
  label: mode.zh,
  enLabel: mode.en
}))

export const OW_GAME_MODE_BY_ID = OW_GAME_MODES.reduce((acc, mode) => {
  acc[mode.id] = mode
  return acc
}, {})

export const needsAttackDefense = modeId => {
  const mode = OW_GAME_MODE_BY_ID[String(modeId || '').toLowerCase()]
  return Boolean(mode?.needsAttackDefense)
}
