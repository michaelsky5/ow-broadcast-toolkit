import { useState } from 'react'
import {
  OW_GAME_MODE_OPTIONS,
  OW_MAP_BY_ID,
  OW_MAPS_BY_MODE
} from '../../../data/overwatch'
import { FT_OPTIONS } from '../../../match/defaultMatch'
import styles from '../shared/SceneEditor.styles.js'
import { getMapEditorCopy } from '../shared/editorCopy'
import { Field, Panel, SegmentedControl, Stepper, ToggleField } from '../shared/editorControls'
import {
  BAN_ROLE_OPTIONS,
  DEFAULT_BAN_ENTRY,
  buildBanEntry,
  ensureMapLineup,
  ensureSceneSettings,
  getHeroLabel,
  getHeroOptionsByRole,
  getMapLabel,
  getMapLineupEntry,
  getModeLabel,
  getPlayerRoleLabel,
  getSceneSettings,
  getSeriesMapTotal,
  getTeamSideOptions,
  normalizeBanList,
  parseBanEntry,
  setCurrentMapIndex,
  updateMapLineupEntry
} from '../shared/editorHelpers'

const getWinnerSide = map => String(map?.winnerSide || map?.winner || '').trim().toUpperCase()

const recalculateScoreFromLineup = draft => {
  const lineup = ensureMapLineup(draft)
  draft.currentMatch.score.teamA = lineup.filter(map => getWinnerSide(map) === 'A').length
  draft.currentMatch.score.teamB = lineup.filter(map => getWinnerSide(map) === 'B').length
}

const getDefaultMapPoolForMode = modeId => (OW_MAPS_BY_MODE[modeId] || []).map(map => map.id)

const getConfiguredMapsForMode = (settings, modeId) => {
  const mapsForMode = OW_MAPS_BY_MODE[modeId] || []
  const storedPool = settings.eventMapPool?.[modeId]
  const mapIds = Array.isArray(storedPool) && storedPool.length
    ? storedPool
    : mapsForMode.map(map => map.id)

  return mapIds
    .map(mapId => OW_MAP_BY_ID[mapId])
    .filter(Boolean)
}

const getMapEntryFromOption = map => ({
  mapId: map?.id || '',
  type: map?.mode || 'control',
  name: map?.en || '',
  image: map?.image || '',
  picker: '',
  winner: '',
  winnerSide: '',
  attackSide: '',
  bansA: [],
  bansB: [],
  banOrderMode: 'A_FIRST'
})

function CurrentMapEditor({ project, copy, text, language, activeSection = 'pool', onUpdateProject }) {
  const [expandedBanIndex, setExpandedBanIndex] = useState(null)
  const editorTab = activeSection === 'pool' ? 'pool' : 'flow'
  const settings = getSceneSettings(project, 'current-map')
  const mapText = getMapEditorCopy(language)
  const totalMaps = getSeriesMapTotal(project.currentMatch.ft, project.currentMatch.mapLineup)
  const currentIndex = Math.max(1, Math.min(totalMaps, Number(project.currentMatch.currentMapIndex) || 1))
  const teamOptions = getTeamSideOptions(project, text)
  const winnerOptions = [...teamOptions, { value: 'DRAW', label: mapText.draw }]
  const metaMode = settings.mapMetaDisplayMode || 'RESULT'
  const banDisplayMode = settings.mapBanDisplayMode || 'HIDE'
  const scoreReadout = `${project.currentMatch.score.teamA} : ${project.currentMatch.score.teamB}`
  const enabledModeOptions = OW_GAME_MODE_OPTIONS.filter(mode => settings.enabledMapTypes?.[mode.value] !== false)
  const flowModeOptions = enabledModeOptions.length ? enabledModeOptions : OW_GAME_MODE_OPTIONS
  const poolModeSummaries = OW_GAME_MODE_OPTIONS.map(mode => {
    const mapsForMode = OW_MAPS_BY_MODE[mode.value] || []
    const storedPool = settings.eventMapPool?.[mode.value]
    const selectedPool = Array.isArray(storedPool) && storedPool.length
      ? storedPool
      : mapsForMode.map(map => map.id)
    const enabled = settings.enabledMapTypes?.[mode.value] !== false

    return {
      enabled,
      label: getModeLabel(mode, language),
      mapCount: selectedPool.length,
      modeId: mode.value
    }
  })
  const enabledPoolMapCount = poolModeSummaries.reduce((total, summary) => (
    summary.enabled ? total + summary.mapCount : total
  ), 0)
  const totalPoolMapCount = poolModeSummaries.reduce((total, summary) => total + summary.mapCount, 0)

  const updateMapEntry = (index, patch, options = {}) => {
    onUpdateProject(draft => {
      updateMapLineupEntry(draft, index, patch)

      if (index + 1 === Number(draft.currentMatch.currentMapIndex || 1)) {
        const nextEntry = getMapLineupEntry(draft.currentMatch, index)
        if (nextEntry.mapId) draft.currentMatch.currentMapId = nextEntry.mapId
      }

      if (options.recalculateScore) recalculateScoreFromLineup(draft)
    })
  }

  const updateMapBanEntry = (index, side, patch) => {
    const entry = getMapLineupEntry(project.currentMatch, index)
    const key = side === 'B' ? 'bansB' : 'bansA'
    const parsed = parseBanEntry(entry[key]?.[0] || DEFAULT_BAN_ENTRY)
    const next = {
      ...parsed,
      ...patch
    }

    updateMapEntry(index, { [key]: [buildBanEntry(next.role, next.hero)] })
  }

  const applyLiveBansToMap = index => {
    updateMapEntry(index, {
      bansA: normalizeBanList(project.currentMatch.bansA),
      bansB: normalizeBanList(project.currentMatch.bansB),
      banOrderMode: project.currentMatch.banOrderMode || 'A_FIRST'
    })
  }

  const clearMapBans = index => {
    updateMapEntry(index, {
      bansA: [],
      bansB: [],
      banOrderMode: 'A_FIRST'
    })
  }

  const updateMapPool = (modeId, nextMapIds) => {
    onUpdateProject(draft => {
      const currentMapSettings = ensureSceneSettings(draft, 'current-map')
      currentMapSettings.eventMapPool = {
        ...(currentMapSettings.eventMapPool || {}),
        [modeId]: nextMapIds
      }
    })
  }

  const resetMapPoolMode = modeId => {
    onUpdateProject(draft => {
      const currentMapSettings = ensureSceneSettings(draft, 'current-map')
      currentMapSettings.eventMapPool = {
        ...(currentMapSettings.eventMapPool || {}),
        [modeId]: getDefaultMapPoolForMode(modeId)
      }
      currentMapSettings.enabledMapTypes = {
        ...(currentMapSettings.enabledMapTypes || {}),
        [modeId]: true
      }
    })
  }

  const resetEventMapPool = () => {
    onUpdateProject(draft => {
      const currentMapSettings = ensureSceneSettings(draft, 'current-map')
      currentMapSettings.eventMapPool = Object.fromEntries(
        OW_GAME_MODE_OPTIONS.map(mode => [mode.value, getDefaultMapPoolForMode(mode.value)])
      )
      currentMapSettings.enabledMapTypes = Object.fromEntries(
        OW_GAME_MODE_OPTIONS.map(mode => [mode.value, true])
      )
    })
  }

  const toggleMapPoolMode = (modeId, enabled) => {
    onUpdateProject(draft => {
      const currentMapSettings = ensureSceneSettings(draft, 'current-map')
      currentMapSettings.enabledMapTypes = {
        ...(currentMapSettings.enabledMapTypes || {}),
        [modeId]: enabled
      }
    })
  }

  return (
    <div className={styles.mapSetupDesk}>
      <div className={styles.mapSetupWorkspace}>
        <div className={styles.mapSetupRail}>
          <Panel title={mapText.matchControl} className={styles.mapControlPanel}>
            <div className={styles.mapSetupStatusStrip}>
              <div>
                <span>{mapText.format}</span>
                <strong>FT{project.currentMatch.ft}</strong>
              </div>
              <div>
                <span>{mapText.current}</span>
                <strong>{mapText.mapNumber(currentIndex)}</strong>
              </div>
              <div>
                <span>{mapText.score}</span>
                <strong>{scoreReadout}</strong>
              </div>
              <div>
                <span>{mapText.total}</span>
                <strong>{totalMaps}</strong>
              </div>
            </div>

            <div className={styles.mapCurrentGrid}>
              <div className={styles.twoCol}>
                <Field label={copy.ft}>
                  <select
                    value={project.currentMatch.ft}
                    onChange={event => onUpdateProject(draft => {
                      const nextFt = Number(event.target.value)
                      draft.currentMatch.ft = nextFt
                      const nextIndex = Math.min(
                        Number(draft.currentMatch.currentMapIndex) || 1,
                        getSeriesMapTotal(nextFt, draft.currentMatch.mapLineup)
                      )
                      setCurrentMapIndex(draft, nextIndex)
                      recalculateScoreFromLineup(draft)
                    })}
                  >
                    {FT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label={text.currentMapIndex}>
                  <Stepper
                    value={currentIndex}
                    min={1}
                    max={totalMaps}
                    onChange={value => onUpdateProject(draft => {
                      setCurrentMapIndex(draft, value)
                    })}
                  />
                </Field>
              </div>

            </div>

            {editorTab === 'pool' && (
              <div className={styles.mapControlSection}>
                <div className={styles.mapControlReadout}>
                  <span>{mapText.officialPoolMatrix}</span>
                  <strong>{mapText.typeCount(enabledModeOptions.length, OW_GAME_MODE_OPTIONS.length)}</strong>
                </div>
                <div className={styles.mapPoolSummaryGrid}>
                  <div>
                    <span>{mapText.activeMaps}</span>
                    <strong>{enabledPoolMapCount}/{totalPoolMapCount}</strong>
                  </div>
                  <div>
                    <span>{mapText.typeStatus}</span>
                    <strong>{mapText.enabledTypes(enabledModeOptions.length)}</strong>
                  </div>
                </div>
                <div className={styles.mapPoolTypeMatrix}>
                  {poolModeSummaries.map(summary => (
                    <button
                      type="button"
                      className={summary.enabled ? styles.mapPoolTypeOn : styles.mapPoolTypeOff}
                      key={summary.modeId}
                      onClick={() => toggleMapPoolMode(summary.modeId, !summary.enabled)}
                    >
                      <span>{summary.label}</span>
                      <strong>{summary.mapCount}</strong>
                      <em>{summary.enabled ? mapText.on : mapText.off}</em>
                    </button>
                  ))}
                </div>
                <ToggleField
                  label={text.showCurrent}
                  checked={Boolean(settings.showOverviewCurrent)}
                  onChange={checked => onUpdateProject(draft => {
                    ensureSceneSettings(draft, 'current-map').showOverviewCurrent = checked
                  })}
                />
                <button type="button" onClick={resetEventMapPool}>{mapText.resetPool}</button>
              </div>
            )}

            {editorTab === 'flow' && (
              <div className={styles.mapControlSection}>
                <Field label={text.metaMode}>
                  <SegmentedControl
                    value={metaMode}
                    options={[
                      { value: 'CLEAN', label: text.clean },
                      { value: 'RESULT', label: text.result },
                      { value: 'FULL', label: text.full }
                    ]}
                    onChange={value => onUpdateProject(draft => {
                      ensureSceneSettings(draft, 'current-map').mapMetaDisplayMode = value
                    })}
                  />
                </Field>

                <Field label={text.banMode}>
                  <SegmentedControl
                    value={banDisplayMode}
                    options={[
                      { value: 'SHOW', label: text.show },
                      { value: 'HIDE', label: text.hide }
                    ]}
                    onChange={value => onUpdateProject(draft => {
                      ensureSceneSettings(draft, 'current-map').mapBanDisplayMode = value
                    })}
                  />
                </Field>
              </div>
            )}
          </Panel>

        </div>

        <div className={styles.mapSetupStage}>
          {editorTab === 'pool' && (
            <Panel title={text.mapPool} className={styles.mapPoolPanel}>
              <div className={styles.mapPoolModeGrid}>
                {OW_GAME_MODE_OPTIONS.map(mode => {
                  const mapsForMode = OW_MAPS_BY_MODE[mode.value] || []
                  const storedPool = settings.eventMapPool?.[mode.value]
                  const selectedPool = Array.isArray(storedPool) && storedPool.length
                    ? storedPool
                    : mapsForMode.map(map => map.id)
                  const enabled = settings.enabledMapTypes?.[mode.value] !== false
                  const modeLabel = getModeLabel(mode, language)

                  return (
                    <div
                      className={[
                        styles.mapPoolModeCard,
                        enabled ? '' : styles.mapPoolModeDisabled
                      ].filter(Boolean).join(' ')}
                      key={mode.value}
                    >
                      <div className={styles.mapPoolModeHeader}>
                        <strong>{modeLabel}</strong>
                        <span>{mapText.mapCount(selectedPool.length)}</span>
                        <label>
                          <span>{enabled ? mapText.on : mapText.off}</span>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={event => toggleMapPoolMode(mode.value, event.target.checked)}
                          />
                        </label>
                      </div>

                      <div className={styles.mapPoolSlots}>
                        {selectedPool.map((mapId, slotIndex) => (
                          <div className={styles.mapPoolSlot} key={`${mode.value}-${slotIndex}`}>
                            <span>{slotIndex + 1}</span>
                            <select
                              value={mapId}
                              onChange={event => {
                                const next = [...selectedPool]
                                next[slotIndex] = event.target.value
                                updateMapPool(mode.value, next)
                              }}
                            >
                              {mapsForMode.map(map => (
                                <option key={map.id} value={map.id}>{getMapLabel(map, language)}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={styles.dangerButton}
                              disabled={selectedPool.length <= 1}
                              onClick={() => updateMapPool(mode.value, selectedPool.filter((_, index) => index !== slotIndex))}
                            >
                              {mapText.delete}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className={styles.mapPoolActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => updateMapPool(mode.value, [...selectedPool, mapsForMode[0]?.id].filter(Boolean))}
                        >
                          {mapText.addMap}
                        </button>
                        <button type="button" onClick={() => resetMapPoolMode(mode.value)}>{mapText.reset}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {editorTab === 'flow' && (
            <Panel title={text.mapFlow} className={styles.mapFlowPanel}>
              <div className={styles.mapFlowHeader}>
                <span>{mapText.map}</span>
                <span>{mapText.mode}</span>
                <span>{mapText.name}</span>
                <span>{mapText.pick}</span>
                <span>{mapText.winner}</span>
                <span>{mapText.ban}</span>
              </div>
              <div className={styles.mapLineup}>
                {Array.from({ length: totalMaps }).map((_, index) => {
                  const entry = getMapLineupEntry(project.currentMatch, index)
                  const selectedMap = OW_MAP_BY_ID[entry.mapId] || null
                  const mapMode = entry.type || selectedMap?.mode || 'control'
                  const mapsForMode = getConfiguredMapsForMode(settings, mapMode)
                  const selectedMapInPool = mapsForMode.some(map => map.id === selectedMap?.id)
                  const rowModeOptions = flowModeOptions.some(mode => mode.value === mapMode)
                    ? flowModeOptions
                    : [
                        OW_GAME_MODE_OPTIONS.find(mode => mode.value === mapMode),
                        ...flowModeOptions
                      ].filter(Boolean)
                  const isCurrent = currentIndex === index + 1
                  const rowWinner = getWinnerSide(entry)
                  const rowBanCount = normalizeBanList(entry.bansA).length + normalizeBanList(entry.bansB).length

                  const parsedBanA = parseBanEntry(entry.bansA?.[0] || DEFAULT_BAN_ENTRY)
                  const parsedBanB = parseBanEntry(entry.bansB?.[0] || DEFAULT_BAN_ENTRY)
                  const isBanExpanded = expandedBanIndex === index

                  return (
                    <div
                      className={[
                        styles.mapRow,
                        isCurrent ? styles.currentMapRow : '',
                        rowWinner ? styles.mapRowSettled : ''
                      ].filter(Boolean).join(' ')}
                      key={`map-${index}`}
                    >
                      <div className={styles.mapMainRow}>
                        <button
                          type="button"
                          className={isCurrent ? styles.mapIndexButton : ''}
                          onClick={() => onUpdateProject(draft => setCurrentMapIndex(draft, index + 1))}
                        >
                          {isCurrent ? mapText.live : mapText.mapNumber(index + 1)}
                        </button>

                        <select
                          value={mapMode}
                          onChange={event => {
                            const nextMode = event.target.value
                            const firstMap = getConfiguredMapsForMode(settings, nextMode)[0] || OW_MAPS_BY_MODE[nextMode]?.[0]
                            updateMapEntry(index, getMapEntryFromOption(firstMap), { recalculateScore: true })
                          }}
                        >
                          {rowModeOptions.map(mode => (
                            <option key={mode.value} value={mode.value}>{getModeLabel(mode, language)}</option>
                          ))}
                        </select>

                        <select
                          value={selectedMapInPool ? selectedMap.id : ''}
                          onChange={event => updateMapEntry(
                            index,
                            getMapEntryFromOption(OW_MAP_BY_ID[event.target.value]),
                            { recalculateScore: true }
                          )}
                        >
                          {!selectedMapInPool && <option value="">{mapText.selectFromPool}</option>}
                          {mapsForMode.map(map => (
                            <option key={map.id} value={map.id}>{getMapLabel(map, language)}</option>
                          ))}
                        </select>

                        <select value={entry.picker || ''} onChange={event => updateMapEntry(index, { picker: event.target.value })}>
                          {teamOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>

                        <select
                          className={rowWinner ? styles.mapWinnerSelect : ''}
                          value={entry.winnerSide || entry.winner || ''}
                          onChange={event => updateMapEntry(
                            index,
                            {
                              winner: event.target.value,
                              winnerSide: event.target.value,
                              ...(event.target.value === 'DRAW' ? { attackSide: '' } : {})
                            },
                            { recalculateScore: true }
                          )}
                        >
                          {winnerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>

                        <button
                          type="button"
                          className={[
                            isBanExpanded ? styles.activeOutline : '',
                            rowBanCount ? styles.mapBanFilled : ''
                          ].filter(Boolean).join(' ')}
                          onClick={() => setExpandedBanIndex(isBanExpanded ? null : index)}
                        >
                          {isBanExpanded ? mapText.close : rowBanCount ? `${rowBanCount} ${mapText.ban}` : mapText.ban}
                        </button>
                      </div>

                      {isBanExpanded && (
                        <div className={styles.mapBanPanel}>
                          <div className={styles.mapBanToolbar}>
                            <div className={styles.sectionTitle}>{mapText.mapBan}</div>
                            <button
                              type="button"
                              onClick={() => updateMapEntry(index, {
                                banOrderMode: entry.banOrderMode === 'B_FIRST' ? 'A_FIRST' : 'B_FIRST'
                              })}
                            >
                              {mapText.order} {entry.banOrderMode === 'B_FIRST' ? mapText.bFirst : mapText.aFirst}
                            </button>
                            <button type="button" onClick={() => applyLiveBansToMap(index)}>{mapText.useLiveBans}</button>
                            <button type="button" className={styles.dangerButton} onClick={() => clearMapBans(index)}>{mapText.clearBans}</button>
                          </div>

                          <div className={styles.mapBanTeams}>
                            <div className={styles.mapBanTeamCard}>
                              <div className={styles.mapBanTeamHeader}>
                                <span>{mapText.teamABan}</span>
                                <strong>{parsedBanA.hero === 'tbd' ? mapText.tbd : mapText.set}</strong>
                              </div>
                              <div className={styles.mapBanFields}>
                                <select value={parsedBanA.role} onChange={event => updateMapBanEntry(index, 'A', { role: event.target.value, hero: 'tbd' })}>
                                  {BAN_ROLE_OPTIONS.map(role => <option key={role} value={role}>{getPlayerRoleLabel({ role }, language)}</option>)}
                                </select>
                                <select value={parsedBanA.hero} onChange={event => updateMapBanEntry(index, 'A', { hero: event.target.value })}>
                                  <option value="tbd">{mapText.tbd}</option>
                                  {getHeroOptionsByRole(parsedBanA.role).map(hero => (
                                    <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className={styles.mapBanTeamCard}>
                              <div className={styles.mapBanTeamHeader}>
                                <span>{mapText.teamBBan}</span>
                                <strong>{parsedBanB.hero === 'tbd' ? mapText.tbd : mapText.set}</strong>
                              </div>
                              <div className={styles.mapBanFields}>
                                <select value={parsedBanB.role} onChange={event => updateMapBanEntry(index, 'B', { role: event.target.value, hero: 'tbd' })}>
                                  {BAN_ROLE_OPTIONS.map(role => <option key={role} value={role}>{getPlayerRoleLabel({ role }, language)}</option>)}
                                </select>
                                <select value={parsedBanB.hero} onChange={event => updateMapBanEntry(index, 'B', { hero: event.target.value })}>
                                  <option value="tbd">{mapText.tbd}</option>
                                  {getHeroOptionsByRole(parsedBanB.role).map(hero => (
                                    <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

        </div>
      </div>
    </div>
  )
}


export default CurrentMapEditor
