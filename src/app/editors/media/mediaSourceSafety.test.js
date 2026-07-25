import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  hasEmbeddedVideoReferences,
  isEmbeddedVideoSource,
  removeEmbeddedVideoReferences,
  sanitizeProjectEmbeddedVideoSources
} from '../../../project/projectMediaSafety.js'

describe('media source safety', () => {
  test('identifies non-persistable Data and Blob video sources', () => {
    assert.equal(isEmbeddedVideoSource('data:video/mp4;base64,AAAA'), true)
    assert.equal(isEmbeddedVideoSource(' BLOB:https://example.test/video-id '), true)
    assert.equal(isEmbeddedVideoSource('https://cdn.example.test/video.mp4'), false)
    assert.equal(isEmbeddedVideoSource('/media/video.mp4'), false)
  })

  test('explicit cleanup removes only embedded references and preserves URL sources', () => {
    const cleaned = removeEmbeddedVideoReferences({
      sourceUrl: 'https://cdn.example.test/active.mp4',
      activeVideoPath: 'https://cdn.example.test/active.mp4',
      videoLibrary: [
        { name: 'Active', path: 'https://cdn.example.test/active.mp4' },
        { name: 'Duplicate', path: 'https://cdn.example.test/active.mp4' },
        { name: 'Embedded', path: 'data:video/mp4;base64,AAAA' }
      ],
      videoPlaylist: [
        'https://cdn.example.test/active.mp4',
        'https://cdn.example.test/active.mp4',
        'blob:https://example.test/video-id'
      ]
    })

    assert.equal(cleaned.activeVideoPath, 'https://cdn.example.test/active.mp4')
    assert.equal(cleaned.sourceUrl, 'https://cdn.example.test/active.mp4')
    assert.deepEqual(cleaned.videoLibrary, [
      { name: 'Active', path: 'https://cdn.example.test/active.mp4' },
      { name: 'Duplicate', path: 'https://cdn.example.test/active.mp4' }
    ])
    assert.deepEqual(cleaned.videoPlaylist, [
      'https://cdn.example.test/active.mp4',
      'https://cdn.example.test/active.mp4'
    ])
  })

  test('reports embedded references in every persisted media collection', () => {
    assert.equal(hasEmbeddedVideoReferences({ sourceUrl: 'data:video/mp4;base64,AAAA' }), true)
    assert.equal(hasEmbeddedVideoReferences({ activeVideoPath: 'blob:https://example.test/video-id' }), true)
    assert.equal(hasEmbeddedVideoReferences({ videoLibrary: [{ path: 'data:video/webm;base64,AAAA' }] }), true)
    assert.equal(hasEmbeddedVideoReferences({ videoPlaylist: ['blob:https://example.test/video-id'] }), true)
    assert.equal(hasEmbeddedVideoReferences({
      activeVideoPath: 'https://cdn.example.test/video.mp4',
      videoLibrary: [{ path: '/media/video.mp4' }]
    }), false)
  })

  test('normal loading and saving preserve legacy embedded media byte-for-byte', () => {
    const project = {
      scenes: {
        settings: {
          media: {
            activeVideoPath: 'data:video/mp4;base64,AAAA',
            sourceUrl: 'blob:https://example.test/video-id',
            sourceName: 'unsafe.mp4',
            sourceType: 'video/mp4',
            videoLibrary: [{ name: 'Remote', path: 'https://cdn.example.test/video.mp4' }],
            videoPlaylist: ['data:video/mp4;base64,AAAA']
          }
        }
      }
    }

    const preserved = sanitizeProjectEmbeddedVideoSources(project)

    assert.equal(preserved, project)
    assert.equal(preserved.scenes.settings.media.activeVideoPath, 'data:video/mp4;base64,AAAA')
    assert.equal(preserved.scenes.settings.media.sourceUrl, 'blob:https://example.test/video-id')
    assert.equal(preserved.scenes.settings.media.sourceName, 'unsafe.mp4')
    assert.equal(preserved.scenes.settings.media.sourceType, 'video/mp4')
    assert.deepEqual(preserved.scenes.settings.media.videoPlaylist, ['data:video/mp4;base64,AAAA'])
  })

  test('explicit cleanup preserves metadata when a valid active source remains', () => {
    const cleaned = removeEmbeddedVideoReferences({
      activeVideoPath: 'https://cdn.example.test/active.mp4',
      sourceUrl: '',
      sourceName: 'active.mp4',
      sourceType: 'video/mp4',
      videoLibrary: [
        { name: 'Legacy', path: 'data:video/mp4;base64,AAAA' },
        { name: 'Active', path: 'https://cdn.example.test/active.mp4' }
      ],
      videoPlaylist: ['blob:https://example.test/video-id']
    })

    assert.equal(cleaned.activeVideoPath, 'https://cdn.example.test/active.mp4')
    assert.equal(Object.hasOwn(cleaned, 'sourceName'), false)
    assert.equal(Object.hasOwn(cleaned, 'sourceType'), false)
    assert.deepEqual(cleaned.videoLibrary, [
      { name: 'Active', path: 'https://cdn.example.test/active.mp4' }
    ])
  })

  test('explicit cleanup clears metadata only when it removes the last active source', () => {
    const cleaned = removeEmbeddedVideoReferences({
      activeVideoPath: 'data:video/mp4;base64,AAAA',
      sourceUrl: 'blob:https://example.test/video-id',
      sourceName: 'legacy.mp4',
      sourceType: 'video/mp4',
      videoLibrary: [],
      videoPlaylist: []
    })

    assert.equal(cleaned.activeVideoPath, '')
    assert.equal(cleaned.sourceUrl, '')
    assert.equal(cleaned.sourceName, '')
    assert.equal(cleaned.sourceType, '')
  })
})
