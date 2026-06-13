import { useEffect, useMemo, useRef, useState } from 'react';

const PRIMARY = 'var(--theme-primary)';
const PANEL = 'rgba(36,36,36,0.96)';
const PANEL_ALT = 'rgba(42,42,42,0.96)';
const LINE = 'rgba(255,255,255,0.08)';
const LINE_STRONG = 'rgba(255,255,255,0.18)';

const getMapLabel = matchData => {
  if (matchData.currentMapLabel) return matchData.currentMapLabel;
  if (typeof matchData.currentMap === 'number') return `MAP ${matchData.currentMap}`;
  if (typeof matchData.mapNumber === 'number') return `MAP ${matchData.mapNumber}`;
  if (typeof matchData.currentMapIndex === 'number') return `MAP ${matchData.currentMapIndex + 1}`;
  if (typeof matchData.mapIndex === 'number') return `MAP ${matchData.mapIndex + 1}`;
  return 'MAP 1';
};

function TechCorner({ top = true, left = true, color = PRIMARY }) {
  return (
    <div
      style={{
        position: 'absolute',
        [top ? 'top' : 'bottom']: 18,
        [left ? 'left' : 'right']: 18,
        width: 18,
        height: 18,
        pointerEvents: 'none',
        zIndex: 5
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 2, background: color }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 18, background: color }} />
    </div>
  );
}

function TeamBlock({ logo, name, align = 'left', phase }) {
  const isLeft = align === 'left';
  const animation = phase === 'show'
    ? `${isLeft ? 'owbtBeginTeamInLeft' : 'owbtBeginTeamInRight'} 520ms cubic-bezier(0.22, 1, 0.36, 1) 100ms forwards`
    : phase === 'exit'
      ? 'owbtBeginTeamOut 320ms ease-in forwards'
      : 'none';

  return (
    <div
      style={{
        minWidth: 0,
        display: 'grid',
        gap: 16,
        justifyItems: isLeft ? 'start' : 'end',
        opacity: 0,
        animation,
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isLeft ? 'row' : 'row-reverse' }}>
        <div
          style={{
            width: 124,
            height: 124,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${LINE_STRONG}`,
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)'
          }}
        >
          {logo ? (
            <img src={logo} alt={name} style={{ width: '78%', height: '78%', objectFit: 'contain', display: 'block' }} />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 900, fontSize: 18, letterSpacing: 1.2 }}>LOGO</div>
          )}
        </div>

        <div
          style={{
            color: '#fff',
            fontSize: 34,
            fontWeight: 950,
            lineHeight: 1.12,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 360,
            textAlign: isLeft ? 'left' : 'right',
            textShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {name || 'TEAM'}
        </div>
      </div>
    </div>
  );
}

export default function BeginInfoOverlay({ matchData, duration = 3200, onFinish }) {
  const [phase, setPhase] = useState('show');
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setPhase('exit'), Math.max(700, duration - 400));
    const doneTimer = window.setTimeout(() => {
      setPhase('idle');
      onFinishRef.current?.();
    }, duration);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [duration]);

  const mapLabel = useMemo(() => getMapLabel(matchData), [matchData]);
  const panelAnimation = phase === 'show'
    ? 'owbtBeginPanelIn 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
    : phase === 'exit'
      ? 'owbtBeginPanelOut 400ms ease-in forwards'
      : 'none';
  const vsAnimation = phase === 'show' ? 'owbtBeginVsIn 640ms cubic-bezier(0.16, 1, 0.3, 1) 150ms forwards' : 'none';
  const centerAnimation = phase === 'show'
    ? 'owbtBeginCenterIn 420ms ease-out 160ms forwards'
    : phase === 'exit'
      ? 'owbtBeginTeamOut 300ms ease-in forwards'
      : 'none';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        animation: 'owbtBeginBgIn 400ms ease forwards',
        willChange: 'opacity'
      }}
    >
      <style>{`
        @keyframes owbtBeginBgIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes owbtBeginPanelIn { 0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.988); } 100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
        @keyframes owbtBeginPanelOut { 0% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } 100% { opacity: 0; transform: translate3d(0, -12px, 0) scale(0.99); } }
        @keyframes owbtBeginTeamInLeft { 0% { opacity: 0; transform: translate3d(-30px, 0, 0); } 100% { opacity: 1; transform: translate3d(0, 0, 0); } }
        @keyframes owbtBeginTeamInRight { 0% { opacity: 0; transform: translate3d(30px, 0, 0); } 100% { opacity: 1; transform: translate3d(0, 0, 0); } }
        @keyframes owbtBeginTeamOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.96); } }
        @keyframes owbtBeginVsIn { 0% { opacity: 0; transform: translateY(15px) scale(0.8); } 100% { opacity: 1; transform: translateY(6px) scale(1); } }
        @keyframes owbtBeginCenterIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        style={{
          width: '78%',
          maxWidth: 1480,
          minHeight: 308,
          position: 'relative',
          background: `radial-gradient(circle at center, color-mix(in srgb, ${PRIMARY} 10%, transparent) 0%, rgba(255,255,255,0.015) 32%, rgba(0,0,0,0) 76%), linear-gradient(180deg, ${PANEL_ALT} 0%, ${PANEL} 100%)`,
          border: `1px solid ${LINE_STRONG}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          animation: panelAnimation,
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.010) 1px, transparent 1px)', backgroundSize: '72px 72px', opacity: 0.16 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ fontSize: 220, fontWeight: 950, lineHeight: 0.9, letterSpacing: 8, color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,0.06)', textTransform: 'uppercase', opacity: 0, animation: vsAnimation }}>
            VS
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, rgba(255,255,255,0.12) 100%)`, boxShadow: `0 0 18px color-mix(in srgb, ${PRIMARY} 24%, transparent)` }} />

        <TechCorner top left />
        <TechCorner top left={false} color="rgba(255,255,255,0.12)" />
        <TechCorner top={false} left color="rgba(255,255,255,0.12)" />
        <TechCorner top={false} left={false} />

        <div style={{ position: 'absolute', inset: 16, border: `1px solid ${LINE}` }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr 0.9fr 1fr', gap: 34, alignItems: 'center', minHeight: 308, padding: '38px 42px' }}>
          <TeamBlock logo={matchData.logoA} name={matchData.teamA} align="left" phase={phase} />

          <div style={{ display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 14, opacity: 0, animation: centerAnimation }}>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 900, fontSize: 13, letterSpacing: 2.2, textTransform: 'uppercase' }}>
              Match Info
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20, width: '100%' }}>
              <div style={{ textAlign: 'right', color: '#fff', fontWeight: 950, fontSize: 92, lineHeight: 0.9 }}>{matchData.scoreA ?? 0}</div>
              <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
                <div style={{ color: PRIMARY, fontWeight: 950, fontSize: 30, letterSpacing: 1.6, textShadow: `0 0 12px color-mix(in srgb, ${PRIMARY} 38%, transparent)` }}>VS</div>
                <div style={{ minWidth: 122, height: 36, padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE_STRONG}`, color: '#fff', fontWeight: 950, fontSize: 15, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  {mapLabel}
                </div>
              </div>
              <div style={{ textAlign: 'left', color: '#fff', fontWeight: 950, fontSize: 92, lineHeight: 0.9 }}>{matchData.scoreB ?? 0}</div>
            </div>
            <div style={{ width: 220, height: 4, background: `linear-gradient(90deg, transparent 0%, ${PRIMARY} 50%, transparent 100%)`, boxShadow: `0 0 8px color-mix(in srgb, ${PRIMARY} 24%, transparent)` }} />
          </div>

          <TeamBlock logo={matchData.logoB} name={matchData.teamB} align="right" phase={phase} />
        </div>
      </div>
    </div>
  );
}
