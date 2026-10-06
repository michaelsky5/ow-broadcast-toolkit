import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  CAPTURE_LAYOUT_PRESETS,
  DEFAULT_CAPTURE,
  getCaptureLayoutForParts,
  getCaptureLayoutParts,
  getCaptureLayoutPreset,
  normalizeCaptureConfig
} from '../src/project/statsCaptureConfig.js'
import { buildCropAssets, parseStatsLine, resolveTimeCrop } from '../src/app/editors/data-center/statsCaptureUtils.js'

const legacyCapture = {
  xPct: 49, topPct: 18.5, bottomPct: 55.5, wPct: 26.2, hPct: 28.5,
  playerXPct: 33.5, playerWPct: 9
}

test('all observer aspect/perk combinations round-trip to their own preset', () => {
  assert.equal(Object.keys(CAPTURE_LAYOUT_PRESETS).length, 6)
  for (const layout of Object.keys(CAPTURE_LAYOUT_PRESETS)) {
    const { aspect, mode } = getCaptureLayoutParts(layout)
    assert.equal(getCaptureLayoutForParts(aspect, mode), layout)
  }
  assert.equal(getCaptureLayoutPreset('spectatorNoUltimate').xPct, 46.5)
  assert.equal(getCaptureLayoutPreset('spectatorSingleUltimate').xPct, 48)
  assert.equal(DEFAULT_CAPTURE.xPct, 49)
  assert.deepEqual(getCaptureLayoutParts('unknown'), { aspect: 'standard', mode: 'doubleUltimate' })
})

test('old defaults migrate without losing the screenshot, timing, or OCR tuning', () => {
  const normalized = normalizeCaptureConfig({
    ...legacyCapture, imageDataUrl: 'saved-image', timeText: '6:22', dataMinutes: 6.366,
    threshold: 178, scale: 4
  })
  assert.equal(normalized.topPct, 17.5)
  assert.equal(normalized.bottomPct, 55)
  assert.equal(normalized.wPct, 25)
  assert.equal(normalized.topHPct, 30.4)
  assert.equal(normalized.playerXPct, 31)
  assert.equal(normalized.imageDataUrl, 'saved-image')
  assert.equal(normalized.timeText, '6:22')
  assert.equal(normalized.dataMinutes, 6.366)
  assert.equal(normalized.threshold, 178)
  assert.equal(normalized.scale, 4)
})

test('custom calibration survives migration and supplies both legacy team axes', () => {
  const normalized = normalizeCaptureConfig({ ...legacyCapture, xPct: 47, hPct: 29.8 })
  assert.equal(normalized.xPct, 47)
  assert.equal(normalized.topPct, 18.5)
  assert.equal(normalized.wPct, 26.2)
  assert.equal(normalized.topHPct, 29.8)
  assert.equal(normalized.bottomHPct, 29.8)
  assert.equal(normalized.bottomPlayerXPct, 33.5)
  assert.equal(normalizeCaptureConfig(null).captureLayout, DEFAULT_CAPTURE.captureLayout)
})

test('project loading migrates original capture values before defaults mask legacy axes', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false }
  })
  try {
    const { normalizeProject } = await server.ssrLoadModule('/src/project/projectUtils.js')
    const projectWithCapture = capture => ({ scenes: { settings: { stats: { capture } } } })
    const readCapture = project => project.scenes.settings.stats.capture
    const legacy = readCapture(normalizeProject(projectWithCapture({ ...legacyCapture, imageDataUrl: 'saved-image' })))
    assert.equal(legacy.topPct, 17.5)
    assert.equal(legacy.topHPct, 30.4)
    assert.equal(legacy.imageDataUrl, 'saved-image')
    const custom = readCapture(normalizeProject(projectWithCapture({ ...legacyCapture, xPct: 47, hPct: 29.8 })))
    assert.equal(custom.xPct, 47)
    assert.equal(custom.topHPct, 29.8)
    assert.equal(custom.bottomHPct, 29.8)
    assert.equal(custom.bottomPlayerXPct, 33.5)
    const preset = readCapture(normalizeProject(projectWithCapture({ captureLayout: 'spectatorSixteenTenNoUltimate' })))
    assert.equal(preset.xPct, 46.5)
    assert.equal(preset.topHPct, 27.5)
    assert.equal(preset.bottomHPct, 26.9)
  } finally {
    await server.close()
  }
})

test('previous timer crops upgrade to the System/FryDeck timer strip', () => {
  const expected = { timeXPct: 88, timeYPct: 1.2, timeWPct: 12, timeHPct: 5 }
  assert.deepEqual(resolveTimeCrop({ ...DEFAULT_CAPTURE, timeXPct: 66.8, timeYPct: 13.8, timeWPct: 8.4, timeHPct: 3.8 }), expected)
  assert.deepEqual(resolveTimeCrop({ ...DEFAULT_CAPTURE, timeXPct: 88, timeYPct: 2.5, timeWPct: 12, timeHPct: 15 }), expected)
  assert.equal(resolveTimeCrop({ ...DEFAULT_CAPTURE, timeXPct: 90 }).timeXPct, 90)
})

test('reported no-perks screenshot crops all six columns; 16:10 keeps separate team heights', async t => {
  const canvases = []
  const originals = { Image: globalThis.Image, document: globalThis.document }
  t.after(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })
  globalThis.Image = class {
    width = 1280
    height = 719
    set src(value) { this.onload(value) }
  }
  globalThis.document = {
    createElement() {
      const canvas = { width: 0, height: 0, calls: [] }
      const id = canvases.push(canvas) - 1
      canvas.getContext = () => ({
        drawImage: (...args) => canvas.calls.push(args.slice(1)),
        getImageData: () => ({ data: [] }),
        putImageData: () => {}
      })
      canvas.toDataURL = () => String(id)
      return canvas
    }
  }

  const assets = await buildCropAssets('source-image', { ...getCaptureLayoutPreset('spectatorNoUltimate'), captureLayout: 'spectatorNoUltimate' })
  for (const rows of Object.values(assets.rowZones)) {
    assert.equal(rows.length, 5)
    for (const row of rows) {
      const [x, , width] = canvases[Number(row)].calls[0]
      assert.equal(canvases[Number(row)].width, Math.round(width * 3 * 1080 / 719))
      assert.ok(x < 605, 'the elimination column starts around x=605 in the supplied image')
      assert.ok(x + width > 866, 'the mitigation column must remain inside the crop')
      assert.ok(x + width < 899, 'the right-hand warning icon must remain outside the crop')
    }
  }
  globalThis.Image = class {
    width = 1920
    height = 1200
    set src(value) { this.onload(value) }
  }
  const sixteenTen = await buildCropAssets('source-image', {
    ...getCaptureLayoutPreset('spectatorSixteenTenNoUltimate'), captureLayout: 'spectatorSixteenTenNoUltimate'
  })
  const topRow = canvases[Number(sixteenTen.rowZones.teamA[0])].calls[0]
  const bottomRow = canvases[Number(sixteenTen.rowZones.teamB[0])].calls[0]
  assert.ok(Math.abs(topRow[3] - 1200 * 0.275 / 5) < 0.001)
  assert.ok(Math.abs(bottomRow[3] - 1200 * 0.269 / 5) < 0.001)
})

test('complete numbers from the reported screenshot keep elimination, assist, and death columns', () => {
  assert.deepEqual(parseStatsLine('5 11 7 1,476 2,436 24'), {
    elim: '5', ast: '11', dth: '7', dmg: '1476', heal: '2436', block: '24'
  })
  assert.deepEqual(parseStatsLine('9 18 5 1,162 3,847 0'), {
    elim: '9', ast: '18', dth: '5', dmg: '1162', heal: '3847', block: '0'
  })
})
