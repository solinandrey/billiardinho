import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/billiard.db");

class BilliardDB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pairs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        uid1         INTEGER NOT NULL,   -- numeric Telegram ID of player 1
        uid2         INTEGER,            -- numeric Telegram ID of player 2 (filled when they join)
        username2    TEXT,               -- @username of player 2 (used to match when they join)
        name1        TEXT NOT NULL,      -- display name of player 1
        name2        TEXT,               -- display name of player 2 (filled when they join)
        created_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        pair_id    INTEGER NOT NULL REFERENCES pairs(id),
        score1     INTEGER NOT NULL,
        score2     INTEGER NOT NULL,
        played_at  TEXT NOT NULL
      );
    `);
  }

  // ─── Pair lookup ─────────────────────────────────────────────────────────────

  /**
   * Find a complete pair (both players set up) that this user belongs to.
   */
  getPairForUser(uid) {
    return this.db
      .prepare(`
        SELECT * FROM pairs
        WHERE (uid1 = ? OR uid2 = ?) AND name1 IS NOT NULL AND name2 IS NOT NULL
        ORDER BY id DESC LIMIT 1
      `)
      .get(uid, uid);
  }

  /**
   * Find any pair created by this uid, complete or not.
   * Used on /start so the creator doesn't get asked their name again.
   */
  getPairByCreator(uid) {
    return this.db
      .prepare("SELECT * FROM pairs WHERE uid1 = ? ORDER BY id DESC LIMIT 1")
      .get(uid);
  }

  /**
   * Find a pending pair waiting for this user to join.
   * Matches by numeric uid2 OR by @username.
   */
  getPendingPairForPartner(uid, username) {
    // Try numeric uid2 match first
    let row = this.db
      .prepare("SELECT * FROM pairs WHERE uid2 = ? AND name2 IS NULL ORDER BY id DESC LIMIT 1")
      .get(uid);
    if (row) return row;

    // Try username match (case-insensitive, strip @)
    if (username) {
      const clean = username.replace(/^@/, "").toLowerCase();
      row = this.db
        .prepare(`
          SELECT * FROM pairs
          WHERE LOWER(REPLACE(username2, '@', '')) = ? AND name2 IS NULL
          ORDER BY id DESC LIMIT 1
        `)
        .get(clean);
    }
    return row || null;
  }

  /**
   * Create a new pair. partnerInput can be "@username" or a numeric ID string.
   */
  createPair(uid1, name1, partnerInput) {
    const now = new Date().toISOString();
    const isNumeric = /^\d+$/.test(partnerInput);

    if (isNumeric) {
      this.db
        .prepare("INSERT INTO pairs (uid1, uid2, name1, created_at) VALUES (?, ?, ?, ?)")
        .run(uid1, parseInt(partnerInput), name1, now);
    } else {
      const username = partnerInput.startsWith("@") ? partnerInput : `@${partnerInput}`;
      this.db
        .prepare("INSERT INTO pairs (uid1, username2, name1, created_at) VALUES (?, ?, ?, ?)")
        .run(uid1, username, name1, now);
    }

    return this.db.prepare("SELECT last_insert_rowid() as id").get().id;
  }

  /** Partner joins: fill in their uid and display name */
  completePair(pairId, uid2, name2) {
    this.db
      .prepare("UPDATE pairs SET uid2 = ?, name2 = ? WHERE id = ?")
      .run(uid2, name2, pairId);
  }

  /** Returns { myName, theirName } from the perspective of uid */
  getNamesForUser(pair, uid) {
    if (pair.uid1 === uid) {
      return { myName: pair.name1, theirName: pair.name2 };
    }
    return { myName: pair.name2, theirName: pair.name1 };
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  insertSession(pairId, score1, score2, played_at) {
    return this.db
      .prepare("INSERT INTO sessions (pair_id, score1, score2, played_at) VALUES (?, ?, ?, ?)")
      .run(pairId, score1, score2, played_at);
  }

  getAllSessions(pairId) {
    return this.db
      .prepare("SELECT * FROM sessions WHERE pair_id = ? ORDER BY played_at ASC")
      .all(pairId);
  }

  getLastSessions(pairId, limit = 10) {
    return this.db
      .prepare("SELECT * FROM sessions WHERE pair_id = ? ORDER BY played_at DESC LIMIT ?")
      .all(pairId, limit);
  }

  getSessionsByMonth(pairId, year, month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const toDate = new Date(year, month, 1);
    const to = toDate.toISOString().slice(0, 10);
    return this.db
      .prepare("SELECT * FROM sessions WHERE pair_id = ? AND played_at >= ? AND played_at < ? ORDER BY played_at ASC")
      .all(pairId, from, to);
  }

  getSessionsByPeriod(pairId, from, to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    return this.db
      .prepare("SELECT * FROM sessions WHERE pair_id = ? AND played_at >= ? AND played_at < ? ORDER BY played_at ASC")
      .all(pairId, from, toDate.toISOString());
  }

  deleteLastSession(pairId) {
    const last = this.db
      .prepare("SELECT * FROM sessions WHERE pair_id = ? ORDER BY id DESC LIMIT 1")
      .get(pairId);
    if (!last) return null;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(last.id);
    return last;
  }
}

export const db = new BilliardDB();
