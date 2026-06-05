const clean = value => String(value || '').trim()

export const getPublicAsset = path => {
  const base = import.meta.env.BASE_URL || '/'
  const safeBase = base.endsWith('/') ? base.slice(0, -1) : base
  const safePath = String(path || '').startsWith('/') ? path : `/${path}`
  return `${safeBase}${safePath}`
}

export const getHeroIcon = (roleId, heroAssetKey) => {
  const role = clean(roleId)
  const hero = clean(heroAssetKey)
  if (!role || !hero) return ''
  return getPublicAsset(`/heroes/${role}/${hero}.png`)
}

export const getRosterHeroIcon = (roleId, heroAssetKey) => {
  const role = clean(roleId)
  const hero = clean(heroAssetKey)
  if (!role || !hero) return ''
  return getPublicAsset(`/roster/${role}/${hero}.png`)
}

export const getMapImage = (modeId, mapAssetKey, extension = 'jpg') => {
  const mode = clean(modeId)
  const map = clean(mapAssetKey)
  const ext = clean(extension) || 'jpg'
  if (!mode || !map) return ''
  return getPublicAsset(`/maps/${mode}/${map}.${ext}`)
}

export const getModeIcon = (modeId, extension = 'png') => {
  const mode = clean(modeId)
  const ext = clean(extension) || 'png'
  if (!mode) return ''
  return getPublicAsset(`/modes/${mode}.${ext}`)
}
