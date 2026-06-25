import { FRIES_CUP_CONFIG } from './config'

export const FRIES_CUP_THEME = {
  id: 'fries-cup-fixed',
  name: 'FriesCup Yellow',
  primary: FRIES_CUP_CONFIG.primaryColor,
  background: '#16130A',
  panel: '#211C10',
  panelSoft: '#2A2415',
  text: '#FFFFFF',
  mutedText: '#B8B0A0',
  border: 'rgba(255, 255, 255, 0.14)',
  danger: '#FF4D4D',
  blueSide: '#3B82F6',
  redSide: '#EF4444',

  backgroundImage: '',
  backgroundOpacity: 0.35,

  logoSize: 120,
  borderRadius: 8,
  glowStrength: 0.34,
  motionStrength: 1,

  fontFamily: '"HarmonyOS Sans SC", "HarmonyOS Sans", "MiSans", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

export const createFriesCupTheme = () => ({ ...FRIES_CUP_THEME })

