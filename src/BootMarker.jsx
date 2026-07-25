import { useEffect } from 'react'

const BootMarker = () => {
  useEffect(() => {
    window.__OWBT_MARK_BOOTED__?.()
  }, [])

  return null
}

export default BootMarker
