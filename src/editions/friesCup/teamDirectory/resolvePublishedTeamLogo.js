const TEAM_LOGO_MODULES = import.meta.glob('../../../assets/logos/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default'
})

const FALLBACK_TEAM_LOGO_KEY = 'OW'

const clean = value => String(value || '').trim()
const uniq = values => [...new Set(values.map(clean).filter(Boolean))]

const stripQuery = value => clean(value).split(/[?#]/)[0]

const getBasename = value => stripQuery(value)
  .replace(/\\/g, '/')
  .split('/')
  .filter(Boolean)
  .pop() || ''

const stripImageExtension = value => clean(value).replace(/\.(?:png|jpe?g|svg|webp|gif)$/i, '')

export const normalizeTeamLogoKey = value => stripImageExtension(getBasename(value))
  .normalize('NFKC')
  .trim()
  .toUpperCase()

const getLogoLookupKeys = value => {
  const key = normalizeTeamLogoKey(value)
  const compactKey = key.replace(/[^A-Z0-9\u4E00-\u9FFF]+/g, '')
  return uniq([key, compactKey])
}

const logoRegistry = Object.entries(TEAM_LOGO_MODULES).reduce((registry, [path, url]) => {
  const filename = getBasename(path)
  const key = normalizeTeamLogoKey(filename)

  getLogoLookupKeys(filename).forEach(lookupKey => {
    if (!registry.has(lookupKey)) {
      registry.set(lookupKey, {
        key,
        filename,
        url
      })
    }
  })

  return registry
}, new Map())

const getFallbackTeamLogo = () => logoRegistry.get(FALLBACK_TEAM_LOGO_KEY) || {
  key: FALLBACK_TEAM_LOGO_KEY,
  filename: `${FALLBACK_TEAM_LOGO_KEY}.png`,
  url: `/${FALLBACK_TEAM_LOGO_KEY}.png`
}

const isExplicitLogoUrl = value => /^(?:https?:|data:|blob:|\/)/i.test(clean(value))

const normalizeExplicitLogoPath = value => {
  const logo = clean(value)
  if (!logo) return ''
  if (/^(?:https?:|data:|blob:)/i.test(logo)) return logo
  if (logo.startsWith('/')) return logo
  if (logo.includes('/') || logo.includes('\\')) {
    return `/${logo.replace(/\\/g, '/').replace(/^\.?\/*/, '').replace(/^public\//, '')}`
  }
  return ''
}

const resolveFromRegistry = candidates => {
  for (const candidate of candidates) {
    const keys = getLogoLookupKeys(candidate.value)
    const match = keys.map(key => logoRegistry.get(key)).find(Boolean)
    if (match) {
      return {
        status: 'auto',
        source: 'local-assets',
        resolvedUrl: match.url,
        key: match.key,
        filename: match.filename,
        matchedBy: candidate.field,
        matchedValue: candidate.value
      }
    }
  }

  return null
}

export const getAvailableTeamLogoKeys = () => [...logoRegistry.values()]
  .map(item => item.key)
  .filter((key, index, keys) => keys.indexOf(key) === index)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

export const resolvePublishedTeamLogo = team => {
  const explicitLogo = clean(team?.logo || team?.team_logo || team?.teamLogo || team?.logoUrl || team?.logoPath)
  const candidates = [
    { field: 'team_logo', value: explicitLogo },
    { field: 'team_short_name', value: team?.shortName || team?.team_short_name || team?.teamShortName || team?.short || team?.code },
    { field: 'team_id', value: team?.sourceTeamId || team?.team_id || team?.teamId || team?.id },
    { field: 'team_name', value: team?.name || team?.team_name || team?.teamName }
  ].filter(candidate => clean(candidate.value))

  const explicitPath = normalizeExplicitLogoPath(explicitLogo)
  if (explicitPath && isExplicitLogoUrl(explicitPath)) {
    return {
      status: 'explicit',
      source: 'published',
      resolvedUrl: explicitPath,
      key: normalizeTeamLogoKey(explicitLogo),
      filename: getBasename(explicitLogo),
      matchedBy: 'team_logo',
      matchedValue: explicitLogo,
      candidates
    }
  }

  const registryMatch = resolveFromRegistry(candidates)
  if (registryMatch) {
    return {
      ...registryMatch,
      explicitLogo,
      candidates
    }
  }

  return {
    status: 'fallback',
    source: 'local-assets',
    resolvedUrl: getFallbackTeamLogo().url,
    key: normalizeTeamLogoKey(explicitLogo || team?.shortName || team?.team_short_name || team?.sourceTeamId || team?.team_id),
    filename: getFallbackTeamLogo().filename,
    fallbackKey: getFallbackTeamLogo().key,
    matchedBy: '',
    matchedValue: '',
    explicitLogo,
    candidates
  }
}
