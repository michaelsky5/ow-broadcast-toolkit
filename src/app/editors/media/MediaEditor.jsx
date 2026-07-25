import { useEffect, useRef, useState } from 'react'
import styles from '../shared/SceneEditor.styles.js'
import { Field, Panel, SegmentedControl, ToggleField } from '../shared/editorControls'
import { getPageEditorCopy } from '../shared/editorCopy'
import { ensureSceneSettings, getSceneSettings } from '../shared/editorHelpers'
import {
  hasEmbeddedVideoReferences,
  isEmbeddedVideoSource,
  removeEmbeddedVideoReferences
} from '../../../project/projectMediaSafety'

const VIDEO_RENDER_OPTIONS = [
  { value: 'WEB', labelKey: 'toolkitPlayback' },
  { value: 'OBS_LOCAL', labelKey: 'obsSource' }
]

const clean = value => String(value || '').trim()
const normalizeMode = value => String(value || '').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'
const getVideoLibrary = settings => (Array.isArray(settings.videoLibrary) ? settings.videoLibrary : [])
  .filter(item => item && typeof item === 'object')
const getVideoPlaylist = settings => (Array.isArray(settings.videoPlaylist) ? settings.videoPlaylist : [])
  .map(clean)
  .filter(Boolean)
const getDisplayNameFromPath = (path, fallback = 'Video Source') => {
  const cleanPath = clean(path)
  if (!cleanPath) return fallback

  const withoutQuery = cleanPath.split('?')[0]
  const fileName = withoutQuery.split(/[\\/]/).filter(Boolean).pop()
  return fileName || fallback
}

const MEDIA_SOURCE_SAFETY_COPY = {
  zh: {
    legacyEmbeddedTitle: '检测到旧版内嵌视频',
    legacyEmbeddedMessage: '此项目包含旧版 Data/Blob 视频。为避免丢失，OWBT 会继续原样保留；替换为 HTTPS 地址后，可从编辑与播出状态中主动移除这些内嵌项。',
    removeEmbedded: '从编辑与播出中移除',
    embeddedPathLabel: '旧版内嵌视频（内容已隐藏）',
    remoteOnlyTitle: '使用 HTTPS 视频地址',
    remoteOnlyHint: '本地文件不会被读取或写入项目',
    localFileDisabled: '本地上传已禁用',
    localFileTitle: '本地视频已阻止',
    localFileMessage: '为避免浏览器存储溢出，OWBT 不会读取或保存本地视频文件。请先将视频上传到可访问的 HTTPS 地址，再粘贴 URL。',
    embeddedSourceTitle: '已阻止内嵌视频',
    embeddedSourceMessage: '新的 Data/Blob 视频会造成浏览器存储膨胀，因此不能添加。请改用可访问的 HTTPS 地址。',
    dismiss: '知道了'
  },
  en: {
    legacyEmbeddedTitle: 'Legacy embedded video detected',
    legacyEmbeddedMessage: 'This project contains legacy Data/Blob video. OWBT will preserve it to prevent data loss. Replace it with an HTTPS URL, then explicitly remove the embedded entries from both Edit and Program.',
    removeEmbedded: 'Remove from Edit and Program',
    embeddedPathLabel: 'Legacy embedded video (content hidden)',
    remoteOnlyTitle: 'Use an HTTPS video URL',
    remoteOnlyHint: 'Local files are never read or stored in the project',
    localFileDisabled: 'Local upload disabled',
    localFileTitle: 'Local video blocked',
    localFileMessage: 'To prevent browser storage overflow, OWBT does not read or save local video files. Upload the video to an accessible HTTPS URL, then paste that URL.',
    embeddedSourceTitle: 'Embedded video blocked',
    embeddedSourceMessage: 'New Data and Blob video URLs are not accepted because they can overflow browser storage. Use an accessible HTTPS URL instead.',
    dismiss: 'Dismiss'
  }
}

function MediaEditor({ project, language = 'en', onUpdateProject }) {
  const pageText = getPageEditorCopy(language)
  const safetyCopy = MEDIA_SOURCE_SAFETY_COPY[String(language).toLowerCase().startsWith('zh') ? 'zh' : 'en']
  const settings = getSceneSettings(project, 'media')
  const hasUnsafeStoredReferences = hasEmbeddedVideoReferences(settings)
  const activeVideoInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [newVideoName, setNewVideoName] = useState('')
  const [newVideoPath, setNewVideoPath] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
  const mode = normalizeMode(settings.mode)
  const isVideoMode = mode === 'VIDEO'
  const sourceUrl = clean(settings.sourceUrl)
  const activeVideoPath = clean(settings.activeVideoPath)
  const hasLegacySource = sourceUrl && !activeVideoPath
  const videoLibrary = getVideoLibrary(settings)
  const videoPlaylist = getVideoPlaylist(settings)
  const renderMode = settings.videoRenderMode || 'WEB'
  const sourceDisplay = activeVideoPath
  const visibleSourceNotice = sourceNotice || (hasUnsafeStoredReferences ? 'legacyEmbedded' : '')
  const videoRenderOptions = VIDEO_RENDER_OPTIONS.map(option => ({
    value: option.value,
    label: pageText[option.labelKey]
  }))

  const updateMediaSettings = patch => {
    onUpdateProject(draft => {
      const mediaSettings = ensureSceneSettings(draft, 'media')
      Object.assign(mediaSettings, patch)
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

  const rejectLocalMediaFile = file => {
    if (!isVideoMode || !file) return
    setSourceNotice('local')
    activeVideoInputRef.current?.focus()
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
    if (isEmbeddedVideoSource(value)) {
      setSourceNotice('blockedEmbedded')
      return
    }

    setSourceNotice('')
    updateMediaSettings({
      activeVideoPath: value,
      sourceUrl: '',
      sourceName: '',
      sourceType: value ? 'video/manual' : ''
    })
  }

  const registerVideo = () => {
    const path = clean(newVideoPath)
    if (!path) return
    if (isEmbeddedVideoSource(path)) {
      setSourceNotice('blockedEmbedded')
      return
    }

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
      sourceUrl: '',
      sourceName: getVideoName(path),
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
    const legacySourceName = settings.sourceName || (
      isEmbeddedVideoSource(sourceUrl)
        ? safetyCopy.embeddedPathLabel
        : getDisplayNameFromPath(sourceUrl, pageText.defaultVideoSource)
    )

    updateMediaSettings({
      activeVideoPath: sourceUrl,
      sourceUrl: '',
      sourceName: legacySourceName,
      sourceType: settings.sourceType || 'video/manual',
      mode: 'VIDEO',
      ...(
        isEmbeddedVideoSource(sourceUrl)
          ? {}
          : { videoLibrary: addVideoToLibrary(sourceUrl, legacySourceName) }
      )
    })
  }

  const removeLegacyEmbeddedMedia = () => {
    onUpdateProject(draft => {
      const mediaSettings = ensureSceneSettings(draft, 'media')
      Object.assign(mediaSettings, removeEmbeddedVideoReferences(mediaSettings))
    }, {
      undoReason: 'REMOVE EMBEDDED MEDIA',
      live: true
    })
    setSourceNotice('')
  }

  const getVideoName = path => {
    const registeredName = videoLibrary.find(item => item.path === path)?.name
    if (registeredName) return registeredName
    if (isEmbeddedVideoSource(path)) return settings.sourceName || safetyCopy.embeddedPathLabel
    return getDisplayNameFromPath(path, pageText.defaultVideoSource)
  }

  const getVideoPathLabel = path => (
    isEmbeddedVideoSource(path) ? safetyCopy.embeddedPathLabel : path
  )

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
          event.preventDefault()
          setSourceNotice('local')
          activeVideoInputRef.current?.focus()
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [isVideoMode])

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
          {hasUnsafeStoredReferences && (
            <div className={styles.mediaLegacySource} role="alert" aria-live="assertive">
              <div>
                <strong>{safetyCopy.legacyEmbeddedTitle}</strong>
                <span style={{ overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal' }}>
                  {safetyCopy.legacyEmbeddedMessage}
                </span>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={removeLegacyEmbeddedMedia}>
                {safetyCopy.removeEmbedded}
              </button>
            </div>
          )}
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
          onClick={() => {
            setSourceNotice('local')
            activeVideoInputRef.current?.focus()
          }}
          onDragOver={event => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={event => {
            event.preventDefault()
            setIsDragging(false)
            rejectLocalMediaFile(event.dataTransfer.files?.[0])
          }}
        >
          {sourceDisplay ? (
            <span>
              <strong>{getVideoName(sourceDisplay)}</strong>
              <em>{pageText.activeVideoSource}</em>
            </span>
          ) : (
            <span>
              <strong>{safetyCopy.remoteOnlyTitle}</strong>
              <em>{safetyCopy.remoteOnlyHint}</em>
            </span>
          )}
        </button>

        <Field label={pageText.activeVideoPath}>
          <input
            ref={activeVideoInputRef}
            value={isEmbeddedVideoSource(activeVideoPath) ? '' : activeVideoPath}
            onChange={event => updateActiveVideoPath(event.target.value)}
            placeholder={isEmbeddedVideoSource(activeVideoPath)
              ? safetyCopy.embeddedPathLabel
              : renderMode === 'WEB'
                ? 'https://cdn.example.com/highlight.mp4'
                : 'C:\\media\\highlight.mp4'}
          />
        </Field>

        {visibleSourceNotice && (
          <div className={styles.mediaLegacySource} role="alert" aria-live="assertive">
            <div>
              <strong>{
                visibleSourceNotice === 'legacyEmbedded'
                  ? safetyCopy.legacyEmbeddedTitle
                  : visibleSourceNotice === 'blockedEmbedded'
                    ? safetyCopy.embeddedSourceTitle
                    : safetyCopy.localFileTitle
              }</strong>
              <span style={{ overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal' }}>
                {
                  visibleSourceNotice === 'legacyEmbedded'
                    ? safetyCopy.legacyEmbeddedMessage
                    : visibleSourceNotice === 'blockedEmbedded'
                      ? safetyCopy.embeddedSourceMessage
                      : safetyCopy.localFileMessage
                }
              </span>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={visibleSourceNotice === 'legacyEmbedded'
                ? removeLegacyEmbeddedMedia
                : () => setSourceNotice('')}
            >
              {visibleSourceNotice === 'legacyEmbedded' ? safetyCopy.removeEmbedded : safetyCopy.dismiss}
            </button>
          </div>
        )}

        {hasLegacySource && (
          <div className={styles.mediaLegacySource}>
            <div>
              <strong>{pageText.legacySource}</strong>
              <span>{getVideoPathLabel(sourceUrl)}</span>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={useLegacySource}>
              {pageText.useSource}
            </button>
          </div>
        )}

        <div className={styles.mediaSourceActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setSourceNotice('local')
              activeVideoInputRef.current?.focus()
            }}
          >
            {safetyCopy.localFileDisabled}
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
                        <span>{getVideoPathLabel(path)}</span>
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
                        <strong>{getVideoName(item.path)}</strong>
                        <span>{getVideoPathLabel(item.path)}</span>
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
