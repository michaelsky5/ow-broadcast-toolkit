import { getFriesCupTeamDirectoryConfig } from '../config'

const trimSlash = value => String(value || '').trim().replace(/\/+$/, '')
const unique = values => Array.from(new Set(values.filter(Boolean)))

export const normalizePublishedDataBaseUrl = value => {
  const raw = trimSlash(value) || getFriesCupTeamDirectoryConfig().remoteBaseUrl
  if (raw.endsWith('/api/admin-public')) return raw
  if (raw.endsWith('/api/public')) return raw
  if (raw.endsWith('/api')) return `${raw}/public`
  return `${raw}/api/public`
}

export const normalizePublishedSeasonId = value => {
  const config = getFriesCupTeamDirectoryConfig()
  return String(value || config.seasonId).trim() || config.seasonId
}

export const normalizePublishedVersion = value => {
  const config = getFriesCupTeamDirectoryConfig()
  return String(value || config.version).trim() || config.version
}

export const buildPublishedMetaUrl = configInput => {
  const config = getFriesCupTeamDirectoryConfig(configInput)
  const publicApiRoot = normalizePublishedDataBaseUrl(config.remoteBaseUrl)
  const seasonId = encodeURIComponent(normalizePublishedSeasonId(config.seasonId))
  const version = encodeURIComponent(normalizePublishedVersion(config.version))

  return `${publicApiRoot}/seasons/${seasonId}/publish/${version}`
}

export const buildPublishedDataUrl = configInput => `${buildPublishedMetaUrl(configInput)}/data`

const getFallbackUrls = config => unique([
  config.staticFallbackUrl,
  ...(Array.isArray(config.staticFallbackUrls) ? config.staticFallbackUrls : [])
])

export const getPublishedDataSources = configInput => {
  const config = getFriesCupTeamDirectoryConfig(configInput)
  const seasonId = normalizePublishedSeasonId(config.seasonId)
  const version = normalizePublishedVersion(config.version)
  const primaryMetaUrl = buildPublishedMetaUrl({ ...config, seasonId, version })
  const primaryDataUrl = `${primaryMetaUrl}/data`

  return [
    {
      type: 'remote',
      source: config.sourceType,
      seasonId,
      version,
      metaUrl: primaryMetaUrl,
      dataUrl: primaryDataUrl
    },
    ...getFallbackUrls(config).map(dataUrl => ({
      type: 'fallback',
      source: 'static-fallback',
      seasonId,
      version,
      metaUrl: '',
      dataUrl
    }))
  ]
}

const fetchJsonWithTimeout = async (url, { timeoutMs, cache = 'no-store', signal } = {}) => {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(url, { cache, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP_${response.status}`)
    return response.json()
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

const pickSchemaVersion = data => data?.schema_version || data?.schemaVersion || data?.meta?.schema_version || ''
const pickContractVersion = (data, meta) => (
  meta?.contract?.contractVersion ||
  meta?.contractVersion ||
  data?.meta?.contract_version ||
  data?.meta?.contractVersion ||
  ''
)

const pickUpdatedAt = data => data?.updated_at || data?.updatedAt || data?.review_ready_at || ''

export async function fetchPublishedTeamData(configInput = {}) {
  const config = getFriesCupTeamDirectoryConfig(configInput)
  const sources = getPublishedDataSources(config)
  const errors = []

  for (const candidate of sources) {
    try {
      const data = await fetchJsonWithTimeout(candidate.dataUrl, {
        timeoutMs: config.timeoutMs,
        cache: 'no-store'
      })
      let meta = null

      if (candidate.metaUrl) {
        try {
          meta = await fetchJsonWithTimeout(candidate.metaUrl, {
            timeoutMs: config.timeoutMs,
            cache: candidate.version === 'latest' ? 'no-store' : 'default'
          })
        } catch {
          meta = null
        }
      }

      return {
        data,
        source: candidate.source,
        sourceType: candidate.type,
        sourceUrl: candidate.dataUrl,
        fetchedAt: new Date().toISOString(),
        seasonId: candidate.seasonId,
        version: meta?.version || candidate.version,
        checksum: meta?.checksum || data?.checksum || '',
        schemaVersion: pickSchemaVersion(data),
        contractVersion: pickContractVersion(data, meta),
        updatedAt: pickUpdatedAt(data),
        meta
      }
    } catch (error) {
      errors.push(`${candidate.dataUrl} (${error?.message || 'failed'})`)
    }
  }

  const failure = new Error(`FC_SYSTEM_PUBLISHED_DATA_LOAD_FAILED: ${errors.join(' | ')}`)
  failure.sources = sources
  throw failure
}

