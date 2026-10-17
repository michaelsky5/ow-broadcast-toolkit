export const DEFAULT_ROSTER_LIMIT = 7
export const MIN_ROSTER_LIMIT = 5
export const MAX_ROSTER_LIMIT = 12
export const MIN_ACTIVE_ROSTER_PLAYERS = 5

export const normalizeRosterLimit = value => {
  if (value === null || value === undefined || value === '') return DEFAULT_ROSTER_LIMIT
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_ROSTER_LIMIT
  return Math.max(MIN_ROSTER_LIMIT, Math.min(MAX_ROSTER_LIMIT, Math.trunc(number)))
}

export const getRosterLimit = project => normalizeRosterLimit(project?.event?.rosterLimit)

// A limit controls output, never the stored team. Players beyond it remain selectable.
export const getRosterOutputIds = (players, savedIds = [], limit = DEFAULT_ROSTER_LIMIT) => {
  const rosterIds = [...new Set(players.map(player => player.id).filter(Boolean))]
  const savedIdSet = new Set(savedIds)
  const selectedIds = rosterIds.filter(id => savedIdSet.has(id)).slice(0, normalizeRosterLimit(limit))
  const minimum = Math.min(MIN_ACTIVE_ROSTER_PLAYERS, rosterIds.length)

  if (selectedIds.length >= minimum) return selectedIds

  const selectedIdSet = new Set(selectedIds)
  const filledIds = new Set([
    ...selectedIds,
    ...rosterIds.filter(id => !selectedIdSet.has(id)).slice(0, minimum - selectedIds.length)
  ])
  return rosterIds.filter(id => filledIds.has(id))
}

export const toggleRosterOutputId = (players, savedIds, playerId, nextActive, limit = DEFAULT_ROSTER_LIMIT) => {
  if (!players.some(player => player.id === playerId)) return null
  const rosterLimit = normalizeRosterLimit(limit)
  const currentIds = getRosterOutputIds(players, savedIds, rosterLimit)
  if (currentIds.includes(playerId) === nextActive) return null

  if (!nextActive) {
    return currentIds.length > MIN_ACTIVE_ROSTER_PLAYERS ? currentIds.filter(id => id !== playerId) : null
  }
  if (currentIds.length < rosterLimit) return [...currentIds, playerId]
  // At a five-player limit there is no spare slot for an add-then-remove swap.
  if (rosterLimit === MIN_ACTIVE_ROSTER_PLAYERS) return [...currentIds.slice(0, -1), playerId]
  return null
}
