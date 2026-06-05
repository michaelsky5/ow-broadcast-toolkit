export const DEFAULT_EVENT_LOGO = '/OW.svg'
export const DEFAULT_COMPETITION_NAME_ZH = 'OWBT'
export const DEFAULT_COMPETITION_NAME_EN = 'OWBT'

const clean = value => String(value || '').trim()

export const getOpeningSettings = project => project?.scenes?.settings?.opening || {}

export const getCompetitionName = (project, language = 'zh') => {
  const settings = getOpeningSettings(project)
  const isEnglish = language === 'en'

  if (isEnglish) {
    return clean(project?.event?.nameEn || project?.event?.name || settings.competitionNameEn) || DEFAULT_COMPETITION_NAME_EN
  }

  return clean(project?.event?.nameZh || project?.event?.name || settings.competitionNameZh) || DEFAULT_COMPETITION_NAME_ZH
}

export const getCompetitionNamePair = project => {
  const settings = getOpeningSettings(project)

  return {
    zh: clean(project?.event?.nameZh || settings.competitionNameZh),
    en: clean(project?.event?.nameEn || settings.competitionNameEn) || DEFAULT_COMPETITION_NAME_EN
  }
}

export const getBroadcastCompetitionName = project => {
  const settings = getOpeningSettings(project)

  return clean(
    project?.event?.nameEn ||
    project?.event?.nameZh ||
    project?.event?.name ||
    settings.competitionNameEn ||
    settings.competitionNameZh
  ) || DEFAULT_COMPETITION_NAME_EN
}

export const getEventLogoSource = project => {
  if (clean(project?.event?.logo)) return 'event'
  if (clean(project?.event?.organizerLogo)) return 'organizer'

  return 'fallback'
}

export const getEventLogo = project => clean(project?.event?.logo || project?.event?.organizerLogo) || DEFAULT_EVENT_LOGO
