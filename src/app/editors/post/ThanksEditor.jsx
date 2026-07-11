import { getBroadcastCompetitionName } from '../../../project/branding'
import styles from '../shared/SceneEditor.styles.js'
import { getPostEditorCopy } from '../shared/editorCopy'
import { Field, Panel, ToggleField } from '../shared/editorControls'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'

function ThanksEditor({ project, text, language, onUpdateProject }) {
  const postText = getPostEditorCopy(language)
  const settings = getSceneSettings(project, 'thanks')
  const creditCasters = (project.currentMatch.casters || [])
    .map(casterId => project.casters.find(caster => caster.id === casterId))
    .filter(Boolean)
  const eventName = getBroadcastCompetitionName(project)
  const stageLabel = project.currentMatch.stage || text.empty
  const roundLabel = project.currentMatch.currentRoundLabel || text.empty

  const updateThanksSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'thanks'), patch)
    })
  }

  return (
    <div className={`${styles.showFlowDesk} ${styles.thanksEditorDesk}`}>
      <div className={styles.showFlowRail}>
        <Panel title={postText.thanksPackage} className={styles.showFlowCompactPanel}>
          <Field label={text.title}>
            <input value={settings.title || ''} onChange={event => updateThanksSettings({ title: event.target.value })} />
          </Field>

          <Field label={text.subtitle}>
            <input value={settings.subtitle || ''} onChange={event => updateThanksSettings({ subtitle: event.target.value })} />
          </Field>

          <div className={styles.showFlowToggleStrip}>
            <ToggleField
              label={postText.showSummary}
              checked={settings.showSummary !== false}
              onChange={checked => updateThanksSettings({ showSummary: checked })}
            />
            <ToggleField
              label={language === 'zh' ? '显示赞助商' : 'Show Sponsors'}
              checked={settings.showSponsors !== false}
              onChange={checked => updateThanksSettings({ showSponsors: checked })}
            />
            <ToggleField
              label={postText.showCredits}
              checked={settings.showCredits !== false}
              onChange={checked => updateThanksSettings({ showCredits: checked })}
            />
          </div>
        </Panel>
      </div>

      <div className={styles.showFlowMainStack}>
        <Panel title={postText.outputSummary} className={styles.showFlowCompactPanel}>
          <div className={styles.showFlowSummaryGrid}>
            <div>
              <span>{postText.event}</span>
              <strong>{eventName}</strong>
            </div>
            <div>
              <span>{text.stage}</span>
              <strong>{stageLabel}</strong>
            </div>
            <div>
              <span>{postText.round}</span>
              <strong>{roundLabel}</strong>
            </div>
          </div>
        </Panel>

        <Panel title={postText.thanksCredits} className={styles.showFlowCompactPanel}>
          <div className={styles.thanksCreditSummary}>
            <span>{postText.casters}</span>
            <strong>
              {creditCasters.length
                ? creditCasters.map(caster => caster.name || caster.id).join(' / ')
                : text.empty}
            </strong>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default ThanksEditor
