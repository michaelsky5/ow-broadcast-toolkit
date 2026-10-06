export const STAT_FIELDS = ['elim', 'ast', 'dth', 'dmg', 'heal', 'block']
export const TEAM_KEYS = ['teamA', 'teamB']
const clean = value => String(value ?? '').trim()

export const isDurationInputValid = value => {
  const text = clean(value).replace(/\uFF1A/g, ':')
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) > 0
  const match = text.match(/^(\d+):(\d{1,2})$/)
  return Boolean(match && Number(match[2]) < 60 && (Number(match[1]) > 0 || Number(match[2]) > 0))
}

export const isCaptureCellPending = (diagnostic, value) => Boolean(
  diagnostic && clean(value)
  && !(diagnostic.reviewedValue === clean(value))
  && !(diagnostic.autoApply && clean(diagnostic.selectedValue) === clean(value))
)

export const isCaptureTimePending = (review, value) => Boolean(
  review && !(review.reviewedValue === clean(value))
  && !(review.autoApply && clean(review.value) === clean(value))
)

export const reviewCaptureDiagnostics = (diagnostics, rows) => Object.fromEntries(TEAM_KEYS.map(team => [
  team, (diagnostics?.[team] || []).map((row, index) => Object.fromEntries(STAT_FIELDS.map(field => [
    field, { ...row[field], reviewedValue: clean(rows?.[team]?.[index]?.[field]) }
  ])))
]))

export const reviewCaptureRow = (diagnostics, rows, team, index) => {
  const values = rows?.[team]?.[index]
  if (!TEAM_KEYS.includes(team) || !values
    || !STAT_FIELDS.every(field => /^\d{1,6}$/.test(clean(values[field])))) return diagnostics
  const teamDiagnostics = [...(diagnostics?.[team] || [])]
  teamDiagnostics[index] = Object.fromEntries(STAT_FIELDS.map(field => [
    field, { ...teamDiagnostics[index]?.[field], reviewedValue: clean(values[field]) }
  ]))
  return { ...diagnostics, [team]: teamDiagnostics }
}

export const validateCaptureData = ({ rows, playerIds, playerOptions, timeInput, diagnostics, timeReview, bindingsReviewed, stale = false }) => {
  const issues = []
  const pending = []
  const seen = new Set()
  let activeRows = 0
  if (!isDurationInputValid(timeInput)) issues.push({ kind: 'time' })
  for (const team of TEAM_KEYS) {
    for (const [index, row] of (rows?.[team] || []).entries()) {
      const values = STAT_FIELDS.map(field => clean(row[field]))
      // Manual entry may contain a subset of players; an OCR run expects all five.
      if (!values.some(Boolean) && !diagnostics?.[team]?.[index]) continue
      activeRows += 1
      for (const [fieldIndex, field] of STAT_FIELDS.entries()) {
        if (!/^\d{1,6}$/.test(values[fieldIndex])) issues.push({ kind: 'missing', team, index, field })
        else if (isCaptureCellPending(diagnostics?.[team]?.[index]?.[field], values[fieldIndex])) {
          pending.push({ kind: 'number', team, index, field })
        }
      }
      const playerId = playerIds?.[team]?.[index] || ''
      if (!playerId || !(playerOptions?.[team] || []).some(player => player.id === playerId)) {
        issues.push({ kind: 'player', team, index })
      } else if (seen.has(playerId)) issues.push({ kind: 'duplicate', team, index })
      seen.add(playerId)
    }
  }
  if (!activeRows) issues.push({ kind: 'empty' })
  if (stale && activeRows) issues.push({ kind: 'stale' })
  if (!bindingsReviewed && activeRows) issues.push({ kind: 'bindings' })
  if (isCaptureTimePending(timeReview, timeInput)) pending.push({ kind: 'time-review' })
  return { issues, pending, activeRows, canApply: !issues.length && !pending.length }
}
