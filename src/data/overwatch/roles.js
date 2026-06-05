export const OW_ROLES = [
  {
    id: 'tank',
    key: 'TANK',
    zh: '坦克',
    en: 'Tank',
    shortZh: '坦克',
    shortEn: 'Tank',
    assetKey: 'tank'
  },
  {
    id: 'damage',
    key: 'DAMAGE',
    zh: '输出',
    en: 'Damage',
    shortZh: '输出',
    shortEn: 'Damage',
    assetKey: 'damage'
  },
  {
    id: 'support',
    key: 'SUPPORT',
    zh: '支援',
    en: 'Support',
    shortZh: '支援',
    shortEn: 'Support',
    assetKey: 'support'
  }
]

export const OW_ROLE_OPTIONS = OW_ROLES.map(role => ({
  value: role.id,
  label: role.zh,
  enLabel: role.en
}))

export const OW_ROLE_BY_ID = OW_ROLES.reduce((acc, role) => {
  acc[role.id] = role
  return acc
}, {})
