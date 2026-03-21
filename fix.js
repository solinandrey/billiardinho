/**
 * fix.js — одноразовый скрипт для починки дублирующихся пар
 * Запусти: railway run node fix.js
 * После успеха можно удалить этот файл.
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data/billiard.db");

const db = new Database(DB_PATH);

const pairs = db.prepare("SELECT * FROM pairs ORDER BY id ASC").all();
console.log("Пары в базе:", JSON.stringify(pairs, null, 2));

const sessions = db.prepare("SELECT pair_id, COUNT(*) as cnt FROM sessions GROUP BY pair_id").all();
console.log("Сессии по парам:", JSON.stringify(sessions, null, 2));

// Find pair with sessions (the import pair)
const pairWithSessions = sessions.find(s => s.cnt > 0);
if (!pairWithSessions) {
  console.log("❌ Нет сессий ни в одной паре");
  process.exit(1);
}

const goodPairId = pairWithSessions.pair_id;
console.log(`\n✅ Правильная пара: id=${goodPairId} (содержит ${pairWithSessions.cnt} партий)`);

// Delete all other pairs
const otherPairs = pairs.filter(p => p.id !== goodPairId);
for (const p of otherPairs) {
  db.prepare("DELETE FROM pairs WHERE id = ?").run(p.id);
  console.log(`🗑  Удалена лишняя пара id=${p.id}`);
}

// Make sure the good pair has the correct uid1
const goodPair = db.prepare("SELECT * FROM pairs WHERE id = ?").get(goodPairId);
console.log("\nИтоговая пара:", JSON.stringify(goodPair, null, 2));
console.log("\n🎱 Готово! Перезапусти бота и проверь статистику.");

db.close();
