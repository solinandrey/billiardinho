// Telegram notifications fired from API handlers.
// Talks to Telegram Bot API over plain fetch — no need to share the bot
// instance from bot.js. Fire-and-forget; never blocks the API response.

const API = 'https://api.telegram.org';

/**
 * Send a message to a Telegram chat. Silently no-ops if BOT_TOKEN is unset
 * or chat_id is missing. Errors are logged but never thrown — notifications
 * are best-effort, the user's main action must not fail because of them.
 *
 * @param {number|string} chatId  Telegram numeric user id
 * @param {string} text           Markdown-formatted text
 * @param {object} [opts]         { reply_markup, disable_notification, ... }
 */
export async function sendMessage(chatId, text, opts = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  if (!chatId) return;

  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        ...opts,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[notify] sendMessage to ${chatId} failed:`, res.status, body.slice(0, 200));
    }
  } catch (e) {
    console.error(`[notify] sendMessage to ${chatId} threw:`, e.message);
  }
}

/** "Открыть приложение" reply markup, if WEBAPP_URL is configured. */
function webAppMarkup(uid) {
  if (!process.env.WEBAPP_URL) return undefined;
  return {
    inline_keyboard: [[{
      text: '🎱 Открыть приложение',
      web_app: { url: `${process.env.WEBAPP_URL}?uid=${uid}` },
    }]],
  };
}

/**
 * Notify a user that someone just recorded a match against them.
 *
 * @param {object} opp           Recipient — must have .uid and .name
 * @param {object} me            Sender — must have .name
 * @param {number} scoreMe       Score recorded for the sender
 * @param {number} scoreOpp      Score recorded for the recipient
 * @param {number|null} deltaOpp Opponent's rating delta (positive/negative)
 * @param {string|null} note     Optional match note
 */
/** Strip Markdown-special chars to avoid breaking Telegram's parser. */
function md(s) {
  return String(s ?? '').replace(/[_*`[\]]/g, '');
}

export function notifyMatchRecorded(opp, me, scoreMe, scoreOpp, deltaOpp, note) {
  if (!opp?.uid) return;
  // Don't notify yourself if someone records a match against their own account.
  if (opp.uid === me?.uid) return;

  const meName = md(me?.name);
  const won = scoreOpp > scoreMe;
  const lost = scoreOpp < scoreMe;
  const headline = won
    ? `🏆 Ты выиграл у *${meName}*!`
    : lost
      ? `💔 Ты проиграл *${meName}*.`
      : `🎱 Ничья с *${meName}*.`;

  // From the opponent's perspective: their score on the left.
  const scoreLine = `*${scoreOpp} : ${scoreMe}*`;

  let deltaLine = '';
  if (typeof deltaOpp === 'number' && Number.isFinite(deltaOpp)) {
    const sign = deltaOpp > 0 ? '+' : deltaOpp < 0 ? '−' : '±';
    deltaLine = `\nРейтинг: ${sign}${Math.abs(deltaOpp).toFixed(2)}`;
  }

  const noteLine = note ? `\n\n_${md(note)}_` : '';

  const text =
    `${headline}\n` +
    `*${meName}* записал партию.\n` +
    `${scoreLine}${deltaLine}${noteLine}`;

  sendMessage(opp.uid, text, { reply_markup: webAppMarkup(opp.uid) });
}
