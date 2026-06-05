import styles from './OpeningScene.module.css'

const clean = value => String(value || '').trim()
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const getEditableText = (settings, key, fallback = '') => (
  hasOwn(settings, key) ? clean(settings[key]) : clean(fallback)
)

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = '/OW.svg'
}

export default function OpeningScene({ project }) {
  const settings = project?.scenes?.settings?.opening || {}
  const competitionNameEn = getEditableText(settings, 'competitionNameEn', project?.event?.nameEn || project?.event?.name)
  const competitionNameZh = getEditableText(settings, 'competitionNameZh', project?.event?.nameZh)
  const eventName = competitionNameEn || competitionNameZh
  const title = getEditableText(settings, 'title', eventName)
  const subtitle = getEditableText(settings, 'subtitle', project?.event?.subtitle)
  const statusLabel = getEditableText(settings, 'statusLabel', 'STANDBY')
  const logo = clean(project?.event?.logo || project?.event?.organizerLogo)
  const showLogo = settings.showEventLogo !== false && Boolean(logo)
  const backgroundImage = clean(project?.theme?.backgroundImage)
  const backgroundOpacity = Number(project?.theme?.backgroundOpacity ?? 0.35)

  const sceneStyle = {
    '--opening-background-image': backgroundImage ? `url("${backgroundImage}")` : 'none',
    '--opening-background-opacity': Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0.35
  }

  return (
    <div className={styles.scene} style={sceneStyle}>
      <div className={styles.imageLayer} />
      <div className={styles.gridLayer} />
      <div className={styles.scanlineLayer} />
      <div className={styles.primaryGlow} />
      <div className={styles.edgeGlow} />

      <header className={styles.topBar}>
        <strong>{eventName}</strong>
        <span>OPENING</span>
        {statusLabel && (
          <p>
            <i />
            {statusLabel}
          </p>
        )}
      </header>

      <main className={`${styles.heroStage} ${showLogo ? '' : styles.heroStageNoLogo}`}>
        {title && (
          <div className={styles.heroBackdrop}>
            <span>{title}</span>
          </div>
        )}

        {showLogo && (
          <div className={styles.eventLogoMark}>
            <img className={styles.logo} src={logo} alt="" onError={handleImageFallback} />
          </div>
        )}

        <section className={styles.heroCopy}>
          {competitionNameEn && <span>{competitionNameEn}</span>}
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
          {competitionNameZh && <em>{competitionNameZh}</em>}
        </section>
      </main>
    </div>
  )
}
