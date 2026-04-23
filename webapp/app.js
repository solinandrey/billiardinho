// ── Telegram WebApp ───────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor('#1a1a2e'); }
const TG_USER = tg?.initDataUnsafe?.user || null;
const URL_UID = parseInt(new URLSearchParams(location.search).get('uid')) || 0;

// ── State ────────────────────────────────────────────────────────────────────
let state = { user: null, users: [], sessions: [] };
let navStack = [];
let h2hChartInstance = null;
let statsChartInstances = [];

// ── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': String(TG_USER?.id || URL_UID || 0),
      'X-Init-Data': tg?.initData || '',
    },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const data = await apiFetch('/me');
    state.user     = data.user     || null;
    state.users    = data.users    || [];
    state.sessions = data.sessions || [];
  } catch (e) { console.warn('API unavailable', e); }
  document.getElementById('add-date').value = todayISO();
  renderAll();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function myUid()   { return TG_USER?.id || URL_UID || state.user?.uid || 0; }
function myUser()  { return state.user || state.users.find(u => u.uid === myUid()) || null; }

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
  return d.toLocaleDateString('ru', {
    day: 'numeric', month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/** Сессии текущего пользователя */
function mySessions() {
  const me = myUser();
  if (!me) return [];
  return state.sessions.filter(s => s.user1_id === me.id || s.user2_id === me.id);
}

/** Статистика игрока из его сессий */
function playerStats(userId) {
  const sessions = state.sessions.filter(s => s.user1_id === userId || s.user2_id === userId);
  let wins = 0, draws = 0;
  for (const s of sessions) {
    const myS  = s.user1_id === userId ? s.score1 : s.score2;
    const oppS = s.user1_id === userId ? s.score2 : s.score1;
    if (myS > oppS) wins++;
    else if (myS === oppS) draws++;
  }
  return { total: sessions.length, wins, draws, losses: sessions.length - wins - draws };
}

function ratingColor(r) {
  if (r >= 7)  return '#4ade80';   // green
  if (r >= 5)  return '#60a5fa';   // blue
  if (r >= 3)  return '#fbbf24';   // yellow
  return '#f87171';                 // red
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
  if (tab === 'stats') renderStats();
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

// ── Render: Home ─────────────────────────────────────────────────────────────
function renderHome() {
  const me = myUser();
  const tgName = TG_USER
    ? [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ')
    : (me?.name || 'Игрок');

  document.getElementById('user-name').textContent     = tgName;
  document.getElementById('user-username').textContent = TG_USER?.username ? '@' + TG_USER.username : '';

  const photoEl    = document.getElementById('user-photo');
  const initialsEl = document.getElementById('user-initials');
  initialsEl.textContent = initials(tgName);
  if (TG_USER?.photo_url) {
    photoEl.src = TG_USER.photo_url; photoEl.style.display = 'block'; initialsEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; initialsEl.style.display = 'flex';
  }

  const { total, wins } = me ? playerStats(me.id) : { total: 0, wins: 0 };
  const wr = total ? Math.round(wins / total * 100) : 0;
  document.getElementById('stat-games').textContent   = total  || '0';
  document.getElementById('stat-wins').textContent    = wins   || '0';
  document.getElementById('stat-winrate').textContent = total  ? wr + '%' : '—';
  document.getElementById('stat-rating').textContent  = me ? me.rating.toFixed(1) : '—';

  const el     = document.getElementById('recent-games');
  const recent = mySessions().slice().sort((a, b) => b.played_at.localeCompare(a.played_at)).slice(0, 10);
  el.innerHTML = recent.length
    ? recent.map(s => gameCardHTML(s)).join('')
    : emptyState('🎱', 'Ещё нет записанных игр.<br>Нажми + чтобы добавить.');
}

// ── Render: Players ───────────────────────────────────────────────────────────
function renderPlayers() {
  const el = document.getElementById('all-players');
  if (!state.users.length) { el.innerHTML = emptyState('🏆', 'Ещё нет игроков'); return; }

  const sorted = [...state.users].sort((a, b) => b.rating - a.rating);
  el.innerHTML = sorted.map((u, i) => {
    const { total, wins } = playerStats(u.id);
    const wr = total ? Math.round(wins / total * 100) : 0;
    const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉'
      : `<span style="font-size:13px;color:var(--text-secondary)">${i + 1}</span>`;
    return `
      <div class="player-card" onclick="openPlayerProfile(${u.id})">
        <div class="player-rank">${rankIcon}</div>
        <div class="player-avatar">${initials(u.name)}</div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="player-name">${u.name}</span>
          </div>
          <div class="player-sub">${wins} побед из ${total} игр</div>
        </div>
        <div class="player-winrate">
          <div class="winrate-num" style="color:${ratingColor(u.rating)}">${u.rating.toFixed(1)}</div>
          <div class="winrate-label">рейтинг</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render: Stats tab ─────────────────────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('stats-content');
  const allSessions = state.sessions;
  if (!allSessions.length) {
    el.innerHTML = emptyState('📊', 'Нет данных для статистики');
    return;
  }

  // Уничтожаем старые графики
  statsChartInstances.forEach(c => c.destroy());
  statsChartInstances = [];

  el.innerHTML = `
    <div class="section">
      <div class="section-header"><div class="section-title-row"><span class="section-icon">📈</span><span class="section-title">Рейтинги по времени</span></div></div>
      <div class="chart-card"><canvas id="chart-elo"></canvas></div>
    </div>
    <div class="section">
      <div class="section-header"><div class="section-title-row"><span class="section-icon">🏓</span><span class="section-title">Активность по месяцам</span></div></div>
      <div class="chart-card"><canvas id="chart-activity"></canvas></div>
    </div>
    <div class="section">
      <div class="section-header"><div class="section-title-row"><span class="section-icon">⚔️</span><span class="section-title">Победы по игрокам</span></div></div>
      <div class="chart-card"><canvas id="chart-wins"></canvas></div>
    </div>
  `;

  buildEloChart();
  buildActivityChart();
  buildWinsChart();
}

function buildEloChart() {
  const ELO_START = 5.0, ELO_K = 0.5, ELO_D = 3.0;
  function expected(a, b) { return 1 / (1 + Math.pow(10, (b - a) / ELO_D)); }

  const sorted = [...state.sessions].sort((a, b) => a.played_at.localeCompare(b.played_at));
  const ratings = {};
  state.users.forEach(u => { ratings[u.id] = ELO_START; });

  // labels = дата каждой игры, series per player
  const labels = [];
  const series = {};
  state.users.forEach(u => { series[u.id] = [ELO_START]; });

  for (const s of sorted) {
    const r1 = ratings[s.user1_id] ?? ELO_START;
    const r2 = ratings[s.user2_id] ?? ELO_START;
    const win1 = s.score1 > s.score2 ? 1 : s.score1 < s.score2 ? 0 : 0.5;
    const nr1 = Math.min(10, Math.max(1, Math.round((r1 + ELO_K * (win1 - expected(r1, r2))) * 100) / 100));
    const nr2 = Math.min(10, Math.max(1, Math.round((r2 + ELO_K * ((1 - win1) - expected(r2, r1))) * 100) / 100));
    ratings[s.user1_id] = nr1;
    ratings[s.user2_id] = nr2;
    labels.push(s.played_at.slice(0, 10));
    state.users.forEach(u => {
      series[u.id].push(ratings[u.id] ?? ELO_START);
    });
  }

  const colors = ['#60a5fa', '#4ade80', '#f472b6', '#fbbf24', '#a78bfa'];
  const datasets = state.users.map((u, i) => ({
    label: u.name,
    data: series[u.id],
    borderColor: colors[i % colors.length],
    backgroundColor: colors[i % colors.length] + '22',
    tension: 0.3,
    pointRadius: 4,
    fill: false,
  }));

  const ctx = document.getElementById('chart-elo').getContext('2d');
  statsChartInstances.push(new Chart(ctx, {
    type: 'line',
    data: { labels: ['Старт', ...labels], datasets },
    options: chartOptions('Рейтинг', { min: 1, max: 10 }),
  }));
}

function buildActivityChart() {
  const months = {};
  for (const s of state.sessions) {
    const m = s.played_at.slice(0, 7);
    months[m] = (months[m] || 0) + 1;
  }
  const sorted = Object.keys(months).sort();
  const ctx = document.getElementById('chart-activity').getContext('2d');
  statsChartInstances.push(new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted,
      datasets: [{
        label: 'Игр',
        data: sorted.map(m => months[m]),
        backgroundColor: '#60a5fa88',
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: chartOptions('Игр'),
  }));
}

function buildWinsChart() {
  const sorted = [...state.users].sort((a, b) => b.rating - a.rating);
  const colors = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa'];
  const ctx = document.getElementById('chart-wins').getContext('2d');
  statsChartInstances.push(new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(u => u.name),
      datasets: [{
        label: 'Победы',
        data: sorted.map(u => playerStats(u.id).wins),
        backgroundColor: sorted.map((_, i) => colors[i % colors.length] + 'aa'),
        borderColor: sorted.map((_, i) => colors[i % colors.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: chartOptions('Побед'),
  }));
}

function chartOptions(yLabel, yExtra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#e2e8f0', font: { family: 'Inter', size: 12 } } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#ffffff10' } },
      y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#ffffff10' }, title: { display: false }, ...yExtra },
    },
  };
}

// ── Render: Add form ──────────────────────────────────────────────────────────
let _selectedOpponentId = null;

function renderAddForm() {
  _selectedOpponentId = null;
  document.getElementById('add-opponent').value = '';
  const disp = document.getElementById('opponent-display');
  disp.textContent = 'Выбери соперника...';
  disp.className   = 'custom-select-placeholder';

  const me = myUser();
  document.getElementById('score-label-me').textContent  = me?.name || 'Я';
  document.getElementById('score-label-opp').textContent = 'Соперник';
  renderOpponentList('');
}

function renderOpponentList(query) {
  const list = document.getElementById('opponent-list');
  const me   = myUser();
  const q    = query.toLowerCase().trim();
  const others = state.users.filter(u => u.id !== me?.id);
  const filtered = others.filter(u => u.name.toLowerCase().includes(q));

  if (!filtered.length) { list.innerHTML = `<div class="custom-select-empty">Не найдено</div>`; return; }

  list.innerHTML = filtered.map(u => `
    <div class="custom-select-option ${u.id === _selectedOpponentId ? 'active' : ''}"
         onclick="selectOpponent(${u.id}, '${u.name.replace(/'/g, "\\'")}')">
      <div class="select-opt-avatar">${initials(u.name)}</div>
      <div class="select-opt-info">
        <span class="select-opt-name">${u.name}</span>
        <span class="select-opt-pid" style="color:${ratingColor(u.rating)}">${u.rating.toFixed(1)}</span>
      </div>
    </div>
  `).join('');
}

function filterOpponents(query) { renderOpponentList(query); }

function toggleSelect() {
  const wrap = document.getElementById('opponent-select');
  if (wrap.classList.contains('open')) { closeSelect(); return; }
  wrap.classList.add('open');
  document.getElementById('opponent-search').value = '';
  renderOpponentList('');
  setTimeout(() => document.getElementById('opponent-search').focus(), 50);
}
function closeSelect() { document.getElementById('opponent-select').classList.remove('open'); }

function selectOpponent(id, name) {
  _selectedOpponentId = id;
  document.getElementById('add-opponent').value = id;
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
function openPlayerProfile(userId) {
  const me = myUser();
  if (me && userId === me.id) { openMyProfile(); return; }

  const u = state.users.find(p => p.id === userId);
  if (!u) return;

  const { total, wins } = playerStats(userId);
  const wr = total ? Math.round(wins / total * 100) : 0;

  document.getElementById('player-avatar-lg').textContent = initials(u.name);
  document.getElementById('player-profile-name').textContent   = u.name;
  document.getElementById('player-profile-id').textContent     = '';
  document.getElementById('player-profile-rating').textContent = `Рейтинг: ${u.rating.toFixed(1)}`;
  document.getElementById('player-stat-games').textContent = total || '0';
  document.getElementById('player-stat-wins').textContent  = wins  || '0';
  document.getElementById('player-stat-wr').textContent    = total ? wr + '%' : '—';

  // Соперники + последние игры
  const sessions = state.sessions.filter(s => s.user1_id === userId || s.user2_id === userId);
  const recentHTML = [...sessions]
    .sort((a, b) => b.played_at.localeCompare(a.played_at))
    .slice(0, 10)
    .map(s => gameCardHTMLFromPerspective(s, userId))
    .join('');

  // Разбивка по соперникам
  const opponentMap = new Map();
  for (const s of sessions) {
    const oppId = s.user1_id === userId ? s.user2_id : s.user1_id;
    if (!opponentMap.has(oppId)) opponentMap.set(oppId, { wins: 0, total: 0 });
    const myS = s.user1_id === userId ? s.score1 : s.score2;
    const oppS = s.user1_id === userId ? s.score2 : s.score1;
    opponentMap.get(oppId).total++;
    if (myS > oppS) opponentMap.get(oppId).wins++;
  }
  const oppsHTML = [...opponentMap.entries()].map(([oppId, st]) => {
    const opp = state.users.find(x => x.id === oppId);
    if (!opp) return '';
    const wr2 = st.total ? Math.round(st.wins / st.total * 100) : 0;
    return `
      <div class="player-card" onclick="openH2H(${userId}, ${oppId})">
        <div class="player-avatar">${initials(opp.name)}</div>
        <div class="player-info">
          <div class="player-name-row"><span class="player-name">${opp.name}</span></div>
          <div class="player-sub">${st.wins} побед из ${st.total} игр</div>
        </div>
        <div class="player-winrate">
          <div class="winrate-num">${wr2}%</div>
          <div class="winrate-label">винрейт</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('player-profile-content').innerHTML = `
    ${oppsHTML ? `<div class="section"><div class="section-header"><div class="section-title-row"><span class="section-icon">⚔️</span><span class="section-title">Соперники</span></div></div><div class="card-list">${oppsHTML}</div></div>` : ''}
    ${recentHTML ? `<div class="section"><div class="section-header"><div class="section-title-row"><span class="section-icon">📋</span><span class="section-title">История игр</span></div></div><div class="card-list">${recentHTML}</div></div>` : emptyState('🎱', 'Нет игр')}
  `;

  pushScreen('screen-player');
}

function openMyProfile() {
  const me = myUser();
  if (!me) return;

  const tgName = TG_USER
    ? [TG_USER.first_name, TG_USER.last_name].filter(Boolean).join(' ')
    : me.name;

  const { total, wins } = playerStats(me.id);
  const wr = total ? Math.round(wins / total * 100) : 0;

  const photoEl    = document.getElementById('my-profile-photo');
  const initialsEl = document.getElementById('my-profile-initials');
  initialsEl.textContent = initials(tgName);
  if (TG_USER?.photo_url) {
    photoEl.src = TG_USER.photo_url; photoEl.style.display = 'block'; initialsEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; initialsEl.style.display = 'flex';
  }

  document.getElementById('my-profile-name').textContent   = tgName;
  document.getElementById('my-profile-id').textContent     = '';
  document.getElementById('my-profile-rating').textContent = `Рейтинг: ${me.rating.toFixed(1)}`;
  document.getElementById('my-stat-games').textContent = total || '0';
  document.getElementById('my-stat-wins').textContent  = wins  || '0';
  document.getElementById('my-stat-wr').textContent    = total ? wr + '%' : '—';

  const sessions = mySessions();
  const recentHTML = [...sessions]
    .sort((a, b) => b.played_at.localeCompare(a.played_at))
    .slice(0, 10)
    .map(s => gameCardHTML(s))
    .join('');

  // Соперники
  const opponentMap = new Map();
  for (const s of sessions) {
    const oppId = s.user1_id === me.id ? s.user2_id : s.user1_id;
    if (!opponentMap.has(oppId)) opponentMap.set(oppId, { wins: 0, total: 0 });
    const myS = s.user1_id === me.id ? s.score1 : s.score2;
    const oppS = s.user1_id === me.id ? s.score2 : s.score1;
    opponentMap.get(oppId).total++;
    if (myS > oppS) opponentMap.get(oppId).wins++;
  }
  const oppsHTML = [...opponentMap.entries()].map(([oppId, st]) => {
    const opp = state.users.find(x => x.id === oppId);
    if (!opp) return '';
    const wr2 = st.total ? Math.round(st.wins / st.total * 100) : 0;
    return `
      <div class="player-card" onclick="openH2H(${me.id}, ${oppId})">
        <div class="player-avatar">${initials(opp.name)}</div>
        <div class="player-info">
          <div class="player-name-row"><span class="player-name">${opp.name}</span></div>
          <div class="player-sub">${st.wins} побед из ${st.total} игр</div>
        </div>
        <div class="player-winrate">
          <div class="winrate-num">${wr2}%</div>
          <div class="winrate-label">мой %</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('my-profile-content').innerHTML = `
    ${oppsHTML ? `<div class="section"><div class="section-header"><div class="section-title-row"><span class="section-icon">⚔️</span><span class="section-title">Соперники</span></div></div><div class="card-list">${oppsHTML}</div></div>` : ''}
    ${recentHTML ? `<div class="section"><div class="section-header"><div class="section-title-row"><span class="section-icon">📋</span><span class="section-title">Все игры</span></div></div><div class="card-list">${recentHTML}</div></div>` : ''}
  `;

  pushScreen('screen-myprofile');
}

// ── Head-to-Head ──────────────────────────────────────────────────────────────
function openH2H(id1, id2) {
  const u1 = state.users.find(u => u.id === id1);
  const u2 = state.users.find(u => u.id === id2);
  if (!u1 || !u2) return;

  const sessions = state.sessions
    .filter(s => (s.user1_id === id1 && s.user2_id === id2) || (s.user1_id === id2 && s.user2_id === id1))
    .sort((a, b) => a.played_at.localeCompare(b.played_at));

  let w1 = 0, w2 = 0, draws = 0;
  for (const s of sessions) {
    const s1 = s.user1_id === id1 ? s.score1 : s.score2;
    const s2 = s.user1_id === id1 ? s.score2 : s.score1;
    if (s1 > s2) w1++;
    else if (s2 > s1) w2++;
    else draws++;
  }

  document.getElementById('h2h-av1').textContent  = initials(u1.name);
  document.getElementById('h2h-av2').textContent  = initials(u2.name);
  document.getElementById('h2h-name1').textContent = u1.name;
  document.getElementById('h2h-name2').textContent = u2.name;
  document.getElementById('h2h-w1').textContent    = w1;
  document.getElementById('h2h-w2').textContent    = w2;
  document.getElementById('h2h-total').textContent = sessions.length;
  document.getElementById('h2h-label1').textContent = u1.name.split(' ')[0];
  document.getElementById('h2h-label2').textContent = u2.name.split(' ')[0];

  // История игр
  document.getElementById('h2h-games').innerHTML = sessions.length
    ? [...sessions].reverse().map(s => gameCardHTMLFromPerspective(s, id1)).join('')
    : emptyState('🎱', 'Нет игр между этими игроками');

  // График "ход противостояния" — накопленный баланс побед
  if (h2hChartInstance) { h2hChartInstance.destroy(); h2hChartInstance = null; }

  const labels  = [];
  const balance = [0]; // положительное = u1 впереди
  let cum = 0;
  for (const s of sessions) {
    const s1 = s.user1_id === id1 ? s.score1 : s.score2;
    const s2 = s.user1_id === id1 ? s.score2 : s.score1;
    if (s1 > s2) cum++;
    else if (s2 > s1) cum--;
    labels.push(s.played_at.slice(0, 10));
    balance.push(cum);
  }

  const ctx = document.getElementById('h2h-chart').getContext('2d');
  h2hChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Старт', ...labels],
      datasets: [{
        label: `Преимущество ${u1.name}`,
        data: balance,
        borderColor: '#60a5fa',
        backgroundColor: ctx => {
          const v = ctx.raw;
          return v >= 0 ? '#60a5fa22' : '#f8717122';
        },
        fill: { target: { value: 0 }, above: '#60a5fa22', below: '#f8717122' },
        tension: 0.2,
        pointRadius: 5,
        pointBackgroundColor: balance.map(v => v > 0 ? '#60a5fa' : v < 0 ? '#f87171' : '#94a3b8'),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (v > 0)  return `${u1.name} ведёт +${v}`;
              if (v < 0)  return `${u2.name} ведёт +${Math.abs(v)}`;
              return 'Равный счёт';
            },
          },
        },
        annotation: {
          annotations: {
            zero: { type: 'line', yMin: 0, yMax: 0, borderColor: '#ffffff30', borderWidth: 1, borderDash: [4, 4] },
          },
        },
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#ffffff10' } },
        y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: '#ffffff10' } },
      },
    },
  });

  pushScreen('screen-h2h');
}

// ── Game cards ────────────────────────────────────────────────────────────────
function gameCardHTML(session) {
  const me = myUser();
  if (!me) return '';
  return gameCardHTMLFromPerspective(session, me.id);
}

function gameCardHTMLFromPerspective(session, userId) {
  const myS   = session.user1_id === userId ? session.score1 : session.score2;
  const oppS  = session.user1_id === userId ? session.score2 : session.score1;
  const myName  = session.user1_id === userId ? session.name1 : session.name2;
  const oppName = session.user1_id === userId ? session.name2 : session.name1;
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
        <div class="game-player">${myName || '?'}</div>
        <div class="game-score">
          <span class="${iWon ? 'score-win' : 'score-lose'}">${myS}</span>
          <span style="color:var(--text-secondary)">:</span>
          <span class="${!iWon ? 'score-win' : 'score-lose'}">${oppS}</span>
        </div>
        <div class="game-player right">${oppName || '?'}</div>
      </div>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div>${text}</div>`;
}

// ── Game detail ───────────────────────────────────────────────────────────────
function openGameDetail(sessionId) {
  const me = myUser();
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const userId = me?.id ?? session.user1_id;
  const myS    = session.user1_id === userId ? session.score1 : session.score2;
  const oppS   = session.user1_id === userId ? session.score2 : session.score1;
  const myName  = session.user1_id === userId ? session.name1 : session.name2;
  const oppName = session.user1_id === userId ? session.name2 : session.name1;
  const iWon = myS > oppS, isDraw = myS === oppS;

  const header = document.getElementById('game-detail-header');
  header.className = 'game-detail-header ' + (isDraw ? 'draw' : iWon ? 'win' : 'lose');

  document.getElementById('game-detail-result').textContent =
    isDraw ? 'Ничья' : iWon ? '🏆 Победа' : 'Поражение';
  document.getElementById('game-detail-date').textContent =
    new Date(session.played_at).toLocaleDateString('ru', {
      day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
    });

  const s1c = iWon ? 'ds-win' : isDraw ? '' : 'ds-lose';
  const s2c = !iWon ? 'ds-win' : isDraw ? '' : 'ds-lose';
  document.getElementById('game-detail-score').innerHTML =
    `<span class="${s1c}">${myS}</span><span class="ds-sep">:</span><span class="${s2c}">${oppS}</span>`;

  document.getElementById('game-detail-av1').textContent = initials(myName  || '?');
  document.getElementById('game-detail-n1').textContent  = myName  || '?';
  document.getElementById('game-detail-av2').textContent = initials(oppName || '?');
  document.getElementById('game-detail-n2').textContent  = oppName || '?';
  document.getElementById('game-detail-av1').className =
    'game-detail-avatar' + (iWon ? ' winner' : isDraw ? '' : ' loser');
  document.getElementById('game-detail-av2').className =
    'game-detail-avatar' + (!iWon ? ' winner' : isDraw ? '' : ' loser');

  pushScreen('screen-game');
}

// ── Submit game ───────────────────────────────────────────────────────────────
async function submitGame() {
  const oppId    = parseInt(document.getElementById('add-opponent').value);
  const scoreMe  = parseInt(document.getElementById('add-score-me').value);
  const scoreOpp = parseInt(document.getElementById('add-score-opp').value);
  const date     = document.getElementById('add-date').value;

  if (!oppId)                             return showToast('Выбери соперника');
  if (isNaN(scoreMe) || isNaN(scoreOpp)) return showToast('Введи счёт');
  if (!date)                              return showToast('Укажи дату');

  try {
    const result = await apiFetch('/session', {
      method: 'POST',
      body: JSON.stringify({ opponent_id: oppId, score_me: scoreMe, score_opp: scoreOpp, played_at: date }),
    });

    // Обновить рейтинги в стейте
    const me = myUser();
    if (me)  me.rating = result.my_rating;
    const opp = state.users.find(u => u.id === oppId);
    if (opp) opp.rating = result.opp_rating;

    // Добавить сессию в стейт
    if (result.session) state.sessions.push(result.session);

    showToast('✅ Игра записана!');
    document.getElementById('add-score-me').value  = '';
    document.getElementById('add-score-opp').value = '';
    document.getElementById('add-date').value = todayISO();
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
function renderAll() {
  renderHome();
  renderPlayers();
  renderAddForm();
}

boot();
