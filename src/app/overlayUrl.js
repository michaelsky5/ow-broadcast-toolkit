import { buildSessionOverlayUrl } from '../project/projectSession'

export const getOverlayUrl = (project, options = {}) => {
  if (typeof window === 'undefined') return project?.output?.overlayPath || '/overlay'
  if (options.sessionId) return buildSessionOverlayUrl(options.sessionId, window.location)

  const { origin, pathname } = window.location
  return `${origin}${pathname}#overlay`
}
