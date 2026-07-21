import {
  MATCH_PACKAGE_ERROR_CODES,
  MATCH_PACKAGE_MAX_BYTES,
  MATCH_PACKAGE_TEAM_COUNT,
  createMatchPackage,
  getMatchPackageByteSize
} from './matchPackage'

export const MATCH_PACKAGE_HEALTH_STATUS = Object.freeze({
  INCOMPLETE: 'incomplete',
  READY: 'ready',
  WARNING: 'warning',
  BLOCKED: 'blocked'
})

export const MATCH_PACKAGE_HEALTH_CODES = Object.freeze({
  MISSING_LOGO: 'missing-logo',
  SHORT_ROSTER: 'short-roster',
  LARGE_LOGO: 'large-logo',
  LARGE_AVATAR: 'large-avatar',
  DUPLICATE_PLAYER: 'duplicate-player',
  LARGE_PACKAGE: 'large-package',
  TOO_LARGE: 'too-large',
  DUPLICATE_TEAMS: 'duplicate-teams',
  INVALID_PACKAGE: 'invalid-package'
})

const TEAM_LOGO_WARNING_BYTES = 320 * 1024
const PLAYER_AVATAR_WARNING_BYTES = 180 * 1024
const PACKAGE_WARNING_BYTES = MATCH_PACKAGE_MAX_BYTES * 0.75
const RECOMMENDED_ROSTER_SIZE = 5

const clean = value => String(value || '').trim()
const normalizeIdentity = value => clean(value).toLocaleLowerCase().replace(/\s+/g, ' ')

export const getDataUrlByteSize = value => {
  const text = clean(value)
  if (!text.startsWith('data:')) return 0

  const commaIndex = text.indexOf(',')
  if (commaIndex < 0) return 0
  const metadata = text.slice(0, commaIndex)
  const payload = text.slice(commaIndex + 1)

  if (/;base64(?:;|$)/i.test(metadata)) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength
  } catch {
    return new TextEncoder().encode(payload).byteLength
  }
}

const getPlayerIdentity = player => {
  const battleTag = normalizeIdentity(player?.battleTag)
  if (battleTag) return `battle:${battleTag}`
  const name = normalizeIdentity(player?.name)
  return name ? `name:${name}` : ''
}

const inspectTeam = (team, side, issues) => {
  const teamName = clean(team?.shortName || team?.name) || side
  const logoBytes = getDataUrlByteSize(team?.logo)
  const players = Array.isArray(team?.players) ? team.players : []

  if (!clean(team?.logo)) {
    issues.push({ code: MATCH_PACKAGE_HEALTH_CODES.MISSING_LOGO, severity: 'warning', side, teamName })
  } else if (logoBytes > TEAM_LOGO_WARNING_BYTES) {
    issues.push({
      code: MATCH_PACKAGE_HEALTH_CODES.LARGE_LOGO,
      severity: 'warning',
      side,
      teamName,
      bytes: logoBytes
    })
  }

  if (players.length < RECOMMENDED_ROSTER_SIZE) {
    issues.push({
      code: MATCH_PACKAGE_HEALTH_CODES.SHORT_ROSTER,
      severity: 'warning',
      side,
      teamName,
      count: players.length
    })
  }

  const playerIdentityCounts = new Map()
  players.forEach(player => {
    const avatarBytes = getDataUrlByteSize(player?.avatar)
    if (avatarBytes > PLAYER_AVATAR_WARNING_BYTES) {
      issues.push({
        code: MATCH_PACKAGE_HEALTH_CODES.LARGE_AVATAR,
        severity: 'warning',
        side,
        teamName,
        playerName: clean(player?.name) || '-',
        bytes: avatarBytes
      })
    }

    const identity = getPlayerIdentity(player)
    if (identity) playerIdentityCounts.set(identity, (playerIdentityCounts.get(identity) || 0) + 1)
  })

  playerIdentityCounts.forEach((count, identity) => {
    if (count < 2) return
    issues.push({
      code: MATCH_PACKAGE_HEALTH_CODES.DUPLICATE_PLAYER,
      severity: 'warning',
      side,
      teamName,
      playerName: identity.slice(identity.indexOf(':') + 1),
      count
    })
  })
}

export const analyzeMatchPackageHealth = records => {
  if (!Array.isArray(records) || records.length !== MATCH_PACKAGE_TEAM_COUNT) {
    return {
      status: MATCH_PACKAGE_HEALTH_STATUS.INCOMPLETE,
      issues: [],
      packageBytes: 0
    }
  }

  const issues = []
  let packageBytes = 0

  inspectTeam(records[0], 'A', issues)
  inspectTeam(records[1], 'B', issues)

  try {
    packageBytes = getMatchPackageByteSize(createMatchPackage(records))
  } catch (error) {
    issues.unshift({
      code: error?.code === MATCH_PACKAGE_ERROR_CODES.DUPLICATE_TEAMS
        ? MATCH_PACKAGE_HEALTH_CODES.DUPLICATE_TEAMS
        : MATCH_PACKAGE_HEALTH_CODES.INVALID_PACKAGE,
      severity: 'blocked'
    })
  }

  if (packageBytes > MATCH_PACKAGE_MAX_BYTES) {
    issues.unshift({
      code: MATCH_PACKAGE_HEALTH_CODES.TOO_LARGE,
      severity: 'blocked',
      bytes: packageBytes
    })
  } else if (packageBytes >= PACKAGE_WARNING_BYTES) {
    issues.unshift({
      code: MATCH_PACKAGE_HEALTH_CODES.LARGE_PACKAGE,
      severity: 'warning',
      bytes: packageBytes
    })
  }

  return {
    status: issues.some(issue => issue.severity === 'blocked')
      ? MATCH_PACKAGE_HEALTH_STATUS.BLOCKED
      : issues.length
        ? MATCH_PACKAGE_HEALTH_STATUS.WARNING
        : MATCH_PACKAGE_HEALTH_STATUS.READY,
    issues,
    packageBytes
  }
}
