import styles from './WebAccessLinks.module.css'

// Frozen baseline verified on its public host and in an actual OBS dock/source pair.
const stableUrl = import.meta.env.VITE_OWBT_STABLE_URL?.trim() || 'https://owbt-stable.fries-cup.com/'

export default function WebAccessLinks({ copy }) {
  return (
    <section className={styles.access} aria-label={copy.webAccessTitle}>
      <a className={styles.guide} href="/guide/" target="_blank" rel="noopener noreferrer">
        <span className={styles.guideIcon} aria-hidden="true"><span /></span>
        <span className={styles.guideContent}>
          <span className={styles.kicker}>{copy.webGuideTitle}</span>
          <strong>{copy.webGuideLink}</strong>
          <span className={styles.guideHint}>{copy.webGuideHint}</span>
        </span>
        <span className={styles.externalIcon} aria-hidden="true" />
      </a>

      <div className={styles.sites}>
        <div className={styles.siteHeading}>
          <h2>{copy.webAccessTitle}</h2>
          <span>{copy.webAccessRegionHint}</span>
        </div>
        <nav className={styles.siteLinks} aria-label={copy.webAccessTitle}>
          <a href="https://owbt.fries-cup.com/" target="_blank" rel="noopener noreferrer">
            <strong>{copy.webAccessGlobal}</strong>
            <span>{copy.webAccessGlobalHint}</span>
            <span className={styles.externalIcon} aria-hidden="true" />
          </a>
          <a href="https://owbt-cn.fries-cup.com/" target="_blank" rel="noopener noreferrer">
            <strong>{copy.webAccessMainland}</strong>
            <span>{copy.webAccessMainlandHint}</span>
            <span className={styles.externalIcon} aria-hidden="true" />
          </a>
          {stableUrl && (
            <a className={styles.stable} href={stableUrl} target="_blank" rel="noopener noreferrer">
              <strong>{copy.webAccessStable}</strong>
              <span>{copy.webAccessStableHint}</span>
              <span className={styles.externalIcon} aria-hidden="true" />
            </a>
          )}
        </nav>
      </div>

      <div className={styles.backupHint}>
        <strong>{copy.webAccessBackupTitle}</strong>
        <p>{copy.webAccessBackupHint}</p>
        <a className={styles.feedbackLink} href={`/feedback/?lang=${copy.feedbackLanguage}`} target="_blank" rel="noopener noreferrer">
          {copy.feedbackCenter}
          <span className={styles.externalIcon} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
