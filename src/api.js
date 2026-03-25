import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.join(__dirname, '../webapp');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function startApiServer(port = process.env.PORT || process.env.API_PORT || 3000) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

    // ── API routes ────────────────────────────────────────────────────────────
    if (pathname.startsWith('/api')) {
      handleApi(req, res, pathname.slice(4) || '/');
      return;
    }

    // ── Static files ──────────────────────────────────────────────────────────
    let filePath = path.join(WEBAPP_DIR, pathname === '/' ? 'index.html' : pathname);
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(WEBAPP_DIR)) { res.writeHead(403); res.end(); return; }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA fallback
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

  server.listen(port, () => {
    console.log(`Mini App server: http://localhost:${port}`);
  });
}

// ── API handler ───────────────────────────────────────────────────────────────
function handleApi(req, res, path) {
  const uid = parseInt(req.headers['x-user-id']) || 0;

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

  // GET /api/me — all data for current user
  if (path === '/me' && req.method === 'GET') {
    const pairs = db.getAllPairsForUser(uid);
    const pairIds = pairs.map(p => p.id);
    const sessions = pairIds.length ? db.getSessionsForPairs(pairIds) : [];
    const me = uid ? { uid } : null;
    return json({ me, pairs, sessions });
  }

  // POST /api/session — record a game
  if (path === '/session' && req.method === 'POST') {
    body().then(b => {
      const { pair_id, score1, score2, played_at } = b;
      if (!pair_id || score1 == null || score2 == null) return err('missing fields');
      db.insertSession(pair_id, score1, score2, played_at || new Date().toISOString());
      const sessions = db.getSessionsForPairs([pair_id]);
      const session = sessions[sessions.length - 1];
      json({ session });
    });
    return;
  }

  err('not found', 404);
}
