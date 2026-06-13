import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getSceneById } from '../scenes/registry'
import styles from './ProgramPreview.module.css'

const PROGRAM_WIDTH = 1920
const PROGRAM_HEIGHT = 1080
const TRANSITION_SPEEDS = {
  fast: { mask: 420, resolve: 340 },
  normal: { mask: 620, resolve: 520 },
  slow: { mask: 820, resolve: 700 }
}
const DEFAULT_TRANSITION_MARK = '/brand/icon/owbt-transition-mono.png'
const clean = value => String(value || '').trim()

const getTransitionLogoSource = (project, logoMode) => {
  if (logoMode === 'ow') return DEFAULT_TRANSITION_MARK
  if (logoMode === 'event') return clean(project?.event?.logo || project?.event?.organizerLogo)
  return ''
}

const normalizeTransitionMode = mode => {
  if (mode === 'cut') return 'none'
  return mode || 'scan'
}

const getTransitionIdentity = project => [
  project?.scenes?.activeSceneId || '',
  project?.scenes?.takeTransitionId || ''
].join(':')

const getTransitionLogoShape = (width, height) => {
  if (!width || !height) return 'square'
  const ratio = width / height
  if (ratio >= 1.45) return 'wide'
  if (ratio <= 0.72) return 'tall'
  return 'square'
}

const handleTransitionLogoError = event => {
  event.currentTarget.style.display = 'none'
}

export default function ProgramPreview({
  project,
  bare = false,
  transitionMode = 'scan',
  transitionSpeed = 'normal',
  transitionLogo = 'off'
}) {
  const frameRef = useRef(null)
  const transitionIdentity = getTransitionIdentity(project)
  const previousTransitionIdentityRef = useRef(transitionIdentity)
  const [scale, setScale] = useState(1)
  const [transitionKey, setTransitionKey] = useState(0)
  const [transitionLogoProbe, setTransitionLogoProbe] = useState({ source: '', shape: 'square' })
  const scene = getSceneById(project.scenes.activeSceneId)
  const SceneComponent = scene.component
  const normalizedTransitionMode = normalizeTransitionMode(transitionMode)
  const transitionTiming = TRANSITION_SPEEDS[transitionSpeed] || TRANSITION_SPEEDS.normal
  const shouldAnimateScene = transitionKey > 0 && normalizedTransitionMode !== 'none'
  const shouldShowTransitionLogo = shouldAnimateScene && normalizedTransitionMode !== 'simple'
  const configuredTransitionLogoSource = getTransitionLogoSource(project, transitionLogo)
  const transitionLogoSource = shouldAnimateScene ? configuredTransitionLogoSource : ''
  const transitionLogoShape = transitionLogoProbe.source === configuredTransitionLogoSource
    ? transitionLogoProbe.shape
    : 'square'
  const transitionClassName = [
    styles.sceneTransition,
    normalizedTransitionMode === 'simple' ? styles.sceneTransitionSimple : styles.sceneTransitionBrand
  ].join(' ')
  const transitionLogoClassName = [
    styles.transitionLogo,
    transitionLogo === 'event' ? styles.transitionLogoEvent : styles.transitionLogoBrand,
    transitionLogo === 'event' && transitionLogoShape === 'wide' ? styles.transitionLogoEventWide : '',
    transitionLogo === 'event' && transitionLogoShape === 'tall' ? styles.transitionLogoEventTall : ''
  ].filter(Boolean).join(' ')

  useLayoutEffect(() => {
    if (!frameRef.current || typeof ResizeObserver === 'undefined') return undefined

    const frame = frameRef.current
    const syncScale = rect => {
      if (!rect?.width || !rect?.height) return
      setScale(Math.min(rect.width / PROGRAM_WIDTH, rect.height / PROGRAM_HEIGHT))
    }

    syncScale(frame.getBoundingClientRect())

    const resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      syncScale(rect)
    })

    resizeObserver.observe(frame)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (transitionLogo !== 'event' || !configuredTransitionLogoSource || typeof Image === 'undefined') return undefined

    let isCurrent = true
    const image = new Image()
    image.onload = () => {
      if (isCurrent) {
        setTransitionLogoProbe({
          source: configuredTransitionLogoSource,
          shape: getTransitionLogoShape(image.naturalWidth, image.naturalHeight)
        })
      }
    }
    image.src = configuredTransitionLogoSource

    return () => {
      isCurrent = false
    }
  }, [configuredTransitionLogoSource, transitionLogo])

  useLayoutEffect(() => {
    if (previousTransitionIdentityRef.current === transitionIdentity) return

    previousTransitionIdentityRef.current = transitionIdentity
    setTransitionKey(key => key + 1)
  }, [transitionIdentity])

  const handleTransitionLogoLoad = event => {
    if (transitionLogo !== 'event') return
    setTransitionLogoProbe({
      source: configuredTransitionLogoSource,
      shape: getTransitionLogoShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
    })
  }

  return (
    <div ref={frameRef} className={bare ? styles.bareFrame : styles.frame}>
      <div
        className={bare ? styles.bareCanvas : styles.canvas}
        style={{
          '--owbt-scene-resolve-duration': `${transitionTiming.resolve}ms`,
          '--owbt-transition-duration': `${transitionTiming.mask}ms`,
          transform: `scale(${scale})`
        }}
      >
        <div
          key={project.scenes.activeSceneId}
          className={`${styles.sceneMount} ${shouldAnimateScene ? styles.sceneMountActive : ''}`}
        >
          <SceneComponent project={project} scene={scene} />
        </div>
        {shouldAnimateScene && (
          <div
            key={transitionKey}
            className={transitionClassName}
            data-owbt-transition-key={transitionKey}
            aria-hidden="true"
          >
            {transitionLogoSource && shouldShowTransitionLogo && (
              <div className={transitionLogoClassName}>
                <img
                  src={transitionLogoSource}
                  alt=""
                  onError={handleTransitionLogoError}
                  onLoad={handleTransitionLogoLoad}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
