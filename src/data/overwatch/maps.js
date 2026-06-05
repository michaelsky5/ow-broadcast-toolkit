import { getMapImage, getModeIcon } from './assetPaths'
import { OW_GAME_MODE_BY_ID } from './gameModes'

export const OW_MAPS = [
  // Control
  { id: 'ilios', zh: '伊利奥斯', en: 'Ilios', mode: 'control', assetKey: 'ilios' },
  { id: 'lijiang-tower', zh: '漓江塔', en: 'Lijiang Tower', mode: 'control', assetKey: 'lijiang-tower' },
  { id: 'nepal', zh: '尼泊尔', en: 'Nepal', mode: 'control', assetKey: 'nepal' },
  { id: 'oasis', zh: '绿洲城', en: 'Oasis', mode: 'control', assetKey: 'oasis' },
  { id: 'busan', zh: '釜山', en: 'Busan', mode: 'control', assetKey: 'busan' },
  { id: 'antarctic-peninsula', zh: '南极半岛', en: 'Antarctic Peninsula', mode: 'control', assetKey: 'antarctic-peninsula' },
  { id: 'samoa', zh: '萨摩亚', en: 'Samoa', mode: 'control', assetKey: 'samoa' },

  // Escort
  { id: 'dorado', zh: '多拉多', en: 'Dorado', mode: 'escort', assetKey: 'dorado' },
  { id: 'route-66', zh: '66 号公路', en: 'Route 66', mode: 'escort', assetKey: 'route-66' },
  { id: 'watchpoint-gibraltar', zh: '监测站：直布罗陀', en: 'Watchpoint: Gibraltar', mode: 'escort', assetKey: 'watchpoint-gibraltar' },
  { id: 'havana', zh: '哈瓦那', en: 'Havana', mode: 'escort', assetKey: 'havana' },
  { id: 'junkertown', zh: '渣客镇', en: 'Junkertown', mode: 'escort', assetKey: 'junkertown' },
  { id: 'rialto', zh: '里阿尔托', en: 'Rialto', mode: 'escort', assetKey: 'rialto' },
  { id: 'shambali-monastery', zh: '香巴里寺院', en: 'Shambali Monastery', mode: 'escort', assetKey: 'shambali' },
  { id: 'circuit-royal', zh: '皇家赛道', en: 'Circuit Royal', mode: 'escort', assetKey: 'circuit-royal' },

  // Hybrid
  { id: 'blizzard-world', zh: '暴雪世界', en: 'Blizzard World', mode: 'hybrid', assetKey: 'blizzard-world' },
  { id: 'eichenwalde', zh: '艾兴瓦尔德', en: 'Eichenwalde', mode: 'hybrid', assetKey: 'eichenwalde' },
  { id: 'hollywood', zh: '好莱坞', en: 'Hollywood', mode: 'hybrid', assetKey: 'hollywood' },
  { id: 'kings-row', zh: '国王大道', en: "King's Row", mode: 'hybrid', assetKey: 'kings-row' },
  { id: 'numbani', zh: '努巴尼', en: 'Numbani', mode: 'hybrid', assetKey: 'numbani' },
  { id: 'midtown', zh: '中城', en: 'Midtown', mode: 'hybrid', assetKey: 'midtown' },
  { id: 'paraiso', zh: '帕拉伊苏', en: 'Paraíso', mode: 'hybrid', assetKey: 'paraiso' },

  // Push
  { id: 'colosseo', zh: '斗兽场', en: 'Colosseo', mode: 'push', assetKey: 'colosseo' },
  { id: 'new-queen-street', zh: '新皇后街', en: 'New Queen Street', mode: 'push', assetKey: 'new-queen-street' },
  { id: 'esperanca', zh: '埃斯佩兰萨', en: 'Esperança', mode: 'push', assetKey: 'esperanca' },
  { id: 'runasapi', zh: '鲁纳萨彼', en: 'Runasapi', mode: 'push', assetKey: 'runasapi' },

  // Flashpoint
  { id: 'suravasa', zh: '苏拉瓦萨', en: 'Suravasa', mode: 'flashpoint', assetKey: 'suravasa' },
  { id: 'new-junk-city', zh: '新渣客城', en: 'New Junk City', mode: 'flashpoint', assetKey: 'new-junk-city' },
  { id: 'aatlis', zh: '阿特利斯', en: 'Atlis', mode: 'flashpoint', assetKey: 'atlis' },

  // Clash
  { id: 'hanaoka', zh: '花冈', en: 'Hanaoka', mode: 'clash', assetKey: 'hanaoka', imageExt: 'png' },
  { id: 'throne-of-anubis', zh: '阿努比斯王座', en: 'Throne of Anubis', mode: 'clash', assetKey: 'throne-of-anubis', imageExt: 'png' }
]

export const OW_MAP_OPTIONS = OW_MAPS.map(map => {
  const mode = OW_GAME_MODE_BY_ID[map.mode]

  return {
    ...map,
    modeZh: mode?.zh || map.mode,
    modeEn: mode?.en || map.mode,
    modeKey: mode?.key || map.mode.toUpperCase(),
    needsAttackDefense: Boolean(mode?.needsAttackDefense),
    image: getMapImage(map.mode, map.assetKey, map.imageExt),
    modeIcon: getModeIcon(map.mode, mode?.assetExt)
  }
})

export const OW_MAP_BY_ID = OW_MAP_OPTIONS.reduce((acc, map) => {
  acc[map.id] = map
  return acc
}, {})

export const OW_MAPS_BY_MODE = OW_MAP_OPTIONS.reduce((acc, map) => {
  if (!acc[map.mode]) acc[map.mode] = []
  acc[map.mode].push(map)
  return acc
}, {})
