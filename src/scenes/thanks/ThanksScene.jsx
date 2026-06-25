import { FRIES_CUP_CONFIG } from '../../editions/friesCup/config'
import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import { getCasterById } from '../../project/projectUtils'
import styles from './ThanksScene.module.css'

const clean = value => String(value || '').trim()

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = FRIES_CUP_CONFIG.defaultLogo
}

export default function ThanksScene({ project }) {
  const settings = project?.scenes?.settings?.thanks || {}
  const match = project?.currentMatch || {}
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)
  const title = clean(settings.title) || 'THANKS FOR WATCHING'
  const subtitle = clean(settings.subtitle) || 'SEE YOU NEXT MATCH'
  const casters = (match.casters || []).map(id => getCasterById(project, id)).filter(Boolean)
  const showSummary = settings.showSummary !== false
  const showCredits = settings.showCredits !== false
  const stageLabel = clean(match.stage) || 'Complete'
  const roundLabel = clean(match.currentRoundLabel) || 'Closing'
  const casterNames = casters.length
    ? casters.map(caster => caster.name || caster.id).filter(Boolean).join(' / ')
    : 'TBD'

  return (
    <div className={styles.scene}>
      <div className={styles.gridLayer} />
      <div className={styles.scanLayer} />
      <div className={styles.glowLayer} />
      <div className={styles.sideRail} />

      <header className={styles.topBar}>
        <div className={styles.brandMark}>
          <span />
          {eventName}
        </div>
        <div>SHOW FLOW // CLOSING</div>
        <div>THANKS</div>
      </header>

      <main className={styles.main}>
        <section className={styles.closingPanel}>
          <div className={styles.eventBadge}>
            <div className={styles.eventLogo}>
              <img src={eventLogo || FRIES_CUP_CONFIG.defaultLogo} alt="" onError={handleImageFallback} />
            </div>
            <div>
              <span>Broadcast Complete</span>
              <strong>{eventName}</strong>
            </div>
          </div>

          <div className={styles.titleBlock}>
            <div className={styles.kicker}>PROGRAM COMPLETE</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </section>

        {showSummary && (
          <section className={styles.eventSummaryDeck}>
            <div>
              <span>Event</span>
              <strong>{eventName}</strong>
            </div>
            <div>
              <span>Stage</span>
              <strong>{stageLabel}</strong>
            </div>
            <div>
              <span>Round</span>
              <strong>{roundLabel}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Broadcast Complete</strong>
            </div>
          </section>
        )}

        {showCredits && (
          <section className={styles.creditDeck}>
            <div>
              <span>Casters</span>
              <strong>{casterNames}</strong>
            </div>
            <div>
              <span>Broadcast</span>
              <strong>{FRIES_CUP_CONFIG.brandName}</strong>
            </div>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <span>{FRIES_CUP_CONFIG.brandName} // SHOW FLOW // THANKS</span>
        <strong>{eventName}</strong>
      </footer>
    </div>
  )
}
