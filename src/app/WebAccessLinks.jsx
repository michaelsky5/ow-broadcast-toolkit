import styles from './WebAccessLinks.module.css'

// Frozen baseline verified on its public host and in an actual OBS dock/source pair.
const stableUrl = import.meta.env.VITE_OWBT_STABLE_URL?.trim() || 'https://owbt-stable.fries-cup.com/'

export default function WebAccessLinks({ copy }) {
  return (
    <section className={styles.access} aria-label={copy.webAccessTitle}>
      <div className={styles.row}>
        <strong>{copy.webAccessTitle}</strong>
        <nav aria-label={copy.webAccessTitle}>
          <a href="https://owbt.fries-cup.com/" target="_blank" rel="noopener noreferrer">{copy.webAccessGlobal}</a>
          <a href="https://owbt-cn.fries-cup.com/" target="_blank" rel="noopener noreferrer">{copy.webAccessMainland}</a>
          {stableUrl && <a href={stableUrl} target="_blank" rel="noopener noreferrer">{copy.webAccessStable}</a>}
        </nav>
      </div>
      <p>{copy.webAccessBackupHint}</p>
      <div className={styles.guideRow}>
        <strong>{copy.webGuideTitle}</strong>
        <a href="/guide/" target="_blank" rel="noopener noreferrer">{copy.webGuideLink}</a>
      </div>
    </section>
  )
}
