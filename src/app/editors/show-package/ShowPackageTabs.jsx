import styles from '../shared/SceneEditor.styles.js'

const SHOW_PACKAGE_MODES = [
  { id: 'matchup', label: 'Up Next', meta: 'Match card' },
  { id: 'starting-five', label: 'Lineup', meta: 'Starting five' },
  { id: 'result', label: 'Result', meta: 'Post-match' },
  { id: 'thanks', label: 'Thanks', meta: 'Closing' }
]

function ShowPackageTabs({
  scene,
  onSelectScene,
  onSelectMode,
  activeModeId,
  modes = SHOW_PACKAGE_MODES,
  compact = false,
  className = ''
}) {
  const activeId = activeModeId || scene.id

  return (
    <div className={[compact ? styles.editorSceneTabs : styles.showPackageModeBar, className].filter(Boolean).join(' ')}>
      {modes.map(mode => {
        const isActive = activeId === mode.id

        return (
          <button
            key={mode.id}
            type="button"
            className={[
              styles.showPackageModeButton,
              isActive ? styles.showPackageModeActive : ''
            ].filter(Boolean).join(' ')}
            onClick={() => (onSelectMode || onSelectScene)(mode.id)}
          >
            <span>{mode.label}</span>
            <em>{mode.meta}</em>
          </button>
        )
      })}
    </div>
  )
}

export default ShowPackageTabs
