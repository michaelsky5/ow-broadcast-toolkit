import { OW_HERO_OPTIONS } from '../data/overwatch'
import {
  MAX_ROSTER_PLAYERS,
  createEntityId,
  getDefaultHeroForRole,
  normalizePortraitXPct,
  normalizeRosterRole
} from '../app/editors/roster/rosterEditorUtils'
import { createEmptyLibraryTeam, normalizeLibraryTeam } from './teamLibraryModel'

export const MAX_TEAM_LIBRARY_CSV_BYTES = 2 * 1024 * 1024

const HEADER_ALIASES = {
  teamName: [
    'teamname', 'team', 'organization', 'organisation', 'org', 'club', 'squad',
    '队伍名称', '队伍名', '队名', '战队名称', '战队名', '俱乐部',
    '所属队伍', '报名队伍', '参赛队伍', '赛事队伍', '常规赛队伍'
  ],
  shortName: [
    'teamshortname', 'teamshort', 'shortname', 'short', 'teamcode', 'code', 'teamabbr', 'abbr', 'abbreviation',
    '队伍简称', '战队简称', '队伍缩写', '战队缩写', '简称', '缩写'
  ],
  teamLogo: [
    'teamlogo', 'logo', 'logourl', 'logoimage',
    '队伍logo', '战队logo', '队标', '标志', '徽标'
  ],
  primaryColor: [
    'teamcolor', 'teamprimarycolor', 'primarycolor', 'color',
    '队伍主色', '战队主色', '主色', '主题色', '颜色'
  ],
  manager: ['manager', 'teammanager', '经理', '领队'],
  coach: ['coach', 'headcoach', '教练', '主教练'],
  description: ['description', 'notes', 'note', 'remark', 'remarks', '备注', '队伍备注', '说明'],
  playerName: [
    'playername', 'player', 'nickname', 'nick', 'displayname', 'gamertag', 'handle', 'ign',
    '选手名称', '选手名', '选手', '选手昵称', '昵称', '游戏名'
  ],
  battleTag: [
    'battletag', 'battleid', 'battlenet', 'battlenetid', 'tag', 'gameid', 'playerid', 'owid', 'overwatchid',
    '比赛id', '游戏id', '选手id', '战网id', '战网账号', '账号'
  ],
  role: ['role', 'position', 'playerrole', 'class', '位置', '职责', '选手职责', '定位', '分路'],
  playerAvatar: [
    'playeravatar', 'playerimage', 'avatar', 'avatarurl', 'portrait',
    '选手头像', '选手图片', '头像', '照片'
  ],
  primaryHero: ['primaryhero', 'mainhero', 'hero', '常用英雄', '主玩英雄', '英雄'],
  portraitXPct: [
    'portraitxpct', 'portraitx', 'portraitposition',
    '人像横向位置', '头像位置', '头像横向位置'
  ]
}

const clean = value => String(value || '').trim()
const normalizeHeader = value => clean(value)
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '')

const aliasLookup = new Map(Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) => (
  aliases.map(alias => [normalizeHeader(alias), field])
)))

const heroLookup = new Map(OW_HERO_OPTIONS.flatMap(hero => [
  [normalizeHeader(hero.id), hero.id],
  [normalizeHeader(hero.zh), hero.id],
  [normalizeHeader(hero.en), hero.id]
]))

const prepareCsvInput = input => {
  const text = String(input || '').replace(/^\uFEFF/, '').replace(/^\s*\r?\n/, '')
  const separatorLine = text.match(/^sep\s*=\s*([^\r\n])\s*(?:\r?\n|$)/i)

  return {
    delimiter: separatorLine?.[1] || '',
    text: separatorLine ? text.slice(separatorLine[0].length) : text
  }
}

const detectDelimiter = input => {
  const text = String(input || '')
  const counts = new Map([[',', 0], ['\t', 0], [';', 0], ['|', 0]])
  let quoted = false
  let lineCount = 0

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1
      else quoted = !quoted
      continue
    }
    if (!quoted && (character === '\r' || character === '\n')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      lineCount += 1
      if (lineCount >= 5) break
      continue
    }
    if (!quoted && counts.has(character)) counts.set(character, counts.get(character) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || ','
}

const parseCsvRows = input => {
  const prepared = prepareCsvInput(input)
  const text = prepared.text
  const delimiter = prepared.delimiter || detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  const pushRow = () => {
    row.push(field)
    if (row.some(value => clean(value))) rows.push(row)
    row = []
    field = ''
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && !field) {
      quoted = true
    } else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      pushRow()
    } else if (character === '\r') {
      if (text[index + 1] === '\n') index += 1
      pushRow()
    } else {
      field += character
    }
  }

  if (quoted) {
    const error = new Error('CSV contains an unclosed quoted field.')
    error.importCode = 'csv-unclosed-quote'
    throw error
  }
  if (field || row.length) pushRow()
  return rows
}

const mapHeader = row => {
  const normalized = row.map(normalizeHeader)
  const header = normalized.map(value => aliasLookup.get(value) || '')
  const genericNameIndex = normalized.findIndex(value => value === 'name' || value === '名称')

  if (genericNameIndex >= 0 && !header[genericNameIndex]) {
    const hasPlayerContext = ['battleTag', 'role', 'playerAvatar', 'primaryHero'].some(field => header.includes(field))
    header[genericNameIndex] = header.includes('teamName') || hasPlayerContext ? 'playerName' : 'teamName'
  }

  return header
}

const mapCsvRows = rows => {
  if (rows.length < 2) {
    const error = new Error('CSV has no data rows.')
    error.importCode = 'csv-no-data'
    throw error
  }

  const headerCandidates = rows.slice(0, Math.min(rows.length, 12)).map((row, index) => {
    const header = mapHeader(row)
    const fields = new Set(header.filter(Boolean))
    return {
      fields,
      header,
      index,
      score: fields.size + (fields.has('teamName') || fields.has('shortName') ? 10 : 0)
    }
  })
  const selected = headerCandidates.sort((left, right) => right.score - left.score)[0]
  const header = selected?.header || []
  const fields = new Set(header.filter(Boolean))
  if (!fields.has('teamName') && !fields.has('shortName')) {
    const error = new Error('CSV is missing a team name or short name column.')
    error.importCode = 'csv-missing-team-column'
    error.importDetails = rows[0].map(clean).filter(Boolean).slice(0, 8)
    throw error
  }

  return {
    fields,
    rows: rows.slice(selected.index + 1).map((values, index) => ({
      rowNumber: selected.index + index + 2,
      values: Object.fromEntries(header.map((field, columnIndex) => [field, clean(values[columnIndex])]).filter(([field]) => field))
    }))
  }
}

const normalizeCsvRole = value => {
  const role = normalizeHeader(value)
  if (['坦克', '重装', 't', 'tank'].includes(role)) return 'tank'
  if (['输出', '伤害', 'dps', 'd', 'damage', 'attack'].includes(role)) return 'damage'
  if (['支援', '辅助', '治疗', '奶', 's', 'sup', 'support', 'healer'].includes(role)) return 'support'
  return normalizeRosterRole(value)
}

const getCsvStaffField = value => {
  const role = normalizeHeader(value)
  if (['coach', 'headcoach', '教练', '主教练', '助理教练'].includes(role)) return 'coach'
  if (['manager', 'teammanager', 'leader', '领队', '经理', '战队经理'].includes(role)) return 'manager'
  return ''
}

const createShortName = name => clean(name)
  .replace(/[^a-z0-9\u3400-\u9fff]+/gi, '')
  .slice(0, 6)
  .toLocaleUpperCase() || 'TEAM'

const getTeamKey = values => [values.teamName, values.shortName || createShortName(values.teamName)]
  .map(normalizeHeader)
  .join('::')

const fillTeamField = (team, field, value) => {
  if (value && !team[field]) team[field] = value
}

const appendTeamStaff = (team, field, value) => {
  const staffName = clean(value)
  if (!staffName) return false
  const currentNames = clean(team[field]).split(/\s*\/\s*/).filter(Boolean)
  if (currentNames.some(name => normalizeHeader(name) === normalizeHeader(staffName))) return false
  team[field] = [...currentNames, staffName].join(' / ')
  return true
}

const getPlayerIdentity = player => {
  const battleTag = normalizeHeader(player.battleTag)
  return battleTag || `${normalizeHeader(player.name)}::${player.role}`
}

export const parseTeamLibraryCsv = input => {
  const { rows: mappedRows } = mapCsvRows(parseCsvRows(input))
  const groups = new Map()
  let skippedRows = 0
  let omittedPlayers = 0
  let duplicatePlayers = 0

  mappedRows.forEach(({ values }) => {
    if (!values.teamName && !values.shortName) {
      skippedRows += 1
      return
    }

    const teamName = values.teamName || values.shortName

    const key = getTeamKey({ ...values, teamName })
    let group = groups.get(key)
    if (!group) {
      const base = createEmptyLibraryTeam(groups.size + 1)
      group = {
        team: {
          ...base,
          name: teamName,
          shortName: values.shortName || createShortName(teamName),
          players: []
        },
        generatedShortName: !values.shortName,
        playerIdentities: new Set()
      }
      groups.set(key, group)
    }

    fillTeamField(group.team, 'logo', values.teamLogo)
    fillTeamField(group.team, 'primaryColor', values.primaryColor)
    fillTeamField(group.team, 'manager', values.manager)
    fillTeamField(group.team, 'coach', values.coach)
    fillTeamField(group.team, 'description', values.description)

    const staffField = getCsvStaffField(values.role)
    if (staffField) {
      appendTeamStaff(group.team, staffField, values.playerName || values.battleTag)
      return
    }

    if (!values.playerName && !values.battleTag) return
    if (group.team.players.length >= MAX_ROSTER_PLAYERS) {
      omittedPlayers += 1
      return
    }

    const role = normalizeCsvRole(values.role)
    const player = {
      id: createEntityId('library-player'),
      sourcePlayerId: '',
      name: values.playerName || values.battleTag,
      battleTag: values.battleTag,
      role,
      avatar: values.playerAvatar,
      portraitXPct: normalizePortraitXPct(values.portraitXPct),
      primaryHeroes: [heroLookup.get(normalizeHeader(values.primaryHero))].filter(Boolean),
      teamLibraryId: group.team.id
    }
    const identity = getPlayerIdentity(player)
    if (group.playerIdentities.has(identity)) {
      duplicatePlayers += 1
      return
    }

    group.playerIdentities.add(identity)
    group.team.players.push(player)
  })

  const records = [...groups.values()].map(group => normalizeLibraryTeam(group.team))
  const generatedShortNameIds = [...groups.values()]
    .filter(group => group.generatedShortName)
    .map(group => group.team.id)
  if (!records.length) {
    const error = new Error('CSV has no valid teams.')
    error.importCode = 'csv-no-valid-teams'
    throw error
  }

  return { records, generatedShortNameIds, skippedRows, omittedPlayers, duplicatePlayers }
}

const TEAM_METADATA_FIELDS = ['teamLogo', 'primaryColor', 'manager', 'coach', 'description']

export const detectTeamLibraryCsvKind = (input, existingRecords = [], sourceLabel = '') => {
  const { fields, rows } = mapCsvRows(parseCsvRows(input))
  const hasPlayerColumns = fields.has('playerName') || fields.has('battleTag')
  const hasTeamMetadata = TEAM_METADATA_FIELDS.some(field => fields.has(field))
  if (!hasPlayerColumns || hasTeamMetadata) return 'team-csv'

  const identifiableRows = rows.filter(({ values }) => values.teamName || values.shortName)
  const matchCounts = identifiableRows.map(({ values }) => findPlayerCsvTeam(values, existingRecords).length)
  const allTeamsExist = matchCounts.length > 0 && matchCounts.every(count => count === 1)
  if (allTeamsExist) return 'player-csv'

  const normalizedLabel = normalizeHeader(sourceLabel)
  const hasPlayerLabel = ['player', 'players', 'roster', 'lineup', '选手', '名单', '阵容']
    .some(word => normalizedLabel.includes(word))
  const hasExistingTeam = matchCounts.some(count => count === 1)
  return hasPlayerLabel && hasExistingTeam ? 'player-csv' : 'team-csv'
}

const normalizeIdentity = value => clean(value).toLocaleLowerCase().replace(/\s+/g, ' ')

const findPlayerCsvTeam = (values, records) => {
  const shortName = normalizeIdentity(values.shortName)
  const teamName = normalizeIdentity(values.teamName)
  let candidates = shortName
    ? records.filter(team => normalizeIdentity(team.shortName) === shortName)
    : []

  if (!candidates.length && teamName) {
    candidates = records.filter(team => normalizeIdentity(team.name) === teamName)
  }
  if (!candidates.length && teamName) {
    candidates = records.filter(team => normalizeIdentity(team.shortName) === teamName)
  }
  return candidates
}

const createCsvPlayer = (values, team) => {
  const role = normalizeCsvRole(values.role)
  return {
    id: createEntityId('library-player'),
    sourcePlayerId: '',
    name: values.playerName || values.battleTag,
    battleTag: values.battleTag,
    role,
    avatar: values.playerAvatar,
    portraitXPct: normalizePortraitXPct(values.portraitXPct),
    primaryHeroes: [heroLookup.get(normalizeHeader(values.primaryHero)) || getDefaultHeroForRole(role)].filter(Boolean),
    teamLibraryId: team.id
  }
}

const mergeCsvPlayer = (existing, values) => {
  const role = values.role ? normalizeCsvRole(values.role) : existing.role
  const hero = heroLookup.get(normalizeHeader(values.primaryHero))
  return {
    ...existing,
    name: values.playerName || existing.name,
    battleTag: values.battleTag || existing.battleTag,
    role,
    avatar: values.playerAvatar || existing.avatar,
    portraitXPct: values.portraitXPct
      ? normalizePortraitXPct(values.portraitXPct)
      : existing.portraitXPct,
    primaryHeroes: hero ? [hero] : existing.primaryHeroes
  }
}

const findExistingPlayerIndex = (players, values) => {
  const battleTag = normalizeIdentity(values.battleTag)
  if (battleTag) {
    return players.findIndex(player => normalizeIdentity(player.battleTag) === battleTag)
  }

  const name = normalizeIdentity(values.playerName)
  if (!name) return -1
  const role = values.role ? normalizeCsvRole(values.role) : ''
  const candidates = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => normalizeIdentity(player.name) === name && (!role || player.role === role))
  return candidates.length === 1 ? candidates[0].index : -1
}

export const parseTeamPlayerCsv = (input, existingRecords) => {
  const { fields, rows } = mapCsvRows(parseCsvRows(input))
  if (!fields.has('playerName') && !fields.has('battleTag')) {
    const error = new Error('Player CSV is missing a player name or Battle ID column.')
    error.importCode = 'csv-missing-player-column'
    throw error
  }

  const records = (existingRecords || []).map(normalizeLibraryTeam)
  const changedIds = new Set()
  const incomingIdentities = new Set()
  let skippedRows = 0
  let missingTeams = 0
  let ambiguousTeams = 0
  let omittedPlayers = 0
  let duplicatePlayers = 0
  let missingRoles = 0
  let addedPlayers = 0
  let updatedPlayers = 0
  let updatedStaff = 0

  rows.forEach(({ values }) => {
    if ((!values.teamName && !values.shortName) || (!values.playerName && !values.battleTag)) {
      skippedRows += 1
      return
    }

    const matchingTeams = findPlayerCsvTeam(values, records)
    if (!matchingTeams.length) {
      missingTeams += 1
      return
    }
    if (matchingTeams.length > 1) {
      ambiguousTeams += 1
      return
    }

    const team = matchingTeams[0]
    const staffField = getCsvStaffField(values.role)
    if (staffField) {
      const staffName = values.playerName || values.battleTag
      if (appendTeamStaff(team, staffField, staffName)) {
        updatedStaff += 1
        changedIds.add(team.id)
      }
      return
    }

    const incomingIdentity = `${team.id}::${normalizeIdentity(values.battleTag) || `${normalizeIdentity(values.playerName)}::${normalizeHeader(values.role)}`}`
    if (incomingIdentities.has(incomingIdentity)) {
      duplicatePlayers += 1
      return
    }
    incomingIdentities.add(incomingIdentity)

    const existingIndex = findExistingPlayerIndex(team.players, values)
    if (existingIndex >= 0) {
      team.players[existingIndex] = mergeCsvPlayer(team.players[existingIndex], values)
      updatedPlayers += 1
      changedIds.add(team.id)
      return
    }

    if (team.players.length >= MAX_ROSTER_PLAYERS) {
      omittedPlayers += 1
      return
    }
    if (!values.role) missingRoles += 1
    team.players.push(createCsvPlayer(values, team))
    addedPlayers += 1
    changedIds.add(team.id)
  })

  const changedRecords = records.filter(team => changedIds.has(team.id)).map(normalizeLibraryTeam)

  return {
    records: changedRecords,
    skippedRows,
    missingTeams,
    ambiguousTeams,
    omittedPlayers,
    duplicatePlayers,
    missingRoles,
    addedPlayers,
    updatedPlayers,
    updatedStaff
  }
}

export const parseTeamLibraryCsvAuto = (input, existingRecords, sourceLabel = '') => {
  const kind = detectTeamLibraryCsvKind(input, existingRecords, sourceLabel)
  return kind === 'player-csv'
    ? { kind, ...parseTeamPlayerCsv(input, existingRecords) }
    : { kind, ...parseTeamLibraryCsv(input) }
}

const csvCell = value => {
  const text = String(value || '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const createTeamLibraryCsvTemplate = language => {
  const chinese = language !== 'en'
  const headers = chinese
    ? ['队伍名称', '队伍简称', '队伍Logo', '队伍主色', '经理', '教练', '备注', '选手名称', '比赛ID', '位置', '选手头像', '常用英雄', '人像横向位置']
    : ['team_name', 'team_short_name', 'team_logo', 'team_color', 'manager', 'coach', 'notes', 'player_name', 'battle_tag', 'role', 'player_avatar', 'primary_hero', 'portrait_x_pct']
  const rows = chinese
    ? [
        ['示例队伍', 'EX', '', '#4ed1ad', '', '', '', 'Player 1', 'Player#1001', '坦克', '', 'D.Va', '50'],
        ['示例队伍', 'EX', '', '#4ed1ad', '', '', '', 'Player 2', 'Player#1002', '输出', '', '猎空', '50']
      ]
    : [
        ['Example Team', 'EX', '', '#4ed1ad', '', '', '', 'Player 1', 'Player#1001', 'tank', '', 'D.Va', '50'],
        ['Example Team', 'EX', '', '#4ed1ad', '', '', '', 'Player 2', 'Player#1002', 'damage', '', 'Tracer', '50']
      ]

  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`
}

export const createTeamPlayerCsvTemplate = language => {
  const chinese = language !== 'en'
  const headers = chinese
    ? ['队伍简称', '队伍名称', '选手名称', '比赛ID', '位置', '选手头像', '常用英雄', '人像横向位置']
    : ['team_short_name', 'team_name', 'player_name', 'battle_tag', 'role', 'player_avatar', 'primary_hero', 'portrait_x_pct']
  const rows = chinese
    ? [
        ['EX', '示例队伍', 'Player 1', 'Player#1001', '坦克', '', 'D.Va', '50'],
        ['EX', '示例队伍', 'Player 2', 'Player#1002', '输出', '', '猎空', '50']
      ]
    : [
        ['EX', 'Example Team', 'Player 1', 'Player#1001', 'tank', '', 'D.Va', '50'],
        ['EX', 'Example Team', 'Player 2', 'Player#1002', 'damage', '', 'Tracer', '50']
      ]

  return `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`
}
