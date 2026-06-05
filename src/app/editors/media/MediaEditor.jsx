import { useEffect, useRef, useState } from 'react'
import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel, SegmentedControl, ToggleField } from '../shared/editorControls'
import { getPageEditorCopy } from '../shared/editorCopy'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'

const VIDEO_RENDER_OPTIONS = [
  { value: 'WEB', labelKey: 'toolkitPlayback' },
  { value: 'OBS_LOCAL', labelKey: 'obsSource' }
]

const clean = value => String(value || '').trim()
const normalizeMode = value => String(value || '').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'
const getVideoLibrary = settings => Array.isArray(settings.videoLibrary) ? settings.videoLibrary : []
const getVideoPlaylist = settings => Array.isArray(settings.videoPlaylist) ? settings.videoPlaylist : []
const getDisplayNameFromPath = (path, fallback = 'Video Source') => {
  const cleanPath = clean(path)
  if (!cleanPath) return fallback

  const withoutQuery = cleanPath.split('?')[0]
  const fileName = withoutQuery.split(/[\\/]/).filter(Boolean).pop()
  return fileName || fallback
}

const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

function MediaEditor({ project, language = 'en', onUpdateProject }) {
  const pageText = getPageEditorCopy(language)
  const settings = getSceneSettings(project, 'media')
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [newVideoName, setNewVideoName] = useState('')
  const [newVideoPath, setNewVideoPath] = useState('')
  const mode = normalizeMode(settings.mode)
  const isVideoMode = mode === 'VIDEO'
  const sourceUrl = clean(settings.sourceUrl)
  const activeVideoPath = clean(settings.activeVideoPath)
  const hasLegacySource = sourceUrl && !activeVideoPath
  const videoLibrary = getVideoLibrary(settings)
  const videoPlaylist = getVideoPlaylist(settings)
  const renderMode = settings.videoRenderMode || 'WEB'
  const sourceDisplay = activeVideoPath
  const videoRenderOptions = VIDEO_RENDER_OPTIONS.map(option => ({
    value: option.value,
    label: pageText[option.labelKey]
  }))

  const updateMediaSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureSceneSettings(draft, 'media'), patch)
    })
  }

  const addVideoToLibrary = (path, name = '') => {
    const cleanPath = clean(path)
    if (!cleanPath || videoLibrary.some(item => item.path === cleanPath)) return videoLibrary

    return [
      ...videoLibrary,
      {
        name: clean(name) || getDisplayNameFromPath(cleanPath, pageText.defaultVideoSource),
        path: cleanPath
      }
    ]
  }

  const applyMediaFile = async file => {
    if (!isVideoMode || !file || !file.type.startsWith('video/')) return
    const dataUrl = await fileToDataUrl(file)
    const patch = {
      mode: 'VIDEO',
      sourceUrl: dataUrl,
      sourceName: file.name,
      sourceType: file.type,
      activeVideoPath: dataUrl,
      videoLibrary: addVideoToLibrary(dataUrl, file.name)
    }

    updateMediaSettings(patch)
  }

  const clearSource = () => {
    updateMediaSettings({
      sourceUrl: '',
      sourceName: '',
      sourceType: '',
      ...(isVideoMode ? { activeVideoPath: '' } : {})
    })
  }

  const updateActiveVideoPath = value => {
    updateMediaSettings({
      activeVideoPath: value,
      sourceUrl: value,
      sourceName: '',
      sourceType: value ? 'video/manual' : ''
    })
  }

  const registerVideo = () => {
    const path = clean(newVideoPath)
    if (!path) return

    const name = clean(newVideoName) || getDisplayNameFromPath(path, pageText.defaultVideoSource)
    updateMediaSettings({
      videoLibrary: addVideoToLibrary(path, name)
    })
    setNewVideoName('')
    setNewVideoPath('')
  }

  const deleteVideo = index => {
    const item = videoLibrary[index]
    if (!item) return

    updateMediaSettings({
      videoLibrary: videoLibrary.filter((_, itemIndex) => itemIndex !== index),
      videoPlaylist: videoPlaylist.filter(path => path !== item.path),
      activeVideoPath: activeVideoPath === item.path ? '' : activeVideoPath,
      sourceUrl: sourceUrl === item.path ? '' : sourceUrl
    })
  }

  const addToPlaylist = path => {
    if (!path || videoPlaylist.includes(path)) return
    updateMediaSettings({ videoPlaylist: [...videoPlaylist, path] })
  }

  const removeFromPlaylist = index => {
    const nextPlaylist = [...videoPlaylist]
    nextPlaylist.splice(index, 1)
    updateMediaSettings({ videoPlaylist: nextPlaylist })
  }

  const movePlaylistItem = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= videoPlaylist.length) return

    const nextPlaylist = [...videoPlaylist]
    ;[nextPlaylist[index], nextPlaylist[targetIndex]] = [nextPlaylist[targetIndex], nextPlaylist[index]]
    updateMediaSettings({ videoPlaylist: nextPlaylist })
  }

  const playNow = path => {
    updateMediaSettings({
      activeVideoPath: path,
      sourceUrl: path,
      sourceName: getDisplayNameFromPath(path, pageText.defaultVideoSource),
      sourceType: 'video/manual',
      mode: 'VIDEO'
    })
  }

  const startQueue = () => {
    if (!videoPlaylist.length) return
    playNow(videoPlaylist[0])
  }

  const useLegacySource = () => {
    if (!sourceUrl) return

    updateMediaSettings({
      activeVideoPath: sourceUrl,
      sourceName: settings.sourceName || getDisplayNameFromPath(sourceUrl, pageText.defaultVideoSource),
      sourceType: settings.sourceType || 'video/manual',
      mode: 'VIDEO',
      videoLibrary: addVideoToLibrary(sourceUrl, settings.sourceName || getDisplayNameFromPath(sourceUrl, pageText.defaultVideoSource))
    })
  }

  const getVideoName = path => videoLibrary.find(item => item.path === path)?.name || getDisplayNameFromPath(path, pageText.defaultVideoSource)

  useEffect(() => {
    const handlePaste = event => {
      if (!isVideoMode) return

      const activeElement = document.activeElement
      const activeTag = activeElement?.tagName?.toLowerCase()
      const isTypingTarget = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || activeElement?.isContentEditable

      if (isTypingTarget) return

      const items = event.clipboardData?.items || []
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('video/')) {
          applyMediaFile(item.getAsFile())
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  })

  if (!isVideoMode) {
    return (
      <div className={`${styles.mediaWorkbench} ${styles.mediaHighlightWorkbench}`}>
        <Panel title={pageText.highlightOutput} className={styles.mediaPackagePanel}>
          <div className={styles.mediaHighlightOptions}>
            <ToggleField
              label={pageText.showLabel}
              checked={settings.showHighlightLabel !== false}
              onChange={checked => updateMediaSettings({ showHighlightLabel: checked })}
            />

            <Field label={pageText.highlightLabel}>
              <input value={settings.highlightLabel || ''} onChange={event => updateMediaSettings({ highlightLabel: event.target.value })} placeholder="HIGHLIGHT" />
            </Field>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className={styles.mediaWorkbench}>
      <Panel title={pageText.videoControl} className={styles.mediaControlPanel}>
        <button
          type="button"
          className={`${styles.mediaDropzone} ${isDragging ? styles.mediaDropzoneActive : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={event => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={event => {
            event.preventDefault()
            setIsDragging(false)
            applyMediaFile(event.dataTransfer.files?.[0])
          }}
        >
          {sourceDisplay ? (
            <span>
              <strong>{getVideoName(sourceDisplay)}</strong>
              <em>{pageText.activeVideoSource}</em>
            </span>
          ) : (
            <span>
              <strong>{pageText.uploadDropPasteVideo}</strong>
              <em>{pageText.videoSource}</em>
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={event => {
            applyMediaFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <Field label={pageText.activeVideoPath}>
          <input
            value={activeVideoPath}
            onChange={event => updateActiveVideoPath(event.target.value)}
            placeholder="/media/highlight.mp4"
          />
        </Field>

        {hasLegacySource && (
          <div className={styles.mediaLegacySource}>
            <div>
              <strong>{pageText.legacySource}</strong>
              <span>{sourceUrl}</span>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={useLegacySource}>
              {pageText.useSource}
            </button>
          </div>
        )}

        <div className={styles.mediaSourceActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>
            {pageText.selectFile}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={!sourceDisplay} onClick={clearSource}>
            {pageText.clear}
          </button>
        </div>

          <div className={styles.mediaVideoControls}>
            <div className={styles.mediaModeControl}>
              <span>{pageText.renderMode}</span>
              <SegmentedControl
                value={renderMode}
                options={videoRenderOptions}
                onChange={value => updateMediaSettings({ videoRenderMode: value })}
              />
            </div>
            <ToggleField
              label={pageText.muted}
              checked={settings.muted !== false}
              onChange={checked => updateMediaSettings({ muted: checked })}
            />
            <ToggleField
              label={pageText.loop}
              checked={settings.loop !== false}
              onChange={checked => updateMediaSettings({ loop: checked })}
            />
          </div>

          <div className={styles.mediaStatusStrip}>
            <div>
              <span>{pageText.mode}</span>
              <strong>{pageText.mediaModeLabel(mode)}</strong>
            </div>
            <div>
              <span>{pageText.active}</span>
              <strong>{sourceDisplay ? pageText.ready : pageText.empty}</strong>
            </div>
            <div>
              <span>{pageText.queue}</span>
              <strong>{videoPlaylist.length}</strong>
            </div>
          </div>
      </Panel>

      <Panel title={pageText.cleanVideoQueue} className={styles.mediaPackagePanel}>
        <div className={styles.mediaVideoHeader}>
          <div>
            <span>{pageText.queued(videoPlaylist.length)}</span>
            <strong>{activeVideoPath ? getVideoName(activeVideoPath) : pageText.noActiveVideo}</strong>
          </div>
          <div className={styles.mediaVideoHeaderActions}>
            <button type="button" className={styles.primaryButton} disabled={!videoPlaylist.length} onClick={startQueue}>
              {pageText.startQueue}
            </button>
          </div>
        </div>

        <div className={styles.mediaRegisterVideo}>
          <Field label={pageText.videoName}>
            <input
              value={newVideoName}
              onChange={event => setNewVideoName(event.target.value)}
              placeholder="PROMO / MAP RECAP"
            />
          </Field>
          <Field label={pageText.videoPath}>
            <input
              value={newVideoPath}
              onChange={event => setNewVideoPath(event.target.value)}
              placeholder="/media/video.mp4"
            />
          </Field>
          <button type="button" className={styles.secondaryButton} disabled={!clean(newVideoPath)} onClick={registerVideo}>
            {pageText.addVideo}
          </button>
        </div>

        <div className={styles.mediaVideoGrid}>
          <section className={styles.mediaVideoSection}>
            <div className={styles.mediaVideoSectionTitle}>
              <span>{pageText.playlist}</span>
              <strong>{pageText.playbackOrder}</strong>
            </div>

            <div className={styles.mediaList}>
              {videoPlaylist.map((path, index) => {
                const isActive = activeVideoPath === path

                return (
                  <article key={`${path}-${index}`} className={`${styles.mediaListItem} ${isActive ? styles.mediaListItemActive : ''}`}>
                    <div className={styles.mediaItemHeader}>
                      <b>{index + 1}</b>
                      <div>
                        <strong>{getVideoName(path)}</strong>
                        <span>{path}</span>
                      </div>
                    </div>
                    <div className={styles.mediaItemActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => playNow(path)}>
                        {isActive ? pageText.playing : pageText.play}
                      </button>
                      <button type="button" className={styles.secondaryButton} disabled={index === 0} onClick={() => movePlaylistItem(index, -1)}>
                        {pageText.up}
                      </button>
                      <button type="button" className={styles.secondaryButton} disabled={index === videoPlaylist.length - 1} onClick={() => movePlaylistItem(index, 1)}>
                        {pageText.down}
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={() => removeFromPlaylist(index)}>
                        {pageText.remove}
                      </button>
                    </div>
                  </article>
                )
              })}

              {!videoPlaylist.length && (
                <div className={styles.mediaEmptyState}>
                  <strong>{pageText.noPlaylistItems}</strong>
                  <span>{pageText.noPlaylistItemsHint}</span>
                </div>
              )}
            </div>
          </section>

          <section className={styles.mediaVideoSection}>
            <div className={styles.mediaVideoSectionTitle}>
              <span>{pageText.library}</span>
              <strong>{pageText.registeredSources}</strong>
            </div>

            <div className={styles.mediaList}>
              {videoLibrary.map((item, index) => {
                const isActive = activeVideoPath === item.path
                const isQueued = videoPlaylist.includes(item.path)

                return (
                  <article key={`${item.path}-${index}`} className={`${styles.mediaListItem} ${isActive ? styles.mediaListItemActive : ''}`}>
                    <div className={styles.mediaItemHeader}>
                      <b>{isActive ? pageText.on : index + 1}</b>
                      <div>
                        <strong>{item.name || getDisplayNameFromPath(item.path, pageText.defaultVideoSource)}</strong>
                        <span>{item.path}</span>
                      </div>
                    </div>
                    <div className={styles.mediaItemActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => playNow(item.path)}>
                        {pageText.play}
                      </button>
                      <button type="button" className={styles.secondaryButton} disabled={isQueued} onClick={() => addToPlaylist(item.path)}>
                        {isQueued ? pageText.queuedState : pageText.queueVerb}
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={() => deleteVideo(index)}>
                        {pageText.delete}
                      </button>
                    </div>
                  </article>
                )
              })}

              {!videoLibrary.length && (
                <div className={styles.mediaEmptyState}>
                  <strong>{pageText.noRegisteredVideos}</strong>
                  <span>{pageText.noRegisteredVideosHint}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </Panel>
    </div>
  )
}

export default MediaEditor
