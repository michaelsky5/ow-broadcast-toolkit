import { useEffect, useState } from 'react'
import { loadStoredProgramProject } from '../project/projectStorage'
import {
  getSessionIdFromLocation,
  subscribeSessionProgramState
} from '../project/projectSession'
import { subscribeProgramState } from '../project/projectSync'
import { normalizeProject } from '../project/projectUtils'
import { applyThemeTokens } from '../theme/themeTokens'
import {
  loadSceneTransitionSettings,
  normalizeSceneTransitionSettings
} from '../app/consolePreferences'
import ProgramPreview from './ProgramPreview'
import styles from './OverlayPage.module.css'

export default function OverlayPage() {
  const [sessionId] = useState(getSessionIdFromLocation)
  const [project, setProject] = useState(() => loadStoredProgramProject())
  const [transitionSettings, setTransitionSettings] = useState(loadSceneTransitionSettings)
  const [sessionPending, setSessionPending] = useState(Boolean(sessionId))
  const [sessionState, setSessionState] = useState(sessionId ? 'connecting' : 'local')

  useEffect(() => {
    applyThemeTokens(project.theme)
  }, [project.theme])

  useEffect(() => {
    if (sessionId) return undefined

    const syncTransitionSettings = () => {
      setTransitionSettings(loadSceneTransitionSettings())
    }

    window.addEventListener('storage', syncTransitionSettings)
    const timer = window.setInterval(syncTransitionSettings, 500)

    return () => {
      window.removeEventListener('storage', syncTransitionSettings)
      window.clearInterval(timer)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) return undefined

    return subscribeProgramState(setProject, {
      ignoreSource: 'overlay',
      pollInterval: 300
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return undefined

    return subscribeSessionProgramState(sessionId, (nextProject, payload) => {
      setSessionPending(false)
      setSessionState('online')
      setProject(normalizeProject(nextProject))
      setTransitionSettings(normalizeSceneTransitionSettings(payload.transitionSettings))
    }, {
      pollInterval: 1000,
      onStatus: status => {
        setSessionState(status.state)
      }
    })
  }, [sessionId])

  return (
    <main className={styles.overlay} data-session-state={sessionState}>
      {!sessionPending && (
        <ProgramPreview
          project={project}
          bare
          transitionMode={transitionSettings.sceneTransitionMode}
          transitionSpeed={transitionSettings.sceneTransitionSpeed}
          transitionLogo={transitionSettings.sceneTransitionLogo}
        />
      )}
    </main>
  )
}
