export const APP_ROUTES = Object.freeze({
  ROOT: 'root',
  CONTROL: 'control',
  LIBRARY: 'library',
  OVERLAY: 'overlay'
})

export const getAppRouteFromHash = hash => {
  const normalizedHash = String(hash || '')
  if (normalizedHash.startsWith('#overlay')) return APP_ROUTES.OVERLAY
  if (normalizedHash === '#library') return APP_ROUTES.LIBRARY
  if (normalizedHash === '#control') return APP_ROUTES.CONTROL
  return APP_ROUTES.ROOT
}

export const getAppRoute = () => (
  typeof window === 'undefined'
    ? APP_ROUTES.ROOT
    : getAppRouteFromHash(window.location.hash)
)

export const getAppRouteHash = route => {
  if (route === APP_ROUTES.OVERLAY) return '#overlay'
  if (route === APP_ROUTES.LIBRARY) return '#library'
  if (route === APP_ROUTES.CONTROL) return '#control'
  return ''
}

export const getAppRouteUrl = (location, hash) => (
  `${location.pathname}${location.search}${hash}`
)
