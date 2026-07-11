import FriesStartingLineupScene from '../legacy-fcol/FriesStartingLineupScene'
import { OW_HERO_BY_ID, getPublicAsset } from '../../data/overwatch'
import { getCurrentTeams, getStartingPlayers } from '../../project/projectUtils'
import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import SponsorLockup from '../shared/SponsorLockup'

const DEFAULT_LOGO = getPublicAsset('/OW.svg')

const clean = value => String(value || '').trim()

const getTeamLogo = team => clean(team?.logo) || DEFAULT_LOGO

const getHeroImage = player => {
  if (player?.avatar) return player.avatar

  const heroId = player?.primaryHeroes?.[0]
  const hero = heroId ? OW_HERO_BY_ID[heroId] : null

  return hero?.rosterIcon || hero?.icon || ''
}

const getLineupPlayers = (project, side) => {
  const players = getStartingPlayers(project, side)

  return Array.from({ length: 5 }).map((_, index) => {
    const player = players[index] || null
    if (!player) return null

    return {
      id: player.id,
      nickname: clean(player.name) || `Player ${index + 1}`,
      name: clean(player.name) || `Player ${index + 1}`,
      battleTag: clean(player.battleTag),
      role: player.role,
      heroImage: getHeroImage(player),
      heroScale: 1,
      heroPosition: '50% 24%',
      heroBrightness: 0.88
    }
  })
}

const getLineupNames = players => players.map(player => player?.nickname || '')

const getLegacySide = settings => {
  const raw = clean(settings.startingLineupSide || settings.side).toUpperCase()
  if (raw === 'A' || raw === 'TEAMA' || raw === 'TEAM_A') return 'A'
  if (raw === 'B' || raw === 'TEAMB' || raw === 'TEAM_B') return 'B'
  return ''
}

const buildLegacyMatchData = project => {
  const { teamA, teamB } = getCurrentTeams(project)
  const settings = project?.scenes?.settings?.['starting-five'] || {}
  const playersA = getLineupPlayers(project, 'teamA')
  const playersB = getLineupPlayers(project, 'teamB')

  return {
    eventName: getBroadcastCompetitionName(project),
    eventLogo: getEventLogo(project),
    teamA: clean(teamA?.name) || 'Team A',
    teamB: clean(teamB?.name) || 'Team B',
    teamShortA: clean(teamA?.shortName) || 'TMA',
    teamShortB: clean(teamB?.shortName) || 'TMB',
    logoA: getTeamLogo(teamA),
    logoB: getTeamLogo(teamB),
    playersA: getLineupNames(playersA),
    playersB: getLineupNames(playersB),
    rosterPlayersA: playersA.filter(Boolean),
    rosterPlayersB: playersB.filter(Boolean),
    startingLineupSide: getLegacySide(settings),
    startingLineupMode: clean(settings.startingLineupMode || settings.mode).toUpperCase(),
    startingLineupCalloutIndex: settings.startingLineupCalloutIndex ?? settings.calloutIndex ?? 0,
    startingLineupTriggerAt: settings.startingLineupTriggerAt || project?.meta?.updatedAt || 0
  }
}

export default function StartingFiveScene({ project }) {
  const settings = project?.scenes?.settings?.['starting-five'] || {}

  return (
    <div style={{ position: 'relative', width: 1920, height: 1080, overflow: 'hidden' }}>
      <FriesStartingLineupScene matchData={buildLegacyMatchData(project)} />
      {settings.showSponsors !== false && (
        <SponsorLockup
          project={project}
          variant="mark"
          style={{ position: 'absolute', top: 66, right: 40 }}
        />
      )}
    </div>
  )
}
