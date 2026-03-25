// ── Telegram WebApp init ─────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#3390EC');
}

// ── State ────────────────────────────────────────────────────────────────────
let state = {
  me: null,      // { uid, name }
  pairs: [],     // [{ id, name1, name2, uid1, uid2 }]
  sessions: [],  // [{ id, pair_id, score1, score2, played_at }]
  activePairId: null,
};

// ── API ──────────────────────────────────────────────────────────────────────
const API = '/api';

async function apiFetch(path, opts = {}) {
  const uid = tg?.initDataUnsafe?.user?.id || 0;
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', 'X-User-Id': uid },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const data = await apiFetch('/me');
    state.me = data.me;
    state.pairs = data.pairs;
    state.sessions = data.sessions;
    if (state.pairs.length > 0) state.activePairId = state.pairs[0].id;
    renderAll();
  } catch (e) {
    // Fallback: show UI with empty data (for preview without backend)
    renderAll();
  }

  // Set today as default date in Add form
  document.getElementById('add-date').value = todayISO();
}

// ── Routing ───────────────────────────────────────────────────────────────────
let currentTab = 'home';

function switchTab(tab) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  currentTab = tab;
  if (tab === 'stats') renderStats();
}

// ── Render helpers ────────────────────────────────────────────────────────────
function getOpponentName(pair) {
  if (!state.me) return pair.name2 || pair.name1;
  return pair.uid1 === state.me.uid ? (pair.name2 || '?') : (pair.name1 || '?');
}

function getMyScore(session, pair) {
  if (!state.me) return session.score1;
  return pair.uid1 === state.me.uid ? session.score1 : session.score2;
}

function getOppScore(session, pair) {
  if (!state.me) return session.score2;
  return pair.uid1 === state.me.uid ? session.score2 : session.score1;
}

function getPairForSession(session) {
  return state.pairs.find(p => p.id === session.pair_id);
}

function relativeDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff/60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ч. назад`;
  if (diff < 604800) return `${Math.floor(diff/86400)} дн. назад`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name = '?') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Render: Home ─────────────────────────────────────────────────────────────
function renderHome() {
  // Stats
  const totalGames = state.sessions.length;
  const playerSet = new Set();
  state.pairs.forEach(p => { if (p.name1) playerSet.add(p.name1); if (p.name2) playerSet.add(p.name2); });

  // Best winrate among all players
  const players = computePlayers();
  const best = players.length > 0 ? Math.round(players[0].winrate) : 0;

  document.getElementById('stat-games').textContent = totalGames || '0';
  document.getElementById('stat-players').textContent = playerSet.size || '0';
  document.getElementById('stat-best').textContent = best ? best + '%' : '—';

  // Top players (max 3)
  const topEl = document.getElementById('top-players');
  const top3 = players.slice(0, 3);
  if (top3.length === 0) {
    topEl.innerHTML = emptyState('🏆', 'Сыграйте первую игру!');
  } else {
    topEl.innerHTML = top3.map((p, i) => playerCardHTML(p, i === 0)).join('');
  }

  // Recent games (max 5)
  const recentEl = document.getElementById('recent-games');
  const recent = [...state.sessions].sort((a,b) => b.played_at.localeCompare(a.played_at)).slice(0, 5);
  if (recent.length === 0) {
    recentEl.innerHTML = emptyState('🎱', 'Ещё нет записанных игр');
  } else {
    recentEl.innerHTML = recent.map(s => gameCardHTML(s)).join('');
  }
}

// ── Render: Players ───────────────────────────────────────────────────────────
function renderPlayers() {
  const players = computePlayers();
  const el = document.getElementById('all-players');
  if (players.length === 0) {
    el.innerHTML = emptyState('👥', 'Пока нет игроков');
    return;
  }
  el.innerHTML = players.map((p, i) => playerCardHTML(p, i === 0)).join('');
}

// ── Render: Add form ──────────────────────────────────────────────────────────
function renderAddForm() {
  const sel = document.getElementById('add-opponent');
  sel.innerHTML = '<option value="">Выбери соперника...</option>';

  const myName = state.me ? (state.pairs.find(p => p.uid1 === state.me?.uid)?.name1 || state.pairs.find(p => p.uid2 === state.me?.uid)?.name2) : null;

  state.pairs.forEach(p => {
    const oppName = getOpponentName(p);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = oppName;
    sel.appendChild(opt);
  });

  if (myName) {
    document.getElementById('add-my-label').textContent = myName;
  }
}

// ── Render: Stats ─────────────────────────────────────────────────────────────
function renderStats() {
  const tabsEl = document.getElementById('pair-tabs');
  const contentEl = document.getElementById('stats-content');

  if (state.pairs.length === 0) {
    tabsEl.innerHTML = '';
    contentEl.innerHTML = emptyState('📊', 'Нет данных для статистики');
    return;
  }

  // Pair tabs
  tabsEl.innerHTML = state.pairs.map(p => {
    const opp = getOpponentName(p);
    const active = p.id === state.activePairId ? 'active' : '';
    return `<button class="pair-tab ${active}" onclick="selectPair(${p.id})">${opp}</button>`;
  }).join('');

  // Stats for active pair
  const pair = state.pairs.find(p => p.id === state.activePairId);
  if (!pair) { contentEl.innerHTML = ''; return; }

  const sessions = state.sessions.filter(s => s.pair_id === pair.id);
  const myWins = sessions.filter(s => getMyScore(s, pair) > getOppScore(s, pair)).length;
  const oppWins = sessions.length - myWins;
  const myAvg = sessions.length ? (sessions.reduce((a,s) => a + getMyScore(s, pair), 0) / sessions.length).toFixed(1) : '—';
  const oppAvg = sessions.length ? (sessions.reduce((a,s) => a + getOppScore(s, pair), 0) / sessions.length).toFixed(1) : '—';
  const winrate = sessions.length ? Math.round(myWins / sessions.length * 100) : 0;

  const myName = state.me ? (pair.uid1 === state.me.uid ? pair.name1 : pair.name2) : pair.name1;
  const oppName = getOpponentName(pair);

  contentEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
      <div class="stats-big-card">
        <div class="stats-vs">
          <div class="stats-vs-player">
            <div class="stats-vs-name">${myName || 'Я'}</div>
            <div class="stats-vs-num">${myWins}</div>
            <div class="stats-vs-label">побед</div>
          </div>
          <div class="stats-vs-divider">vs</div>
          <div class="stats-vs-player">
            <div class="stats-vs-name">${oppName}</div>
            <div class="stats-vs-num">${oppWins}</div>
            <div class="stats-vs-label">побед</div>
          </div>
        </div>
        <div class="stats-divider"></div>
        <div class="stats-grid">
          <div class="stats-item">
            <div class="stats-item-num">${sessions.length}</div>
            <div class="stats-item-label">Всего игр</div>
          </div>
          <div class="stats-item">
            <div class="stats-item-num">${winrate}%</div>
            <div class="stats-item-label">Мой винрейт</div>
          </div>
          <div class="stats-item">
            <div class="stats-item-num">${myAvg}</div>
            <div class="stats-item-label">Мои шары / игра</div>
          </div>
          <div class="stats-item">
            <div class="stats-item-num">${oppAvg}</div>
            <div class="stats-item-label">Его шары / игра</div>
          </div>
        </div>
      </div>

      ${sessions.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <div class="section-title-row">
              <span class="section-icon">📋</span>
              <span class="section-title">История игр</span>
            </div>
          </div>
          <div class="card-list">
            ${[...sessions].sort((a,b) => b.played_at.localeCompare(a.played_at)).map(s => gameCardHTML(s)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function selectPair(id) {
  state.activePairId = id;
  renderStats();
}

// ── Compute players leaderboard ───────────────────────────────────────────────
function computePlayers() {
  const map = new Map(); // name → { wins, total }

  state.pairs.forEach(pair => {
    const sessions = state.sessions.filter(s => s.pair_id === pair.id);
    sessions.forEach(s => {
      const n1 = pair.name1, n2 = pair.name2;
      if (!n1 || !n2) return;
      const p1wins = s.score1 > s.score2;

      if (!map.has(n1)) map.set(n1, { wins: 0, total: 0, balls: 0 });
      if (!map.has(n2)) map.set(n2, { wins: 0, total: 0, balls: 0 });

      const p1 = map.get(n1), p2 = map.get(n2);
      p1.total++; p2.total++;
      p1.balls += s.score1; p2.balls += s.score2;
      if (p1wins) p1.wins++; else p2.wins++;
    });
  });

  return [...map.entries()]
    .map(([name, d]) => ({ name, wins: d.wins, total: d.total, winrate: d.total ? d.wins / d.total * 100 : 0 }))
    .sort((a, b) => b.winrate - a.winrate || b.wins - a.wins);
}

// ── HTML builders ─────────────────────────────────────────────────────────────
function playerCardHTML(p, isFirst) {
  return `
    <div class="player-card">
      <div class="player-avatar">
        ${initials(p.name)}
        ${isFirst ? '<span class="crown-badge">👑</span>' : ''}
      </div>
      <div class="player-info">
        <div class="player-name">${p.name}</div>
        <div class="player-sub">${p.wins} побед из ${p.total} игр</div>
      </div>
      <div class="player-winrate">
        <div class="winrate-num">${Math.round(p.winrate)}%</div>
        <div class="winrate-label">винрейт</div>
      </div>
    </div>
  `;
}

function gameCardHTML(session) {
  const pair = getPairForSession(session);
  if (!pair) return '';
  const myS = getMyScore(session, pair);
  const oppS = getOppScore(session, pair);
  const myName = state.me ? (pair.uid1 === state.me.uid ? pair.name1 : pair.name2) : pair.name1;
  const oppName = getOpponentName(pair);
  const iWon = myS > oppS;
  return `
    <div class="game-card">
      <div class="game-meta">
        <span class="game-date">${relativeDate(session.played_at)}</span>
        <span class="game-type">🎱 Бильярд</span>
      </div>
      <div class="game-score-row">
        <div class="game-player">${myName || 'Я'}</div>
        <div class="game-score">
          <span class="${iWon ? 'score-win' : 'score-lose'}">${myS}</span>
          <span style="color:var(--text-secondary)"> : </span>
          <span class="${!iWon ? 'score-win' : 'score-lose'}">${oppS}</span>
        </div>
        <div class="game-player right">${oppName}</div>
      </div>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div>${text}</div>`;
}

// ── Submit game ───────────────────────────────────────────────────────────────
async function submitGame() {
  const pairId = parseInt(document.getElementById('add-opponent').value);
  const scoreMe = parseInt(document.getElementById('add-score-me').value);
  const scoreOpp = parseInt(document.getElementById('add-score-opp').value);
  const date = document.getElementById('add-date').value;

  if (!pairId) return showToast('Выбери соперника');
  if (isNaN(scoreMe) || isNaN(scoreOpp)) return showToast('Введи счёт');
  if (!date) return showToast('Укажи дату');

  const pair = state.pairs.find(p => p.id === pairId);
  const isUid1 = !state.me || pair.uid1 === state.me.uid;
  const score1 = isUid1 ? scoreMe : scoreOpp;
  const score2 = isUid1 ? scoreOpp : scoreMe;

  try {
    const result = await apiFetch('/session', {
      method: 'POST',
      body: JSON.stringify({ pair_id: pairId, score1, score2, played_at: date }),
    });
    state.sessions.push(result.session);
    showToast('✅ Игра записана!');

    // Reset form
    document.getElementById('add-score-me').value = '';
    document.getElementById('add-score-opp').value = '';
    document.getElementById('add-date').value = todayISO();

    renderAll();
    setTimeout(() => switchTab('home'), 800);
  } catch (e) {
    showToast('Ошибка: ' + e.message);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  renderHome();
  renderPlayers();
  renderAddForm();
}

// ── Start ─────────────────────────────────────────────────────────────────────
boot();
