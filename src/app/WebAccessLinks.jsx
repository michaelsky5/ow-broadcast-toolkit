import styles from './WebAccessLinks.module.css'

// Enable only after the frozen deployment has a verified public address.
const stableUrl = import.meta.env.VITE_OWBT_STABLE_URL?.trim() || ''

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
    </section>
  )
}
