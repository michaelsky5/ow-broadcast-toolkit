export const CLIPBOARD_COPY_TIMEOUT_MS = 1200

export async function tryCopyText(text, clipboard = globalThis.navigator?.clipboard, timeoutMs = CLIPBOARD_COPY_TIMEOUT_MS) {
  if (!clipboard?.writeText) return false
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(() => clipboard.writeText(text)).then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs) })
    ])
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
