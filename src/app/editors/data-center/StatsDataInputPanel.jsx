import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel } from '../shared/editorControls'

function StatsDataInputPanel({
  displayMode,
  statsImage,
  isDraggingImage,
  setIsDraggingImage,
  imageInputRef,
  applyStatsImageFile,
  openCaptureModal,
  clearStatsImage,
  imageCrop,
  updateImageCrop,
  statsData,
  filledTeamARows,
  filledTeamBRows,
  text
}) {
  return (
    <Panel title={text.statsDataInput} className={styles.statsSourcePanel}>
      <button
        type="button"
        className={[
          styles.statsImageDropzone,
          statsImage ? styles.statsImageDropzoneReady : styles.statsImageDropzoneCompact,
          isDraggingImage ? styles.statsImageDropzoneActive : ''
        ].filter(Boolean).join(' ')}
        onClick={() => imageInputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault()
          setIsDraggingImage(true)
        }}
        onDragLeave={() => setIsDraggingImage(false)}
        onDrop={event => {
          event.preventDefault()
          setIsDraggingImage(false)
          applyStatsImageFile(event.dataTransfer.files?.[0])
        }}
      >
        {statsImage
          ? <img src={statsImage} alt="" />
          : (
            <span>
              <strong>{text.imageInput}</strong>
              <em>{text.uploadDropPaste}</em>
            </span>
          )}
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={event => {
          applyStatsImageFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      <div className={styles.statsCaptureActions}>
        <button type="button" className={styles.primaryButton} onClick={openCaptureModal}>
          {text.ocrCapture}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={clearStatsImage}>
          {text.clearImage}
        </button>
      </div>

      <details className={styles.statsAdvancedPanel}>
        <summary>{text.imageCrop}</summary>

        <div className={styles.statsCropGrid}>
          <Field label="X%">
            <input
              type="number"
              value={imageCrop.xPct}
              onChange={event => updateImageCrop({ xPct: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="W%">
            <input
              type="number"
              value={imageCrop.wPct}
              onChange={event => updateImageCrop({ wPct: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="H%">
            <input
              type="number"
              value={imageCrop.hPct}
              onChange={event => updateImageCrop({ hPct: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="Top%">
            <input
              type="number"
              value={imageCrop.topPct}
              onChange={event => updateImageCrop({ topPct: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="Bottom%">
            <input
              type="number"
              value={imageCrop.bottomPct}
              onChange={event => updateImageCrop({ bottomPct: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>
      </details>

      <div className={styles.statsSummary}>
        <div>
          <span>{text.input}</span>
          <strong>{statsImage ? text.imageReady : text.manual}</strong>
        </div>
        <div>
          <span>{text.preview}</span>
          <strong>{displayMode === 'image' ? text.imageMode : text.statsDataLabel(statsData)}</strong>
        </div>
        <div>
          <span>{text.rows}</span>
          <strong>{text.rowPairCount(filledTeamARows, filledTeamBRows)}</strong>
        </div>
      </div>
    </Panel>
  )
}

export default StatsDataInputPanel
