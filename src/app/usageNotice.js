export const USAGE_NOTICE_STORAGE_KEY = 'owbt-usage-notice-accepted'

const getUsageNoticeStorage = storage => {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const isUsageNoticeAccepted = storage => {
  try {
    return getUsageNoticeStorage(storage)?.getItem(USAGE_NOTICE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const acceptUsageNotice = storage => {
  try {
    const targetStorage = getUsageNoticeStorage(storage)
    if (!targetStorage) return false
    targetStorage.setItem(USAGE_NOTICE_STORAGE_KEY, 'true')
    return true
  } catch {
    return false
  }
}
