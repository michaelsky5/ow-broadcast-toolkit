import { getHeroIcon, getRosterHeroIcon } from './assetPaths'
import { OW_ROLE_BY_ID } from './roles'

export const OW_HEROES = [
  // Tank
  { id: 'domina', zh: '金驭', en: 'Domina', role: 'tank', assetKey: 'domina' },
  { id: 'doomfist', zh: '末日铁拳', en: 'Doomfist', role: 'tank', assetKey: 'doomfist' },
  { id: 'dva', zh: 'D.Va', en: 'D.Va', role: 'tank', assetKey: 'dva' },
  { id: 'hazard', zh: '骇灾', en: 'Hazard', role: 'tank', assetKey: 'hazard' },
  { id: 'junker-queen', zh: '渣客女王', en: 'Junker Queen', role: 'tank', assetKey: 'junker-queen' },
  { id: 'mauga', zh: '毛加', en: 'Mauga', role: 'tank', assetKey: 'mauga' },
  { id: 'orisa', zh: '奥丽莎', en: 'Orisa', role: 'tank', assetKey: 'orisa' },
  { id: 'ramattra', zh: '拉玛刹', en: 'Ramattra', role: 'tank', assetKey: 'ramattra' },
  { id: 'reinhardt', zh: '莱因哈特', en: 'Reinhardt', role: 'tank', assetKey: 'reinhardt' },
  { id: 'roadhog', zh: '路霸', en: 'Roadhog', role: 'tank', assetKey: 'roadhog' },
  { id: 'sigma', zh: '西格玛', en: 'Sigma', role: 'tank', assetKey: 'sigma' },
  { id: 'winston', zh: '温斯顿', en: 'Winston', role: 'tank', assetKey: 'winston' },
  { id: 'wrecking-ball', zh: '破坏球', en: 'Wrecking Ball', role: 'tank', assetKey: 'wrecking-ball' },
  { id: 'zarya', zh: '查莉娅', en: 'Zarya', role: 'tank', assetKey: 'zarya' },

  // Damage
  { id: 'anran', zh: '安然', en: 'Anran', role: 'damage', assetKey: 'anran' },
  { id: 'ashe', zh: '艾什', en: 'Ashe', role: 'damage', assetKey: 'ashe' },
  { id: 'bastion', zh: '堡垒', en: 'Bastion', role: 'damage', assetKey: 'bastion' },
  { id: 'cassidy', zh: '卡西迪', en: 'Cassidy', role: 'damage', assetKey: 'cassidy' },
  { id: 'echo', zh: '回声', en: 'Echo', role: 'damage', assetKey: 'echo' },
  { id: 'emre', zh: '埃姆雷', en: 'Emre', role: 'damage', assetKey: 'emre' },
  { id: 'freja', zh: '芙蕾雅', en: 'Freja', role: 'damage', assetKey: 'freja' },
  { id: 'genji', zh: '源氏', en: 'Genji', role: 'damage', assetKey: 'genji' },
  { id: 'hanzo', zh: '半藏', en: 'Hanzo', role: 'damage', assetKey: 'hanzo' },
  { id: 'junkrat', zh: '狂鼠', en: 'Junkrat', role: 'damage', assetKey: 'junkrat' },
  { id: 'mei', zh: '美', en: 'Mei', role: 'damage', assetKey: 'mei' },
  { id: 'pharah', zh: '法老之鹰', en: 'Pharah', role: 'damage', assetKey: 'pharah' },
  { id: 'reaper', zh: '死神', en: 'Reaper', role: 'damage', assetKey: 'reaper' },
  { id: 'sojourn', zh: '索杰恩', en: 'Sojourn', role: 'damage', assetKey: 'sojourn' },
  { id: 'soldier-76', zh: '士兵：76', en: 'Soldier: 76', role: 'damage', assetKey: 'soldier-76' },
  { id: 'sierra', zh: '西拉', en: 'Sierra', role: 'damage', assetKey: 'sierra' },
  { id: 'shion', zh: '死怨', en: 'Shion', role: 'damage', assetKey: 'shion' },
  { id: 'sombra', zh: '黑影', en: 'Sombra', role: 'damage', assetKey: 'sombra' },
  { id: 'symmetra', zh: '秩序之光', en: 'Symmetra', role: 'damage', assetKey: 'symmetra' },
  { id: 'torbjorn', zh: '托比昂', en: 'Torbjörn', role: 'damage', assetKey: 'torbjorn' },
  { id: 'tracer', zh: '猎空', en: 'Tracer', role: 'damage', assetKey: 'tracer' },
  { id: 'vendetta', zh: '斩仇', en: 'Vendetta', role: 'damage', assetKey: 'vendetta' },
  { id: 'venture', zh: '探奇', en: 'Venture', role: 'damage', assetKey: 'venture' },
  { id: 'widowmaker', zh: '黑百合', en: 'Widowmaker', role: 'damage', assetKey: 'widowmaker' },

  // Support
  { id: 'ana', zh: '安娜', en: 'Ana', role: 'support', assetKey: 'ana' },
  { id: 'baptiste', zh: '巴蒂斯特', en: 'Baptiste', role: 'support', assetKey: 'baptiste' },
  { id: 'brigitte', zh: '布丽吉塔', en: 'Brigitte', role: 'support', assetKey: 'brigitte' },
  { id: 'illari', zh: '伊拉锐', en: 'Illari', role: 'support', assetKey: 'illari' },
  { id: 'jetpack-cat', zh: '飞天猫', en: 'Jetpack Cat', role: 'support', assetKey: 'jetpack-cat' },
  { id: 'juno', zh: '朱诺', en: 'Juno', role: 'support', assetKey: 'juno' },
  { id: 'kiriko', zh: '雾子', en: 'Kiriko', role: 'support', assetKey: 'kiriko' },
  { id: 'lifeweaver', zh: '生命之梭', en: 'Lifeweaver', role: 'support', assetKey: 'lifeweaver' },
  { id: 'lucio', zh: '卢西奥', en: 'Lúcio', role: 'support', assetKey: 'lucio' },
  { id: 'mercy', zh: '天使', en: 'Mercy', role: 'support', assetKey: 'mercy' },
  { id: 'mizuki', zh: '瑞稀', en: 'Mizuki', role: 'support', assetKey: 'mizuki' },
  { id: 'moira', zh: '莫伊拉', en: 'Moira', role: 'support', assetKey: 'moira' },
  { id: 'wuyang', zh: '无漾', en: 'Wuyang', role: 'support', assetKey: 'wuyang' },
  { id: 'zenyatta', zh: '禅雅塔', en: 'Zenyatta', role: 'support', assetKey: 'zenyatta' }
]

export const OW_HERO_OPTIONS = OW_HEROES.map(hero => {
  const role = OW_ROLE_BY_ID[hero.role]

  return {
    ...hero,
    roleZh: role?.zh || hero.role,
    roleEn: role?.en || hero.role,
    icon: getHeroIcon(hero.role, hero.assetKey),
    rosterIcon: getRosterHeroIcon(hero.role, hero.assetKey)
  }
})

export const OW_HERO_BY_ID = OW_HERO_OPTIONS.reduce((acc, hero) => {
  acc[hero.id] = hero
  return acc
}, {})

export const OW_HEROES_BY_ROLE = OW_HERO_OPTIONS.reduce((acc, hero) => {
  if (!acc[hero.role]) acc[hero.role] = []
  acc[hero.role].push(hero)
  return acc
}, {})
