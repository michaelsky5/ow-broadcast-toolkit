const clean = value => String(value || '').trim().toLowerCase()

export const resolveHeroAssetKey = (heroId, heroById = {}) => {
  const id = clean(heroId)
  return clean(heroById[id]?.assetKey) || id
}
