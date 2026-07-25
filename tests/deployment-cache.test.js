import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

const readRepoFile = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const vercel = JSON.parse(await readRepoFile('vercel.json'))
const indexHtml = await readRepoFile('index.html')
const indexCss = await readRepoFile('src/index.css')
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
  test('routes public session ids to the dynamic Vercel Function', () => {
    const sessionRewrite = (vercel.rewrites || []).find(
      rule => rule.source === '/api/session/:sessionId'
    )

    assert.deepEqual(sessionRewrite, {
      source: '/api/session/:sessionId',
      destination: '/api/session/[sessionId]'
    })
  })

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
      assert.equal(getHeader(source, 'referrer-policy'), 'no-referrer')
    }
    assert.match(indexHtml, /<meta name="referrer" content="no-referrer"\s*\/>/)
  })

  test('caches content-hashed assets immutably and prevents MIME sniffing', () => {
    const cacheControl = getHeader('/assets/(.*)', 'cache-control')
    assert.match(cacheControl, /max-age=31536000/i)
    assert.match(cacheControl, /immutable/i)
    assert.equal(getHeader('/assets/(.*)', 'x-content-type-options'), 'nosniff')
  })

  test('caches versioned WOFF2 font subsets immutably', () => {
    const source = '/fonts/harmonyos-sans-sc/(.*).woff2'
    assert.match(getHeader(source, 'cache-control'), /max-age=31536000/i)
    assert.match(getHeader(source, 'cache-control'), /immutable/i)
    assert.equal(getHeader(source, 'x-content-type-options'), 'nosniff')
    assert.match(indexHtml, /HarmonyOS_Sans_SC_Regular\.app-[a-f0-9]{8}\.woff2/)
  })

  test('keeps immutable font filenames matched to their actual content hash', async () => {
    const names = [...new Set(
      [...indexCss.matchAll(/HarmonyOS_Sans_SC_[A-Za-z]+\.app-[a-f0-9]{8}\.woff2/g)]
        .map(match => match[0])
    )]

    assert.equal(names.length, 4)
    for (const name of names) {
      const bytes = await readFile(
        new URL(`../public/fonts/harmonyos-sans-sc/${name}`, import.meta.url)
      )
      const expectedHash = name.match(/\.app-([a-f0-9]{8})\.woff2$/)?.[1]
      const actualHash = createHash('sha256').update(bytes).digest('hex').slice(0, 8)
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2')
      assert.equal(actualHash, expectedHash)
    }
  })

  test('keeps one-shot startup recovery wired to the React boot marker', () => {
    assert.match(indexHtml, /owbt-recover/)
    assert.match(indexHtml, /window\.__OWBT_MARK_BOOTED__/)
    assert.match(indexHtml, /vite:preloadError/)
    assert.match(mainSource, /<BootMarker \/>/)
    assert.match(bootMarkerSource, /window\.__OWBT_MARK_BOOTED__\?\.\(\)/)
  })
})
