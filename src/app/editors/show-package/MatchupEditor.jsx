import { OW_MAP_OPTIONS } from '../../../data/overwatch'
import { useState } from 'react'
import { FT_OPTIONS } from '../../../match/defaultMatch'
import { DEFAULT_THEME } from '../../../theme/defaultTheme'
import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel } from '../shared/editorControls'
import { ensureSceneSettings, getMapLabel, getSceneSettings, getTeam } from '../shared/editorHelpers'

function UpNextDisplaySwitch({ label, checked, language, onChange }) {
  const stateLabel = language === 'zh'
    ? (checked ? '\u5f00' : '\u5173')
    : (checked ? 'ON' : 'OFF')

  return (
    <button
      type="button"
      className={`${styles.upNextDisplaySwitch} ${checked ? styles.upNextDisplaySwitchActive : ''}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <strong>{stateLabel}</strong>
    </button>
  )
}

const normalizePlayerRole = role => {
  const value = String(role || '').trim().toLowerCase()
  if (['damage', 'dps', 'attack'].includes(value)) return 'damage'
  if (['tank', 'main tank', 'off tank'].includes(value)) return 'tank'
  if (['support', 'sup', 'healer'].includes(value)) return 'support'
  return value || 'damage'
}

const getTeamPlayers = (project, teamId) => {
  const players = project.players.filter(player => player.teamId === teamId)
  const roleOrder = ['damage', 'damage', 'tank', 'support', 'support']
  const usedIds = new Set()

  return [
    ...roleOrder
      .map(role => {
        const player = players.find(item => !usedIds.has(item.id) && normalizePlayerRole(item.role) === role)
        if (player) usedIds.add(player.id)
        return player?.id
      })
      .filter(Boolean),
    ...players.filter(player => !usedIds.has(player.id)).map(player => player.id)
  ].slice(0, 5)
}

function MatchupTeamPanel({ side, title, project, copy, text, isExpanded, onToggleExpanded, onUpdateProject }) {
  const team = getTeam(project, side)
  const fallbackColor = project.theme?.primary || DEFAULT_THEME.primary
  const scoreKey = side
  const teamName = team?.name || text.empty
  const shortName = team?.shortName || 'TBD'
  const logoStatus = team?.logo ? text.logoReady : text.noLogo

  const updateTeam = field => event => {
    const value = event.target.value
    onUpdateProject(draft => {
      const teamId = draft.currentMatch[`${side}Id`]
      const target = draft.teams.find(item => item.id === teamId)
      if (target) target[field] = value
    })
  }

  const selectTeam = event => {
    const nextTeamId = event.target.value
    onUpdateProject(draft => {
      draft.currentMatch[`${side}Id`] = nextTeamId
      draft.currentMatch.startingFive[side] = getTeamPlayers(draft, nextTeamId)
    })
  }

  return (
    <div className={styles.upNextTeamCard}>
      <div className={styles.upNextTeamTopbar}>
        <div className={styles.upNextTeamIdentity}>
          <span>{title}</span>
          <strong>{shortName}</strong>
          <em>{teamName}</em>
        </div>
        <button
          type="button"
          className={styles.upNextTeamEditButton}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          {isExpanded ? text.close : text.editTeam}
        </button>
      </div>

      <Field label={text.teamPreset}>
        <select value={project.currentMatch[`${side}Id`] || ''} onChange={selectTeam}>
          {project.teams.map(item => (
            <option key={item.id} value={item.id}>{item.name || item.id}</option>
          ))}
        </select>
      </Field>

      <div className={styles.upNextTeamSummaryGrid}>
        <div>
          <span>{text.logoStatus}</span>
          <strong>{logoStatus}</strong>
        </div>
        <div>
          <span>{copy.teamShortName}</span>
          <strong>{shortName}</strong>
        </div>
        <div>
          <span>{copy.teamPrimaryColor}</span>
          <strong className={styles.upNextColorChip} style={{ '--team-color': team?.primaryColor || fallbackColor }}>
            {team?.primaryColor || fallbackColor}
          </strong>
        </div>
        <div>
          <span>{text.seriesScore}</span>
          <strong>{project.currentMatch.score?.[scoreKey] ?? 0}</strong>
        </div>
      </div>

      {isExpanded ? (
        <div className={styles.upNextTeamDetails}>
          <Field label={copy.teamName}>
            <input value={team?.name || ''} onChange={updateTeam('name')} />
          </Field>

          <div className={styles.twoCol}>
            <Field label={copy.teamShortName}>
              <input value={team?.shortName || ''} onChange={updateTeam('shortName')} />
            </Field>

            <Field label={copy.teamPrimaryColor}>
              <input type="color" value={team?.primaryColor || fallbackColor} onChange={updateTeam('primaryColor')} />
            </Field>
          </div>

          <Field label={text.teamLogo}>
            <input value={team?.logo || ''} onChange={updateTeam('logo')} placeholder="/OW.svg" />
          </Field>
        </div>
      ) : null}
    </div>
  )
}

function MatchupEditor({ project, copy, text, language, statusOptions, onUpdateProject }) {
  const [expandedTeams, setExpandedTeams] = useState({ teamA: false, teamB: false })
  const settings = getSceneSettings(project, 'matchup')
  const teamA = getTeam(project, 'teamA')
  const teamB = getTeam(project, 'teamB')

  const updateSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'matchup'), patch)
    })
  }

  const swapTeams = () => {
    onUpdateProject(draft => {
      const nextTeamAId = draft.currentMatch.teamBId
      const nextTeamBId = draft.currentMatch.teamAId
      draft.currentMatch.teamAId = nextTeamAId
      draft.currentMatch.teamBId = nextTeamBId
      draft.currentMatch.startingFive.teamA = getTeamPlayers(draft, nextTeamAId)
      draft.currentMatch.startingFive.teamB = getTeamPlayers(draft, nextTeamBId)
    })
  }

  const toggleExpandedTeam = side => {
    setExpandedTeams(previous => ({ ...previous, [side]: !previous[side] }))
  }

  return (
    <div className={`${styles.showFlowDesk} ${styles.upNextDesk}`}>
      <div className={styles.showFlowRail}>
        <Panel title={text.upNextControl} className={`${styles.showFlowCompactPanel} ${styles.upNextControlPanel}`}>
          <div className={styles.upNextControlGrid}>
            <Field label={text.title} wide>
              <input
                value={settings.title || ''}
                onChange={event => updateSettings({ title: event.target.value })}
                placeholder="UP NEXT"
              />
            </Field>

            <Field label={copy.stage}>
              <input
                value={project.currentMatch.stage}
                onChange={event => onUpdateProject(draft => {
                  draft.currentMatch.stage = event.target.value
                })}
              />
            </Field>

            <Field label={text.currentRound}>
              <input
                value={project.currentMatch.currentRoundLabel}
                onChange={event => onUpdateProject(draft => {
                  draft.currentMatch.currentRoundLabel = event.target.value
                })}
              />
            </Field>

            <Field label={copy.ft}>
              <select
                value={project.currentMatch.ft}
                onChange={event => onUpdateProject(draft => {
                  draft.currentMatch.ft = Number(event.target.value)
                })}
              >
                {FT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label={copy.status}>
              <select
                value={project.currentMatch.status}
                onChange={event => onUpdateProject(draft => {
                  draft.currentMatch.status = event.target.value
                })}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label={copy.map} wide>
              <select
                value={project.currentMatch.currentMapId}
                onChange={event => onUpdateProject(draft => {
                  draft.currentMatch.currentMapId = event.target.value
                })}
              >
                {OW_MAP_OPTIONS.map(map => (
                  <option key={map.id} value={map.id}>{getMapLabel(map, language)}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className={styles.showFlowToggleStrip}>
            <UpNextDisplaySwitch
              label={text.showStage}
              checked={settings.showStage !== false}
              language={language}
              onChange={checked => updateSettings({ showStage: checked })}
            />
            <UpNextDisplaySwitch
              label={text.showFt}
              checked={settings.showFt !== false}
              language={language}
              onChange={checked => updateSettings({ showFt: checked })}
            />
            <UpNextDisplaySwitch
              label={text.showMap}
              checked={settings.showMap !== false}
              language={language}
              onChange={checked => updateSettings({ showMap: checked })}
            />
            <UpNextDisplaySwitch
              label={text.showSponsors}
              checked={settings.showSponsors !== false}
              language={language}
              onChange={checked => updateSettings({ showSponsors: checked })}
            />
          </div>
        </Panel>
      </div>

      <Panel title={text.teamMatchup} className={styles.upNextTeamsPanel}>
        <div className={styles.upNextMatchupBar}>
          <div className={styles.upNextMatchupTeam}>
            <span>{copy.teamA}</span>
            <strong>{teamA?.shortName || 'TBD'}</strong>
            <em>{teamA?.name || text.empty}</em>
          </div>

          <div className={styles.upNextMatchupVersus}>
            <span>VS</span>
            <strong>FT{project.currentMatch.ft || 3}</strong>
          </div>

          <div className={`${styles.upNextMatchupTeam} ${styles.upNextMatchupTeamRight}`}>
            <span>{copy.teamB}</span>
            <strong>{teamB?.shortName || 'TBD'}</strong>
            <em>{teamB?.name || text.empty}</em>
          </div>

          <button type="button" className={styles.upNextSwapButton} onClick={swapTeams}>
            <span>A / B</span>
            <strong>{text.swapTeams}</strong>
          </button>
        </div>

        <div className={styles.upNextTeamGrid}>
          <MatchupTeamPanel
            side="teamA"
            title={copy.teamA}
            project={project}
            copy={copy}
            text={text}
            isExpanded={expandedTeams.teamA}
            onToggleExpanded={() => toggleExpandedTeam('teamA')}
            onUpdateProject={onUpdateProject}
          />

          <MatchupTeamPanel
            side="teamB"
            title={copy.teamB}
            project={project}
            copy={copy}
            text={text}
            isExpanded={expandedTeams.teamB}
            onToggleExpanded={() => toggleExpandedTeam('teamB')}
            onUpdateProject={onUpdateProject}
          />
        </div>
      </Panel>
    </div>
  )
}

export default MatchupEditor
