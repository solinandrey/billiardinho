import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, computeNewRatings, ELO_START } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serve React build output; fall back to legacy webapp if dist not present
const DIST_DIR  = path.join(__dirname, '../webapp-react/dist');
const WEBAPP_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : path.join(__dirname, '../webapp');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function resolveUid(req) {
  const initData = req.headers['x-init-data'];
  if (initData) {
    try {
      const user = JSON.parse(new URLSearchParams(initData).get('user'));
      if (user?.id) return user.id;
    } catch { /* ignore */ }
  }
  const fromHeader = parseInt(req.headers['x-user-id']) || 0;
  if (fromHeader) return fromHeader;
  return process.env.DEV_USER_ID ? parseInt(process.env.DEV_USER_ID) : 0;
}

export function startApiServer(port = process.env.PORT || process.env.API_PORT || 3000) {
  const server = http.createServer((req, res) => {
    const url      = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-Init-Data');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (pathname.startsWith('/api')) {
      handleApi(req, res, url, pathname.slice(4) || '/');
      return;
    }

    let filePath = path.join(WEBAPP_DIR, pathname === '/' ? 'index.html' : pathname);
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(WEBAPP_DIR)) { res.writeHead(403); res.end(); return; }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(WEBAPP_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(d2);
        });
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(port, () => console.log(`Mini App server: http://localhost:${port}`));
}

// ─── API handler ──────────────────────────────────────────────────────────────
function handleApi(req, res, url, apiPath) {
  const uid = resolveUid(req);

  const json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const err = (msg, status = 400) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
  };
  const body = () => new Promise(resolve => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  });

  // GET /api/me — данные текущего пользователя
  if (apiPath === '/me' && req.method === 'GET') {
    const user     = uid ? db.getUserByUid(uid) : null;
    const users    = db.getAllUsers();
    const sessions = db.getAllSessionsWithUsers();
    return json({ user, users, sessions });
  }

  // GET /api/players — все игроки с рейтингами
  if (apiPath === '/players' && req.method === 'GET') {
    const users = db.getAllUsers();
    return json({ users });
  }

  // GET /api/h2h/:id1/:id2 — матч-ап двух игроков
  const h2hMatch = apiPath.match(/^\/h2h\/(\d+)\/(\d+)$/);
  if (h2hMatch && req.method === 'GET') {
    const [, id1, id2] = h2hMatch.map(Number);
    const sessions = db.getH2HSessions(id1, id2);
    const u1 = db.getUserById(id1);
    const u2 = db.getUserById(id2);
    if (!u1 || !u2) return err('user not found', 404);
    return json({ user1: u1, user2: u2, sessions });
  }

  // POST /api/session — записать игру
  if (apiPath === '/session' && req.method === 'POST') {
    body().then(b => {
      const { opponent_id, score_me, score_opp, played_at } = b;
      if (!uid)          return err('unauthorized', 401);
      if (!opponent_id)  return err('opponent_id required');
      if (score_me == null || score_opp == null) return err('scores required');

      const me  = db.getUserByUid(uid);
      const opp = db.getUserById(opponent_id);
      if (!me || !opp) return err('user not found', 404);

      // Count games BEFORE inserting (determines provisional K-factor)
      const meGames  = db.countGamesForUser(me.id);
      const oppGames = db.countGamesForUser(opp.id);

      const session = db.insertSessionForUsers(
        me.id, opp.id,
        score_me, score_opp,
        played_at || new Date().toISOString()
      );

      const { newR1, newR2 } = computeNewRatings(me.rating, opp.rating, score_me, score_opp, meGames, oppGames);
      db.updateUserRatings(me.id, newR1, opp.id, newR2);

      json({ session, my_rating: newR1, opp_rating: newR2 });
    });
    return;
  }

  // PATCH /api/session/:id — edit a session's score
  const sessionEditMatch = apiPath.match(/^\/session\/(\d+)$/);
  if (sessionEditMatch && req.method === 'PATCH') {
    body().then(b => {
      const sessionId = parseInt(sessionEditMatch[1]);
      const { s1, s2 } = b;
      if (s1 == null || s2 == null) return err('s1 and s2 required');
      db.db.prepare('UPDATE sessions SET score1 = ?, score2 = ? WHERE id = ?').run(s1, s2, sessionId);
      json({ ok: true });
    });
    return;
  }

  // DELETE /api/session/:id — delete a session
  if (sessionEditMatch && req.method === 'DELETE') {
    const sessionId = parseInt(sessionEditMatch[1]);
    db.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return json({ ok: true });
  }

  // PATCH /api/me/settings — update user display settings
  if (apiPath === '/me/settings' && req.method === 'PATCH') {
    body().then(b => {
      const { uid: bodyUid, name, short, color } = b;
      const resolvedUid = bodyUid || uid;
      if (!resolvedUid) return err('uid required', 401);
      const user = db.getUserByUid(resolvedUid);
      if (!user) return err('user not found', 404);
      if (name)  db.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
      if (color) db.db.prepare('UPDATE users SET color = ? WHERE id = ?').run(color, user.id);
      json({ ok: true });
    });
    return;
  }

  // GET /api/export-db — TEMPORARY, remove after use
  if (apiPath === '/export-db' && req.method === 'GET') {
    const dbPath = process.env.DB_PATH || './data/billiard.db';
    const data = fs.readFileSync(dbPath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="billiard.db"',
      'Content-Length': data.length,
    });
    res.end(data);
    return;
  }

  // GET /api/debug
  if (apiPath === '/debug' && req.method === 'GET') {
    const users    = db.getAllUsers();
    const sessions = db.getAllSessionsWithUsers();
    return json({ uid, users_count: users.length, sessions_count: sessions.length, users });
  }

  err('not found', 404);
}
