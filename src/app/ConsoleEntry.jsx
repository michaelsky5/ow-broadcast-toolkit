import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_COMPETITION_NAME_EN,
  DEFAULT_COMPETITION_NAME_ZH,
  getCompetitionNamePair,
  getEventLogo
} from '../project/branding'
import { FRIES_CUP_CONFIG } from '../editions/friesCup/config'
import { createFriesCupTheme } from '../editions/friesCup/theme'
import FriesCupSystemSourcePanel from '../editions/friesCup/teamDirectory/FriesCupSystemSourcePanel'
import { isProjectPlayerFromFcSystem, isProjectTeamFromFcSystem } from '../editions/friesCup/teamDirectory/syncPublishedTeamsIntoProject'
import { getTeamDirectoryCache } from '../editions/friesCup/teamDirectory/teamDirectoryCache'
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

const formatEntryDateTime = value => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export default function ConsoleEntry({
  project,
  consoleLanguage = '',
  onUpdateConsoleLanguage,
  onUpdateProject,
  onEnterConsole,
  onExportProject,
  onImportProject
}) {
  const logoInputRef = useRef(null)
  const [entryDialog, setEntryDialog] = useState(null)
  const copy = getAppCopy(project, consoleLanguage)
  const language = getAppLanguage(project, consoleLanguage)
  const names = getCompetitionNamePair(project)
  const overlayUrl = getOverlayUrl(project)
  const consoleUrl = typeof window === 'undefined' ? '' : window.location.href
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
  const teamDirectoryCache = getTeamDirectoryCache(project)
  const fcSystemTeamCount = (project.teams || []).filter(isProjectTeamFromFcSystem).length
  const fcSystemPlayerCount = (project.players || []).filter(isProjectPlayerFromFcSystem).length
  const brandReady = Boolean((names.en || names.zh) && eventLogoSource)
  const dataReady = teamDirectoryCache.status === 'READY' && fcSystemTeamCount > 0 && fcSystemPlayerCount > 0
  const sourceSeasonId = teamDirectoryCache.seasonId || FRIES_CUP_CONFIG.teamDirectory.seasonId
  const dataUpdatedAtText = formatEntryDateTime(teamDirectoryCache.updatedAt || teamDirectoryCache.fetchedAt)
  const dataSourceStatusText = dataReady
    ? '已同步'
    : teamDirectoryCache.status === 'ERROR' && fcSystemTeamCount > 0
      ? '使用缓存'
      : ({
          READY: '等待同步',
          LOADING: '读取中',
          ERROR: '读取失败',
          IDLE: '未同步'
        }[teamDirectoryCache.status] || '未同步')
  const obsReady = Boolean(overlayUrl)
  const preflightItems = [
    { label: '品牌配置', value: brandReady ? '就绪' : '待配置', ready: brandReady },
    { label: '赛事数据', value: dataReady ? '已同步' : dataSourceStatusText, ready: dataReady },
    { label: 'OBS 输出', value: obsReady ? '已就绪' : '待配置', ready: obsReady },
    { label: '导播流程', value: 'Preview / TAKE 已就绪', ready: true },
    { label: '自动保存', value: '已启用', ready: true },
    { label: '同步服务', value: '本地模式', ready: true }
  ]
  const preflightReady = preflightItems.every(item => item.ready)
  const openingCheckItems = [
    {
      label: '赛事身份',
      value: brandReady ? '就绪' : '待配置',
      detail: '名称 / Logo / 语言已配置',
      ready: brandReady
    },
    {
      label: '赛事数据',
      value: dataReady ? dataUpdatedAtText : dataSourceStatusText,
      detail: dataReady ? `${sourceSeasonId} / ${fcSystemTeamCount} 队 / ${fcSystemPlayerCount} 选手` : '等待 FC System 同步',
      ready: dataReady
    },
    {
      label: 'OBS 输出',
      value: obsReady ? outputSize : '待配置',
      detail: obsReady ? 'Overlay 地址可用' : '等待 Overlay URL',
      ready: obsReady
    },
    {
      label: '导播流程',
      value: 'Preview / TAKE',
      detail: 'Preview / TAKE 已就绪',
      ready: true
    }
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
      if (field === 'name' || field === 'nameEn') draft.meta.name = value || 'FriesCup Project'
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
        draft.meta.name = value || draft.event.nameZh || 'FriesCup Project'
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
      draft.theme.primary = value || FRIES_CUP_CONFIG.primaryColor
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
      draft.event.subtitle = FRIES_CUP_CONFIG.editionName
      draft.event.logo = FRIES_CUP_CONFIG.defaultLogo
      draft.event.logoBackdrop = 'auto'
      draft.meta.name = 'FriesCup Project'
      draft.theme = createFriesCupTheme()
      draft.scenes.settings.opening.competitionNameEn = DEFAULT_COMPETITION_NAME_EN
      draft.scenes.settings.opening.competitionNameZh = DEFAULT_COMPETITION_NAME_ZH
      draft.scenes.settings.opening.title = ''
      draft.scenes.settings.opening.subtitle = FRIES_CUP_CONFIG.editionName.toUpperCase()
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
      kicker: 'FRIES CUP V0.1',
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
          <span>FCUP 启动</span>
          <h1>{copy.consoleTitle}</h1>
        </div>

        <div className={styles.topStatus}>
          <div>
            <span>会话</span>
            <strong>LOCAL</strong>
          </div>
          <div>
            <span>同步</span>
            <strong>{dataReady ? '同步就绪' : dataSourceStatusText}</strong>
          </div>
          <button className={styles.topEnterButton} onClick={onEnterConsole}>
            {copy.enterConsole}
          </button>
        </div>
      </header>

      <section className={styles.workspace}>
        <section className={`${styles.setupColumn} ${styles.leftColumn}`}>
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

                <div className={styles.twoCol}>
                  <label className={styles.field}>
                    <span>{copy.eventSubtitle}</span>
                    <input value={project.event.subtitle || ''} onChange={updateEventField('subtitle')} />
                  </label>

                  <label className={styles.field}>
                    <span>{copy.language}</span>
                    <select value={language} onChange={updateLanguage}>
                      <option value="zh">{copy.zhShort}</option>
                      <option value="en">{copy.enShort}</option>
                    </select>
                  </label>
                </div>

                <div className={styles.eventAssetRow}>
                  <label className={styles.field}>
                    <span>{copy.eventLogo}</span>
                    <div className={styles.inputActionRow}>
                      <input value={project.event.logo || ''} onChange={updateEventField('logo')} placeholder={FRIES_CUP_CONFIG.defaultLogo} />
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
                    <input type="color" value={project.theme.primary} onChange={updateThemePrimary} disabled readOnly title={copy.fixedThemeLabel} />
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

          </section>

          <section className={`${styles.panel} ${styles.projectToolsPanel}`}>
            <div className={styles.panelTitle}>
              <span>项目工具</span>
              <strong>{copy.versionNumber}</strong>
            </div>

            <div className={styles.projectToolGrid}>
              <div className={styles.stateTile}>
                <span>控制台地址</span>
                <strong>{consoleUrl ? '本地控制台' : '-'}</strong>
                <em>{consoleUrl || '-'}</em>
              </div>
              <div className={styles.stateTile}>
                <span>同步服务</span>
                <strong>本地模式</strong>
                <em>项目文件保留缓存</em>
              </div>
            </div>

            <div className={styles.projectActionGrid}>
              <button type="button" onClick={onExportProject} disabled={!onExportProject}>
                {copy.exportProject}
              </button>
              <button type="button" onClick={onImportProject} disabled={!onImportProject}>
                {copy.importProject}
              </button>
            </div>

            <button type="button" className={styles.updateNotesStrip} onClick={openUpdateNotes}>
              <span>{copy.versionNotes}</span>
              <strong>{copy.versionNumber}</strong>
              <p>{copy.updateNotesBrief}</p>
              <em>{copy.updateNotesView}</em>
            </button>
          </section>
        </section>

        <section className={`${styles.setupColumn} ${styles.middleColumn}`}>
          <section className={`${styles.panel} ${styles.checkPanel}`}>
            <div className={styles.panelTitle}>
              <span>开播检查</span>
              <strong>{preflightReady ? 'READY' : 'CHECK'}</strong>
            </div>

            <div className={styles.openingChecklist}>
              {openingCheckItems.map((item, index) => (
                <div key={item.label} className={item.ready ? styles.openingCheckReady : styles.openingCheckPending}>
                  <span className={styles.checkNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <em>{item.detail}</em>
                  </div>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>

            <div className={styles.openingActionStrip}>
              <div>
                <span>建议动作</span>
                <strong>{preflightReady ? '开播检查完成' : '先刷新并同步赛事数据'}</strong>
              </div>
              <em>{preflightReady ? '就绪' : '待检查'}</em>
            </div>
          </section>

          <FriesCupSystemSourcePanel
            project={project}
            onUpdateProject={onUpdateProject}
            compact
          />
        </section>

        <aside className={styles.preflightRail}>
          <section className={`${styles.statusPanel} ${styles.preflightPanel}`}>
            <div className={styles.panelTitle}>
              <span>预检</span>
              <strong>{preflightReady ? copy.statusReady : copy.statusPending}</strong>
            </div>

            <div className={styles.preflightBrandCard}>
              <div className={`${styles.preflightLogoBox} ${logoBackdropClass}`}>
                <img src={eventLogoSource} alt="" />
              </div>
              <span>{FRIES_CUP_CONFIG.brandName}</span>
              <strong>{names.en || FRIES_CUP_CONFIG.brandName}</strong>
              <em>{names.zh || project.event.subtitle || FRIES_CUP_CONFIG.editionName}</em>
            </div>

            <div className={styles.preflightOutputSummary}>
              <div className={styles.preflightOutputStateGrid}>
                <div className={styles.stateTile}>
                  <span>控制台自适应</span>
                  <strong>{outputWidth >= 3840 ? 'AUTO 4K' : 'AUTO 1080P'}</strong>
                  <em>{outputSize} / {isTransparentOverlay ? copy.transparentBg : copy.settingOff}</em>
                </div>

                <div className={styles.stateTile}>
                  <span>同步模式</span>
                  <strong>本地模式</strong>
                  <em>项目文件保留缓存</em>
                </div>
              </div>

              <div className={styles.preflightOutputMetricGrid}>
                <div>
                  <span>画布</span>
                  <strong>{outputWidth >= 3840 ? '4K' : '1080'}</strong>
                </div>
                <div>
                  <span>背景</span>
                  <strong>{isTransparentOverlay ? '透明' : '实底'}</strong>
                </div>
                <div>
                  <span>保存</span>
                  <strong>ON</strong>
                </div>
                <div>
                  <span>同步</span>
                  <strong>LOCAL</strong>
                </div>
              </div>
            </div>

            <div className={styles.preflightStatusCards}>
              <div>
                <span>Overlay</span>
                <strong>{obsReady ? '就绪' : '待配置'}</strong>
              </div>
              <div>
                <span>赛事数据源</span>
                <strong>{dataReady ? '发布就绪' : dataSourceStatusText}</strong>
              </div>
              <div>
                <span>数据源</span>
                <strong>{teamDirectoryCache.source === 'static-fallback' ? '使用缓存' : '线上发布'}</strong>
                <em>{dataUpdatedAtText}</em>
              </div>
            </div>
          </section>
        </aside>
      </section>
      {entryDialog && <EditorDialog {...entryDialog} />}
    </main>
  )
}
