import { useState } from 'react'
import styles from './shared/SceneEditor.styles.js'
import CastersEditor from './casters/CastersEditor'
import CountdownEditor from './show-package/CountdownEditor'
import CurrentMapEditor from './map-setup/CurrentMapEditor'
import GenericSceneEditor from './shared/GenericSceneEditor'
import LiveHudEditor from './live/LiveHudEditor'
import MatchupEditor from './show-package/MatchupEditor'
import MediaEditor from './media/MediaEditor'
import MvpEditor from './data-center/MvpEditor'
import PauseEditor from './post/PauseEditor'
import ResultEditor from './post/ResultEditor'
import RosterEditor from './roster/RosterEditor'
import ShowPackageTabs from './show-package/ShowPackageTabs'
import StartingFiveEditor from './roster/StartingFiveEditor'
import StatsEditor from './data-center/StatsEditor'
import TeamDataEditor from './data-center/TeamDataEditor'
import ThanksEditor from './post/ThanksEditor'
import { getEditorChromeCopy, getEditorCopy } from './shared/editorCopy'

const getMapEditorMode = project => {
  const displayMode = project.scenes?.settings?.['current-map']?.displayMode ||
    project.scenes?.settings?.['current-map']?.mapPoolDisplayMode

  return displayMode === 'OVERVIEW' ? 'pool' : 'flow'
}

const getCasterEditorMode = project => (
  project.scenes?.settings?.casters?.packageMode === 'STAFF' ? 'staff' : 'casters'
)

export default function SceneEditor({
  project,
  scene,
  copy,
  language,
  statusOptions,
  onUpdateProject,
  onSelectScene,
  onAutoTakeScene,
  onTakeToProgram,
  sceneModeHints,
  onSceneModeHintChange,
  onPushLog,
  canTakeToProgram
}) {
  const [casterEditorMode, setCasterEditorMode] = useState(() => getCasterEditorMode(project))
  const [liveEditorMode, setLiveEditorMode] = useState(() => sceneModeHints?.['live-hud'] || 'match')
  const [mapEditorMode, setMapEditorMode] = useState(() => getMapEditorMode(project))
  const [rosterEditorMode, setRosterEditorMode] = useState(() => sceneModeHints?.roster || 'roster')
  const text = getEditorCopy(language)
  const chrome = getEditorChromeCopy(language)
  const isShowFlowScene = ['matchup', 'starting-five', 'result', 'thanks'].includes(scene.id)
  const isBreakDeskScene = ['countdown', 'pause'].includes(scene.id)
  const isDataCenterScene = ['stats', 'team-data', 'mvp'].includes(scene.id)
  const activeEditorSceneId = scene.id
  const editorModeTabs = isShowFlowScene
    ? chrome.showFlowModes
    : isBreakDeskScene
      ? chrome.breakDeskModes
    : isDataCenterScene
      ? chrome.dataCenterModes
      : null
  const editorModeTabsClassName = isShowFlowScene
    ? styles.showFlowHeaderTabs
    : isBreakDeskScene
      ? styles.breakHeaderTabs
      : ''
  const editorTitle = chrome.titles[activeEditorSceneId] || text.sceneDesk

  const selectMapEditorMode = modeId => {
    const nextMode = modeId === 'pool' ? 'pool' : 'flow'
    setMapEditorMode(nextMode)
    onUpdateProject(draft => {
      if (!draft.scenes.settings['current-map']) draft.scenes.settings['current-map'] = {}
      draft.scenes.settings['current-map'].displayMode = nextMode === 'pool' ? 'OVERVIEW' : 'MATCH'
    })
  }

  const selectCasterEditorMode = mode => {
    setCasterEditorMode(mode.id)
    if (!mode.packageMode) return

    onUpdateProject(draft => {
      if (!draft.scenes.settings.casters) draft.scenes.settings.casters = {}
      draft.scenes.settings.casters.packageMode = mode.packageMode
    })
  }

  const selectMediaEditorMode = modeId => {
    onUpdateProject(draft => {
      if (!draft.scenes.settings.media) draft.scenes.settings.media = {}
      draft.scenes.settings.media.mode = modeId === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'
    })
  }

  const selectLiveEditorMode = modeId => {
    const nextMode = modeId === 'package' ? 'package' : 'match'
    setLiveEditorMode(nextMode)
    onSceneModeHintChange?.('live-hud', nextMode)
  }

  const selectRosterEditorMode = modeId => {
    const nextMode = modeId === 'teams' ? 'teams' : 'roster'
    setRosterEditorMode(nextMode)
    onSceneModeHintChange?.('roster', nextMode)
  }

  return (
    <section className={styles.editorRoot}>
      <header className={styles.editorHeader}>
        <div>
          <span>{text.editor}</span>
          <h3>{editorTitle}</h3>
        </div>
        <div className={styles.editorHeaderActions}>
          {editorModeTabs && (
            <ShowPackageTabs
              compact
              modes={editorModeTabs}
              scene={{ id: activeEditorSceneId }}
              activeModeId={activeEditorSceneId}
              onSelectScene={onSelectScene}
              onSelectMode={onSelectScene}
              className={editorModeTabsClassName}
            />
          )}
          {scene.id === 'casters' && (
            <div className={`${styles.editorSceneTabs} ${styles.casterEditorTabs}`}>
              {chrome.casterModes.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    styles.showPackageModeButton,
                    casterEditorMode === mode.id ? styles.showPackageModeActive : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectCasterEditorMode(mode)}
                >
                  <span>{mode.label}</span>
                  <em>{mode.meta}</em>
                </button>
              ))}
            </div>
          )}
          {scene.id === 'live-hud' && (
            <div className={`${styles.editorSceneTabs} ${styles.liveHeaderTabs}`}>
              {chrome.liveModes.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    styles.showPackageModeButton,
                    liveEditorMode === mode.id ? styles.showPackageModeActive : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectLiveEditorMode(mode.id)}
                >
                  <span>{mode.label}</span>
                  <em>{mode.meta}</em>
                </button>
              ))}
            </div>
          )}
          {scene.id === 'current-map' && (
            <div className={`${styles.editorSceneTabs} ${styles.mapHeaderTabs}`}>
              {chrome.mapModes.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    styles.showPackageModeButton,
                    mapEditorMode === mode.id ? styles.showPackageModeActive : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectMapEditorMode(mode.id)}
                >
                  <span>{mode.label}</span>
                  <em>{mode.meta}</em>
                </button>
              ))}
            </div>
          )}
          {scene.id === 'roster' && (
            <div className={`${styles.editorSceneTabs} ${styles.rosterHeaderTabs}`}>
              {chrome.rosterModes.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  className={[
                    styles.showPackageModeButton,
                    rosterEditorMode === mode.id ? styles.showPackageModeActive : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectRosterEditorMode(mode.id)}
                >
                  <span>{mode.label}</span>
                  <em>{mode.meta}</em>
                </button>
              ))}
            </div>
          )}
          {scene.id === 'media' && (
            <div className={`${styles.editorSceneTabs} ${styles.mediaHeaderTabs}`}>
              {chrome.mediaModes.map(mode => {
                const activeMode = project.scenes?.settings?.media?.mode === 'VIDEO' ? 'VIDEO' : 'HIGHLIGHT'

                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={[
                      styles.showPackageModeButton,
                      activeMode === mode.id ? styles.showPackageModeActive : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => selectMediaEditorMode(mode.id)}
                  >
                    <span>{mode.label}</span>
                    <em>{mode.meta}</em>
                  </button>
                )
              })}
            </div>
          )}
          <button
            className={styles.editorTakeButton}
            disabled={!canTakeToProgram}
            onClick={onTakeToProgram}
            title={canTakeToProgram ? copy.takeToProgram : copy.alreadyOnProgram}
          >
            {chrome.take}
          </button>
        </div>
      </header>

      {activeEditorSceneId === 'matchup' && (
        <MatchupEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          statusOptions={statusOptions}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'starting-five' && (
        <StartingFiveEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'casters' && (
        <CastersEditor
          project={project}
          text={text}
          language={language}
          activeSection={casterEditorMode}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'roster' && (
        <RosterEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          activeSection={rosterEditorMode}
          onUpdateProject={onUpdateProject}
          onPushLog={onPushLog}
        />
      )}

      {activeEditorSceneId === 'stats' && (
        <StatsEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'current-map' && (
        <CurrentMapEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          activeSection={mapEditorMode}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'countdown' && (
        <CountdownEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'media' && (
        <MediaEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'team-data' && (
        <TeamDataEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'mvp' && (
        <MvpEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'live-hud' && (
        <LiveHudEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          activeSection={liveEditorMode}
          onUpdateProject={onUpdateProject}
          onSelectScene={onSelectScene}
          onAutoTakeScene={onAutoTakeScene}
        />
      )}

      {activeEditorSceneId === 'pause' && (
        <PauseEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          statusOptions={statusOptions}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'result' && (
        <ResultEditor
          project={project}
          copy={copy}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {activeEditorSceneId === 'thanks' && (
        <ThanksEditor
          project={project}
          text={text}
          language={language}
          onUpdateProject={onUpdateProject}
        />
      )}

      {![
        'matchup',
        'starting-five',
        'casters',
        'roster',
        'stats',
        'current-map',
        'countdown',
        'media',
        'team-data',
        'mvp',
        'live-hud',
        'pause',
        'result',
        'thanks'
      ].includes(activeEditorSceneId) && (
        <GenericSceneEditor project={project} scene={scene} text={text} onUpdateProject={onUpdateProject} />
      )}
    </section>
  )
}
