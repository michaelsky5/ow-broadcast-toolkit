import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SCENE_REGISTRY } from '../../scenes/registry'
import { getSceneDisplay } from '../../scenes/sceneCopy'
import { AssetsSummaryPanel, AssetsWorkspace } from './ToolboxAssets'
import {
  BASE_SCENE_HEIGHT,
  BASE_SCENE_WIDTH,
  EXPORT_PRESETS,
  EXPORT_SCENE_GROUPS,
  STATIC_GRAPHIC_MODE_IDS,
  TOOLBOX_MODES,
  createSceneProject,
  getExportableScenes
} from './toolboxConfig'
import {
  getExportPresetDisplay,
  getExportSceneGroupLabel,
  getToolboxCopy,
  getToolboxModeDisplay
} from './toolboxCopy'
import {
  buildBaseContext,
  buildSnapshot,
  clampDimension,
  clampPercent,
  clean,
  downloadBlob,
  ensureGraphicSettings,
  formatAspectRatio,
  formatExportTime,
  getAssetSettings,
  getCoverTextScaleStyle,
  getCssColorVar,
  getEventLogoSourceLabel,
  getGraphicSettings,
  getPreviewFrameStyle,
  getStaticExportLayoutSize,
  getTeamLabel,
  getTeamShort,
  getTeamShortScaleStyle,
  normalizeHexColor,
  resolveToolContext,
  slugify,
  toPercentNumber
} from './toolboxModel'
import styles from './ToolboxWorkspace.module.css'

function CoverTeamBadge({ team, align = 'left', teamShortScale }) {
  const logo = clean(team?.logo)
  const isRight = align === 'right'
  const teamShort = getTeamShort(team)

  return (
    <article
      className={[
        styles.coverTeamBadge,
        isRight ? styles.coverTeamBadgeRight : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--toolbox-team-color': clean(team?.primaryColor) || 'var(--theme-primary)',
        ...getTeamShortScaleStyle(team, teamShortScale)
      }}
    >
      <b>{teamShort}</b>
      <div className={styles.coverTeamBadgeLogo}>
        {logo ? <img src={logo} alt="" /> : <span>{teamShort}</span>}
      </div>
      <div className={styles.coverTeamBadgeText}>
        <strong>{teamShort}</strong>
        <em>{getTeamLabel(team)}</em>
      </div>
    </article>
  )
}

function CoverPreview({ context, exportRef, exportSize, exportRender = false, previewKind }) {
  const coverTitle = clean(context.title) || context.eventName
  const detailItems = [
    { label: 'Stage', value: context.stage },
    { label: 'Format', value: context.ft },
    context.showTime ? { label: 'Time', value: context.time || 'TBD' } : null
  ].filter(Boolean)
  const previewStyle = {
    ...(getPreviewFrameStyle(exportSize, exportRender) || {}),
    ...getCssColorVar('--toolbox-event-logo-bg', context.eventLogoBg),
    ...getCssColorVar('--toolbox-team-logo-bg', context.teamLogoBg),
    ...getCoverTextScaleStyle({
      titleScale: context.titleScale,
      subtitleScale: context.subtitleScale
    })
  }
  const cleanCoverLayout = !context.showDetails && !context.showTeams

  return (
    <section
      ref={exportRef}
      className={[
        styles.previewCanvas,
        styles.coverPosterCanvas,
        cleanCoverLayout ? styles.coverPosterCleanCanvas : ''
      ].filter(Boolean).join(' ')}
      data-toolbox-preview-canvas={previewKind || (exportRender ? 'export' : 'preview')}
      style={previewStyle}
    >
      <div className={styles.coverStaticTopBar}>
        <strong>{context.eventName}</strong>
        <span>Broadcast Cover</span>
        <p>{context.showTime ? context.time || 'Live Soon' : ''}</p>
      </div>

      <div className={styles.coverHeroStage}>
        <div className={styles.coverHeroBackdrop}>
          <span>{coverTitle}</span>
        </div>
        <div className={styles.coverEventLogoMark}>
          <img src={context.eventLogo} alt="" />
        </div>
        <div className={[
          styles.coverHeroCopy,
          !context.eyebrow ? styles.coverHeroCopyNoLabel : ''
        ].filter(Boolean).join(' ')}>
          {context.eyebrow && <span>{context.eyebrow}</span>}
          <h3>{coverTitle}</h3>
          <p>{context.subtitle}</p>
        </div>
      </div>

      {context.showTeams && (
        <div className={styles.coverTeamBand}>
          <CoverTeamBadge team={context.teamA} teamShortScale={context.teamShortScale} />
          <div className={styles.coverTeamVersus}>VS</div>
          <CoverTeamBadge team={context.teamB} align="right" teamShortScale={context.teamShortScale} />
        </div>
      )}

      {context.showDetails && (
        <div
          className={`${styles.matchupStaticInfoStrip} ${styles.coverInfoStrip}`}
          style={{ gridTemplateColumns: `repeat(${detailItems.length}, minmax(0, 1fr))` }}
        >
          {detailItems.map(item => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value || '-'}</strong>
            </div>
          ))}
        </div>
      )}

      <footer className={styles.matchupStaticFooter}>
        <span>OWBT // STREAM COVER</span>
        <strong>{context.showTeams ? `${getTeamShort(context.teamA)} / ${getTeamShort(context.teamB)}` : 'COMMUNITY BROADCAST'}</strong>
      </footer>
    </section>
  )
}

function MatchupTeamPlate({ team, align = 'left', teamShortScale }) {
  const logo = clean(team?.logo)
  const isRight = align === 'right'
  const teamShort = getTeamShort(team)

  return (
    <article
      className={[
        styles.matchupTeamPlate,
        isRight ? styles.matchupTeamPlateRight : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--toolbox-team-color': clean(team?.primaryColor) || 'var(--theme-primary)',
        ...getTeamShortScaleStyle(team, teamShortScale)
      }}
    >
      <div className={styles.matchupTeamBackdrop}>
        <span>{teamShort}</span>
      </div>
      <b>{teamShort}</b>
      <div className={styles.matchupTeamLogo}>
        {logo ? <img src={logo} alt="" /> : <span>{teamShort}</span>}
      </div>
      <div className={styles.matchupTeamIdentity}>
        <strong>{teamShort}</strong>
        <em>{getTeamLabel(team)}</em>
      </div>
    </article>
  )
}

function MatchupPreview({ context, exportRef, exportSize, exportRender = false, previewKind }) {
  const detailItems = [
    context.showFt ? { label: 'Format', value: context.ft } : null,
    { label: 'Time', value: context.time || 'TBD' },
    { label: 'Stage', value: context.stage }
  ].filter(Boolean).slice(0, 3)
  const previewStyle = {
    ...(getPreviewFrameStyle(exportSize, exportRender) || {}),
    ...getCssColorVar('--toolbox-team-logo-bg', context.teamLogoBg)
  }

  return (
    <section
      ref={exportRef}
      className={`${styles.previewCanvas} ${styles.matchupCanvas} ${styles.matchupPosterCanvas}`}
      data-toolbox-preview-canvas={previewKind || (exportRender ? 'export' : 'preview')}
      style={previewStyle}
    >
      <div className={styles.matchupStaticTopBar}>
        <strong>{context.eventName}</strong>
        <span>Match Preview</span>
        <p>{context.eventSubtitle}</p>
      </div>

      <div className={styles.matchupStaticCard}>
        <MatchupTeamPlate team={context.teamA} teamShortScale={context.teamShortScale} />
        <div className={styles.matchupVsStack}>
          <strong>VS</strong>
        </div>
        <MatchupTeamPlate team={context.teamB} align="right" teamShortScale={context.teamShortScale} />
      </div>

      <div className={styles.matchupStaticInfoStrip}>
        {detailItems.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value || '-'}</strong>
          </div>
        ))}
      </div>

      <footer className={styles.matchupStaticFooter}>
        <span>OWBT // MATCH GRAPHIC</span>
        <strong>COMMUNITY BROADCAST</strong>
      </footer>
    </section>
  )
}

function ResultPreview({ context, exportRef, exportSize, exportRender = false, previewKind }) {
  const winner = context.winner || (context.score.teamA === context.score.teamB
    ? 'DRAW'
    : context.score.teamA > context.score.teamB
      ? getTeamLabel(context.teamA)
      : getTeamLabel(context.teamB))
  const detailItems = [
    { label: 'Winner', value: winner },
    { label: 'Format', value: context.ft },
    { label: 'Stage', value: context.stage },
    ...(context.mvp ? [{ label: 'MVP', value: context.mvp }] : []),
    ...(context.note ? [{ label: 'Note', value: context.note }] : [])
  ]
  const previewStyle = {
    ...(getPreviewFrameStyle(exportSize, exportRender) || {}),
    ...getCssColorVar('--toolbox-team-logo-bg', context.teamLogoBg)
  }

  return (
    <section
      ref={exportRef}
      className={`${styles.previewCanvas} ${styles.resultCanvas} ${styles.matchupPosterCanvas}`}
      data-toolbox-preview-canvas={previewKind || (exportRender ? 'export' : 'preview')}
      style={previewStyle}
    >
      <div className={styles.matchupStaticTopBar}>
        <strong>{context.eventName}</strong>
        <span>{context.title}</span>
        <p>{context.eventSubtitle}</p>
      </div>

      <div className={`${styles.matchupStaticCard} ${styles.resultStaticCard}`}>
        <MatchupTeamPlate team={context.teamA} teamShortScale={context.teamShortScale} />
        <div className={styles.resultScoreStack}>
          <span>Final Score</span>
          <strong>{context.score.teamA} : {context.score.teamB}</strong>
          <span>{context.ft}</span>
        </div>
        <MatchupTeamPlate team={context.teamB} align="right" teamShortScale={context.teamShortScale} />
      </div>

      <div
        className={`${styles.matchupStaticInfoStrip} ${styles.resultStaticInfoStrip}`}
        style={{ gridTemplateColumns: `repeat(${detailItems.length}, minmax(0, 1fr))` }}
      >
        {detailItems.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value || '-'}</strong>
          </div>
        ))}
      </div>

      <footer className={styles.matchupStaticFooter}>
        <span>OWBT // RESULT GRAPHIC</span>
        <strong>COMMUNITY BROADCAST</strong>
      </footer>
    </section>
  )
}

function StaticGraphicPreviewShell({ children, layoutSize }) {
  const shellRef = useRef(null)
  const [previewScale, setPreviewScale] = useState(1)

  useLayoutEffect(() => {
    if (!shellRef.current || typeof ResizeObserver === 'undefined') return undefined

    const shell = shellRef.current
    const syncScale = rect => {
      if (!rect?.width || !rect?.height || !layoutSize?.width || !layoutSize?.height) return
      setPreviewScale(Math.min(rect.width / layoutSize.width, rect.height / layoutSize.height))
    }

    syncScale(shell.getBoundingClientRect())

    const resizeObserver = new ResizeObserver(entries => {
      syncScale(entries[0]?.contentRect)
    })

    resizeObserver.observe(shell)

    return () => resizeObserver.disconnect()
  }, [layoutSize?.height, layoutSize?.width])

  return (
    <section
      ref={shellRef}
      className={styles.staticGraphicPreviewShell}
      style={{ aspectRatio: `${layoutSize.width} / ${layoutSize.height}` }}
    >
      <div
        className={styles.staticGraphicPreviewScaler}
        style={{
          width: `${layoutSize.width}px`,
          height: `${layoutSize.height}px`,
          transform: `scale(${previewScale})`
        }}
      >
        {children}
      </div>
    </section>
  )
}

function ExportScenePreview({ exportRef, exportSize, project, scene }) {
  const shellRef = useRef(null)
  const [previewScale, setPreviewScale] = useState(1)
  const SceneComponent = scene.component
  const sourceScale = Math.min(exportSize.width / BASE_SCENE_WIDTH, exportSize.height / BASE_SCENE_HEIGHT)
  const sourceWidth = BASE_SCENE_WIDTH * sourceScale
  const sourceHeight = BASE_SCENE_HEIGHT * sourceScale
  const sourceOffsetX = (exportSize.width - sourceWidth) / 2
  const sourceOffsetY = (exportSize.height - sourceHeight) / 2

  useLayoutEffect(() => {
    if (!shellRef.current || typeof ResizeObserver === 'undefined') return undefined

    const shell = shellRef.current
    const syncScale = rect => {
      if (!rect?.width || !rect?.height) return
      setPreviewScale(Math.min(rect.width / exportSize.width, rect.height / exportSize.height))
    }

    syncScale(shell.getBoundingClientRect())

    const resizeObserver = new ResizeObserver(entries => {
      syncScale(entries[0]?.contentRect)
    })

    resizeObserver.observe(shell)

    return () => resizeObserver.disconnect()
  }, [exportSize.height, exportSize.width])

  return (
    <section
      ref={shellRef}
      className={styles.sceneExportPreviewShell}
      style={{ aspectRatio: `${exportSize.width} / ${exportSize.height}` }}
    >
      <div
        ref={exportRef}
        className={styles.sceneExportCanvas}
        style={{
          width: `${exportSize.width}px`,
          height: `${exportSize.height}px`,
          transform: `scale(${previewScale})`
        }}
      >
        <div
          className={styles.sceneExportSource}
          style={{
            width: `${BASE_SCENE_WIDTH}px`,
            height: `${BASE_SCENE_HEIGHT}px`,
            transform: `translate(${sourceOffsetX}px, ${sourceOffsetY}px) scale(${sourceScale})`
          }}
        >
          <SceneComponent project={project} scene={scene} />
        </div>
      </div>
    </section>
  )
}

function SettingsField({ label, value, placeholder, onChange }) {
  return (
    <label className={styles.settingsField}>
      <span>{label}</span>
      <input value={value || ''} placeholder={placeholder || ''} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

function SettingsSelect({ disabled = false, label, options = [], placeholder, value, onChange }) {
  return (
    <label className={styles.settingsField}>
      <span>{label}</span>
      <select
        disabled={disabled}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function SettingsToggle({ checked, label, onChange }) {
  return (
    <button
      type="button"
      className={`${styles.settingsToggle} ${checked ? styles.settingsToggleActive : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <strong>{checked ? 'ON' : 'OFF'}</strong>
    </button>
  )
}

function SettingsRange({ autoLabel = 'Auto', label, max = 125, min = 65, step = 5, value, onChange, onReset }) {
  const manualValue = toPercentNumber(value)
  const displayValue = manualValue ? clampPercent(manualValue, 100, min, max) : 100

  return (
    <div className={styles.settingsRange}>
      <div>
        <span>{label}</span>
        <strong>{manualValue ? `${displayValue}%` : autoLabel}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={event => onChange(String(clampPercent(event.target.value, 100, min, max)))}
      />
      <button type="button" onClick={onReset}>{autoLabel}</button>
    </div>
  )
}

function SettingsColorField({ fallback = '#050505', label, value, onChange }) {
  const colorValue = normalizeHexColor(value, fallback) || '#050505'

  return (
    <label className={styles.settingsColorField}>
      <span>{label}</span>
      <div>
        <input type="color" value={colorValue} onChange={event => onChange(event.target.value)} />
        <input value={value || ''} placeholder={fallback} onChange={event => onChange(event.target.value)} />
      </div>
    </label>
  )
}

const getTeamOptionLabel = team => {
  const shortName = getTeamShort(team)
  const name = getTeamLabel(team)
  return shortName === name.toUpperCase() ? name : `${shortName} - ${name}`
}

function GraphicTeamSelector({ context, settings, teams = [], text, onUpdate }) {
  const teamOptions = teams.map(team => ({
    value: team.id,
    label: getTeamOptionLabel(team)
  }))
  const teamAId = clean(settings.teamAId)
  const teamBId = clean(settings.teamBId)

  return (
    <div className={styles.matchupTeamSelectRow}>
      <SettingsSelect
        disabled={!teamOptions.length}
        label={text.teamA}
        options={teamOptions}
        placeholder={`${text.currentValue}: ${getTeamShort(context.teamA)}`}
        value={teamAId}
        onChange={value => onUpdate({ teamAId: value })}
      />
      <SettingsSelect
        disabled={!teamOptions.length}
        label={text.teamB}
        options={teamOptions}
        placeholder={`${text.currentValue}: ${getTeamShort(context.teamB)}`}
        value={teamBId}
        onChange={value => onUpdate({ teamBId: value })}
      />
    </div>
  )
}

function SettingsGroup({ children, className = '', title }) {
  return (
    <div className={[styles.settingsGroup, className].filter(Boolean).join(' ')}>
      <span className={styles.settingsGroupTitle}>{title}</span>
      {children}
    </div>
  )
}

function ToolSettingsPanel({
  activeModeId,
  context,
  exportScenes = [],
  language,
  selectedExportSceneId,
  settings,
  teams = [],
  text,
  onSelectExportScene,
  onUpdate
}) {
  if (activeModeId === 'export-scene') {
    const exportSceneGroups = EXPORT_SCENE_GROUPS
      .map(group => ({
        ...group,
        scenes: exportScenes.filter(scene => group.sceneIds.includes(scene.id))
      }))
      .filter(group => group.scenes.length)
    const activeExportGroup = exportSceneGroups.find(group => (
      group.scenes.some(scene => scene.id === selectedExportSceneId)
    )) || exportSceneGroups[0]
    const activeExportScenes = activeExportGroup?.scenes || exportScenes

    return (
      <section className={styles.toolboxPanel}>
        <div className={styles.panelTitle}>{text.targetScene}</div>
        <div className={styles.sceneExportGroupTabs}>
          {exportSceneGroups.map(group => (
            <button
              key={group.id}
              type="button"
              className={activeExportGroup?.id === group.id ? styles.activeSceneExportGroup : ''}
              onClick={() => onSelectExportScene(group.scenes[0].id)}
            >
              <span>{getExportSceneGroupLabel(text, group)}</span>
              <strong>{group.scenes.length}</strong>
            </button>
          ))}
        </div>
        <div className={styles.sceneExportSelector}>
          {activeExportScenes.map(scene => (
            <button
              key={scene.id}
              type="button"
              className={selectedExportSceneId === scene.id ? styles.activePreset : ''}
              onClick={() => onSelectExportScene(scene.id)}
            >
              <strong>{getSceneDisplay(scene, language).name}</strong>
              <em>{getSceneDisplay(scene, language).meta}</em>
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (activeModeId === 'cover') {
    return (
      <section className={`${styles.toolboxPanel} ${styles.toolSettingsPanel}`}>
        <div className={styles.panelTitle}>{text.toolSettings}</div>
        <div className={styles.settingsLayout}>
          <SettingsGroup className={styles.settingsGroupPrimary} title={text.contentGroup}>
            <div className={styles.settingsFormGrid}>
              <SettingsField label={text.fieldEyebrow} value={settings.eyebrow} placeholder="LIVE BROADCAST" onChange={value => onUpdate({ eyebrow: value })} />
              <SettingsField label={text.fieldTitle} value={settings.title} placeholder={context.eventName} onChange={value => onUpdate({ title: value })} />
              <SettingsField label={text.fieldSubtitle} value={settings.subtitle} placeholder={context.eventSubtitle} onChange={value => onUpdate({ subtitle: value })} />
              <SettingsField label={text.fieldStage} value={settings.stage} placeholder={context.stage} onChange={value => onUpdate({ stage: value })} />
              <SettingsField label={text.format} value={settings.ft} placeholder={context.ft} onChange={value => onUpdate({ ft: value })} />
              <SettingsField label={text.fieldTime} value={settings.time} placeholder="19:30 CST" onChange={value => onUpdate({ time: value })} />
            </div>
          </SettingsGroup>
          <SettingsGroup className={styles.settingsGroupCompact} title={text.displayGroup}>
            <div className={styles.graphicOptionGrid}>
              <div className={styles.settingsTwoCol}>
                <SettingsToggle checked={settings.showTeams === true} label={text.showTeams} onChange={checked => onUpdate({ showTeams: checked })} />
                <SettingsToggle checked={settings.showDetails === true} label={text.showDetails} onChange={checked => onUpdate({ showDetails: checked })} />
              </div>
              <SettingsToggle checked={settings.showTime !== false} label={text.showTime} onChange={checked => onUpdate({ showTime: checked })} />
              <div className={styles.settingsTwoCol}>
                <SettingsRange
                  autoLabel={text.auto}
                  label={text.titleSize}
                  value={settings.titleScale}
                  onChange={value => onUpdate({ titleScale: value })}
                  onReset={() => onUpdate({ titleScale: '' })}
                />
                <SettingsRange
                  autoLabel={text.auto}
                  label={text.subtitleSize}
                  value={settings.subtitleScale}
                  onChange={value => onUpdate({ subtitleScale: value })}
                  onReset={() => onUpdate({ subtitleScale: '' })}
                />
              </div>
              <div className={styles.settingsTwoCol}>
                <SettingsColorField fallback={context.themeColor} label={text.eventLogoBg} value={settings.eventLogoBg} onChange={value => onUpdate({ eventLogoBg: value })} />
                <SettingsColorField fallback={context.themeColor} label={text.teamLogoBg} value={settings.teamLogoBg} onChange={value => onUpdate({ teamLogoBg: value })} />
              </div>
              <SettingsRange
                autoLabel={text.auto}
                label={text.teamShortSize}
                value={settings.teamShortScale}
                onChange={value => onUpdate({ teamShortScale: value })}
                onReset={() => onUpdate({ teamShortScale: '' })}
              />
            </div>
          </SettingsGroup>
        </div>
      </section>
    )
  }

  if (activeModeId === 'matchup') {
    return (
      <section className={`${styles.toolboxPanel} ${styles.toolSettingsPanel}`}>
        <div className={styles.panelTitle}>{text.toolSettings}</div>
        <div className={styles.settingsLayout}>
          <SettingsGroup className={styles.settingsGroupPrimary} title={text.contentGroup}>
            <div className={styles.settingsFormGrid}>
              <GraphicTeamSelector context={context} settings={settings} teams={teams} text={text} onUpdate={onUpdate} />
              <div className={styles.settingsThreeCol}>
                <SettingsField label={text.fieldStage} value={settings.stage} placeholder={context.stage} onChange={value => onUpdate({ stage: value })} />
                <SettingsField label={text.format} value={settings.ft} placeholder={context.ft} onChange={value => onUpdate({ ft: value })} />
                <SettingsField label={text.fieldTime} value={settings.time} placeholder="19:30 CST" onChange={value => onUpdate({ time: value })} />
              </div>
            </div>
          </SettingsGroup>
          <SettingsGroup className={styles.settingsGroupCompact} title={text.displayGroup}>
            <div className={styles.matchupOptionGrid}>
              <SettingsToggle checked={settings.showFt !== false} label={text.showFt} onChange={checked => onUpdate({ showFt: checked })} />
              <SettingsColorField fallback={context.themeColor} label={text.teamLogoBg} value={settings.teamLogoBg} onChange={value => onUpdate({ teamLogoBg: value })} />
              <SettingsRange
                autoLabel={text.auto}
                label={text.teamShortSize}
                value={settings.teamShortScale}
                onChange={value => onUpdate({ teamShortScale: value })}
                onReset={() => onUpdate({ teamShortScale: '' })}
              />
            </div>
          </SettingsGroup>
        </div>
      </section>
    )
  }

  return (
    <section className={`${styles.toolboxPanel} ${styles.toolSettingsPanel}`}>
      <div className={styles.panelTitle}>{text.toolSettings}</div>
      <div className={styles.settingsLayout}>
        <SettingsGroup className={styles.settingsGroupPrimary} title={text.contentGroup}>
          <div className={styles.settingsFormGrid}>
            <GraphicTeamSelector context={context} settings={settings} teams={teams} text={text} onUpdate={onUpdate} />
            <div className={styles.settingsFourCol}>
              <SettingsField label={text.fieldTitle} value={settings.title} placeholder="MATCH RESULT" onChange={value => onUpdate({ title: value })} />
              <SettingsField label={text.format} value={settings.ft} placeholder={context.ft} onChange={value => onUpdate({ ft: value })} />
              <SettingsField label={text.fieldStage} value={settings.stage} placeholder={context.stage} onChange={value => onUpdate({ stage: value })} />
              <SettingsField label={text.fieldWinner} value={settings.winner} placeholder={context.winner || text.winner} onChange={value => onUpdate({ winner: value })} />
            </div>
            <div className={styles.settingsTwoCol}>
              <SettingsField label={text.fieldMvp} value={settings.mvp} placeholder="Player Name" onChange={value => onUpdate({ mvp: value })} />
              <SettingsField label={text.fieldNote} value={settings.note} placeholder="Clutch performance" onChange={value => onUpdate({ note: value })} />
            </div>
          </div>
        </SettingsGroup>
        <SettingsGroup className={styles.settingsGroupScore} title={text.scoreGroup}>
          <div className={styles.settingsTwoCol}>
            <SettingsField label={text.fieldScoreA} value={settings.scoreTeamA} placeholder={String(context.score?.teamA ?? 0)} onChange={value => onUpdate({ scoreTeamA: value })} />
            <SettingsField label={text.fieldScoreB} value={settings.scoreTeamB} placeholder={String(context.score?.teamB ?? 0)} onChange={value => onUpdate({ scoreTeamB: value })} />
          </div>
          <SettingsColorField fallback={context.themeColor} label={text.teamLogoBg} value={settings.teamLogoBg} onChange={value => onUpdate({ teamLogoBg: value })} />
          <SettingsRange
            autoLabel={text.auto}
            label={text.teamShortSize}
            value={settings.teamShortScale}
            onChange={value => onUpdate({ teamShortScale: value })}
            onReset={() => onUpdate({ teamShortScale: '' })}
          />
        </SettingsGroup>
      </div>
    </section>
  )
}

function ToolboxStatusStrip({ activeModeDisplay, context, exportSize, isSnapshotMode, text }) {
  const signals = [
    { label: text.selectedTool, value: activeModeDisplay.shortLabel },
    { label: text.outputSize, value: `${exportSize.width} x ${exportSize.height}` },
    { label: text.dataSource, value: isSnapshotMode ? text.snapshotMode : text.currentMatchData },
    { label: text.match, value: `${getTeamShort(context.teamA)} vs ${getTeamShort(context.teamB)}` },
    { label: text.map, value: context.currentMap },
    { label: text.programScene, value: context.programScene }
  ]

  return (
    <div className={styles.toolboxStatusStrip}>
      {signals.map(signal => (
        <div key={signal.label}>
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
        </div>
      ))}
    </div>
  )
}

function ExportManifest({ rows, text }) {
  return (
    <div className={styles.exportManifest}>
      <div className={styles.exportManifestTitle}>{text.exportManifest}</div>
      <div className={styles.exportManifestRows}>
        {rows.map(row => (
          <div
            key={row.label}
            className={`${styles.exportManifestRow} ${row.kind === 'file' ? styles.exportManifestFileRow : ''}`}
          >
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportHistoryList({ items, text }) {
  return (
    <div className={styles.exportHistoryList}>
      <div className={styles.exportHistoryTitle}>{text.recentExports}</div>
      {items.length ? items.map(item => (
        <div className={styles.exportHistoryItem} key={item.id}>
          <strong>{item.filename}</strong>
          <em>{item.target}</em>
          <div>
            <span>{item.time}</span>
            <span>{item.size}</span>
            <span>{item.aspect}</span>
            <span>{item.dataMode}</span>
          </div>
        </div>
      )) : (
        <div className={styles.exportHistoryEmpty}>{text.noRecentExports}</div>
      )}
    </div>
  )
}

export default function ToolboxWorkspace({ project, language, programScene, onUpdateProject }) {
  const exportRef = useRef(null)
  const [activeModeId, setActiveModeId] = useState('cover')
  const [presetId, setPresetId] = useState('1080p')
  const [customWidth, setCustomWidth] = useState(1920)
  const [customHeight, setCustomHeight] = useState(1080)
  const [selectedExportSceneId, setSelectedExportSceneId] = useState(() => (
    programScene?.id || project.scenes?.activeSceneId || 'countdown'
  ))
  const [exportHistory, setExportHistory] = useState([])
  const [exportState, setExportState] = useState('ready')
  const [exportMessage, setExportMessage] = useState('')
  const text = getToolboxCopy(language)
  const activeMode = TOOLBOX_MODES.find(mode => mode.id === activeModeId) || TOOLBOX_MODES[0]
  const activeModeDisplay = getToolboxModeDisplay(text, activeMode)
  const activePreset = EXPORT_PRESETS.find(preset => preset.id === presetId) || EXPORT_PRESETS[0]
  const settings = getGraphicSettings(project, activeModeId)
  const assetSettings = getAssetSettings(project)
  const isSnapshotMode = settings.useCurrentMatchData === false
  const canEditToolSettings = ['cover', 'matchup', 'result'].includes(activeModeId)
  const exportScenes = useMemo(() => getExportableScenes(project), [project])
  const selectedExportScene = exportScenes.find(scene => scene.id === selectedExportSceneId) || exportScenes[0] || SCENE_REGISTRY[0]
  const exportSceneProject = useMemo(() => (
    createSceneProject(project, selectedExportScene.id)
  ), [project, selectedExportScene.id])

  const baseContext = useMemo(() => (
    buildBaseContext({ language, programScene, project })
  ), [language, programScene, project])

  const context = useMemo(() => (
    resolveToolContext({ activeModeId, baseContext, project, settings })
  ), [activeModeId, baseContext, project, settings])

  const displayContext = useMemo(() => (
    activeModeId === 'export-scene'
      ? { ...context, programScene: getSceneDisplay(selectedExportScene, language).name }
      : context
  ), [activeModeId, context, language, selectedExportScene])

  const updateToolSettings = patch => {
    if (!canEditToolSettings) return

    onUpdateProject(draft => {
      Object.assign(ensureGraphicSettings(draft, activeModeId), patch)
    })
  }

  const snapshotCurrentData = () => {
    if (!canEditToolSettings) return

    onUpdateProject(draft => {
      const nextSettings = ensureGraphicSettings(draft, activeModeId)
      nextSettings.snapshot = buildSnapshot(resolveToolContext({
        activeModeId,
        baseContext,
        project,
        settings: {
          ...settings,
          useCurrentMatchData: true
        }
      }))
      nextSettings.useCurrentMatchData = false
    })
  }

  const exportSize = useMemo(() => {
    if (presetId === 'custom') {
      return {
        width: clampDimension(customWidth),
        height: clampDimension(customHeight)
      }
    }

    return {
      width: activePreset.width || 1920,
      height: activePreset.height || 1080
    }
  }, [activePreset.height, activePreset.width, customHeight, customWidth, presetId])

  const exportFilename = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10)
    const toolId = activeModeId === 'export-scene'
      ? `${activeMode.id}-${selectedExportScene.id}`
      : activeMode.id

    return `${slugify(context.eventName)}-${toolId}-${exportSize.width}x${exportSize.height}-${date}.png`
  }, [activeMode.id, activeModeId, context.eventName, exportSize.height, exportSize.width, selectedExportScene.id])

  const exportTarget = activeModeId === 'export-scene'
    ? getSceneDisplay(selectedExportScene, language).name
    : activeModeDisplay.shortLabel
  const exportDataMode = activeModeId === 'export-scene'
    ? text.programScene
    : (isSnapshotMode ? text.snapshotMode : text.currentMatchData)
  const exportAspectRatio = formatAspectRatio(exportSize)
  const staticExportLayoutSize = useMemo(() => (
    getStaticExportLayoutSize(exportSize)
  ), [exportSize])
  const exportLayoutSize = STATIC_GRAPHIC_MODE_IDS.includes(activeModeId)
    ? staticExportLayoutSize
    : exportSize
  const exportManifestRows = useMemo(() => [
    { label: text.exportFileName, value: exportFilename, kind: 'file' },
    { label: text.exportTarget, value: exportTarget },
    { label: text.outputSize, value: `${exportSize.width} x ${exportSize.height}` },
    { label: text.aspectRatio, value: exportAspectRatio },
    { label: text.dataMode, value: exportDataMode },
    ...(activeModeId === 'cover' ? [{ label: text.eventLogo, value: getEventLogoSourceLabel(displayContext.eventLogoSource) }] : []),
    ...(activeModeId === 'cover' && !displayContext.showTeams ? [] : [{ label: text.match, value: `${getTeamShort(displayContext.teamA)} vs ${getTeamShort(displayContext.teamB)}` }]),
    ...(['cover', 'matchup'].includes(activeModeId) ? [] : [{ label: text.map, value: displayContext.currentMap }])
  ], [activeModeId, displayContext.currentMap, displayContext.eventLogoSource, displayContext.showTeams, displayContext.teamA, displayContext.teamB, exportAspectRatio, exportDataMode, exportFilename, exportSize.height, exportSize.width, exportTarget, text.aspectRatio, text.dataMode, text.eventLogo, text.exportFileName, text.exportTarget, text.map, text.match, text.outputSize])

  const handleExportPng = async () => {
    if (!exportRef.current || exportState === 'exporting') return

    setExportState('exporting')
    setExportMessage('')

    try {
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      const { toBlob } = await import('html-to-image')

      const blob = await toBlob(exportRef.current, {
        width: exportLayoutSize.width,
        height: exportLayoutSize.height,
        canvasWidth: exportSize.width,
        canvasHeight: exportSize.height,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#050505',
        imagePlaceholder: '',
        style: {
          width: `${exportLayoutSize.width}px`,
          height: `${exportLayoutSize.height}px`,
          minHeight: '0',
          maxWidth: 'none',
          aspectRatio: `${exportLayoutSize.width} / ${exportLayoutSize.height}`,
          transform: 'none',
          transformOrigin: 'top left'
        }
      })

      if (!blob) throw new Error('PNG renderer returned an empty image.')

      downloadBlob(blob, exportFilename)
      setExportState('ready')
      setExportMessage(exportFilename)
      setExportHistory(prev => [{
        id: `${Date.now()}-${activeMode.id}`,
        filename: exportFilename,
        size: `${exportSize.width} x ${exportSize.height}`,
        target: exportTarget,
        aspect: exportAspectRatio,
        dataMode: exportDataMode,
        time: formatExportTime(new Date())
      }, ...prev].slice(0, 5))
    } catch (error) {
      setExportState('error')
      setExportMessage(error?.message || text.exportFailed)
    }
  }

  const renderGraphicPreview = ({ targetRef = null, exportRender = false, previewKind, previewSize = exportSize } = {}) => {
    if (activeModeId === 'matchup') {
      return (
        <MatchupPreview
          context={context}
          exportRef={targetRef}
          exportRender={exportRender}
          previewKind={previewKind}
          exportSize={previewSize}
        />
      )
    }

    if (activeModeId === 'result') {
      return (
        <ResultPreview
          context={context}
          exportRef={targetRef}
          exportRender={exportRender}
          previewKind={previewKind}
          exportSize={previewSize}
        />
      )
    }

    return (
      <CoverPreview
        context={context}
        exportRef={targetRef}
        exportRender={exportRender}
        previewKind={previewKind}
        exportSize={previewSize}
      />
    )
  }

  const renderPreview = () => {
    if (activeModeId === 'assets') {
      return (
        <AssetsWorkspace
          assetSettings={assetSettings}
          project={project}
          text={text}
          onUpdateProject={onUpdateProject}
        />
      )
    }

    if (activeModeId === 'export-scene') {
      return (
        <ExportScenePreview
          exportRef={exportRef}
          exportSize={exportSize}
          project={exportSceneProject}
          scene={selectedExportScene}
        />
      )
    }

    return (
      <StaticGraphicPreviewShell layoutSize={staticExportLayoutSize}>
        {renderGraphicPreview({
          exportRender: true,
          previewKind: 'preview',
          previewSize: staticExportLayoutSize
        })}
      </StaticGraphicPreviewShell>
    )
  }

  const renderHiddenExportPreview = () => {
    if (!STATIC_GRAPHIC_MODE_IDS.includes(activeModeId)) return null

    return (
      <div className={styles.hiddenExportStage} aria-hidden="true" data-toolbox-hidden-export-stage>
        {renderGraphicPreview({
          targetRef: exportRef,
          exportRender: true,
          previewKind: 'export',
          previewSize: staticExportLayoutSize
        })}
      </div>
    )
  }

  const renderToolSettingsContent = () => {
    if (activeModeId === 'assets') return null

    return (
      <ToolSettingsPanel
        activeModeId={activeModeId}
        context={displayContext}
        exportScenes={exportScenes}
        language={language}
        selectedExportSceneId={selectedExportScene.id}
        settings={settings}
        teams={project.teams || []}
        text={text}
        onSelectExportScene={setSelectedExportSceneId}
        onUpdate={updateToolSettings}
      />
    )
  }

  const renderRailContent = () => {
    if (activeModeId === 'assets') {
      return (
        <AssetsSummaryPanel
          assetSettings={assetSettings}
          project={project}
          text={text}
        />
      )
    }

    return (
      <>
        <section className={styles.toolboxPanel}>
          <div className={styles.panelTitle}>{text.exportSettings}</div>
          <div className={styles.optionBlock}>
            <span>{text.outputSize}</span>
            <div className={styles.presetGrid}>
              {EXPORT_PRESETS.map(preset => {
                const presetDisplay = getExportPresetDisplay(text, preset)

                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={presetId === preset.id ? styles.activePreset : ''}
                    onClick={() => setPresetId(preset.id)}
                  >
                    <strong>{presetDisplay.label}</strong>
                    <em>{presetDisplay.size}</em>
                  </button>
                )
              })}
            </div>
          </div>
          {presetId === 'custom' && (
            <div className={styles.customSizeGrid}>
              <label>
                <span>{text.width}</span>
                <input
                  type="number"
                  min="320"
                  max="7680"
                  step="10"
                  value={customWidth}
                  onChange={event => setCustomWidth(event.target.value)}
                  onBlur={() => setCustomWidth(clampDimension(customWidth))}
                />
              </label>
              <label>
                <span>{text.height}</span>
                <input
                  type="number"
                  min="320"
                  max="7680"
                  step="10"
                  value={customHeight}
                  onChange={event => setCustomHeight(event.target.value)}
                  onBlur={() => setCustomHeight(clampDimension(customHeight))}
                />
              </label>
            </div>
          )}
          <div className={styles.infoRows}>
            <span>{text.fileType}</span>
            <strong>PNG</strong>
            <span>{text.selectedTool}</span>
            <strong>{activeModeDisplay.label}</strong>
            <span>{text.status}</span>
            <strong>{exportState === 'exporting' ? text.exporting : exportState === 'error' ? text.exportFailed : text.exportReady}</strong>
          </div>
          <ExportManifest rows={exportManifestRows} text={text} />
          <button
            type="button"
            className={styles.exportButton}
            disabled={exportState === 'exporting'}
            onClick={handleExportPng}
          >
            {exportState === 'exporting' ? text.exporting : text.exportPng}
          </button>
          <div className={`${styles.exportMessage} ${exportState === 'error' ? styles.exportMessageError : ''}`}>
            {exportMessage || text.exportHint}
          </div>
          <ExportHistoryList items={exportHistory} text={text} />
        </section>

        <section className={styles.toolboxPanel}>
          <div className={styles.panelTitle}>{text.dataSource}</div>
          {canEditToolSettings && (
            <div className={styles.dataModeGrid}>
              <button
                type="button"
                className={!isSnapshotMode ? styles.activePreset : ''}
                onClick={() => updateToolSettings({ useCurrentMatchData: true })}
              >
                {text.currentMatchData}
              </button>
              <button
                type="button"
                className={isSnapshotMode ? styles.activePreset : ''}
                onClick={snapshotCurrentData}
              >
                {text.snapshotCurrent}
              </button>
            </div>
          )}
          <div className={styles.infoRows}>
            <span>{text.status}</span>
            <strong>{isSnapshotMode ? text.snapshotMode : text.useCurrent}</strong>
            <span>{text.event}</span>
            <strong>{displayContext.eventName}</strong>
            <span>{text.eventLogo}</span>
            <strong>{getEventLogoSourceLabel(displayContext.eventLogoSource)}</strong>
            <span>{text.match}</span>
            <strong>{getTeamShort(displayContext.teamA)} vs {getTeamShort(displayContext.teamB)}</strong>
            <span>{text.score}</span>
            <strong>{displayContext.score.teamA} : {displayContext.score.teamB}</strong>
            <span>{text.format}</span>
            <strong>{displayContext.ft}</strong>
            <span>{text.map}</span>
            <strong>{displayContext.currentMap}</strong>
            <span>{text.programScene}</span>
            <strong>{displayContext.programScene}</strong>
          </div>
        </section>
      </>
    )
  }

  return (
    <section className={styles.toolboxWorkspace}>
      <div className={styles.toolboxMain}>
        <header className={styles.toolboxHeader}>
          <div>
            <span>{text.kicker}</span>
            <h3>{text.title}</h3>
          </div>
          <div className={styles.toolboxTabs}>
            {TOOLBOX_MODES.map(mode => {
              const modeDisplay = getToolboxModeDisplay(text, mode)

              return (
                <button
                  key={mode.id}
                  type="button"
                  className={activeModeId === mode.id ? styles.activeTab : ''}
                  onClick={() => setActiveModeId(mode.id)}
                >
                  <span>{modeDisplay.shortLabel}</span>
                  <em>{modeDisplay.meta}</em>
                </button>
              )
            })}
          </div>
        </header>

        <ToolboxStatusStrip
          activeModeDisplay={activeModeDisplay}
          context={displayContext}
          exportSize={exportSize}
          isSnapshotMode={isSnapshotMode}
          text={text}
        />

        <div className={`${styles.toolboxDeck} ${activeModeId === 'assets' ? styles.toolboxDeckAssets : ''}`}>
          <div className={styles.toolboxWorkColumn}>
            <div className={`${styles.canvasStage} ${activeModeId === 'assets' ? styles.canvasStageAssets : ''}`}>
              {renderPreview()}
            </div>
            {renderToolSettingsContent()}
          </div>

          <aside className={styles.toolboxRail}>
            {renderRailContent()}
          </aside>
        </div>
      </div>
      {renderHiddenExportPreview()}
    </section>
  )
}
