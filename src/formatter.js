/**
 * Aggregate an array of session rows into summary stats.
 */
function aggregate(rows) {
  let wins1 = 0, wins2 = 0, draws = 0, total1 = 0, total2 = 0;
  for (const r of rows) {
    total1 += r.score1;
    total2 += r.score2;
    if (r.score1 > r.score2) wins1++;
    else if (r.score2 > r.score1) wins2++;
    else draws++;
  }
  return { wins1, wins2, draws, total1, total2, sessions: rows.length };
}

/**
 * Format a compact stats block for a given period label.
 * @param {object[]} rows
 * @param {string} label
 * @param {string} p1 - player 1 name
 * @param {string} p2 - player 2 name
 */
export function formatStats(rows, label, p1, p2) {
  if (!rows.length) {
    return `📊 *${label}*\n\nНет данных за этот период.`;
  }

  const { wins1, wins2, draws, total1, total2, sessions } = aggregate(rows);
  const leader =
    wins1 > wins2
      ? `🏆 Впереди *${p1}*`
      : wins2 > wins1
      ? `🏆 Впереди *${p2}*`
      : "🤝 Счёт равный";

  const days = new Set(rows.map((r) => r.played_at.slice(0, 10)));
  const daysStr = [...days].join(", ");

  return (
    `📊 *${label}*\n\n` +
    `Сессий записано: ${sessions} (дней: ${days.size})\n\n` +
    `👤 *${p1}*: ${wins1} побед (партий: ${total1})\n` +
    `👤 *${p2}*: ${wins2} побед (партий: ${total2})\n` +
    (draws ? `🤝 Ничьих: ${draws}\n` : "") +
    `\n${leader}\n\n` +
    `📅 Дни игр: ${daysStr}`
  );
}

/**
 * Format a list of recent sessions.
 */
export function formatSessions(rows, p1, p2) {
  if (!rows.length) return "Нет записанных партий.";

  const lines = rows.map((r) => {
    const date = r.played_at.slice(0, 10);
    const winner =
      r.score1 > r.score2
        ? `→ ${p1}`
        : r.score2 > r.score1
        ? `→ ${p2}`
        : "→ ничья";
    return `${date}  ${p1} *${r.score1}*:*${r.score2}* ${p2}  ${winner}`;
  });

  return `🎱 *Последние партии:*\n\n` + lines.join("\n");
}
