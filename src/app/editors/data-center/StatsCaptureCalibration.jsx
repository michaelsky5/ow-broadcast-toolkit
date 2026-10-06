import { useState } from 'react'
import { getCaptureLayoutForParts, getCaptureLayoutParts } from '../../../project/statsCaptureConfig.js'
import styles from '../shared/styles/statsCaptureModal.module.css'

function StatsCaptureCalibration({ capture, timeCrop, activePanel, disabled, onPanelChange, onUpdateCapture, onApplyLayout, onResetCrop, text }) {
  const { aspect, mode } = getCaptureLayoutParts(capture.captureLayout)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const targets = [
    ['stats', text.cropBounds], ['time', text.timeCropBounds],
    ['player', text.playerCropBounds], ['processing', text.cropProcessing]
  ]
  const fields = {
    stats: [['xPct', text.xPct], ['wPct', text.wPct], ['topPct', text.topPct], ['topHPct', text.topHPct], ['bottomPct', text.bottomPct], ['bottomHPct', text.bottomHPct]],
    time: [['timeXPct', text.timeXPct], ['timeYPct', text.timeYPct], ['timeWPct', text.timeWPct], ['timeHPct', text.timeHPct]],
    player: [['playerXPct', text.playerXPct], ['bottomPlayerXPct', text.bottomPlayerXPct], ['playerWPct', text.playerWPct]],
    processing: [['scale', text.scale, text.scaleHint], ['threshold', text.threshold, text.thresholdHint]]
  }
  const changePreset = (nextAspect, nextMode) => {
    if (disabled || (nextAspect === aspect && nextMode === mode)) return
    onApplyLayout(getCaptureLayoutForParts(nextAspect, nextMode))
  }
  const togglePanel = panel => {
    if (disabled) return
    setFieldsOpen(panel === activePanel ? !fieldsOpen : true)
    onPanelChange(panel)
  }
  return (
    <div className={styles.calibrationContent} data-fields-open={fieldsOpen}>
      <div className={styles.captureLayoutSwitch} aria-label={text.adjustLayout}>
        <div className={styles.captureSelectionSummary}>
          <span>{text.currentPreset}</span><strong>{aspect === 'sixteenTen' ? '16:10' : '16:9'} / {text[mode]}</strong>
        </div>
        <div className={styles.captureSwitchSection}>
          <span className={styles.captureSwitchLabel}><b>1</b>{text.captureAspect}</span>
          <div className={styles.captureSwitchGroup} role="group" aria-label={text.captureAspect}>
            {[['standard', '16:9'], ['sixteenTen', '16:10']].map(([value, label]) => <button type="button" key={value} disabled={disabled}
              className={aspect === value ? styles.captureLayoutActive : ''} aria-pressed={aspect === value}
              onClick={() => changePreset(value, mode)}>{label}</button>)}
          </div>
        </div>
        <div className={styles.captureSwitchSection}>
          <span className={styles.captureSwitchLabel}><b>2</b>{text.capturePerks}</span>
          <div className={styles.captureSwitchGroup} role="group" aria-label={text.capturePerks}>
            {['noUltimate', 'singleUltimate', 'doubleUltimate'].map(value => <button type="button" key={value} disabled={disabled}
              className={mode === value ? styles.captureLayoutActive : ''} aria-pressed={mode === value}
              onClick={() => changePreset(aspect, value)}>{text[value]}</button>)}
          </div>
        </div>
      </div>
      <div className={styles.calibrationTabs}>
        {targets.map(([value, label]) => <button type="button" key={value} disabled={disabled}
          className={activePanel === value && fieldsOpen ? styles.calibrationActive : ''}
          aria-expanded={activePanel === value && fieldsOpen} aria-controls="owbt-crop-parameter-fields"
          onClick={() => togglePanel(value)}>
          <span>{label}</span><b className={styles.calibrationDisclosureIcon} aria-hidden="true">{activePanel === value && fieldsOpen ? '−' : '+'}</b>
        </button>)}
      </div>
      {fieldsOpen && <>
        <fieldset className={styles.cropGrid} id="owbt-crop-parameter-fields" disabled={disabled}>
          <legend className={styles.hiddenLegend}>{targets.find(([value]) => value === activePanel)?.[1]}</legend>
          {fields[activePanel].map(([key, label, hint]) => <label key={key} title={hint}>
            <span>{label}</span><input type="number" min={key === 'scale' ? 1 : undefined} step={key === 'threshold' ? 1 : 'any'}
              value={key.startsWith('time') ? timeCrop[key] : capture[key]} onChange={event => onUpdateCapture({ [key]: event.target.value })} />
          </label>)}
        </fieldset>
        <button type="button" className={styles.resetCropBtn} disabled={disabled} onClick={onResetCrop}>{text.resetCrop}</button>
        <p className={styles.calibrationHint}>{activePanel === 'processing' ? text.cropProcessingHint : text.calibrationHint}</p>
      </>}
    </div>
  )
}

export default StatsCaptureCalibration
