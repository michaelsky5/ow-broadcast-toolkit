import { getCurrentTeams, getPlayerById, getStartingPlayers } from '../../../project/projectUtils'
import { CORE_STATS, normalizeCoreMetrics, normalizeStatsRows } from '../../../project/statsModel'

export const DATA_SCOPE_OPTIONS = [
  { value: 'current', label: 'Current' },
  { value: 'map', label: 'Saved' },
  { value: 'cumulative', label: 'Total' }
]

export const DISPLAY_MODE_OPTIONS = [
  { value: 'metrics', label: 'Metrics' },
  { value: 'image', label: 'Image' }
]

export const DEFAULT_IMAGE_CROP = {
  xPct: 24,
  topPct: 18,
  bottomPct: 55.6,
  wPct: 52,
  hPct: 29.6
}

export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const statNumber = value => Number(String(value || '').replace(/[^\d.-]/g, '')) || 0

export const createStatsFileName = (project, extension) => {
  const source = String(project?.event?.name || project?.meta?.name || 'owbt-stats')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  const date = new Date().toISOString().slice(0, 10)

  return `${source || 'owbt-stats'}-match-data-${date}.${extension}`
}

const serializeTeam = team => ({
  id: team?.id || '',
  name: team?.name || '',
  shortName: team?.shortName || '',
  logo: team?.logo || '',
  primaryColor: team?.primaryColor || ''
})

const getSnapshotPlayerIds = (project, snapshot, sideKey) => {
  const savedIds = snapshot?.playerIds?.[sideKey]
  if (Array.isArray(savedIds) && savedIds.some(Boolean)) return savedIds
  const matchSide = sideKey === 'teamB' ? 'teamB' : 'teamA'
  const startingIds = project?.currentMatch?.startingFive?.[matchSide]
  if (Array.isArray(startingIds) && startingIds.length) return startingIds
  return getStartingPlayers(project, matchSide).map(player => player.id)
}

const serializePlayer = (project, playerId, index) => {
  const player = getPlayerById(project, playerId)

  return {
    slot: index + 1,
    id: player?.id || playerId || '',
    name: player?.name || `Player ${index + 1}`,
    battleTag: player?.battleTag || '',
    role: player?.role || '',
    primaryHeroes: Array.isArray(player?.primaryHeroes) ? player.primaryHeroes : []
  }
}

const serializeStatsRow = row => CORE_STATS.reduce((output, stat) => ({
  ...output,
  [stat.rowKey]: statNumber(row?.[stat.rowKey])
}), {})

export const buildStatsExport = (project, snapshots) => {
  const { teamA, teamB } = getCurrentTeams(project)

  return {
    schemaVersion: 'owbt-stats-export-v1',
    exportedAt: new Date().toISOString(),
    event: {
      name: project?.event?.name || '',
      nameZh: project?.event?.nameZh || '',
      nameEn: project?.event?.nameEn || '',
      subtitle: project?.event?.subtitle || ''
    },
    match: {
      format: project?.currentMatch?.format || '',
      ft: project?.currentMatch?.ft || 0,
      score: project?.currentMatch?.score || {}
    },
    teams: {
      teamA: serializeTeam(teamA),
      teamB: serializeTeam(teamB)
    },
    maps: snapshots.map(snapshot => {
      const rows = normalizeStatsRows(snapshot.ocrRows)
      const playerIds = {
        teamA: getSnapshotPlayerIds(project, snapshot, 'teamA'),
        teamB: getSnapshotPlayerIds(project, snapshot, 'teamB')
      }

      return {
        id: snapshot.id,
        mapIndex: snapshot.mapIndex,
        roundLabel: snapshot.roundLabel,
        mapId: snapshot.mapId,
        mapName: snapshot.mapName,
        minutes: Number(snapshot.minutes) || 0,
        savedAt: snapshot.savedAt || '',
        metrics: normalizeCoreMetrics(snapshot.metrics, 'overall').map(metric => ({
          key: metric.key,
          label: metric.label,
          teamA: statNumber(metric.teamA),
          teamB: statNumber(metric.teamB),
          enabled: metric.enabled !== false
        })),
        teams: {
          teamA: {
            ...serializeTeam(teamA),
            players: rows.teamA.map((row, index) => ({
              ...serializePlayer(project, playerIds.teamA[index], index),
              stats: serializeStatsRow(row)
            }))
          },
          teamB: {
            ...serializeTeam(teamB),
            players: rows.teamB.map((row, index) => ({
              ...serializePlayer(project, playerIds.teamB[index], index),
              stats: serializeStatsRow(row)
            }))
          }
        }
      }
    })
  }
}

const csvCell = value => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const buildStatsCsv = (project, snapshots) => {
  const { teamA, teamB } = getCurrentTeams(project)
  const headers = [
    'event',
    'map_index',
    'round',
    'map_name',
    'minutes',
    'team_side',
    'team_id',
    'team_name',
    'team_short',
    'slot',
    'player_id',
    'player_name',
    'role',
    ...CORE_STATS.map(stat => stat.rowKey)
  ]
  const rows = [headers]

  snapshots.forEach(snapshot => {
    const normalizedRows = normalizeStatsRows(snapshot.ocrRows)
    ;[
      ['teamA', 'A', teamA],
      ['teamB', 'B', teamB]
    ].forEach(([sideKey, sideLabel, team]) => {
      const playerIds = getSnapshotPlayerIds(project, snapshot, sideKey)

      normalizedRows[sideKey].forEach((row, index) => {
        const player = getPlayerById(project, playerIds[index])

        rows.push([
          project?.event?.name || '',
          snapshot.mapIndex,
          snapshot.roundLabel,
          snapshot.mapName,
          Number(snapshot.minutes) || 0,
          sideLabel,
          team?.id || '',
          team?.name || '',
          team?.shortName || '',
          index + 1,
          player?.id || playerIds[index] || '',
          player?.name || `Player ${index + 1}`,
          player?.role || '',
          ...CORE_STATS.map(stat => statNumber(row?.[stat.rowKey]))
        ])
      })
    })
  })

  return rows.map(row => row.map(csvCell).join(',')).join('\n')
}
