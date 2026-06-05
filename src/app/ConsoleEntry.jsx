import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_COMPETITION_NAME_EN,
  DEFAULT_COMPETITION_NAME_ZH,
  getCompetitionNamePair,
  getEventLogo
} from '../project/branding'
import { getAppCopy, getAppLanguage } from './appCopy'
import { EditorDialog } from './editors/shared/editorControls'
import { getOverlayUrl } from './overlayUrl'
import { fileToDataUrl } from './toolbox/toolboxModel'
import styles from './ConsoleEntry.module.css'

const isSupportedLogoFile = file => (
  Boolean(file) &&
  (
    String(file.type || '').startsWith('image/') ||
    /\.(?:svg|png|jpe?g|webp|gif)$/i.test(file.name || '')
  )
)

export default function ConsoleEntry({
  project,
  consoleLanguage = '',
  onUpdateConsoleLanguage,
  onUpdateProject,
  onEnterConsole
}) {
  const logoInputRef = useRef(null)
  const [entryDialog, setEntryDialog] = useState(null)
  const copy = getAppCopy(project, consoleLanguage)
  const language = getAppLanguage(project, consoleLanguage)
  const names = getCompetitionNamePair(project)
  const overlayUrl = getOverlayUrl(project)
  const outputWidth = project.output?.width || 1920
  const outputHeight = project.output?.height || 1080
  const outputSize = `${outputWidth} x ${outputHeight}`
  const isTransparentOverlay = Boolean(project.output?.transparent ?? project.event.transparentOverlay)
  const logoBackdrop = ['dark', 'light', 'none'].includes(project.event.logoBackdrop)
    ? project.event.logoBackdrop
    : 'auto'
  const eventLogoSource = getEventLogo(project)
  const hasConfiguredLogo = Boolean(project.event.logo || project.event.organizerLogo)
  const eventLogoStatus = hasConfiguredLogo ? copy.eventLogoReady : copy.eventLogoDefault
  const logoBackdropClass = {
    auto: styles.logoBackdropAuto,
    dark: styles.logoBackdropDark,
    light: styles.logoBackdropLight,
    none: styles.logoBackdropNone
  }[logoBackdrop]
  const logoBackdropOptions = [
    { value: 'auto', label: copy.logoBackdropAuto },
    { value: 'dark', label: copy.logoBackdropDark },
    { value: 'light', label: copy.logoBackdropLight },
    { value: 'none', label: copy.logoBackdropNone }
  ]

  useEffect(() => {
    if (project.event.overlayLanguage !== 'en') {
      onUpdateProject(draft => {
        draft.event.overlayLanguage = 'en'
      })
    }
  }, [onUpdateProject, project.event.overlayLanguage])

  const updateEventField = field => event => {
    const value = event.target.value

    onUpdateProject(draft => {
      draft.event[field] = value
      if (field === 'name' || field === 'nameEn') draft.meta.name = value || 'OWBT Project'
    })
  }

  const updateName = field => event => {
    const value = event.target.value
    const settingsField = field === 'nameZh' ? 'competitionNameZh' : 'competitionNameEn'

    onUpdateProject(draft => {
      draft.event[field] = value
      draft.scenes.settings.opening[settingsField] = value
      if (field === 'nameEn') {
        draft.event.name = value
        draft.meta.name = value || draft.event.nameZh || 'OWBT Project'
      }
    })
  }

  const updateLanguage = event => {
    const value = event.target.value

    if (onUpdateConsoleLanguage) {
      onUpdateConsoleLanguage(value)
      return
    }

    onUpdateProject(draft => {
      draft.event.language = value
    })
  }

  const updateThemePrimary = event => {
    const value = event.target.value

    onUpdateProject(draft => {
      draft.theme.primary = value
    })
  }

  const updateLogoBackdrop = value => {
    onUpdateProject(draft => {
      draft.event.logoBackdrop = value
    })
  }

  const updateTransparentOverlay = checked => {
    onUpdateProject(draft => {
      draft.event.transparentOverlay = checked
      draft.output.transparent = checked
    })
  }

  const updateOutputResolution = value => {
    const [width, height] = value.split('x').map(Number)

    onUpdateProject(draft => {
      draft.event.outputResolution = value
      draft.output.width = width
      draft.output.height = height
    })
  }

  const clearLogo = () => {
    onUpdateProject(draft => {
      draft.event.logo = ''
    })
  }

  const applyLogoFile = async file => {
    if (!file) return

    if (!isSupportedLogoFile(file)) {
      setEntryDialog({
        kicker: copy.eventLogoPreview,
        title: copy.eventLogo,
        message: copy.invalidLogoFile,
        confirmLabel: copy.ok,
        onConfirm: () => setEntryDialog(null)
      })
      return
    }

    const dataUrl = await fileToDataUrl(file)

    onUpdateProject(draft => {
      draft.event.logo = dataUrl
      if (!draft.event.logoBackdrop) draft.event.logoBackdrop = 'auto'
    })
  }

  const resetBrand = () => {
    onUpdateProject(draft => {
      draft.event.name = DEFAULT_COMPETITION_NAME_EN
      draft.event.nameEn = DEFAULT_COMPETITION_NAME_EN
      draft.event.nameZh = DEFAULT_COMPETITION_NAME_ZH
      draft.event.subtitle = 'Overwatch Community Tournament'
      draft.event.logo = ''
      draft.event.logoBackdrop = 'auto'
      draft.meta.name = 'OWBT Project'
      draft.scenes.settings.opening.competitionNameEn = DEFAULT_COMPETITION_NAME_EN
      draft.scenes.settings.opening.competitionNameZh = DEFAULT_COMPETITION_NAME_ZH
      draft.scenes.settings.opening.title = ''
      draft.scenes.settings.opening.subtitle = 'OVERWATCH COMMUNITY TOURNAMENT'
    })
  }

  const copyOverlayUrl = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard?.writeText(overlayUrl)
    } catch {
      setEntryDialog({
        kicker: 'Overlay',
        title: copy.copyUrl,
        message: `${copy.overlayUrl}: ${overlayUrl}`,
        confirmLabel: copy.ok,
        onConfirm: () => setEntryDialog(null)
      })
    }
  }

  const openOverlayUrl = () => {
    window.open(overlayUrl, '_blank', 'noopener,noreferrer')
  }

  const openUpdateNotes = () => {
    setEntryDialog({
      kicker: 'OWBT V0.1',
      title: copy.changelogTitle,
      message: copy.updateNotesFull,
      confirmLabel: copy.ok,
      onConfirm: () => setEntryDialog(null)
    })
  }

  return (
    <main className={styles.entry}>
      <div className={styles.gridLayer} />

      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <span>{copy.startupKicker}</span>
          <h1>{copy.consoleTitle}</h1>
        </div>

        <div className={styles.topStatus}>
          <div>
            <span>{copy.project}</span>
            <strong>{project.meta?.name || names.en}</strong>
          </div>
          <div>
            <span>{copy.status}</span>
            <strong>{copy.statusStandby}</strong>
          </div>
          <button className={styles.enterButton} onClick={onEnterConsole}>
            {copy.enterConsole}
          </button>
        </div>
      </header>

      <section className={styles.workspace}>
        <section className={styles.setupColumn}>
          <section className={`${styles.panel} ${styles.eventPanel}`}>
            <div className={styles.panelTitle}>
              <span>{copy.eventIdentity}</span>
              <button type="button" onClick={resetBrand}>{copy.resetBrand}</button>
            </div>

            <div className={styles.eventIdentityGrid}>
              <div>
                <div className={styles.twoCol}>
                  <label className={styles.field}>
                    <span>{copy.eventNameEn}</span>
                    <input value={project.event.nameEn || ''} onChange={updateName('nameEn')} />
                  </label>

                  <label className={styles.field}>
                    <span>{copy.eventNameZh}</span>
                    <input value={project.event.nameZh || ''} onChange={updateName('nameZh')} />
                  </label>
                </div>

                <label className={styles.field}>
                  <span>{copy.eventSubtitle}</span>
                  <input value={project.event.subtitle || ''} onChange={updateEventField('subtitle')} />
                </label>

                <div className={styles.eventAssetRow}>
                  <label className={styles.field}>
                    <span>{copy.eventLogo}</span>
                    <div className={styles.inputActionRow}>
                      <input value={project.event.logo || ''} onChange={updateEventField('logo')} placeholder="/OW.svg" />
                      <button type="button" onClick={() => logoInputRef.current?.click()}>{copy.uploadLogo}</button>
                      <button type="button" onClick={clearLogo}>{copy.clearLogo}</button>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*,.svg"
                      hidden
                      onChange={event => {
                        applyLogoFile(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>{copy.themePrimary}</span>
                    <input type="color" value={project.theme.primary} onChange={updateThemePrimary} />
                  </label>
                </div>

                <label className={styles.field}>
                  <span>{copy.logoBackdrop}</span>
                  <div className={`${styles.segmented} ${styles.fourSegmented}`}>
                    {logoBackdropOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={logoBackdrop === option.value ? styles.segmentActive : ''}
                        onClick={() => updateLogoBackdrop(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <aside className={styles.logoPreviewCard}>
                <div className={`${styles.logoPreviewFrame} ${logoBackdropClass}`}>
                  <img src={eventLogoSource} alt="" />
                </div>
                <div className={styles.logoPreviewMeta}>
                  <span>{copy.eventLogoPreview}</span>
                  <strong>{eventLogoStatus}</strong>
                  <em>{project.event.logo || copy.eventLogoDefault}</em>
                </div>
              </aside>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <span>{copy.broadcastOutput}</span>
              <strong>{copy.statusLocal}</strong>
            </div>

            <label className={styles.field}>
              <span>{copy.overlayUrl}</span>
              <div className={styles.urlRow}>
                <input value={overlayUrl} readOnly />
                <button type="button" onClick={copyOverlayUrl}>{copy.copyUrl}</button>
                <button type="button" onClick={openOverlayUrl}>{copy.openOverlay}</button>
              </div>
            </label>

            <div className={styles.twoCol}>
              <label className={styles.field}>
                <span>{copy.resolution}</span>
                <div className={styles.segmented}>
                  {[
                    { value: '1920x1080', label: '1080P' },
                    { value: '3840x2160', label: '4K' }
                  ].map(option => {
                    const active = `${project.output?.width || 1920}x${project.output?.height || 1080}` === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? styles.segmentActive : ''}
                        onClick={() => updateOutputResolution(option.value)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </label>

              <label className={styles.field}>
                <span>{copy.transparentOverlay}</span>
                <div className={styles.binarySegmented}>
                  {[
                    { value: true, label: copy.settingOn },
                    { value: false, label: copy.settingOff }
                  ].map(option => {
                    const active = Boolean(project.output?.transparent ?? project.event.transparentOverlay) === option.value

                    return (
                      <button
                        key={option.label}
                        type="button"
                        className={active ? styles.segmentActive : ''}
                        onClick={() => updateTransparentOverlay(option.value)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </label>
            </div>

            <div className={styles.outputStateGrid}>
              <div className={styles.stateTile}>
                <span>{copy.overlayLanguage}</span>
                <strong>{copy.overlayLanguageLocked}</strong>
                <em>{copy.overlayLanguagePending}</em>
              </div>

              <div className={styles.stateTile}>
                <span>{copy.autosave}</span>
                <strong>{copy.active}</strong>
                <em>{copy.statusLocal}</em>
              </div>
            </div>

            <div className={styles.outputChecklist}>
              <div className={styles.outputChecklistTitle}>{copy.outputChecklist}</div>
              <div>
                <span>{copy.browserSource}</span>
                <strong>{outputSize}</strong>
              </div>
              <div>
                <span>{copy.transparentBg}</span>
                <strong>{isTransparentOverlay ? copy.settingOn : copy.settingOff}</strong>
              </div>
              <div>
                <span>{copy.outputMode}</span>
                <strong>{copy.statusLocal}</strong>
              </div>
            </div>
          </section>
        </section>

        <section className={styles.setupColumn}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <span>{copy.consoleStartup}</span>
              <strong>{copy.statusConfigured}</strong>
            </div>

            <div className={styles.twoCol}>
              <label className={styles.field}>
                <span>{copy.language}</span>
                <select value={language} onChange={updateLanguage}>
                  <option value="zh">{copy.zhShort}</option>
                  <option value="en">{copy.enShort}</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>{copy.startupMotion}</span>
                <select value={project.event.startupMotion || 'full'} onChange={updateEventField('startupMotion')}>
                  <option value="full">{copy.motionFull}</option>
                  <option value="reduced">{copy.motionReduced}</option>
                </select>
              </label>
            </div>

            <div className={styles.startupStateGrid}>
              <div className={styles.stateTile}>
                <span>{copy.project}</span>
                <strong>{project.meta?.name || names.en}</strong>
                <em>{copy.statusConfigured}</em>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.checkPanel}`}>
            <div className={styles.panelTitle}>
              <span>{copy.notes}</span>
            </div>
            <div className={styles.noteGrid}>
              <article>
                <strong>{copy.flowConfigTitle}</strong>
                <p>{copy.flowConfigBody}</p>
              </article>
              <article>
                <strong>{copy.flowRosterTitle}</strong>
                <p>{copy.flowRosterBody}</p>
              </article>
              <article>
                <strong>{copy.flowObsTitle}</strong>
                <p>{copy.flowObsBody}</p>
              </article>
              <article>
                <strong>{copy.flowLiveTitle}</strong>
                <p>{copy.flowLiveBody}</p>
              </article>
            </div>
            <button type="button" className={styles.updateNotesStrip} onClick={openUpdateNotes}>
              <span>{copy.versionNotes}</span>
              <strong>{copy.versionNumber}</strong>
              <p>{copy.updateNotesBrief}</p>
              <em>{copy.updateNotesView}</em>
            </button>
          </section>
        </section>

        <aside className={styles.preflightRail}>
          <section className={styles.statusPanel}>
            <div className={styles.panelTitle}>
              <span>{copy.previewLabel}</span>
              <strong>{copy.statusReady}</strong>
            </div>

            <div className={styles.brandPlate}>
              <div className={`${styles.brandPlateLogo} ${logoBackdropClass}`}>
                <img src={eventLogoSource} alt="" />
              </div>
              <span>OWBT</span>
              <strong>{names.en}</strong>
              <em>{names.zh || project.event.subtitle}</em>
            </div>

            <div className={styles.statusStack}>
              <div>
                <span>{copy.eventLogoPreview}</span>
                <strong>{eventLogoStatus}</strong>
              </div>
              <div>
                <span>{names.zh ? copy.eventNameZh : copy.eventSubtitle}</span>
                <strong>{names.zh || project.event.subtitle || '-'}</strong>
              </div>
              <div>
                <span>{copy.language}</span>
                <strong>{language === 'zh' ? copy.zhShort : copy.enShort}</strong>
              </div>
              <div>
                <span>{copy.output}</span>
                <strong>{outputSize}</strong>
              </div>
              <div>
                <span>{copy.transparentOverlay}</span>
                <strong>{isTransparentOverlay ? copy.settingOn : copy.settingOff}</strong>
              </div>
              <div>
                <span>{copy.overlay}</span>
                <strong>{copy.statusLocal}</strong>
              </div>
              <div>
                <span>{copy.autosave}</span>
                <strong>{copy.active}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
      {entryDialog && <EditorDialog {...entryDialog} />}
    </main>
  )
}
