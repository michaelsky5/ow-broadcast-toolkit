import { useRef } from 'react'
import styles from '../shared/SceneEditor.styles.js'
import { getCasterEditorCopy } from '../shared/editorCopy'
import { Field, Panel, SegmentedControl } from '../shared/editorControls'
import { ensureSceneSettings, getSceneSettings, normalizeBanList } from '../shared/editorHelpers'
import { OW_MAP_BY_ID } from '../../../data/overwatch'
import { getCurrentTeams, getStartingPlayers } from '../../../project/projectUtils'

const CASTER_SLOT_COUNT = 4
const STAFF_SLOT_COUNT = 8
const DEFAULT_STAFF_SLOT_COUNT = 4

const DEFAULT_INTERVIEW_SETTINGS = {
  visible: false,
  speakerMode: 'PLAYER',
  teamSide: 'A',
  playerSlot: '',
  title: 'POST-MATCH INTERVIEW',
  subtitle: 'VOICE INTERVIEW',
  status: 'VOICE CONNECTED',
  manualTeamName: '',
  manualSpeakerName: '',
  manualSpeakerRole: ''
}

const DEFAULT_DESK_NOTE_SETTINGS = {
  visible: false,
  note: 'MATCH DESK STANDBY'
}

const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const clean = value => String(value || '').trim()

const getTeamSideOptions = casterText => [
  { value: 'A', label: casterText.teamA },
  { value: 'B', label: casterText.teamB }
]

const getInterviewModeOptions = casterText => [
  { value: 'PLAYER', label: casterText.speakerPlayer },
  { value: 'REPRESENTATIVE', label: casterText.speakerRep },
  { value: 'TEAM', label: casterText.speakerTeam }
]

const getLowerThirdModeOptions = casterText => [
  { value: 'context', label: casterText.contextMode },
  { value: 'interview', label: casterText.interviewMode },
  { value: 'deskNote', label: casterText.deskNoteMode },
  { value: '', label: casterText.offMode }
]

const createPersonSlot = (index, mode = 'CASTERS', casterText = null) => ({
  id: `${mode === 'STAFF' ? 'staff' : 'caster'}-${index + 1}`,
  name: mode === 'STAFF' ? (casterText?.staffDefaultName?.(index) || `Staff ${index + 1}`) : (casterText?.casterDefaultName?.(index) || `Caster ${index + 1}`),
  title: mode === 'STAFF' ? (casterText?.defaultStaffTitle || 'Production') : (casterText?.defaultCasterTitle || 'Commentator'),
  social: '',
  avatar: '',
  description: ''
})

function ToggleButton({ label, active, onClick, disabled = false, copy }) {
  return (
    <button
      type="button"
      className={[
        styles.casterToggleButton,
        active ? styles.casterToggleButtonActive : ''
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={() => onClick(!active)}
    >
      <span>{label}</span>
      <strong>{active ? copy.on : copy.off}</strong>
    </button>
  )
}

const getCurrentMapEntry = match => {
  const index = Math.max(0, Number(match?.currentMapIndex || 1) - 1)
  return Array.isArray(match?.mapLineup) ? match.mapLineup[index] || null : null
}

const getMapName = match => {
  const entry = getCurrentMapEntry(match)
  const map = OW_MAP_BY_ID[entry?.mapId || entry?.id || match?.currentMapId]
  return clean(entry?.name) || map?.en || clean(match?.currentMapId) || 'TBD'
}

const getBanCount = match => {
  const entry = getCurrentMapEntry(match)
  const bansA = normalizeBanList(entry?.bansA?.length ? entry.bansA : match?.bansA)
  const bansB = normalizeBanList(entry?.bansB?.length ? entry.bansB : match?.bansB)
  return bansA.length + bansB.length
}

function CastersEditor({ project, text, language, activeSection = 'casters', onUpdateProject }) {
  const casterText = getCasterEditorCopy(language)
  const settings = getSceneSettings(project, 'casters')
  const packageMode = activeSection === 'staff'
    ? 'STAFF'
    : 'CASTERS'
  const isStaffMode = packageMode === 'STAFF'
  const teamSideOptions = getTeamSideOptions(casterText)
  const interviewModeOptions = getInterviewModeOptions(casterText)
  const lowerThirdModeOptions = getLowerThirdModeOptions(casterText)
  const staffSlotCapacity = Number(settings.staffSlotCapacity) === STAFF_SLOT_COUNT ? STAFF_SLOT_COUNT : DEFAULT_STAFF_SLOT_COUNT
  const slotCount = isStaffMode
    ? staffSlotCapacity
    : CASTER_SLOT_COUNT
  const visibleSlotLimit = isStaffMode ? staffSlotCapacity : CASTER_SLOT_COUNT
  const people = isStaffMode ? project.staff || [] : project.casters || []
  const selectedPersonIdsRaw = isStaffMode
    ? (Array.isArray(settings.staffIds) ? settings.staffIds : [])
    : (Array.isArray(project.currentMatch.casters) ? project.currentMatch.casters : [])
  const selectedPersonIds = selectedPersonIdsRaw.slice(0, visibleSlotLimit)
  const activePersonCount = new Set(selectedPersonIds.filter(Boolean)).size
  const personCopy = {
    panelTitle: isStaffMode ? casterText.staffSlots : casterText.casterPool,
    slotPrefix: isStaffMode ? 'S' : 'C',
    name: isStaffMode ? casterText.staffName : casterText.casterName,
    title: isStaffMode ? casterText.staffRole : casterText.casterTitle,
    note: casterText.casterSocial,
    image: isStaffMode ? casterText.staffImage : casterText.casterAvatar
  }
  const { teamA, teamB } = getCurrentTeams(project)
  const match = project.currentMatch || {}
  const currentMapName = getMapName(match)
  const scoreLabel = `${match.score?.teamA ?? 0}:${match.score?.teamB ?? 0}`
  const banCount = getBanCount(match)
  const interview = { ...DEFAULT_INTERVIEW_SETTINGS, ...(settings.interview || {}) }
  const deskNote = { ...DEFAULT_DESK_NOTE_SETTINGS, ...(settings.deskNote || {}) }
  const lowerThirdMode = interview.visible === true
    ? 'interview'
    : deskNote.visible === true
      ? 'deskNote'
      : settings.showContext !== false
        ? 'context'
        : ''
  const interviewTeamSide = interview.teamSide === 'B' ? 'B' : 'A'
  const interviewTeam = interviewTeamSide === 'B' ? teamB : teamA
  const interviewPlayers = getStartingPlayers(project, interviewTeamSide === 'B' ? 'teamB' : 'teamA')
  const selectedPlayerSlot = interview.playerSlot === 0 || interview.playerSlot ? Number(interview.playerSlot) : ''
  const selectedInterviewPlayer = Number.isFinite(selectedPlayerSlot) ? interviewPlayers[selectedPlayerSlot] : null
  const avatarInputRef = useRef(null)
  const pendingAvatarSlotRef = useRef(null)

  const updateCasterSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'casters'), patch)
    })
  }

  const updateInterview = patch => {
    onUpdateProject(draft => {
      const casterSettings = ensureSceneSettings(draft, 'casters')
      casterSettings.interview = {
        ...DEFAULT_INTERVIEW_SETTINGS,
        ...(casterSettings.interview || {}),
        ...patch
      }
    })
  }

  const updateDeskNote = patch => {
    onUpdateProject(draft => {
      const casterSettings = ensureSceneSettings(draft, 'casters')
      casterSettings.deskNote = {
        ...DEFAULT_DESK_NOTE_SETTINGS,
        ...(casterSettings.deskNote || {}),
        ...patch
      }
    })
  }

  const setLowerThirdMode = mode => {
    onUpdateProject(draft => {
      const casterSettings = ensureSceneSettings(draft, 'casters')
      casterSettings.showContext = mode === 'context'
      casterSettings.interview = {
        ...DEFAULT_INTERVIEW_SETTINGS,
        ...(casterSettings.interview || {}),
        visible: mode === 'interview'
      }
      casterSettings.deskNote = {
        ...DEFAULT_DESK_NOTE_SETTINGS,
        ...(casterSettings.deskNote || {}),
        visible: mode === 'deskNote'
      }
    })
  }

  const updateStaffCapacity = value => {
    const nextCapacity = Number(value) === STAFF_SLOT_COUNT ? STAFF_SLOT_COUNT : DEFAULT_STAFF_SLOT_COUNT

    onUpdateProject(draft => {
      const casterSettings = ensureSceneSettings(draft, 'casters')
      casterSettings.staffSlotCapacity = nextCapacity
      casterSettings.staffIds = (Array.isArray(casterSettings.staffIds) ? casterSettings.staffIds : []).slice(0, nextCapacity)
    })
  }

  const toggleStaffCapacity = () => {
    updateStaffCapacity(staffSlotCapacity === STAFF_SLOT_COUNT ? DEFAULT_STAFF_SLOT_COUNT : STAFF_SLOT_COUNT)
  }

  const changeInterviewTeam = side => {
    updateInterview({ teamSide: side, playerSlot: '', manualTeamName: '' })
  }

  const previewTeamName = clean(interview.manualTeamName) || interviewTeam?.shortName || interviewTeam?.name || casterText.teamFallback(interviewTeamSide)
  const previewSpeakerName =
    clean(interview.manualSpeakerName) ||
    (interview.speakerMode === 'TEAM'
      ? casterText.teamSpeaker(previewTeamName)
      : interview.speakerMode === 'REPRESENTATIVE'
        ? casterText.repSpeaker(previewTeamName)
        : selectedInterviewPlayer?.name || casterText.playerFallback)
  const previewSpeakerRole =
    clean(interview.manualSpeakerRole) ||
    (interview.speakerMode === 'TEAM'
      ? casterText.teamStatement
      : interview.speakerMode === 'REPRESENTATIVE'
        ? casterText.teamRepresentative
        : selectedInterviewPlayer?.role || casterText.playerFallback)
  const lowerThirdLabel = lowerThirdModeOptions.find(option => option.value === lowerThirdMode)?.label || casterText.offMode

  const updatePersonSlot = (slotIndex, patch) => {
    onUpdateProject(draft => {
      const targetKey = isStaffMode ? 'staff' : 'casters'
      if (!Array.isArray(draft[targetKey])) draft[targetKey] = []

      while (draft[targetKey].length <= slotIndex) {
        draft[targetKey].push(createPersonSlot(draft[targetKey].length, packageMode, casterText))
      }

      Object.assign(draft[targetKey][slotIndex], patch)
    })
  }

  const isPersonVisible = personId => selectedPersonIds.includes(personId)

  const togglePersonVisible = (slotIndex, personId, enabled) => {
    onUpdateProject(draft => {
      const targetKey = isStaffMode ? 'staff' : 'casters'
      if (!Array.isArray(draft[targetKey])) draft[targetKey] = []

      while (draft[targetKey].length <= slotIndex) {
        draft[targetKey].push(createPersonSlot(draft[targetKey].length, packageMode, casterText))
      }

      const casterSettings = ensureSceneSettings(draft, 'casters')
      const currentIds = isStaffMode
        ? (casterSettings.staffIds || [])
        : (draft.currentMatch.casters || [])
      const visibleIds = new Set(currentIds.filter(Boolean))

      if (enabled) visibleIds.add(personId)
      else visibleIds.delete(personId)

      const updatedIds = draft[targetKey]
        .slice(0, visibleSlotLimit)
        .filter(person => visibleIds.has(person.id))
        .map(person => person.id)

      if (isStaffMode) {
        casterSettings.staffIds = updatedIds
      } else {
        draft.currentMatch.casters = updatedIds
      }
    })
  }

  const selectCasterAvatar = slotIndex => {
    pendingAvatarSlotRef.current = slotIndex
    avatarInputRef.current?.click()
  }

  const handleCasterAvatarFile = async event => {
    const file = event.target.files?.[0]
    const slotIndex = pendingAvatarSlotRef.current

    if (!file || slotIndex === null) return

    try {
      if (!file.type.startsWith('image/')) return
      const avatar = await fileToDataUrl(file)
      updatePersonSlot(slotIndex, { avatar })
    } finally {
      pendingAvatarSlotRef.current = null
      event.target.value = ''
    }
  }

  const renderCasterToolsPanel = () => (
    <Panel title={casterText.lowerThirdControl} className={`${styles.casterToolPanel} ${styles.casterInlineToolsPanel}`}>
      <div className={styles.casterLowerThirdDeck}>
        <div className={styles.casterLowerThirdBus}>
          <div className={styles.casterConsoleKicker}>
            <span>{casterText.modeBus}</span>
            <strong>{lowerThirdLabel}</strong>
          </div>
          <SegmentedControl
            value={lowerThirdMode}
            options={lowerThirdModeOptions}
            onChange={setLowerThirdMode}
          />
          <div className={styles.casterLowerThirdStatusRail}>
            <div>
              <span>{casterText.state}</span>
              <strong>{lowerThirdMode ? casterText.active : casterText.offMode}</strong>
            </div>
            <div>
              <span>{casterText.source}</span>
              <strong>{lowerThirdMode === 'context' ? casterText.match : lowerThirdMode ? casterText.manual : casterText.none}</strong>
            </div>
          </div>
        </div>

        {lowerThirdMode === 'context' && (
          <div className={`${styles.casterLowerThirdWorkspace} ${styles.casterLowerThirdWorkspaceContext}`}>
            <div className={styles.casterLowerThirdBay}>
              <div className={styles.casterConsoleKicker}>
                <span>{casterText.contextSource}</span>
                <strong>{casterText.preview}</strong>
              </div>
              <div className={styles.casterInlineContextGrid}>
                <div>
                  <span>{casterText.teams}</span>
                  <strong>{teamA?.shortName || 'TMA'} / {teamB?.shortName || 'TMB'}</strong>
                </div>
                <div>
                  <span>{casterText.score}</span>
                  <strong>{scoreLabel}</strong>
                </div>
                <div>
                  <span>{casterText.map}</span>
                  <strong>{currentMapName}</strong>
                </div>
                <div>
                  <span>{casterText.ban}</span>
                  <strong>{banCount ? casterText.bans(banCount) : casterText.none}</strong>
                </div>
              </div>
            </div>

            <div className={`${styles.casterLowerThirdBay} ${styles.casterLowerThirdPayloadBay}`}>
              <div className={styles.casterConsoleKicker}>
                <span>{casterText.payload}</span>
                <strong>{casterText.active}</strong>
              </div>
              <div className={styles.casterPayloadReadout}>
                <span>{casterText.contextLine}</span>
                <strong>{teamA?.shortName || 'TMA'} vs {teamB?.shortName || 'TMB'} / {currentMapName}</strong>
              </div>
            </div>
          </div>
        )}

        {lowerThirdMode === 'interview' && (
          <div className={`${styles.casterLowerThirdWorkspace} ${styles.casterLowerThirdWorkspaceFull}`}>
            <div className={`${styles.casterLowerThirdBay} ${styles.casterLowerThirdPayloadBay} ${styles.casterInterviewBuilderBay}`}>
            <div className={styles.casterConsoleKicker}>
              <span>{casterText.interviewBuilder}</span>
              <strong>{casterText.active}</strong>
            </div>
            <div className={styles.casterLowerThirdInterviewGrid}>
              <div className={styles.casterInterviewControl}>
                <span>{casterText.speakerMode}</span>
                <SegmentedControl
                  value={interview.speakerMode || 'PLAYER'}
                  options={interviewModeOptions}
                  onChange={value => updateInterview({ speakerMode: value })}
                />
              </div>

              <div className={styles.casterInterviewControl}>
                <span>{casterText.interviewTeam}</span>
                <SegmentedControl
                  value={interviewTeamSide}
                  options={teamSideOptions}
                  onChange={changeInterviewTeam}
                />
              </div>

              <Field label={casterText.target}>
                <select
                  value={selectedPlayerSlot === '' ? '' : String(selectedPlayerSlot)}
                  disabled={interview.speakerMode !== 'PLAYER'}
                  onChange={event => updateInterview({ playerSlot: event.target.value === '' ? '' : Number(event.target.value) })}
                >
                  <option value="">{casterText.autoManual}</option>
                  {interviewPlayers.map((player, index) => (
                    <option key={player.id || index} value={String(index)}>
                      {`P${index + 1} / ${player.name || casterText.playerFallback} / ${player.role || casterText.roleFallback}`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={casterText.title}>
                <input
                  value={interview.title || ''}
                  onChange={event => updateInterview({ title: event.target.value })}
                  placeholder="POST-MATCH INTERVIEW"
                />
              </Field>
              <Field label={casterText.speakerName}>
                <input
                  value={interview.manualSpeakerName || ''}
                  onChange={event => updateInterview({ manualSpeakerName: event.target.value })}
                  placeholder={previewSpeakerName}
                />
              </Field>
              <Field label={casterText.speakerRole}>
                <input
                  value={interview.manualSpeakerRole || ''}
                  onChange={event => updateInterview({ manualSpeakerRole: event.target.value })}
                  placeholder={previewSpeakerRole}
                />
              </Field>
            </div>
            </div>
          </div>
        )}

        {lowerThirdMode === 'deskNote' && (
          <div className={`${styles.casterLowerThirdWorkspace} ${styles.casterLowerThirdWorkspaceFull}`}>
            <div className={`${styles.casterLowerThirdBay} ${styles.casterLowerThirdPayloadBay} ${styles.casterDeskNoteBuilderBay}`}>
            <div className={styles.casterConsoleKicker}>
              <span>{casterText.deskNote}</span>
              <strong>{casterText.active}</strong>
            </div>
              <div className={`${styles.casterPayloadReadout} ${styles.casterPayloadInputReadout} ${styles.casterPayloadInputOnly}`}>
                <input
                  value={deskNote.note || ''}
                  onChange={event => updateDeskNote({ note: event.target.value })}
                  placeholder="MATCH DESK STANDBY"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )

  return (
    <div className={styles.casterDesk}>
      <div className={styles.casterPeopleGrid}>
        <div className={styles.casterControlColumn}>
          <Panel title={isStaffMode ? casterText.staffPackage : casterText.sceneCopy} className={styles.casterPackagePanel}>
            <div className={styles.casterCopyGrid}>
              <Field label={text.title}>
                <input
                  value={settings.title || ''}
                  onChange={event => onUpdateProject(draft => {
                    ensureSceneSettings(draft, 'casters').title = event.target.value
                  })}
                />
              </Field>

              <Field label={text.subtitle}>
                <input
                  value={settings.subtitle || ''}
                  onChange={event => onUpdateProject(draft => {
                    ensureSceneSettings(draft, 'casters').subtitle = event.target.value
                  })}
                />
              </Field>
            </div>

            {isStaffMode && (
              <div className={styles.casterPackageModeRow}>
                <button
                  type="button"
                  className={styles.staffCapacityButton}
                  onClick={toggleStaffCapacity}
                >
                  <span>{casterText.staffSlots}</span>
                  <strong>{staffSlotCapacity}</strong>
                </button>
              </div>
            )}

            <div className={styles.casterElementRows}>
              <ToggleButton
                label={casterText.eventLogo}
                active={settings.showEventLogo !== false}
                onClick={checked => updateCasterSettings({ showEventLogo: checked })}
                copy={casterText}
              />
              <ToggleButton
                label={casterText.portraits}
                active={settings.showPortraits !== false}
                onClick={checked => updateCasterSettings({ showPortraits: checked })}
                copy={casterText}
              />
              <ToggleButton
                label={casterText.titles}
                active={settings.showTitles !== false}
                onClick={checked => updateCasterSettings({ showTitles: checked })}
                copy={casterText}
              />
              <ToggleButton
                label={casterText.casterSocial}
                active={settings.showSocial !== false}
                onClick={checked => updateCasterSettings({ showSocial: checked })}
                copy={casterText}
              />
              <ToggleButton
                label={casterText.slotNumbers}
                active={settings.showNumbers !== false}
                onClick={checked => updateCasterSettings({ showNumbers: checked })}
                copy={casterText}
              />
            </div>
          </Panel>
        </div>

          <Panel title={personCopy.panelTitle} className={`${styles.casterLibraryPanel} ${styles.casterLibraryPanelFull}`}>
            <div className={`${styles.casterStatusStrip} ${isStaffMode ? styles.casterStatusStripStaff : ''}`}>
              <div>
                <span>{casterText.visibleUpper}</span>
                <strong>{activePersonCount}/{visibleSlotLimit}</strong>
              </div>
              <div>
                <span>{casterText.slots}</span>
                <strong>{slotCount}</strong>
              </div>
              <div>
                <span>{casterText.packageLabel}</span>
                <strong>{packageMode}</strong>
              </div>
              {isStaffMode && (
                <div>
                  <span>{casterText.capacity}</span>
                  <strong>{staffSlotCapacity}</strong>
                </div>
              )}
              <div>
                <span>{casterText.scene}</span>
                <strong>{settings.title || (isStaffMode ? casterText.staffSceneFallback : casterText.castersSceneFallback)}</strong>
              </div>
            </div>

            <div className={styles.casterLibraryHeader}>
              <span>{casterText.slot}</span>
              <span>{personCopy.name}</span>
              <span>{personCopy.title}</span>
              <span>{personCopy.note}</span>
              <span>{personCopy.image}</span>
              <span>{casterText.visible}</span>
            </div>

            <div className={styles.casterLibrary}>
              {Array.from({ length: slotCount }, (_, index) => people[index] || createPersonSlot(index, packageMode, casterText)).map((person, index) => {
                const visible = isPersonVisible(person.id)
                const canToggleOn = visible || activePersonCount < visibleSlotLimit

                return (
                  <div
                    className={[
                      styles.casterRow,
                      visible ? styles.casterRowActive : styles.casterRowHidden
                    ].filter(Boolean).join(' ')}
                    key={person.id}
                  >
                    <div className={styles.casterIndex}>
                      <strong>{personCopy.slotPrefix}{index + 1}</strong>
                      <span>{casterText.slot}</span>
                    </div>
                    <Field label={personCopy.name}>
                      <input value={person.name || ''} onChange={event => updatePersonSlot(index, { name: event.target.value })} />
                    </Field>
                    <Field label={personCopy.title}>
                      <input value={person.title || ''} onChange={event => updatePersonSlot(index, { title: event.target.value })} />
                    </Field>
                    <Field label={personCopy.note}>
                      <input
                        value={person.social || person.description || ''}
                        onChange={event => updatePersonSlot(index, { social: event.target.value, description: event.target.value })}
                      />
                    </Field>
                    <div className={styles.casterAvatarControl}>
                      <div className={styles.casterThumb}>
                        {person.avatar ? <img src={person.avatar} alt="" /> : <span>{person.name?.[0] || personCopy.slotPrefix}</span>}
                      </div>
                      <input value={person.avatar || ''} onChange={event => updatePersonSlot(index, { avatar: event.target.value })} />
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => selectCasterAvatar(index)}
                      >
                        {casterText.load}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => updatePersonSlot(index, { avatar: '' })}
                        disabled={!person.avatar}
                      >
                        {casterText.clear}
                      </button>
                    </div>
                    <button
                      type="button"
                      className={visible ? styles.primaryButton : styles.secondaryButton}
                      disabled={!canToggleOn}
                      aria-pressed={visible}
                      onClick={() => togglePersonVisible(index, person.id, !visible)}
                    >
                      {visible ? casterText.on : casterText.off}
                    </button>
                  </div>
                )
              })}
            </div>
          </Panel>
      </div>
      {!isStaffMode && renderCasterToolsPanel()}

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleCasterAvatarFile}
      />
    </div>
  )
}


export default CastersEditor
