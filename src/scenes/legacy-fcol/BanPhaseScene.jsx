import { useEffect, useMemo, useState } from 'react';

const PRIMARY = 'var(--theme-primary)';
const DARK = '#2A2A2A';
const PANEL = '#242424';
const LINE = 'rgba(255,255,255,0.08)';
const LINE_STRONG = 'rgba(255,255,255,0.18)';
const DEFAULT_BAN_ENTRY = 'damage/tbd';

const hasDefinedBanSlot = bans =>
  Array.isArray(bans) && bans.some(item => String(item || '').trim());

const getLiveFirstBans = (liveBans, mapBans) => {
  if (hasDefinedBanSlot(liveBans)) return liveBans;
  if (hasDefinedBanSlot(mapBans)) return mapBans;
  return [DEFAULT_BAN_ENTRY];
};

const getBanInfo = bans => {
  const raw = Array.isArray(bans) ? (bans.find(item => String(item || '').trim()) || DEFAULT_BAN_ENTRY) : DEFAULT_BAN_ENTRY;
  const str = String(raw || DEFAULT_BAN_ENTRY).trim().toLowerCase();

  if (!str) return { role: 'damage', hero: 'tbd' };
  if (!str.includes('/')) return { role: 'damage', hero: str || 'tbd' };

  const [role, hero] = str.split('/');
  return {
    role: role || 'damage',
    hero: hero || 'tbd'
  };
};

const normalizeRole = role => {
  if (!role) return 'BAN STATUS';
  if (role === 'damage') return 'DAMAGE';
  if (role === 'support') return 'SUPPORT';
  if (role === 'tank') return 'TANK';
  return String(role).toUpperCase();
};

const getRosterPath = banInfo => {
  if (!banInfo?.hero || !banInfo?.role || banInfo.hero === 'tbd') return '';
  return `/roster/${banInfo.role}/${banInfo.hero}.png`;
};

const getHeroPath = banInfo => {
  if (!banInfo?.hero || !banInfo?.role || banInfo.hero === 'tbd') return '';
  return `/heroes/${banInfo.role}/${banInfo.hero}.png`;
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

function OrderBadge({ order = 1, side = 'left' }) {
  const isLeft = side === 'left';

  return (
    <div
      style={{
        position: 'absolute',
        top: 22,
        [isLeft ? 'left' : 'right']: 22,
        zIndex: 8,
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: '0 8px 18px rgba(0,0,0,0.24)'
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          background: PRIMARY,
          color: DARK,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 950,
          fontSize: 22,
          lineHeight: 1
        }}
      >
        {order}
      </div>
      <div
        style={{
          width: 12,
          height: 42,
          background: 'color-mix(in srgb, var(--theme-primary) 14%, transparent)',
          borderTop: `1px solid ${PRIMARY}`,
          borderBottom: `1px solid ${PRIMARY}`,
          borderRight: isLeft ? `1px solid ${PRIMARY}` : 'none',
          borderLeft: !isLeft ? `1px solid ${PRIMARY}` : 'none'
        }}
      />
    </div>
  );
}

function PendingState() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
        <div style={{ color: PRIMARY, fontWeight: 950, fontSize: 52, letterSpacing: 1.2, lineHeight: 1, textTransform: 'uppercase', textShadow: '0 0 18px color-mix(in srgb, var(--theme-primary) 16%, transparent)' }}>
          Pending
        </div>
        <div style={{ width: 240, height: 4, background: `linear-gradient(90deg, transparent 0%, ${PRIMARY} 50%, transparent 100%)` }} />
        <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 900, fontSize: 13, letterSpacing: 2.2, textTransform: 'uppercase' }}>
          Waiting For Ban
        </div>
      </div>
    </div>
  );
}

function TeamBanCard({ side = 'left', order = 1, teamName, banInfo, reveal = false }) {
  const isLeft = side === 'left';
  const heroName = banInfo?.hero || 'tbd';
  const roleLabel = normalizeRole(banInfo?.role);
  const isTbd = heroName === 'tbd';
  const imageKey = `${banInfo?.role || 'damage'}/${heroName}`;
  const [fallback, setFallback] = useState({ key: imageKey, stage: 0 });
  const fallbackStage = fallback.key === imageKey ? fallback.stage : 0;
  const imgSrc = fallbackStage === 0
    ? getRosterPath(banInfo)
    : fallbackStage === 1
      ? getHeroPath(banInfo)
      : '/OW.svg';

  const handleImageError = () => {
    setFallback(current => ({
      key: imageKey,
      stage: current.key === imageKey ? Math.min(2, current.stage + 1) : 1
    }));
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        background: `
          radial-gradient(circle at center, color-mix(in srgb, var(--theme-primary) 5%, transparent) 0%, rgba(255,255,255,0.015) 30%, rgba(0,0,0,0) 76%),
          linear-gradient(180deg, rgba(28,28,28,0.96) 0%, rgba(18,18,18,0.98) 100%)
        `,
        border: `1px solid ${LINE_STRONG}`,
        boxShadow: '0 18px 40px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0 1px, transparent 1px 18px)', opacity: 0.14 }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${PRIMARY} 0%, rgba(255,255,255,0.12) 100%)`, boxShadow: '0 0 18px color-mix(in srgb, var(--theme-primary) 18%, transparent)', zIndex: 6 }} />
      <div style={{ position: 'absolute', inset: 12, border: `1px solid ${LINE}`, pointerEvents: 'none' }} />

      <TechCorner top left={isLeft} />
      <TechCorner top left={!isLeft} color="rgba(255,255,255,0.12)" />
      <OrderBadge order={order} side={side} />

      <div style={{ position: 'absolute', top: 26, [isLeft ? 'right' : 'left']: 40, zIndex: 7, textAlign: isLeft ? 'right' : 'left' }}>
        <div
          style={{
            color: '#fff',
            fontSize: 45,
            fontWeight: 950,
            lineHeight: 1.3,
            letterSpacing: 1,
            textTransform: 'uppercase',
            maxWidth: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 2px 8px rgba(0,0,0,0.22)'
          }}
        >
          {teamName || 'TEAM'}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 102,
          left: 18,
          right: 18,
          bottom: 104,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.05)',
          background: isTbd ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 100%)' : 'transparent'
        }}
      >
        {!isTbd ? (
          <>
            <img
              src={imgSrc}
              alt={heroName}
              onError={handleImageError}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: reveal ? 1 : 0,
                transform: reveal ? 'scale(1.03)' : 'scale(1.08)',
                filter: reveal ? 'blur(0px)' : 'blur(8px)',
                animation: reveal ? 'owbtBanCardRevealImg 860ms cubic-bezier(.2,.8,.2,1) forwards' : 'none',
                willChange: 'transform, opacity, filter',
                backfaceVisibility: 'hidden'
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: isLeft ? 'linear-gradient(90deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.34) 30%, rgba(0,0,0,0.12) 100%)' : 'linear-gradient(270deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.34) 30%, rgba(0,0,0,0.12) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)', backgroundSize: '52px 52px', opacity: 0.18 }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: '24%', background: 'linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.00) 100%)', transform: 'translateX(-120%)', animation: reveal ? 'owbtBanCardSweep 760ms cubic-bezier(.2,.8,.2,1) 140ms forwards' : 'none', mixBlendMode: 'screen' }} />
            <div style={{ position: 'absolute', [isLeft ? 'left' : 'right']: 18, top: 18, width: 84, height: 3, background: PRIMARY, opacity: 0.9 }} />
            <div style={{ position: 'absolute', [isLeft ? 'left' : 'right']: 18, bottom: 92, width: 3, height: 58, background: PRIMARY, opacity: 0.9 }} />
          </>
        ) : (
          <PendingState />
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 18,
          minHeight: 78,
          background: 'linear-gradient(180deg, rgba(24,24,24,0.98) 0%, rgba(16,16,16,0.99) 100%)',
          borderTop: `2px solid ${PRIMARY}`,
          borderLeft: `1px solid ${LINE}`,
          borderRight: `1px solid ${LINE}`,
          borderBottom: `1px solid ${LINE}`,
          display: 'grid',
          alignContent: 'center',
          padding: '12px 16px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
        }}
      >
        <div style={{ display: 'grid', gap: 4, justifyItems: isLeft ? 'start' : 'end' }}>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {isTbd ? 'Ban Status' : roleLabel}
          </div>
          <div style={{ color: '#fff', fontSize: 42, fontWeight: 950, lineHeight: 1.12, letterSpacing: 0.45, textTransform: 'uppercase', textAlign: isLeft ? 'left' : 'right' }}>
            {isTbd ? 'Pending' : heroName}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BanPhaseScene({ matchData, triggerAt }) {
  const [revealA, setRevealA] = useState(false);
  const [revealB, setRevealB] = useState(false);

  const currentMapData = useMemo(() => {
    const currentMap = Number(matchData?.currentMap || 1);
    const currentMapIndex = Math.max(0, currentMap - 1);
    return Array.isArray(matchData?.mapLineup) ? matchData.mapLineup[currentMapIndex] : null;
  }, [matchData?.currentMap, matchData?.mapLineup]);

  const sourceBansA = useMemo(
    () => getLiveFirstBans(matchData?.bansA, currentMapData?.bansA),
    [matchData?.bansA, currentMapData?.bansA]
  );
  const sourceBansB = useMemo(
    () => getLiveFirstBans(matchData?.bansB, currentMapData?.bansB),
    [matchData?.bansB, currentMapData?.bansB]
  );

  const banA = useMemo(() => getBanInfo(sourceBansA), [sourceBansA]);
  const banB = useMemo(() => getBanInfo(sourceBansB), [sourceBansB]);
  const orderMode = matchData?.banOrderMode || currentMapData?.banOrderMode || 'A_FIRST';
  const isAFirst = orderMode === 'A_FIRST';

  useEffect(() => {
    if (!triggerAt) return;

    const resetTimer = window.setTimeout(() => {
      setRevealA(false);
      setRevealB(false);
    }, 0);

    const firstTimer = window.setTimeout(() => {
      if (isAFirst) setRevealA(true);
      else setRevealB(true);
    }, 260);

    const secondTimer = window.setTimeout(() => {
      if (isAFirst) setRevealB(true);
      else setRevealA(true);
    }, 980);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
    };
  }, [triggerAt, isAFirst]);

  if (!triggerAt) return null;

  const orderA = isAFirst ? 1 : 2;
  const orderB = isAFirst ? 2 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${DARK} 0%, ${PANEL} 100%)`,
        animation: 'owbtBanSceneBgIn 400ms ease forwards',
        willChange: 'opacity'
      }}
    >
      <style>{`
        @keyframes owbtBanSceneBgIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes owbtBanTextDrop { 0% { opacity: 0; transform: translateY(-40px) scale(1.05); } 100% { opacity: 1; transform: translateY(-8px) scale(1); } }
        @keyframes owbtBanCardRevealImg { 0% { opacity: 0; transform: scale(1.08); filter: blur(8px); } 100% { opacity: 1; transform: scale(1.03); filter: blur(0px); } }
        @keyframes owbtBanCardSweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(440%); } }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.012) 1px, transparent 1px)', backgroundSize: '120px 120px', opacity: 0.24 }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, background: PRIMARY, boxShadow: '0 0 12px color-mix(in srgb, var(--theme-primary) 28%, transparent)' }} />
          <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: 2, color: 'rgba(255,255,255,0.72)' }}>OWBT_BAN_INTERFACE</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.38)' }}>
          {orderMode === 'A_FIRST' ? 'A_FIRST // B_SECOND' : 'B_FIRST // A_SECOND'}
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 250, fontWeight: 950, lineHeight: 0.9, letterSpacing: 8, color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,0.08)', textTransform: 'uppercase', userSelect: 'none', animation: 'owbtBanTextDrop 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          BAN
        </div>
      </div>

      <div style={{ position: 'absolute', inset: '150px 120px 92px', display: 'grid', gridTemplateColumns: '1fr 42px 1fr', gap: 28, alignItems: 'stretch' }}>
        <TeamBanCard side="left" order={orderA} teamName={matchData.teamA} banInfo={banA} reveal={revealA} />
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 2, height: '74%', background: `linear-gradient(180deg, transparent 0%, ${PRIMARY} 18%, ${PRIMARY} 82%, transparent 100%)`, opacity: 0.42 }} />
        </div>
        <TeamBanCard side="right" order={orderB} teamName={matchData.teamB} banInfo={banB} reveal={revealB} />
      </div>
    </div>
  );
}
