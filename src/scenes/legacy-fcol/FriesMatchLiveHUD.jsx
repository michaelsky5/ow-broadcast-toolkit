/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-unused-vars */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { needsAttackDefense } from '../../data/overwatch';
import BeginInfoOverlay from './BeginInfoOverlay';
import BanPhaseScene from './BanPhaseScene';

const COLORS = {
  mainDark: '#2A2A2A',
  panelDark: '#242424',
  panelDeep: '#1f1f1f',
  yellow: 'var(--theme-primary)',
  white: '#ffffff',
  black: '#2A2A2A',
  banRed: '#ff4d4d',
  gray: '#aaaaaa',
  line: 'rgba(255,255,255,0.05)',
  lineStrong: 'rgba(255,255,255,0.10)'
};

const MODE_ICON_MAP = {
  CONTROL: '/modes/control.png',
  ESCORT: '/modes/escort.png',
  FLASHPOINT: '/modes/flashpoint.png',
  HYBRID: '/modes/hybrid.png',
  PUSH: '/modes/push.png',
  CLASH: '/modes/clash.svg'
};

const containerStyle = {
  width: '1920px',
  height: '1080px',
  backgroundColor: 'transparent',
  position: 'relative',
  fontFamily: '"HarmonyOS Sans SC", sans-serif'
};

const infoBarStyle = {
  position: 'absolute',
  top: '-2px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: COLORS.mainDark,
  color: COLORS.white,
  padding: '5px 15px',
  fontSize: '14px',
  fontWeight: '900',
  letterSpacing: '2.2px',
  zIndex: 100,
  opacity: 0,
  animation: 'hudFadeInDownCenter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  borderLeft: `1px solid ${COLORS.lineStrong}`,
  borderRight: `1px solid ${COLORS.lineStrong}`,
  borderBottom: `1px solid ${COLORS.lineStrong}`,
  textTransform: 'uppercase',
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden'
};

const teamBarLayout = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0px 42.5px'
};

const teamWrapperLeftStyle = {
  width: '525px',
  display: 'flex',
  flexDirection: 'column',
  opacity: 0,
  animation: 'hudSlideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden'
};

const teamWrapperRightStyle = {
  width: '525px',
  display: 'flex',
  flexDirection: 'column',
  opacity: 0,
  animation: 'hudSlideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden'
};

const subBarStyle = {
  height: '20px',
  backgroundColor: 'rgba(42,42,42,0.94)',
  display: 'flex',
  width: '100%',
  borderTop: `1px solid ${COLORS.lineStrong}`,
  borderBottom: `1px solid ${COLORS.lineStrong}`
};

const yellowAccentLeft = { width: '4px', height: '100%', backgroundColor: COLORS.yellow };
const yellowAccentRight = { width: '4px', height: '100%', backgroundColor: COLORS.yellow };

const subBarContentStyle = {
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 8px'
};

const subBarTextHighlight = {
  color: COLORS.white,
  fontSize: '12px',
  fontWeight: '900',
  letterSpacing: '1px',
  textTransform: 'uppercase'
};

const subBarTextNormal = {
  color: COLORS.gray,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  textTransform: 'uppercase'
};

const teamGroupStyle = { display: 'flex', width: '100%', height: '45px', alignItems: 'center' };

const logoBlockStyle = {
  width: '45px',
  height: '45px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0
};

const logoImgStyle = { width: '80%', height: '80%', objectFit: 'contain' };

const banAreaStyle = {
  height: '45px',
  backgroundColor: COLORS.mainDark,
  display: 'flex',
  alignItems: 'center',
  padding: '0 5px',
  gap: '3px',
  flexShrink: 0
};

const teamNameBlockStyle = {
  flex: 1,
  minWidth: 0,
  height: '45px',
  backgroundColor: COLORS.mainDark,
  color: COLORS.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  fontWeight: '900',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  position: 'relative'
};

const teamNameTextStyle = {
  maxWidth: 'calc(100% - 20px)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1.12,
  padding: '0 10px'
};

const getSideTagStyle = (tag, isLeft) => ({
  width: '45px',
  height: '45px',
  padding: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.mainDark,
  borderLeft: isLeft ? `1px solid ${COLORS.lineStrong}` : 'none',
  borderRight: !isLeft ? `1px solid ${COLORS.lineStrong}` : 'none',
  boxSizing: 'border-box',
  flexShrink: 0
});

const sideIconStyle = {
  width: '31px',
  height: '31px',
  objectFit: 'contain',
  display: 'block',
  filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.16))'
};

const SideTag = React.memo(({ tag, isLeft }) => (
  <div style={getSideTagStyle(tag, isLeft)}>
    <img
      src={`/modes/${tag}.svg`}
      alt={tag === 'ATK' ? 'Attack' : 'Defense'}
      style={sideIconStyle}
      onError={event => {
        event.currentTarget.style.display = 'none';
      }}
    />
  </div>
));

const getTeamMetaBadgeWidth = (mode, label) => {
  const normalizedMode = String(mode || '').toUpperCase();
  const text = String(label || '').trim();
  if (normalizedMode === 'RECORD' || /^\d+\s*-\s*\d+$/.test(text)) return '56px';
  if (normalizedMode === 'SEED') return '48px';
  return '72px';
};

const getTeamMetaBadgeStyle = (isLeft, mode, label) => {
  const normalizedMode = String(mode || '').toUpperCase();
  const isSeed = normalizedMode === 'SEED';

  return {
    width: getTeamMetaBadgeWidth(mode, label),
    height: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    borderLeft: isLeft ? `1px solid ${COLORS.lineStrong}` : 'none',
    borderRight: !isLeft ? `1px solid ${COLORS.lineStrong}` : 'none',
    backgroundColor: 'rgba(42,42,42,0.96)',
    color: COLORS.yellow,
    padding: '0 6px',
    overflow: 'hidden',
    fontSize: isSeed ? '14px' : '10px',
    fontWeight: '900',
    letterSpacing: isSeed ? '0.3px' : '0.55px',
    lineHeight: 1.12,
    textAlign: 'center',
    textOverflow: 'ellipsis',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  };
};

const TeamMetaBadge = React.memo(({ label, mode, isLeft }) => {
  const text = String(label || '').trim();
  if (!text) return null;
  return <div style={getTeamMetaBadgeStyle(isLeft, mode, text)} title={text}>{text}</div>;
});

const scoreBoxStyle = {
  width: '45px',
  height: '45px',
  backgroundColor: COLORS.yellow,
  color: COLORS.black,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '32px',
  fontWeight: '900',
  flexShrink: 0
};

const playerListRowStyle = { display: 'flex', gap: '3px' };

const playerSlotStyle = {
  width: '121px',
  height: '24px',
  backgroundColor: 'rgba(42,42,42,0.94)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '12px',
  fontWeight: '900',
  borderBottom: `2px solid ${COLORS.yellow}`,
  transition: 'color 0.3s',
  textTransform: 'uppercase',
  letterSpacing: '0.2px',
  lineHeight: 1.12
};

const subBadgeStyle = {
  fontSize: '9px',
  backgroundColor: COLORS.yellow,
  color: COLORS.black,
  padding: '1px 3px',
  marginRight: '4px',
  borderRadius: '2px',
  fontWeight: '900'
};

const commsUnderStyle = {
  backgroundColor: 'rgba(42,42,42,0.95)',
  color: COLORS.white,
  height: '18px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '10px',
  fontWeight: '900',
  marginTop: '2px',
  borderRadius: '2px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase'
};

const banBoxContainer = { display: 'flex', height: '45px', gap: '2px' };

const banImgStyle = {
  height: '45px',
  width: '45px',
  objectFit: 'cover',
  backgroundColor: COLORS.mainDark
};

const banLabelStyle = {
  width: '14px',
  height: '45px',
  backgroundColor: COLORS.yellow,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '9px',
  fontWeight: '900',
  color: COLORS.black,
  padding: '4px 0',
  boxSizing: 'border-box'
};

const normalizeText = v => String(v || '').trim().toLowerCase();

const normalizeRosterRole = role => {
  const v = String(role || '').trim().toLowerCase();
  if (['tank', 't'].includes(v)) return 'tank';
  if (['support', 'sup', 'healer'].includes(v)) return 'support';
  if (['damage', 'dps', 'attack'].includes(v)) return 'damage';
  return v || 'damage';
};

const getModeKey = type => String(type || '').trim().split(' ')[0].toUpperCase();
const getModeIconPath = type => MODE_ICON_MAP[getModeKey(type)] || '';

const getFallbackTeamShort = name =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(v => v[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || 'TBD';

const clampFontSize = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const getKeyPlayerProfileFromRoster = (matchData, side, playerName) => {
  const roster = side === 'A' ? matchData.rosterPlayersA || [] : matchData.rosterPlayersB || [];
  const target = normalizeText(playerName);
  const found = roster.find(
    p =>
      normalizeText(p?.nickname) === target ||
      normalizeText(p?.battleTag) === target ||
      normalizeText(p?.name) === target ||
      normalizeText(p?.id) === target
  );
  if (!found) return null;
  return {
    nickname: found.nickname || playerName || 'PLAYER',
    battleTag: found.battleTag || '',
    role: normalizeRosterRole(found.role || found.position || ''),
    hero: String(found.hero || found.selectedHero || found.currentHero || found.mainHero || found.signatureHero || '').trim().toLowerCase()
  };
};

const getValidLogo = logoPath => {
  return logoPath || '/OW.svg';
};

const getTotalMapsFromFormat = format => {
  const value = String(format || '').trim().toUpperCase();
  if (value.startsWith('FT')) return (parseInt(value.replace('FT', ''), 10) || 3) * 2 - 1;
  if (value.startsWith('BO')) return parseInt(value.replace('BO', ''), 10) || 5;
  return 5;
};

const BanBox = React.memo(({ heroName, align }) => (
  <div style={{ ...banBoxContainer, flexDirection: align === 'left' ? 'row-reverse' : 'row' }}>
    <img src={`/heroes/${heroName}.png`} style={banImgStyle} alt="ban" onError={e => { e.target.src = '/OW.svg'; }} />
    <div style={banLabelStyle}><span>B</span><span>A</span><span>N</span></div>
  </div>
));

const KeyPlayerCard = React.memo(({ show, phase, data, matchData }) => {
  if (!show) return null;
  const isLeft = data.side === 'A';
  const isEnter = phase === 'enter';
  const profile = getKeyPlayerProfileFromRoster(matchData, data.side, data.name);
  const heroImg = profile?.role && profile?.hero ? `/roster/${profile.role}/${profile.hero}.png` : '';
  const fallbackHeroImg = profile?.role && profile?.hero ? `/heroes/${profile.role}/${profile.hero}.png` : '';

  return (
    <div
      style={{
        position: 'absolute',
        top: '500px',
        [isLeft ? 'left' : 'right']: '52px',
        width: '800px',
        height: '330px',
        zIndex: 340,
        pointerEvents: 'none',
        opacity: isEnter ? 1 : 0,
        transform: isEnter ? 'translateX(0) scale(0.7)' : isLeft ? 'translateX(-240px) scale(0.7)' : 'translateX(240px) scale(0.7)',
        transformOrigin: isLeft ? 'left center' : 'right center',
        transition: 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${COLORS.mainDark} 0%, ${COLORS.panelDeep} 100%)`, border: `1px solid ${COLORS.lineStrong}`, boxShadow: '0 32px 90px rgba(0,0,0,0.52)' }}>
        <div style={{ position: 'absolute', inset: '10px', border: `1px solid ${COLORS.line}`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: COLORS.yellow }} />
        <div style={{ position: 'absolute', top: 0, [isLeft ? 'right' : 'left']: 0, width: 0, height: 0, borderTop: '120px solid var(--theme-primary)', borderLeft: isLeft ? '120px solid transparent' : '0 solid transparent', borderRight: isLeft ? '0 solid transparent' : '120px solid transparent' }} />
        <div style={{ position: 'absolute', [isLeft ? 'left' : 'right']: '34px', top: '34px', width: '5px', height: '92px', background: COLORS.yellow }} />
        <div style={{ position: 'absolute', [isLeft ? 'left' : 'right']: '34px', top: '34px', width: '132px', height: '5px', background: COLORS.yellow }} />

        <div style={{ position: 'absolute', top: 0, bottom: 0, [isLeft ? 'right' : 'left']: 0, width: '62%', overflow: 'hidden' }}>
          {heroImg ? (
            <img
              src={heroImg}
              alt={data.name}
              onError={e => {
                if (fallbackHeroImg && e.currentTarget.src !== window.location.origin + fallbackHeroImg) e.currentTarget.src = fallbackHeroImg;
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82, filter: 'brightness(0.82) contrast(1.06) saturate(0.96)', transform: isLeft ? 'translateX(40px) scale(1.32)' : 'translateX(-40px) scale(1.32)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.00) 100%)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: isLeft ? 'linear-gradient(270deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.06) 18%, rgba(0,0,0,0.26) 42%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0.86) 100%)' : 'linear-gradient(90deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.06) 18%, rgba(0,0,0,0.26) 42%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0.86) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.12 }} />
          <div style={{ position: 'absolute', top: '-10%', bottom: '-10%', width: '28%', background: 'linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.00) 100%)', transform: isEnter ? 'translateX(420%) skewX(-18deg)' : 'translateX(-120%) skewX(-18deg)', transition: 'transform 900ms cubic-bezier(.2,.8,.2,1) 120ms', mixBlendMode: 'screen', willChange: 'transform' }} />
        </div>

        <div style={{ position: 'absolute', inset: 0, clipPath: isLeft ? 'polygon(0 0, 64% 0, 60% 100%, 0 100%)' : 'polygon(36% 0, 100% 0, 100% 100%, 40% 100%)', background: isLeft ? 'linear-gradient(100deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.03) 22%, rgba(0,0,0,0.18) 44%, rgba(0,0,0,0.54) 72%, rgba(0,0,0,0.78) 100%)' : 'linear-gradient(260deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.03) 22%, rgba(0,0,0,0.18) 44%, rgba(0,0,0,0.54) 72%, rgba(0,0,0,0.78) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, [isLeft ? 'left' : 'right']: 0, width: '64%', clipPath: isLeft ? 'polygon(0 0, 74% 0, 64% 100%, 0 100%)' : 'polygon(26% 0, 100% 0, 100% 100%, 36% 100%)', borderRight: isLeft ? `2px solid ${COLORS.yellow}` : 'none', borderLeft: !isLeft ? `2px solid ${COLORS.yellow}` : 'none', opacity: 0.95 }} />

        <div style={{ position: 'absolute', [isLeft ? 'left' : 'right']: '52px', top: '52px', zIndex: 6, display: 'grid', gap: '12px', justifyItems: isLeft ? 'start' : 'end', maxWidth: '500px' }}>
          <div style={{ background: COLORS.yellow, color: COLORS.black, padding: '8px 14px', fontSize: '13px', fontWeight: '900', letterSpacing: '2.2px', textTransform: 'uppercase', boxShadow: '0 10px 18px rgba(0,0,0,0.24)' }}>KEY PLAYER</div>
          <div style={{ position: 'relative', color: COLORS.white, fontSize: '65px', fontWeight: '900', lineHeight: 1.12, letterSpacing: '1px', textTransform: 'uppercase', textAlign: isLeft ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 12px 28px rgba(0,0,0,0.40)' }}>
            {data.name || 'PLAYER'}
            <div style={{ position: 'absolute', top: '8px', [isLeft ? 'left' : 'right']: '6px', color: 'rgba(255,255,255,0.05)', fontSize: '118px', fontWeight: '900', lineHeight: 1.12, letterSpacing: '1px', pointerEvents: 'none' }}>
              {data.name || 'PLAYER'}
            </div>
          </div>
          {!!data.battleTag && <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '24px', fontWeight: '700', lineHeight: 1.12, letterSpacing: '0.6px', textAlign: isLeft ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.battleTag}</div>}
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '52px', background: `linear-gradient(180deg, ${COLORS.panelDark} 0%, ${COLORS.panelDeep} 100%)`, borderTop: `2px solid ${COLORS.yellow}` }} />
        <div style={{ position: 'absolute', bottom: '16px', [isLeft ? 'left' : 'right']: '30px', width: '260px', height: '4px', background: 'linear-gradient(90deg, transparent 0%, var(--theme-primary) 45%, transparent 100%)' }} />
      </div>
    </div>
  );
});

export default function MatchLiveHUD({ matchData, isActive = false }) {
  const [runState, setRunState] = useState('IDLE');
  const isOverlay = typeof window !== 'undefined' && window.location.hash === '#overlay';

  const isTournamentMode = matchData.uiMode === 'TOURNAMENT';

  // 🌟 [间距与悬浮自动居中调控中心] 🌟
  // 核心逻辑：
  // 1. 我们获取导播设定的 Y-Offset (appliedMarginTop)。
  // 2. 这个 Offset 代表“队伍信息主体（Logo/名字/比分）”下沉的总距离。
  // 3. 为了让地图细条(SubBar)和中央胶囊(CenterCapsule)恰好悬浮在 [屏幕顶端] 与 [队伍主体] 的中央：
  //    我们将 SubBar 的 marginTop 设为 appliedMarginTop / 2。
  //    我们将 SubBar 的 marginBottom 设为 appliedMarginTop / 2。
  // 4. 由于中央胶囊的 top 值绑定了 subBarMarginTop，它们实现了绝对的顶部对齐。
  const dynamicLayout = useMemo(() => {
    const defaultTournamentMarginTop = 46; 
    const defaultNormalMarginTop = 0;      

    const customTop = parseInt(matchData.hudMarginTop, 10);
    const appliedMarginTop = !isNaN(customTop) 
      ? customTop 
      : (isTournamentMode ? defaultTournamentMarginTop : defaultNormalMarginTop);

    // 将 Y-Offset 一分为二，完美实现中间细条和胶囊的悬浮居中
    const halfTop = Math.floor(appliedMarginTop / 2);
    const halfBottom = Math.ceil(appliedMarginTop / 2);

    return {
      subBarMarginTop: `${halfTop}px`,
      subBarMarginBottom: `${halfBottom}px`, // 充当与下方队伍主体的动态间距
      centerCapsuleTop: `${halfTop}px`,      // 完美和 SubBar 顶部对齐！
      wrapperGap: isTournamentMode ? '88px' : '81px' 
    };
  }, [isTournamentMode, matchData.hudMarginTop]);

  const beginArmedRef = useRef(matchData.beginInfoEnabled);
  const lastAutoBeginTriggerRef = useRef(matchData.autoBeginTriggerAt || 0);

  useEffect(() => {
    beginArmedRef.current = matchData.beginInfoEnabled;
  }, [matchData.beginInfoEnabled]);

  useEffect(() => {
    if (isActive) {
      if (beginArmedRef.current) setRunState('INTRO');
      else setRunState('HUD');
    } else {
      setRunState('IDLE');
    }
  }, [isActive]);

  useEffect(() => {
    const nextTrigger = matchData.autoBeginTriggerAt || 0;

    if (!isActive) return;
    if (!nextTrigger) return;
    if (nextTrigger === lastAutoBeginTriggerRef.current) return;
    if (matchData.showBanPhase) return;

    lastAutoBeginTriggerRef.current = nextTrigger;

    if (matchData.beginInfoEnabled) setRunState('INTRO');
    else setRunState('HUD');
  }, [isActive, matchData.autoBeginTriggerAt, matchData.showBanPhase, matchData.beginInfoEnabled]);

  const renderState = (runState === 'IDLE' && !isOverlay) ? 'HUD' : runState;

  const [tickerKey, setTickerKey] = useState(0);
  const [localShowTicker, setLocalShowTicker] = useState(matchData.showTicker);
  const [sponsorSpotlightPhase, setSponsorSpotlightPhase] = useState('hidden');
  const [sponsorSpotlightContentPhase, setSponsorSpotlightContentPhase] = useState('enter');
  const [sponsorSpotlightIndex, setSponsorSpotlightIndex] = useState(Math.max(0, Number(matchData.sponsorSpotlightIndex) || 0));
  const [sponsorSpotlightRunKey, setSponsorSpotlightRunKey] = useState(0);
  const [sponsorSpotlightProgressDelayMs, setSponsorSpotlightProgressDelayMs] = useState(0);
  const [banPhaseTrigger, setBanPhaseTrigger] = useState(0);
  const [showKeyPlayer, setShowKeyPlayer] = useState(false);
  const [keyPlayerPhase, setKeyPlayerPhase] = useState('hidden');
  const [keyPlayerData, setKeyPlayerData] = useState({ side: 'A', name: '', battleTag: '' });

  const keyPlayerTimerRef = useRef(null);
  const keyPlayerExitTimerRef = useRef(null);
  const keyPlayerEnterTimerRef = useRef(null);
  const keyPlayerArmedRef = useRef(false);
  const lastConsumedKeyTriggerRef = useRef(0);
  const sponsorSpotlightIndexRef = useRef(Math.max(0, Number(matchData.sponsorSpotlightIndex) || 0));
  const sponsorSpotlightDisplayedIndexRef = useRef(Math.max(0, Number(matchData.sponsorSpotlightIndex) || 0));
  const sponsorSpotlightPhaseRef = useRef('hidden');
  const sponsorSpotlightVisibleUntilRef = useRef(0);
  const sponsorSpotlightEnterTimerRef = useRef(null);
  const sponsorSpotlightHideTimerRef = useRef(null);
  const sponsorSpotlightExitTimerRef = useRef(null);
  const sponsorSpotlightContentSwapTimerRef = useRef(null);
  const sponsorSpotlightContentEnterTimerRef = useRef(null);
  const sponsorSpotlightAutoStartRef = useRef(null);
  const sponsorSpotlightAutoIntervalRef = useRef(null);
  const restartSponsorSpotlightAutoRotationRef = useRef(null);
  const sponsorSpotlightPersistentTimerRef = useRef(null);
  const restartSponsorSpotlightPersistentRotationRef = useRef(null);
  const lastSponsorSpotlightTriggerRef = useRef(matchData.sponsorSpotlightTriggerAt || 0);
  const tickerScheduleStartRef = useRef(null);
  const tickerScheduleIntervalRef = useRef(null);
  const restartTickerScheduleRef = useRef(null);
  const lastTickerTriggerRef = useRef(matchData.tickerTriggerAt || 0);
  const lastTickerStopRef = useRef(matchData.tickerStopAt || 0);

  const sponsorSpotlightSource = JSON.stringify(matchData.sponsorSpotlights || []);
  const sponsorSpotlights = useMemo(() => (
    Array.isArray(matchData.sponsorSpotlights)
      ? matchData.sponsorSpotlights.filter(item => item && (item.logo || item.name))
      : []
  ), [sponsorSpotlightSource]);
  const sponsorSpotlightMode = ['AUTO', 'PERSISTENT', 'MANUAL'].includes(String(matchData.sponsorSpotlightMode || '').toUpperCase())
    ? String(matchData.sponsorSpotlightMode).toUpperCase()
    : 'OFF';
  const sponsorSpotlightDurationMs = Math.max(4, Math.min(20, Number(matchData.sponsorSpotlightDurationSeconds) || 8)) * 1000;
  const sponsorSpotlightIntervalMs = Math.max(15, Math.min(180, Number(matchData.sponsorSpotlightIntervalSeconds) || 45)) * 1000;
  const sponsorSpotlightProgressVisible = matchData.sponsorSpotlightProgressVisible !== false;
  const tickerMode = ['ONCE', 'SCHEDULED', 'INFINITE'].includes(String(matchData.tickerMode || '').toUpperCase())
    ? String(matchData.tickerMode).toUpperCase()
    : 'ONCE';
  const tickerDurationSeconds = Math.max(12, Math.min(60, Number(matchData.tickerDurationSeconds) || 25));
  const tickerIntervalSeconds = Math.max(
    tickerDurationSeconds + 5,
    Math.max(30, Math.min(600, Number(matchData.tickerIntervalSeconds) || 90))
  );
  const tickerInitialDelaySeconds = Math.max(0, Math.min(120, Number(matchData.tickerInitialDelaySeconds) || 0));

  const playTickerOnce = useCallback(() => {
    setLocalShowTicker(true);
    setTickerKey(key => key + 1);
  }, []);

  const clearTickerSchedule = useCallback(() => {
    if (tickerScheduleStartRef.current) {
      clearTimeout(tickerScheduleStartRef.current);
      tickerScheduleStartRef.current = null;
    }
    if (tickerScheduleIntervalRef.current) {
      clearTimeout(tickerScheduleIntervalRef.current);
      tickerScheduleIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    sponsorSpotlightPhaseRef.current = sponsorSpotlightPhase;
  }, [sponsorSpotlightPhase]);

  const clearSponsorVisualTimers = useCallback(() => {
    [
      sponsorSpotlightEnterTimerRef,
      sponsorSpotlightHideTimerRef,
      sponsorSpotlightExitTimerRef,
      sponsorSpotlightContentSwapTimerRef,
      sponsorSpotlightContentEnterTimerRef
    ].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });
  }, []);

  const clearSponsorAutoTimers = useCallback(() => {
    if (sponsorSpotlightAutoStartRef.current) {
      clearTimeout(sponsorSpotlightAutoStartRef.current);
      sponsorSpotlightAutoStartRef.current = null;
    }
    if (sponsorSpotlightAutoIntervalRef.current) {
      clearTimeout(sponsorSpotlightAutoIntervalRef.current);
      sponsorSpotlightAutoIntervalRef.current = null;
    }
  }, []);

  const showSponsorSpotlight = useCallback((requestedIndex, advance = false, persistent = false) => {
    if (!sponsorSpotlights.length) return;

    clearSponsorVisualTimers();
    const baseIndex = Number.isFinite(Number(requestedIndex))
      ? Number(requestedIndex)
      : sponsorSpotlightIndexRef.current;
    const nextIndex = ((baseIndex + (advance ? 1 : 0)) % sponsorSpotlights.length + sponsorSpotlights.length) % sponsorSpotlights.length;
    const shellVisible = sponsorSpotlightPhaseRef.current === 'enter';
    const contentChanged = nextIndex !== sponsorSpotlightDisplayedIndexRef.current;
    const revealDelayMs = shellVisible && contentChanged ? 194 : (!shellVisible ? 34 : 0);

    sponsorSpotlightIndexRef.current = nextIndex;
    sponsorSpotlightVisibleUntilRef.current = Date.now() + revealDelayMs + sponsorSpotlightDurationMs;
    setSponsorSpotlightProgressDelayMs(shellVisible && contentChanged ? revealDelayMs : 0);
    setSponsorSpotlightRunKey(key => key + 1);
    if (shellVisible && contentChanged) {
      setSponsorSpotlightContentPhase('exit');
      sponsorSpotlightContentSwapTimerRef.current = setTimeout(() => {
        sponsorSpotlightDisplayedIndexRef.current = nextIndex;
        setSponsorSpotlightIndex(nextIndex);
        setSponsorSpotlightContentPhase('pre-enter');
        sponsorSpotlightContentEnterTimerRef.current = setTimeout(() => {
          setSponsorSpotlightContentPhase('enter');
          sponsorSpotlightContentEnterTimerRef.current = null;
        }, 34);
        sponsorSpotlightContentSwapTimerRef.current = null;
      }, 160);
    } else {
      sponsorSpotlightDisplayedIndexRef.current = nextIndex;
      setSponsorSpotlightIndex(nextIndex);
      setSponsorSpotlightContentPhase('enter');
    }

    if (!shellVisible) {
      setSponsorSpotlightPhase('pre-enter');
      sponsorSpotlightEnterTimerRef.current = setTimeout(() => {
        setSponsorSpotlightPhase('enter');
        sponsorSpotlightEnterTimerRef.current = null;
      }, 34);
    }

    if (!persistent) {
      sponsorSpotlightHideTimerRef.current = setTimeout(() => {
        setSponsorSpotlightPhase('exit');
        sponsorSpotlightExitTimerRef.current = setTimeout(() => {
          setSponsorSpotlightPhase('hidden');
          sponsorSpotlightExitTimerRef.current = null;
        }, 440);
        sponsorSpotlightHideTimerRef.current = null;
      }, sponsorSpotlightDurationMs + revealDelayMs);
    }
  }, [clearSponsorVisualTimers, sponsorSpotlightDurationMs, sponsorSpotlights]);

  const clearKeyPlayerTimers = () => {
    [keyPlayerTimerRef, keyPlayerExitTimerRef, keyPlayerEnterTimerRef].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });
  };

  useEffect(() => {
    clearTickerSchedule();

    if (!isActive) {
      setLocalShowTicker(false);
      return clearTickerSchedule;
    }

    if (tickerMode === 'INFINITE') {
      setLocalShowTicker(Boolean(matchData.showTicker));
      if (matchData.showTicker) setTickerKey(key => key + 1);
      return clearTickerSchedule;
    }

    if (tickerMode === 'SCHEDULED' && matchData.showTicker) {
      setLocalShowTicker(false);

      const runScheduledTicker = () => {
        playTickerOnce();
        tickerScheduleIntervalRef.current = setTimeout(runScheduledTicker, tickerIntervalSeconds * 1000);
      };
      const restartScheduleAfterCurrentRun = () => {
        clearTickerSchedule();
        tickerScheduleIntervalRef.current = setTimeout(runScheduledTicker, tickerIntervalSeconds * 1000);
      };

      restartTickerScheduleRef.current = restartScheduleAfterCurrentRun;
      tickerScheduleStartRef.current = setTimeout(() => {
        tickerScheduleStartRef.current = null;
        runScheduledTicker();
      }, tickerInitialDelaySeconds * 1000);
      return () => {
        restartTickerScheduleRef.current = null;
        clearTickerSchedule();
      };
    }

    if (tickerMode === 'ONCE' && matchData.showTicker) {
      playTickerOnce();
      return clearTickerSchedule;
    }

    setLocalShowTicker(false);
    return clearTickerSchedule;
  }, [
    clearTickerSchedule,
    isActive,
    matchData.showTicker,
    playTickerOnce,
    tickerInitialDelaySeconds,
    tickerIntervalSeconds,
    tickerMode
  ]);

  useEffect(() => {
    const nextTrigger = matchData.tickerTriggerAt || 0;
    if (!isActive || !nextTrigger || nextTrigger === lastTickerTriggerRef.current) return;

    lastTickerTriggerRef.current = nextTrigger;
    playTickerOnce();
    if (tickerMode === 'SCHEDULED' && matchData.showTicker) {
      restartTickerScheduleRef.current?.();
    }
  }, [isActive, matchData.showTicker, matchData.tickerTriggerAt, playTickerOnce, tickerMode]);

  useEffect(() => {
    const nextStop = matchData.tickerStopAt || 0;
    if (!nextStop || nextStop === lastTickerStopRef.current) return;

    lastTickerStopRef.current = nextStop;
    setLocalShowTicker(false);
  }, [matchData.tickerStopAt]);

  useEffect(() => {
    clearSponsorAutoTimers();

    if (!isActive || sponsorSpotlightMode !== 'AUTO' || !sponsorSpotlights.length) return undefined;

    function scheduleNextAutoSponsor() {
      if (sponsorSpotlightAutoIntervalRef.current) {
        clearTimeout(sponsorSpotlightAutoIntervalRef.current);
      }
      const nextAutoAt = sponsorSpotlightVisibleUntilRef.current + sponsorSpotlightIntervalMs;
      const delay = Math.max(0, nextAutoAt - Date.now());
      sponsorSpotlightAutoIntervalRef.current = setTimeout(() => {
        const remaining = sponsorSpotlightVisibleUntilRef.current + sponsorSpotlightIntervalMs - Date.now();
        if (remaining > 16) {
          scheduleNextAutoSponsor();
          return;
        }
        showSponsorSpotlight(sponsorSpotlightIndexRef.current, true);
        scheduleNextAutoSponsor();
      }, delay);
    }

    restartSponsorSpotlightAutoRotationRef.current = () => {
      clearSponsorAutoTimers();
      scheduleNextAutoSponsor();
    };

    sponsorSpotlightAutoStartRef.current = setTimeout(() => {
      showSponsorSpotlight(sponsorSpotlightIndexRef.current, false);
      scheduleNextAutoSponsor();
      sponsorSpotlightAutoStartRef.current = null;
    }, 15000);

    return () => {
      restartSponsorSpotlightAutoRotationRef.current = null;
      clearSponsorAutoTimers();
    };
  }, [clearSponsorAutoTimers, isActive, showSponsorSpotlight, sponsorSpotlightDurationMs, sponsorSpotlightIntervalMs, sponsorSpotlightMode, sponsorSpotlights.length]);

  useEffect(() => {
    if (!isActive || sponsorSpotlightMode !== 'PERSISTENT' || !sponsorSpotlights.length) return undefined;

    function schedulePersistentRotation() {
      if (sponsorSpotlightPersistentTimerRef.current) {
        clearTimeout(sponsorSpotlightPersistentTimerRef.current);
      }

      if (sponsorSpotlights.length < 2) {
        sponsorSpotlightPersistentTimerRef.current = null;
        return;
      }

      const delay = Math.max(0, sponsorSpotlightVisibleUntilRef.current - Date.now());
      sponsorSpotlightPersistentTimerRef.current = setTimeout(() => {
        const remaining = sponsorSpotlightVisibleUntilRef.current - Date.now();
        if (remaining > 16) {
          schedulePersistentRotation();
          return;
        }
        showSponsorSpotlight(sponsorSpotlightIndexRef.current, true, true);
        schedulePersistentRotation();
      }, delay);
    }

    const requestedIndex = Math.max(0, Number(matchData.sponsorSpotlightIndex) || 0);
    sponsorSpotlightIndexRef.current = requestedIndex;
    showSponsorSpotlight(requestedIndex, false, true);
    restartSponsorSpotlightPersistentRotationRef.current = schedulePersistentRotation;
    schedulePersistentRotation();

    return () => {
      restartSponsorSpotlightPersistentRotationRef.current = null;
      if (sponsorSpotlightPersistentTimerRef.current) {
        clearTimeout(sponsorSpotlightPersistentTimerRef.current);
        sponsorSpotlightPersistentTimerRef.current = null;
      }
      clearSponsorVisualTimers();
      setSponsorSpotlightPhase('hidden');
    };
  }, [clearSponsorVisualTimers, isActive, showSponsorSpotlight, sponsorSpotlightDurationMs, sponsorSpotlightMode, sponsorSpotlights.length]);

  useEffect(() => {
    const nextTrigger = matchData.sponsorSpotlightTriggerAt || 0;
    if (!isActive || !nextTrigger || nextTrigger === lastSponsorSpotlightTriggerRef.current) return;

    lastSponsorSpotlightTriggerRef.current = nextTrigger;
    const requestedIndex = Math.max(0, Number(matchData.sponsorSpotlightIndex) || 0);
    sponsorSpotlightIndexRef.current = requestedIndex;
    showSponsorSpotlight(requestedIndex, false, sponsorSpotlightMode === 'PERSISTENT');
    if (sponsorSpotlightMode === 'AUTO') {
      restartSponsorSpotlightAutoRotationRef.current?.();
    }
    if (sponsorSpotlightMode === 'PERSISTENT') {
      restartSponsorSpotlightPersistentRotationRef.current?.();
    }
  }, [isActive, matchData.sponsorSpotlightIndex, matchData.sponsorSpotlightTriggerAt, showSponsorSpotlight, sponsorSpotlightDurationMs, sponsorSpotlightMode]);

  useEffect(() => {
    if (sponsorSpotlightMode !== 'OFF' && sponsorSpotlights.length) return;
    clearSponsorVisualTimers();
    sponsorSpotlightVisibleUntilRef.current = 0;
    setSponsorSpotlightPhase('hidden');
  }, [clearSponsorVisualTimers, sponsorSpotlightMode, sponsorSpotlights.length]);

  useEffect(() => {
    if (isActive) return;
    clearSponsorVisualTimers();
    sponsorSpotlightVisibleUntilRef.current = 0;
    setSponsorSpotlightPhase('hidden');
    setSponsorSpotlightContentPhase('enter');
  }, [clearSponsorVisualTimers, isActive]);

  useEffect(() => {
    const next = matchData.heroBanTriggerAt || 0;
    if (next && next !== banPhaseTrigger) setBanPhaseTrigger(next);
  }, [matchData.heroBanTriggerAt, banPhaseTrigger]);

  useEffect(() => {
    clearKeyPlayerTimers();
    setShowKeyPlayer(false);
    setKeyPlayerPhase('hidden');

    if (!isActive) {
      keyPlayerArmedRef.current = false;
      return;
    }

    lastConsumedKeyTriggerRef.current = matchData.keyPlayerTriggerAt || 0;
    keyPlayerArmedRef.current = true;
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !keyPlayerArmedRef.current) return;

    const next = matchData.keyPlayerTriggerAt || 0;
    if (!next || next === lastConsumedKeyTriggerRef.current) return;

    lastConsumedKeyTriggerRef.current = next;

    const profile = getKeyPlayerProfileFromRoster(matchData, matchData.keyPlayerSide || 'A', matchData.keyPlayerName || 'PLAYER');

    setKeyPlayerData({
      side: matchData.keyPlayerSide || 'A',
      name: profile?.nickname || matchData.keyPlayerName || 'PLAYER',
      battleTag: profile?.battleTag || ''
    });

    clearKeyPlayerTimers();
    setShowKeyPlayer(true);
    setKeyPlayerPhase('pre-enter');

    keyPlayerEnterTimerRef.current = setTimeout(() => {
      setKeyPlayerPhase('enter');
      keyPlayerEnterTimerRef.current = null;
    }, 34);

    keyPlayerTimerRef.current = setTimeout(() => {
      setKeyPlayerPhase('exit');
      keyPlayerExitTimerRef.current = setTimeout(() => {
        setShowKeyPlayer(false);
        setKeyPlayerPhase('hidden');
        keyPlayerExitTimerRef.current = null;
      }, 520);
      keyPlayerTimerRef.current = null;
    }, 2300);
  }, [isActive, matchData.keyPlayerTriggerAt, matchData.keyPlayerSide, matchData.keyPlayerName, matchData.rosterPlayersA, matchData.rosterPlayersB]);

  useEffect(() => clearKeyPlayerTimers, []);
  useEffect(() => () => {
    clearSponsorVisualTimers();
    clearSponsorAutoTimers();
    clearTickerSchedule();
  }, [clearSponsorAutoTimers, clearSponsorVisualTimers, clearTickerSchedule]);

  const { safeLogoA, safeLogoB } = useMemo(() => ({
    safeLogoA: getValidLogo(matchData.logoA),
    safeLogoB: getValidLogo(matchData.logoB)
  }), [matchData.logoA, matchData.logoB]);

  const totalMaps = useMemo(
    () => Number(matchData.totalMaps) || getTotalMapsFromFormat(matchData.matchFormat),
    [matchData.matchFormat, matchData.totalMaps]
  );

  const pointsToWin = useMemo(() => Number(matchData.pointsToWin) || Math.floor(totalMaps / 2) + 1, [matchData.pointsToWin, totalMaps]);
  const teamNameFontSize = clampFontSize(matchData.teamNameFontSize, 20, 14, 28);
  const playerNameFontSize = clampFontSize(matchData.playerNameFontSize, 12, 9, 16);

  const renderScoreDots = (score, align) => (
    <div style={{ display: 'flex', gap: '3px', margin: align === 'left' ? '0 10px 0 0' : '0 0 0 10px', flexDirection: align === 'left' ? 'row' : 'row-reverse' }}>
      {Array.from({ length: pointsToWin }).map((_, i) => (
        <div key={i} style={{ width: '6px', height: '10px', backgroundColor: i < score ? COLORS.yellow : 'transparent', border: `1px solid ${COLORS.yellow}`, transform: 'skewX(-10deg)' }} />
      ))}
    </div>
  );

  const renderMapSequence = () => {
    const currentMapIndex = Math.max(0, (matchData.currentMap || 1) - 1);
    const teamShortA = String(matchData.teamShortA || getFallbackTeamShort(matchData.teamA)).toUpperCase();
    const teamShortB = String(matchData.teamShortB || getFallbackTeamShort(matchData.teamB)).toUpperCase();
    const isBo7Compact = totalMaps >= 7;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          paddingLeft: '8px',
          gap: isBo7Compact ? '4px' : 0
        }}
      >
        {Array.from({ length: totalMaps }).map((_, i) => {
          const mapInfo = matchData.mapLineup?.[i];
          const isCurrent = i === currentMapIndex;
          const isFuture = i > currentMapIndex;
          const iconSrc = getModeIconPath(mapInfo?.type);
          const winnerSide = String(mapInfo?.winnerSide || mapInfo?.winner || '').trim().toUpperCase();
          const winnerTag = winnerSide === 'A' ? teamShortA : winnerSide === 'B' ? teamShortB : winnerSide === 'DRAW' ? 'DRAW' : '';
          const showWinner = !isFuture && !!winnerTag;

          // BO3 / BO5：未来图继续显示 TBD
          const showTbd = !isBo7Compact && (isFuture || !iconSrc);

          // BO7：未来图不显示任何模式信息，只留空槽
          const showBo7FuturePlaceholder = isBo7Compact && isFuture;

          return (
            <React.Fragment key={i}>
              <div
                style={{
                  flex: 1,
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 0
                }}
              >
                {showTbd ? (
                  <span
                    style={{
                      color: isCurrent ? COLORS.yellow : isFuture ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)',
                      fontSize: isCurrent ? '10px' : '9px',
                      fontWeight: '900',
                      letterSpacing: '0.6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    TBD
                  </span>
                ) : showBo7FuturePlaceholder ? (
                  <span
                    style={{
                      width: '10px',
                      height: '2px',
                      backgroundColor: 'rgba(255,255,255,0.10)',
                      display: 'block',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isBo7Compact ? '3px' : '4px',
                      minWidth: 0
                    }}
                  >
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt={getModeKey(mapInfo?.type)}
                        style={{
                          width: '12px',
                          height: '12px',
                          objectFit: 'contain',
                          opacity: isCurrent ? 1 : 0.72,
                          filter: isCurrent ? 'brightness(1.2)' : 'grayscale(1) brightness(1.45)',
                          flexShrink: 0
                        }}
                        onError={e => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: '10px',
                          height: '2px',
                          backgroundColor: 'rgba(255,255,255,0.10)',
                          display: 'block',
                          flexShrink: 0
                        }}
                      />
                    )}

                    {showWinner && (
                      <>
                        <span
                          style={{
                            width: '1px',
                            height: isBo7Compact ? '7px' : '8px',
                            backgroundColor: 'rgba(255,255,255,0.18)',
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{
                            fontSize: isBo7Compact ? '7px' : '8px',
                            fontWeight: '900',
                            letterSpacing: isBo7Compact ? '0.25px' : '0.35px',
                            lineHeight: 1.12,
                            color: COLORS.yellow,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {winnerTag}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {!isBo7Compact && i < totalMaps - 1 && (
                <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 2px', fontSize: '10px' }}>/</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const currentMapIndex = Math.min(Math.max(0, (matchData.currentMap || 1) - 1), 6);
  const currentMapData = matchData.mapLineup?.[currentMapIndex] || matchData.mapLineup?.[0] || {};
  const DEFAULT_BAN_ENTRY = 'damage/tbd';

  const parseHudBanEntry = entry => {
    const raw = String(entry || DEFAULT_BAN_ENTRY).trim().toLowerCase();

    if (!raw) return { role: 'damage', hero: 'tbd' };
    if (!raw.includes('/')) return { role: 'damage', hero: raw || 'tbd' };

    const [role, hero] = raw.split('/');

    return {
      role: role || 'damage',
      hero: hero || 'tbd'
    };
  };
  
  const currentBanA = matchData.bansA?.[0] || DEFAULT_BAN_ENTRY;
  const currentBanB = matchData.bansB?.[0] || DEFAULT_BAN_ENTRY;

  const { role: roleA, hero: heroA } = parseHudBanEntry(currentBanA);
  const { role: roleB, hero: heroB } = parseHudBanEntry(currentBanB);

  const currentMapModeKey = getModeKey(currentMapData?.type);
  const currentMapNumberLabel = `MAP ${matchData.currentMap || 1}`;
  const currentMapModeLabel = currentMapModeKey || 'TBD';
  const currentMapNameLabel = currentMapData?.name || 'TBD';
  const topEventTitle = String(matchData.topEventTitle || matchData.info || '').trim();
  const topEventLogo = matchData.topEventLogo || matchData.stingerLogo || '/OW.svg';
  const topMatchFormatLabel = String(matchData.topMatchFormatLabel || matchData.matchFormat || 'TOURNAMENT').trim();
  const topSponsorLogo = String(matchData.topSponsorLogo || '').trim();
  const topSponsorName = String(matchData.topSponsorName || 'Sponsor').trim();
  const showTopEventLogo = matchData.showTopEventLogo !== false;
  const showTopMatchFormat = matchData.showTopMatchFormat !== false;
  const showTopSponsor = matchData.showTopSponsor === true && Boolean(topSponsorLogo);
  const activeSponsorSpotlight = sponsorSpotlights[sponsorSpotlightIndex % Math.max(1, sponsorSpotlights.length)] || null;
  const sponsorSpotlightHasTimedProgress = sponsorSpotlightProgressVisible && (
    sponsorSpotlightMode === 'AUTO'
      || sponsorSpotlightMode === 'MANUAL'
      || (sponsorSpotlightMode === 'PERSISTENT' && sponsorSpotlights.length > 1)
  );
  const sponsorSpotlightHasStaticProgress = !sponsorSpotlightProgressVisible
    || (sponsorSpotlightMode === 'PERSISTENT' && sponsorSpotlights.length < 2);

  const showSideStatus = needsAttackDefense(currentMapModeKey);
  const attackSide = currentMapData?.attackSide || '';

  const leftSideTag = showSideStatus && attackSide ? (attackSide === 'A' ? 'ATK' : 'DEF') : '';
  const rightSideTag = showSideStatus && attackSide ? (attackSide === 'B' ? 'ATK' : 'DEF') : '';

  const handleTickerEnd = () => {
    if (tickerMode !== 'INFINITE') {
      setTimeout(() => { setLocalShowTicker(false); }, 0);
    }
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes hudFadeInDownCenter { 0% { opacity: 0; transform: translate(-50%, -15px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes hudSlideInLeft { 0% { opacity: 0; transform: translateX(-40px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes hudSlideInRight { 0% { opacity: 0; transform: translateX(40px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes tickerScroll { 0% { transform: translateX(1920px); } 100% { transform: translateX(-100%); } }
        @keyframes sponsorSpotlightProgress { 0% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
      `}</style>

      {renderState === 'INTRO' && (
        <BeginInfoOverlay
          matchData={matchData}
          duration={3200}
          onFinish={() => setRunState('HUD')}
        />
      )}

      {renderState === 'HUD' && !matchData.showBanPhase && (
        <>
          <KeyPlayerCard show={showKeyPlayer} phase={keyPlayerPhase} data={keyPlayerData} matchData={matchData} />

          {activeSponsorSpotlight && sponsorSpotlightPhase !== 'hidden' && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: localShowTicker ? '38px' : '12px',
                width: '500px',
                maxWidth: 'calc(100% - 80px)',
                height: '52px',
                display: 'grid',
                gridTemplateColumns: '112px minmax(0, 1fr)',
                alignItems: 'stretch',
                borderTop: sponsorSpotlightHasStaticProgress
                  ? `2px solid ${COLORS.yellow}`
                  : '1px solid rgba(255,255,255,0.18)',
                borderRight: `4px solid ${COLORS.yellow}`,
                background: 'linear-gradient(90deg, rgba(28,28,28,0.96), rgba(18,18,18,0.94))',
                boxShadow: '0 10px 24px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.06)',
                opacity: sponsorSpotlightPhase === 'enter' ? 1 : 0,
                transform: sponsorSpotlightPhase === 'enter'
                  ? 'translate(-50%, 0)'
                  : 'translate(-50%, calc(100% + 12px))',
                transition: 'bottom 440ms cubic-bezier(0.16, 1, 0.3, 1), transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 210,
                willChange: 'transform, opacity'
              }}
            >
              {sponsorSpotlightHasTimedProgress && sponsorSpotlightPhase === 'enter' && (
                <div
                  key={`${sponsorSpotlightRunKey}-${sponsorSpotlightPhase}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '2px',
                    background: COLORS.yellow,
                    transformOrigin: 'left center',
                    transform: 'scaleX(1)',
                    animation: `sponsorSpotlightProgress ${sponsorSpotlightDurationMs}ms linear ${sponsorSpotlightProgressDelayMs}ms forwards`,
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              )}
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center start',
                  borderRight: '1px solid rgba(255,255,255,0.10)',
                  padding: '0 14px',
                  color: 'rgba(255,255,255,0.52)',
                  fontSize: '9px',
                  fontWeight: 900,
                  letterSpacing: '1.45px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}
              >
                Supported By
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '58px minmax(0, 1fr)',
                  alignItems: 'center',
                  minWidth: 0,
                  opacity: sponsorSpotlightContentPhase === 'enter' ? 1 : 0,
                  transform: sponsorSpotlightContentPhase === 'exit' ? 'translateY(-3px)' : (sponsorSpotlightContentPhase === 'pre-enter' ? 'translateY(3px)' : 'translateY(0)'),
                  transition: 'opacity 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'opacity, transform'
                }}
              >
                <div
                  style={{
                    alignSelf: 'stretch',
                    display: 'grid',
                    placeItems: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.10)'
                  }}
                >
                  {activeSponsorSpotlight.logo && (
                    <img
                      src={activeSponsorSpotlight.logo}
                      alt=""
                      onError={event => { event.currentTarget.style.display = 'none'; }}
                      style={{ width: '38px', height: '38px', objectFit: 'contain', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.30))' }}
                    />
                  )}
                </div>
                <strong
                  style={{
                    minWidth: 0,
                    gridColumn: 2,
                    overflow: 'hidden',
                    padding: '0 16px',
                    color: COLORS.white,
                    fontSize: '20px',
                    fontWeight: 900,
                    letterSpacing: '1.1px',
                    lineHeight: 1.12,
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {activeSponsorSpotlight.name || 'Sponsor'}
                </strong>
              </div>
            </div>
          )}

          {/* 🌟 中央赛事胶囊组件：悬浮并与两侧 SubBar 严格顶部对齐 🌟 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: dynamicLayout.centerCapsuleTop, // 完美贴合两侧细条的高度
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              zIndex: 100,
              opacity: 0,
              animation: 'hudFadeInDownCenter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              height: '32px'
            }}
          >
            {/* 1. 赛事 Logo 块 */}
            {showTopEventLogo && (
            <div
              style={{
                width: '32px',
                backgroundColor: matchData.eventLogoBg || COLORS.mainDark,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '2px 0 6px rgba(0,0,0,0.1)',
                flexShrink: 0
              }}
            >
              <img
                src={topEventLogo}
                alt="Tournament"
                style={{ width: '90%', height: '90%', objectFit: 'contain' }}
                onError={event => {
                  event.currentTarget.src = '/OW.svg';
                }}
              />
            </div>
            )}

            {/* 2. 赛事信息块 */}
            <div
              style={{
                backgroundColor: COLORS.mainDark,
                color: COLORS.white,
                padding: '0 16px',
                minWidth: '96px',
                maxWidth: '480px',
                flex: '0 1 auto',
                fontSize: '14px',
                fontWeight: '900',
                letterSpacing: '2.2px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                borderTop: `1px solid ${COLORS.lineStrong}`,
                borderBottom: `1px solid ${COLORS.lineStrong}`,
                borderLeft: `1px solid ${COLORS.lineStrong}`,
                borderRight: showTopMatchFormat || showTopSponsor ? 'none' : `1px solid ${COLORS.lineStrong}`
              }}
              title={topEventTitle}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', lineHeight: 1.12, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {topEventTitle || 'LIVE'}
              </span>
            </div>

            {/* 3. 赛制标签块 */}
            {showTopMatchFormat && (
            <div
              style={{
                backgroundColor: COLORS.yellow,
                color: COLORS.mainDark,
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: '900',
                lineHeight: 1.12,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                borderLeft: `1px solid ${COLORS.mainDark}`,
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              {topMatchFormatLabel || 'LIVE'}
            </div>
            )}

            {/* 4. 主赞助商：置于赛制右侧，以终端署名方式呈现 */}
            {showTopSponsor && (
            <div
              style={{
                height: '32px',
                backgroundColor: COLORS.mainDark,
                display: 'flex',
                alignItems: 'center',
                borderTop: `1px solid ${COLORS.lineStrong}`,
                borderRight: `1px solid ${COLORS.lineStrong}`,
                borderBottom: `1px solid ${COLORS.lineStrong}`,
                borderLeft: '1px solid rgba(255,255,255,0.34)',
                flexShrink: 0,
                overflow: 'hidden'
              }}
              title={topSponsorName}
            >
              <div
                style={{
                  minWidth: '36px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  padding: 0
                }}
              >
                <img
                  src={topSponsorLogo}
                  alt={topSponsorName}
                  style={{
                    width: 'auto',
                    maxWidth: '72px',
                    height: '90%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={event => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
            )}
          </div>
          
          <div style={teamBarLayout}>
            {/* 左侧 Wrapper */}
            <div style={{ ...teamWrapperLeftStyle, gap: dynamicLayout.wrapperGap }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                
                {/* 地图比分细条 (SubBar)：根据 Offset 一分为二悬浮居中 */}
                <div style={{
                  ...subBarStyle,
                  marginTop: dynamicLayout.subBarMarginTop,
                  marginBottom: dynamicLayout.subBarMarginBottom
                }}>
                  <div style={yellowAccentLeft}></div>
                  <div style={subBarContentStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      {renderScoreDots(matchData.scoreA, 'left')}
                      {renderMapSequence()}
                    </div>
                  </div>
                </div>

                <div style={teamGroupStyle}>
                  <div style={{ ...logoBlockStyle, backgroundColor: matchData.logoBgA }}>
                    <img src={safeLogoA} style={logoImgStyle} alt="logoA" />
                  </div>
                  {matchData.showBans && (
                    <div style={banAreaStyle}><BanBox heroName={`${roleA}/${heroA}`} align="right" /></div>
                  )}
                  <div style={{ ...teamNameBlockStyle, fontSize: `${teamNameFontSize}px` }}>
                    <div style={teamNameTextStyle}>{matchData.teamA}</div>
                  </div>
                  <TeamMetaBadge label={matchData.teamMetaA} mode={matchData.teamMetaMode} isLeft />
                  {leftSideTag && <SideTag tag={leftSideTag} isLeft />}
                  <div style={scoreBoxStyle}>{matchData.scoreA}</div>
                </div>
              </div>

              {matchData.showPlayers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={playerListRowStyle}>
                    {matchData.playersA?.map((p, i) => (
                      <div key={`${p || 'empty'}-${i}`} style={{ ...playerSlotStyle, color: matchData.subIndexA === i ? COLORS.yellow : COLORS.white, fontSize: `${playerNameFontSize}px` }}>
                        {matchData.subIndexA === i && <span style={subBadgeStyle}>IN</span>}
                        {p}
                      </div>
                    ))}
                  </div>
                  {matchData.activeComms === 'A' && (
                    <div style={commsUnderStyle}>
                      <span>LISTENING TO <span style={{ color: COLORS.yellow }}>{matchData.teamA}</span> VOICE CHAT</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右侧 Wrapper */}
            <div style={{ ...teamWrapperRightStyle, gap: dynamicLayout.wrapperGap }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                
                {/* 地图比分细条 (SubBar)：根据 Offset 一分为二悬浮居中 */}
                <div style={{
                  ...subBarStyle,
                  marginTop: dynamicLayout.subBarMarginTop,
                  marginBottom: dynamicLayout.subBarMarginBottom
                }}>
                  <div style={{ ...subBarContentStyle, gap: '10px', width: '100%' }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        alignItems: 'center'
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          textAlign: 'center',
                          fontSize: '10px',
                          fontWeight: '900',
                          lineHeight: 1.12,
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase',
                          color: COLORS.white
                        }}
                      >
                        {currentMapNumberLabel}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          textAlign: 'center',
                          fontSize: '10px',
                          fontWeight: '900',
                          lineHeight: 1.12,
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase',
                          color: COLORS.yellow,
                          borderLeft: `1px solid ${COLORS.line}`,
                          borderRight: `1px solid ${COLORS.line}`,
                          padding: '0 8px'
                        }}
                      >
                        {currentMapModeLabel}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          textAlign: 'center',
                          fontSize: '10px',
                          fontWeight: '900',
                          lineHeight: 1.12,
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase',
                          color: COLORS.gray,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          padding: '0 8px'
                        }}
                        title={currentMapNameLabel}
                      >
                        {currentMapNameLabel}
                      </div>
                    </div>

                    {renderScoreDots(matchData.scoreB, 'right')}
                  </div>
                  <div style={yellowAccentRight}></div>
                </div>

                <div style={{ ...teamGroupStyle, justifyContent: 'flex-end' }}>
                  <div style={scoreBoxStyle}>{matchData.scoreB}</div>
                  {rightSideTag && <SideTag tag={rightSideTag} isLeft={false} />}
                  <TeamMetaBadge label={matchData.teamMetaB} mode={matchData.teamMetaMode} isLeft={false} />
                  <div style={{ ...teamNameBlockStyle, fontSize: `${teamNameFontSize}px` }}>
                    <div style={teamNameTextStyle}>{matchData.teamB}</div>
                  </div>
                  {matchData.showBans && (
                    <div style={banAreaStyle}><BanBox heroName={`${roleB}/${heroB}`} align="left" /></div>
                  )}
                  <div style={{ ...logoBlockStyle, backgroundColor: matchData.logoBgB }}>
                    <img src={safeLogoB} style={logoImgStyle} alt="logoB" />
                  </div>
                </div>
              </div>

              {matchData.showPlayers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ ...playerListRowStyle, justifyContent: 'flex-end' }}>
                    {matchData.playersB?.map((p, i) => (
                      <div key={`${p || 'empty'}-${i}`} style={{ ...playerSlotStyle, color: matchData.subIndexB === i ? COLORS.yellow : COLORS.white, fontSize: `${playerNameFontSize}px` }}>
                        {matchData.subIndexB === i && <span style={subBadgeStyle}>IN</span>}
                        {p}
                      </div>
                    ))}
                  </div>
                  {matchData.activeComms === 'B' && (
                    <div style={commsUnderStyle}>
                      <span>LISTENING TO <span style={{ color: COLORS.yellow }}>{matchData.teamB}</span> VOICE CHAT</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '36px',
              backgroundColor: COLORS.yellow,
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              zIndex: 200,
              transform: localShowTicker ? 'translateY(0)' : 'translateY(100%)',
              opacity: localShowTicker ? 1 : 0,
              transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden'
            }}
          >
            <div
              key={tickerKey}
              onAnimationEnd={handleTickerEnd}
              style={{
                whiteSpace: 'nowrap',
                color: COLORS.black,
                fontSize: '16px',
                fontWeight: '900',
                letterSpacing: '1.8px',
                animation: `tickerScroll ${tickerDurationSeconds}s linear ${tickerMode === 'INFINITE' ? 'infinite' : '1 forwards'}`,
                textTransform: 'uppercase',
                willChange: 'transform',
                backfaceVisibility: 'hidden'
              }}
            >
              {matchData.tickerText || 'SPONSORS // THANK YOU FOR YOUR SUPPORT // JOIN THE OFFICIAL COMMUNITY FOR THE LATEST NEWS // SPONSORS // THANKS FOR WATCHING'}
            </div>
          </div>
        </>
      )}

      {matchData.showBanPhase && (
        <BanPhaseScene matchData={matchData} triggerAt={banPhaseTrigger} />
      )}
    </div>
  );
}
