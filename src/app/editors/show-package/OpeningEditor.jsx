import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel, ToggleField } from '../shared/editorControls'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

function OpeningEditor({ project, copy, text, onUpdateProject }) {
  const settings = getSceneSettings(project, 'opening')
  const competitionNameEn = hasOwn(settings, 'competitionNameEn') ? settings.competitionNameEn : project.event.nameEn || ''
  const competitionNameZh = hasOwn(settings, 'competitionNameZh') ? settings.competitionNameZh : project.event.nameZh || ''
  const openingTitle = hasOwn(settings, 'title') ? settings.title : project.event.nameEn || project.event.name || ''
  const openingSubtitle = hasOwn(settings, 'subtitle') ? settings.subtitle : project.event.subtitle || ''
  const statusLabel = hasOwn(settings, 'statusLabel') ? settings.statusLabel : 'STANDBY'
  const backgroundOpacity = Number(project.theme.backgroundOpacity ?? 0.35)

  return (
    <div className={styles.panelGrid}>
      <Panel title={text.eventCopy}>
        <Field label={text.eventNameEn}>
          <input
            value={competitionNameEn}
            onChange={event => onUpdateProject(draft => {
              const value = event.target.value
              ensureSceneSettings(draft, 'opening').competitionNameEn = value
              draft.event.nameEn = value
              draft.event.name = value
              draft.meta.name = value || 'FriesCup Project'
            })}
          />
        </Field>

        <Field label={text.eventNameZh}>
          <input
            value={competitionNameZh}
            onChange={event => onUpdateProject(draft => {
              const value = event.target.value
              ensureSceneSettings(draft, 'opening').competitionNameZh = value
              draft.event.nameZh = value
            })}
          />
        </Field>

        <Field label={text.eventSubtitle}>
          <input
            value={project.event.subtitle || ''}
            onChange={event => onUpdateProject(draft => {
              draft.event.subtitle = event.target.value
            })}
          />
        </Field>
      </Panel>

      <Panel title={text.openingCopy}>
        <Field label={text.openingTitle}>
          <input
            value={openingTitle}
            onChange={event => onUpdateProject(draft => {
              ensureSceneSettings(draft, 'opening').title = event.target.value
            })}
          />
        </Field>

        <Field label={text.openingSubtitle}>
          <input
            value={openingSubtitle}
            onChange={event => onUpdateProject(draft => {
              ensureSceneSettings(draft, 'opening').subtitle = event.target.value
            })}
          />
        </Field>

        <Field label={text.statusLabel}>
          <input
            value={statusLabel}
            placeholder="STANDBY"
            onChange={event => onUpdateProject(draft => {
              ensureSceneSettings(draft, 'opening').statusLabel = event.target.value
            })}
          />
        </Field>

        <ToggleField
          label={text.showEventLogo}
          checked={settings.showEventLogo !== false}
          onChange={checked => onUpdateProject(draft => {
            ensureSceneSettings(draft, 'opening').showEventLogo = checked
          })}
        />
      </Panel>

      <Panel title={text.visualPackage}>
        <Field label={copy.themePrimary}>
          <input
            type="color"
            value={project.theme.primary}
            onChange={event => onUpdateProject(draft => {
              draft.theme.primary = event.target.value
            })}
          />
        </Field>

        <Field label={text.eventLogo}>
          <input
            value={project.event.logo || ''}
            onChange={event => onUpdateProject(draft => {
              draft.event.logo = event.target.value
            })}
            placeholder="https://..."
          />
        </Field>

        <Field label={text.backgroundImage}>
          <input
            value={project.theme.backgroundImage || ''}
            onChange={event => onUpdateProject(draft => {
              draft.theme.backgroundImage = event.target.value
            })}
            placeholder="https://..."
          />
        </Field>

        <Field label={text.backgroundOpacity}>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0.35}
            onChange={event => onUpdateProject(draft => {
              draft.theme.backgroundOpacity = Math.max(0, Math.min(1, Number(event.target.value) || 0))
            })}
          />
        </Field>
      </Panel>
    </div>
  )
}

export default OpeningEditor
