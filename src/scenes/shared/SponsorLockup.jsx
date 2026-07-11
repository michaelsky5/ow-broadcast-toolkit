import styles from './SponsorLockup.module.css'

const clean = value => String(value || '').trim()

const VARIANT_LIMITS = {
  full: 3,
  compact: 2,
  mark: 1
}

const VARIANT_LABELS = {
  full: 'Presented By',
  compact: 'Supported By',
  mark: 'Partner'
}

const getActiveSponsors = project => (
  Array.isArray(project?.assets?.sponsors?.logos)
    ? project.assets.sponsors.logos.filter(slot => (
      slot?.enabled !== false && (clean(slot?.logo) || clean(slot?.name))
    ))
    : []
)

export default function SponsorLockup({
  project,
  variant = 'compact',
  label = '',
  maxItems,
  className = '',
  style
}) {
  const normalizedVariant = VARIANT_LIMITS[variant] ? variant : 'compact'
  const limit = Number(maxItems) > 0 ? Number(maxItems) : VARIANT_LIMITS[normalizedVariant]
  const sponsors = getActiveSponsors(project).slice(0, limit)

  if (!sponsors.length) return null

  return (
    <aside
      className={`${styles.lockup} ${styles[normalizedVariant]} ${className}`.trim()}
      aria-label="Event sponsors"
      style={style}
    >
      <span className={styles.label}>{clean(label) || VARIANT_LABELS[normalizedVariant]}</span>
      <div className={styles.brands}>
        {sponsors.map((sponsor, index) => (
          <div className={styles.brand} key={sponsor.id || `${sponsor.name}-${index}`}>
            {clean(sponsor.logo) && (
              <img
                src={sponsor.logo}
                alt={clean(sponsor.name) || `Sponsor ${index + 1}`}
                onError={event => { event.currentTarget.style.display = 'none' }}
              />
            )}
            <strong>{clean(sponsor.name) || `Sponsor ${index + 1}`}</strong>
          </div>
        ))}
      </div>
    </aside>
  )
}
