import editorShell from './styles/editorShell.module.css'
import showPackageNavigation from './styles/showPackageNavigation.module.css'
import sharedLayoutGrids from './styles/sharedLayoutGrids.module.css'
import statsCaptureAndMetrics from './styles/statsCaptureAndMetrics.module.css'
import teamDataEditor from './styles/teamDataEditor.module.css'
import statsSharedControls from './styles/statsSharedControls.module.css'
import mvpEditor from './styles/mvpEditor.module.css'
import statsDataStore from './styles/statsDataStore.module.css'
import statsCaptureModal from './styles/statsCaptureModal.module.css'
import matchupEditor from './styles/matchupEditor.module.css'
import sharedPanelsAndControls from './styles/sharedPanelsAndControls.module.css'
import liveHudEditor from './styles/liveHudEditor.module.css'
import mapSetupEditor from './styles/mapSetupEditor.module.css'
import castersEditor from './styles/castersEditor.module.css'
import rosterEditor from './styles/rosterEditor.module.css'
import postAndShowPackageEditors from './styles/postAndShowPackageEditors.module.css'
import mediaEditor from './styles/mediaEditor.module.css'
import responsiveOverrides from './styles/responsiveOverrides.module.css'

const mergeStyleModules = (...modules) => {
  const merged = {}

  modules.forEach(moduleStyles => {
    Object.entries(moduleStyles).forEach(([key, value]) => {
      merged[key] = merged[key]
        ? Array.from(new Set(`${merged[key]} ${value}`.split(' '))).join(' ')
        : value
    })
  })

  return merged
}

const styles = mergeStyleModules(
  editorShell,
  showPackageNavigation,
  sharedLayoutGrids,
  statsCaptureAndMetrics,
  teamDataEditor,
  statsSharedControls,
  mvpEditor,
  statsDataStore,
  statsCaptureModal,
  matchupEditor,
  sharedPanelsAndControls,
  liveHudEditor,
  mapSetupEditor,
  castersEditor,
  rosterEditor,
  postAndShowPackageEditors,
  mediaEditor,
  responsiveOverrides
)

export default styles
