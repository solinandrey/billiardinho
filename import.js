/**
 * import.js — one-time import of historical data into billiard.db
 *
 * BEFORE RUNNING:
 *   1. Fill in YOUR_TELEGRAM_ID (get it from @userinfobot in Telegram)
 *   2. Fill in PARTNER_USERNAME (e.g. "@alexey") — OR PARTNER_TELEGRAM_ID if no username
 *   3. node import.js
 *
 * Historical data is ONLY inserted into your pair — other users start fresh.
 * Safe to run multiple times — skips duplicate dates.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data/billiard.db");

// ─── FILL THESE IN ────────────────────────────────────────────────────────────
const YOUR_TELEGRAM_ID    = 71229105;           // ← твой числовой ID (от @userinfobot)
const PARTNER_USERNAME    = "@al_lap";   // ← @username соперника (или оставь "")
const PARTNER_TELEGRAM_ID = 0;           // ← числовой ID соперника (если нет username)
const YOUR_NAME           = "Андрей";
const PARTNER_NAME        = "Алексей";
// ─────────────────────────────────────────────────────────────────────────────

if (!YOUR_TELEGRAM_ID) {
  console.error("❌ Заполни YOUR_TELEGRAM_ID в файле import.js");
  process.exit(1);
}
if (!PARTNER_USERNAME && !PARTNER_TELEGRAM_ID) {
  console.error("❌ Заполни PARTNER_USERNAME или PARTNER_TELEGRAM_ID");
  process.exit(1);
}

// score1 = Андрей (uid1), score2 = Алексей (uid2)
const HISTORICAL = [
  ["2025-02-09", 11,  7],
  ["2025-09-11",  9, 11],
  ["2025-09-18", 10,  8],
  ["2025-09-21",  9, 10],
  ["2026-01-05",  5,  5],
  ["2026-01-12",  3,  2],
  ["2026-02-08",  3,  1],
  ["2026-02-12", 11, 12],
  ["2026-02-18",  5,  6],
  ["2026-02-20",  9,  4],
  ["2026-02-25",  8,  2],
  ["2026-03-12", 13,  2],
  ["2026-03-14",  5,  6],
  ["2026-03-15",  4,  7],
];

const db = new Database(DB_PATH);

db.exec(`
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
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id   INTEGER NOT NULL REFERENCES pairs(id),
    score1    INTEGER NOT NULL,
    score2    INTEGER NOT NULL,
    played_at TEXT NOT NULL
  );
`);

// Find or create the pair for this specific uid1
let pair = db.prepare("SELECT * FROM pairs WHERE uid1 = ?").get(YOUR_TELEGRAM_ID);

if (!pair) {
  const now = new Date().toISOString();
  const username2 = PARTNER_USERNAME || null;
  const uid2 = PARTNER_TELEGRAM_ID || null;
  db.prepare(`
    INSERT INTO pairs (uid1, uid2, username2, name1, name2, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(YOUR_TELEGRAM_ID, uid2, username2, YOUR_NAME, PARTNER_NAME, now);
  pair = db.prepare("SELECT * FROM pairs WHERE uid1 = ?").get(YOUR_TELEGRAM_ID);
  console.log(`✅ Пара создана: ${YOUR_NAME} & ${PARTNER_NAME}`);
} else {
  if (!pair.name2) {
    db.prepare("UPDATE pairs SET name2 = ? WHERE id = ?").run(PARTNER_NAME, pair.id);
    pair = db.prepare("SELECT * FROM pairs WHERE id = ?").get(pair.id);
  }
  console.log(`ℹ️  Пара уже есть (id=${pair.id}), добавляю партии...`);
}

const checkStmt = db.prepare(
  "SELECT id FROM sessions WHERE pair_id = ? AND played_at >= ? AND played_at < ?"
);
const insertStmt = db.prepare(
  "INSERT INTO sessions (pair_id, score1, score2, played_at) VALUES (?, ?, ?, ?)"
);

let inserted = 0, skipped = 0;

for (const [date, s1, s2] of HISTORICAL) {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;
  if (checkStmt.get(pair.id, dayStart, dayEnd)) {
    console.log(`⏭  Пропущено: ${date} ${s1}:${s2}`);
    skipped++;
  } else {
    insertStmt.run(pair.id, s1, s2, `${date}T12:00:00.000Z`);
    const w = s1 > s2 ? YOUR_NAME : s2 > s1 ? PARTNER_NAME : "ничья";
    console.log(`✅ ${date}  ${YOUR_NAME} ${s1}:${s2} ${PARTNER_NAME}  → ${w}`);
    inserted++;
  }
}

console.log(`\n🎱 Готово! Добавлено: ${inserted}, пропущено: ${skipped}`);
db.close();
