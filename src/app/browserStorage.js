export const getBrowserLocalStorage = (
  windowLike = typeof window === 'undefined' ? null : window
) => {
  try {
    return windowLike?.localStorage || null
  } catch {
    return null
  }
}
