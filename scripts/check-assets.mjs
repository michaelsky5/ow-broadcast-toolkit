import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const fromRoot = (...parts) => path.join(rootDir, ...parts)
const toDisplayPath = filePath => path.relative(rootDir, filePath).replaceAll(path.sep, '/')

const extractArrayExpression = (source, exportName) => {
  const marker = `export const ${exportName} =`
  const markerIndex = source.indexOf(marker)

  if (markerIndex === -1) {
    throw new Error(`Unable to find ${exportName}.`)
  }

  const arrayStart = source.indexOf('[', markerIndex)
  if (arrayStart === -1) {
    throw new Error(`Unable to find array expression for ${exportName}.`)
  }

  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = ''
      }
      continue
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === '[') {
      depth += 1
    } else if (char === ']') {
      depth -= 1
      if (depth === 0) return source.slice(arrayStart, index + 1)
    }
  }

  throw new Error(`Unable to extract ${exportName}.`)
}

const loadArrayExport = (relativePath, exportName) => {
  const source = readFileSync(fromRoot(relativePath), 'utf8')
  const expression = extractArrayExpression(source, exportName)
  return vm.runInNewContext(expression, {}, { timeout: 1000 })
}

const OW_HEROES = loadArrayExport('src/data/overwatch/heroes.js', 'OW_HEROES')
const OW_MAPS = loadArrayExport('src/data/overwatch/maps.js', 'OW_MAPS')
const OW_GAME_MODES = loadArrayExport('src/data/overwatch/gameModes.js', 'OW_GAME_MODES')

const missing = []

const checkFile = (label, itemId, filePath) => {
  if (existsSync(filePath)) return

  missing.push({
    label,
    itemId,
    path: toDisplayPath(filePath)
  })
}

for (const hero of OW_HEROES) {
  checkFile('hero portrait', hero.id, fromRoot('public', 'heroes', hero.role, `${hero.assetKey}.png`))
  checkFile('roster portrait', hero.id, fromRoot('public', 'roster', hero.role, `${hero.assetKey}.png`))
}

for (const map of OW_MAPS) {
  const extension = map.imageExt || 'jpg'
  checkFile('map image', map.id, fromRoot('public', 'maps', map.mode, `${map.assetKey}.${extension}`))
}

for (const mode of OW_GAME_MODES) {
  const extension = mode.assetExt || 'png'
  checkFile('mode icon', mode.id, fromRoot('public', 'modes', `${mode.assetKey}.${extension}`))
}

if (missing.length > 0) {
  console.error(`[check:assets] ${missing.length} missing asset reference(s):`)
  for (const item of missing) {
    console.error(`- ${item.label} for "${item.itemId}": ${item.path}`)
  }
  process.exit(1)
}

console.log('[check:assets] OK - all Overwatch asset references exist.')
