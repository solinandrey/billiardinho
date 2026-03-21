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
      CREATE TABLE IF NOT EXISTS sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        score1     INTEGER NOT NULL,
        score2     INTEGER NOT NULL,
        played_at  TEXT    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  // ─── Player names ────────────────────────────────────────────────────────────

  getPlayers() {
    const p1 = this.db.prepare("SELECT value FROM settings WHERE key = 'player1'").get();
    const p2 = this.db.prepare("SELECT value FROM settings WHERE key = 'player2'").get();
    return {
      player1: p1?.value || null,
      player2: p2?.value || null,
    };
  }

  setPlayers(player1, player2) {
    const upsert = this.db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    upsert.run("player1", player1);
    upsert.run("player2", player2);
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  insertSession(score1, score2, played_at) {
    return this.db
      .prepare("INSERT INTO sessions (score1, score2, played_at) VALUES (?, ?, ?)")
      .run(score1, score2, played_at);
  }

  getAllSessions() {
    return this.db
      .prepare("SELECT * FROM sessions ORDER BY played_at ASC")
      .all();
  }

  getLastSessions(limit = 10) {
    return this.db
      .prepare("SELECT * FROM sessions ORDER BY played_at DESC LIMIT ?")
      .all(limit);
  }

  getSessionsByMonth(year, month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const toDate = new Date(year, month, 1);
    const to = toDate.toISOString().slice(0, 10);
    return this.db
      .prepare("SELECT * FROM sessions WHERE played_at >= ? AND played_at < ? ORDER BY played_at ASC")
      .all(from, to);
  }

  getSessionsByPeriod(from, to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    return this.db
      .prepare("SELECT * FROM sessions WHERE played_at >= ? AND played_at < ? ORDER BY played_at ASC")
      .all(from, toDate.toISOString());
  }

  deleteLastSession() {
    const last = this.db
      .prepare("SELECT * FROM sessions ORDER BY id DESC LIMIT 1")
      .get();
    if (!last) return null;
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(last.id);
    return last;
  }
}

export const db = new BilliardDB();
