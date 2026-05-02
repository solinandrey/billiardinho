import { useState, useEffect, useCallback, useRef } from 'react';
import { BData } from './bdata.js';
import { transformApiData } from './transform.js';
import { CREAM } from './theme.js';
import { BottomNav } from './components/BottomNav.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { PlayersScreen } from './screens/PlayersScreen.jsx';
import { StatsScreen } from './screens/StatsScreen.jsx';
import { ProfileScreen } from './screens/ProfileScreen.jsx';
import { H2HScreen } from './screens/H2HScreen.jsx';
import { AddGameSheet } from './screens/AddGameSheet.jsx';
import { GameDetailSheet } from './screens/GameDetailSheet.jsx';

// ─── Data layer ───────────────────────────────────────────────
// In production: fetch from /api/me to get real data.
// In mock mode (local dev without Telegram): use BData.

const IS_TELEGRAM = typeof window !== 'undefined' && !!window?.Telegram?.WebApp?.initData;

function authHeaders() {
  const tg = window.Telegram?.WebApp;
  const h = { 'Content-Type': 'application/json' };
  if (tg?.initData) h['X-Init-Data'] = tg.initData;
  const urlUid = new URLSearchParams(window.location.search).get('uid');
  const uid = tg?.initDataUnsafe?.user?.id || urlUid;
  if (uid) h['X-User-Id'] = String(uid);
  return h;
}

async function fetchAppData() {
  if (!IS_TELEGRAM && import.meta.env.DEV) {
    return { mock: true, ...BData };
  }
  const tg = window.Telegram?.WebApp;
  const urlUid = new URLSearchParams(window.location.search).get('uid');
  const uid = tg?.initDataUnsafe?.user?.id || urlUid;
  const res = await fetch(`/api/me${uid ? `?uid=${uid}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('API error');
  const raw = await res.json();
  if (!raw.user) throw new Error('Не удалось определить пользователя (uid не передан)');
  return { ...transformApiData(raw) };
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState(() => localStorage.getItem('bi.tab') || 'home');
  const [stack, setStack] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [gameSheetId, setGameSheetId] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const navDir = useRef(null);

  useEffect(() => { localStorage.setItem('bi.tab', tab); }, [tab]);

  useEffect(() => {
    if (IS_TELEGRAM) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      // Prevent swipe-down from minimising the mini app — sheets feel native this way.
      // Available since Telegram Bot API 7.7; older clients silently ignore.
      try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch { /* ignore */ }
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await fetchAppData();
      setData(d);
      setLoadError(null);
    } catch (e) {
      console.error('Data load error:', e);
      // В DEV без Telegram подставляем моковые данные; в проде — показываем ошибку.
      if (!IS_TELEGRAM && import.meta.env.DEV) {
        setData({ mock: true, ...BData });
        setLoadError(null);
      } else {
        setLoadError(e?.message || String(e));
      }
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (loadError) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: CREAM,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 32 }}>😵</div>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 20 }}>Не удалось загрузить данные</div>
        <div style={{ fontSize: 13, color: '#8A8070', fontWeight: 500, maxWidth: 300 }}>
          Проверь соединение и попробуй ещё раз. Если не получается — закрой и открой мини-приложение заново.
        </div>
        <button onClick={reload} style={{
          marginTop: 8, padding: '10px 20px', borderRadius: 14, border: 'none',
          background: '#1A1612', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>Повторить</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: CREAM,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 28 }}>🎱</div>
        <div style={{ fontSize: 13, color: '#8A8070', fontWeight: 600 }}>Загрузка...</div>
      </div>
    );
  }

  const { players, games, months, eloSeries, activity, byId, me: meId,
    winnerOf, gamesBetween, recordBetween, recentGamesOf, rivalsOf, ratingHistoryOf,
    formatDate, relativeDate } = data;
  const me = byId[meId];

  const go = (kind, params) => {
    if (kind === 'game') { setGameSheetId(params.gameId); return; }
    navDir.current = 'push';
    setStack(s => [...s, { kind, params }]);
  };
  const goBack = () => {
    navDir.current = 'pop';
    setStack(s => s.slice(0, -1));
  };
  const setTabAndClear = (t) => {
    navDir.current = 'tab';
    setStack([]);
    setTab(t);
  };

  // ─── API actions ─────────────────────────────────────────────
  const handleAddGame = async ({ opponentId, scoreMe, scoreOpp, playedAt, note }) => {
    if (data.mock) {
      const newId = 'g' + Date.now();
      const iso = playedAt || new Date().toISOString();
      const dateStr = iso.split('T')[0];
      data.games.unshift({ id: newId, p1: meId, p2: opponentId, s1: scoreMe, s2: scoreOpp, date: dateStr, playedAt: iso, note: note || null });
      // keep chronological order (newest first)
      data.games.sort((a, b) => (b.playedAt || b.date).localeCompare(a.playedAt || a.date));
      setData({ ...data });
      return;
    }
    const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    await fetch('/api/session', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ uid, opponent_id: opponentId, score_me: scoreMe, score_opp: scoreOpp, played_at: playedAt, note }),
    });
    await reload();
  };

  const handleSaveEdit = async (gameId, patch, maybeS2) => {
    // Backwards-compat: callers may pass (id, s1, s2) or (id, { s1, s2, note }).
    const payload = (typeof patch === 'object' && patch !== null && !Array.isArray(patch))
      ? patch
      : { s1: patch, s2: maybeS2 };
    if (data.mock) {
      const g = data.games.find(x => x.id === gameId);
      if (g) {
        if (payload.s1 != null) g.s1 = payload.s1;
        if (payload.s2 != null) g.s2 = payload.s2;
        if (payload.note !== undefined) g.note = payload.note || null;
      }
      setData({ ...data });
      return;
    }
    await fetch(`/api/session/${gameId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    await reload();
  };

  const handleDelete = async (gameId) => {
    if (data.mock) {
      const idx = data.games.findIndex(x => x.id === gameId);
      if (idx >= 0) data.games.splice(idx, 1);
      setData({ ...data });
      return;
    }
    await fetch(`/api/session/${gameId}`, { method: 'DELETE', headers: authHeaders() });
    await reload();
  };

  const handleAvatarUpload = async (dataUrl) => {
    if (data.mock) {
      // In mock mode, just stash the data URL on the player object so the UI can render it.
      const me = byId[meId];
      if (me) me.avatar_v = String(Date.now());
      me.__mockAvatarDataUrl = dataUrl;
      setData({ ...data });
      return;
    }
    const tg = window.Telegram?.WebApp;
    const urlUid = new URLSearchParams(window.location.search).get('uid');
    const uid = tg?.initDataUnsafe?.user?.id || urlUid;
    const res = await fetch('/api/me/avatar', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ uid, dataUrl }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    await reload();
  };

  const handleAvatarRemove = async () => {
    if (data.mock) {
      const me = byId[meId];
      if (me) { me.avatar_v = null; delete me.__mockAvatarDataUrl; }
      setData({ ...data });
      return;
    }
    const res = await fetch('/api/me/avatar', { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    await reload();
  };

  const handleSaveSettings = async (updates) => {
    if (data.mock) {
      Object.assign(byId[meId], updates);
      setData({ ...data });
      return;
    }
    const tg = window.Telegram?.WebApp;
    const urlUid = new URLSearchParams(window.location.search).get('uid');
    const uid = tg?.initDataUnsafe?.user?.id || urlUid;
    const res = await fetch('/api/me/settings', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ uid, ...updates }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    await reload();
  };

  // ─── Screen routing ─────────────────────────────────────────
  const top = stack[stack.length - 1];
  const onRootTab = !top;
  const screenKey = top ? `${top.kind}-${top.params?.playerId ?? top.params?.a ?? ''}` : `tab-${tab}`;
  const screenCls = navDir.current === 'push' ? 'screen-push'
                  : navDir.current === 'pop'  ? 'screen-pop'
                  : navDir.current === 'tab'  ? 'screen-tab'
                  : '';

  let screenNode;
  if (top) {
    if (top.kind === 'profile') {
      screenNode = (
        <ProfileScreen
          playerId={top.params.playerId}
          meId={meId}
          players={players}
          games={games}
          byId={byId}
          winnerOf={winnerOf}
          relativeDate={relativeDate}
          recordBetween={recordBetween}
          gamesBetween={gamesBetween}
          rivalsOf={rivalsOf}
          recentGamesOf={recentGamesOf}
          ratingHistoryOf={ratingHistoryOf}
          go={go}
          goBack={goBack}
          fromRoot={top.params.playerId === meId && stack.length === 1}
          onSaveSettings={handleSaveSettings}
          onAvatarUpload={handleAvatarUpload}
          onAvatarRemove={handleAvatarRemove}
        />
      );
    } else if (top.kind === 'h2h') {
      screenNode = (
        <H2HScreen
          a={top.params.a}
          b={top.params.b}
          byId={byId}
          games={games}
          winnerOf={winnerOf}
          relativeDate={relativeDate}
          go={go}
          goBack={goBack}
        />
      );
    }
  } else if (tab === 'home') {
    screenNode = (
      <HomeScreen
        me={me}
        players={players}
        games={games}
        byId={byId}
        winnerOf={winnerOf}
        relativeDate={relativeDate}
        go={go}
      />
    );
  } else if (tab === 'players') {
    screenNode = <PlayersScreen players={players} games={games} go={go} />;
  } else if (tab === 'stats') {
    screenNode = <StatsScreen players={players} games={games} months={months} eloSeries={eloSeries} activity={activity} go={go} />;
  } else if (tab === 'profile') {
    screenNode = (
      <ProfileScreen
        playerId={meId}
        meId={meId}
        players={players}
        games={games}
        byId={byId}
        winnerOf={winnerOf}
        relativeDate={relativeDate}
        recordBetween={recordBetween}
        gamesBetween={gamesBetween}
        rivalsOf={rivalsOf}
        recentGamesOf={recentGamesOf}
        ratingHistoryOf={ratingHistoryOf}
        go={go}
        fromRoot
        onSaveSettings={handleSaveSettings}
        onAvatarUpload={handleAvatarUpload}
        onAvatarRemove={handleAvatarRemove}
      />
    );
  }

  const showBottomNav = onRootTab || (top?.kind === 'profile' && stack.length === 1 && top.params.playerId === meId);
  const currentGame = gameSheetId ? games.find(g => g.id === gameSheetId) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: CREAM,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#1A1612',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div key={screenKey} className={screenCls} style={{ position: 'absolute', inset: 0 }}>
          {screenNode}
        </div>
      </div>

      {showBottomNav && (
        <BottomNav tab={tab} setTab={setTabAndClear} openAdd={() => setShowAdd(true)} />
      )}

      {showAdd && (
        <AddGameSheet
          me={me}
          players={players}
          onClose={() => setShowAdd(false)}
          onSaved={handleAddGame}
        />
      )}

      {currentGame && (
        <GameDetailSheet
          game={currentGame}
          byId={byId}
          meId={meId}
          winnerOf={winnerOf}
          onClose={() => setGameSheetId(null)}
          onSaved={handleSaveEdit}
          onDelete={handleDelete}
          go={go}
        />
      )}
    </div>
  );
}
