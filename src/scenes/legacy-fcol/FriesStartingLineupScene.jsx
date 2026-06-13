const COLORS = {
  black: '#050505',
  deepBlack: '#151515',
  yellow: 'var(--theme-primary)',
  white: '#ffffff',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.18)',
  softWhite: 'rgba(255,255,255,0.72)',
  faintWhite: 'rgba(255,255,255,0.26)'
};

const UI = {
  outerFrame: `1px solid ${COLORS.lineStrong}`,
  panelShadow: '0 10px 24px rgba(0,0,0,0.22)',
  insetLine: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
  primaryGlow: '0 0 0 1px var(--theme-primary-soft), 0 0 18px var(--theme-primary-softer)'
};

const safeText = v => String(v || '').trim();
const norm = v => safeText(v).toLowerCase();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const normalizeRole = role => {
  const raw = norm(role);
  if (raw === 'tank' || raw === 't') return 'TANK';
  if (raw === 'damage' || raw === 'dps' || raw === 'd') return 'DAMAGE';
  if (raw === 'support' || raw === 'sup' || raw === 's') return 'SUPPORT';
  return safeText(role).toUpperCase() || 'UNKNOWN';
};

const getRoleMark = role => {
  const raw = normalizeRole(role);
  if (raw === 'TANK') return 'T';
  if (raw === 'DAMAGE') return 'D';
  if (raw === 'SUPPORT') return 'S';
  return '*';
};

const getPlayerImage = player =>
  safeText(
    player?.heroImage ||
    player?.playerImage ||
    player?.portrait ||
    player?.avatar ||
    player?.image ||
    player?.photo
  );

const findRosterPlayer = (rosterPool, name) => {
  const target = norm(name);
  if (!target) return null;

  return (rosterPool || []).find(p => {
    const candidates = [
      p?.nickname,
      p?.battleTag,
      p?.name,
      p?.id,
      p?.playerName
    ].map(norm);

    return candidates.includes(target);
  }) || null;
};

const getActiveLineup = (matchData, side) => {
  const isA = side === 'A';
  const teamName = isA ? matchData.teamA : matchData.teamB;
  const teamShort = isA ? matchData.teamShortA : matchData.teamShortB;
  const teamLogo = isA ? matchData.logoA : matchData.logoB;
  const activeNames = (isA ? matchData.playersA : matchData.playersB) || [];
  const rosterPool = (isA ? matchData.rosterPlayersA : matchData.rosterPlayersB) || [];

  const players = activeNames.map(name => {
    if (!safeText(name)) return null;

    const found = findRosterPlayer(rosterPool, name);

    return found
      ? {
          nickname: safeText(found.nickname || found.playerName || found.name || name),
          battleTag: safeText(found.battleTag),
          role: normalizeRole(found.role),
          heroImage: getPlayerImage(found),
          heroScale: Number(found.heroScale) || Number(found.imageScale) || 1.0,
          heroPosition: safeText(found.heroPosition || found.imagePosition) || '50% 24%',
          heroBrightness: Number(found.heroBrightness) || Number(found.imageBrightness) || 0.84
        }
      : {
          nickname: safeText(name),
          battleTag: '',
          role: 'TBD',
          heroImage: '',
          heroScale: 1.0,
          heroPosition: '50% 24%',
          heroBrightness: 0.84
        };
  });

  while (players.length < 5) players.push(null);

  return {
    side,
    teamName: safeText(teamName) || `TEAM ${side}`,
    teamShort: safeText(teamShort) || `TEAM ${side}`,
    teamLogo,
    players: players.slice(0, 5)
  };
};

const displayPrimaryName = p => p ? (safeText(p.nickname) || safeText(p.battleTag) || 'PLAYER') : 'EMPTY';

const displaySecondaryName = p => {
  if (!p) return '';
  const main = safeText(p.nickname);
  const sub = safeText(p.battleTag);
  return sub && sub !== main ? sub : '';
};

const PlayerCard = ({ player, index, entrance = false, large = false }) => {
  const isEmpty = !player;
  const role = isEmpty ? 'TBD' : normalizeRole(player.role);
  const cardDelay = `${260 + index * 170}ms`;
  const calloutDelay = `${1050 + index * 620}ms`;

  return (
    <div
      className={entrance ? 'lineup-card lineup-card-entrance' : 'lineup-card'}
      style={{
        '--card-delay': cardDelay,
        '--callout-delay': calloutDelay,
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.012) 100%)',
        border: `1px solid rgba(255,255,255,0.14)`,
        boxShadow: `${UI.panelShadow}, ${UI.insetLine}`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {entrance && <div className="lineup-callout" />}
      {entrance && <div className="lineup-card-sweep" />}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: large ? '3px' : '2px', background: isEmpty ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, var(--theme-primary) 0%, var(--theme-primary-soft) 100%)', zIndex: 7 }} />
      <div style={{ position: 'absolute', top: large ? '14px' : '10px', left: large ? '14px' : '10px', width: large ? '18px' : '14px', height: large ? '18px' : '14px', borderTop: `2px solid ${isEmpty ? COLORS.faintWhite : COLORS.yellow}`, borderLeft: `2px solid ${isEmpty ? COLORS.faintWhite : COLORS.yellow}`, zIndex: 8 }} />
      <div style={{ position: 'absolute', top: large ? '14px' : '10px', right: large ? '14px' : '10px', fontSize: large ? '12px' : '10px', fontWeight: '900', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', zIndex: 8 }}>{String(index + 1).padStart(2, '0')}</div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, padding: large ? '16px' : '12px', display: 'flex', flexDirection: 'column', zIndex: 2 }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: COLORS.black, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: large ? '14px' : '10px', left: large ? '14px' : '10px', right: large ? '14px' : '10px', bottom: large ? '136px' : '110px', background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {!isEmpty && player.heroImage && (
              <img
                src={player.heroImage}
                alt={displayPrimaryName(player)}
                onError={e => { e.currentTarget.src = '/OW.svg'; }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: player.heroPosition,
                  transform: `scale(${player.heroScale})`,
                  transformOrigin: 'center center',
                  filter: `brightness(${player.heroBrightness}) contrast(1.05) saturate(0.92)`
                }}
              />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 14%, rgba(42,42,42,0.16) 62%, rgba(42,42,42,0.82) 100%)' }} />
            <div style={{ position: 'absolute', left: '12px', bottom: '12px', padding: '5px 8px', border: '1px solid var(--theme-primary-border)', background: 'rgba(21,21,21,0.62)', color: COLORS.yellow, fontSize: large ? '11px' : '9px', fontWeight: '900', letterSpacing: '1.8px' }}>
              {getRoleMark(role)} ROLE_LOCKED
            </div>
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <div style={{ height: '3px', background: isEmpty ? COLORS.faintWhite : `linear-gradient(90deg, ${COLORS.white} 0 10%, ${COLORS.yellow} 10% 100%)` }} />
            <div style={{ position: 'relative', padding: large ? '18px 18px 20px' : '14px 14px 15px', background: 'linear-gradient(180deg, rgba(42,42,42,0.18) 0%, rgba(42,42,42,0.94) 100%)', borderTop: `1px solid ${COLORS.line}` }}>
              <div className={entrance ? 'lineup-name-callout' : ''} style={{ fontSize: large ? '27px' : '20px', fontWeight: '900', color: isEmpty ? COLORS.faintWhite : COLORS.white, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayPrimaryName(player)}
              </div>
              {!isEmpty && !!displaySecondaryName(player) && (
                <div style={{ marginTop: '6px', fontSize: large ? '13px' : '11px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '1.1px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displaySecondaryName(player)}
                </div>
              )}
              <div style={{ marginTop: large ? '13px' : '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: large ? '8px 13px' : '7px 11px', background: isEmpty ? 'transparent' : COLORS.yellow, border: isEmpty ? `1px solid ${COLORS.line}` : 'none', color: isEmpty ? COLORS.faintWhite : COLORS.black, fontSize: large ? '12px' : '11px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {isEmpty ? 'TBD' : role}
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniTeamSection = ({ data, align }) => {
  const isLeft = align === 'left';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '0 40px', marginBottom: '30px', flexDirection: isLeft ? 'row' : 'row-reverse' }}>
        <div style={{ width: '90px', height: '90px', background: 'rgba(255,255,255,0.02)', border: UI.outerFrame, boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '8px', [isLeft ? 'left' : 'right']: '8px', width: '12px', height: '12px', borderTop: `2px solid ${COLORS.yellow}`, [isLeft ? 'borderLeft' : 'borderRight']: `2px solid ${COLORS.yellow}` }} />
          <img src={data.teamLogo} alt={data.teamName} onError={e => { e.currentTarget.src = '/OW.svg'; }} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-start' : 'flex-end', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexDirection: isLeft ? 'row' : 'row-reverse', minWidth: 0 }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: COLORS.yellow, boxShadow: '0 0 16px var(--theme-primary-soft)', flex: '0 0 auto' }} />
            <span style={{ fontSize: '42px', fontWeight: '900', color: COLORS.white, letterSpacing: '4px', lineHeight: 1.12, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '620px' }}>{data.teamName}</span>
          </div>
          <div style={{ width: '400px', height: '4px', background: `linear-gradient(${isLeft ? '90deg' : '270deg'}, ${COLORS.yellow} 0%, var(--theme-primary-soft) 100%)`, marginTop: '8px' }} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', padding: '0 40px' }}>
        {data.players.map((p, idx) => <PlayerCard key={idx} player={p} index={idx} />)}
      </div>
    </div>
  );
};

const BootLine = ({ activeSide, activeTeam }) => (
  <div style={{ position: 'absolute', top: '58px', left: '72px', right: '72px', height: '32px', zIndex: 18, overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
    <div className="lineup-boot-sweep" />
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', fontSize: '11px', fontWeight: '900', letterSpacing: '2.5px', textTransform: 'uppercase', color: COLORS.faintWhite }}>
      <span style={{ color: COLORS.yellow }}>FINAL MATCH INITIALIZING</span>
      <span>{activeSide ? `TEAM_${activeSide} // ${activeTeam.teamShort || activeTeam.teamName} // STARTING FIVE` : 'DUAL_LINEUP_PREVIEW // LIVE_SYNC'}</span>
    </div>
  </div>
);

const EntranceTeamSection = ({ data, triggerKey }) => (
  <div key={triggerKey} style={{ position: 'absolute', inset: '108px 72px 112px', zIndex: 10 }}>
    <div style={{ display: 'grid', gridTemplateRows: '158px 1fr', gap: '34px', height: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', opacity: 0, animation: 'lineupHeaderIn 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', minWidth: 0 }}>
          <div className="lineup-logo-lock" style={{ width: '128px', height: '128px', background: 'rgba(255,255,255,0.02)', border: UI.outerFrame, boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flex: '0 0 auto' }}>
            <div style={{ position: 'absolute', top: '10px', left: '10px', width: '18px', height: '18px', borderTop: `2px solid ${COLORS.yellow}`, borderLeft: `2px solid ${COLORS.yellow}` }} />
            <img src={data.teamLogo} alt={data.teamName} onError={e => { e.currentTarget.src = '/OW.svg'; }} style={{ width: '74%', height: '74%', objectFit: 'contain' }} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '26px', height: '26px', backgroundColor: COLORS.yellow, boxShadow: '0 0 16px var(--theme-primary-soft)', flex: '0 0 auto' }} />
              <div style={{ fontSize: '78px', fontWeight: '900', color: COLORS.white, letterSpacing: '5px', textTransform: 'uppercase', lineHeight: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '1260px' }}>
                {data.teamName}
              </div>
            </div>
            <div className="lineup-title-line" style={{ width: '720px', height: '5px', background: `linear-gradient(90deg, ${COLORS.yellow} 0%, var(--theme-primary-soft) 100%)`, marginTop: '16px' }} />
            <div style={{ marginTop: '15px', fontSize: '14px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '3px', textTransform: 'uppercase' }}>
              TEAM {data.side} // STARTING LINEUP ENTRANCE // ROSTER LOCKED
            </div>
          </div>
        </div>

        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', color: COLORS.yellow }}>
          <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '3px', textTransform: 'uppercase' }}>FINAL MATCH</div>
          <div style={{ marginTop: '10px', fontSize: '52px', fontWeight: '900', letterSpacing: '3px', lineHeight: 1 }}>LINEUP</div>
          <div style={{ marginTop: '10px', color: COLORS.faintWhite, fontSize: '11px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>ONE BY ONE CALL-IN</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '18px', height: '100%' }}>
        {data.players.map((p, idx) => <PlayerCard key={`${triggerKey}-${idx}-${displayPrimaryName(p)}`} player={p} index={idx} entrance large />)}
      </div>
    </div>
  </div>
);

const CalloutTeamSection = ({ data, calloutIndex, triggerKey }) => {
  const safeIndex = clamp(Number(calloutIndex) || 0, 0, 4);
  const player = data.players[safeIndex] || null;
  const role = player ? normalizeRole(player.role) : 'TBD';
  const playerName = displayPrimaryName(player);
  const secondaryName = displaySecondaryName(player);

  return (
    <div key={triggerKey} style={{ position: 'absolute', inset: '108px 72px 112px', zIndex: 10 }}>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 142px', gap: '22px', height: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '390px minmax(0,1fr) 360px', gap: '30px', minHeight: 0 }}>
          <div style={{ position: 'relative', minHeight: 0, border: UI.outerFrame, background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))', boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, padding: '28px', overflow: 'hidden', opacity: 0, animation: 'lineupHeaderIn 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div style={{ position: 'absolute', right: '-120px', bottom: '-120px', width: '380px', height: '380px', background: 'var(--theme-primary-softer)', transform: 'rotate(45deg)' }} />
            <div className="lineup-logo-lock" style={{ width: '150px', height: '150px', border: UI.outerFrame, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', left: '12px', width: '20px', height: '20px', borderTop: `2px solid ${COLORS.yellow}`, borderLeft: `2px solid ${COLORS.yellow}` }} />
              <img src={data.teamLogo} alt={data.teamName} onError={e => { e.currentTarget.src = '/OW.svg'; }} style={{ width: '76%', height: '76%', objectFit: 'contain', position: 'relative', zIndex: 2 }} />
            </div>

            <div style={{ position: 'absolute', left: '28px', right: '28px', bottom: '32px' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '3px', color: COLORS.yellow, textTransform: 'uppercase' }}>TEAM {data.side} CALLOUT</div>
              <div style={{ marginTop: '14px', fontSize: '54px', fontWeight: '900', color: COLORS.white, letterSpacing: '4px', lineHeight: 1.12, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.teamName}</div>
              <div className="lineup-title-line" style={{ marginTop: '18px', width: '100%', height: '4px', background: `linear-gradient(90deg, ${COLORS.yellow}, var(--theme-primary-softer))` }} />
              <div style={{ marginTop: '16px', fontSize: '11px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '2.2px', textTransform: 'uppercase' }}>STARTING FIVE // MANUAL CALL-IN</div>
            </div>
          </div>

          <div className="callout-spotlight" style={{ position: 'relative', minHeight: 0, overflow: 'hidden', border: `2px solid var(--theme-primary-border)`, background: COLORS.deepBlack, boxShadow: '0 18px 46px rgba(0,0,0,0.42), 0 0 0 1px var(--theme-primary-soft), 0 0 44px var(--theme-primary-softer)' }}>
            <div className="callout-sweep" />
            <div style={{ position: 'absolute', top: '20px', left: '20px', width: '28px', height: '28px', borderTop: `3px solid ${COLORS.yellow}`, borderLeft: `3px solid ${COLORS.yellow}`, zIndex: 6 }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', width: '28px', height: '28px', borderTop: `3px solid ${COLORS.yellow}`, borderRight: `3px solid ${COLORS.yellow}`, zIndex: 6 }} />
            <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '5px', background: `linear-gradient(90deg, ${COLORS.white} 0 8%, ${COLORS.yellow} 8% 100%)`, zIndex: 6 }} />

            <div style={{ position: 'absolute', top: '30px', left: '30px', right: '30px', bottom: '154px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: COLORS.black }}>
              {player?.heroImage ? (
                <img
                  src={player.heroImage}
                  alt={playerName}
                  onError={e => { e.currentTarget.src = '/OW.svg'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: player.heroPosition, transform: `scale(${Number(player.heroScale) || 1})`, transformOrigin: 'center center', filter: `brightness(${Number(player.heroBrightness) || 0.88}) contrast(1.07) saturate(0.94)` }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.10)', fontSize: '42px', fontWeight: '900', letterSpacing: '4px' }}>NO IMAGE</div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 12%, rgba(42,42,42,0.10) 52%, rgba(42,42,42,0.82) 100%)' }} />
              <div style={{ position: 'absolute', left: '18px', bottom: '18px', padding: '7px 12px', border: '1px solid var(--theme-primary-border)', background: 'rgba(21,21,21,0.68)', color: COLORS.yellow, fontSize: '12px', fontWeight: '900', letterSpacing: '2px' }}>
                {getRoleMark(role)} ROLE_LOCKED
              </div>
            </div>

            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '154px', background: 'linear-gradient(180deg, rgba(42,42,42,0.42), rgba(42,42,42,0.98))', borderTop: `1px solid ${COLORS.lineStrong}`, padding: '22px 28px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="callout-name" style={{ fontSize: '56px', fontWeight: '900', color: COLORS.white, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playerName}</div>
                  {secondaryName && <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '1.8px', textTransform: 'uppercase' }}>{secondaryName}</div>}
                </div>
                <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', color: COLORS.faintWhite, fontWeight: '900', letterSpacing: '2.5px' }}>PLAYER</div>
                  <div className="callout-number" style={{ marginTop: '4px', fontSize: '42px', color: COLORS.yellow, fontWeight: '900', letterSpacing: '2px', lineHeight: 1 }}>{String(safeIndex + 1).padStart(2, '0')}<span style={{ color: COLORS.faintWhite, fontSize: '20px' }}>/05</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', minHeight: 0, border: UI.outerFrame, background: 'rgba(255,255,255,0.018)', boxShadow: `${UI.panelShadow}, ${UI.insetLine}`, padding: '28px', overflow: 'hidden', opacity: 0, animation: 'lineupHeaderIn 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards', animationDelay: '120ms' }}>
            <div style={{ fontSize: '13px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '2.6px', textTransform: 'uppercase' }}>NOW CALLING</div>
            <div style={{ marginTop: '14px', fontSize: '78px', fontWeight: '900', color: COLORS.yellow, lineHeight: 0.9, letterSpacing: '3px' }}>{String(safeIndex + 1).padStart(2, '0')}</div>
            <div style={{ marginTop: '22px', width: '100%', height: '3px', background: `linear-gradient(90deg, ${COLORS.yellow}, var(--theme-primary-softer))` }} />
            <div style={{ marginTop: '28px', fontSize: '28px', color: COLORS.white, fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 1 }}>{role}</div>
            <div style={{ marginTop: '18px', color: COLORS.faintWhite, fontSize: '12px', fontWeight: '900', letterSpacing: '2px', lineHeight: 1.8, textTransform: 'uppercase' }}>
              PRESS CALLOUT AGAIN<br />TO BRING NEXT PLAYER
            </div>
            <div style={{ position: 'absolute', left: '28px', right: '28px', bottom: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '7px' }}>
                {data.players.map((p, idx) => (
                  <div key={`dot-${idx}`} style={{ height: '8px', background: idx <= safeIndex ? COLORS.yellow : 'rgba(255,255,255,0.10)', boxShadow: idx === safeIndex ? '0 0 14px var(--theme-primary-glow)' : 'none' }} />
                ))}
              </div>
              <div style={{ marginTop: '12px', fontSize: '10px', fontWeight: '900', color: COLORS.faintWhite, letterSpacing: '2px', textTransform: 'uppercase' }}>{Math.min(5, safeIndex + 1)} / 5 PLAYERS CALLED</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '12px' }}>
          {data.players.map((p, idx) => {
            const isActive = idx === safeIndex;
            const isCalled = idx <= safeIndex;
            return (
              <div key={`${triggerKey}-slot-${idx}-${displayPrimaryName(p)}`} className={isCalled ? 'callout-slot-called' : ''} style={{ position: 'relative', overflow: 'hidden', border: `1px solid ${isActive ? COLORS.yellow : isCalled ? 'var(--theme-primary-border)' : 'rgba(255,255,255,0.10)'}`, background: isActive ? 'var(--theme-primary-soft)' : isCalled ? 'var(--theme-primary-softer)' : 'rgba(255,255,255,0.018)', boxShadow: isActive ? '0 0 24px var(--theme-primary-soft)' : UI.insetLine, opacity: isCalled ? 1 : 0.38, padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: isActive ? COLORS.yellow : COLORS.faintWhite, fontWeight: '900', letterSpacing: '1.6px' }}>{String(idx + 1).padStart(2, '0')}</div>
                  <div style={{ width: '10px', height: '10px', background: isCalled ? COLORS.yellow : 'rgba(255,255,255,0.12)' }} />
                </div>
                <div style={{ marginTop: '18px', fontSize: '22px', color: isCalled ? COLORS.white : COLORS.faintWhite, fontWeight: '900', letterSpacing: '0.8px', lineHeight: 1.12, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayPrimaryName(p)}</div>
                <div style={{ marginTop: '10px', fontSize: '10px', color: isCalled ? COLORS.yellow : COLORS.faintWhite, fontWeight: '900', letterSpacing: '1.8px', textTransform: 'uppercase' }}>{p ? normalizeRole(p.role) : 'TBD'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function StartingLineupScene({ matchData = {} }) {
  const eventName = safeText(matchData.eventName) || 'Event';
  const interfaceName = `${eventName.replace(/\s+/g, '_')}_STARTING_LINEUP`;
  const teamA = getActiveLineup(matchData, 'A');
  const teamB = getActiveLineup(matchData, 'B');
  const requestedSide = safeText(matchData.startingLineupSide).toUpperCase();
  const activeSide = requestedSide === 'A' || requestedSide === 'B' ? requestedSide : '';
  const activeTeam = activeSide === 'B' ? teamB : teamA;
  const mode = safeText(matchData.startingLineupMode).toUpperCase();
  const isCalloutMode = activeSide && mode === 'CALLOUT';
  const calloutIndex = clamp(Number(matchData.startingLineupCalloutIndex) || 0, 0, 4);
  const triggerKey = `${activeSide || 'DUAL'}-${mode || 'LIST'}-${isCalloutMode ? calloutIndex : 'FULL'}-${matchData.startingLineupTriggerAt || 0}`;
  const activeReadyCount = activeTeam.players.filter(Boolean).length;
  const totalReadyCount = teamA.players.filter(Boolean).length + teamB.players.filter(Boolean).length;

  return (
    <div style={{ width: '1920px', height: '1080px', position: 'relative', overflow: 'hidden', backgroundColor: COLORS.black, fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
      <style>{`
        @keyframes lineupHeaderIn {
          0% { opacity: 0; transform: translateY(-28px); filter: blur(8px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes lineupCardIn {
          0% { opacity: 0; transform: translateY(48px) scale(0.958) rotateX(6deg); filter: blur(8px); }
          72% { opacity: 1; transform: translateY(-4px) scale(1.004) rotateX(0deg); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: blur(0); }
        }

        @keyframes lineupCallout {
          0%, 100% { opacity: 0; transform: scale(0.985); }
          8%, 28% { opacity: 1; transform: scale(1); }
          42% { opacity: 0; transform: scale(1.01); }
        }

        @keyframes lineupNamePulse {
          0%, 100% { color: ${COLORS.white}; text-shadow: none; }
          8%, 28% { color: ${COLORS.yellow}; text-shadow: 0 0 18px var(--theme-primary-glow); }
          42% { color: ${COLORS.white}; text-shadow: none; }
        }

        @keyframes lineupCardSweep {
          0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          18% { opacity: 0.72; }
          58% { opacity: 0.42; }
          100% { transform: translateX(130%) skewX(-18deg); opacity: 0; }
        }

        @keyframes lineupBootSweep {
          0% { transform: translateX(-108%) skewX(-16deg); opacity: 0; }
          16% { opacity: 0.92; }
          70% { opacity: 0.62; }
          100% { transform: translateX(108%) skewX(-16deg); opacity: 0; }
        }

        @keyframes lineupScanDrift {
          0% { transform: translateY(0); }
          100% { transform: translateY(18px); }
        }

        @keyframes lineupWatermarkIn {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); filter: grayscale(1) blur(5px); }
          100% { opacity: 0.06; transform: translateY(0) scale(1); filter: grayscale(1) blur(1px); }
        }

        @keyframes lineupLogoLock {
          0%, 100% { box-shadow: ${UI.panelShadow}, ${UI.insetLine}; }
          50% { box-shadow: ${UI.panelShadow}, ${UI.insetLine}, 0 0 28px var(--theme-primary-soft); }
        }

        @keyframes lineupTitleLine {
          0% { transform: scaleX(0); transform-origin: left center; opacity: 0.2; }
          100% { transform: scaleX(1); transform-origin: left center; opacity: 1; }
        }

        @keyframes calloutSpotlightIn {
          0% { opacity: 0; transform: translateY(42px) scale(0.96) rotateX(8deg); filter: blur(8px); }
          72% { opacity: 1; transform: translateY(-5px) scale(1.006) rotateX(0deg); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: blur(0); }
        }

        @keyframes calloutSweep {
          0% { transform: translateX(-125%) skewX(-18deg); opacity: 0; }
          18% { opacity: 0.85; }
          100% { transform: translateX(128%) skewX(-18deg); opacity: 0; }
        }

        @keyframes calloutNamePulse {
          0% { color: ${COLORS.white}; text-shadow: none; }
          22% { color: ${COLORS.yellow}; text-shadow: 0 0 24px var(--theme-primary-glow); }
          100% { color: ${COLORS.white}; text-shadow: none; }
        }

        @keyframes calloutNumberPulse {
          0% { transform: scale(0.92); opacity: 0.5; }
          38% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes calloutSlotCalled {
          0% { transform: translateY(18px); opacity: 0; filter: blur(4px); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }

        .lineup-card { transform-style: preserve-3d; }
        .lineup-card-entrance { opacity: 0; animation: lineupCardIn 680ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--card-delay); }
        .lineup-callout { position: absolute; inset: 0; border: 2px solid var(--theme-primary-border); box-shadow: 0 0 0 1px var(--theme-primary-soft), 0 0 34px var(--theme-primary-soft); opacity: 0; pointer-events: none; z-index: 30; animation: lineupCallout 780ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--callout-delay); }
        .lineup-card-sweep { position: absolute; top: 0; bottom: 0; left: -36%; width: 44%; background: linear-gradient(90deg, transparent, var(--theme-primary-soft), rgba(255,255,255,0.14), transparent); opacity: 0; pointer-events: none; z-index: 25; animation: lineupCardSweep 780ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--callout-delay); }
        .lineup-name-callout { animation: lineupNamePulse 780ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: var(--callout-delay); }
        .lineup-boot-sweep { position: absolute; top: 0; bottom: 0; left: -30%; width: 46%; background: linear-gradient(90deg, transparent, var(--theme-primary-soft), rgba(255,255,255,0.18), transparent); animation: lineupBootSweep 1100ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .lineup-logo-lock { animation: lineupLogoLock 2200ms ease-in-out infinite; }
        .lineup-title-line { animation: lineupTitleLine 760ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .callout-spotlight { opacity: 0; transform-style: preserve-3d; animation: calloutSpotlightIn 720ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .callout-sweep { position: absolute; top: 0; bottom: 0; left: -34%; width: 48%; background: linear-gradient(90deg, transparent, var(--theme-primary-soft), rgba(255,255,255,0.18), transparent); z-index: 9; pointer-events: none; animation: calloutSweep 880ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 130ms; }
        .callout-name { animation: calloutNamePulse 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 120ms; }
        .callout-number { transform-origin: right center; animation: calloutNumberPulse 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .callout-slot-called { animation: calloutSlotCalled 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.014) 1px, transparent 1px)', backgroundSize: '120px 120px', opacity: 0.18, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, var(--theme-primary-softer) 0%, var(--theme-primary-softer) 32%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent 7px)', opacity: 0.18, pointerEvents: 'none', animation: 'lineupScanDrift 900ms linear infinite', zIndex: 4 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, transparent 0%, var(--theme-primary-softer) 42%, transparent 66%)', pointerEvents: 'none', zIndex: 5 }} />

      {activeSide && activeTeam.teamLogo && (
        <img
          src={activeTeam.teamLogo}
          alt=""
          onError={e => { e.currentTarget.style.display = 'none'; }}
          style={{
            position: 'absolute',
            top: '172px',
            [activeSide === 'A' ? 'left' : 'right']: '-118px',
            width: '780px',
            height: '780px',
            objectFit: 'contain',
            opacity: 0,
            filter: 'grayscale(1) blur(1px)',
            animation: 'lineupWatermarkIn 900ms ease-out forwards',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      )}

      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: COLORS.yellow, opacity: activeSide === 'A' ? 1 : 0.22, zIndex: 12 }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', background: COLORS.yellow, opacity: activeSide === 'B' ? 1 : 0.22, zIndex: 12 }} />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '44px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', background: COLORS.yellow, boxShadow: '0 0 12px var(--theme-primary-border)' }} />
          <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '2px', color: COLORS.softWhite }}>{interfaceName}</span>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.38)' }}>
          {isCalloutMode ? `TEAM_${activeSide}_CALLOUT_${String(calloutIndex + 1).padStart(2, '0')} // LIVE_SYNC` : activeSide ? `TEAM_${activeSide}_ENTRANCE // LIVE_SYNC` : 'MATCH_START // LIVE_SYNC'}
        </div>
      </div>

      <BootLine activeSide={activeSide} activeTeam={activeTeam} />

      {isCalloutMode ? (
        <CalloutTeamSection data={activeTeam} calloutIndex={calloutIndex} triggerKey={triggerKey} />
      ) : activeSide ? (
        <EntranceTeamSection data={activeTeam} triggerKey={triggerKey} />
      ) : (
        <>
          <div style={{ position: 'absolute', top: '120px', left: 0, right: 0, bottom: '120px', display: 'grid', gridTemplateColumns: '1fr 1fr', zIndex: 10 }}>
            <MiniTeamSection data={teamA} align="left" />
            <MiniTeamSection data={teamB} align="right" />
          </div>

          <div style={{ position: 'absolute', top: '120px', bottom: '120px', left: '50%', transform: 'translateX(-50%)', width: '2px', background: 'rgba(255,255,255,0.06)', zIndex: 5 }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', background: COLORS.black, border: `2px solid ${COLORS.yellow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: UI.primaryGlow }}>
              <span style={{ fontSize: '24px', fontWeight: '900', color: COLORS.yellow, letterSpacing: '2px', fontStyle: 'italic' }}>VS</span>
            </div>
          </div>
        </>
      )}

      <div style={{ position: 'absolute', bottom: '60px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(255,255,255,0.08)', paddingTop: '20px', color: 'rgba(255,255,255,0.26)', fontSize: '11px', fontWeight: '900', letterSpacing: '1.8px', textTransform: 'uppercase', zIndex: 20 }}>
        <span>{isCalloutMode ? `SYS // TEAM_${activeSide}_PLAYER_${String(calloutIndex + 1).padStart(2, '0')}_CALLED` : activeSide ? `SYS // TEAM_${activeSide}_FINAL_ROSTER_LOCKED` : 'SYS // LIVE_ROSTER_CONFIRMED'}</span>
        <span style={{ color: COLORS.yellow, opacity: 0.92 }}>{isCalloutMode ? `${Math.min(5, calloutIndex + 1)}/5 PLAYERS CALLED // MANUAL CALLOUT` : activeSide ? `${activeReadyCount} PLAYERS READY // STARTING FIVE` : `${totalReadyCount} PLAYERS READY`}</span>
      </div>
    </div>
  );
}
