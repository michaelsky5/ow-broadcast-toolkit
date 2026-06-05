import styles from './SceneEditor.styles.js'
import { Field, Panel } from './editorControls'
import { ensureSceneSettings, getSceneSettings } from './editorHelpers'

function GenericSceneEditor({ project, scene, text, onUpdateProject }) {
  const settings = getSceneSettings(project, scene.id)
  const hasDescription = scene.id === 'pause'

  return (
    <div className={styles.panelGrid}>
      <Panel title={text.sceneSettings}>
        <Field label={text.title}>
          <input
            value={settings.title || ''}
            onChange={event => onUpdateProject(draft => {
              ensureSceneSettings(draft, scene.id).title = event.target.value
            })}
          />
        </Field>

        {'subtitle' in settings && (
          <Field label={text.subtitle}>
            <input
              value={settings.subtitle || ''}
              onChange={event => onUpdateProject(draft => {
                ensureSceneSettings(draft, scene.id).subtitle = event.target.value
              })}
            />
          </Field>
        )}

        {hasDescription && (
          <Field label={text.description}>
            <textarea
              value={settings.description || ''}
              onChange={event => onUpdateProject(draft => {
                ensureSceneSettings(draft, scene.id).description = event.target.value
                draft.currentMatch.pause.description = event.target.value
              })}
            />
          </Field>
        )}
      </Panel>

    </div>
  )
}


export default GenericSceneEditor
