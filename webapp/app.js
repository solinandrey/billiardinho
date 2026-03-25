// ── Telegram WebApp ───────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#3390EC'); }
const TG_USER = tg?.initDataUnsafe?.user || null;

// ── State ────────────────────────────────────────────────────────────────────
let state = { pairs: [], sessions: [] };
let navStack = []; // for back navigation

// ── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json', 'X-User-Id': String(TG_USER?.id || 0), 'X-Init-Data': tg?.initData || '' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const data = await apiFetch('/me');
    state.pairs    = data.pairs    || [];
    state.sessions = data.sessions || [];
  } catch (e) { /* no backend */ }
  document.getElementById('add-date').value = todayISO();
  renderAll();
}

// ── Player ID system ─────────────────────────────────────────────────────────
// Assigns stable sequential IDs (#1, #2…) based on uid order in pairs table
function buildPlayerMap() {
  const map = new Map(); // uid → { name, id }
  let counter = 1;
  state.pairs.forEach(p => {
    if (p.uid1 && !map.has(p.uid1)) map.set(p.uid1, { name: p.name1, uid: p.uid1, pid: counter++ });
    if (p.uid2 && !map.has(p.uid2)) map.set(p.uid2, { name: p.name2, uid: p.uid2, pid: counter++ });
  });
  return map;
}

function getPlayerPid(uid) {
  const m = buildPlayerMap();
  return m.get(uid)?.pid ?? null;
}

function myUid()           { return TG_USER?.id || (state.pairs[0]?.uid1) || 0; }
function isUid1(pair)      { return pair.uid1 === myUid(); }
function getMyScore(s, p)  { return isUid1(p) ? s.score1 : s.score2; }
function getOppScore(s, p) { return isUid1(p) ? s.score2 : s.score1; }
function getMyName(p)      { return isUid1(p) ? p.name1 : p.name2; }
function getOppName(p)     { return isUid1(p) ? (p.name2 || '?') : (p.name1 || '?'); }
function getOppUid(p)      { return isUid1(p) ? p.uid2 : p.uid1; }
function getPair(session)  { return state.pairs.find(p => p.id === session.pair_id); }

function initials(name = '') {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  const d = new Date(iso), now = new Date(), sec = Math.floor((now - d) / 1000);
  if (sec < 60)     return 'только что';
  if (sec < 3600)   return `${Math.floor(sec / 60)} мин. назад`;
  if (sec < 86400)  return `${Math.floor(sec / 3600)} ч. назад`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} дн. назад`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ── Tab routing ───────────────────────────────────────────────────────────────
let currentTab = 'home';

function switchTab(tab) {
  navStack = [];
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  currentTab = tab;
}

function pushScreen(screenId) {
  navStack.push(document.querySelector('.screen.active')?.id || 'screen-home');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function goBack() {
  const prev = navStack.pop();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(prev || 'screen-home').classList.add('active');
}

// ── My stats ─────────────────────────────────────────────────────────────────
function myStats() {
  let total = 0, wins = 0;
  state.pairs.forEach(pair => {
    state.sessions.filter(s => s.pair_id === pair.id).forEach(s => {
      total++;
      if (getMyScore(s, pair) > getOppScore(s, pair)) wins++;
    });
  });
  return { total, wins, winrate: total ? Math.round(wins / total * 100) : 0 };
}

// ── Global leaderboard ────────────────────────────────────────────────────────
function leaderboard() {
  const map = new Map(); // uid → { name, uid, wins, total }
  state.pairs.forEach(pair => {
    if (!pair.name1 || !pair.name2) return;
    if (!map.has(pair.uid1)) map.set(pair.uid1, { name: pair.name1, uid: pair.uid1, wins: 0, total: 0 });
    if (pair.uid2 && !map.has(pair.uid2)) map.set(pair.uid2, { name: pair.name2, uid: pair.uid2, wins: 0, total: 0 });
    state.sessions.filter(s => s.pair_id === pair.id).forEach(s => {
      map.get(pair.uid1).total++;
      if (pair.uid2) map.get(pair.uid2).total++;
      if (s.score1 > s.score2) map.get(pair.uid1).wins++;
      else if (pair.uid2) map.get(pair.uid2).wins++;
    });
  });
  return [...map.values()]
    .map(p => ({ ...p, wr: p.total ? p.wins / p.total * 100 : 0 }))
    .sort((a, b) => b.wr - a.wr || b.wins - a.wins);
}

// ── Render: Home ─────────────────────────────────────────────────────────────
function renderHome() {
  const tgName = TG_USER
    ? [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ')
    : (state.pairs.length ? getMyName(state.pairs[0]) : 'Игрок');

  const username = TG_USER?.username ? '@' + TG_USER.username : '';
  document.getElementById('user-name').textContent     = tgName || (state.pairs.length ? getMyName(state.pairs[0]) : '—');
  document.getElementById('user-username').textContent = username;

  const photoEl    = document.getElementById('user-photo');
  const initialsEl = document.getElementById('user-initials');
  initialsEl.textContent = initials(tgName);
  if (TG_USER?.photo_url) {
    photoEl.src = TG_USER.photo_url; photoEl.style.display = 'block'; initialsEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; initialsEl.style.display = 'flex';
  }

  const { total, wins, winrate } = myStats();
  document.getElementById('stat-games').textContent   = total || '0';
  document.getElementById('stat-wins').textContent    = wins  || '0';
  document.getElementById('stat-winrate').textContent = total ? winrate + '%' : '—';

  const el     = document.getElementById('recent-games');
  const recent = [...state.sessions].sort((a, b) => b.played_at.localeCompare(a.played_at)).slice(0, 10);
  el.innerHTML = recent.length
    ? recent.map(s => gameCardHTML(s, true)).join('')
    : emptyState('🎱', 'Ещё нет записанных игр.<br>Нажми + чтобы добавить.');
}

// ── Render: Players ───────────────────────────────────────────────────────────
function renderPlayers() {
  const board = leaderboard();
  const el    = document.getElementById('all-players');
  const pmap  = buildPlayerMap();

  if (!board.length) { el.innerHTML = emptyState('🏆', 'Ещё нет данных'); return; }

  el.innerHTML = board.map((p, i) => {
    const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="font-size:13px;color:var(--text-secondary)">${i + 1}</span>`;
    const pid = pmap.get(p.uid)?.pid;
    return `
      <div class="player-card" onclick="openPlayerProfile(${p.uid})">
        <div class="player-rank">${rankIcon}</div>
        <div class="player-avatar">${initials(p.name)}</div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="player-name">${p.name}</span>
            ${pid ? `<span class="player-pid">#${pid}</span>` : ''}
          </div>
          <div class="player-sub">${p.wins} побед из ${p.total} игр</div>
        </div>
        <div class="player-winrate">
          <div class="winrate-num">${Math.round(p.wr)}%</div>
          <div class="winrate-label">винрейт</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render: Add form ──────────────────────────────────────────────────────────
let _selectPairs    = [];
let _selectedPairId = null;

function renderAddForm() {
  _selectPairs = state.pairs;
  _selectedPairId = null;
  document.getElementById('add-opponent').value = '';
  const disp = document.getElementById('opponent-display');
  disp.textContent = 'Выбери соперника...';
  disp.className   = 'custom-select-placeholder';

  // My name label
  const myName = state.pairs.length ? getMyName(state.pairs[0]) : 'Я';
  document.getElementById('score-label-me').textContent = myName;
  document.getElementById('score-label-opp').textContent = 'Соперник';

  renderOpponentList('');
}

function renderOpponentList(query) {
  const list = document.getElementById('opponent-list');
  const q    = query.toLowerCase().trim();
  const pmap = buildPlayerMap();

  const filtered = _selectPairs.filter(p => {
    const name = getOppName(p).toLowerCase();
    const uid  = getOppUid(p);
    const pid  = pmap.get(uid)?.pid;
    return name.includes(q) || (pid && String(pid).includes(q));
  });

  if (!filtered.length) { list.innerHTML = `<div class="custom-select-empty">Не найдено</div>`; return; }

  list.innerHTML = filtered.map(p => {
    const oppName = getOppName(p);
    const oppUid  = getOppUid(p);
    const pid     = pmap.get(oppUid)?.pid;
    const isActive = p.id === _selectedPairId;
    return `
      <div class="custom-select-option ${isActive ? 'active' : ''}" onclick="selectOpponent(${p.id}, '${oppName}')">
        <div class="select-opt-avatar">${initials(oppName)}</div>
        <div class="select-opt-info">
          <span class="select-opt-name">${oppName}</span>
          ${pid ? `<span class="select-opt-pid">#${pid}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterOpponents(query) { renderOpponentList(query); }

function toggleSelect() {
  const wrap   = document.getElementById('opponent-select');
  const isOpen = wrap.classList.contains('open');
  if (isOpen) { closeSelect(); return; }
  wrap.classList.add('open');
  document.getElementById('opponent-search').value = '';
  renderOpponentList('');
  setTimeout(() => document.getElementById('opponent-search').focus(), 50);
}

function closeSelect() { document.getElementById('opponent-select').classList.remove('open'); }

function selectOpponent(pairId, name) {
  _selectedPairId = pairId;
  document.getElementById('add-opponent').value = pairId;
  const disp = document.getElementById('opponent-display');
  disp.textContent = name;
  disp.className   = 'custom-select-value';
  document.getElementById('score-label-opp').textContent = name;
  closeSelect();
}

document.addEventListener('click', e => {
  if (!document.getElementById('opponent-select')?.contains(e.target)) closeSelect();
});

// ── Player profile ────────────────────────────────────────────────────────────
function openPlayerProfile(uid) {
  if (uid === myUid()) { openMyProfile(); return; }

  // Find this player across pairs
  const pairs = state.pairs.filter(p => p.uid1 === uid || p.uid2 === uid);
  const isUid1ForPlayer = (pair) => pair.uid1 === uid;
  const getName = (pair) => isUid1ForPlayer(pair) ? pair.name1 : pair.name2;

  const name    = pairs.length ? getName(pairs[0]) : '?';
  const pid     = getPlayerPid(uid);
  const allSessions = state.sessions.filter(s => pairs.some(p => p.id === s.pair_id));

  let total = 0, wins = 0;
  allSessions.forEach(s => {
    const pair = pairs.find(p => p.id === s.pair_id);
    total++;
    const myS = isUid1ForPlayer(pair) ? s.score1 : s.score2;
    const oppS = isUid1ForPlayer(pair) ? s.score2 : s.score1;
    if (myS > oppS) wins++;
  });
  const wr = total ? Math.round(wins / total * 100) : 0;

  document.getElementById('player-avatar-lg').textContent = initials(name);
  document.getElementById('player-profile-name').textContent = name;
  document.getElementById('player-profile-id').textContent  = pid ? `#${pid}` : '';
  document.getElementById('player-stat-games').textContent  = total || '0';
  document.getElementById('player-stat-wins').textContent   = wins  || '0';
  document.getElementById('player-stat-wr').textContent     = total ? wr + '%' : '—';

  const recent = [...allSessions].sort((a, b) => b.played_at.localeCompare(a.played_at));

  document.getElementById('player-profile-content').innerHTML = recent.length
    ? `<div class="section"><div class="section-header"><div class="section-title-row"><span class="section-icon">📋</span><span class="section-title">История игр</span></div></div><div class="card-list">${recent.map(s => gameCardHTMLFromPerspective(s, uid)).join('')}</div></div>`
    : emptyState('🎱', 'Нет игр');

  pushScreen('screen-player');
}

function openMyProfile() {
  const uid  = myUid();
  const tgName = TG_USER
    ? [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ')
    : (state.pairs.length ? getMyName(state.pairs[0]) : 'Игрок');
  const pid  = getPlayerPid(uid);
  const { total, wins, winrate } = myStats();

  // Avatar
  const photoEl    = document.getElementById('my-profile-photo');
  const initialsEl = document.getElementById('my-profile-initials');
  initialsEl.textContent = initials(tgName);
  if (TG_USER?.photo_url) {
    photoEl.src = TG_USER.photo_url; photoEl.style.display = 'block'; initialsEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; initialsEl.style.display = 'flex';
  }

  document.getElementById('my-profile-name').textContent = tgName;
  document.getElementById('my-profile-id').textContent   = pid ? `#${pid}` : '';
  document.getElementById('my-stat-games').textContent   = total || '0';
  document.getElementById('my-stat-wins').textContent    = wins  || '0';
  document.getElementById('my-stat-wr').textContent      = total ? winrate + '%' : '—';

  // Per-opponent breakdown + recent games
  const opponentsHTML = state.pairs.map(pair => {
    const sessions = state.sessions.filter(s => s.pair_id === pair.id);
    const myW  = sessions.filter(s => getMyScore(s, pair) > getOppScore(s, pair)).length;
    const wr2  = sessions.length ? Math.round(myW / sessions.length * 100) : 0;
    const oppName = getOppName(pair);
    const oppUid  = getOppUid(pair);
    const pmap = buildPlayerMap();
    const oppPid = pmap.get(oppUid)?.pid;
    return `
      <div class="player-card" onclick="openPlayerProfile(${oppUid})">
        <div class="player-avatar">${initials(oppName)}</div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="player-name">${oppName}</span>
            ${oppPid ? `<span class="player-pid">#${oppPid}</span>` : ''}
          </div>
          <div class="player-sub">${myW} побед из ${sessions.length} игр</div>
        </div>
        <div class="player-winrate">
          <div class="winrate-num">${wr2}%</div>
          <div class="winrate-label">мой %</div>
        </div>
      </div>
    `;
  }).join('');

  const recent = [...state.sessions].sort((a, b) => b.played_at.localeCompare(a.played_at));

  document.getElementById('my-profile-content').innerHTML = `
    ${state.pairs.length ? `
      <div class="section">
        <div class="section-header"><div class="section-title-row"><span class="section-icon">⚔️</span><span class="section-title">Соперники</span></div></div>
        <div class="card-list">${opponentsHTML}</div>
      </div>` : ''}
    ${recent.length ? `
      <div class="section">
        <div class="section-header"><div class="section-title-row"><span class="section-icon">📋</span><span class="section-title">Все игры</span></div></div>
        <div class="card-list">${recent.map(s => gameCardHTML(s, true)).join('')}</div>
      </div>` : ''}
  `;

  pushScreen('screen-myprofile');
}

// ── HTML builders ─────────────────────────────────────────────────────────────
function gameCardHTML(session, clickable = false) {
  const pair = getPair(session);
  if (!pair) return '';
  const myS = getMyScore(session, pair), oppS = getOppScore(session, pair);
  const myName = getMyName(pair) || 'Я', oppName = getOppName(pair);
  const iWon = myS > oppS, isDraw = myS === oppS;
  const resultClass = isDraw ? 'draw' : iWon ? 'win' : 'lose';
  const resultText  = isDraw ? 'Ничья' : iWon ? 'Победа' : 'Поражение';
  return `
    <div class="game-card clickable" onclick="openGameDetail(${session.id})">
      <div class="game-meta">
        <span class="game-date">${fmtDate(session.played_at)}</span>
        <span class="game-result ${resultClass}">${resultText}</span>
      </div>
      <div class="game-score-row">
        <div class="game-player">${myName}</div>
        <div class="game-score">
          <span class="${iWon ? 'score-win' : 'score-lose'}">${myS}</span>
          <span style="color:var(--text-secondary)">:</span>
          <span class="${!iWon ? 'score-win' : 'score-lose'}">${oppS}</span>
        </div>
        <div class="game-player right">${oppName}</div>
      </div>
    </div>
  `;
}

function gameCardHTMLFromPerspective(session, uid) {
  const pair = getPair(session);
  if (!pair) return '';
  const isP1 = pair.uid1 === uid;
  const myS  = isP1 ? session.score1 : session.score2;
  const oppS = isP1 ? session.score2 : session.score1;
  const myName  = isP1 ? pair.name1 : pair.name2;
  const oppName = isP1 ? pair.name2 : pair.name1;
  const iWon = myS > oppS, isDraw = myS === oppS;
  const resultClass = isDraw ? 'draw' : iWon ? 'win' : 'lose';
  const resultText  = isDraw ? 'Ничья' : iWon ? 'Победа' : 'Поражение';
  return `
    <div class="game-card clickable" onclick="openGameDetail(${session.id})">
      <div class="game-meta">
        <span class="game-date">${fmtDate(session.played_at)}</span>
        <span class="game-result ${resultClass}">${resultText}</span>
      </div>
      <div class="game-score-row">
        <div class="game-player">${myName}</div>
        <div class="game-score">
          <span class="${iWon ? 'score-win' : 'score-lose'}">${myS}</span>
          <span style="color:var(--text-secondary)">:</span>
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

// ── Game detail ───────────────────────────────────────────────────────────────
function openGameDetail(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const pair = getPair(session);
  if (!pair) return;

  const myS  = getMyScore(session, pair);
  const oppS = getOppScore(session, pair);
  const myName  = getMyName(pair)  || 'Я';
  const oppName = getOppName(pair) || '?';
  const iWon  = myS  > oppS;
  const isDraw = myS === oppS;

  // Header color & result text
  const header = document.getElementById('game-detail-header');
  header.className = 'game-detail-header ' + (isDraw ? 'draw' : iWon ? 'win' : 'lose');

  document.getElementById('game-detail-result').textContent =
    isDraw ? 'Ничья' : iWon ? '🏆 Победа' : 'Поражение';

  document.getElementById('game-detail-date').textContent =
    new Date(session.played_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  // Score — winner's number in blue
  const s1Class = iWon  ? 'ds-win' : isDraw ? '' : 'ds-lose';
  const s2Class = !iWon ? 'ds-win' : isDraw ? '' : 'ds-lose';
  document.getElementById('game-detail-score').innerHTML =
    `<span class="${s1Class}">${myS}</span><span class="ds-sep">:</span><span class="${s2Class}">${oppS}</span>`;

  // Players
  document.getElementById('game-detail-av1').textContent = initials(myName);
  document.getElementById('game-detail-n1').textContent  = myName;
  document.getElementById('game-detail-av2').textContent = initials(oppName);
  document.getElementById('game-detail-n2').textContent  = oppName;

  // Highlight winner avatar
  document.getElementById('game-detail-av1').className = 'game-detail-avatar' + (iWon  ? ' winner' : isDraw ? '' : ' loser');
  document.getElementById('game-detail-av2').className = 'game-detail-avatar' + (!iWon ? ' winner' : isDraw ? '' : ' loser');

  pushScreen('screen-game');
}

// ── Submit game ───────────────────────────────────────────────────────────────
async function submitGame() {
  const pairId   = parseInt(document.getElementById('add-opponent').value);
  const scoreMe  = parseInt(document.getElementById('add-score-me').value);
  const scoreOpp = parseInt(document.getElementById('add-score-opp').value);
  const date     = document.getElementById('add-date').value;

  if (!pairId)                            return showToast('Выбери соперника');
  if (isNaN(scoreMe) || isNaN(scoreOpp)) return showToast('Введи счёт');
  if (!date)                              return showToast('Укажи дату');

  const pair   = state.pairs.find(p => p.id === pairId);
  const score1 = isUid1(pair) ? scoreMe : scoreOpp;
  const score2 = isUid1(pair) ? scoreOpp : scoreMe;

  try {
    const result = await apiFetch('/session', {
      method: 'POST',
      body: JSON.stringify({ pair_id: pairId, score1, score2, played_at: date }),
    });
    state.sessions.push(result.session);
    showToast('✅ Игра записана!');
    document.getElementById('add-score-me').value  = '';
    document.getElementById('add-score-opp').value = '';
    document.getElementById('add-date').value       = todayISO();
    renderAll();
    setTimeout(() => switchTab('home'), 700);
  } catch (e) { showToast('Ошибка: ' + e.message); }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() { renderHome(); renderPlayers(); renderAddForm(); }

boot();
