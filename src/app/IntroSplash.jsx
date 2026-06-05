import { useEffect, useRef, useState } from 'react'
import { getAppCopy } from './appCopy'
import styles from './IntroSplash.module.css'

const USAGE_NOTICE_KEY = 'owbt-usage-notice-accepted'

export default function IntroSplash({ project, languageOverride = '', duration = 1450, onFinish }) {
  const onFinishRef = useRef(onFinish)
  const [isReady, setIsReady] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [noticeAccepted, setNoticeAccepted] = useState(() => {
    try {
      return window.localStorage.getItem(USAGE_NOTICE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const copy = getAppCopy(project, languageOverride)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsReady(true)
    }, duration)

    return () => window.clearTimeout(timer)
  }, [duration])

  const enterSetup = () => {
    if (!noticeAccepted) {
      setShowNotice(true)
      return
    }

    try {
      window.localStorage.setItem(USAGE_NOTICE_KEY, 'true')
    } catch {
      // Local storage is optional; the notice still gates the current entry.
    }

    onFinishRef.current?.()
  }

  const acceptAndEnter = () => {
    try {
      window.localStorage.setItem(USAGE_NOTICE_KEY, 'true')
    } catch {
      // Local storage is optional; the notice still gates the current entry.
    }

    setNoticeAccepted(true)
    setShowNotice(false)

    if (!noticeAccepted) {
      onFinishRef.current?.()
    }
  }

  return (
    <main className={styles.splash} aria-label={copy.startupAria}>
      <div className={styles.gridLayer} />
      <div className={styles.scanline} />

      <section className={styles.bootPanel}>
        <div className={styles.topRail}>
          <span>OWBT STARTUP / v0.1</span>
          <strong>
            <span>{copy.statusReady}</span>
            <em>{copy.startupReadyMeta}</em>
          </strong>
        </div>

        <div className={styles.launchGrid}>
          <div className={styles.identity}>
            <div className={styles.logoFrame}>
              <img src="/OWBT.svg" alt="OWBT" />
            </div>
            <div className={styles.identityText}>
              <h1>OWBT</h1>
              <p>Overwatch Broadcast Toolkit</p>
              <em>{copy.startupCreditLine}</em>
            </div>
          </div>

          <aside className={styles.startupStack} aria-label={copy.consoleStartup}>
            <div className={styles.statusMatrix}>
              <div>
                <span>Boot</span>
                <strong>{isReady ? copy.statusReady : 'Loading'}</strong>
              </div>
              <div>
                <span>{copy.startupNoticeLabel}</span>
                <strong>{noticeAccepted ? copy.noticeAcceptedShort : copy.noticeRequiredShort}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>Web Console</strong>
              </div>
            </div>

            <button type="button" className={styles.licensePlate} onClick={() => setShowNotice(true)}>
              <span className={styles.licenseInfo}>
                <span>{copy.usageNoticePanelLabel}</span>
                <em>{copy.communityLicense}</em>
              </span>
              <strong>
                <span>{noticeAccepted ? copy.usageNoticeView : copy.usageNoticeRequired}</span>
                <em>{noticeAccepted ? copy.noticeAcceptedShort : copy.noticeRequiredShort}</em>
              </strong>
            </button>
          </aside>
        </div>

        <div className={[styles.setupAction, isReady ? styles.setupReady : ''].join(' ')}>
          <div className={styles.progress}>
            <span />
          </div>
          <button type="button" disabled={!isReady} onClick={enterSetup}>
            <span>{copy.enterSetup}</span>
            <em>{copy.openingSettings}</em>
          </button>
        </div>
      </section>

      {showNotice && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.noticeModal} role="dialog" aria-modal="true" aria-labelledby="usage-notice-title">
            <div className={styles.modalHeader}>
              <div>
                <span>OWBT // MICHAELSKY5</span>
                <h2 id="usage-notice-title">{copy.usageNoticeTitle}</h2>
                <p>{copy.communityLicense}</p>
              </div>
              <strong>{copy.usageNoticeBadge}</strong>
            </div>

            <div className={styles.modalLead}>
              <p>{copy.usageNoticeBody}</p>
              <p>{copy.usageNoticeBodySecondary}</p>
            </div>

            <div className={styles.noticeRules}>
              <div>
                <span>01</span>
                <section>
                  <strong>{copy.usageRuleFree}</strong>
                  <em>{copy.usageRuleFreeMeta}</em>
                </section>
                <article>
                  <p>{copy.usageRuleFreeDetail}</p>
                </article>
              </div>
              <div>
                <span>02</span>
                <section>
                  <strong>{copy.usageRuleCredit}</strong>
                  <em>{copy.usageRuleCreditMeta}</em>
                </section>
                <article>
                  <p>{copy.usageRuleCreditDetail}</p>
                </article>
              </div>
              <div>
                <span>03</span>
                <section>
                  <strong>{copy.usageRuleNoProfit}</strong>
                  <em>{copy.usageRuleNoProfitMeta}</em>
                </section>
                <article>
                  <p>{copy.usageRuleNoProfitDetail}</p>
                </article>
              </div>
              <div>
                <span>04</span>
                <section>
                  <strong>{copy.usageRuleAssets}</strong>
                  <em>{copy.usageRuleAssetsMeta}</em>
                </section>
                <article>
                  <p>{copy.usageRuleAssetsDetail}</p>
                </article>
              </div>
            </div>

            <div className={[styles.modalActions, noticeAccepted ? styles.modalActionsSingle : ''].join(' ')}>
              {!noticeAccepted && (
                <button type="button" className={styles.secondaryButton} onClick={() => setShowNotice(false)}>
                  {copy.cancel}
                </button>
              )}
              <button type="button" onClick={acceptAndEnter}>
                {noticeAccepted ? copy.usageNoticeClose : copy.usageNoticeAccept}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
