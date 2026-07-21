export const TEAM_LOGO_FILE_MAX_BYTES = 3 * 1024 * 1024

const SUPPORTED_EXTENSIONS = new Set(['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif'])
const EXTENSION_PRIORITY = new Map([
  ['svg', 0],
  ['png', 1],
  ['webp', 2],
  ['jpg', 3],
  ['jpeg', 3],
  ['gif', 4]
])

const clean = value => String(value || '').trim()
const normalizeKey = value => clean(value)
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '')

const getExtension = fileName => {
  const match = clean(fileName).match(/\.([^.]+)$/)
  return match ? match[1].toLocaleLowerCase() : ''
}

const getFileStem = fileName => clean(fileName).replace(/\.[^.]+$/, '')

const getDisplayName = file => clean(file?.webkitRelativePath || file?.name)

const compareLogoFiles = (left, right) => {
  const priorityDifference = (EXTENSION_PRIORITY.get(getExtension(left.name)) ?? 99) -
    (EXTENSION_PRIORITY.get(getExtension(right.name)) ?? 99)
  if (priorityDifference) return priorityDifference
  return getDisplayName(left).localeCompare(getDisplayName(right))
}

export const createTeamLogoFolderPlan = (rawFiles, rawTeams) => {
  const files = Array.from(rawFiles || [])
  const teams = Array.from(rawTeams || [])
  const teamsByShortName = new Map()
  const teamsByName = new Map()

  teams.forEach(team => {
    const shortNameKey = normalizeKey(team?.shortName)
    const nameKey = normalizeKey(team?.name)
    if (shortNameKey) {
      teamsByShortName.set(shortNameKey, [...(teamsByShortName.get(shortNameKey) || []), team])
    }
    if (nameKey && nameKey !== shortNameKey) {
      teamsByName.set(nameKey, [...(teamsByName.get(nameKey) || []), team])
    }
  })

  const candidatesByKey = new Map()
  const rejectedFiles = []

  files.forEach(file => {
    const extension = getExtension(file?.name)
    if (!SUPPORTED_EXTENSIONS.has(extension) || Number(file?.size || 0) > TEAM_LOGO_FILE_MAX_BYTES) {
      rejectedFiles.push(file)
      return
    }

    const key = normalizeKey(getFileStem(file.name))
    if (!key) {
      rejectedFiles.push(file)
      return
    }
    candidatesByKey.set(key, [...(candidatesByKey.get(key) || []), file])
  })

  const matches = []
  const unmatchedFiles = []
  const ambiguousFiles = []
  const duplicateFiles = []

  candidatesByKey.forEach((candidateFiles, key) => {
    const shortNameMatches = teamsByShortName.get(key) || []
    const matchingTeams = shortNameMatches.length ? shortNameMatches : teamsByName.get(key) || []
    const sortedFiles = [...candidateFiles].sort(compareLogoFiles)

    if (!matchingTeams.length) {
      unmatchedFiles.push(...sortedFiles)
      return
    }
    if (matchingTeams.length > 1) {
      ambiguousFiles.push(...sortedFiles.map(file => ({ file, teams: matchingTeams })))
      return
    }

    const [file, ...duplicates] = sortedFiles
    matches.push({
      file,
      fileName: getDisplayName(file),
      matchReason: shortNameMatches.length ? 'short-name' : 'team-name',
      team: matchingTeams[0]
    })
    duplicateFiles.push(...duplicates)
  })

  matches.sort((left, right) => left.team.shortName.localeCompare(right.team.shortName))

  return {
    filesCount: files.length,
    matches,
    unmatchedFiles,
    ambiguousFiles,
    duplicateFiles,
    rejectedFiles,
    overwriteCount: matches.filter(match => Boolean(clean(match.team.logo))).length
  }
}

export const getTeamLogoFolderFileName = getDisplayName
