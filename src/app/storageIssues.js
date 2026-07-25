const normalizeOperation = value => String(value || '').trim()

export const recordStorageIssue = (issues, detail = {}) => {
  const operation = normalizeOperation(detail.operation)
  if (!operation) return issues

  const next = new Map(issues)
  next.delete(operation)
  next.set(operation, {
    operation,
    name: String(detail.name || ''),
    serializedBytes: Number(detail.serializedBytes || 0)
  })
  return next
}

export const resolveStorageIssue = (issues, operationValue) => {
  const operation = normalizeOperation(operationValue)
  if (!operation || !issues.has(operation)) return issues

  const next = new Map(issues)
  next.delete(operation)
  return next
}

export const getLatestStorageIssue = issues => {
  let latest = null
  issues.forEach(issue => {
    latest = issue
  })
  return latest
}
