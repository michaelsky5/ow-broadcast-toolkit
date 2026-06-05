import { OW_ROLE_OPTIONS } from '../../../data/overwatch'
import { getTeamPlayers } from '../../../project/projectUtils'
import { useState } from 'react'
import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel, SegmentedControl, Stepper } from '../shared/editorControls'
import {
  ensureSceneSettings,
  getHeroLabel,
  getHeroOptionsByRole,
  getPlayerRoleLabel,
  getSceneSettings,
  getTeam,
  getTeamSideOptions
} from '../shared/editorHelpers'

function StartingFiveEditor({ project, copy, text, language, onUpdateProject }) {
  const settings = getSceneSettings(project, 'starting-five')
  const activeSide = String(settings.startingLineupSide || '').toUpperCase()
  const activeMode = String(settings.startingLineupMode || 'LIST').toUpperCase()
  const calloutIndex = Number(settings.startingLineupCalloutIndex || 0)
  const [expandedSides, setExpandedSides] = useState({ teamA: false, teamB: false })
  const activeOutputLabel = activeSide
    ? `${activeSide === 'B' ? copy.teamB : copy.teamA} // ${activeMode === 'CALLOUT' ? text.callout : text.fullLineup}`
    : text.empty

  const triggerLineup = (side, mode = 'LIST') => {
    onUpdateProject(draft => {
      const nextSettings = ensureSceneSettings(draft, 'starting-five')
      nextSettings.startingLineupSide = side
      nextSettings.startingLineupMode = mode
      nextSettings.startingLineupCalloutIndex = mode === 'CALLOUT'
        ? (activeSide === side && activeMode === 'CALLOUT'
          ? (calloutIndex + 1) % 5
          : 0)
        : -1
      nextSettings.startingLineupTriggerAt = Date.now()
    })
  }

  const updatePlayer = (playerId, patch) => {
    onUpdateProject(draft => {
      const target = draft.players.find(player => player.id === playerId)
      if (target) Object.assign(target, patch)
    })
  }

  const toggleExpandedSide = side => {
    setExpandedSides(prev => ({
      ...prev,
      [side]: !prev[side]
    }))
  }

  const renderSide = (side, title) => {
    const team = getTeam(project, side)
    const players = getTeamPlayers(project, team?.id)
    const selected = project.currentMatch.startingFive?.[side] || []
    const sideKey = side === 'teamA' ? 'A' : 'B'
    const isExpanded = !!expandedSides[side]
    const selectedPlayers = Array.from({ length: 5 }).map((_, index) => (
      project.players.find(item => item.id === selected[index])
    ))
    const filledCount = selectedPlayers.filter(Boolean).length

    return (
      <Panel title={title} className={styles.lineupSummaryPanel}>
        <div className={styles.lineupTeamTopbar}>
          <div className={styles.lineupTeamIdentity}>
            <span>{team?.shortName || sideKey}</span>
            <strong>{team?.name || title}</strong>
            <em>{text.readyCount(filledCount)}</em>
          </div>
          <button type="button" className={styles.lineupExpandButton} onClick={() => toggleExpandedSide(side)}>
            {isExpanded ? text.collapse : text.editPlayers}
          </button>
        </div>

        <div className={styles.lineupQuickActions}>
          <button
            type="button"
            className={activeSide === sideKey && activeMode !== 'CALLOUT' ? styles.primaryButton : ''}
            onClick={() => triggerLineup(sideKey, 'LIST')}
          >
            {text.fullLineup}
          </button>
          <button
            type="button"
            className={activeSide === sideKey && activeMode === 'CALLOUT' ? styles.primaryButton : ''}
            onClick={() => triggerLineup(sideKey, 'CALLOUT')}
          >
            {text.callout}
          </button>
        </div>

        <button type="button" className={styles.lineupSummarySlots} onClick={() => toggleExpandedSide(side)}>
          {selectedPlayers.map((player, index) => (
            <span key={`${side}-summary-${index}`}>
              <b>{index + 1}</b>
              <strong>{player?.name || text.empty}</strong>
              <em>{player ? getPlayerRoleLabel(player, language) : text.role}</em>
            </span>
          ))}
        </button>

        {isExpanded && (
          <div className={styles.lineupList}>
          {Array.from({ length: 5 }).map((_, index) => {
            const player = selectedPlayers[index]
            const roleHeroes = getHeroOptionsByRole(player?.role || 'damage')

            return (
              <div className={styles.playerRow} key={`${side}-${index}`}>
                <div>
                  <span>{index + 1}</span>
                  <strong>{player ? getPlayerRoleLabel(player, language) : text.role}</strong>
                </div>

                <select
                  value={selected[index] || ''}
                  onChange={event => onUpdateProject(draft => {
                    const next = [...(draft.currentMatch.startingFive[side] || [])]
                    next[index] = event.target.value
                    draft.currentMatch.startingFive[side] = next
                  })}
                >
                  <option value="">{text.selectPlayer}</option>
                  {players.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name} / {getPlayerRoleLabel(option, language)}
                    </option>
                  ))}
                </select>

                {player && (
                  <div className={styles.playerMeta}>
                    <select
                      value={player.role || 'damage'}
                      onChange={event => updatePlayer(player.id, {
                        role: event.target.value,
                        primaryHeroes: [getHeroOptionsByRole(event.target.value)[0]?.id || '']
                      })}
                    >
                      {OW_ROLE_OPTIONS.map(role => (
                        <option key={role.value} value={role.value}>{language === 'en' ? role.enLabel : role.label}</option>
                      ))}
                    </select>

                    <select
                      value={player.primaryHeroes?.[0] || ''}
                      onChange={event => updatePlayer(player.id, { primaryHeroes: [event.target.value] })}
                    >
                      <option value="">{text.empty}</option>
                      {roleHeroes.map(hero => (
                        <option key={hero.id} value={hero.id}>{getHeroLabel(hero, language)}</option>
                      ))}
                    </select>

                    <input
                      value={player.avatar || ''}
                      onChange={event => updatePlayer(player.id, { avatar: event.target.value })}
                      placeholder={text.avatarUrl}
                    />
                  </div>
                )}
              </div>
            )
          })}
          </div>
        )}
      </Panel>
    )
  }

  return (
    <div className={`${styles.showFlowDesk} ${styles.lineupEditorDesk}`}>
      <div className={styles.showFlowRail}>
        <Panel title={text.lineupControl} className={styles.showFlowCompactPanel}>
        <Field label={text.lineupSide}>
          <select
            value={activeSide}
            onChange={event => onUpdateProject(draft => {
              ensureSceneSettings(draft, 'starting-five').startingLineupSide = event.target.value
            })}
          >
            {getTeamSideOptions(project, text).map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label={text.lineupMode}>
          <SegmentedControl
            value={activeMode === 'CALLOUT' ? 'CALLOUT' : 'LIST'}
            options={[
              { value: 'LIST', label: text.fullLineup },
              { value: 'CALLOUT', label: text.callout }
            ]}
            onChange={value => onUpdateProject(draft => {
              ensureSceneSettings(draft, 'starting-five').startingLineupMode = value
            })}
          />
        </Field>

        <div className={styles.showFlowStatusStrip}>
          <span>{text.activeOutput}</span>
          <strong>{activeOutputLabel}</strong>
        </div>

        <div className={styles.showFlowMetaGrid}>
          <Field label={text.calloutIndex}>
            <Stepper
              value={Math.min(5, Math.max(1, calloutIndex + 1))}
              min={1}
              max={5}
              onChange={value => onUpdateProject(draft => {
                ensureSceneSettings(draft, 'starting-five').startingLineupCalloutIndex = value - 1
              })}
            />
          </Field>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={!activeSide}
            onClick={() => triggerLineup(activeSide || 'A', activeMode === 'CALLOUT' ? 'CALLOUT' : 'LIST')}
          >
            {text.refreshPreview}
          </button>
        </div>
      </Panel>
      </div>

      <div className={styles.showFlowLineupTeams}>
        {renderSide('teamA', `${copy.teamA} ${text.startingFive}`)}
        {renderSide('teamB', `${copy.teamB} ${text.startingFive}`)}
      </div>
    </div>
  )
}


export default StartingFiveEditor
