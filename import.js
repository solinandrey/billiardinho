/**
 * import.js — one-time import of Excel data into billiard.db
 *
 * Usage:
 *   node import.js                        # uses default DB path
 *   DB_PATH=./data/billiard.db node import.js
 *
 * Run ONCE before starting the bot. Safe to run again — skips duplicates by date.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data/billiard.db");

// ─── Historical data from Excel ───────────────────────────────────────────────
// Format: [YYYY-MM-DD, score_andrey, score_alexey]
const HISTORICAL = [
  ["2025-02-09", 11, 7],
  ["2025-09-11",  9, 11],
  ["2025-09-18", 10, 8],
  ["2025-09-21",  9, 10],
  ["2026-01-05",  5, 5],
  ["2026-01-12",  3, 2],
  ["2026-02-08",  3, 1],
  ["2026-02-12", 11, 12],
  ["2026-02-18",  5, 6],
  ["2026-02-20",  9, 4],
  ["2026-02-25",  8, 2],
  ["2026-03-12", 13, 2],
  ["2026-03-14",  5, 6],
  ["2026-03-15",  4, 7],
];

// ─── Players ──────────────────────────────────────────────────────────────────
const PLAYER1 = "Андрей";
const PLAYER2 = "Алексей";

// ─── Run import ───────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
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

// Set player names
const upsert = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);
upsert.run("player1", PLAYER1);
upsert.run("player2", PLAYER2);
console.log(`✅ Игроки установлены: ${PLAYER1} и ${PLAYER2}`);

// Insert sessions (skip if date already exists)
const checkStmt = db.prepare("SELECT id FROM sessions WHERE played_at >= ? AND played_at < ?");
const insertStmt = db.prepare("INSERT INTO sessions (score1, score2, played_at) VALUES (?, ?, ?)");

let inserted = 0;
let skipped = 0;

for (const [date, s1, s2] of HISTORICAL) {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;
  const existing = checkStmt.get(dayStart, dayEnd);

  if (existing) {
    console.log(`⏭  Пропущено (уже есть): ${date} ${s1}:${s2}`);
    skipped++;
  } else {
    insertStmt.run(s1, s2, `${date}T12:00:00.000Z`);
    const winner = s1 > s2 ? PLAYER1 : s2 > s1 ? PLAYER2 : "ничья";
    console.log(`✅ Добавлено: ${date}  ${PLAYER1} ${s1}:${s2} ${PLAYER2}  → ${winner}`);
    inserted++;
  }
}

console.log(`\n🎱 Готово! Добавлено: ${inserted}, пропущено: ${skipped}`);
db.close();
