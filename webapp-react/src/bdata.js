// Mock data — mirrors the real API shape
// Used for local development when the bot server isn't running

const players = [
  { id: 'a', name: 'Андрей',  short: 'А',  color: '#E8542A', elo: 7.8, games: 58, wins: 34 },
  { id: 'l', name: 'Алексей', short: 'Ал', color: '#4F7FE8', elo: 6.4, games: 61, wins: 29 },
  { id: 'm', name: 'Михаил',  short: 'М',  color: '#2ECC7A', elo: 5.9, games: 47, wins: 22 },
  { id: 'd', name: 'Дмитрий', short: 'Д',  color: '#A855F7', elo: 4.7, games: 39, wins: 15 },
  { id: 's', name: 'Сергей',  short: 'С',  color: '#E5A83A', elo: 3.8, games: 28, wins:  9 },
];

const games = [
  { id: 'g1',  p1: 'a', p2: 'l', s1: 9, s2: 7, date: '2026-04-21' },
  { id: 'g2',  p1: 'm', p2: 'd', s1: 8, s2: 6, date: '2026-04-19' },
  { id: 'g3',  p1: 'a', p2: 'm', s1: 5, s2: 8, date: '2026-04-17' },
  { id: 'g4',  p1: 'l', p2: 's', s1: 9, s2: 3, date: '2026-04-15' },
  { id: 'g5',  p1: 'a', p2: 'd', s1: 9, s2: 5, date: '2026-04-12' },
  { id: 'g6',  p1: 'l', p2: 'm', s1: 6, s2: 9, date: '2026-04-10' },
  { id: 'g7',  p1: 'a', p2: 'l', s1: 8, s2: 6, date: '2026-04-08' },
  { id: 'g8',  p1: 'm', p2: 's', s1: 7, s2: 4, date: '2026-04-05' },
  { id: 'g9',  p1: 'a', p2: 'l', s1: 5, s2: 9, date: '2026-04-03' },
  { id: 'g10', p1: 'd', p2: 's', s1: 9, s2: 8, date: '2026-04-01' },
  { id: 'g11', p1: 'a', p2: 'm', s1: 9, s2: 2, date: '2026-03-29' },
  { id: 'g12', p1: 'l', p2: 'd', s1: 9, s2: 6, date: '2026-03-26' },
  { id: 'g13', p1: 'a', p2: 'l', s1: 7, s2: 9, date: '2026-03-23' },
  { id: 'g14', p1: 'm', p2: 'd', s1: 9, s2: 5, date: '2026-03-20' },
  { id: 'g15', p1: 'a', p2: 's', s1: 9, s2: 1, date: '2026-03-18' },
  { id: 'g16', p1: 'a', p2: 'l', s1: 9, s2: 8, date: '2026-03-15' },
  { id: 'g17', p1: 'l', p2: 'm', s1: 9, s2: 7, date: '2026-03-12' },
  { id: 'g18', p1: 'a', p2: 'l', s1: 9, s2: 9, date: '2026-03-10', draw: true },
  { id: 'g19', p1: 'd', p2: 'm', s1: 4, s2: 9, date: '2026-03-07' },
  { id: 'g20', p1: 'a', p2: 'l', s1: 9, s2: 6, date: '2026-03-04' },
];

const months = ['Ноя', 'Дек', 'Янв', 'Фев', 'Мар', 'Апр'];
const eloSeries = {
  a: [6.2, 6.6, 7.0, 7.3, 7.5, 7.8],
  l: [7.1, 6.9, 6.7, 6.5, 6.5, 6.4],
  m: [4.8, 5.0, 5.3, 5.5, 5.8, 5.9],
  d: [5.6, 5.3, 5.0, 4.8, 4.7, 4.7],
  s: [4.2, 4.0, 3.9, 3.8, 3.9, 3.8],
};
const activity = [12, 18, 22, 14, 26, 19];

const byId = Object.fromEntries(players.map(p => [p.id, p]));
const me = 'a';

const winnerOf = (g) => {
  if (g.draw || g.s1 === g.s2) return null;
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
  games.filter(g => g.p1 === id || g.p2 === id).slice(0, n);

const rivalsOf = (id) => {
  const opps = players.filter(p => p.id !== id);
  return opps.map(o => {
    const { xw, yw, d } = recordBetween(id, o.id);
    const total = xw + yw + d;
    return { opp: o, w: xw, l: yw, d, total, pct: total ? Math.round(xw * 100 / total) : 0 };
  }).sort((a, b) => b.total - a.total);
};

const leadSeries = (x, y) => {
  const list = gamesBetween(x, y).slice().reverse();
  let lead = 0;
  const pts = [{ lead: 0, date: null }];
  for (const g of list) {
    const w = winnerOf(g);
    if (w === x) lead++;
    else if (w === y) lead--;
    pts.push({ lead, date: g.date, w });
  }
  return pts;
};

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const mo = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'][m - 1];
  return `${d} ${mo} ${y}`;
};

const relativeDate = (iso) => {
  const today = new Date();
  const d = new Date(iso);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return formatDate(iso);
};

export const BData = {
  players, games, months, eloSeries, activity,
  byId, me,
  winnerOf, gamesBetween, recordBetween, recentGamesOf, rivalsOf, leadSeries, formatDate, relativeDate,
};
