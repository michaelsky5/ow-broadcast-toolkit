import React, { useMemo } from 'react';

const COLORS = {
  black: '#050505',
  yellow: 'var(--theme-primary)',
  white: '#ffffff',
  darkGray: '#1a1a1a',
  dimGray: '#555555',
  panel: '#101010',
  panel2: '#161616',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.18)',
  softWhite: 'rgba(255,255,255,0.72)',
  primarySoft: 'var(--theme-primary-soft)',
  shadow: 'rgba(0,0,0,0.35)'
};

const UI = {
  outerFrame: `1px solid ${COLORS.lineStrong}`,
  innerFrame: `1px solid ${COLORS.line}`,
  hardShadow: '0 18px 40px rgba(0,0,0,0.28)',
  panelShadow: '0 10px 24px rgba(0,0,0,0.22)',
  primaryGlow: '0 0 0 1px var(--theme-primary-soft), 0 0 18px var(--theme-primary-softer)',
  insetLine: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
  bevelInset: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.35)'
};

const FALLBACK_EVENT_MAP_POOL = {
  CONTROL: ['ILIOS', 'LIJIANG TOWER', 'BUSAN'],
  ESCORT: ['DORADO', 'ROUTE 66', 'HAVANA'],
  HYBRID: ["KING'S ROW", 'EICHENWALDE', 'BLIZZARD WORLD'],
  PUSH: ['COLOSSEO', 'NEW QUEEN STREET'],
  FLASHPOINT: ['SURAVASA', 'NEW JUNK CITY'],
  CLASH: ['HANAOKA', 'THRONE OF ANUBIS']
};

const dedupe = list => Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));

const getMapImagePath = (typeRaw, nameRaw) => {
  if (!typeRaw || !nameRaw) return '';
  if (String(nameRaw).startsWith('/')) return nameRaw;
  const folder = typeRaw.split(' ')[0].toLowerCase();

  let safeName = nameRaw.replace(/'/g, '').replace(/:/g, '');
  if (safeName === 'ESPERAN脟A') safeName = 'ESPERANCA';

  const formattedName = safeName
    .split(' ')
    .map(word => word.toLowerCase())
    .join('-');

  return `/maps/${folder}/${formattedName}.jpg`;
};

const getOverviewMapName = map => (
  typeof map === 'string'
    ? map
    : String(map?.name || map?.en || '').trim()
);

const getOverviewMapImage = map => (
  typeof map === 'string'
    ? ''
    : String(map?.image || '').trim()
);

const getFallbackTeamShort = name =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(v => v[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || 'TBD';

const getTeamTag = (side, teamShortA, teamShortB, teamA, teamB) => {
  const normalized = String(side || '').trim().toUpperCase();
  if (normalized === 'A') return String(teamShortA || getFallbackTeamShort(teamA)).toUpperCase();
  if (normalized === 'B') return String(teamShortB || getFallbackTeamShort(teamB)).toUpperCase();
  if (normalized === 'DRAW' || normalized === 'TIE') return 'DRAW';
  return '';
};

const parseBanEntry = entry => {
  if (!entry) return { role: '', hero: '' };
  const raw = Array.isArray(entry) ? entry[0] : entry;
  const str = String(raw || '').trim().toLowerCase();
  if (!str) return { role: '', hero: '' };
  if (!str.includes('/')) return { role: '', hero: str === 'tbd' ? '' : str };
  const [role, hero] = str.split('/');
  return { role: role || '', hero: hero && hero !== 'tbd' ? hero : '' };
};

const getMapBanSource = (map, matchData, side) => {
  const arrayKey = side === 'A' ? 'bansA' : 'bansB';
  const singleKey = side === 'A' ? 'banA' : 'banB';

  if (Array.isArray(map?.[arrayKey]) && map[arrayKey].length) return { entry: map[arrayKey][0], source: 'map' };
  if (map?.[singleKey]) return { entry: map[singleKey], source: 'map' };
  if (Array.isArray(matchData?.[arrayKey]) && matchData[arrayKey].length) return { entry: matchData[arrayKey][0], source: 'global' };
  return { entry: '', source: 'none' };
};

const boolish = value => {
  if (value === true || value === 1) return true;
  const s = String(value || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

const shouldSwapVisualTeams = (map, matchData) => {
  const explicitSwap = [
    map?.swapSides,
    map?.isSwapSides,
    map?.swapTeams,
    map?.flipSides,
    map?.reverseSides,
    matchData?.swapSides,
    matchData?.isSwapSides,
    matchData?.swapTeams,
    matchData?.flipSides,
    matchData?.reverseSides
  ].some(boolish);

  if (explicitSwap) return true;

  const attackSide = String(map?.attackSide || matchData?.attackSide || '').trim().toUpperCase();
  return attackSide === 'B';
};

const getHeroAssetCandidates = (role, hero) => {
  const cleanRole = String(role || '').trim().toLowerCase();
  const cleanHero = String(hero || '').trim().toLowerCase();
  if (!cleanHero) return ['/OW.svg'];

  return dedupe([
    cleanRole && `/heroes/${cleanRole}/${cleanHero}.png`,
    cleanRole && `/roster/${cleanRole}/${cleanHero}.png`,
    `/heroes/${cleanHero}.png`,
    '/OW.svg'
  ]);
};

const BanPortrait = React.memo(({ role, hero }) => {
  const sources = getHeroAssetCandidates(role, hero);

  return (
    <img
      src={sources[0] || '/OW.svg'}
      alt={hero}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      onError={event => {
        event.currentTarget.src = '/OW.svg';
      }}
    />
  );
});

const BanChip = React.memo(({ orderLabel, hero, role, tag, align = 'left' }) => {
  if (!hero) return null;
  const isLeft = align === 'left';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        [isLeft ? 'left' : 'right']: '16px',
        width: '68px',
        display: 'grid',
        gap: '5px',
        zIndex: 6
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '68px',
          height: '68px',
          border: `1px solid ${COLORS.lineStrong}`,
          background: 'rgba(8,8,8,0.92)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.26)',
          overflow: 'hidden'
        }}
      >
        <BanPortrait role={role} hero={hero} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.42) 100%)' }} />

        <div
          style={{
            position: 'absolute',
            top: '0',
            [isLeft ? 'left' : 'right']: '0',
            minWidth: '32px',
            height: '18px',
            padding: '0 5px',
            background: COLORS.yellow,
            color: COLORS.black,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: '900',
            letterSpacing: '0.8px',
            lineHeight: 1,
            textTransform: 'uppercase'
          }}
        >
          {orderLabel}
        </div>
      </div>

      <div
        style={{
          height: '20px',
          border: `1px solid ${COLORS.line}`,
          background: 'rgba(8,8,8,0.94)',
          color: COLORS.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: '900',
          letterSpacing: '1.1px',
          textTransform: 'uppercase',
          boxShadow: UI.insetLine
        }}
      >
        {tag}
      </div>
    </div>
  );
});

const MapCard = React.memo(({
  map,
  index,
  status,
  delay,
  teamA,
  teamB,
  teamShortA,
  teamShortB,
  metaDisplayMode,
  banDisplayMode,
  matchData
}) => {
  const imgPath = map.image || getMapImagePath(map.type, map.name);
  const mapTypeShort = String(map.type || 'CONTROL').split(' ')[0];

  const isPlayed = status === 'PLAYED';
  const isNext = status === 'NEXT';
  const isTBD = status === 'TBD';

  const winnerTag = getTeamTag(map.winnerSide || map.winner, teamShortA, teamShortB, teamA, teamB);
  const pickerTag = getTeamTag(map.picker, teamShortA, teamShortB, teamA, teamB);

  const showWinner = metaDisplayMode !== 'CLEAN' && isPlayed && !!winnerTag;
  const showPicker = metaDisplayMode === 'FULL' && isNext && !!pickerTag;

  const topLabel = showWinner
    ? (winnerTag === 'DRAW' ? 'DRAW' : `${winnerTag} WIN`)
    : showPicker
      ? `${pickerTag} PICK`
      : isNext
        ? 'UP NEXT'
        : isPlayed
          ? 'COMPLETED'
          : 'TBD';
  const topFontSize = showWinner || showPicker ? '18px' : '19px';
  const topLetterSpacing = showWinner || showPicker ? '2.4px' : '3.2px';

  const frameColor = isNext ? COLORS.yellow : isPlayed ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.10)';
  const topBg = isNext ? COLORS.yellow : 'rgba(255,255,255,0.03)';
  const topColor = isNext ? COLORS.black : isPlayed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.60)';
  const bottomBg = isNext ? COLORS.yellow : 'linear-gradient(180deg, rgba(18,18,18,0.98) 0%, rgba(12,12,12,0.98) 100%)';
  const titleColor = isNext ? COLORS.black : isPlayed ? 'rgba(255,255,255,0.42)' : COLORS.white;

  const banA = getMapBanSource(map, matchData, 'A');
  const banB = getMapBanSource(map, matchData, 'B');
  const parsedBanA = parseBanEntry(banA.entry);
  const parsedBanB = parseBanEntry(banB.entry);

  const mapHasOwnBans =
    (Array.isArray(map?.bansA) && map.bansA.length) ||
    (Array.isArray(map?.bansB) && map.bansB.length) ||
    !!map?.banA ||
    !!map?.banB;

  const showCurrentLiveBanFallback = isNext && !mapHasOwnBans && !!matchData.showBans;
  const showBanPanel =
    banDisplayMode !== 'HIDE' &&
    !isTBD &&
    !!map.name &&
    (
      (isPlayed && mapHasOwnBans) ||
      (isNext && (mapHasOwnBans || showCurrentLiveBanFallback))
    ) &&
    (parsedBanA.hero || parsedBanB.hero);

  const resolvedBanOrderMode = String(map?.banOrderMode || matchData.banOrderMode || 'A_FIRST').trim().toUpperCase();
  const orderA = resolvedBanOrderMode === 'B_FIRST' ? '2ND' : '1ST';
  const orderB = resolvedBanOrderMode === 'B_FIRST' ? '1ST' : '2ND';

  const swapped = shouldSwapVisualTeams(map, matchData);
  const leftTeamKey = swapped ? 'B' : 'A';
  const rightTeamKey = swapped ? 'A' : 'B';

  const leftBan = leftTeamKey === 'A' ? parsedBanA : parsedBanB;
  const rightBan = rightTeamKey === 'A' ? parsedBanA : parsedBanB;

  const leftTag = leftTeamKey === 'A'
    ? String(teamShortA || getFallbackTeamShort(teamA)).toUpperCase()
    : String(teamShortB || getFallbackTeamShort(teamB)).toUpperCase();

  const rightTag = rightTeamKey === 'A'
    ? String(teamShortA || getFallbackTeamShort(teamA)).toUpperCase()
    : String(teamShortB || getFallbackTeamShort(teamB)).toUpperCase();

  const leftOrder = leftTeamKey === 'A' ? orderA : orderB;
  const rightOrder = rightTeamKey === 'A' ? orderA : orderB;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        maxWidth: '280px',
        height: '650px',
        display: 'flex',
        flexDirection: 'column',
        opacity: 0,
        transform: 'translateY(100px)',
        position: 'relative',
        willChange: 'transform, opacity',
        animation: `slideUpBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${delay}s forwards`
      }}
    >
      <div
        style={{
          height: '42px',
          background: topBg,
          color: topColor,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: '900',
          letterSpacing: topLetterSpacing,
          fontSize: topFontSize,
          borderTop: `2px solid ${frameColor}`,
          borderLeft: `2px solid ${frameColor}`,
          borderRight: `2px solid ${frameColor}`,
          boxSizing: 'border-box',
          textTransform: 'uppercase',
          boxShadow: isNext ? UI.primaryGlow : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '0 12px'
        }}
      >
        {topLabel}
      </div>

      <div
        style={{
          width: '100%',
          flex: 1,
          backgroundColor: '#000',
          borderLeft: `2px solid ${frameColor}`,
          borderRight: `2px solid ${frameColor}`,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 22px)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />

        {isTBD || !map.name ? (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #171717 0%, #101010 100%)' }} />
        ) : (
          <img
            src={imgPath}
            onError={e => { e.target.style.display = 'none'; }}
            alt={map.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              filter: isPlayed ? 'grayscale(100%) brightness(30%) contrast(105%)' : isNext ? 'contrast(112%) brightness(1.05)' : 'brightness(0.88) contrast(1.06)',
              transition: 'filter 0.5s'
            }}
          />
        )}

        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 90px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.04)' }} />

        <div
          style={{
            position: 'absolute',
            top: '18px',
            left: '18px',
            color: isTBD || !map.name ? 'rgba(255,255,255,0.03)' : isNext ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.11)',
            fontSize: '96px',
            fontWeight: '900',
            lineHeight: '0.8',
            letterSpacing: '-2px',
            zIndex: 3
          }}
        >
          {index + 1}
        </div>

        <div
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            width: '20px',
            height: '20px',
            borderTop: `2px solid ${isNext ? COLORS.yellow : 'rgba(255,255,255,0.10)'}`,
            borderRight: `2px solid ${isNext ? COLORS.yellow : 'rgba(255,255,255,0.10)'}`,
            zIndex: 3,
            opacity: isTBD || !map.name ? 0.35 : 1
          }}
        />

        {showBanPanel && (
          <>
            <BanChip
              orderLabel={leftOrder}
              hero={leftBan.hero}
              role={leftBan.role}
              tag={leftTag}
              align="left"
            />
            <BanChip
              orderLabel={rightOrder}
              hero={rightBan.hero}
              role={rightBan.role}
              tag={rightTag}
              align="right"
            />
          </>
        )}
      </div>

      <div
        style={{
          height: '132px',
          background: bottomBg,
          borderBottom: `2px solid ${frameColor}`,
          borderLeft: `2px solid ${frameColor}`,
          borderRight: `2px solid ${frameColor}`,
          padding: '18px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isNext ? UI.primaryGlow : UI.insetLine
        }}
      >
        {!isNext && <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 22px)', pointerEvents: 'none', opacity: 0.5 }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: isNext ? COLORS.black : isTBD || !map.name ? '#444' : COLORS.yellow, flexShrink: 0 }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: '900',
              color: isNext ? 'rgba(42,42,42,0.70)' : isTBD || !map.name ? '#777' : 'rgba(255,255,255,0.58)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}
          >
            {isTBD || !map.name ? 'TBD' : `${mapTypeShort} // MAP ${index + 1}`}
          </span>
        </div>

        <div
          style={{
            fontSize: '24px',
            fontWeight: '900',
            color: isTBD || !map.name ? '#666' : titleColor,
            textTransform: 'uppercase',
            lineHeight: '1.08',
            letterSpacing: '0.6px',
            position: 'relative',
            zIndex: 1,
            wordBreak: 'break-word'
          }}
        >
          {isTBD || !map.name ? 'TBD' : map.name}
        </div>
      </div>
    </div>
  );
});

const OverviewMapCard = React.memo(({ type, name, image, delay, isPlayed, isCurrent }) => {
  const imgPath = image || getMapImagePath(type, name);
  const borderColor = isCurrent ? COLORS.white : isPlayed ? 'rgba(255,255,255,0.12)' : COLORS.yellow;
  const bgBarColor = isCurrent ? COLORS.yellow : 'rgba(10,10,10,0.90)';
  const textColor = isCurrent ? COLORS.black : isPlayed ? 'rgba(255,255,255,0.42)' : COLORS.white;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        border: `2px solid ${borderColor}`,
        backgroundColor: '#111',
        position: 'relative',
        overflow: 'hidden',
        opacity: 0,
        transform: 'translateY(30px)',
        willChange: 'transform, opacity',
        animation: `slideUpBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${delay}s forwards`,
        boxShadow: isCurrent ? '0 0 0 1px rgba(255,255,255,0.08), 0 0 22px rgba(255,255,255,0.10)' : isPlayed ? 'none' : `${UI.panelShadow}, ${UI.primaryGlow}`
      }}
    >
      {isCurrent && <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.white, color: COLORS.black, padding: '4px 12px', fontSize: '11px', fontWeight: '900', zIndex: 10, letterSpacing: '1.2px', textTransform: 'uppercase' }}>UP NEXT</div>}
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 22px)', pointerEvents: 'none', zIndex: 2 }} />
      <img src={imgPath} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: isPlayed ? 'grayscale(100%) brightness(26%)' : isCurrent ? 'contrast(112%) brightness(1.08)' : 'brightness(0.90) contrast(1.05)', transition: 'filter 0.5s, box-shadow 0.3s' }} onError={e => (e.target.style.display = 'none')} alt={name} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', borderTop: `2px solid ${isCurrent ? COLORS.white : 'rgba(255,255,255,0.10)'}`, borderLeft: `2px solid ${isCurrent ? COLORS.white : 'rgba(255,255,255,0.10)'}`, zIndex: 3 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', backgroundColor: bgBarColor, borderTop: `2px solid ${borderColor}`, padding: '10px 14px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: textColor, fontWeight: '900', fontSize: '14px', letterSpacing: '1.6px', textTransform: 'uppercase', textDecoration: isPlayed ? 'line-through' : 'none' }}>{name}</span>
        {isPlayed && <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontWeight: '900', letterSpacing: '1.2px', textTransform: 'uppercase' }}>PLAYED</span>}
        {isCurrent && <span style={{ color: COLORS.black, fontSize: '11px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>CURRENT</span>}
      </div>
    </div>
  );
});

export default function MapPoolScene({ matchData = {} }) {
  const eventName = String(matchData.eventName || 'Event').trim();
  const interfaceName = `${eventName.replace(/\s+/g, '_')}_MAP_INTERFACE`;
  const displayMode = matchData.mapPoolDisplayMode || 'MATCH';
  const metaDisplayMode = String(matchData.mapMetaDisplayMode || 'RESULT').toUpperCase();
  const banDisplayMode = String(matchData.mapBanDisplayMode || 'SHOW').toUpperCase();
  const showOverviewCurrent = matchData.showOverviewCurrent || false;

  const totalMaps = useMemo(() => {
    const explicitTotal = Number(matchData.totalMaps);
    if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;

    const fmt = String(matchData.matchFormat || 'FT3').toUpperCase();
    if (fmt.includes('7') || fmt.includes('FT4')) return 7;
    if (fmt.includes('5') || fmt.includes('FT3')) return 5;
    const match = fmt.match(/\d+/);
    return match ? parseInt(match[0], 10) : 3;
  }, [matchData.matchFormat, matchData.totalMaps]);

  const currentMapIndex = useMemo(() => {
    const raw = parseInt(matchData.currentMap, 10);
    if (Number.isNaN(raw)) return 0;
    return Math.max(0, Math.min(totalMaps - 1, raw - 1));
  }, [matchData.currentMap, totalMaps]);

  const mapLineup = useMemo(() => {
    return Array.from({ length: totalMaps }).map((_, i) => matchData.mapLineup?.[i] || { type: 'CONTROL', name: '', picker: '', winner: '' });
  }, [matchData.mapLineup, totalMaps]);

  const playedMapNames = useMemo(() => mapLineup.slice(0, currentMapIndex).map(m => m.name), [mapLineup, currentMapIndex]);
  const currentMapName = mapLineup[currentMapIndex]?.name;

  const rawEventMapPool = matchData.eventMapPool || FALLBACK_EVENT_MAP_POOL;

  const enabledMapPool = useMemo(() => {
    return Object.fromEntries(Object.entries(rawEventMapPool).filter(([type]) => matchData.enabledMapTypes?.[type] !== false));
  }, [rawEventMapPool, matchData.enabledMapTypes]);

  return (
    <div
      style={{
        width: '1920px',
        height: '1080px',
        backgroundColor: COLORS.black,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"HarmonyOS Sans SC", sans-serif',
        backgroundImage: 'radial-gradient(circle at center, rgba(42,42,42,0.88) 0%, rgba(42,42,42,0.98) 100%)'
      }}
    >
      <style>{`
        @keyframes slideUpBounce {
          0% { opacity: 0; transform: translateY(100px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.014) 1px, transparent 1px)', backgroundSize: '120px 120px, 120px 120px', opacity: 0.24 }} />
      <div style={{ position: 'absolute', left: '70px', top: '70px', width: '520px', height: '520px', border: '1px solid var(--theme-primary-softer)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: '-120px', bottom: '-120px', width: '460px', height: '460px', border: '1px solid rgba(255,255,255,0.03)', transform: 'rotate(45deg)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '44px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', boxSizing: 'border-box', backdropFilter: 'blur(4px)', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', background: COLORS.yellow, boxShadow: '0 0 12px var(--theme-primary-border)' }} />
          <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '2px', color: COLORS.softWhite }}>{interfaceName}</span>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.38)' }}>
          {displayMode === 'MATCH' ? 'MATCH_SEQUENCE // STABLE' : 'MAP_POOL // STABLE'}
        </div>
      </div>

      <div style={{ position: 'absolute', top: '60px', left: '80px', display: 'flex', flexDirection: 'column', animation: 'slideUpBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s forwards', opacity: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '30px', height: '30px', backgroundColor: COLORS.yellow, boxShadow: '0 0 16px var(--theme-primary-soft)' }} />
          <span style={{ fontSize: '32px', fontWeight: '900', color: COLORS.white, letterSpacing: '4px', textTransform: 'uppercase' }}>{eventName}</span>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '900', color: COLORS.yellow, marginTop: '8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {displayMode === 'MATCH' ? matchData.info : 'OFFICIAL MAP POOL'}
        </span>
      </div>

      {displayMode === 'MATCH' && (
        <div style={{ position: 'absolute', top: '60px', right: '80px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'slideUpBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s forwards', opacity: 0, zIndex: 10 }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: 'rgba(255,255,255,0.62)', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>MATCH FORMAT</div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: UI.outerFrame, boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', background: COLORS.yellow }} />
            <span style={{ color: COLORS.white, fontSize: '30px', fontWeight: '900', letterSpacing: '2px' }}>{matchData.matchFormat}</span>
          </div>
        </div>
      )}

      {displayMode === 'MATCH' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', padding: '0 80px', boxSizing: 'border-box', marginTop: '34px' }}>
          {mapLineup.map((map, i) => {
            let status = 'TBD';
            if (i < currentMapIndex) status = 'PLAYED';
            if (i === currentMapIndex) status = 'NEXT';

            return (
              <MapCard
                key={i}
                map={map}
                index={i}
                status={status}
                delay={0.3 + i * 0.15}
                teamA={matchData.teamA}
                teamB={matchData.teamB}
                teamShortA={matchData.teamShortA}
                teamShortB={matchData.teamShortB}
                metaDisplayMode={metaDisplayMode}
                banDisplayMode={banDisplayMode}
                matchData={matchData}
              />
            );
          })}
        </div>
      )}

      {displayMode === 'OVERVIEW' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', gap: '28px', padding: '170px 80px 118px 80px', boxSizing: 'border-box' }}>
          {Object.entries(enabledMapPool).map(([typeRaw, maps], colIndex) => {
            const typeShort = typeRaw.split(' ')[0];

            return (
              <div key={typeRaw} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: UI.outerFrame, boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 22px)', pointerEvents: 'none', opacity: 0.4 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '8px', height: '8px', background: COLORS.yellow }} />
                    <span style={{ color: COLORS.yellow, fontSize: '12px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>{typeShort}</span>
                  </div>
                </div>

                {maps.map((mapInfo, rowIdx) => {
                  const mapName = getOverviewMapName(mapInfo);
                  const mapImage = getOverviewMapImage(mapInfo);
                  const isPlayed = playedMapNames.includes(mapName);
                  const isCurrent = showOverviewCurrent && mapName === currentMapName;

                  return (
                    <OverviewMapCard
                      key={mapName || `${typeRaw}-${rowIdx}`}
                      type={typeRaw}
                      name={mapName}
                      image={mapImage}
                      delay={0.3 + colIndex * 0.1 + rowIdx * 0.1}
                      isPlayed={isPlayed}
                      isCurrent={isCurrent}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '80px', left: '80px', width: 'calc(100% - 160px)', height: '2px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', bottom: '60px', left: '80px', color: 'rgba(255,255,255,0.26)', fontSize: '11px', fontWeight: '900', letterSpacing: '1.8px', textTransform: 'uppercase' }}>MATCH_SEQUENCE_SYS // {eventName}.BROADCAST</div>
    </div>
  );
}
