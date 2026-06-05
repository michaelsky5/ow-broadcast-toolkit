import { useCallback, useEffect, useRef, useState } from 'react'
import { loadStoredProgramProject, readStoredProgramProjectRaw } from '../project/projectStorage'
import { safeParseProject } from '../project/projectUtils'
import { subscribeProgramState } from '../project/projectSync'
import { applyThemeTokens } from '../theme/themeTokens'
import { loadSceneTransitionSettings } from '../app/consolePreferences'
import ProgramPreview from './ProgramPreview'
import styles from './OverlayPage.module.css'

export default function OverlayPage() {
  const [project, setProject] = useState(() => loadStoredProgramProject())
  const [transitionSettings, setTransitionSettings] = useState(loadSceneTransitionSettings)
  const lastRawRef = useRef(readStoredProgramProjectRaw())

  const applyRawProject = useCallback(raw => {
    if (!raw || raw === lastRawRef.current) return

    const nextProject = safeParseProject(raw)

    if (!nextProject) return

    lastRawRef.current = raw
    setProject(nextProject)
  }, [])

  useEffect(() => {
    applyThemeTokens(project.theme)
  }, [project.theme])

  useEffect(() => {
    const syncTransitionSettings = () => setTransitionSettings(loadSceneTransitionSettings())

    window.addEventListener('storage', syncTransitionSettings)
    const timer = window.setInterval(syncTransitionSettings, 500)

    return () => {
      window.removeEventListener('storage', syncTransitionSettings)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeProgramState(nextProject => {
      lastRawRef.current = readStoredProgramProjectRaw()
      setProject(nextProject)
    }, {
      ignoreSource: 'overlay',
      pollInterval: 300
    })

    const timer = window.setInterval(() => {
      applyRawProject(readStoredProgramProjectRaw())
    }, 300)

    return () => {
      unsubscribe?.()
      window.clearInterval(timer)
    }
  }, [applyRawProject])

  return (
    <main className={styles.overlay}>
      <ProgramPreview
        project={project}
        bare
        transitionMode={transitionSettings.sceneTransitionMode}
        transitionSpeed={transitionSettings.sceneTransitionSpeed}
        transitionLogo={transitionSettings.sceneTransitionLogo}
      />
    </main>
  )
}
