import styles from '../shared/SceneEditor.styles.js'
import { getPostEditorCopy } from '../shared/editorCopy'
import { Field, Panel, ToggleField } from '../shared/editorControls'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'

function PauseEditor({ project, copy, text, language, statusOptions, onUpdateProject }) {
  const postText = getPostEditorCopy(language)
  const settings = getSceneSettings(project, 'pause')

  const updatePauseSettings = patch => {
    onUpdateProject(draft => {
      const pauseSettings = ensureSceneSettings(draft, 'pause')
      Object.assign(pauseSettings, patch)
      draft.currentMatch.pause = {
        ...(draft.currentMatch.pause || {}),
        ...('title' in patch ? { title: patch.title } : {}),
        ...('description' in patch ? { description: patch.description } : {})
      }
    })
  }

  return (
    <div className={styles.twoPanelGrid}>
      <Panel title={postText.pausePackage}>
        <Field label={text.title}>
          <input value={settings.title || ''} onChange={event => updatePauseSettings({ title: event.target.value })} />
        </Field>

        <Field label={text.description}>
          <textarea value={settings.description || ''} onChange={event => updatePauseSettings({ description: event.target.value })} />
        </Field>

        <Field label={postText.statusLabel}>
          <input value={settings.statusLabel || ''} onChange={event => updatePauseSettings({ statusLabel: event.target.value })} />
        </Field>

        <ToggleField
          label={postText.showMatchFrame}
          checked={settings.showMatchFrame !== false}
          onChange={checked => updatePauseSettings({ showMatchFrame: checked })}
        />
        <ToggleField
          label={language === 'zh' ? '显示赞助商' : 'Show Sponsors'}
          checked={settings.showSponsors !== false}
          onChange={checked => updatePauseSettings({ showSponsors: checked })}
        />
      </Panel>

      <Panel title={postText.pauseContext}>
        <Field label={copy.stage}>
          <input
            value={project.currentMatch.stage || ''}
            onChange={event => onUpdateProject(draft => {
              draft.currentMatch.stage = event.target.value
            })}
          />
        </Field>

        <Field label={text.currentRound}>
          <input
            value={project.currentMatch.currentRoundLabel || ''}
            onChange={event => onUpdateProject(draft => {
              draft.currentMatch.currentRoundLabel = event.target.value
            })}
          />
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
      </Panel>
    </div>
  )
}


export default PauseEditor
