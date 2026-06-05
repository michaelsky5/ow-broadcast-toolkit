export const clamp = (value, min = 0, max = 255) => Math.min(max, Math.max(min, value))

export const normalizeHex = hex => {
  const value = String(hex || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase()
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value.toUpperCase()}`
  return '#FFD84A'
}

export const hexToRgb = hex => {
  const value = normalizeHex(hex).replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  }
}

export const rgbToHex = ({ r, g, b }) => {
  const toHex = v => clamp(Math.round(v)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export const alpha = (hex, opacity = 1) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export const mix = (hexA, hexB, weight = 0.5) => {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const w = Math.min(1, Math.max(0, weight))

  return rgbToHex({
    r: a.r * (1 - w) + b.r * w,
    g: a.g * (1 - w) + b.g * w,
    b: a.b * (1 - w) + b.b * w
  })
}

export const lighten = (hex, weight = 0.2) => mix(hex, '#FFFFFF', weight)
export const darken = (hex, weight = 0.2) => mix(hex, '#000000', weight)