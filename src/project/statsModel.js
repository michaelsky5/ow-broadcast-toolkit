const CORE_STATS = [
  { key: 'eliminations', rowKey: 'elim', label: 'Eliminations', shortLabel: 'ELIM', reverse: false },
  { key: 'assists', rowKey: 'ast', label: 'Assists', shortLabel: 'AST', reverse: false },
  { key: 'deaths', rowKey: 'dth', label: 'Deaths', shortLabel: 'DTH', reverse: true },
  { key: 'damage', rowKey: 'dmg', label: 'Damage', shortLabel: 'DMG', reverse: false },
  { key: 'healing', rowKey: 'heal', label: 'Healing', shortLabel: 'HEAL', reverse: false },
  { key: 'mitigated', rowKey: 'block', label: 'Mitigated', shortLabel: 'MIT', reverse: false }
]

const createEmptyStatsRow = () => CORE_STATS.reduce((row, stat) => {
  row[stat.rowKey] = ''
  return row
}, {})

const normalizeStatsRows = rows => ({
  teamA: Array.from({ length: 5 }, (_, index) => ({ ...createEmptyStatsRow(), ...(rows?.teamA?.[index] || {}) })),
  teamB: Array.from({ length: 5 }, (_, index) => ({ ...createEmptyStatsRow(), ...(rows?.teamB?.[index] || {}) }))
})

const normalizeStatsPlayerIds = playerIds => ({
  teamA: Array.from({ length: 5 }, (_, index) => String(playerIds?.teamA?.[index] || '')),
  teamB: Array.from({ length: 5 }, (_, index) => String(playerIds?.teamB?.[index] || ''))
})

const normalizeMapSnapshots = snapshots => (
  (Array.isArray(snapshots) ? snapshots : [])
    .filter(Boolean)
    .map(snapshot => ({
      ...snapshot,
      id: String(snapshot.id || `map-${snapshot.mapIndex || 0}`),
      mapIndex: Number(snapshot.mapIndex) || 0,
      minutes: Number(snapshot.minutes) || 0,
      ocrRows: normalizeStatsRows(snapshot.ocrRows),
      playerIds: normalizeStatsPlayerIds(snapshot.playerIds),
      metrics: Array.isArray(snapshot.metrics) ? snapshot.metrics : []
    }))
    .sort((a, b) => Number(a.mapIndex) - Number(b.mapIndex))
)

const sumStatRows = (rows, rowKey) => (
  (Array.isArray(rows) ? rows : []).reduce((total, row) => total + (Number(row?.[rowKey]) || 0), 0)
)

const toStatNumber = value => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatStatNumber = value => {
  const numeric = Number(value) || 0
  return numeric.toLocaleString('en-US')
}

const formatDataMinutes = value => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  const rounded = Math.round(numeric * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '')
}

const formatPer10 = (value, minutes) => {
  const duration = Number(minutes) || 0
  if (!duration) return '0'
  const result = (toStatNumber(value) / duration) * 10
  return result >= 100 ? Math.round(result).toLocaleString('en-US') : result.toFixed(1)
}

const getDataMinutes = settings => (
  Number(settings?.dataMinutes ?? settings?.capture?.dataMinutes ?? 10) || 0
)

const getCoreStatByLabel = label => {
  const text = String(label || '').trim().toLowerCase()
  return CORE_STATS.find(stat => stat.label.toLowerCase() === text || stat.shortLabel.toLowerCase() === text)
}

const getMetricCategory = metric => String(metric?.category || 'overall').toLowerCase()

const buildCoreMetricsFromRows = (rows, category = 'overall') => {
  const normalized = normalizeStatsRows(rows)

  return CORE_STATS.map(stat => ({
    key: stat.key,
    category,
    label: stat.label,
    teamA: String(sumStatRows(normalized.teamA, stat.rowKey)),
    teamB: String(sumStatRows(normalized.teamB, stat.rowKey)),
    enabled: true
  }))
}

const mergeMetricEnabled = (valueMetrics, displayMetrics) => (
  valueMetrics.map(metric => {
    const displayMetric = displayMetrics.find(item => item.key === metric.key)
    return {
      ...metric,
      enabled: displayMetric ? displayMetric.enabled !== false : metric.enabled !== false
    }
  })
)

const normalizeCoreMetrics = (metrics, category = 'overall') => {
  const source = Array.isArray(metrics) ? metrics : []

  return CORE_STATS.map(stat => {
    const existing = source.find(metric => (
      getMetricCategory(metric) === category
      && (
        metric?.key === stat.key
        || String(metric?.label || '').trim().toLowerCase() === stat.label.toLowerCase()
        || String(metric?.label || '').trim().toLowerCase() === stat.shortLabel.toLowerCase()
      )
    ))

    return {
      key: stat.key,
      category,
      label: stat.label,
      teamA: existing?.teamA ?? '0',
      teamB: existing?.teamB ?? '0',
      enabled: existing?.enabled !== false
    }
  })
}

const hasMetricValues = metrics => (
  (Array.isArray(metrics) ? metrics : []).some(metric => toStatNumber(metric.teamA) || toStatNumber(metric.teamB))
)

const normalizeSnapshotMetrics = (snapshot, category = 'overall') => {
  const snapshotCategory = snapshot?.category || category
  const savedMetrics = normalizeCoreMetrics(snapshot?.metrics, snapshotCategory)

  if (hasMetricValues(savedMetrics)) {
    return savedMetrics.map(metric => ({
      ...metric,
      category
    }))
  }

  return buildCoreMetricsFromRows(snapshot?.ocrRows, category)
}

const selectDisplayMetrics = metrics => (
  (Array.isArray(metrics) ? metrics : []).filter(metric => metric.enabled !== false)
)

const getCumulativePlayerIds = snapshots => {
  const normalizedSnapshots = normalizeMapSnapshots(snapshots)
  const getLatestUniqueIds = side => normalizedSnapshots
    .slice()
    .reverse()
    .flatMap(snapshot => snapshot.playerIds?.[side] || [])
    .filter((id, index, ids) => id && ids.indexOf(id) === index)
    .slice(0, 5)

  return normalizeStatsPlayerIds({
    teamA: getLatestUniqueIds('teamA'),
    teamB: getLatestUniqueIds('teamB')
  })
}

const addStatsRow = (target, source) => {
  CORE_STATS.forEach(stat => {
    target[stat.rowKey] = String(toStatNumber(target[stat.rowKey]) + toStatNumber(source?.[stat.rowKey]))
  })
}

const combineStatsRows = snapshots => {
  const normalizedSnapshots = normalizeMapSnapshots(snapshots)
  const playerIds = getCumulativePlayerIds(normalizedSnapshots)
  const buckets = {
    teamA: new Map(),
    teamB: new Map()
  }

  normalizedSnapshots.forEach(snapshot => {
    ;['teamA', 'teamB'].forEach(side => {
      snapshot.ocrRows?.[side]?.forEach((row, index) => {
        const playerId = snapshot.playerIds?.[side]?.[index] || ''
        const key = playerId || `__slot-${index}`

        if (!buckets[side].has(key)) buckets[side].set(key, createEmptyStatsRow())
        addStatsRow(buckets[side].get(key), row)
      })
    })
  })

  return {
    teamA: playerIds.teamA.map((playerId, index) => buckets.teamA.get(playerId || `__slot-${index}`) || createEmptyStatsRow()),
    teamB: playerIds.teamB.map((playerId, index) => buckets.teamB.get(playerId || `__slot-${index}`) || createEmptyStatsRow())
  }
}

const getStatsDataScope = settings => {
  const scope = String(settings?.statsDataScope || 'current').toLowerCase()
  return ['current', 'map', 'cumulative'].includes(scope) ? scope : 'current'
}

const resolveStatsData = (settings = {}, category = 'overall') => {
  const activeCategory = String(category || settings.activeCategory || 'overall').toLowerCase()
  const snapshots = normalizeMapSnapshots(settings.mapSnapshots)
  const displaySourceMetrics = normalizeCoreMetrics(settings.metrics, activeCategory)
  const requestedScope = getStatsDataScope(settings)
  const currentRows = normalizeStatsRows(settings.ocrRows)
  const currentMetrics = normalizeCoreMetrics(settings.metrics, activeCategory)

  if (requestedScope === 'map' && snapshots.length) {
    const snapshot = snapshots.find(item => item.id === settings.activeSnapshotId) || snapshots[snapshots.length - 1]
    const rows = normalizeStatsRows(snapshot.ocrRows)
    const valueMetrics = normalizeSnapshotMetrics(snapshot, activeCategory)

    return {
      scope: 'map',
      label: snapshot.roundLabel || `MAP ${snapshot.mapIndex || snapshots.length}`,
      mapName: snapshot.mapName || snapshot.mapId || '',
      minutes: Number(snapshot.minutes) || 0,
      rows,
      playerIds: normalizeStatsPlayerIds(snapshot.playerIds),
      metrics: mergeMetricEnabled(valueMetrics, displaySourceMetrics),
      snapshot,
      snapshots
    }
  }

  if (requestedScope === 'cumulative' && snapshots.length) {
    const rows = combineStatsRows(snapshots)
    const playerIds = getCumulativePlayerIds(snapshots)
    const minutes = snapshots.reduce((total, snapshot) => total + (Number(snapshot.minutes) || 0), 0)
    const valueMetrics = CORE_STATS.map(stat => ({
      key: stat.key,
      category: activeCategory,
      label: stat.label,
      teamA: String(snapshots.reduce((total, snapshot) => {
        const metric = normalizeSnapshotMetrics(snapshot, activeCategory).find(item => item.key === stat.key)
        return total + toStatNumber(metric?.teamA)
      }, 0)),
      teamB: String(snapshots.reduce((total, snapshot) => {
        const metric = normalizeSnapshotMetrics(snapshot, activeCategory).find(item => item.key === stat.key)
        return total + toStatNumber(metric?.teamB)
      }, 0)),
      enabled: true
    }))

    return {
      scope: 'cumulative',
      label: `${snapshots.length} MAP TOTAL`,
      mapName: 'Saved Maps',
      minutes,
      rows,
      playerIds,
      metrics: mergeMetricEnabled(valueMetrics, displaySourceMetrics),
      snapshot: null,
      snapshots
    }
  }

  return {
    scope: 'current',
    label: 'CURRENT DATA',
    mapName: '',
    minutes: getDataMinutes(settings),
    rows: currentRows,
    playerIds: normalizeStatsPlayerIds(settings.statsPlayerIds),
    metrics: currentMetrics,
    snapshot: null,
    snapshots
  }
}

export {
  CORE_STATS,
  buildCoreMetricsFromRows,
  combineStatsRows,
  createEmptyStatsRow,
  formatDataMinutes,
  formatPer10,
  formatStatNumber,
  getCoreStatByLabel,
  getDataMinutes,
  getMetricCategory,
  getStatsDataScope,
  normalizeCoreMetrics,
  normalizeMapSnapshots,
  normalizeStatsPlayerIds,
  normalizeStatsRows,
  resolveStatsData,
  selectDisplayMetrics,
  sumStatRows,
  toStatNumber
}
