export const getOverlayUrl = project => {
  if (typeof window === 'undefined') return project?.output?.overlayPath || '/overlay'

  const { origin, pathname } = window.location
  return `${origin}${pathname}#overlay`
}
