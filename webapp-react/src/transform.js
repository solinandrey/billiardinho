// Transforms raw API data ({ user, users, sessions }) into the
// BData-compatible format used by React components.

import { PLAYER_COLORS } from './theme.js';

const MONTHS_RU = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

function formatDate(iso) {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return `${d} ${MONTHS_RU[m - 1]} ${y}`;
}

function relativeDate(iso) {
  const today = new Date();
  const d = new Date(iso.split('T')[0]);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return formatDate(iso);
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2);
}

/**
 * Convert raw API response to BData format.
 * @param {{ user: object|null, users: object[], sessions: object[] }} apiData
 * @returns BData-compatible object
 */
export function transformApiData(apiData) {
  const { user: meUser, users: rawUsers, sessions: rawSessions } = apiData;

  // Build players array
  const players = rawUsers.map((u, i) => ({
    id: String(u.id),
    uid: u.uid,
    name: u.name,
    short: u.short || initials(u.name),
    color: u.color || PLAYER_COLORS[(u.id - 1) % PLAYER_COLORS.length],
    elo: u.rating ?? 3.0,
    games: 0,
    wins: 0,
  }));

  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const meId = meUser ? String(meUser.id) : (players[0]?.id ?? '0');

  // Convert sessions to game format (+ Elo before/after for each side)
  const games = rawSessions.map(s => ({
    id: String(s.id),
    p1: String(s.user1_id),
    p2: String(s.user2_id),
    s1: s.score1,
    s2: s.score2,
    date: (s.played_at || '').split('T')[0],
    playedAt: s.played_at,
    r1_before: s.r1_before, r1_after: s.r1_after,
    r2_before: s.r2_before, r2_after: s.r2_after,
    note: s.note || null,
  }));

  // Compute game/win counts
  for (const g of games) {
    const p1 = byId[g.p1];
    const p2 = byId[g.p2];
    if (p1) p1.games++;
    if (p2) p2.games++;
    if (g.s1 > g.s2 && p1) p1.wins++;
    if (g.s2 > g.s1 && p2) p2.wins++;
  }

  // Compute per-month activity (last 6 months)
  const now = new Date();
  const months = [];
  const monthlyActivity = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth()]);
    const yr = d.getFullYear(), mo = d.getMonth() + 1;
    const count = games.filter(g => {
      const [gy, gm] = g.date.split('-').map(Number);
      return gy === yr && gm === mo;
    }).length;
    monthlyActivity.push(count);
  }

  // Compute per-player Elo series over last 6 months (kept for legacy screens)
  const eloSeries = {};
  for (const p of players) {
    eloSeries[p.id] = months.map(() => p.elo);
  }

  // Real per-player rating history: ordered points {date, rating} across all sessions.
  // Sessions in `games` are newest-first; history needs oldest-first.
  const ratingHistoryOf = (playerId) => {
    const points = [];
    const asc = [...games].sort((a, b) => a.date.localeCompare(b.date));
    let seeded = false;
    for (const g of asc) {
      if (g.p1 === playerId && g.r1_after != null) {
        if (!seeded && g.r1_before != null) {
          points.push({ date: g.date, rating: g.r1_before });
          seeded = true;
        }
        points.push({ date: g.date, rating: g.r1_after });
      } else if (g.p2 === playerId && g.r2_after != null) {
        if (!seeded && g.r2_before != null) {
          points.push({ date: g.date, rating: g.r2_before });
          seeded = true;
        }
        points.push({ date: g.date, rating: g.r2_after });
      }
    }
    return points;
  };

  // ─── Helper functions (same as BData) ─────────────────────
  const winnerOf = (g) => {
    if (g.s1 === g.s2) return null;
    return g.s1 > g.s2 ? g.p1 : g.p2;
  };

  const gamesBetween = (x, y) =>
    games.filter(g => (g.p1 === x && g.p2 === y) || (g.p1 === y && g.p2 === x));

  const recordBetween = (x, y) => {
    let xw = 0, yw = 0, d = 0;
    for (const g of gamesBetween(x, y)) {
      const w = winnerOf(g);
      if (w === null) d++;
      else if (w === x) xw++;
      else yw++;
    }
    return { xw, yw, d };
  };

  const recentGamesOf = (id, n = 10) =>
    [...games].reverse().filter(g => g.p1 === id || g.p2 === id).slice(0, n);

  const rivalsOf = (id) => {
    const opps = players.filter(p => p.id !== id);
    return opps.map(o => {
      const { xw, yw, d } = recordBetween(id, o.id);
      const total = xw + yw + d;
      return { opp: o, w: xw, l: yw, d, total, pct: total ? Math.round(xw * 100 / total) : 0 };
    }).sort((a, b) => b.total - a.total);
  };

  // Sort games newest-first for display
  const sortedGames = [...games].sort((a, b) => b.date.localeCompare(a.date));

  return {
    players,
    games: sortedGames,
    months,
    eloSeries,
    activity: monthlyActivity,
    byId,
    me: meId,
    winnerOf,
    gamesBetween,
    recordBetween,
    recentGamesOf,
    rivalsOf,
    ratingHistoryOf,
    formatDate,
    relativeDate,
  };
}
