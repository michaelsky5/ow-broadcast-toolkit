import { normalizeLibraryTeam } from './teamLibraryModel'

const DATABASE_NAME = 'owbt-team-library'
const DATABASE_VERSION = 1
const TEAM_STORE = 'teams'

let databasePromise = null

const canUseIndexedDb = () => typeof window !== 'undefined' && 'indexedDB' in window

const requestToPromise = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'))
})

const transactionToPromise = transaction => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'))
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'))
})

const openDatabase = () => {
  if (!canUseIndexedDb()) return Promise.reject(new Error('IndexedDB is unavailable.'))
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(TEAM_STORE)) {
        const store = database.createObjectStore(TEAM_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
        store.createIndex('name', 'name')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      databasePromise = null
      reject(request.error || new Error('Unable to open OWBT team library.'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('OWBT team library upgrade is blocked by another tab.'))
    }
  })

  return databasePromise
}

export const loadLibraryTeams = async () => {
  const database = await openDatabase()
  const transaction = database.transaction(TEAM_STORE, 'readonly')
  const records = await requestToPromise(transaction.objectStore(TEAM_STORE).getAll())

  return records
    .map(normalizeLibraryTeam)
    .sort((teamA, teamB) => String(teamB.updatedAt).localeCompare(String(teamA.updatedAt)))
}

export const saveLibraryTeam = async rawTeam => {
  const database = await openDatabase()
  const team = normalizeLibraryTeam({ ...rawTeam, updatedAt: new Date().toISOString() })
  const transaction = database.transaction(TEAM_STORE, 'readwrite')
  transaction.objectStore(TEAM_STORE).put(team)
  await transactionToPromise(transaction)
  return team
}

export const saveLibraryTeams = async rawTeams => {
  const database = await openDatabase()
  const transaction = database.transaction(TEAM_STORE, 'readwrite')
  const store = transaction.objectStore(TEAM_STORE)
  const updatedAt = new Date().toISOString()
  const teams = rawTeams.map(rawTeam => normalizeLibraryTeam({
    ...rawTeam,
    updatedAt
  }))

  teams.forEach(team => store.put(team))
  await transactionToPromise(transaction)
  return teams
}

export const replaceLibraryTeams = async rawTeams => {
  const database = await openDatabase()
  const transaction = database.transaction(TEAM_STORE, 'readwrite')
  const store = transaction.objectStore(TEAM_STORE)
  const teams = rawTeams.map(normalizeLibraryTeam)

  store.clear()
  teams.forEach(team => store.put(team))
  await transactionToPromise(transaction)
  return teams
}

export const deleteLibraryTeam = async teamId => {
  const database = await openDatabase()
  const transaction = database.transaction(TEAM_STORE, 'readwrite')
  transaction.objectStore(TEAM_STORE).delete(teamId)
  await transactionToPromise(transaction)
}

export const mergeLibraryTeamGroups = async mergePlans => {
  const database = await openDatabase()
  const transaction = database.transaction(TEAM_STORE, 'readwrite')
  const store = transaction.objectStore(TEAM_STORE)
  const records = (mergePlans || []).map(plan => normalizeLibraryTeam(plan.record))

  records.forEach(record => store.put(record))
  const plans = mergePlans || []
  plans.forEach(plan => {
    const removedIds = plan.removedIds || []
    removedIds.forEach(teamId => {
      if (teamId && teamId !== plan.keeperId) store.delete(teamId)
    })
  })

  await transactionToPromise(transaction)
  return records
}

export const getOriginStorageEstimate = async () => {
  if (!navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()

  return {
    usage: Number(estimate.usage || 0),
    quota: Number(estimate.quota || 0),
    persisted: navigator.storage.persisted ? await navigator.storage.persisted() : false
  }
}

export const requestPersistentLibraryStorage = async () => {
  if (!navigator.storage?.persist) return false
  if (navigator.storage.persisted && await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
