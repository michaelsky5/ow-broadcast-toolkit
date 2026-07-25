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
  const value = String(role || '').trim().normalize('NFKC').toLowerCase()
  if (['damage', 'dps', 'attack', 'd', '输出', '伤害'].includes(value)) return 'damage'
  if (['tank', 'main tank', 'off tank', 't', '坦克', '重装'].includes(value)) return 'tank'
  if (['support', 'sup', 'healer', 's', '支援', '辅助', '治疗'].includes(value)) return 'support'
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

const toRecordArray = value => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(item => (Array.isArray(item) ? item : [item]))
}

const getFirstRecordArray = (...values) => {
  for (const value of values) {
    const records = toRecordArray(value)
    if (records.length) return records
  }
  return []
}

const getPlayerTeamReference = player => String(
  player?.teamId || player?.team_id || player?.teamCode || player?.team_code ||
  player?.teamName || player?.team_name || player?.team || ''
).trim()

const normalizeImportIdentity = value => String(value || '').trim().toLocaleLowerCase()

export const normalizeImportedTeamDb = payload => {
  const sourceTeams = Array.isArray(payload)
    ? payload
    : getFirstRecordArray(
        payload?.teams,
        payload?.teamList,
        payload?.team_list,
        payload?.teamDatabase?.teams,
        payload?.teamDatabase?.teamList,
        payload?.teamDb?.teams,
        payload?.teamDb?.teamList,
        payload?.participants?.teams
      )
  const sourcePlayers = getFirstRecordArray(
    payload?.players,
    payload?.playerList,
    payload?.player_list,
    payload?.teamDatabase?.players,
    payload?.teamDatabase?.playerList,
    payload?.teamDb?.players,
    payload?.teamDb?.playerList,
    payload?.participants?.players
  )

  if (!Array.isArray(sourceTeams) || !sourceTeams.length) {
    throw new Error('Invalid Team DB file.')
  }

  const usedTeamIds = new Set()
  const usedPlayerIds = new Set()
  const teams = []
  const players = []

  sourceTeams.forEach((team, teamIndex) => {
    const previousTeamId = String(team?.id || team?.teamId || team?.team_id || '').trim()
    const previousTeamShortName = String(
      team?.shortName || team?.teamShortName || team?.short_name || team?.team_short_name ||
      team?.code || team?.abbr || team?.abbreviation || ''
    ).trim()
    const previousTeamName = String(team?.name || team?.teamName || team?.team_name || '').trim()
    const teamId = getUniqueId(
      previousTeamId || previousTeamShortName || previousTeamName,
      usedTeamIds,
      'team'
    )
    const declaredPlayerIds = new Set(getFirstRecordArray(
      team?.playerIds,
      team?.player_ids,
      team?.memberIds,
      team?.member_ids
    ).map(String))
    const embeddedPlayers = getFirstRecordArray(
      team?.players,
      team?.roster,
      team?.members,
      team?.lineup,
      team?.athletes
    )
    const linkedPlayers = embeddedPlayers.length
      ? embeddedPlayers
      : sourcePlayers.filter(player => {
          const teamReference = getPlayerTeamReference(player)
          const normalizedReference = normalizeImportIdentity(teamReference)
          const teamReferences = [previousTeamId, previousTeamShortName, previousTeamName]
            .map(normalizeImportIdentity)
            .filter(Boolean)
          return (
            (normalizedReference && teamReferences.includes(normalizedReference)) ||
            declaredPlayerIds.has(String(player?.id || player?.playerId || player?.player_id || ''))
          )
        })
    const playerIds = []

    linkedPlayers.forEach((player, playerIndex) => {
      const playerId = getUniqueId(
        player?.id || player?.playerId || player?.player_id || `${teamId}-player-${playerIndex + 1}`,
        usedPlayerIds,
        `${teamId}-player`
      )
      const role = normalizeRosterRole(player?.role || player?.position || player?.playerRole || player?.player_role)
      const primaryHeroes = Array.isArray(player?.primaryHeroes)
        ? player.primaryHeroes
        : Array.isArray(player?.heroes)
          ? player.heroes
          : String(player?.primaryHeroes || player?.primaryHero || player?.primary_hero || player?.hero || '')
              .split(/[,，;/]/)
              .map(value => value.trim())
              .filter(Boolean)
      const normalizedHeroes = primaryHeroes.length ? primaryHeroes : [getDefaultHeroForRole(role)].filter(Boolean)

      players.push({
        id: playerId,
        name: player?.name || player?.playerName || player?.player_name || player?.nickname || player?.gamertag || `Player ${playerIndex + 1}`,
        battleTag: player?.battleTag || player?.battle_tag || player?.battletag || player?.battleId || player?.battle_id || player?.gameId || player?.game_id || '',
        role,
        teamId,
        avatar: player?.avatar || player?.image || player?.playerImage || player?.player_image || player?.photo || '',
        portraitXPct: normalizePortraitXPct(
          player?.portraitXPct ?? player?.portrait_x_pct ?? player?.portraitX ?? player?.xPct
        ),
        primaryHeroes: normalizedHeroes
      })
      playerIds.push(playerId)
    })

    teams.push({
      id: teamId,
      name: previousTeamName || `Team ${teamIndex + 1}`,
      shortName: previousTeamShortName || `T${teamIndex + 1}`,
      logo: team?.logo || team?.teamLogo || team?.team_logo || team?.logoUrl || team?.logo_url || '',
      primaryColor: team?.primaryColor || team?.primary_color || team?.teamColor || team?.team_color || team?.color || '',
      description: team?.description || team?.notes || team?.note || '',
      coach: team?.coach || team?.headCoach || team?.head_coach || '',
      manager: team?.manager || team?.teamManager || team?.team_manager || team?.leader || '',
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
