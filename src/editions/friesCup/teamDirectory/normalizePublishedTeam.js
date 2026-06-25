import { resolvePublishedTeamLogo } from './resolvePublishedTeamLogo'

const KNOWN_TOP_LEVEL_FIELDS = new Set([
  'schema_version',
  'schemaVersion',
  'updated_at',
  'updatedAt',
  'meta',
  'teams',
  'players',
  'matches',
  'player_totals',
  'playerTotals',
  'team_reviews',
  'teamReviews',
  'review_schema_version',
  'reviewSchemaVersion',
  'review_ready_at',
  'reviewReadyAt',
  'schedule_announcements'
])

const KNOWN_TEAM_FIELDS = new Set([
  'id',
  'team_id',
  'teamId',
  'team_name',
  'teamName',
  'name',
  'team_short_name',
  'teamShortName',
  'shortName',
  'short',
  'code',
  'team_logo',
  'teamLogo',
  'logo',
  'logoUrl',
  'logoPath',
  'team_manager',
  'teamManager',
  'manager',
  'managerNickname',
  'team_coach',
  'teamCoach',
  'coach',
  'coachNickname',
  'team_club',
  'teamClub',
  'club',
  'final_rank',
  'finalRank',
  'final_rank_text',
  'finalRankText',
  'staff',
  'player_ids',
  'playerIds',
  'players',
  'roster'
])

const KNOWN_PLAYER_FIELDS = new Set([
  'id',
  'player_id',
  'playerId',
  'player_name',
  'playerName',
  'name',
  'nickname',
  'display_name',
  'displayName',
  'team_id',
  'teamId',
  'team_name',
  'teamName',
  'team_short_name',
  'teamShortName',
  'battleTag',
  'battle_tag',
  'battletag',
  'role',
  'rank',
  'join_stage',
  'joinStage',
  'status',
  'allowed_flex',
  'allowedFlex',
  'admin_notes',
  'adminNotes',
  'historical_match_logs',
  'historicalMatchLogs',
  'live_match_logs',
  'liveMatchLogs',
  'match_logs',
  'matchLogs',
  'avatar',
  'heroImage',
  'portrait',
  'player_image'
])

const clean = value => String(value || '').trim()
const compact = values => values.map(clean).filter(Boolean)
const clone = value => {
  if (value === undefined) return undefined
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value))
  }
}

const getFirst = (...values) => compact(values)[0] || ''

const stripBattleTag = value => clean(value).replace(/#\d+$/, '').trim()

const slug = value => clean(value)
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
  .replace(/^-+|-+$/g, '') || 'item'

const normalizeRole = role => {
  const value = clean(role).toLowerCase()
  if (['tank', 'main tank', 'off tank'].includes(value)) return 'tank'
  if (['damage', 'dps', 'attack'].includes(value)) return 'damage'
  if (['support', 'sup', 'healer'].includes(value)) return 'support'
  return value || 'damage'
}

const pickExtras = (source, knownFields) => Object.entries(source || {}).reduce((extras, [key, value]) => {
  if (!knownFields.has(key)) extras[key] = clone(value)
  return extras
}, {})

const getSourceTeamId = team => getFirst(team?.team_id, team?.teamId, team?.id)
const getTeamName = team => getFirst(team?.team_name, team?.teamName, team?.name, getSourceTeamId(team))
const getTeamShortName = team => getFirst(team?.team_short_name, team?.teamShortName, team?.shortName, team?.short, team?.code, getTeamName(team))
const getTeamLogo = team => getFirst(team?.team_logo, team?.teamLogo, team?.logo, team?.logoUrl, team?.logoPath)
const getPlayerSourceTeamId = player => getFirst(player?.team_id, player?.teamId, player?.team?.id)
const getSourcePlayerId = player => getFirst(player?.player_id, player?.playerId, player?.id)

const normalizeStaffEntries = (entries, role, teamStableId) => (
  Array.isArray(entries) ? entries : []
).map((entry, index) => {
  const battletag = getFirst(entry?.battle_tag, entry?.battleTag, entry?.battletag)
  const name = getFirst(entry?.display_name, entry?.displayName, entry?.name, stripBattleTag(battletag), entry?.raw)
  const staffRole = Array.isArray(entry?.roles) && entry.roles.length
    ? clean(entry.roles[0]).toLowerCase() || role
    : role

  return {
    id: `${teamStableId}:staff:${staffRole}:${index + 1}:${slug(name || battletag || entry?.raw)}`,
    name: name || battletag || `${role} ${index + 1}`,
    role: staffRole,
    battletag,
    raw: entry?.raw || '',
    extras: {
      ...pickExtras(entry, new Set(['battle_tag', 'battleTag', 'battletag', 'display_name', 'displayName', 'name', 'raw', 'roles'])),
      roles: clone(entry?.roles || [])
    }
  }
})

const splitStaffText = value => clean(value)
  .split(/[、,;/]+/g)
  .map(item => item.trim())
  .filter(Boolean)

const normalizeStaff = (team, teamStableId) => {
  const staff = team?.staff || {}
  const rawEntries = [
    ...normalizeStaffEntries(staff.managers, 'manager', teamStableId),
    ...normalizeStaffEntries(staff.coaches, 'coach', teamStableId),
    ...normalizeStaffEntries(staff.members, 'staff', teamStableId)
  ]
  const seenStaffKeys = new Set()
  const entries = rawEntries.filter(entry => {
    const keys = [entry.name, entry.battletag, entry.raw]
      .map(value => `${entry.role}:${clean(value).toLowerCase()}`)
      .filter(key => !key.endsWith(':'))
    if (keys.some(key => seenStaffKeys.has(key))) return false
    keys.forEach(key => seenStaffKeys.add(key))
    return true
  })
  const existingKeys = new Set(entries.map(entry => `${entry.role}:${entry.name}:${entry.battletag}`.toLowerCase()))
  const hasStaffValue = (role, value) => {
    const text = clean(value).toLowerCase()
    if (!text) return false
    return entries.some(entry => (
      entry.role === role &&
      [entry.name, entry.battletag, entry.raw].map(item => clean(item).toLowerCase()).includes(text)
    ))
  }

  splitStaffText(getFirst(team?.team_manager, team?.teamManager, team?.manager, team?.managerNickname)).forEach((name, index) => {
    const key = `manager:${name}:`.toLowerCase()
    if (existingKeys.has(key) || hasStaffValue('manager', name)) return
    entries.push({
      id: `${teamStableId}:staff:manager:fallback-${index + 1}:${slug(name)}`,
      name,
      role: 'manager',
      battletag: '',
      raw: name,
      extras: { sourceField: 'team_manager' }
    })
    existingKeys.add(key)
  })

  splitStaffText(getFirst(team?.team_coach, team?.teamCoach, team?.coach, team?.coachNickname)).forEach((name, index) => {
    const key = `coach:${name}:`.toLowerCase()
    if (existingKeys.has(key) || hasStaffValue('coach', name)) return
    entries.push({
      id: `${teamStableId}:staff:coach:fallback-${index + 1}:${slug(name)}`,
      name,
      role: 'coach',
      battletag: '',
      raw: name,
      extras: { sourceField: 'team_coach' }
    })
    existingKeys.add(key)
  })

  return entries
}

const normalizePlayer = (player, teamStableId, options) => {
  const sourcePlayerId = getSourcePlayerId(player) || `${teamStableId}:player:${slug(player?.player_name || player?.name)}`
  const displayName = getFirst(player?.display_name, player?.displayName)
  const nickname = getFirst(player?.nickname)
  const battletag = getFirst(player?.battleTag, player?.battle_tag, player?.battletag, player?.player_name, player?.playerName, player?.name)
  const playerName = getFirst(displayName, nickname, stripBattleTag(battletag), battletag, sourcePlayerId)

  return {
    id: `fc-system:${options.seasonId}:${sourcePlayerId}`,
    sourcePlayerId,
    name: playerName,
    displayName,
    nickname,
    battletag,
    role: normalizeRole(player?.role),
    rank: getFirst(player?.rank),
    status: getFirst(player?.status),
    joinStage: getFirst(player?.join_stage, player?.joinStage),
    allowedFlex: player?.allowed_flex ?? player?.allowedFlex ?? null,
    avatar: getFirst(player?.avatar, player?.portrait, player?.player_image),
    heroImage: getFirst(player?.heroImage),
    extras: {
      ...pickExtras(player, KNOWN_PLAYER_FIELDS),
      raw: clone(player),
      adminNotes: clone(player?.admin_notes ?? player?.adminNotes ?? ''),
      historicalMatchLogs: clone(player?.historical_match_logs ?? player?.historicalMatchLogs ?? []),
      liveMatchLogs: clone(player?.live_match_logs ?? player?.liveMatchLogs ?? []),
      matchLogs: clone(player?.match_logs ?? player?.matchLogs ?? [])
    }
  }
}

const getPayload = payload => {
  if (Array.isArray(payload?.teams) || Array.isArray(payload?.players)) return payload
  if (payload?.payload) return getPayload(payload.payload)
  if (payload?.data) return getPayload(payload.data)
  if (payload?.artifact?.payload) return getPayload(payload.artifact.payload)
  return {}
}

const getTeamPlayers = (team, payloadPlayers) => {
  if (Array.isArray(team?.players)) return team.players
  if (Array.isArray(team?.roster)) return team.roster

  const teamId = getSourceTeamId(team)
  const declaredPlayerIds = new Set(Array.isArray(team?.player_ids) ? team.player_ids : team?.playerIds || [])

  return payloadPlayers.filter(player => (
    getPlayerSourceTeamId(player) === teamId ||
    declaredPlayerIds.has(getSourcePlayerId(player))
  ))
}

const getReviewByTeamId = payload => new Map((Array.isArray(payload.team_reviews) ? payload.team_reviews : payload.teamReviews || [])
  .map(review => [getFirst(review?.team_id, review?.teamId, review?.id), review])
  .filter(([teamId]) => teamId))

export const normalizePublishedTeamDirectory = (inputPayload, optionsInput = {}) => {
  const payload = getPayload(inputPayload)
  const seasonId = clean(optionsInput.seasonId) || 'FCA26'
  const version = clean(optionsInput.version) || 'latest'
  const sourceUrl = clean(optionsInput.sourceUrl)
  const source = clean(optionsInput.source) || 'fc-system-published'
  const payloadTeams = Array.isArray(payload.teams) ? payload.teams : []
  const payloadPlayers = Array.isArray(payload.players) ? payload.players : []
  const reviewByTeamId = getReviewByTeamId(payload)

  const teams = payloadTeams.map((team, index) => {
    const sourceTeamId = getSourceTeamId(team) || `team-${index + 1}`
    const teamStableId = `fc-system:${seasonId}:${sourceTeamId}`
    const name = getTeamName(team)
    const shortName = getTeamShortName(team)
    const explicitLogo = getTeamLogo(team)
    const logoResolution = resolvePublishedTeamLogo({
      ...team,
      sourceTeamId,
      name,
      shortName,
      logo: explicitLogo
    })
    const teamPlayers = getTeamPlayers(team, payloadPlayers)
      .map(player => normalizePlayer(player, teamStableId, { seasonId }))

    const staff = normalizeStaff(team, teamStableId)
    const manager = staff.find(item => item.role === 'manager')?.name || getFirst(team?.team_manager, team?.manager)
    const coaches = staff.filter(item => item.role === 'coach')
    const review = reviewByTeamId.get(sourceTeamId)

    return {
      id: teamStableId,
      sourceTeamId,
      name,
      shortName,
      logo: logoResolution.resolvedUrl,
      logoResolution,
      primaryColor: '',
      players: teamPlayers,
      staff,
      source,
      sourceUrl,
      updatedAt: getFirst(payload.updated_at, payload.updatedAt, payload.review_ready_at),
      seasonId,
      version,
      extras: {
        ...pickExtras(team, KNOWN_TEAM_FIELDS),
        raw: clone(team),
        club: getFirst(team?.team_club, team?.teamClub, team?.club),
        manager,
        coaches: coaches.map(item => item.name),
        finalRank: team?.final_rank ?? team?.finalRank ?? null,
        finalRankText: getFirst(team?.final_rank_text, team?.finalRankText),
        logoResolution,
        review: clone(review)
      }
    }
  })

  return {
    status: 'READY',
    source,
    sourceUrl,
    seasonId,
    version,
    schemaVersion: getFirst(payload.schema_version, payload.schemaVersion, payload.meta?.schema_version),
    contractVersion: getFirst(payload.meta?.contract_version, payload.meta?.contractVersion),
    updatedAt: getFirst(payload.updated_at, payload.updatedAt),
    reviewReadyAt: getFirst(payload.review_ready_at, payload.reviewReadyAt),
    reviewSchemaVersion: getFirst(payload.review_schema_version, payload.reviewSchemaVersion),
    rawMeta: clone(payload.meta || null),
    counts: {
      teams: payloadTeams.length,
      players: payloadPlayers.length,
      matches: Array.isArray(payload.matches) ? payload.matches.length : 0,
      playerTotals: Array.isArray(payload.player_totals) ? payload.player_totals.length : Array.isArray(payload.playerTotals) ? payload.playerTotals.length : 0,
      teamReviews: Array.isArray(payload.team_reviews) ? payload.team_reviews.length : Array.isArray(payload.teamReviews) ? payload.teamReviews.length : 0
    },
    extras: pickExtras(payload, KNOWN_TOP_LEVEL_FIELDS),
    teams
  }
}
