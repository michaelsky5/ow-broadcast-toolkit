export const OWBT_MAX_EMBEDDED_DATA_URL_BYTES = 768 * 1024

const getUtf8ByteLength = value => {
  const text = String(value || '')
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).byteLength
  return unescape(encodeURIComponent(text)).length
}

const walkValues = (value, visit, seen = new WeakSet()) => {
  if (typeof value === 'string') {
    visit(value)
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return

  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach(item => walkValues(item, visit, seen))
    return
  }
  Object.values(value).forEach(item => walkValues(item, visit, seen))
}

export const findUnsafeStoredMedia = project => {
  let issue = null

  walkValues(project, value => {
    if (issue) return
    const source = value.trim()

    if (/^blob:/i.test(source) || /^data:(?:video|audio)\//i.test(source)) {
      issue = {
        kind: 'unsupported-embedded-media',
        bytes: getUtf8ByteLength(source)
      }
      return
    }

    if (/^data:/i.test(source)) {
      const bytes = getUtf8ByteLength(source)
      if (bytes > OWBT_MAX_EMBEDDED_DATA_URL_BYTES) {
        issue = {
          kind: 'embedded-media-too-large',
          bytes
        }
      }
    }
  })

  return issue
}
