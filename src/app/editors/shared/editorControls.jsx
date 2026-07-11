import styles from './SceneEditor.styles.js'

function Field({ label, children, wide = false }) {
  return (
    <label className={`${styles.field} ${wide ? styles.wide : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange, language, className = '' }) {
  const isChinese = language
    ? language === 'zh'
    : /[\u3400-\u9fff]/u.test(String(label || ''))
  const stateLabel = isChinese
    ? (checked ? '\u5f00' : '\u5173')
    : (checked ? 'ON' : 'OFF')

  return (
    <button
      type="button"
      className={[
        styles.stateToggle,
        checked ? styles.stateToggleActive : '',
        className
      ].filter(Boolean).join(' ')}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <strong>{stateLabel}</strong>
    </button>
  )
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelTitle}>{title}</div>
      {children}
    </section>
  )
}

function EditorDialog({
  title,
  kicker = 'System',
  message,
  tone = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}) {
  return (
    <div className={styles.editorDialogBackdrop} role="presentation">
      <section
        className={`${styles.editorDialog} ${tone === 'danger' ? styles.editorDialogDanger : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className={styles.editorDialogHeader}>
          <div>
            <span>{kicker}</span>
            <strong>{title}</strong>
          </div>
        </header>
        <div className={styles.editorDialogBody}>
          <p>{message}</p>
        </div>
        <footer className={styles.editorDialogActions}>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button type="button" className={tone === 'danger' ? styles.dangerButton : styles.primaryButton} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}

function SegmentedControl({ value, options, onChange }) {
  return (
    <div className={styles.segmented}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          className={value === option.value ? styles.activeSegment : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, min = 1, max = 9, onChange }) {
  const numericValue = Number(value) || min

  return (
    <div className={styles.stepper}>
      <button type="button" onClick={() => onChange(Math.max(min, numericValue - 1))}>-</button>
      <strong>{numericValue}</strong>
      <button type="button" onClick={() => onChange(Math.min(max, numericValue + 1))}>+</button>
    </div>
  )
}

export {
  EditorDialog,
  Field,
  ToggleField,
  Panel,
  SegmentedControl,
  Stepper
}
