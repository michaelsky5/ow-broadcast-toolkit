export const DEFAULT_EVENT_MAP_POOL = {
  control: ['ilios', 'antarctic-peninsula', 'oasis'],
  hybrid: ['hollywood', 'numbani', 'kings-row'],
  flashpoint: ['new-junk-city', 'suravasa'],
  push: ['new-queen-street', 'runasapi'],
  escort: ['circuit-royal', 'rialto', 'dorado']
}

export const DEFAULT_ENABLED_MAP_TYPES = {
  control: true,
  hybrid: true,
  flashpoint: true,
  push: true,
  escort: true,
  clash: false
}

export const createDefaultEventMapPool = () => (
  Object.fromEntries(
    Object.entries(DEFAULT_EVENT_MAP_POOL).map(([modeId, mapIds]) => [modeId, [...mapIds]])
  )
)

export const createDefaultEnabledMapTypes = () => ({ ...DEFAULT_ENABLED_MAP_TYPES })
