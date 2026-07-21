import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadTextFile } from '../project/projectUtils'
import {
  MAX_ROSTER_PLAYERS,
  getDefaultHeroForRole,
  normalizePortraitXPct,
  normalizeRosterRole
} from '../app/editors/roster/rosterEditorUtils'
import { EditorDialog } from '../app/editors/shared/editorControls'
import { OW_HEROES_BY_ROLE } from '../data/overwatch'
import {
  createEmptyLibraryPlayer,
  createEmptyLibraryTeam,
  createLibraryBackup,
  createLibraryMergePlan,
  createLibraryRecordFromProject,
  estimateLibraryBytes,
  findLibraryTeamMatch,
  getLibraryDuplicateGroups,
  getLibraryTeamIdentity,
  mergeLibraryDuplicateGroup,
  normalizeLibraryTeam
} from './teamLibraryModel'
import {
  MATCH_PACKAGE_ERROR_CODES,
  MATCH_PACKAGE_MAX_BYTES,
  MATCH_PACKAGE_TEAM_COUNT,
  createMatchPackage,
  stringifyMatchPackage
} from './matchPackage'
import {
  MATCH_PACKAGE_HEALTH_CODES,
  MATCH_PACKAGE_HEALTH_STATUS,
  analyzeMatchPackageHealth,
  getDataUrlByteSize
} from './matchPackageHealth'
import {
  deleteLibraryTeam,
  getOriginStorageEstimate,
  loadLibraryTeams,
  mergeLibraryTeamGroups,
  requestPersistentLibraryStorage,
  saveLibraryTeam,
  saveLibraryTeams
} from './teamLibraryStorage'
import { getTeamLibraryCopy } from './teamLibraryCopy'
import { optimizeLibraryImage } from './imageAssets'
import {
  MAX_TEAM_LIBRARY_CSV_BYTES,
  createTeamPlayerCsvTemplate,
  createTeamLibraryCsvTemplate,
  parseTeamLibraryCsvAuto
} from './teamLibraryCsv'
import {
  createTeamLogoFolderPlan,
  getTeamLogoFolderFileName
} from './teamLogoFolder'
import {
  MAX_OWBT_TEAM_SOURCE_BYTES,
  MAX_TEAM_LIBRARY_BACKUP_BYTES,
  getOwbtTeamSourceByteLimit,
  isOwbtTeamLibraryBackupText,
  parseOwbtTeamSource
} from './teamProjectImport'
import styles from './TeamLibraryPage.module.css'

const MAX_LIBRARY_IMAGE_BYTES = 3 * 1024 * 1024
const TEAM_LIST_BATCH_SIZE = 24
const TEAM_LIBRARY_GUIDE_STORAGE_KEY = 'owbt-team-library-guide-v1'
const PLAYER_AVATAR_TARGET_BYTES = 96 * 1024

const shouldShowTeamLibraryGuide = () => {
  try {
    return window.localStorage.getItem(TEAM_LIBRARY_GUIDE_STORAGE_KEY) !== 'seen'
  } catch {
    return true
  }
}

const rememberTeamLibraryGuide = () => {
  try {
    window.localStorage.setItem(TEAM_LIBRARY_GUIDE_STORAGE_KEY, 'seen')
  } catch {
    // The guide can still be dismissed for this session when storage is unavailable.
  }
}

const isSupportedImage = file => (
  Boolean(file) &&
  file.size <= MAX_LIBRARY_IMAGE_BYTES &&
  (
    String(file.type || '').startsWith('image/') ||
    /\.(?:svg|png|jpe?g|webp|gif)$/i.test(file.name || '')
  )
)

const readTextFileAutoEncoding = async file => {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  const sampleLength = Math.min(bytes.length, 4096)
  let evenNulls = 0
  let oddNulls = 0
  for (let index = 0; index < sampleLength; index += 1) {
    if (bytes[index] !== 0) continue
    if (index % 2) oddNulls += 1
    else evenNulls += 1
  }
  if (oddNulls > sampleLength / 8) return new TextDecoder('utf-16le').decode(buffer)
  if (evenNulls > sampleLength / 8) return new TextDecoder('utf-16be').decode(buffer)

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gb18030').decode(buffer)
  }
}

const getImportFileByteLimit = async file => {
  if (file.size <= MAX_OWBT_TEAM_SOURCE_BYTES) return MAX_OWBT_TEAM_SOURCE_BYTES

  try {
    const header = await file.slice(0, 8192).text()
    return isOwbtTeamLibraryBackupText(header)
      ? MAX_TEAM_LIBRARY_BACKUP_BYTES
      : MAX_OWBT_TEAM_SOURCE_BYTES
  } catch {
    return MAX_OWBT_TEAM_SOURCE_BYTES
  }
}

const getAutomaticImportError = (copy, failures, preferredKind) => {
  const preferred = failures.find(failure => failure.kind === preferredKind) || failures[0]
  const code = preferred?.error?.importCode || ''
  const reason = copy.importFailureReasons?.[code] || copy.invalidImportSource
  const headers = Array.isArray(preferred?.error?.importDetails)
    ? preferred.error.importDetails.join(' / ')
    : ''
  return copy.invalidImportSourceDetails?.(reason, headers) || reason
}

const formatBytes = bytes => {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}

const formatDate = (value, language) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const getShortNameKey = value => String(value || '').trim().toLocaleLowerCase()

const getBrandingReviewStats = (records, referenceRecords = []) => {
  const teams = Array.from(records || [])
  const reviewedIds = new Set(teams.map(team => team.id))
  const allTeams = [
    ...teams,
    ...Array.from(referenceRecords || []).filter(team => !reviewedIds.has(team.id))
  ]
  const shortNameCounts = new Map()
  allTeams.forEach(team => {
    const key = getShortNameKey(team.shortName)
    if (key) shortNameCounts.set(key, (shortNameCounts.get(key) || 0) + 1)
  })

  const duplicateKeys = new Set(
    [...shortNameCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
  )
  const missingShortNames = teams.filter(team => !getShortNameKey(team.shortName)).length
  const duplicateTeams = teams.filter(team => duplicateKeys.has(getShortNameKey(team.shortName))).length
  const readyLogos = teams.filter(team => Boolean(String(team.logo || '').trim())).length

  return {
    blocked: missingShortNames > 0 || duplicateTeams > 0,
    duplicateKeys,
    duplicateTeams,
    missingLogos: teams.length - readyLogos,
    missingShortNames,
    readyLogos,
    teams: teams.length
  }
}

const getDataImageFormat = value => {
  const format = String(value || '').match(/^data:image\/([^;,]+)/i)?.[1] || ''
  if (format.toLocaleLowerCase() === 'svg+xml') return 'SVG'
  return format.toLocaleUpperCase()
}

function TeamMark({ team }) {
  return (
    <span className={styles.teamMark} style={{ '--team-mark': team.primaryColor || 'var(--theme-primary)' }}>
      {team.logo
        ? <img src={team.logo} alt="" loading="lazy" decoding="async" />
        : <strong>{String(team.shortName || team.name || 'TM').slice(0, 3)}</strong>}
    </span>
  )
}

function PlayerMark({ player }) {
  return (
    <span className={styles.playerMark}>
      {player.avatar
        ? (
            <img
              src={player.avatar}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ objectPosition: `${normalizePortraitXPct(player.portraitXPct)}% center` }}
            />
          )
        : <strong>{String(player.name || 'P').slice(0, 2)}</strong>}
    </span>
  )
}

function MergePreview({ plan, copy, showDuplicates = true }) {
  const visibleRows = plan.rows.slice(0, 8)
  return (
    <div className={styles.mergePreview}>
      <div className={`${styles.mergeSummary} ${showDuplicates ? '' : styles.mergeSummaryCompact}`}>
        <div><span>{copy.mergeAdd}</span><strong>{plan.additions}</strong></div>
        <div><span>{copy.mergeUpdate}</span><strong>{plan.updates}</strong></div>
        {showDuplicates && <div><span>{copy.mergeDuplicateInput}</span><strong>{plan.duplicates}</strong></div>}
      </div>
      <div className={styles.mergeRows}>
        {visibleRows.map(row => (
          <article key={`${row.action}-${row.record.id}`}>
            <span className={row.action === 'update' ? styles.mergeUpdate : styles.mergeAdd}>
              {row.action === 'update' ? copy.mergeUpdate : copy.mergeAdd}
            </span>
            <TeamMark team={row.record} />
            <div>
              <strong>{row.record.name}</strong>
              <em>{row.record.shortName} / {copy.players(row.record.players.length)}</em>
            </div>
          </article>
        ))}
      </div>
      {plan.rows.length > visibleRows.length && (
        <p className={styles.mergeMore}>{copy.mergeMore(plan.rows.length - visibleRows.length)}</p>
      )}
    </div>
  )
}

const getHealthIssueText = (issue, copy) => {
  switch (issue.code) {
    case MATCH_PACKAGE_HEALTH_CODES.MISSING_LOGO:
      return copy.healthMissingLogo(issue.side, issue.teamName)
    case MATCH_PACKAGE_HEALTH_CODES.SHORT_ROSTER:
      return copy.healthShortRoster(issue.side, issue.teamName, issue.count)
    case MATCH_PACKAGE_HEALTH_CODES.LARGE_LOGO:
      return copy.healthLargeLogo(issue.side, issue.teamName, formatBytes(issue.bytes))
    case MATCH_PACKAGE_HEALTH_CODES.LARGE_AVATAR:
      return copy.healthLargeAvatar(issue.side, issue.playerName, formatBytes(issue.bytes))
    case MATCH_PACKAGE_HEALTH_CODES.DUPLICATE_PLAYER:
      return copy.healthDuplicatePlayer(issue.side, issue.playerName, issue.count)
    case MATCH_PACKAGE_HEALTH_CODES.LARGE_PACKAGE:
      return copy.healthLargePackage(formatBytes(issue.bytes))
    case MATCH_PACKAGE_HEALTH_CODES.TOO_LARGE:
      return copy.healthTooLarge(formatBytes(issue.bytes), formatBytes(MATCH_PACKAGE_MAX_BYTES))
    case MATCH_PACKAGE_HEALTH_CODES.DUPLICATE_TEAMS:
      return copy.healthDuplicateTeams
    default:
      return copy.healthInvalidPackage
  }
}

export default function TeamLibraryPage({
  project,
  language = 'zh',
  onBack,
  onRouteBlockerChange,
  onUpdateProject
}) {
  const projectImportInputRef = useRef(null)
  const backupImportInputRef = useRef(null)
  const logoFolderInputRef = useRef(null)
  const logoInputRef = useRef(null)
  const playerAvatarInputRef = useRef(null)
  const playerAvatarTargetRef = useRef('')
  const matchPackageTextRef = useRef(null)
  const matchPickerInputRef = useRef(null)
  const copy = getTeamLibraryCopy(language)
  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState('')
  const [draftTeam, setDraftTeam] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [visibleTeamLimit, setVisibleTeamLimit] = useState(TEAM_LIST_BATCH_SIZE)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [storageEstimate, setStorageEstimate] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [copyFallbackText, setCopyFallbackText] = useState('')
  const [copiedPackageSignature, setCopiedPackageSignature] = useState('')
  const [duplicateTarget, setDuplicateTarget] = useState(null)
  const [duplicateCleanup, setDuplicateCleanup] = useState(null)
  const [pendingProjectSave, setPendingProjectSave] = useState(null)
  const [healthDialogOpen, setHealthDialogOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(shouldShowTeamLibraryGuide)
  const [pendingCsvImport, setPendingCsvImport] = useState(null)
  const [brandingReview, setBrandingReview] = useState(null)
  const [pendingLogoFolder, setPendingLogoFolder] = useState(null)
  const [logoFolderSaving, setLogoFolderSaving] = useState(false)
  const [projectImportOpen, setProjectImportOpen] = useState(false)
  const [projectImportText, setProjectImportText] = useState('')
  const [pendingProjectImport, setPendingProjectImport] = useState(null)
  const [pendingBackupImport, setPendingBackupImport] = useState(null)
  const [matchPickerSide, setMatchPickerSide] = useState(null)
  const [matchPickerSearch, setMatchPickerSearch] = useState('')
  const [pendingNavigation, setPendingNavigation] = useState(null)

  const refreshStorageEstimate = async nextTeams => {
    try {
      const origin = await getOriginStorageEstimate()
      setStorageEstimate({
        libraryBytes: estimateLibraryBytes(nextTeams),
        originUsage: origin?.usage || 0,
        originQuota: origin?.quota || 0,
        persisted: Boolean(origin?.persisted)
      })
    } catch {
      setStorageEstimate({
        libraryBytes: estimateLibraryBytes(nextTeams),
        originUsage: 0,
        originQuota: 0,
        persisted: false
      })
    }
  }

  const closeGuide = () => {
    rememberTeamLibraryGuide()
    setGuideOpen(false)
  }

  useEffect(() => {
    let cancelled = false

    loadLibraryTeams()
      .then(records => {
        if (cancelled) return
        setTeams(records)
        setActiveTeamId(records[0]?.id || '')
        setDraftTeam(records[0] ? structuredClone(records[0]) : null)
        requestPersistentLibraryStorage()
          .catch(() => false)
          .finally(() => refreshStorageEstimate(records))
      })
      .catch(loadError => {
        console.error('[OWBT] Failed to load team library:', loadError)
        if (!cancelled) setError(copy.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [copy.loadFailed])

  const projectTeamLibraryIds = useMemo(() => new Set(
    (project.teams || []).map(team => team.libraryId).filter(Boolean)
  ), [project.teams])
  const searchNeedle = search.trim().toLowerCase()
  const visibleTeams = useMemo(() => teams.filter(team => {
    if (!searchNeedle) return true
    return [
      team.name,
      team.shortName,
      team.coach,
      team.manager,
      ...(team.players || []).flatMap(player => [player.name, player.battleTag, player.role])
    ].join(' ').toLowerCase().includes(searchNeedle)
  }), [searchNeedle, teams])
  const renderedTeams = useMemo(
    () => visibleTeams.slice(0, visibleTeamLimit),
    [visibleTeamLimit, visibleTeams]
  )
  const brandingReviewStats = useMemo(
    () => getBrandingReviewStats(brandingReview?.records, brandingReview?.referenceRecords),
    [brandingReview]
  )
  const storedActiveTeam = useMemo(
    () => teams.find(team => team.id === activeTeamId) || null,
    [activeTeamId, teams]
  )
  const hasUnsavedDraft = useMemo(() => (
    Boolean(draftTeam && storedActiveTeam) && JSON.stringify(draftTeam) !== JSON.stringify(storedActiveTeam)
  ), [draftTeam, storedActiveTeam])

  useEffect(() => {
    if (!hasUnsavedDraft) return undefined
    const warnBeforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedDraft])

  useEffect(() => {
    if (!onRouteBlockerChange) return undefined
    if (!hasUnsavedDraft) {
      onRouteBlockerChange(null)
      return undefined
    }

    onRouteBlockerChange(navigation => {
      setPendingNavigation({ kind: 'route', proceed: navigation.proceed })
      return false
    })
    return () => onRouteBlockerChange(null)
  }, [hasUnsavedDraft, onRouteBlockerChange])

  const activateTeam = team => {
    setActiveTeamId(team.id)
    setDraftTeam(structuredClone(team))
    setStatus('')
    setError('')
  }

  const selectTeam = team => {
    if (team.id === activeTeamId) return
    if (hasUnsavedDraft) {
      setPendingNavigation({ kind: 'team', team })
      return
    }
    activateTeam(team)
  }

  const requestBack = () => {
    if (hasUnsavedDraft) {
      setPendingNavigation({ kind: 'back' })
      return
    }
    onBack()
  }

  const updateDraftField = (field, value) => {
    setDraftTeam(previous => previous ? { ...previous, [field]: value } : previous)
  }

  const updateDraftPlayer = (playerId, patch) => {
    setDraftTeam(previous => previous ? {
      ...previous,
      players: previous.players.map(player => player.id === playerId ? { ...player, ...patch } : player)
    } : previous)
  }

  const addPlayer = () => {
    if (!draftTeam || draftTeam.players.length >= MAX_ROSTER_PLAYERS) return
    setDraftTeam(previous => ({
      ...previous,
      players: [...previous.players, createEmptyLibraryPlayer(previous, previous.players.length + 1)]
    }))
  }

  const removePlayer = playerId => {
    setDraftTeam(previous => previous ? {
      ...previous,
      players: previous.players.filter(player => player.id !== playerId)
    } : previous)
  }

  const persistDraftTeam = async teamDraft => {
    try {
      const saved = await saveLibraryTeam(teamDraft)
      const nextTeams = teams.some(team => team.id === saved.id)
        ? teams.map(team => team.id === saved.id ? saved : team)
        : [saved, ...teams]
      setTeams(nextTeams)
      setDraftTeam(structuredClone(saved))
      setCopiedPackageSignature('')
      setStatus(copy.savedTeam)
      setError('')
      refreshStorageEstimate(nextTeams)
    } catch (saveError) {
      console.error('[OWBT] Failed to save library team:', saveError)
      setError(copy.saveFailed)
    }
  }

  const saveDraft = () => {
    if (!draftTeam) return
    const normalizedDraft = normalizeLibraryTeam(draftTeam)
    if (!getShortNameKey(normalizedDraft.shortName)) {
      setError(copy.shortNameRequired)
      return
    }
    const shortNameConflict = teams.find(team => (
      team.id !== normalizedDraft.id && getShortNameKey(team.shortName) === getShortNameKey(normalizedDraft.shortName)
    ))
    if (shortNameConflict) {
      setDuplicateTarget(shortNameConflict)
      return
    }
    const duplicate = findLibraryTeamMatch({ ...normalizedDraft, id: '' }, teams, normalizedDraft.id)
    if (duplicate) {
      setDuplicateTarget(duplicate)
      return
    }
    persistDraftTeam(normalizedDraft)
  }

  const createTeam = async () => {
    try {
      let nextIndex = teams.length + 1
      let emptyTeam = createEmptyLibraryTeam(nextIndex)
      while (teams.some(team => getShortNameKey(team.shortName) === getShortNameKey(emptyTeam.shortName))) {
        nextIndex += 1
        emptyTeam = createEmptyLibraryTeam(nextIndex)
      }
      const created = await saveLibraryTeam(emptyTeam)
      const nextTeams = [created, ...teams]
      setTeams(nextTeams)
      setCopiedPackageSignature('')
      activateTeam(created)
      refreshStorageEstimate(nextTeams)
    } catch (saveError) {
      console.error('[OWBT] Failed to create library team:', saveError)
      setError(copy.saveFailed)
    }
  }

  const requestCreateTeam = () => {
    if (hasUnsavedDraft) {
      setPendingNavigation({ kind: 'create' })
      return
    }
    createTeam()
  }

  const discardDraftAndContinue = () => {
    const navigation = pendingNavigation
    setPendingNavigation(null)
    if (navigation?.kind === 'team' && navigation.team) {
      activateTeam(navigation.team)
    } else if (navigation?.kind === 'create') {
      createTeam()
    } else if (navigation?.kind === 'import') {
      setProjectImportOpen(true)
    } else if (navigation?.kind === 'backup-import') {
      backupImportInputRef.current?.click()
    } else if (navigation?.kind === 'project-save') {
      saveCurrentProjectTeams()
    } else if (navigation?.kind === 'branding') {
      openBrandingReview()
    } else if (navigation?.kind === 'logo-folder') {
      logoFolderInputRef.current?.click()
    } else if (navigation?.kind === 'back') {
      onBack()
    } else if (navigation?.kind === 'route') {
      navigation.proceed?.()
    }
  }

  const requestProtectedAction = kind => {
    if (hasUnsavedDraft) {
      setPendingNavigation({ kind })
      return
    }
    if (kind === 'import') setProjectImportOpen(true)
    if (kind === 'backup-import') backupImportInputRef.current?.click()
    if (kind === 'project-save') saveCurrentProjectTeams()
    if (kind === 'branding') openBrandingReview()
    if (kind === 'logo-folder') logoFolderInputRef.current?.click()
  }

  const saveCurrentProjectTeams = () => {
    const existingById = new Map(teams.map(team => [team.id, team]))
    const links = (project.teams || []).map(team => {
      const existing = existingById.get(team.libraryId) ||
        teams.find(record => record.sourceTeamId === team.id) ||
        findLibraryTeamMatch({ ...team, id: '' }, teams)
      return {
        ...createLibraryRecordFromProject(project, team, existing),
        existing
      }
    })
    const rows = links.map(link => ({
      action: link.existing ? 'update' : 'add',
      existing: link.existing,
      record: link.record
    }))
    setPendingProjectSave({
      links,
      rows,
      records: rows.map(row => row.record),
      additions: rows.filter(row => row.action === 'add').length,
      updates: rows.filter(row => row.action === 'update').length,
      duplicates: 0
    })
  }

  const confirmProjectTeamSave = async () => {
    if (!pendingProjectSave) return
    const projectSave = pendingProjectSave
    const recordIds = new Set(projectSave.records.map(record => record.id))
    const referenceRecords = teams.filter(team => !recordIds.has(team.id))
    if (getBrandingReviewStats(projectSave.records, referenceRecords).blocked) {
      setPendingProjectSave(null)
      openBrandingReview(projectSave.records, copy.saveCurrent, {
        kind: 'project-save',
        links: projectSave.links
      })
      return
    }
    try {
      const { links } = projectSave
      const saved = await saveLibraryTeams(links.map(link => link.record))
      const savedById = new Map(saved.map(team => [team.id, team]))
      const nextTeams = [
        ...saved,
        ...teams.filter(team => !savedById.has(team.id))
      ]

      onUpdateProject(draft => {
        links.forEach(link => {
          const team = draft.teams.find(item => item.id === link.record.sourceTeamId)
          if (!team) return
          team.libraryId = link.teamLibraryId
          Object.entries(link.playerLinks).forEach(([playerId, libraryPlayerId]) => {
            const player = draft.players.find(item => item.id === playerId)
            if (player) player.libraryPlayerId = libraryPlayerId
          })
        })
      }, { skipUndo: true })

      setTeams(nextTeams)
      setCopiedPackageSignature('')
      setPendingProjectSave(null)
      setError('')
      if (savedById.has(activeTeamId)) {
        setDraftTeam(structuredClone(savedById.get(activeTeamId)))
      } else if (!activeTeamId && saved[0]) {
        setActiveTeamId(saved[0].id)
        setDraftTeam(structuredClone(saved[0]))
      }
      setStatus(copy.savedCurrent(saved.length))
      refreshStorageEstimate(nextTeams)
    } catch (saveError) {
      console.error('[OWBT] Failed to save project teams to library:', saveError)
      setError(copy.saveFailed)
    }
  }

  const openMatchPicker = sideIndex => {
    if (sideIndex === 1 && !selectedIds[0]) return
    setMatchPickerSide(previous => previous === sideIndex ? null : sideIndex)
    setMatchPickerSearch('')
  }

  const selectMatchTeam = teamId => {
    if (matchPickerSide === null) return
    setCopiedPackageSignature('')
    setStatus('')
    setError('')
    if (matchPickerSide === 0) {
      setSelectedIds(selectedIds[1] ? [teamId, selectedIds[1]] : [teamId])
    } else if (selectedIds[0]) {
      setSelectedIds([selectedIds[0], teamId])
    }
    setMatchPickerSide(null)
    setMatchPickerSearch('')
  }

  const swapSelectedMatchSides = () => {
    if (selectedIds.length !== MATCH_PACKAGE_TEAM_COUNT) return
    setSelectedIds(([teamAId, teamBId]) => [teamBId, teamAId])
    setCopiedPackageSignature('')
    setStatus('')
    setError('')
  }

  const clearSelectedMatch = () => {
    setSelectedIds([])
    setMatchPickerSide(null)
    setMatchPickerSearch('')
    setCopiedPackageSignature('')
    setStatus('')
    setError('')
  }

  useEffect(() => {
    if (matchPickerSide === null) return undefined

    const focusTimer = window.setTimeout(() => matchPickerInputRef.current?.focus(), 0)
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return
      setMatchPickerSide(null)
      setMatchPickerSearch('')
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [matchPickerSide])

  const copySelectedMatchPackage = async () => {
    const records = selectedIds.map(id => teams.find(team => team.id === id)).filter(Boolean)
    if (records.length !== MATCH_PACKAGE_TEAM_COUNT) {
      setError(copy.selectTwoTeams)
      return
    }

    let text
    try {
      text = stringifyMatchPackage(createMatchPackage(records))
    } catch (packageError) {
      setStatus('')
      setError(packageError?.code === MATCH_PACKAGE_ERROR_CODES.DUPLICATE_TEAMS
        ? copy.matchPackageDuplicateTeams
        : packageError?.code === MATCH_PACKAGE_ERROR_CODES.TOO_LARGE
          ? copy.matchPackageTooLarge
          : copy.matchPackageBuildFailed)
      return
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setCopiedPackageSignature(selectedIds.join('|'))
      setStatus(copy.matchPackageCopied)
      setError('')
    } catch {
      setCopyFallbackText(text)
      window.setTimeout(() => {
        matchPackageTextRef.current?.focus()
        matchPackageTextRef.current?.select()
      }, 0)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const deletedLibraryId = deleteTarget.id
      const deletedPlayerIds = new Set((deleteTarget.players || []).map(player => player.id))
      await deleteLibraryTeam(deleteTarget.id)
      const nextTeams = teams.filter(team => team.id !== deleteTarget.id)
      onUpdateProject?.(draft => {
        ;(draft.teams || []).forEach(team => {
          if (team.libraryId === deletedLibraryId) team.libraryId = ''
        })
        ;(draft.players || []).forEach(player => {
          if (deletedPlayerIds.has(player.libraryPlayerId)) player.libraryPlayerId = ''
        })
      })
      setTeams(nextTeams)
      setSelectedIds(previous => previous.filter(id => id !== deleteTarget.id))
      setCopiedPackageSignature('')
      if (activeTeamId === deleteTarget.id) {
        const next = nextTeams[0] || null
        setActiveTeamId(next?.id || '')
        setDraftTeam(next ? structuredClone(next) : null)
      }
      setDeleteTarget(null)
      setStatus(copy.deletedTeam)
      refreshStorageEstimate(nextTeams)
    } catch (deleteError) {
      console.error('[OWBT] Failed to delete library team:', deleteError)
      setError(copy.saveFailed)
    }
  }

  const exportBackup = () => {
    const backupText = JSON.stringify(createLibraryBackup(teams), null, 2)
    const backupBytes = new TextEncoder().encode(backupText).byteLength
    if (backupBytes > MAX_TEAM_LIBRARY_BACKUP_BYTES) {
      setStatus('')
      setError(copy.backupTooLarge)
      return
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`owbt-team-library-${date}.json`, backupText)
    setStatus(copy.exportedBackup(teams.length))
    setError('')
  }

  const downloadTeamCsvTemplate = () => {
    downloadTextFile(
      language === 'en' ? 'owbt-team-library-template-en.csv' : 'owbt-team-library-template-zh.csv',
      createTeamLibraryCsvTemplate(language),
      'text/csv;charset=utf-8'
    )
  }

  const downloadPlayerCsvTemplate = () => {
    downloadTextFile(
      language === 'en' ? 'owbt-player-import-template-en.csv' : 'owbt-player-import-template-zh.csv',
      createTeamPlayerCsvTemplate(language),
      'text/csv;charset=utf-8'
    )
  }

  const closeImportCenter = () => {
    setProjectImportOpen(false)
    setProjectImportText('')
  }

  const openBrandingReview = (
    records = teams,
    sourceLabel = copy.library,
    completion = null
  ) => {
    const recordIds = new Set(records.map(record => record.id))
    setBrandingReview({
      records: records.map(record => structuredClone(record)),
      referenceRecords: teams.filter(team => !recordIds.has(team.id)),
      sourceLabel,
      completion
    })
    closeImportCenter()
    setStatus('')
    setError('')
  }

  const updateBrandingReviewShortName = (teamId, shortName) => {
    setBrandingReview(current => current ? {
      ...current,
      records: current.records.map(team => team.id === teamId ? { ...team, shortName } : team)
    } : current)
  }

  const completeBrandingReview = (completion, saved) => {
    if (completion?.kind === 'project-save') {
      onUpdateProject(draft => {
        completion.links.forEach(link => {
          const team = draft.teams.find(item => item.id === link.record.sourceTeamId)
          if (!team) return
          team.libraryId = link.teamLibraryId
          Object.entries(link.playerLinks).forEach(([playerId, libraryPlayerId]) => {
            const player = draft.players.find(item => item.id === playerId)
            if (player) player.libraryPlayerId = libraryPlayerId
          })
        })
      }, { skipUndo: true })
    }

    return completion?.kind === 'backup'
      ? copy.importedBackupSummary(
          completion.additions,
          completion.updates,
          completion.duplicates
        )
      : completion?.kind === 'csv'
        ? copy.importedCsvSummary(
          completion.additions,
          completion.updates,
          completion.skippedRows,
          completion.omittedPlayers,
          completion.duplicatePlayers
          )
        : completion?.kind === 'project-import'
          ? copy.importedProjectTeamSummary(
            completion.additions,
            completion.updates,
            completion.playerCount,
            completion.omittedPlayers
            )
          : completion?.kind === 'project-save'
            ? copy.savedCurrent(saved.length)
            : copy.brandingReviewSaved(saved.length)
  }

  const confirmBrandingReview = async () => {
    if (!brandingReview?.records.length || brandingReviewStats.blocked) return

    try {
      const completion = brandingReview.completion
      const saved = await saveLibraryTeams(brandingReview.records)
      const savedById = new Map(saved.map(team => [team.id, team]))
      const nextTeams = teams.map(team => savedById.get(team.id) || team)
      saved.forEach(team => {
        if (!nextTeams.some(current => current.id === team.id)) nextTeams.unshift(team)
      })
      setTeams(nextTeams)
      setDraftTeam(current => current ? structuredClone(savedById.get(current.id) || current) : current)
      setCopiedPackageSignature('')
      setBrandingReview(null)
      setStatus(completeBrandingReview(completion, saved))
      setError('')
      refreshStorageEstimate(nextTeams)
    } catch (brandingError) {
      console.error('[OWBT] Failed to save branding review:', brandingError)
      setError(copy.saveFailed)
    }
  }

  const prepareProjectTeamImport = (input, sourceLabel) => {
    const parsed = parseOwbtTeamSource(input, teams)
    const plan = {
      ...parsed,
      ...createLibraryMergePlan(parsed.records, teams, {
        preserveMissingFields: parsed.sourceKind !== 'library-backup'
      }),
      sourceLabel
    }
    if (parsed.sourceKind === 'library-backup') {
      setPendingBackupImport(plan)
    } else {
      setPendingProjectImport(plan)
    }
    closeImportCenter()
    setError('')
  }

  const prepareCsvImport = (input, sourceLabel) => {
    const parsed = parseTeamLibraryCsvAuto(input, teams, sourceLabel)
    setPendingCsvImport({
      ...parsed,
      ...createLibraryMergePlan(parsed.records, teams, {
        generatedShortNameIds: parsed.generatedShortNameIds,
        preserveMissingFields: true
      }),
      fileName: sourceLabel
    })
    closeImportCenter()
    setError('')
  }

  const prepareAutomaticImport = (input, sourceLabel, preferCsv = false) => {
    const text = String(input || '').trim()
    if (!text) return
    const textBytes = new TextEncoder().encode(text).byteLength
    const looksLikeJson = text.startsWith('{') || text.startsWith('[')
    const sourceByteLimit = getOwbtTeamSourceByteLimit(text)
    if (textBytes > sourceByteLimit) {
      setError(sourceByteLimit === MAX_TEAM_LIBRARY_BACKUP_BYTES
        ? copy.backupTooLarge
        : copy.projectTeamSourceTooLarge)
      return
    }
    if (!looksLikeJson && textBytes > MAX_TEAM_LIBRARY_CSV_BYTES) {
      setError(copy.csvTooLarge)
      return
    }

    const attempts = preferCsv
      ? [
          { kind: 'csv', run: () => prepareCsvImport(text, sourceLabel) },
          { kind: 'project', run: () => prepareProjectTeamImport(text, sourceLabel) }
        ]
      : looksLikeJson
        ? [
            { kind: 'project', run: () => prepareProjectTeamImport(text, sourceLabel) },
            { kind: 'csv', run: () => prepareCsvImport(text, sourceLabel) }
          ]
        : [
            { kind: 'csv', run: () => prepareCsvImport(text, sourceLabel) },
            { kind: 'project', run: () => prepareProjectTeamImport(text, sourceLabel) }
          ]

    const failures = []
    for (const attempt of attempts) {
      try {
        attempt.run()
        return
      } catch (error) {
        failures.push({ kind: attempt.kind, error })
      }
    }
    console.warn('[OWBT] Import source was not recognized:', failures.map(failure => ({
      kind: failure.kind,
      code: failure.error?.importCode || '',
      message: failure.error?.message || ''
    })))
    setError(getAutomaticImportError(copy, failures, looksLikeJson ? 'project' : preferCsv ? 'csv' : 'csv'))
  }

  const importDataFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const sourceByteLimit = await getImportFileByteLimit(file)
    if (file.size > sourceByteLimit) {
      setError(sourceByteLimit === MAX_TEAM_LIBRARY_BACKUP_BYTES
        ? copy.backupTooLarge
        : copy.projectTeamSourceTooLarge)
      return
    }

    const csvFile = /\.(?:csv|tsv)$/i.test(file.name)
    if (csvFile && file.size > MAX_TEAM_LIBRARY_CSV_BYTES) {
      setError(copy.csvTooLarge)
      return
    }

    try {
      prepareAutomaticImport(await readTextFileAutoEncoding(file), file.name, csvFile)
    } catch (importError) {
      console.error('[OWBT] Failed to read import file:', importError)
      setError(copy.invalidImportSource)
    }
  }

  const importBackupFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_TEAM_LIBRARY_BACKUP_BYTES) {
      setError(copy.backupTooLarge)
      return
    }

    try {
      const parsed = parseOwbtTeamSource(await readTextFileAutoEncoding(file), teams)
      if (parsed.sourceKind !== 'library-backup') throw new Error('Not an OWBT team library backup.')
      setPendingBackupImport({
        ...parsed,
        ...createLibraryMergePlan(parsed.records, teams),
        sourceLabel: file.name
      })
      setStatus('')
      setError('')
    } catch (backupError) {
      console.error('[OWBT] Failed to read team library backup:', backupError)
      setError(copy.invalidBackup)
    }
  }

  const analyzeImportText = () => {
    prepareAutomaticImport(projectImportText, copy.pastedImportText)
  }

  const confirmCsvImport = async () => {
    if (!pendingCsvImport) return
    const importPlan = pendingCsvImport
    if (importPlan.kind !== 'player-csv') {
      setPendingCsvImport(null)
      openBrandingReview(importPlan.records, importPlan.fileName, {
        kind: 'csv',
        additions: importPlan.additions,
        updates: importPlan.updates,
        skippedRows: importPlan.skippedRows,
        omittedPlayers: importPlan.omittedPlayers,
        duplicatePlayers: importPlan.duplicatePlayers
      })
      return
    }
    try {
      const saved = await saveLibraryTeams(importPlan.records)
      const importedIds = new Set(saved.map(team => team.id))
      const nextTeams = [...saved, ...teams.filter(team => !importedIds.has(team.id))]
      const savedById = new Map(saved.map(team => [team.id, team]))
      setTeams(nextTeams)
      setCopiedPackageSignature('')
      setPendingCsvImport(null)
      setError('')
      if (savedById.has(activeTeamId)) {
        setDraftTeam(structuredClone(savedById.get(activeTeamId)))
      } else if (!activeTeamId && saved[0]) {
        setActiveTeamId(saved[0].id)
        setDraftTeam(structuredClone(saved[0]))
      }
      setStatus(copy.importedPlayerCsvSummary(
        importPlan.addedPlayers,
        importPlan.updatedPlayers,
        importPlan.missingTeams,
        importPlan.ambiguousTeams,
        importPlan.omittedPlayers,
        importPlan.updatedStaff
      ))
      refreshStorageEstimate(nextTeams)
    } catch (csvError) {
      console.error('[OWBT] Failed to save CSV teams:', csvError)
      setError(copy.saveFailed)
    }
  }

  const confirmProjectTeamImport = () => {
    if (!pendingProjectImport) return
    const importPlan = pendingProjectImport
    setPendingProjectImport(null)
    openBrandingReview(importPlan.records, importPlan.sourceLabel, {
      kind: 'project-import',
      additions: importPlan.additions,
      updates: importPlan.updates,
      playerCount: importPlan.playerCount,
      omittedPlayers: importPlan.omittedPlayers
    })
  }

  const confirmBackupImport = () => {
    if (!pendingBackupImport) return
    const importPlan = pendingBackupImport
    setPendingBackupImport(null)
    openBrandingReview(importPlan.records, importPlan.sourceLabel, {
      kind: 'backup',
      additions: importPlan.additions,
      updates: importPlan.updates,
      duplicates: importPlan.duplicates
    })
  }

  const importLogoFolder = event => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const reviewContext = brandingReview || pendingLogoFolder?.reviewContext || null
    const sourceTeams = reviewContext?.records || teams
    setPendingLogoFolder({
      ...createTeamLogoFolderPlan(files, sourceTeams),
      reviewContext
    })
    setBrandingReview(null)
    closeImportCenter()
    setStatus('')
    setError('')
  }

  const closeLogoFolderImport = () => {
    const reviewContext = pendingLogoFolder?.reviewContext || null
    setPendingLogoFolder(null)
    if (reviewContext) setBrandingReview(reviewContext)
  }

  const confirmLogoFolderImport = async () => {
    const reviewRecords = pendingLogoFolder?.reviewContext?.records || []
    const reviewCompletion = pendingLogoFolder?.reviewContext?.completion || null
    if ((!pendingLogoFolder?.matches.length && !reviewRecords.length) || logoFolderSaving) return
    setLogoFolderSaving(true)

    try {
      const updatedTeams = []
      let failedCount = 0

      for (const match of pendingLogoFolder.matches) {
        try {
          const result = await optimizeLibraryImage(match.file)
          updatedTeams.push({
            ...match.team,
            logo: result.dataUrl,
            updatedAt: new Date().toISOString()
          })
        } catch {
          failedCount += 1
        }
      }

      if (!updatedTeams.length && !reviewRecords.length) {
        setError(copy.logoFolderAllFailed)
        return
      }

      const updatedById = new Map(updatedTeams.map(team => [team.id, team]))
      const recordsToSave = reviewRecords.length
        ? reviewRecords.map(team => updatedById.get(team.id) || team)
        : updatedTeams
      const saved = await saveLibraryTeams(recordsToSave)
      const savedById = new Map(saved.map(team => [team.id, team]))
      const nextTeams = teams.map(team => savedById.get(team.id) || team)
      saved.forEach(team => {
        if (!nextTeams.some(current => current.id === team.id)) nextTeams.unshift(team)
      })
      setTeams(nextTeams)
      setDraftTeam(current => {
        const savedTeam = current ? savedById.get(current.id) : null
        return savedTeam ? structuredClone(savedTeam) : current
      })
      setCopiedPackageSignature('')
      setPendingLogoFolder(null)
      setStatus(reviewRecords.length
        ? reviewCompletion
          ? completeBrandingReview(reviewCompletion, saved)
          : copy.brandingReviewSavedWithLogos(saved.length, updatedTeams.length, failedCount)
        : copy.importedLogoFolderSummary(saved.length, failedCount))
      setError('')
      refreshStorageEstimate(nextTeams)
    } catch (logoFolderError) {
      console.error('[OWBT] Failed to import team logo folder:', logoFolderError)
      setError(copy.saveFailed)
    } finally {
      setLogoFolderSaving(false)
    }
  }

  const uploadLogo = async file => {
    if (!isSupportedImage(file)) {
      setError(copy.invalidImage)
      return
    }
    try {
      const result = await optimizeLibraryImage(file)
      updateDraftField('logo', result.dataUrl)
      setStatus(result.compressed
        ? copy.imageOptimized(formatBytes(result.originalBytes), formatBytes(result.outputBytes))
        : copy.imageReady(formatBytes(result.outputBytes)))
      setError('')
    } catch {
      setStatus('')
      setError(copy.invalidImage)
    }
  }

  const selectPlayerAvatar = playerId => {
    playerAvatarTargetRef.current = playerId
    playerAvatarInputRef.current?.click()
  }

  const uploadPlayerAvatar = async file => {
    const playerId = playerAvatarTargetRef.current
    const player = draftTeam?.players.find(candidate => candidate.id === playerId)
    if (!player || !isSupportedImage(file)) {
      setError(copy.invalidImage)
      return
    }

    try {
      const result = await optimizeLibraryImage(file, {
        maxDimension: 512,
        targetBytes: PLAYER_AVATAR_TARGET_BYTES
      })
      updateDraftPlayer(playerId, { avatar: result.dataUrl })
      setStatus(result.compressed
        ? copy.avatarOptimized(player.name, formatBytes(result.originalBytes), formatBytes(result.outputBytes))
        : copy.avatarReady(player.name, formatBytes(result.outputBytes)))
      setError('')
    } catch {
      setStatus('')
      setError(copy.invalidImage)
    }
  }

  const libraryPlayerCount = teams.reduce((count, team) => count + team.players.length, 0)
  const duplicateGroups = useMemo(() => getLibraryDuplicateGroups(teams), [teams])
  const duplicateCountById = useMemo(() => {
    const counts = new Map()
    duplicateGroups.forEach(group => group.forEach(team => counts.set(team.id, group.length)))
    return counts
  }, [duplicateGroups])
  const duplicateCleanupPlans = useMemo(() => {
    if (!duplicateCleanup) return []
    return duplicateCleanup.groups.map(group => {
      const identity = getLibraryTeamIdentity(group[0])
      return mergeLibraryDuplicateGroup(group, duplicateCleanup.keeperIds[identity])
    })
  }, [duplicateCleanup])
  const duplicateCleanupRemoved = duplicateCleanupPlans.reduce((count, plan) => count + plan.removedIds.length, 0)
  const duplicateCleanupOmitted = duplicateCleanupPlans.reduce((count, plan) => count + plan.omittedPlayers.length, 0)
  const selectedTeams = useMemo(
    () => selectedIds.map(id => teams.find(team => team.id === id)).filter(Boolean),
    [selectedIds, teams]
  )
  const matchPickerNeedle = matchPickerSearch.trim().toLocaleLowerCase()
  const matchPickerTeams = useMemo(() => {
    if (matchPickerSide === null) return []
    const unavailableTeamId = selectedIds[matchPickerSide === 0 ? 1 : 0] || ''
    return teams.filter(team => {
      if (team.id === unavailableTeamId) return false
      if (!matchPickerNeedle) return true
      return [
        team.name,
        team.shortName,
        team.manager,
        team.coach,
        ...(team.players || []).flatMap(player => [player.name, player.battleTag])
      ].some(value => String(value || '').toLocaleLowerCase().includes(matchPickerNeedle))
    })
  }, [matchPickerNeedle, matchPickerSide, selectedIds, teams])
  const packageHealth = useMemo(() => analyzeMatchPackageHealth(selectedTeams), [selectedTeams])
  const selectedPackageBytes = packageHealth.packageBytes
  const packageSizeWarning = packageHealth.status === MATCH_PACKAGE_HEALTH_STATUS.WARNING
  const packageBlocked = packageHealth.status === MATCH_PACKAGE_HEALTH_STATUS.BLOCKED
  const selectedPackageSignature = selectedIds.join('|')
  const packageCopied = selectedIds.length === MATCH_PACKAGE_TEAM_COUNT && copiedPackageSignature === selectedPackageSignature
  const roleOptions = [
    { value: 'tank', label: copy.roleTank },
    { value: 'damage', label: copy.roleDamage },
    { value: 'support', label: copy.roleSupport }
  ]
  const draftLogoBytes = getDataUrlByteSize(draftTeam?.logo)
  const draftLogoSource = !draftTeam?.logo
    ? copy.logoSourceMissing
    : draftLogoBytes
      ? copy.logoSourceLocal(getDataImageFormat(draftTeam.logo), formatBytes(draftLogoBytes))
      : copy.logoSourceRemote

  const openDuplicateCleanup = () => {
    if (!duplicateGroups.length) return
    setDuplicateCleanup({
      groups: duplicateGroups,
      keeperIds: Object.fromEntries(duplicateGroups.map(group => [
        getLibraryTeamIdentity(group[0]),
        group[0].id
      ]))
    })
    setStatus('')
    setError('')
  }

  const updateDuplicateKeeper = (identity, teamId) => {
    setDuplicateCleanup(previous => previous ? {
      ...previous,
      keeperIds: {
        ...previous.keeperIds,
        [identity]: teamId
      }
    } : previous)
  }

  const confirmDuplicateCleanup = async () => {
    if (!duplicateCleanupPlans.length) return

    try {
      const saved = await mergeLibraryTeamGroups(duplicateCleanupPlans)
      const savedById = new Map(saved.map(team => [team.id, team]))
      const removedToKeeper = new Map()
      const playerIdMap = {}

      duplicateCleanupPlans.forEach(plan => {
        plan.removedIds.forEach(teamId => removedToKeeper.set(teamId, plan.keeperId))
        Object.assign(playerIdMap, plan.playerIdMap)
      })

      const removedIds = new Set(removedToKeeper.keys())
      const nextTeams = teams
        .filter(team => !removedIds.has(team.id))
        .map(team => savedById.get(team.id) || team)
      const nextActiveId = removedToKeeper.get(activeTeamId) || activeTeamId
      const nextActiveTeam = nextTeams.find(team => team.id === nextActiveId) || null

      onUpdateProject?.(draft => {
        const draftTeams = draft.teams || []
        const draftPlayers = draft.players || []
        draftTeams.forEach(team => {
          const keeperId = removedToKeeper.get(team.libraryId)
          if (keeperId) team.libraryId = keeperId
        })
        draftPlayers.forEach(player => {
          if (!Object.prototype.hasOwnProperty.call(playerIdMap, player.libraryPlayerId)) return
          player.libraryPlayerId = playerIdMap[player.libraryPlayerId] || ''
        })
      }, { skipUndo: true })

      setTeams(nextTeams)
      setSelectedIds(previous => [...new Set(previous.map(teamId => (
        removedToKeeper.get(teamId) || teamId
      )))].slice(0, MATCH_PACKAGE_TEAM_COUNT))
      setActiveTeamId(nextActiveId)
      if (removedToKeeper.has(activeTeamId) || savedById.has(activeTeamId)) {
        setDraftTeam(nextActiveTeam ? structuredClone(nextActiveTeam) : null)
      }
      setCopiedPackageSignature('')
      setDuplicateCleanup(null)
      setStatus(copy.duplicateMergeComplete(
        duplicateCleanupPlans.length,
        duplicateCleanupRemoved,
        duplicateCleanupOmitted
      ))
      setError('')
      refreshStorageEstimate(nextTeams)
    } catch (mergeError) {
      console.error('[OWBT] Failed to merge duplicate library teams:', mergeError)
      setError(copy.saveFailed)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.gridLayer} />
      <header className={styles.topbar}>
        <div className={styles.identity}>
          <button type="button" className={styles.backButton} onClick={requestBack} aria-label={copy.back}>←</button>
          <img src="/OWBT.svg" alt="" />
          <div>
            <span>{copy.kicker}</span>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
        </div>
        <div className={styles.topActions}>
          <button type="button" onClick={() => setGuideOpen(true)}>{copy.guideButton}</button>
          <button type="button" onClick={() => requestProtectedAction('import')}>{copy.importCenter}</button>
          <button type="button" className={styles.primaryButton} onClick={requestCreateTeam}>{copy.createTeam}</button>
        </div>
      </header>
      <input
        ref={projectImportInputRef}
        type="file"
        accept="application/json,.json,.owbt,.owbtproject,text/csv,.csv,text/tab-separated-values,.tsv,text/plain,.txt"
        hidden
        onChange={importDataFile}
      />
      <input
        ref={backupImportInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importBackupFile}
      />
      <input
        ref={logoFolderInputRef}
        type="file"
        accept="image/*,.svg"
        multiple
        webkitdirectory=""
        hidden
        onChange={importLogoFolder}
      />

      <section className={styles.contextGrid}>
        <section className={styles.contextPanel}>
          <header className={styles.contextPanelHeader}>
            <span>{copy.teamAssets}</span>
            <strong>{teams.length}</strong>
          </header>
          <div className={styles.contextStats}>
            <div><span>{copy.teams}</span><strong>{teams.length}</strong></div>
            <div><span>{copy.playersLabel}</span><strong>{libraryPlayerCount}</strong></div>
            <div><span>{copy.suspectedDuplicates}</span><strong>{duplicateGroups.length}</strong></div>
          </div>
          <div className={`${styles.contextActions} ${styles.teamContextActions}`}>
            <button type="button" onClick={() => requestProtectedAction('project-save')} disabled={!(project.teams || []).length}>
              {copy.saveCurrent}
            </button>
            <button type="button" onClick={openDuplicateCleanup} disabled={!duplicateGroups.length}>
              {copy.organizeDuplicates}
            </button>
          </div>
        </section>

        <section className={`${styles.contextPanel} ${styles.matchPackagePanel}`}>
          <header className={styles.contextPanelHeader}>
            <span>{copy.matchPackage}</span>
            <strong>{selectedTeams.length} / {MATCH_PACKAGE_TEAM_COUNT}</strong>
          </header>
          <div className={styles.matchPackageSlots}>
            {[copy.sideA, copy.sideB].map((side, index) => {
              const team = selectedTeams[index]
              const pickerOpen = matchPickerSide === index
              const pickerDisabled = index === 1 && !selectedIds[0]
              return (
                <div className={styles.matchPackageSlotWrap} key={side}>
                  <button
                    type="button"
                    className={`${styles.matchPackageSlot} ${team ? styles.matchPackageSlotReady : ''} ${pickerOpen ? styles.matchPackageSlotOpen : ''}`}
                    onClick={() => openMatchPicker(index)}
                    disabled={pickerDisabled}
                    aria-expanded={pickerOpen}
                    aria-haspopup="dialog"
                  >
                    <span className={styles.matchPackageSide}>{side}</span>
                    {team ? (
                      <>
                        <TeamMark team={team} />
                        <span className={styles.matchPackageIdentity}>
                          <strong>{team.name}</strong>
                          <em>{team.shortName} / {copy.players(team.players.length)}</em>
                        </span>
                      </>
                    ) : (
                      <em className={styles.matchPackageEmpty}>
                        {pickerDisabled ? copy.selectTeamAFirst : index === 0 ? copy.selectTeamA : copy.selectTeamB}
                      </em>
                    )}
                    <span className={styles.matchPackageChevron} aria-hidden="true">⌄</span>
                  </button>
                  {pickerOpen && (
                    <>
                      <div
                        className={styles.matchPickerBackdrop}
                        aria-hidden="true"
                        onClick={() => {
                          setMatchPickerSide(null)
                          setMatchPickerSearch('')
                        }}
                      />
                      <div className={`${styles.matchPicker} ${index === 1 ? styles.matchPickerRight : ''}`} role="dialog" aria-label={copy.chooseMatchTeam(side)}>
                        <header className={styles.matchPickerHeader}>
                          <span>{copy.chooseMatchTeam(side)}</span>
                          <strong>{matchPickerTeams.length}</strong>
                        </header>
                        <label className={styles.matchPickerSearch}>
                          <span>{copy.matchPickerSearch}</span>
                          <input
                            ref={matchPickerInputRef}
                            type="search"
                            value={matchPickerSearch}
                            onChange={event => setMatchPickerSearch(event.target.value)}
                            placeholder={copy.matchPickerSearch}
                          />
                        </label>
                        <div className={styles.matchPickerList} role="list" aria-label={copy.chooseMatchTeam(side)}>
                          {matchPickerTeams.map(candidate => (
                            <label
                              className={`${styles.matchPickerOption} ${team?.id === candidate.id ? styles.matchPickerOptionSelected : ''}`}
                              key={candidate.id}
                            >
                              <input
                                type="radio"
                                name={`match-team-${index}`}
                                value={candidate.id}
                                checked={team?.id === candidate.id}
                                onChange={() => selectMatchTeam(candidate.id)}
                              />
                              <TeamMark team={candidate} />
                              <span>
                                <strong>{candidate.name}</strong>
                                <em>{candidate.shortName} / {copy.players(candidate.players.length)}</em>
                              </span>
                              {team?.id === candidate.id && <b>{copy.currentSelection}</b>}
                            </label>
                          ))}
                          {!matchPickerTeams.length && (
                            <div className={styles.matchPickerEmpty}>{copy.matchPickerNoResults}</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <footer className={styles.matchPackageActions}>
            <div className={(packageSizeWarning || packageBlocked) ? styles.packageStatusWarning : ''}>
              <span>
                {copy.matchPackageStatus(selectedTeams.length)}
                {selectedPackageBytes > 0 && ` · ${copy.packageSize(formatBytes(selectedPackageBytes), formatBytes(MATCH_PACKAGE_MAX_BYTES))}`}
              </span>
              <strong>
                {packageCopied
                  ? copy.matchPackageNextStep
                  : packageBlocked
                    ? copy.healthBlockedSummary
                    : packageSizeWarning
                      ? copy.healthWarningSummary(packageHealth.issues.length)
                      : copy.selectionHint}
              </strong>
            </div>
            <button type="button" onClick={swapSelectedMatchSides} disabled={selectedIds.length !== MATCH_PACKAGE_TEAM_COUNT}>
              {copy.swapMatchSides}
            </button>
            <button type="button" onClick={clearSelectedMatch} disabled={!selectedIds.length}>
              {copy.clearMatchSelection}
            </button>
            <button
              type="button"
              className={packageHealth.issues.length ? styles.healthCheckWarning : ''}
              onClick={() => setHealthDialogOpen(true)}
              disabled={selectedTeams.length !== MATCH_PACKAGE_TEAM_COUNT}
            >
              {copy.healthCheck(packageHealth.issues.length)}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={selectedIds.length !== MATCH_PACKAGE_TEAM_COUNT || packageBlocked}
              onClick={copySelectedMatchPackage}
            >
              {packageCopied ? copy.copyMatchPackageAgain : copy.copyMatchPackage}
            </button>
          </footer>
        </section>

        <section className={styles.contextPanel}>
          <header className={styles.contextPanelHeader}>
            <span>{copy.localStorage}</span>
            <strong className={hasUnsavedDraft ? styles.saveStatePending : styles.saveStateReady}>
              {hasUnsavedDraft
                ? copy.localSavePending
                : teams.length
                  ? copy.savedLocally
                  : copy.localLibraryEmpty}
            </strong>
          </header>
          <div className={styles.storageSummary}>
            <div>
              <span>{copy.saveState}</span>
              <strong className={hasUnsavedDraft ? styles.saveStatePending : styles.saveStateReady}>
                {hasUnsavedDraft
                  ? copy.localSavePending
                  : teams.length
                    ? copy.savedLocally
                    : copy.localLibraryEmpty}
              </strong>
            </div>
            <div>
              <span>{copy.librarySize}</span>
              <strong>{formatBytes(storageEstimate?.libraryBytes)}</strong>
            </div>
            <div>
              <span>{copy.persistentStorage}</span>
              <strong>{storageEstimate?.persisted ? copy.persistenceEnabled : copy.persistenceUnavailable}</strong>
            </div>
          </div>
          <div className={styles.contextActions}>
            <button type="button" onClick={() => requestProtectedAction('backup-import')}>{copy.importBackup}</button>
            <button type="button" onClick={exportBackup} disabled={!teams.length}>{copy.exportBackup}</button>
          </div>
        </section>
      </section>

      {(status || error) && (
        <div className={`${styles.notice} ${error ? styles.noticeError : ''}`} role="status">
          {error || status}
        </div>
      )}

      <section className={styles.workspace}>
        <aside className={styles.libraryRail}>
          <header className={styles.libraryRailHeader}>
            <span>{copy.teamAssets}</span>
            <strong>{visibleTeams.length} / {teams.length}</strong>
          </header>
          <label className={styles.searchField}>
            <span>{copy.search}</span>
            <input
              type="search"
              value={search}
              onChange={event => {
                setSearch(event.target.value)
                setVisibleTeamLimit(TEAM_LIST_BATCH_SIZE)
              }}
              placeholder={copy.search}
            />
          </label>

          <div className={styles.teamList}>
            {loading && <div className={styles.emptyState}>{copy.library}...</div>}
            {!loading && !teams.length && (
              <div className={`${styles.emptyState} ${styles.railEmptyState}`}>
                <strong>{copy.railEmpty}</strong>
                <span>{copy.railEmptyBody}</span>
              </div>
            )}
            {!loading && teams.length > 0 && !visibleTeams.length && (
              <div className={styles.emptyState}>{copy.noResults}</div>
            )}
            {renderedTeams.map(team => {
              const linked = projectTeamLibraryIds.has(team.id)
              const duplicateCount = duplicateCountById.get(team.id) || 0
              return (
                <div
                  key={team.id}
                  className={`${styles.teamRow} ${activeTeamId === team.id ? styles.teamRowActive : ''}`}
                >
                  <button type="button" className={styles.teamRowContent} onClick={() => selectTeam(team)}>
                    <TeamMark team={team} />
                    <span className={styles.teamIdentity}>
                      <strong>{team.shortName || '-'}</strong>
                      <em>{team.name}</em>
                    </span>
                    <span className={styles.teamMeta}>
                      <strong>{copy.players(team.players.length)}</strong>
                      <em className={duplicateCount ? styles.duplicateMeta : ''}>
                        {duplicateCount
                          ? copy.suspectedDuplicate(duplicateCount)
                          : linked ? copy.linked : `${copy.updated} ${formatDate(team.updatedAt, language)}`}
                      </em>
                    </span>
                  </button>
                </div>
              )
            })}
            {renderedTeams.length < visibleTeams.length && (
              <button
                type="button"
                className={styles.loadMoreButton}
                onClick={() => setVisibleTeamLimit(previous => previous + TEAM_LIST_BATCH_SIZE)}
              >
                <strong>{copy.loadMore}</strong>
                <span>{copy.showingTeams(renderedTeams.length, visibleTeams.length)}</span>
              </button>
            )}
          </div>

        </aside>

        <section className={styles.editor}>
          {!draftTeam ? (
            <div className={styles.editorEmpty}>
              <span className={styles.emptyKicker}>{copy.emptyKicker}</span>
              <strong>{copy.emptyStartTitle}</strong>
              <p>{copy.emptyStartBody}</p>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.primaryButton} onClick={createTeam}>{copy.createTeam}</button>
                <button type="button" onClick={() => requestProtectedAction('project-save')} disabled={!(project.teams || []).length}>{copy.saveCurrent}</button>
                <button type="button" onClick={() => requestProtectedAction('import')}>{copy.importCenter}</button>
              </div>
            </div>
          ) : (
            <>
              <header className={styles.editorHeader}>
                <div>
                  <span>{copy.inspect}</span>
                  <h2>{draftTeam.shortName || draftTeam.name}</h2>
                </div>
                <TeamMark team={draftTeam} />
              </header>

              <div className={styles.teamOverview}>
                <div className={styles.teamFields}>
                  <label><span>{copy.teamName}</span><input value={draftTeam.name} onChange={event => updateDraftField('name', event.target.value)} /></label>
                  <label><span>{copy.shortName}</span><input value={draftTeam.shortName} onChange={event => updateDraftField('shortName', event.target.value)} /></label>
                  <label><span>{copy.manager}</span><input value={draftTeam.manager} onChange={event => updateDraftField('manager', event.target.value)} /></label>
                  <label><span>{copy.coach}</span><input value={draftTeam.coach} onChange={event => updateDraftField('coach', event.target.value)} /></label>
                  <label className={styles.wideField}><span>{copy.description}</span><textarea value={draftTeam.description} onChange={event => updateDraftField('description', event.target.value)} /></label>
                </div>

                <section className={styles.teamAssetPanel}>
                  <header><span>{copy.visualAssets}</span></header>
                  <div className={styles.logoAssetSummary}>
                    <TeamMark team={draftTeam} />
                    <div>
                      <strong>{draftTeam.logo ? copy.logoReady : copy.logoMissing}</strong>
                      <span>{draftLogoSource}</span>
                    </div>
                  </div>
                  <label className={styles.logoUrlField}>
                    <span>{copy.logoUrl}</span>
                    <input
                      value={draftTeam.logo?.startsWith('data:') ? '' : draftTeam.logo}
                      onChange={event => updateDraftField('logo', event.target.value)}
                      placeholder={draftLogoBytes ? copy.localImageLoaded : copy.logoUrlPlaceholder}
                    />
                  </label>
                  <div className={styles.logoAssetActions}>
                    <button type="button" onClick={() => logoInputRef.current?.click()}>{copy.upload}</button>
                    <button type="button" onClick={() => updateDraftField('logo', '')} disabled={!draftTeam.logo}>{copy.clear}</button>
                  </div>
                  <label className={styles.assetColorField}>
                    <span>{copy.primaryColor}</span>
                    <div className={styles.colorField}>
                      <input type="color" value={draftTeam.primaryColor || '#4ed1ad'} onChange={event => updateDraftField('primaryColor', event.target.value)} />
                      <input value={draftTeam.primaryColor} onChange={event => updateDraftField('primaryColor', event.target.value)} placeholder="#4ed1ad" />
                    </div>
                  </label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*,.svg"
                    hidden
                    onChange={event => {
                      uploadLogo(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </section>
              </div>

              <section className={styles.rosterSection}>
                <header>
                  <div><span>{copy.roster}</span><strong>{draftTeam.players.length} / {MAX_ROSTER_PLAYERS}</strong></div>
                  <button type="button" onClick={addPlayer} disabled={draftTeam.players.length >= MAX_ROSTER_PLAYERS}>{copy.addPlayer}</button>
                </header>
                <div className={styles.playerHeader}>
                  <span>#</span><span>{copy.playerName}</span><span>{copy.battleTag}</span><span>{copy.role}</span><span />
                </div>
                <div className={styles.playerList}>
                  {draftTeam.players.map((player, index) => (
                    <div className={styles.playerRow} key={player.id}>
                      <div className={styles.playerCoreRow}>
                        <span>{index + 1}</span>
                        <input value={player.name} onChange={event => updateDraftPlayer(player.id, { name: event.target.value })} />
                        <input value={player.battleTag} onChange={event => updateDraftPlayer(player.id, { battleTag: event.target.value })} />
                        <select
                          value={normalizeRosterRole(player.role)}
                          onChange={event => updateDraftPlayer(player.id, {
                            role: event.target.value,
                            primaryHeroes: [getDefaultHeroForRole(event.target.value)].filter(Boolean)
                          })}
                        >
                          {roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <button type="button" className={styles.dangerButton} onClick={() => removePlayer(player.id)}>{copy.remove}</button>
                      </div>
                      <div className={styles.playerAssetRow}>
                        <PlayerMark player={player} />
                        <label className={styles.playerAvatarField}>
                          <span>{copy.playerAvatar}</span>
                          <div className={styles.playerAvatarControl}>
                            <input
                              value={player.avatar?.startsWith('data:') ? '' : player.avatar || ''}
                              onChange={event => updateDraftPlayer(player.id, { avatar: event.target.value })}
                              placeholder={player.avatar?.startsWith('data:') ? copy.localImageLoaded : copy.playerAvatarPlaceholder}
                            />
                            <button type="button" onClick={() => selectPlayerAvatar(player.id)}>{copy.upload}</button>
                            <button type="button" onClick={() => updateDraftPlayer(player.id, { avatar: '' })} disabled={!player.avatar}>{copy.clear}</button>
                          </div>
                        </label>
                        <label className={styles.playerAssetField}>
                          <span>{copy.primaryHero}</span>
                          <select
                            value={player.primaryHeroes?.[0] || ''}
                            onChange={event => updateDraftPlayer(player.id, { primaryHeroes: [event.target.value].filter(Boolean) })}
                          >
                            <option value="">{copy.none}</option>
                            {(OW_HEROES_BY_ROLE[normalizeRosterRole(player.role)] || []).map(hero => (
                              <option key={hero.id} value={hero.id}>{language === 'en' ? hero.en : hero.zh}</option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.playerAssetField}>
                          <span>{copy.portraitPosition}</span>
                          <div className={styles.portraitPositionControl}>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={normalizePortraitXPct(player.portraitXPct)}
                              onChange={event => updateDraftPlayer(player.id, { portraitXPct: normalizePortraitXPct(event.target.value) })}
                            />
                            <strong>{normalizePortraitXPct(player.portraitXPct)}%</strong>
                          </div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <footer className={styles.editorActions}>
                <button type="button" className={styles.dangerButton} onClick={() => setDeleteTarget(draftTeam)}>{copy.delete}</button>
                <button type="button" className={styles.primaryButton} onClick={saveDraft}>{copy.save}</button>
              </footer>
              <input
                ref={playerAvatarInputRef}
                type="file"
                accept="image/*,.svg"
                hidden
                onChange={event => {
                  uploadPlayerAvatar(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </>
          )}
        </section>
      </section>

      {pendingNavigation && (
        <EditorDialog
          kicker={copy.library}
          title={copy.unsavedTitle}
          message={copy.unsavedMessage}
          tone="danger"
          actions={[
            { label: copy.keepEditing, onClick: () => setPendingNavigation(null) },
            { label: copy.discardChanges, tone: 'danger', onClick: discardDraftAndContinue }
          ]}
        />
      )}

      {duplicateTarget && (
        <EditorDialog
          kicker={copy.library}
          title={copy.duplicateTitle}
          message={copy.duplicateMessage(duplicateTarget.name)}
          actions={[
            { label: copy.cancel, onClick: () => setDuplicateTarget(null) },
            {
              label: copy.openExisting,
              tone: 'primary',
              onClick: () => {
                const existing = duplicateTarget
                setDuplicateTarget(null)
                activateTeam(existing)
              }
            }
          ]}
        />
      )}

      {duplicateCleanup && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={copy.duplicateCleanupTitle}
          message={copy.duplicateCleanupMessage}
          actions={[
            { label: copy.cancel, onClick: () => setDuplicateCleanup(null) },
            { label: copy.exportBackupFirst, onClick: exportBackup },
            { label: copy.confirmDuplicateMerge, tone: 'danger', onClick: confirmDuplicateCleanup }
          ]}
        >
          <div className={styles.duplicateCleanupSummary}>
            <div><span>{copy.suspectedDuplicates}</span><strong>{copy.duplicateCleanupGroups(duplicateCleanupPlans.length)}</strong></div>
            <div><span>{copy.delete}</span><strong>{copy.duplicateCleanupRemoved(duplicateCleanupRemoved)}</strong></div>
            <div><span>{copy.playersLabel}</span><strong>{copy.duplicateCleanupOmitted(duplicateCleanupOmitted)}</strong></div>
          </div>
          <div className={styles.duplicateGroups}>
            {duplicateCleanup.groups.map(group => {
              const identity = getLibraryTeamIdentity(group[0])
              const keeperId = duplicateCleanup.keeperIds[identity]
              return (
                <section className={styles.duplicateGroup} key={identity}>
                  <header>
                    <div>
                      <strong>{group[0].name}</strong>
                      <span>{group[0].shortName}</span>
                    </div>
                    <em>{copy.suspectedDuplicate(group.length)}</em>
                  </header>
                  <div className={styles.duplicateCandidates}>
                    {group.map(team => {
                      const selected = team.id === keeperId
                      const linked = projectTeamLibraryIds.has(team.id)
                      return (
                        <label
                          className={`${styles.duplicateCandidate} ${selected ? styles.duplicateCandidateSelected : ''}`}
                          key={team.id}
                        >
                          <input
                            type="radio"
                            name={`duplicate-${identity}`}
                            checked={selected}
                            onChange={() => updateDuplicateKeeper(identity, team.id)}
                          />
                          <TeamMark team={team} />
                          <span className={styles.duplicateCandidateIdentity}>
                            <strong>{team.name}</strong>
                            <em>{team.shortName} / {copy.players(team.players.length)}</em>
                          </span>
                          <span className={styles.duplicateCandidateState}>
                            <strong>{selected ? copy.keeperSelected : copy.keepVersion}</strong>
                            <em>{linked ? copy.linked : `${copy.updated} ${formatDate(team.updatedAt, language)}`}</em>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </EditorDialog>
      )}

      {pendingProjectSave && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={copy.saveProjectPreviewTitle}
          message={copy.saveProjectPreviewMessage}
          actions={[
            { label: copy.cancel, onClick: () => setPendingProjectSave(null) },
            { label: copy.confirmProjectSave, tone: 'primary', onClick: confirmProjectTeamSave }
          ]}
        >
          <MergePreview plan={pendingProjectSave} copy={copy} showDuplicates={false} />
        </EditorDialog>
      )}

      {pendingCsvImport && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={pendingCsvImport.kind === 'player-csv' ? copy.playerCsvPreviewTitle : copy.csvPreviewTitle}
          message={pendingCsvImport.kind === 'player-csv' ? copy.playerCsvPreviewMessage : copy.csvPreviewMessage}
          actions={[
            { label: copy.cancel, onClick: () => setPendingCsvImport(null) },
            {
              label: copy.confirmCsvImport,
              tone: 'primary',
              disabled: !pendingCsvImport.records.length,
              onClick: confirmCsvImport
            }
          ]}
        >
          <div className={styles.mergeSource}>
            <span>{pendingCsvImport.kind === 'player-csv' ? copy.playerCsv : copy.teamCsv}</span>
            <strong>{pendingCsvImport.fileName}</strong>
          </div>
          {pendingCsvImport.kind === 'player-csv' ? (
            <>
              <div className={styles.projectImportStats}>
                <div><span>{copy.playerCsvAdded}</span><strong>{pendingCsvImport.addedPlayers}</strong></div>
                <div><span>{copy.playerCsvUpdated}</span><strong>{pendingCsvImport.updatedPlayers}</strong></div>
                <div><span>{copy.playerCsvUnmatched}</span><strong>{pendingCsvImport.missingTeams + pendingCsvImport.ambiguousTeams}</strong></div>
                <div><span>{copy.csvOmittedPlayers}</span><strong>{pendingCsvImport.omittedPlayers}</strong></div>
              </div>
              <div className={styles.csvImportWarnings}>
                <span>{copy.playerCsvWarnings}</span>
                <strong>{copy.playerCsvWarningSummary(
                  pendingCsvImport.missingTeams,
                  pendingCsvImport.ambiguousTeams,
                  pendingCsvImport.duplicatePlayers,
                  pendingCsvImport.missingRoles,
                  pendingCsvImport.skippedRows,
                  pendingCsvImport.updatedStaff
                )}</strong>
              </div>
            </>
          ) : (
            <div className={styles.csvImportStats}>
              <div><span>{copy.csvSkippedRows}</span><strong>{pendingCsvImport.skippedRows}</strong></div>
              <div><span>{copy.csvOmittedPlayers}</span><strong>{pendingCsvImport.omittedPlayers}</strong></div>
              <div><span>{copy.csvDuplicatePlayers}</span><strong>{pendingCsvImport.duplicatePlayers}</strong></div>
            </div>
          )}
          <MergePreview plan={pendingCsvImport} copy={copy} />
        </EditorDialog>
      )}

      {brandingReview && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={copy.brandingReviewTitle}
          message={copy.brandingReviewMessage}
          actions={[
            {
              label: brandingReview.completion ? copy.cancelImport : copy.brandingReviewLater,
              onClick: () => setBrandingReview(null)
            },
            {
              label: copy.brandingReviewChooseLogos,
              disabled: brandingReviewStats.blocked,
              onClick: () => logoFolderInputRef.current?.click()
            },
            {
              label: copy.brandingReviewSave,
              tone: 'primary',
              disabled: brandingReviewStats.blocked,
              onClick: confirmBrandingReview
            }
          ]}
        >
          <div className={styles.mergeSource}>
            <span>{copy.brandingReviewSource}</span>
            <strong>{brandingReview.sourceLabel || copy.library}</strong>
          </div>
          <div className={styles.brandingReviewStats}>
            <div><span>{copy.teams}</span><strong>{brandingReviewStats.teams}</strong></div>
            <div><span>{copy.brandingReviewLogoReady}</span><strong>{brandingReviewStats.readyLogos}</strong></div>
            <div><span>{copy.brandingReviewMissingLogo}</span><strong>{brandingReviewStats.missingLogos}</strong></div>
            <div><span>{copy.brandingReviewConflicts}</span><strong>{brandingReviewStats.missingShortNames + brandingReviewStats.duplicateTeams}</strong></div>
          </div>
          {brandingReviewStats.blocked && (
            <div className={styles.brandingReviewWarning} role="status">
              <strong>{copy.brandingReviewBlocked}</strong>
              <span>{copy.brandingReviewBlockedMeta(
                brandingReviewStats.missingShortNames,
                brandingReviewStats.duplicateTeams
              )}</span>
            </div>
          )}
          <div className={styles.brandingReviewList}>
            {brandingReview.records.map(team => {
              const shortNameKey = getShortNameKey(team.shortName)
              const shortNameInvalid = !shortNameKey || brandingReviewStats.duplicateKeys.has(shortNameKey)
              return (
                <article className={shortNameInvalid ? styles.brandingReviewRowInvalid : ''} key={team.id}>
                  <TeamMark team={team} />
                  <div className={styles.brandingReviewIdentity}>
                    <strong>{team.name}</strong>
                    <span>{copy.players(team.players.length)}</span>
                  </div>
                  <label className={styles.brandingReviewShortName}>
                    <span>{copy.shortName}</span>
                    <input
                      value={team.shortName}
                      maxLength={16}
                      onChange={event => updateBrandingReviewShortName(team.id, event.target.value)}
                      aria-invalid={shortNameInvalid}
                    />
                  </label>
                  <span className={team.logo ? styles.brandingReviewReady : styles.brandingReviewMissing}>
                    {team.logo ? copy.logoReady : copy.logoMissing}
                  </span>
                </article>
              )
            })}
          </div>
        </EditorDialog>
      )}

      {projectImportOpen && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={copy.importCenterTitle}
          message={copy.importCenterMessage}
          actions={[
            { label: copy.cancel, onClick: closeImportCenter },
            { label: copy.selectImportFile, onClick: () => projectImportInputRef.current?.click() },
            {
              label: copy.analyzeImportText,
              tone: 'primary',
              disabled: !projectImportText.trim(),
              onClick: analyzeImportText
            }
          ]}
        >
          <div className={styles.importCenterTools}>
            <button type="button" onClick={downloadTeamCsvTemplate}>
              <strong>{copy.downloadTeamCsvTemplate}</strong>
              <span>{copy.teamCsvTemplateMeta}</span>
            </button>
            <button type="button" onClick={downloadPlayerCsvTemplate}>
              <strong>{copy.downloadPlayerCsvTemplate}</strong>
              <span>{copy.playerCsvTemplateMeta}</span>
            </button>
            <button
              type="button"
              disabled={!teams.length}
              onClick={() => requestProtectedAction('logo-folder')}
            >
              <strong>{copy.importLogoFolder}</strong>
              <span>{copy.logoFolderToolMeta}</span>
            </button>
            <button
              type="button"
              disabled={!teams.length}
              onClick={() => requestProtectedAction('branding')}
            >
              <strong>{copy.brandingReviewTool}</strong>
              <span>{copy.brandingReviewToolMeta}</span>
            </button>
          </div>
          <textarea
            className={styles.projectImportTextarea}
            value={projectImportText}
            onChange={event => setProjectImportText(event.target.value)}
            placeholder={copy.importCenterPlaceholder}
            spellCheck={false}
          />
        </EditorDialog>
      )}

      {pendingProjectImport && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={copy.projectTeamPreviewTitle}
          message={copy.projectTeamPreviewMessage}
          actions={[
            { label: copy.cancel, onClick: () => setPendingProjectImport(null) },
            {
              label: copy.chooseAnotherProjectSource,
              onClick: () => {
                setPendingProjectImport(null)
                setProjectImportOpen(true)
              }
            },
            { label: copy.confirmProjectTeamImport, tone: 'primary', onClick: confirmProjectTeamImport }
          ]}
        >
          <div className={styles.mergeSource}>
            <span>{copy.projectTeamSource}</span>
            <strong>{pendingProjectImport.sourceLabel || pendingProjectImport.sourceName || '-'}</strong>
          </div>
          <div className={styles.projectImportStats}>
            <div><span>{copy.projectSourceType}</span><strong>{copy.projectSourceKinds[pendingProjectImport.sourceKind] || copy.projectSourceKinds.generic}</strong></div>
            <div><span>{copy.teams}</span><strong>{pendingProjectImport.teamCount}</strong></div>
            <div><span>{copy.playersLabel}</span><strong>{pendingProjectImport.playerCount}</strong></div>
            <div><span>{copy.csvOmittedPlayers}</span><strong>{pendingProjectImport.omittedPlayers}</strong></div>
          </div>
          <MergePreview plan={pendingProjectImport} copy={copy} />
        </EditorDialog>
      )}

      {pendingBackupImport && (
        <EditorDialog
          wide
          kicker={copy.localStorage}
          title={copy.backupPreviewTitle}
          message={copy.backupPreviewMessage}
          actions={[
            { label: copy.cancel, onClick: () => setPendingBackupImport(null) },
            { label: copy.confirmBackupImport, tone: 'primary', onClick: confirmBackupImport }
          ]}
        >
          <div className={styles.mergeSource}>
            <span>{copy.backupSource}</span>
            <strong>{pendingBackupImport.sourceLabel}</strong>
          </div>
          <div className={styles.projectImportStats}>
            <div><span>{copy.teams}</span><strong>{pendingBackupImport.teamCount}</strong></div>
            <div><span>{copy.playersLabel}</span><strong>{pendingBackupImport.playerCount}</strong></div>
            <div><span>{copy.mergeAdd}</span><strong>{pendingBackupImport.additions}</strong></div>
            <div><span>{copy.mergeUpdate}</span><strong>{pendingBackupImport.updates}</strong></div>
          </div>
          <MergePreview plan={pendingBackupImport} copy={copy} />
        </EditorDialog>
      )}

      {pendingLogoFolder && (
        <EditorDialog
          wide
          kicker={copy.library}
          title={pendingLogoFolder.reviewContext ? copy.brandingLogoTitle : copy.logoFolderTitle}
          message={pendingLogoFolder.reviewContext ? copy.brandingLogoMessage : copy.logoFolderMessage}
          actions={[
            {
              label: copy.cancel,
              disabled: logoFolderSaving,
              onClick: closeLogoFolderImport
            },
            {
              label: copy.selectAnotherLogoFolder,
              disabled: logoFolderSaving,
              onClick: () => logoFolderInputRef.current?.click()
            },
            {
              label: logoFolderSaving
                ? copy.logoFolderImporting
                : pendingLogoFolder.reviewContext
                  ? copy.saveBrandingAndLogos
                  : copy.confirmLogoFolderImport,
              tone: 'primary',
              disabled: logoFolderSaving || (
                !pendingLogoFolder.matches.length && !pendingLogoFolder.reviewContext?.records?.length
              ),
              onClick: confirmLogoFolderImport
            }
          ]}
        >
          <div className={styles.logoFolderStats}>
            <div><span>{copy.logoFolderFiles}</span><strong>{pendingLogoFolder.filesCount}</strong></div>
            <div><span>{copy.logoFolderMatched}</span><strong>{pendingLogoFolder.matches.length}</strong></div>
            <div><span>{copy.logoFolderOverwrite}</span><strong>{pendingLogoFolder.overwriteCount}</strong></div>
            <div>
              <span>{copy.logoFolderNeedsReview}</span>
              <strong>
                {pendingLogoFolder.unmatchedFiles.length +
                  pendingLogoFolder.ambiguousFiles.length +
                  pendingLogoFolder.duplicateFiles.length +
                  pendingLogoFolder.rejectedFiles.length}
              </strong>
            </div>
          </div>

          {pendingLogoFolder.matches.length > 0 ? (
            <div className={styles.logoFolderMatches}>
              {pendingLogoFolder.matches.slice(0, 12).map(match => (
                <article key={`${match.team.id}-${match.fileName}`}>
                  <TeamMark team={match.team} />
                  <div>
                    <strong>{match.team.shortName} / {match.team.name}</strong>
                    <em>{match.fileName}</em>
                  </div>
                  <span>{match.team.logo ? copy.logoFolderReplace : copy.logoFolderAdd}</span>
                </article>
              ))}
              {pendingLogoFolder.matches.length > 12 && (
                <p>{copy.logoFolderMore(pendingLogoFolder.matches.length - 12)}</p>
              )}
            </div>
          ) : (
            <div className={styles.logoFolderNoMatches}>{copy.logoFolderNoMatches}</div>
          )}

          <div className={styles.logoFolderIssues}>
            {pendingLogoFolder.unmatchedFiles.length > 0 && (
              <div>
                <span>{copy.logoFolderUnmatched}</span>
                <p>{pendingLogoFolder.unmatchedFiles.slice(0, 8).map(getTeamLogoFolderFileName).join(' / ')}</p>
              </div>
            )}
            {pendingLogoFolder.ambiguousFiles.length > 0 && (
              <div>
                <span>{copy.logoFolderAmbiguous}</span>
                <p>{pendingLogoFolder.ambiguousFiles.slice(0, 8).map(item => getTeamLogoFolderFileName(item.file)).join(' / ')}</p>
              </div>
            )}
            {pendingLogoFolder.duplicateFiles.length > 0 && (
              <div>
                <span>{copy.logoFolderDuplicates}</span>
                <p>{pendingLogoFolder.duplicateFiles.slice(0, 8).map(getTeamLogoFolderFileName).join(' / ')}</p>
              </div>
            )}
            {pendingLogoFolder.rejectedFiles.length > 0 && (
              <div>
                <span>{copy.logoFolderRejected}</span>
                <p>{pendingLogoFolder.rejectedFiles.slice(0, 8).map(getTeamLogoFolderFileName).join(' / ')}</p>
              </div>
            )}
          </div>
        </EditorDialog>
      )}

      {healthDialogOpen && (
        <EditorDialog
          wide
          kicker={copy.matchPackage}
          title={copy.healthTitle}
          message={copy.healthMessage}
          actions={[
            { label: copy.close, tone: 'primary', onClick: () => setHealthDialogOpen(false) }
          ]}
        >
          <div className={styles.healthSummary}>
            <div>
              <span>{copy.healthStatus}</span>
              <strong className={packageBlocked ? styles.healthBlocked : packageSizeWarning ? styles.healthWarning : styles.healthReady}>
                {packageBlocked
                  ? copy.healthBlocked
                  : packageSizeWarning
                    ? copy.healthWarnings(packageHealth.issues.length)
                    : copy.healthReady}
              </strong>
            </div>
            <div>
              <span>{copy.healthPackageSize}</span>
              <strong>{formatBytes(selectedPackageBytes)} / {formatBytes(MATCH_PACKAGE_MAX_BYTES)}</strong>
            </div>
            <div>
              <span>{copy.healthChecks}</span>
              <strong>{copy.healthIssueCount(packageHealth.issues.length)}</strong>
            </div>
          </div>
          <div className={styles.healthIssueList}>
            {!packageHealth.issues.length && (
              <div className={styles.healthEmpty}>{copy.healthNoIssues}</div>
            )}
            {packageHealth.issues.map((issue, index) => (
              <article
                className={issue.severity === 'blocked' ? styles.healthIssueBlocked : ''}
                key={`${issue.code}-${issue.side || 'package'}-${issue.playerName || index}`}
              >
                <span>{issue.severity === 'blocked' ? copy.healthBlockLabel : copy.healthWarningLabel}</span>
                <strong>{getHealthIssueText(issue, copy)}</strong>
              </article>
            ))}
          </div>
        </EditorDialog>
      )}

      {guideOpen && (
        <EditorDialog
          wide
          kicker={copy.guideKicker}
          title={copy.guideTitle}
          message={copy.guideMessage}
          actions={[
            { label: copy.guideStart, tone: 'primary', onClick: closeGuide }
          ]}
        >
          <div className={styles.guideSteps}>
            {copy.guideSteps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.guideNote}>
            <strong>{copy.guideBackupTitle}</strong>
            <span>{copy.guideBackupNote}</span>
          </div>
        </EditorDialog>
      )}

      {deleteTarget && (
        <EditorDialog
          kicker={copy.library}
          title={copy.deleteTitle}
          message={copy.deleteMessage(deleteTarget.shortName || deleteTarget.name)}
          tone="danger"
          confirmLabel={copy.confirmDelete}
          cancelLabel={copy.cancel}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {copyFallbackText && (
        <EditorDialog
          wide
          kicker={copy.matchPackage}
          title={copy.matchPackageCopyTitle}
          message={copy.matchPackageCopyFallback}
          actions={[
            { label: copy.close, onClick: () => setCopyFallbackText('') },
            {
              label: copy.copyText,
              tone: 'primary',
              onClick: () => {
                let copied = false
                try {
                  matchPackageTextRef.current?.focus()
                  matchPackageTextRef.current?.select()
                  copied = Boolean(document.execCommand?.('copy'))
                } catch {
                  // Keep the text selected so the user can copy it manually.
                }

                if (copied) {
                  setCopyFallbackText('')
                  setCopiedPackageSignature(selectedIds.join('|'))
                  setStatus(copy.matchPackageCopied)
                  setError('')
                  return
                }

                setError(copy.matchPackageManualCopy)
              }
            }
          ]}
        >
          <textarea
            ref={matchPackageTextRef}
            value={copyFallbackText}
            aria-label={copy.matchPackageCopyTitle}
            readOnly
            spellCheck={false}
          />
        </EditorDialog>
      )}
    </main>
  )
}
