import { useState } from 'react'
import { getCurrentTeams } from '../../../project/projectUtils'
import styles from '../shared/SceneEditor.styles.js'
import { getCountdownEditorCopy } from '../shared/editorCopy'
import { Field, Panel, SegmentedControl } from '../shared/editorControls'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'

const MAX_UPCOMING_MATCHES = 4

const clean = value => String(value || '').trim()

const getDisplayGroupLabel = language => (language === 'zh' ? '显示' : 'Show')

const getShortDisplayLabel = label => clean(label)
  .replace(/^显示\s*/u, '')
  .replace(/^Show\s+/i, '')

function BreakSwitchButton({ label, checked, onChange, language, compact = false }) {
  const stateLabel = language === 'zh'
    ? (checked ? '\u5f00' : '\u5173')
    : (checked ? 'ON' : 'OFF')

  return (
    <button
      type="button"
      className={[
        styles.breakSwitchButton,
        checked ? styles.breakSwitchButtonActive : '',
        compact ? styles.breakSwitchButtonCompact : ''
      ].filter(Boolean).join(' ')}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <strong>{stateLabel}</strong>
    </button>
  )
}

const SCHEDULE_MATCH_FIELDS = [
  'time',
  'stage',
  'teamA',
  'teamB',
  'logoA',
  'logoB',
  'logoBgA',
  'logoBgB',
  'scoreA',
  'scoreB'
]

const getDisplayMode = value => (
  ['standby', 'full', 'video'].includes(value) ? value : 'standby'
)

const isMatchVisible = match => match?.enabled !== false

const isEmptyScheduleMatch = match => (
  match?.enabled === false && SCHEDULE_MATCH_FIELDS.every(field => !clean(match?.[field]))
)

const trimTrailingEmptyMatches = matches => {
  let endIndex = matches.length

  while (endIndex > 0 && isEmptyScheduleMatch(matches[endIndex - 1])) {
    endIndex -= 1
  }

  return matches.slice(0, endIndex)
}

const getAssetState = (value, text) => {
  const source = clean(value)
  if (!source) return text.assetEmpty
  if (source.startsWith('data:')) return text.assetCustom
  return source.split(/[\\/]/).pop() || text.assetReady
}

const getDisplayNameFromPath = path => {
  const source = clean(path)
  if (!source) return ''

  const withoutQuery = source.split('?')[0]
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() || ''
}

function CountdownEditor({ project, text, language, onUpdateProject }) {
  const countdownText = getCountdownEditorCopy(language)
  const settings = getSceneSettings(project, 'countdown')
  const mediaSettings = getSceneSettings(project, 'media')
  const durationSeconds = Math.max(0, Number(settings.durationSeconds) || 0)
  const [localMinutes, setLocalMinutes] = useState(Math.floor(durationSeconds / 60))
  const [localSeconds, setLocalSeconds] = useState(durationSeconds % 60)
  const [expandedSlot, setExpandedSlot] = useState(0)
  const [identityExpanded, setIdentityExpanded] = useState(false)
  const displayMode = getDisplayMode(settings.displayMode)
  const eventNameLanguage = settings.eventNameLanguage === 'zh' ? 'zh' : 'en'
  const breakModeOptions = [
    { value: 'standby', label: countdownText.standbyMode },
    { value: 'full', label: countdownText.countdownMode },
    { value: 'video', label: countdownText.videoMode }
  ]
  const isStandbyMode = displayMode === 'standby'
  const upcomingMatches = Array.isArray(settings.upcomingMatches) ? settings.upcomingMatches : []
  const { teamA, teamB } = getCurrentTeams(project)
  const mediaLibrary = Array.isArray(mediaSettings.videoLibrary) ? mediaSettings.videoLibrary : []
  const mediaPlaylist = Array.isArray(mediaSettings.videoPlaylist) ? mediaSettings.videoPlaylist.map(clean).filter(Boolean) : []
  const cleanVideoPath = clean(mediaSettings.activeVideoPath) || mediaPlaylist[0] || ''
  const cleanVideoItem = mediaLibrary.find(item => clean(item.path) === cleanVideoPath)
  const cleanVideoName = clean(cleanVideoItem?.name || mediaSettings.sourceName) || getDisplayNameFromPath(cleanVideoPath) || countdownText.noCleanVideo
  const cleanVideoRenderMode = mediaSettings.videoRenderMode === 'OBS_LOCAL'
    ? countdownText.obsSource
    : countdownText.toolkitPlayback
  const displayGroupLabel = getDisplayGroupLabel(language)
  const identitySectionLabel = language === 'zh' ? '\u8d5b\u4e8b\u4fe1\u606f' : 'Event Identity'
  const identityActionLabel = language === 'zh'
    ? (identityExpanded ? '\u6536\u8d77' : '\u5c55\u5f00')
    : (identityExpanded ? 'Collapse' : 'Expand')
  const identitySummary = [project.event?.nameEn, project.event?.nameZh, project.event?.subtitle]
    .map(clean)
    .filter(Boolean)
    .join(' / ') || countdownText.unconfiguredSlot

  const createEmptyUpcomingMatch = (enabled = false) => ({
    enabled,
    time: '',
    stage: '',
    teamA: '',
    teamB: '',
    logoA: '',
    logoB: '',
    logoBgA: '',
    logoBgB: '',
    scoreA: '',
    scoreB: ''
  })

  const createCurrentMatchSlot = (enabled = false) => ({
    enabled,
    time: '',
    stage: project?.currentMatch?.stage || '',
    teamA: teamA?.shortName || teamA?.name || 'TEAM A',
    teamB: teamB?.shortName || teamB?.name || 'TEAM B',
    logoA: teamA?.logo || '',
    logoB: teamB?.logo || '',
    logoBgA: teamA?.primaryColor || '#101010',
    logoBgB: teamB?.primaryColor || '#101010',
    scoreA: '',
    scoreB: ''
  })

  const scheduleSlots = Array.from({ length: MAX_UPCOMING_MATCHES }, (_, index) => {
    const storedMatch = upcomingMatches[index]
    if (storedMatch && !isEmptyScheduleMatch(storedMatch)) return storedMatch
    return index === 0 ? createCurrentMatchSlot(false) : createEmptyUpcomingMatch(false)
  })
  const visibleMatchCount = scheduleSlots.filter(isMatchVisible).length

  const updateSetting = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'countdown'), patch)
    })
  }

  const updateDisplayMode = value => {
    updateSetting({
      displayMode: value,
      ...(value === 'standby' ? { showMatchCard: false } : null)
    })
  }

  const applyCountdownTime = () => {
    const safeMinutes = Math.max(0, Number(localMinutes) || 0)
    const safeSeconds = Math.max(0, Math.min(59, Number(localSeconds) || 0))
    const totalSeconds = safeMinutes * 60 + safeSeconds

    onUpdateProject(draft => {
      const countdown = ensureSceneSettings(draft, 'countdown')
      countdown.durationSeconds = totalSeconds
      countdown.targetTimestamp = Date.now() + totalSeconds * 1000
    })
  }

  const stopTimer = () => updateSetting({ targetTimestamp: 0 })

  const updateEventName = field => value => {
    const settingsField = field === 'nameZh' ? 'competitionNameZh' : 'competitionNameEn'

    onUpdateProject(draft => {
      draft.event[field] = value
      ensureSceneSettings(draft, 'opening')[settingsField] = value

      if (field === 'nameEn') {
        draft.event.name = value
        draft.meta.name = value || draft.event.nameZh || 'OWBT Project'
      }
    })
  }

  const updateEventFullName = value => {
    onUpdateProject(draft => {
      draft.event.subtitle = value
      ensureSceneSettings(draft, 'countdown').subtitle = value
    })
  }

  const updateUpcomingMatch = (index, patch) => {
    const storedSlots = Array.from({ length: MAX_UPCOMING_MATCHES }, (_, matchIndex) => (
      upcomingMatches[matchIndex] || createEmptyUpcomingMatch(false)
    ))
    const storedTarget = upcomingMatches[index]
    const targetBase = storedTarget && !isEmptyScheduleMatch(storedTarget)
      ? storedTarget
      : (index === 0 ? createCurrentMatchSlot(false) : createEmptyUpcomingMatch(false))
    const nextMatches = storedSlots.map((match, matchIndex) => (
      matchIndex === index ? { ...targetBase, ...patch } : match
    ))

    updateSetting({ upcomingMatches: trimTrailingEmptyMatches(nextMatches) })
  }

  const fillUpcomingMatchFromCurrent = index => {
    updateUpcomingMatch(index, createCurrentMatchSlot(true))
  }

  const clearUpcomingMatch = index => {
    updateUpcomingMatch(index, createEmptyUpcomingMatch(false))
  }

  return (
    <div className={styles.breakEditorShell}>
      <div className={styles.breakEditorControlStack}>
        <Panel title={countdownText.breakSetup}>
          <div className={styles.breakTopControlGrid}>
            <Field label={countdownText.breakMode}>
              <SegmentedControl
                value={displayMode}
                options={breakModeOptions}
                onChange={updateDisplayMode}
              />
            </Field>
            <Field label={countdownText.eventNameDisplay}>
              <SegmentedControl
                value={eventNameLanguage}
                options={[
                  { value: 'zh', label: countdownText.chineseName },
                  { value: 'en', label: countdownText.englishName }
                ]}
                onChange={value => updateSetting({ eventNameLanguage: value })}
              />
            </Field>
          </div>

          <div className={`${styles.breakCopyGrid} ${identityExpanded ? styles.breakCopyGridExpanded : ''}`}>
            <div className={styles.breakIdentitySection}>
              <button
                type="button"
                className={styles.breakIdentityDisclosure}
                aria-expanded={identityExpanded}
                title={identitySummary}
                onClick={() => setIdentityExpanded(value => !value)}
              >
                <span>{identitySectionLabel}</span>
                <strong>{identitySummary}</strong>
                <em>{identityActionLabel}</em>
              </button>

              {identityExpanded && (
                <div className={styles.breakIdentityFields}>
                  <Field label={text.eventNameEn}>
                    <input
                      value={project.event?.nameEn || ''}
                      onChange={event => updateEventName('nameEn')(event.target.value)}
                      placeholder="OWBT"
                    />
                  </Field>

                  <Field label={text.eventNameZh}>
                    <input
                      value={project.event?.nameZh || ''}
                      onChange={event => updateEventName('nameZh')(event.target.value)}
                      placeholder="OWBT"
                    />
                  </Field>

                  <Field label={text.eventSubtitle}>
                    <input
                      value={project.event?.subtitle || ''}
                      onChange={event => updateEventFullName(event.target.value)}
                      placeholder="OVERWATCH COMMUNITY TOURNAMENT"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className={styles.breakStatusField}>
              <Field label={countdownText.statusText}>
                <input
                  value={settings.statusText || ''}
                  onChange={event => updateSetting({ statusText: event.target.value })}
                  placeholder="PLEASE STAND BY"
                />
              </Field>
            </div>
          </div>

          {!isStandbyMode && (
            <div className={styles.breakTimerConsole}>
              <Field label={countdownText.minutes}>
                <input
                  type="number"
                  min="0"
                  value={localMinutes}
                  onChange={event => setLocalMinutes(event.target.value)}
                />
              </Field>

              <Field label={countdownText.seconds}>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={localSeconds}
                  onChange={event => setLocalSeconds(event.target.value)}
                />
              </Field>

              <Field label={countdownText.finishedText}>
                <input
                  value={settings.finishedText || ''}
                  onChange={event => updateSetting({ finishedText: event.target.value })}
                  placeholder="READY"
                />
              </Field>

              <button
                type="button"
                className={styles.primaryButton}
                title={countdownText.startTimerLabel}
                aria-label={countdownText.startTimerLabel}
                onClick={applyCountdownTime}
              >
                {countdownText.startTimer}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                title={countdownText.stopTimerLabel}
                aria-label={countdownText.stopTimerLabel}
                onClick={stopTimer}
              >
                {countdownText.stopTimer}
              </button>
            </div>
          )}

          <div className={`${styles.breakFeatureStrip} ${isStandbyMode ? styles.breakFeatureStripStandby : ''}`}>
            <span className={styles.breakFeatureLabel}>{displayGroupLabel}</span>
            <div className={styles.breakFeatureOptions}>
              <BreakSwitchButton
                label={getShortDisplayLabel(countdownText.showLogo)}
                checked={settings.showEventLogo !== false}
                onChange={checked => updateSetting({ showEventLogo: checked })}
                language={language}
              />
              <BreakSwitchButton
                label={getShortDisplayLabel(countdownText.showEvent)}
                checked={settings.showEventName !== false}
                onChange={checked => updateSetting({ showEventName: checked })}
                language={language}
              />
              <BreakSwitchButton
                label={getShortDisplayLabel(countdownText.showStatus)}
                checked={settings.showStatus !== false}
                onChange={checked => updateSetting({ showStatus: checked })}
                language={language}
              />
              {!isStandbyMode && (
                <BreakSwitchButton
                  label={getShortDisplayLabel(countdownText.showSchedule)}
                  checked={settings.showSchedule !== false}
                  onChange={checked => updateSetting({ showSchedule: checked })}
                  language={language}
                />
              )}
              <BreakSwitchButton
                label={getShortDisplayLabel(countdownText.showSponsor)}
                checked={settings.showSponsor === true}
                onChange={checked => updateSetting({ showSponsor: checked })}
                language={language}
              />
            </div>
          </div>

          {displayMode === 'video' && (
            <div className={styles.breakCleanVideoStatus}>
              <div>
                <strong>{cleanVideoName}</strong>
                <span>{cleanVideoPath || countdownText.cleanVideoHint}</span>
              </div>
              <em>{countdownText.queueStatus(mediaPlaylist.length, cleanVideoRenderMode)}</em>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={countdownText.scheduleSlots} className={styles.breakSchedulePanel}>
        <div className={styles.breakScheduleHeader}>
          <div>
            <strong>{countdownText.scheduleHeader(visibleMatchCount, MAX_UPCOMING_MATCHES)}</strong>
            <span>{countdownText.scheduleHint}</span>
          </div>
        </div>

        <div className={styles.breakScheduleRows}>
          {scheduleSlots.map((match, index) => {
            const visible = isMatchVisible(match)
            const expanded = expandedSlot === index
            const scoreText = clean(match.scoreA) || clean(match.scoreB)
              ? `${clean(match.scoreA) || '0'} - ${clean(match.scoreB) || '0'}`
              : 'VS'
            const teamALabel = clean(match.teamA) || countdownText.tbdTeam
            const teamBLabel = clean(match.teamB) || countdownText.tbdTeam
            const metaLabel = clean(match.time) || clean(match.stage) || countdownText.unconfiguredSlot

            return (
              <section className={`${styles.breakScheduleSlot} ${visible ? '' : styles.breakScheduleSlotHidden}`} key={index}>
                <header className={styles.breakScheduleSlotHeader}>
                  <button
                    type="button"
                    className={styles.breakScheduleSlotButton}
                    aria-expanded={expanded}
                    onClick={() => setExpandedSlot(expanded ? -1 : index)}
                  >
                    <span>{countdownText.matchSlot(index)}</span>
                    <strong>{teamALabel}</strong>
                    <em>{scoreText}</em>
                    <strong>{teamBLabel}</strong>
                    <small>{metaLabel}</small>
                  </button>

                  <div className={styles.breakScheduleVisibility}>
                    <BreakSwitchButton
                      label={displayGroupLabel}
                      checked={visible}
                      onChange={checked => updateUpcomingMatch(index, { enabled: checked })}
                      language={language}
                      compact
                    />
                  </div>
                </header>

                {expanded && (
                  <div className={styles.breakScheduleDetails}>
                    <div className={styles.breakScheduleTools}>
                      <button type="button" className={styles.secondaryButton} onClick={() => fillUpcomingMatchFromCurrent(index)}>
                        {countdownText.useCurrentMatch}
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={() => clearUpcomingMatch(index)}>
                        {countdownText.clearSlot}
                      </button>
                    </div>

                    <div className={styles.breakSchedulePrimaryGrid}>
                      <Field label={text.time}>
                        <input value={match.time || ''} onChange={event => updateUpcomingMatch(index, { time: event.target.value })} placeholder="20:00" />
                      </Field>
                      <Field label={text.stage}>
                        <input value={match.stage || ''} onChange={event => updateUpcomingMatch(index, { stage: event.target.value })} placeholder="Upper Final" />
                      </Field>
                      <Field label={text.scoreA}>
                        <input value={match.scoreA ?? ''} onChange={event => updateUpcomingMatch(index, { scoreA: event.target.value })} placeholder="0" />
                      </Field>
                      <Field label={text.scoreB}>
                        <input value={match.scoreB ?? ''} onChange={event => updateUpcomingMatch(index, { scoreB: event.target.value })} placeholder="0" />
                      </Field>
                      <Field label={text.teamA}>
                        <input value={match.teamA || ''} onChange={event => updateUpcomingMatch(index, { teamA: event.target.value })} placeholder="TEAM A" />
                      </Field>
                      <Field label={text.teamB}>
                        <input value={match.teamB || ''} onChange={event => updateUpcomingMatch(index, { teamB: event.target.value })} placeholder="TEAM B" />
                      </Field>
                    </div>

                    <div className={styles.breakScheduleAssetsGrid}>
                      <Field label={countdownText.logoA(getAssetState(match.logoA, text))}>
                        <input value={match.logoA || ''} onChange={event => updateUpcomingMatch(index, { logoA: event.target.value })} placeholder="/team-a.png" />
                      </Field>
                      <Field label={countdownText.bgA}>
                        <input type="color" value={match.logoBgA || '#101010'} onChange={event => updateUpcomingMatch(index, { logoBgA: event.target.value })} />
                      </Field>
                      <Field label={countdownText.logoB(getAssetState(match.logoB, text))}>
                        <input value={match.logoB || ''} onChange={event => updateUpcomingMatch(index, { logoB: event.target.value })} placeholder="/team-b.png" />
                      </Field>
                      <Field label={countdownText.bgB}>
                        <input type="color" value={match.logoBgB || '#101010'} onChange={event => updateUpcomingMatch(index, { logoBgB: event.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

export default CountdownEditor
