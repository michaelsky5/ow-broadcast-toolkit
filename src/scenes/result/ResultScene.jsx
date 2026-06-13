import { getBroadcastCompetitionName, getEventLogo } from '../../project/branding'
import { getCurrentTeams, getTeamById } from '../../project/projectUtils'

const PRIMARY = 'var(--theme-primary)'
const DARK = '#050505'
const PANEL = '#141414'
const LINE = 'rgba(255,255,255,0.08)'
const LINE_STRONG = 'rgba(255,255,255,0.18)'

const WINNER_KEYFRAMES = `
  @keyframes owbtWinnerCardDrop {
    0% { opacity: 0; transform: scale(1.15) translateY(-40px); filter: blur(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
  }
  @keyframes owbtWinnerBgPan {
    0% { transform: translateX(5%) translateY(14px); }
    100% { transform: translateX(-5%) translateY(14px); }
  }
  @keyframes owbtWinnerLogoPop {
    0% { opacity: 0; transform: scale(0.6); }
    60% { transform: scale(1.08); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes owbtWinnerTextUp {
    0% { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes owbtWinnerGlowPulse {
    0%, 100% { box-shadow: 0 0 18px color-mix(in srgb, var(--theme-primary) 10%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--theme-primary) 16%, transparent); }
    50% { box-shadow: 0 0 35px color-mix(in srgb, var(--theme-primary) 28%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--theme-primary) 30%, transparent); }
  }
  @keyframes owbtWinnerGridFade {
    0% { opacity: 0; }
    100% { opacity: 0.24; }
  }
`

const clean = value => String(value || '').trim()
const normalizeText = value => clean(value).toUpperCase()
const getTeamLogo = team => clean(team?.logo) || '/OW.svg'
const getTeamName = (team, fallback) => clean(team?.name) || fallback

const handleImageFallback = event => {
  if (event.currentTarget.dataset.fallbackApplied) return
  event.currentTarget.dataset.fallbackApplied = 'true'
  event.currentTarget.src = '/OW.svg'
}

const resolveWinner = (project, teamA, teamB) => {
  const match = project?.currentMatch || {}
  const scoreA = Number(match.score?.teamA) || 0
  const scoreB = Number(match.score?.teamB) || 0
  if (scoreA > scoreB) return teamA
  if (scoreB > scoreA) return teamB

  const explicitWinner = getTeamById(project, match.result?.winnerTeamId)
  if (explicitWinner) return explicitWinner

  const winnerSide = normalizeText(match.result?.winnerSide || match.winnerSide || match.winner)
  if (winnerSide === 'A') return teamA
  if (winnerSide === 'B') return teamB

  return null
}

export default function ResultScene({ project }) {
  const settings = project?.scenes?.settings?.result || {}
  const match = project?.currentMatch || {}
  const { teamA, teamB } = getCurrentTeams(project)
  const winner = resolveWinner(project, teamA, teamB)
  const eventName = getBroadcastCompetitionName(project)
  const eventLogo = getEventLogo(project)
  const topLabel = clean(settings.title) || 'WINNER'
  const winnerName = winner ? getTeamName(winner, 'WINNER') : 'RESULT PENDING'
  const winnerLogo = winner ? getTeamLogo(winner) : '/OW.svg'
  const scoreLine = `${match.score?.teamA ?? 0} : ${match.score?.teamB ?? 0}`
  const note = `FT${match.ft || 3} // ${scoreLine}`

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${DARK} 0%, ${PANEL} 100%)`,
        fontFamily: 'var(--theme-font-family)',
        color: '#fff'
      }}
    >
      <style>{WINNER_KEYFRAMES}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          opacity: 0,
          animation: 'owbtWinnerGridFade 1.2s ease forwards'
        }}
      />
      <div style={{ position: 'absolute', left: 90, top: 90, width: 520, height: 520, border: '1px solid color-mix(in srgb, var(--theme-primary) 8%, transparent)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: -80, bottom: -80, width: 420, height: 420, border: '1px solid rgba(255,255,255,0.03)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: 'rgba(255,255,255,0.02)',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 30px',
          boxSizing: 'border-box',
          backdropFilter: 'blur(4px)',
          zIndex: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 10, height: 10, background: PRIMARY, boxShadow: '0 0 12px color-mix(in srgb, var(--theme-primary) 28%, transparent)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 950, lineHeight: 1.12, letterSpacing: 2, color: 'rgba(255,255,255,0.72)' }}>
            {eventName || 'OWBT_WINNER_INTERFACE'}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.38)' }}>
          RESULT // CONFIRMED
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: '96px 120px 92px',
          border: `1px solid ${LINE_STRONG}`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0 1px, transparent 1px 24px)', opacity: 0.22 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, rgba(255,255,255,0.12) 100%)`, boxShadow: '0 0 18px color-mix(in srgb, var(--theme-primary) 18%, transparent)' }} />

        <div style={{ position: 'absolute', top: 28, left: 28, width: 18, height: 18, borderTop: `2px solid ${PRIMARY}`, borderLeft: `2px solid ${PRIMARY}` }} />
        <div style={{ position: 'absolute', top: 28, right: 28, width: 18, height: 18, borderTop: '2px solid rgba(255,255,255,0.10)', borderRight: '2px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position: 'absolute', bottom: 28, left: 28, width: 18, height: 18, borderBottom: '2px solid rgba(255,255,255,0.10)', borderLeft: '2px solid rgba(255,255,255,0.10)' }} />
        <div style={{ position: 'absolute', bottom: 28, right: 28, width: 18, height: 18, borderBottom: `2px solid ${PRIMARY}`, borderRight: `2px solid ${PRIMARY}` }} />

        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div
            style={{
              fontSize: 250,
              fontWeight: 950,
              lineHeight: 0.9,
              letterSpacing: 8,
              color: 'transparent',
              WebkitTextStroke: '2px rgba(255,255,255,0.08)',
              textTransform: 'uppercase',
              userSelect: 'none',
              animation: 'owbtWinnerBgPan 30s ease-in-out infinite alternate'
            }}
          >
            WINNER
          </div>
        </div>

        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 760,
              minHeight: 620,
              position: 'relative',
              display: 'grid',
              alignContent: 'center',
              justifyItems: 'center',
              gap: 24,
              padding: '56px 56px 60px',
              boxSizing: 'border-box',
              background: `
                radial-gradient(circle at center, color-mix(in srgb, var(--theme-primary) 10%, transparent) 0%, rgba(255,255,255,0.025) 34%, rgba(0,0,0,0) 72%),
                linear-gradient(180deg, rgba(28,28,28,0.96) 0%, rgba(20,20,20,0.98) 100%)
              `,
              border: `1px solid ${LINE_STRONG}`,
              boxShadow: '0 18px 40px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)',
              opacity: 0,
              animation: 'owbtWinnerCardDrop 800ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards'
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 18px)', opacity: 0.12 }} />
            <div style={{ position: 'absolute', inset: 16, border: '1px solid rgba(255,255,255,0.04)' }} />
            <div style={{ position: 'absolute', top: 22, right: 22, width: 34, height: 2, background: 'rgba(255,255,255,0.16)' }} />
            <div style={{ position: 'absolute', top: 28, right: 22, width: 18, height: 2, background: 'rgba(255,255,255,0.10)' }} />
            <div style={{ position: 'absolute', left: 22, top: 22, bottom: 22, width: 1, background: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-primary) 30%, transparent) 0%, rgba(255,255,255,0.02) 100%)' }} />

            <div style={{ position: 'relative', zIndex: 2, fontSize: 13, fontWeight: 950, color: 'rgba(255,255,255,0.72)', letterSpacing: 2.4, lineHeight: 1.12, textTransform: 'uppercase', opacity: 0, animation: 'owbtWinnerTextUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 300ms forwards' }}>
              {topLabel}
            </div>
            <div style={{ position: 'relative', zIndex: 2, fontSize: 88, fontWeight: 950, color: PRIMARY, lineHeight: 0.9, letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 20px color-mix(in srgb, var(--theme-primary) 18%, transparent)', opacity: 0, animation: 'owbtWinnerTextUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 400ms forwards' }}>
              WINNER
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                width: 228,
                height: 228,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid color-mix(in srgb, var(--theme-primary) 18%, transparent)',
                display: 'grid',
                placeItems: 'center',
                opacity: 0,
                animation: 'owbtWinnerLogoPop 800ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms forwards, owbtWinnerGlowPulse 3s ease-in-out 1.3s infinite'
              }}
            >
              <img
                src={winnerLogo || eventLogo || '/OW.svg'}
                alt={winnerName}
                onError={handleImageFallback}
                style={{ width: '78%', height: '78%', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ position: 'relative', zIndex: 2, maxWidth: '100%', fontSize: 56, fontWeight: 950, color: '#fff', lineHeight: 1.12, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 4px 18px rgba(0,0,0,0.25)', opacity: 0, animation: 'owbtWinnerTextUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 600ms forwards' }}>
              {winnerName}
            </div>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, opacity: 0, animation: 'owbtWinnerTextUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 700ms forwards' }}>
              <div style={{ width: 8, height: 8, background: PRIMARY }} />
              <div style={{ fontSize: 13, fontWeight: 950, color: PRIMARY, letterSpacing: 2, textTransform: 'uppercase' }}>{note}</div>
              <div style={{ width: 8, height: 8, background: PRIMARY }} />
            </div>
            <div style={{ position: 'relative', zIndex: 2, width: 380, height: 10, background: `linear-gradient(90deg, ${PRIMARY} 0%, rgba(255,255,255,0.12) 100%)`, border: '1px solid color-mix(in srgb, var(--theme-primary) 18%, transparent)', boxShadow: '0 0 18px color-mix(in srgb, var(--theme-primary) 18%, transparent)', marginTop: 2, opacity: 0, animation: 'owbtWinnerTextUp 600ms cubic-bezier(0.16, 1, 0.3, 1) 800ms forwards' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
