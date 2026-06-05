import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './MediaScene.module.css'

const clean = value => String(value || '').trim()

const normalizeMode = value => String(value || '').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'
const getPlaylist = settings => Array.isArray(settings.videoPlaylist) ? settings.videoPlaylist.map(clean).filter(Boolean) : []
function CleanVideoScene({ settings }) {
  const videoRef = useRef(null)
  const playlist = useMemo(() => getPlaylist(settings), [settings])
  const globalActiveVideo = clean(settings.activeVideoPath)
  const [queuePlayback, setQueuePlayback] = useState({ origin: '', path: '' })
  const renderMode = settings.videoRenderMode || 'WEB'
  const isOBSLocal = renderMode === 'OBS_LOCAL'
  const queuedVideo = queuePlayback.origin === globalActiveVideo ? queuePlayback.path : ''
  const currentVideo = queuedVideo || globalActiveVideo || playlist[0] || ''
  const isOverlay = typeof window !== 'undefined' && window.location.hash.startsWith('#overlay')
  const muted = settings.muted !== false
  const forceMuted = !isOverlay || muted
  const autoPlay = settings.autoPlay !== false
  const loop = settings.loop !== false
  const fitClass = settings.fitMode === 'cover' ? styles.fitCover : styles.fitContain

  useEffect(() => {
    if (!autoPlay || isOBSLocal || !videoRef.current || !currentVideo) return

    videoRef.current.muted = forceMuted
    videoRef.current.play().catch(() => {})
  }, [autoPlay, currentVideo, forceMuted, isOBSLocal])

  const handleVideoEnded = () => {
    if (!loop && playlist.length <= 1) return

    if (playlist.length <= 1) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
      }
      return
    }

    const currentIndex = playlist.indexOf(currentVideo)
    const nextIndex = currentIndex !== -1 && currentIndex < playlist.length - 1 ? currentIndex + 1 : 0
    setQueuePlayback({ origin: globalActiveVideo, path: playlist[nextIndex] || '' })
  }

  return (
    <div className={`${styles.scene} ${isOBSLocal ? styles.sceneTransparent : ''}`}>
      <section className={`${styles.cleanVideo} ${fitClass}`}>
        {isOBSLocal ? (
          <div className={styles.cleanVideoEmpty} />
        ) : currentVideo ? (
          <video
            key={currentVideo}
            ref={videoRef}
            src={currentVideo}
            autoPlay={autoPlay}
            muted={forceMuted}
            playsInline
            onEnded={handleVideoEnded}
          />
        ) : (
          <div className={styles.cleanVideoEmpty} />
        )}
      </section>
    </div>
  )
}

function HighlightScene({ settings }) {
  const label = clean(settings.highlightLabel || settings.title) || 'HIGHLIGHT'
  const showLabel = settings.showHighlightLabel !== false

  return (
    <div className={`${styles.scene} ${styles.sceneTransparent}`}>
      {showLabel && (
        <div className={styles.highlightTag}>
          <span />
          <strong>{label}</strong>
        </div>
      )}
    </div>
  )
}

export default function MediaScene({ project }) {
  const settings = project?.scenes?.settings?.media || {}
  const mode = normalizeMode(settings.mode)

  if (mode === 'VIDEO') {
    return <CleanVideoScene settings={settings} />
  }

  return <HighlightScene settings={settings} />
}
