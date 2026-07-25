import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  PROJECT_IMAGE_MAX_PASSTHROUGH_BYTES,
  PROJECT_IMAGE_MAX_SOURCE_PIXELS,
  ProjectImageUploadError,
  canKeepOriginalProjectRaster,
  fitProjectImageDimensions,
  getProjectImageUploadErrorMessage,
  inspectProjectImageSource,
  isProjectImageFile,
  keepsOriginalImageEncoding,
  prepareProjectImage
} from './imageUpload.js'

describe('project image upload safety', () => {
  test('recognizes supported images and pass-through formats', () => {
    assert.equal(isProjectImageFile({ name: 'logo.svg', type: '' }), true)
    assert.equal(isProjectImageFile({ name: 'photo.bin', type: 'image/webp' }), true)
    assert.equal(isProjectImageFile({ name: 'video.mp4', type: 'video/mp4' }), false)
    assert.equal(keepsOriginalImageEncoding({ name: 'logo.SVG', type: '' }), true)
    assert.equal(keepsOriginalImageEncoding({ name: 'animation.bin', type: 'image/gif' }), true)
    assert.equal(keepsOriginalImageEncoding({ name: 'photo.png', type: 'image/png' }), false)
  })

  test('fits large images without changing their aspect ratio or enlarging small images', () => {
    assert.deepEqual(fitProjectImageDimensions(4000, 2000, 1280), { width: 1280, height: 640 })
    assert.deepEqual(fitProjectImageDimensions(640, 480, 1280), { width: 640, height: 480 })
  })

  test('rejects decoded source images above the pixel safety limit before canvas work', () => {
    const atLimit = inspectProjectImageSource(6000, 4000, {
      maxDimension: 1280,
      maxSourcePixels: PROJECT_IMAGE_MAX_SOURCE_PIXELS
    })
    const aboveLimit = inspectProjectImageSource(6001, 4000, {
      maxDimension: 1280,
      maxSourcePixels: PROJECT_IMAGE_MAX_SOURCE_PIXELS
    })

    assert.equal(atLimit.pixels, 24_000_000)
    assert.equal(atLimit.exceedsSourcePixelLimit, false)
    assert.equal(atLimit.exceedsMaxDimension, true)
    assert.equal(aboveLimit.exceedsSourcePixelLimit, true)
  })

  test('never keeps a smaller original file when its decoded dimensions require resizing', () => {
    assert.equal(canKeepOriginalProjectRaster({
      candidateBytes: 64 * 1024,
      fileBytes: 32 * 1024,
      maxDimension: 1280,
      maxOutputBytes: 384 * 1024,
      sourceHeight: 600,
      sourceWidth: 1600
    }), false)

    assert.equal(canKeepOriginalProjectRaster({
      candidateBytes: 64 * 1024,
      fileBytes: 32 * 1024,
      maxDimension: 1280,
      maxOutputBytes: 384 * 1024,
      sourceHeight: 600,
      sourceWidth: 1200
    }), true)
  })

  test('keeps small SVG files but rejects pass-through files over the strict limit', async () => {
    const smallSvg = { name: 'logo.svg', type: 'image/svg+xml', size: 1024 }
    const result = await prepareProjectImage(smallSvg, {
      readDataUrl: async () => 'data:image/svg+xml;base64,PHN2Zy8+'
    })

    assert.equal(result.dataUrl, 'data:image/svg+xml;base64,PHN2Zy8+')
    assert.equal(result.compressed, false)

    await assert.rejects(
      prepareProjectImage({
        name: 'animation.gif',
        type: 'image/gif',
        size: PROJECT_IMAGE_MAX_PASSTHROUGH_BYTES + 1
      }),
      error => error instanceof ProjectImageUploadError && error.code === 'passthrough-too-large'
    )
  })

  test('returns explicit localized messages for safety failures', () => {
    const error = new ProjectImageUploadError('output-too-large', { maxBytes: 384 * 1024 })
    assert.match(getProjectImageUploadErrorMessage(error, 'zh'), /384 KB/)
    assert.match(getProjectImageUploadErrorMessage(error, 'en'), /384 KB/)

    const pixelError = new ProjectImageUploadError('source-pixels-too-large', {
      height: 5000,
      maxPixels: PROJECT_IMAGE_MAX_SOURCE_PIXELS,
      width: 6000
    })
    assert.match(getProjectImageUploadErrorMessage(pixelError, 'zh'), /6000×5000/)
    assert.match(getProjectImageUploadErrorMessage(pixelError, 'en'), /24 MP/)
  })
})
