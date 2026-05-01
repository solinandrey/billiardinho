import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/billiard.db");

// ─── Elo helpers (шкала 1.0 – 10.0) ──────────────────────────────────────────
// Плавная K-кривая: чем выше рейтинг, тем медленнее растёт.
// Провизионный период: первые 5 игр — в 5× быстрее.
// Множитель маржи: log-кривая по разнице счёта.
export const ELO_START          = 3.0;
const ELO_K_BASE                = 0.20;   // K для новичка на рейтинге ~1.0
const ELO_K_FLOOR_RATIO         = 0.25;   // минимум 25% от базы (на топе шкалы)
const ELO_K_PROVISIONAL         = 1.0;    // первые 5 игр
const ELO_PROVISIONAL_GAMES     = 5;
const ELO_D                     = 3.0;    // разница 3.0 → ~90% шанс

function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / ELO_D));
}

// Плавный K: 0.20 на r=3, 0.10 на r≈5, 0.05 на r≥8.25 (флор)
function kForRating(r) {
  return ELO_K_BASE * Math.max(ELO_K_FLOOR_RATIO, (10 - r) / 7);
}

// Множитель разницы в счёте: log-кривая, ничья = 1.0
function marginMultiplier(score1, score2) {
  const m = Math.abs(score1 - score2);
  if (m <= 1) return 1.0;
  return 1 + Math.log(m) * 0.3;
}

/**
 * @param {number} r1, r2          — текущие рейтинги
 * @param {number} score1, score2  — счёт партии
 * @param {number} games1, games2  — сколько игр сыграно ДО этой партии
 * @returns {{ newR1, newR2, d1, d2 }} новые рейтинги и дельты (округлённые)
 */
export function computeNewRatings(r1, r2, score1, score2, games1 = 999, games2 = 999) {
  const s1 = score1 > score2 ? 1 : score1 < score2 ? 0 : 0.5;
  const s2 = 1 - s1;
  const mMult = marginMultiplier(score1, score2);
  const k1 = (games1 < ELO_PROVISIONAL_GAMES ? ELO_K_PROVISIONAL : kForRating(r1)) * mMult;
  const k2 = (games2 < ELO_PROVISIONAL_GAMES ? ELO_K_PROVISIONAL : kForRating(r2)) * mMult;
  const clamp = v => Math.round(Math.min(10, Math.max(1, v)) * 100) / 100;
  const newR1 = clamp(r1 + k1 * (s1 - expectedScore(r1, r2)));
  const newR2 = clamp(r2 + k2 * (s2 - expectedScore(r2, r1)));
  return {
    newR1, newR2,
    d1: Math.round((newR1 - r1) * 100) / 100,
    d2: Math.round((newR2 - r2) * 100) / 100,
  };
}

class BilliardDB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pairs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        uid1         INTEGER NOT NULL,
        uid2         INTEGER,
        username2    TEXT,
        name1        TEXT NOT NULL,
        name2        TEXT,
        created_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        pair_id    INTEGER REFERENCES pairs(id),
        score1     INTEGER NOT NULL,
        score2     INTEGER NOT NULL,
        played_at  TEXT NOT NULL,
        user1_id   INTEGER REFERENCES users(id),
        user2_id   INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        uid        INTEGER UNIQUE,
        username   TEXT,
        name       TEXT NOT NULL,
        rating     REAL NOT NULL DEFAULT ${ELO_START},
        created_at TEXT NOT NULL
      );
    `);

    // Доп. колонки рейтинга до/после — добавляем, если нет (идемпотентно)
    const cols = this.db.pragma("table_info(sessions)");
    const colNames = cols.map(c => c.name);
    for (const col of ["r1_before", "r1_after", "r2_before", "r2_after"]) {
      if (!colNames.includes(col)) {
        this.db.exec(`ALTER TABLE sessions ADD COLUMN ${col} REAL`);
      }
    }

    // Колонки кастомизации профиля у users (color, short) — идемпотентно
    const userCols = this.db.pragma("table_info(users)").map(c => c.name);
    if (!userCols.includes("color")) {
      this.db.exec(`ALTER TABLE users ADD COLUMN color TEXT`);
    }
    if (!userCols.includes("short")) {
      this.db.exec(`ALTER TABLE users ADD COLUMN short TEXT`);
    }

    // Старые БД имеют pair_id INTEGER NOT NULL — это мешает вставке партий
    // без пары. Пересобираем таблицу, если constraint есть.
    const pairIdCol = cols.find(c => c.name === "pair_id");
    if (pairIdCol && pairIdCol.notnull === 1) {
      this.db.exec(`
        BEGIN;
        CREATE TABLE sessions_new (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          pair_id    INTEGER REFERENCES pairs(id),
          score1     INTEGER NOT NULL,
          score2     INTEGER NOT NULL,
          played_at  TEXT NOT NULL,
          user1_id   INTEGER REFERENCES users(id),
          user2_id   INTEGER REFERENCES users(id),
          r1_before  REAL,
          r1_after   REAL,
          r2_before  REAL,
          r2_after   REAL
        );
        INSERT INTO sessions_new
          (id, pair_id, score1, score2, played_at, user1_id, user2_id,
           r1_before, r1_after, r2_before, r2_after)
        SELECT id, pair_id, score1, score2, played_at, user1_id, user2_id,
           r1_before, r1_after, r2_before, r2_after
        FROM sessions;
        DROP TABLE sessions;
        ALTER TABLE sessions_new RENAME TO sessions;
        COMMIT;
      `);
    }
  }

  // ─── Users ───────────────────────────────────────────────────────────────────

  getUserByUid(uid) {
    return this.db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
  }

  getUserByUsername(username) {
    const clean = username.replace(/^@/, "").toLowerCase();
    return this.db.prepare(
      "SELECT * FROM users WHERE LOWER(REPLACE(username,'@','')) = ?"
    ).get(clean);
  }

  getUserById(id) {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  getAllUsers() {
    return this.db.prepare("SELECT * FROM users ORDER BY rating DESC").all();
  }

  /** Регистрация нового пользователя */
  createUser(uid, username, name) {
    const now = new Date().toISOString();
    const res = this.db.prepare(
      "INSERT INTO users (uid, username, name, rating, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(uid, username || null, name, ELO_START, now);
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(res.lastInsertRowid);
  }

  /** Привязать Telegram uid к пользователю (ранее null) */
  linkUserUid(userId, uid) {
    this.db.prepare("UPDATE users SET uid = ? WHERE id = ?").run(uid, userId);
  }

  countGamesForUser(userId) {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM sessions WHERE (user1_id = ? OR user2_id = ?) AND user1_id IS NOT NULL'
    ).get(userId, userId);
    return row?.cnt ?? 0;
  }

  updateUserRatings(user1Id, newR1, user2Id, newR2) {
    this.db.prepare("UPDATE users SET rating = ? WHERE id = ?").run(newR1, user1Id);
    this.db.prepare("UPDATE users SET rating = ? WHERE id = ?").run(newR2, user2Id);
  }

  // ─── Sessions (новый формат) ──────────────────────────────────────────────────

  insertSessionForUsers(user1Id, user2Id, score1, score2, played_at, ratings = null) {
    const r1b = ratings?.r1_before ?? null;
    const r1a = ratings?.r1_after  ?? null;
    const r2b = ratings?.r2_before ?? null;
    const r2a = ratings?.r2_after  ?? null;
    const res = this.db.prepare(`
      INSERT INTO sessions
        (score1, score2, played_at, user1_id, user2_id, r1_before, r1_after, r2_before, r2_after)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(score1, score2, played_at || new Date().toISOString(), user1Id, user2Id, r1b, r1a, r2b, r2a);
    return this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(res.lastInsertRowid);
  }

  /** Все сессии пользователя (user1_id или user2_id) */
  getSessionsForUser(userId) {
    return this.db.prepare(
      "SELECT * FROM sessions WHERE user1_id = ? OR user2_id = ? ORDER BY played_at ASC"
    ).all(userId, userId);
  }

  /** Сессии между двумя конкретными игроками */
  getH2HSessions(user1Id, user2Id) {
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
      ORDER BY played_at ASC
    `).all(user1Id, user2Id, user2Id, user1Id);
  }

  /** Все сессии с player objects для API */
  getAllSessionsWithUsers() {
    return this.db.prepare(`
      SELECT s.*,
        u1.name AS name1, u1.uid AS uid1, u1.rating AS rating1,
        u2.name AS name2, u2.uid AS uid2, u2.rating AS rating2
      FROM sessions s
      JOIN users u1 ON s.user1_id = u1.id
      JOIN users u2 ON s.user2_id = u2.id
      WHERE s.user1_id IS NOT NULL AND s.user2_id IS NOT NULL
      ORDER BY s.played_at ASC
    `).all();
  }

  deleteLastSessionForUser(userId) {
    const last = this.db.prepare(`
      SELECT * FROM sessions
      WHERE user1_id = ? OR user2_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(userId, userId);
    if (!last) return null;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(last.id);
    return last;
  }

  // ─── Legacy: pairs (оставлены для обратной совместимости) ────────────────────

  getPairForUser(uid) {
    return this.db.prepare(`
      SELECT * FROM pairs
      WHERE (uid1 = ? OR uid2 = ?) AND name1 IS NOT NULL AND name2 IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `).get(uid, uid);
  }

  getPairByCreator(uid) {
    return this.db.prepare("SELECT * FROM pairs WHERE uid1 = ? ORDER BY id DESC LIMIT 1").get(uid);
  }

  getPendingPairForPartner(uid, username) {
    let row = this.db.prepare(
      "SELECT * FROM pairs WHERE uid2 = ? AND name2 IS NULL ORDER BY id DESC LIMIT 1"
    ).get(uid);
    if (row) return row;
    if (username) {
      const clean = username.replace(/^@/, "").toLowerCase();
      row = this.db.prepare(`
        SELECT * FROM pairs
        WHERE LOWER(REPLACE(username2, '@', '')) = ? AND uid2 IS NULL
        ORDER BY id DESC LIMIT 1
      `).get(clean);
    }
    return row || null;
  }

  createPair(uid1, name1, partnerInput) {
    const now = new Date().toISOString();
    const isNumeric = /^\d+$/.test(partnerInput);
    if (isNumeric) {
      this.db.prepare(
        "INSERT INTO pairs (uid1, uid2, name1, created_at) VALUES (?, ?, ?, ?)"
      ).run(uid1, parseInt(partnerInput), name1, now);
    } else {
      const username = partnerInput.startsWith("@") ? partnerInput : `@${partnerInput}`;
      this.db.prepare(
        "INSERT INTO pairs (uid1, username2, name1, created_at) VALUES (?, ?, ?, ?)"
      ).run(uid1, username, name1, now);
    }
    return this.db.prepare("SELECT last_insert_rowid() as id").get().id;
  }

  completePair(pairId, uid2, name2) {
    this.db.prepare("UPDATE pairs SET uid2 = ?, name2 = ? WHERE id = ?").run(uid2, name2, pairId);
  }

  getNamesForUser(pair, uid) {
    if (pair.uid1 === uid) return { myName: pair.name1, theirName: pair.name2 };
    return { myName: pair.name2, theirName: pair.name1 };
  }

  getAllPairsForUser(uid) {
    return this.db.prepare(
      "SELECT * FROM pairs WHERE uid1 = ? OR uid2 = ? ORDER BY id DESC"
    ).all(uid, uid);
  }

  getSessionsForPairs(pairIds) {
    const placeholders = pairIds.map(() => "?").join(",");
    return this.db.prepare(
      `SELECT * FROM sessions WHERE pair_id IN (${placeholders}) ORDER BY played_at ASC`
    ).all(...pairIds);
  }

  insertSession(pairId, score1, score2, played_at) {
    return this.db.prepare(
      "INSERT INTO sessions (pair_id, score1, score2, played_at) VALUES (?, ?, ?, ?)"
    ).run(pairId, score1, score2, played_at);
  }

  getAllSessions(pairId) {
    return this.db.prepare(
      "SELECT * FROM sessions WHERE pair_id = ? ORDER BY played_at ASC"
    ).all(pairId);
  }

  getLastSessions(pairId, limit = 10) {
    return this.db.prepare(
      "SELECT * FROM sessions WHERE pair_id = ? ORDER BY played_at DESC LIMIT ?"
    ).all(pairId, limit);
  }

  getSessionsByMonth(pairId, year, month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const toDate = new Date(year, month, 1);
    const to = toDate.toISOString().slice(0, 10);
    return this.db.prepare(
      "SELECT * FROM sessions WHERE pair_id = ? AND played_at >= ? AND played_at < ? ORDER BY played_at ASC"
    ).all(pairId, from, to);
  }

  getSessionsByPeriod(pairId, from, to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    return this.db.prepare(
      "SELECT * FROM sessions WHERE pair_id = ? AND played_at >= ? AND played_at < ? ORDER BY played_at ASC"
    ).all(pairId, from, toDate.toISOString());
  }

  deleteLastSession(pairId) {
    const last = this.db.prepare(
      "SELECT * FROM sessions WHERE pair_id = ? ORDER BY id DESC LIMIT 1"
    ).get(pairId);
    if (!last) return null;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(last.id);
    return last;
  }
}

export const db = new BilliardDB();
