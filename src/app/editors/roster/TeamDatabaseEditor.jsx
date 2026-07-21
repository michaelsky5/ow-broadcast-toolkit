import { getTeamPlayers } from '../../../project/projectUtils'
import styles from '../shared/SceneEditor.styles.js'
import { Panel } from '../shared/editorControls'
import { ensureSceneSettings } from '../shared/editorHelpers'
import { getStartingFiveForTeam, normalizeRosterRole } from './rosterEditorUtils'

const STARTING_LINEUP_SIZE = 5

const getSideConfig = (project, sideKey) => {
  const teamId = project.currentMatch?.[`${sideKey}Id`] || ''
  const team = (project.teams || []).find(item => item.id === teamId) || null
  const players = team ? getTeamPlayers(project, team.id) : []
  const storedLineup = project.currentMatch?.startingFive?.[sideKey] || []
  const validPlayerIds = new Set(players.map(player => player.id))
  const lineup = storedLineup.filter(playerId => validPlayerIds.has(playerId)).slice(0, STARTING_LINEUP_SIZE)

  return { team, players, lineup }
}

function TeamMark({ side, team }) {
  return (
    <span
      className={styles.currentMatchTeamMark}
      style={{ '--current-team-color': team?.primaryColor || 'var(--theme-primary)' }}
    >
      {team?.logo
        ? <img src={team.logo} alt="" />
        : <strong>{String(team?.shortName || side).slice(0, 3)}</strong>}
    </span>
  )
}

function TeamSideCard({
  displaySide,
  project,
  rosterText,
  side,
  sideKey,
  onSetDisplaySide,
  onToggleLineup,
  onUpdateTeam
}) {
  const { team, players, lineup } = getSideConfig(project, sideKey)
  const lineupIds = new Set(lineup)
  const isDisplaySide = displaySide === side

  if (!team) {
    return (
      <article className={`${styles.currentMatchTeamCard} ${styles.currentMatchTeamMissing}`}>
        <span className={styles.currentMatchSide}>{rosterText.currentSide(side)}</span>
        <strong>{rosterText.noCurrentTeam}</strong>
        <p>{rosterText.pastePackageHint}</p>
      </article>
    )
  }

  return (
    <article className={styles.currentMatchTeamCard}>
      <header className={styles.currentMatchTeamHeader}>
        <TeamMark side={side} team={team} />
        <div>
          <span className={styles.currentMatchSide}>{rosterText.currentSide(side)}</span>
          <strong>{team.name}</strong>
          <em>{team.shortName} / {team.players?.length || players.length} {rosterText.players}</em>
        </div>
        <button
          type="button"
          className={isDisplaySide ? styles.currentMatchDisplayActive : ''}
          onClick={() => onSetDisplaySide(side)}
        >
          {isDisplaySide ? rosterText.displayedTeam : rosterText.displayTeam}
        </button>
      </header>

      <div className={styles.currentMatchTeamFields}>
        <label>
          <span>{rosterText.teamName}</span>
          <input value={team.name || ''} onChange={event => onUpdateTeam(team.id, 'name', event.target.value)} />
        </label>
        <label>
          <span>{rosterText.short}</span>
          <input value={team.shortName || ''} onChange={event => onUpdateTeam(team.id, 'shortName', event.target.value)} />
        </label>
      </div>

      <section className={styles.currentMatchLineup}>
        <header>
          <div>
            <span>{rosterText.startingLineup}</span>
            <strong>{rosterText.lineupCount(lineup.length, STARTING_LINEUP_SIZE)}</strong>
          </div>
          <em>{rosterText.lineupHint}</em>
        </header>
        <div className={styles.currentMatchPlayerGrid}>
          {players.map((player, index) => {
            const selected = lineupIds.has(player.id)
            const maxReached = !selected && lineup.length >= STARTING_LINEUP_SIZE

            return (
              <button
                type="button"
                key={player.id}
                className={selected ? styles.currentMatchPlayerActive : ''}
                aria-pressed={selected}
                disabled={maxReached}
                onClick={() => onToggleLineup(sideKey, team.id, player.id)}
              >
                <span>P{index + 1}</span>
                <strong>{player.name || `Player ${index + 1}`}</strong>
                <em>{rosterText[normalizeRosterRole(player.role)]}</em>
              </button>
            )
          })}
          {!players.length && <div className={styles.currentMatchNoPlayers}>{rosterText.noPlayers}</div>}
        </div>
      </section>
    </article>
  )
}

function TeamDatabaseEditor({ project, rosterText, onUpdateProject }) {
  const displaySide = String(project.scenes?.settings?.roster?.teamSide || 'A').toUpperCase() === 'B' ? 'B' : 'A'
  const teamCount = (project.teams || []).length

  const updateTeam = (teamId, field, value) => {
    onUpdateProject(draft => {
      const team = draft.teams.find(item => item.id === teamId)
      if (team) team[field] = value
    })
  }

  const setDisplaySide = side => {
    onUpdateProject(draft => {
      ensureSceneSettings(draft, 'roster').teamSide = side
    })
  }

  const toggleLineup = (sideKey, teamId, playerId) => {
    onUpdateProject(draft => {
      const validPlayerIds = new Set(getTeamPlayers(draft, teamId).map(player => player.id))
      const current = (draft.currentMatch.startingFive?.[sideKey] || getStartingFiveForTeam(draft, teamId))
        .filter(id => validPlayerIds.has(id))
        .slice(0, STARTING_LINEUP_SIZE)
      const selected = current.includes(playerId)
      const next = selected
        ? current.filter(id => id !== playerId)
        : current.length < STARTING_LINEUP_SIZE ? [...current, playerId] : current

      if (!draft.currentMatch.startingFive) draft.currentMatch.startingFive = {}
      draft.currentMatch.startingFive[sideKey] = next
    })
  }

  return (
    <div className={styles.teamDbDesk}>
      <Panel title={rosterText.currentMatchTeams} className={styles.currentMatchPanel}>
        <div className={styles.currentMatchIntro}>
          <div>
            <span>{rosterText.currentMatchMeta}</span>
            <strong>{rosterText.projectTeamCount(Math.min(teamCount, 2))}</strong>
          </div>
          <p>{teamCount > 2 ? rosterText.legacyTeamNotice(teamCount) : rosterText.matchPackageOnly}</p>
        </div>

        <div className={styles.currentMatchTeamsGrid}>
          <TeamSideCard
            displaySide={displaySide}
            project={project}
            rosterText={rosterText}
            side="A"
            sideKey="teamA"
            onSetDisplaySide={setDisplaySide}
            onToggleLineup={toggleLineup}
            onUpdateTeam={updateTeam}
          />
          <TeamSideCard
            displaySide={displaySide}
            project={project}
            rosterText={rosterText}
            side="B"
            sideKey="teamB"
            onSetDisplaySide={setDisplaySide}
            onToggleLineup={toggleLineup}
            onUpdateTeam={updateTeam}
          />
        </div>
      </Panel>
    </div>
  )
}

export default TeamDatabaseEditor
