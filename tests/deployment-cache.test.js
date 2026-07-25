import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

const readRepoFile = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const vercel = JSON.parse(await readRepoFile('vercel.json'))
const indexHtml = await readRepoFile('index.html')
const mainSource = await readRepoFile('src/main.jsx')
const bootMarkerSource = await readRepoFile('src/BootMarker.jsx')

const getHeader = (source, key) => (
  vercel.headers
    ?.find(rule => rule.source === source)
    ?.headers
    ?.find(header => header.key.toLowerCase() === key.toLowerCase())
    ?.value || ''
)

describe('production cache contract', () => {
  test('does not rewrite missing static assets to index.html', () => {
    const catchAllRewrites = (vercel.rewrites || []).filter(rule => (
      rule.source === '/(.*)' || rule.source === '/:path*'
    ))

    assert.deepEqual(catchAllRewrites, [])
  })

  test('never stores the HTML entry point', () => {
    for (const source of ['/', '/index.html']) {
      const cacheControl = getHeader(source, 'cache-control')
      assert.match(cacheControl, /(?:^|,\s*)no-store(?:,|$)/i)
      assert.match(cacheControl, /(?:^|,\s*)max-age=0(?:,|$)/i)
    }
  })

  test('caches content-hashed assets immutably and prevents MIME sniffing', () => {
    const cacheControl = getHeader('/assets/(.*)', 'cache-control')
    assert.match(cacheControl, /max-age=31536000/i)
    assert.match(cacheControl, /immutable/i)
    assert.equal(getHeader('/assets/(.*)', 'x-content-type-options'), 'nosniff')
  })

  test('keeps one-shot startup recovery wired to the React boot marker', () => {
    assert.match(indexHtml, /owbt-recover/)
    assert.match(indexHtml, /window\.__OWBT_MARK_BOOTED__/)
    assert.match(indexHtml, /vite:preloadError/)
    assert.match(mainSource, /<BootMarker \/>/)
    assert.match(bootMarkerSource, /window\.__OWBT_MARK_BOOTED__\?\.\(\)/)
  })
})
