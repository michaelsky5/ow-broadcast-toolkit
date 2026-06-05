import { OW_HEROES_BY_ROLE } from '../../../data/overwatch'
import { getTeamPlayers } from '../../../project/projectUtils'

export const ROLE_SORT_ORDER = {
  tank: 0,
  damage: 1,
  support: 2
}

export const MAX_ROSTER_PLAYERS = 7
export const MIN_ACTIVE_ROSTER_PLAYERS = 5
export const MAX_ACTIVE_ROSTER_PLAYERS = 7

const TEAM_DB_EXPORT_VERSION = 'owbt-team-db-v1'

export const normalizeRosterRole = role => {
  const value = String(role || '').trim().toLowerCase()
  if (['damage', 'dps', 'attack'].includes(value)) return 'damage'
  if (['tank', 'main tank', 'off tank'].includes(value)) return 'tank'
  if (['support', 'sup', 'healer'].includes(value)) return 'support'
  return value || 'damage'
}

export const createEntityId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const getDefaultHeroForRole = role => OW_HEROES_BY_ROLE[normalizeRosterRole(role)]?.[0]?.id || ''

export const normalizePortraitXPct = value => {
  const number = Number(value)
  if (!Number.isFinite(number)) return 50
  return Math.max(0, Math.min(100, Math.round(number)))
}

export const getRoleCounts = players => players.reduce((counts, player) => {
  const role = normalizeRosterRole(player.role)
  return {
    ...counts,
    [role]: (counts[role] || 0) + 1
  }
}, {})

export const getTeamDbNameKey = team => String(team?.name || team?.shortName || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()

export const getTeamDbLabel = team => {
  const name = String(team?.name || team?.id || 'Team').trim()
  return team?.shortName ? `${team.shortName} / ${name}` : name
}

export const getStartingFiveForTeam = (project, teamId) => {
  const players = getTeamPlayers(project, teamId)
  const roleOrder = ['damage', 'damage', 'tank', 'support', 'support']
  const usedIds = new Set()
  const orderedPlayers = roleOrder
    .map(role => {
      const player = players.find(item => !usedIds.has(item.id) && normalizeRosterRole(item.role) === role)
      if (player) usedIds.add(player.id)
      return player
    })
    .filter(Boolean)

  players.forEach(player => {
    if (!usedIds.has(player.id)) orderedPlayers.push(player)
  })

  return orderedPlayers.slice(0, 5).map(player => player.id)
}

export const getRosterOutputIds = (players, savedIds = []) => {
  const rosterPlayers = players.slice(0, MAX_ROSTER_PLAYERS)
  const rosterIds = rosterPlayers.map(player => player.id)
  const rosterIdSet = new Set(rosterIds)
  const selectedIds = savedIds
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .filter(id => rosterIdSet.has(id))

  if (selectedIds.length) return selectedIds.slice(0, MAX_ACTIVE_ROSTER_PLAYERS)

  return rosterIds.slice(0, Math.min(MIN_ACTIVE_ROSTER_PLAYERS, rosterIds.length))
}

export const sanitizeId = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
  .replace(/^-+|-+$/g, '')

export const getUniqueId = (preferredId, usedIds, fallbackPrefix) => {
  const base = sanitizeId(preferredId) || `${fallbackPrefix}-${usedIds.size + 1}`
  let nextId = base
  let suffix = 2

  while (usedIds.has(nextId)) {
    nextId = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(nextId)
  return nextId
}

export const buildTeamDbExport = project => ({
  schemaVersion: TEAM_DB_EXPORT_VERSION,
  exportedAt: new Date().toISOString(),
  teams: (project.teams || []).map(team => ({
    id: team.id,
    name: team.name || '',
    shortName: team.shortName || '',
    logo: team.logo || '',
    primaryColor: team.primaryColor || '',
    description: team.description || '',
    manager: team.manager || '',
    coach: team.coach || '',
    players: getTeamPlayers(project, team.id).map(player => ({
      id: player.id,
      name: player.name || '',
      battleTag: player.battleTag || '',
      role: normalizeRosterRole(player.role),
      avatar: player.avatar || '',
      portraitXPct: normalizePortraitXPct(player.portraitXPct),
      primaryHeroes: Array.isArray(player.primaryHeroes) ? player.primaryHeroes : []
    }))
  }))
})

export const normalizeImportedTeamDb = payload => {
  const sourceTeams = Array.isArray(payload) ? payload : payload?.teams
  const sourcePlayers = Array.isArray(payload?.players) ? payload.players : []

  if (!Array.isArray(sourceTeams) || !sourceTeams.length) {
    throw new Error('Invalid Team DB file.')
  }

  const usedTeamIds = new Set()
  const usedPlayerIds = new Set()
  const teams = []
  const players = []

  sourceTeams.forEach((team, teamIndex) => {
    const previousTeamId = String(team?.id || '').trim()
    const teamId = getUniqueId(
      previousTeamId || team?.shortName || team?.name,
      usedTeamIds,
      'team'
    )
    const declaredPlayerIds = new Set(Array.isArray(team?.playerIds) ? team.playerIds : [])
    const embeddedPlayers = Array.isArray(team?.players)
      ? team.players
      : sourcePlayers.filter(player => player?.teamId === previousTeamId || declaredPlayerIds.has(player?.id))
    const playerIds = []

    embeddedPlayers.forEach((player, playerIndex) => {
      const playerId = getUniqueId(
        player?.id || `${teamId}-player-${playerIndex + 1}`,
        usedPlayerIds,
        `${teamId}-player`
      )
      const role = normalizeRosterRole(player?.role)
      const primaryHeroes = Array.isArray(player?.primaryHeroes)
        ? player.primaryHeroes
        : [player?.primaryHero || player?.hero || getDefaultHeroForRole(role)].filter(Boolean)

      players.push({
        id: playerId,
        name: player?.name || player?.nickname || `Player ${playerIndex + 1}`,
        battleTag: player?.battleTag || player?.battle_tag || player?.battletag || '',
        role,
        teamId,
        avatar: player?.avatar || player?.image || player?.playerImage || '',
        portraitXPct: normalizePortraitXPct(player?.portraitXPct ?? player?.portraitX ?? player?.xPct),
        primaryHeroes
      })
      playerIds.push(playerId)
    })

    teams.push({
      id: teamId,
      name: team?.name || team?.teamName || `Team ${teamIndex + 1}`,
      shortName: team?.shortName || team?.teamShortName || team?.code || `T${teamIndex + 1}`,
      logo: team?.logo || team?.teamLogo || '',
      primaryColor: team?.primaryColor || team?.color || '',
      description: team?.description || '',
      coach: team?.coach || '',
      manager: team?.manager || '',
      playerIds
    })
  })

  return { teams, players }
}

export const readJsonFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader()

  reader.onload = event => {
    try {
      resolve(JSON.parse(String(event.target?.result || '{}')))
    } catch (error) {
      reject(error)
    }
  }

  reader.onerror = () => reject(new Error('Failed to read Team DB file.'))
  reader.readAsText(file)
})

export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})
