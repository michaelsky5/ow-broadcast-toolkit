import styles from '../shared/SceneEditor.styles.js'
import { getPostEditorCopy } from '../shared/editorCopy'
import { Field, Panel, Stepper } from '../shared/editorControls'
import { getTeam } from '../shared/editorHelpers'

function ResultEditor({ project, copy, text, language, onUpdateProject }) {
  const postText = getPostEditorCopy(language)
  const teamA = getTeam(project, 'teamA')
  const teamB = getTeam(project, 'teamB')
  const scoreA = Number(project.currentMatch.score.teamA) || 0
  const scoreB = Number(project.currentMatch.score.teamB) || 0
  const winnerTeam = scoreA > scoreB ? teamA : scoreB > scoreA ? teamB : null
  const scoreLine = `${scoreA} : ${scoreB}`

  const updateScore = (side, value) => {
    onUpdateProject(draft => {
      draft.currentMatch.score[side] = value

      const nextA = side === 'teamA' ? value : Number(draft.currentMatch.score.teamA) || 0
      const nextB = side === 'teamB' ? value : Number(draft.currentMatch.score.teamB) || 0
      const winnerTeamId = nextA > nextB
        ? draft.currentMatch.teamAId
        : nextB > nextA
          ? draft.currentMatch.teamBId
          : ''

      draft.currentMatch.result = {
        ...(draft.currentMatch.result || {}),
        winnerTeamId
      }
    })
  }

  return (
    <div className={`${styles.resultEditorDesk} ${styles.resultEditorCompact}`}>
      <Panel title={postText.resultControl} className={styles.resultFlowPanel}>
        <div className={styles.resultOutputHeader}>
          <div className={styles.showFlowStatusStrip}>
            <span>{text.winner}</span>
            <strong>{winnerTeam?.name || text.empty}</strong>
          </div>
          <div className={styles.showFlowStatusStrip}>
            <span>{postText.resultSource}</span>
            <strong>{postText.winnerFollowsScore}</strong>
          </div>
        </div>

        <div className={styles.resultFlowScoreGrid}>
          <Field label={teamA?.shortName || copy.teamA}>
            <Stepper
              value={scoreA}
              min={0}
              max={99}
              onChange={value => updateScore('teamA', value)}
            />
          </Field>

          <div className={styles.resultFlowScoreboard}>
            <span>{postText.finalScore}</span>
            <strong>{scoreLine}</strong>
          </div>

          <Field label={teamB?.shortName || copy.teamB}>
            <Stepper
              value={scoreB}
              min={0}
              max={99}
              onChange={value => updateScore('teamB', value)}
            />
          </Field>
        </div>
      </Panel>
    </div>
  )
}

export default ResultEditor
