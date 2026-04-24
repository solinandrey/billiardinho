/**
 * migrate.js — идемпотентная миграция БД
 *
 * Что делает:
 *   1. Создаёт таблицу users (если нет)
 *   2. Добавляет колонки user1_id / user2_id в sessions (если нет)
 *   3. Переносит игроков из pairs → users (uid2 может быть NULL — ок)
 *   4. Проставляет user1_id / user2_id в sessions из pairs
 *   5. Пересчитывает рейтинги 1.0–10.0 по хронологии партий
 *
 * Безопасно запускать повторно — пропускает уже выполненные шаги.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data/billiard.db");
const db = new Database(DB_PATH);

// ─── Elo helpers (шкала 1.0 – 10.0) ──────────────────────────────────────────
// Должно совпадать с src/db.js
const ELO_START          = 3.0;
const ELO_K_BASE         = 0.20;
const ELO_K_FLOOR_RATIO  = 0.25;
const ELO_K_PROVISIONAL  = 1.0;
const ELO_PROVISIONAL_GAMES = 5;
const ELO_D              = 3.0;

function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / ELO_D));
}

function kForRating(r) {
  return ELO_K_BASE * Math.max(ELO_K_FLOOR_RATIO, (10 - r) / 7);
}

function marginMultiplier(score1, score2) {
  const m = Math.abs(score1 - score2);
  if (m <= 1) return 1.0;
  return 1 + Math.log(m) * 0.3;
}

function computeNewRatings(r1, r2, score1, score2, games1 = 999, games2 = 999) {
  const s1 = score1 > score2 ? 1 : score1 < score2 ? 0 : 0.5;
  const s2 = 1 - s1;
  const mMult = marginMultiplier(score1, score2);
  const k1 = (games1 < ELO_PROVISIONAL_GAMES ? ELO_K_PROVISIONAL : kForRating(r1)) * mMult;
  const k2 = (games2 < ELO_PROVISIONAL_GAMES ? ELO_K_PROVISIONAL : kForRating(r2)) * mMult;
  const clamp = v => Math.round(Math.min(10, Math.max(1, v)) * 100) / 100;
  return {
    newR1: clamp(r1 + k1 * (s1 - expectedScore(r1, r2))),
    newR2: clamp(r2 + k2 * (s2 - expectedScore(r2, r1))),
  };
}

// ─── Шаг 1: таблица users ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    uid        INTEGER UNIQUE,          -- Telegram ID (NULL пока не зашли через /start)
    username   TEXT,                    -- @username для матчинга
    name       TEXT NOT NULL,
    rating     REAL NOT NULL DEFAULT 3.0,
    created_at TEXT NOT NULL
  );
`);
console.log("✅ Таблица users готова");

// ─── Шаг 2: колонки user1_id / user2_id в sessions ───────────────────────────
const cols = db.pragma("table_info(sessions)").map(c => c.name);
if (!cols.includes("user1_id")) {
  db.exec("ALTER TABLE sessions ADD COLUMN user1_id INTEGER REFERENCES users(id)");
  console.log("✅ sessions.user1_id добавлен");
}
if (!cols.includes("user2_id")) {
  db.exec("ALTER TABLE sessions ADD COLUMN user2_id INTEGER REFERENCES users(id)");
  console.log("✅ sessions.user2_id добавлен");
}
for (const col of ["r1_before", "r1_after", "r2_before", "r2_after"]) {
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE sessions ADD COLUMN ${col} REAL`);
    console.log(`✅ sessions.${col} добавлен`);
  }
}

// ─── Шаг 3: перенос игроков из pairs → users ─────────────────────────────────
const pairs = db.prepare("SELECT * FROM pairs").all();
const now   = new Date().toISOString();

function upsertUser({ uid, username, name }) {
  // Попытка найти по uid
  if (uid) {
    const existing = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
    if (existing) return existing.id;
  }
  // Попытка найти по username (без учёта регистра и @)
  if (username) {
    const clean = username.replace(/^@/, "").toLowerCase();
    const existing = db.prepare(
      "SELECT * FROM users WHERE LOWER(REPLACE(username,'@','')) = ?"
    ).get(clean);
    if (existing) {
      // Если нашли по username, но uid теперь известен — обновим
      if (uid && !existing.uid) {
        db.prepare("UPDATE users SET uid = ? WHERE id = ?").run(uid, existing.id);
      }
      return existing.id;
    }
  }
  // Создаём нового
  const res = db.prepare(
    "INSERT INTO users (uid, username, name, rating, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(uid || null, username || null, name, ELO_START, now);
  console.log(`  👤 Создан пользователь: ${name} (uid=${uid ?? "?"})`);
  return res.lastInsertRowid;
}

for (const pair of pairs) {
  if (pair.name1) upsertUser({ uid: pair.uid1, username: null,          name: pair.name1 });
  if (pair.name2) upsertUser({ uid: pair.uid2, username: pair.username2, name: pair.name2 });
}
console.log("✅ Игроки перенесены из pairs → users");

// ─── Шаг 4: проставить user1_id / user2_id в sessions ────────────────────────
const sessionsToFix = db.prepare(
  "SELECT s.*, p.uid1, p.uid2, p.username2, p.name1, p.name2 FROM sessions s JOIN pairs p ON s.pair_id = p.id WHERE s.user1_id IS NULL"
).all();

for (const s of sessionsToFix) {
  const u1 = db.prepare("SELECT id FROM users WHERE uid = ?").get(s.uid1);
  let u2;
  if (s.uid2) {
    u2 = db.prepare("SELECT id FROM users WHERE uid = ?").get(s.uid2);
  }
  if (!u2 && s.username2) {
    const clean = s.username2.replace(/^@/, "").toLowerCase();
    u2 = db.prepare("SELECT id FROM users WHERE LOWER(REPLACE(username,'@','')) = ?").get(clean);
  }
  if (!u2 && s.name2) {
    u2 = db.prepare("SELECT id FROM users WHERE name = ? AND uid IS NULL").get(s.name2);
  }

  if (u1 && u2) {
    db.prepare("UPDATE sessions SET user1_id = ?, user2_id = ? WHERE id = ?")
      .run(u1.id, u2.id, s.id);
  } else {
    console.warn(`  ⚠️  Сессия id=${s.id}: не нашли пользователей (u1=${u1?.id}, u2=${u2?.id})`);
  }
}
console.log(`✅ user1_id/user2_id проставлены в ${sessionsToFix.length} сессиях`);

// ─── Шаг 5: пересчёт рейтингов по хронологии ─────────────────────────────────
const allSessions = db.prepare(
  "SELECT * FROM sessions WHERE user1_id IS NOT NULL AND user2_id IS NOT NULL ORDER BY played_at ASC"
).all();

// Сбросить рейтинги к стартовым
db.prepare("UPDATE users SET rating = ?").run(ELO_START);

// Текущие рейтинги и счётчик игр в памяти
const ratings   = new Map();
const gameCounts = new Map();
const getR = id => ratings.get(id) ?? ELO_START;
const getG = id => gameCounts.get(id) ?? 0;

const updateRating  = db.prepare("UPDATE users SET rating = ? WHERE id = ?");
const updateSession = db.prepare(
  "UPDATE sessions SET r1_before = ?, r1_after = ?, r2_before = ?, r2_after = ? WHERE id = ?"
);

for (const s of allSessions) {
  const r1 = getR(s.user1_id);
  const r2 = getR(s.user2_id);
  const g1 = getG(s.user1_id);
  const g2 = getG(s.user2_id);
  const { newR1, newR2 } = computeNewRatings(r1, r2, s.score1, s.score2, g1, g2);
  ratings.set(s.user1_id, newR1);
  ratings.set(s.user2_id, newR2);
  gameCounts.set(s.user1_id, g1 + 1);
  gameCounts.set(s.user2_id, g2 + 1);
  updateRating.run(newR1, s.user1_id);
  updateRating.run(newR2, s.user2_id);
  updateSession.run(r1, newR1, r2, newR2, s.id);
}

// Вывести итоговые рейтинги
const users = db.prepare("SELECT id, name, rating FROM users").all();
console.log("✅ Рейтинги пересчитаны:");
for (const u of users) {
  console.log(`   ${u.name}: ${u.rating}`);
}

db.close();
console.log("\n🎱 Миграция завершена!");
