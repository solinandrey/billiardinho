import TelegramBot from "node-telegram-bot-api";
import { db } from "./db.js";
import { formatStats, formatSessions } from "./formatter.js";
import { getState, setState, clearState } from "./fsm.js";
import { startApiServer } from "./api.js";

startApiServer();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendMenu(chatId, text) {
  const keyboard = [
    [{ text: "🎱 Записать счёт" }, { text: "🕰 Задним числом" }],
    [{ text: "📊 Статистика" }, { text: "📋 Последние партии" }],
    [{ text: "📅 За месяц" }, { text: "🕐 За период" }],
    [{ text: "↩️ Отменить последнюю" }],
  ];

  if (process.env.WEBAPP_URL) {
    // Pass uid in URL — Telegram doesn't always provide initData for web_app buttons
    const webAppUrl = `${process.env.WEBAPP_URL}?uid=${chatId}`;
    keyboard.unshift([{ text: "🌐 Открыть Mini App", web_app: { url: webAppUrl } }]);
  }

  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { keyboard, resize_keyboard: true },
  });
}

const CANCEL_KEYBOARD = {
  keyboard: [[{ text: "❌ Отмена" }]],
  resize_keyboard: true,
};

function askNumber(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: CANCEL_KEYBOARD,
  });
}

function askWithCancel(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: CANCEL_KEYBOARD,
  });
}

function forceReply(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { force_reply: true },
  });
}

function askNameConfirm(chatId, text, suggestedName) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [[{ text: suggestedName }], [{ text: "✏️ Ввести другое имя" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Best display name from Telegram profile */
function getTelegramName(from) {
  if (from.first_name && from.last_name) return `${from.first_name} ${from.last_name}`;
  if (from.first_name) return from.first_name;
  if (from.username) return from.username;
  return "Игрок";
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const uid = msg.from.id;
  const username = msg.from.username || null;
  const telegramName = getTelegramName(msg.from);
  clearState(chatId);

  // 1. Already in a complete pair → menu
  const completePair = db.getPairForUser(uid);
  if (completePair) {
    const { myName, theirName } = db.getNamesForUser(completePair, uid);
    sendMenu(chatId, `С возвращением, *${myName}*! 🎱\nТвой соперник: *${theirName}*`);
    return;
  }

  // 2. Invited as partner (matched by uid or @username) → confirm name
  // Check BEFORE "created pair" so an invited user isn't stuck in their own setup pair
  const pendingPair = db.getPendingPairForPartner(uid, username);
  if (pendingPair) {
    // Auto-fill name from Telegram profile, ask to confirm
    setState(chatId, "join_confirm_name", { pairId: pendingPair.id, suggestedName: telegramName });
    askNameConfirm(
      chatId,
      `Привет! 👋 *${pendingPair.name1}* пригласил тебя вести счёт партий в бильярд.\n\nКак тебя зовут?`,
      telegramName
    );
    return;
  }

  // 3. Created a pair before (e.g. via import) but partner hasn't joined yet
  const createdPair = db.getPairByCreator(uid);
  if (createdPair) {
    const theirName = createdPair.name2 || createdPair.username2 || "соперник";
    sendMenu(
      chatId,
      `С возвращением, *${createdPair.name1}*! 🎱\n` +
        (createdPair.uid2
          ? `Твой соперник: *${theirName}*`
          : `Ожидаем, когда *${theirName}* запустит бота...`)
    );
    return;
  }

  // 4. Brand new user → setup, use Telegram name as suggestion
  setState(chatId, "setup_confirm_name", { suggestedName: telegramName });
  askNameConfirm(
    chatId,
    `Привет! 🎱 Я буду вести счёт ваших партий в бильярд.\n\nКак тебя зовут?`,
    telegramName
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `*Как пользоваться ботом:*\n\n` +
      `Используй кнопки меню внизу 👇\n\n` +
      `🎱 *Записать счёт* — пошаговый ввод результата\n` +
      `📊 *Статистика* — итоги за всё время\n` +
      `📋 *Последние партии* — список последних 10 сессий\n` +
      `📅 *За месяц* — текущий или конкретный месяц\n` +
      `🕐 *За период* — произвольный период\n` +
      `↩️ *Отменить последнюю* — удалить ошибочную запись`,
    { parse_mode: "Markdown" }
  );
});

// ─── Central message router ───────────────────────────────────────────────────
bot.on("message", (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const uid = msg.from.id;
  const username = msg.from.username || null;

  if (text.startsWith("/")) return;

  if (text === "❌ Отмена") {
    clearState(chatId);
    sendMenu(chatId, "Отменено.");
    return;
  }

  const { state, data } = getState(chatId);

  // ── FSM: New user — confirm or change Telegram name ───────────────────────────
  if (state === "setup_confirm_name") {
    if (text === "✏️ Ввести другое имя") {
      setState(chatId, "setup_type_name", data);
      askWithCancel(chatId, "Введи своё имя:");
      return;
    }
    const name = (text === data.suggestedName || text.toLowerCase() === "ок" || text.toLowerCase() === "ok")
      ? data.suggestedName
      : text;
    if (!name || name.length > 32) {
      bot.sendMessage(chatId, "Имя слишком длинное. Попробуй ещё раз:");
      return;
    }
    setState(chatId, "setup_partner", { myName: name });
    forceReply(
      chatId,
      `Отлично, *${name}*! 👋\n\n` +
        `Введи *@username* соперника в Telegram.\n` +
        `Например: \`@alexey\`\n\n` +
        `_Если у соперника нет username — введи его числовой ID (узнать: @userinfobot)_`
    );
    return;
  }

  // ── FSM: New user — manually typed name ───────────────────────────────────────
  if (state === "setup_type_name") {
    if (!text || text.length > 32) {
      askWithCancel(chatId, "Имя слишком длинное. Введи покороче:");
      return;
    }
    setState(chatId, "setup_partner", { myName: text });
    forceReply(
      chatId,
      `Отлично, *${text}*! 👋\n\n` +
        `Введи *@username* соперника в Telegram.\n` +
        `Например: \`@alexey\`\n\n` +
        `_Если у соперника нет username — введи его числовой ID (узнать: @userinfobot)_`
    );
    return;
  }

  // ── FSM: Partner — manually typed name ────────────────────────────────────────
  if (state === "join_type_name") {
    if (!text || text.length > 32) {
      askWithCancel(chatId, "Имя слишком длинное. Введи покороче:");
      return;
    }
    const { pairId } = data;
    db.completePair(pairId, uid, text);
    clearState(chatId);
    const pair = db.getPairForUser(uid);
    sendMenu(
      chatId,
      `Добро пожаловать, *${text}*! 🎱\n` +
        `Ты в одной таблице с *${pair.name1}*.\n\n` +
        `Все партии — общие 👇`
    );
    return;
  }

  // ── FSM: Enter partner's @username or numeric ID ──────────────────────────────
  if (state === "setup_partner") {
    const input = text.trim();
    const isUsername = /^@?[a-zA-Z0-9_]{4,32}$/.test(input);
    const isNumericId = /^\d{5,}$/.test(input);

    if (!isUsername && !isNumericId) {
      bot.sendMessage(
        chatId,
        "Введи @username (например `@alexey`) или числовой Telegram ID:",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const { myName } = data;
    db.createPair(uid, myName, input);
    clearState(chatId);

    const displayPartner = isNumericId ? input : (input.startsWith("@") ? input : `@${input}`);
    sendMenu(
      chatId,
      `✅ Готово, *${myName}*!\n\n` +
        `Как только *${displayPartner}* запустит бота — он автоматически попадёт в вашу таблицу.\n\n` +
        `Пока можешь уже записывать партии 👇`
    );
    return;
  }

  // ── FSM: Partner — confirm or change Telegram name ────────────────────────────
  if (state === "join_confirm_name") {
    if (text === "✏️ Ввести другое имя") {
      setState(chatId, "join_type_name", data);
      askWithCancel(chatId, "Введи своё имя:");
      return;
    }
    const name = (text === data.suggestedName || text.toLowerCase() === "ок" || text.toLowerCase() === "ok")
      ? data.suggestedName
      : text;
    if (!name || name.length > 32) {
      bot.sendMessage(chatId, "Имя слишком длинное. Попробуй ещё раз:");
      return;
    }
    const { pairId } = data;
    db.completePair(pairId, uid, name);
    clearState(chatId);

    const pair = db.getPairForUser(uid);
    sendMenu(
      chatId,
      `Добро пожаловать, *${name}*! 🎱\n` +
        `Ты в одной таблице с *${pair.name1}*.\n\n` +
        `Все партии — общие 👇`
    );
    return;
  }

  // ── FSM: Record score step 1 ──────────────────────────────────────────────────
  if (state === "record_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      bot.sendMessage(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    // Use creator pair if partner hasn't joined yet
    const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
    const theirName = pair.uid1 === uid ? (pair.name2 || "Соперник") : pair.name1;
    setState(chatId, "record_score2", { ...data, score_me: n });
    askNumber(chatId, `Понял! Теперь — сколько партий выиграл *${theirName}*?`);
    return;
  }

  // ── FSM: Record score step 2 ──────────────────────────────────────────────────
  if (state === "record_score2") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      bot.sendMessage(chatId, "Введи корректное число от 0 до 99:");
      return;
    }

    const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
    const myName = pair.uid1 === uid ? pair.name1 : pair.name2;
    const theirName = pair.uid1 === uid ? (pair.name2 || "Соперник") : pair.name1;
    const scoreMe = data.score_me;
    const scoreThem = n;
    const now = new Date().toISOString();

    const score1 = pair.uid1 === uid ? scoreMe : scoreThem;
    const score2 = pair.uid1 === uid ? scoreThem : scoreMe;

    db.insertSession(pair.id, score1, score2, now);
    clearState(chatId);

    const winner =
      scoreMe > scoreThem ? `🏆 Победил *${myName}*!`
      : scoreThem > scoreMe ? `🏆 Победил *${theirName}*!`
      : "🤝 Ничья!";

    sendMenu(
      chatId,
      `✅ Записано! ${now.slice(0, 10)}\n\n` +
        `${myName} *${scoreMe}* — *${scoreThem}* ${theirName}\n\n${winner}`
    );
    return;
  }

  // ── FSM: Past record — date input ─────────────────────────────────────────────
  if (state === "record_past_date") {
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      askWithCancel(chatId, "Не понял. Введи дату в формате `ГГГГ-ММ-ДД`, например `2026-01-15`:");
      return;
    }
    const [, y, m, d] = match;
    const date = new Date(`${y}-${m}-${d}T12:00:00.000Z`);
    if (isNaN(date.getTime())) {
      askWithCancel(chatId, "Некорректная дата. Попробуй ещё раз:");
      return;
    }
    const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
    const myName = pair.uid1 === uid ? pair.name1 : pair.name2;
    setState(chatId, "record_past_score1", { isoDate: date.toISOString() });
    askNumber(chatId, `Дата: *${text}*\n\nСколько партий выиграл *${myName}*?`);
    return;
  }

  // ── FSM: Past record — score1 ──────────────────────────────────────────────────
  if (state === "record_past_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      askNumber(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
    const theirName = pair.uid1 === uid ? (pair.name2 || "Соперник") : pair.name1;
    setState(chatId, "record_past_score2", { ...data, score_me: n });
    askNumber(chatId, `Понял! Теперь — сколько партий выиграл *${theirName}*?`);
    return;
  }

  // ── FSM: Past record — score2 ──────────────────────────────────────────────────
  if (state === "record_past_score2") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      askNumber(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
    const myName = pair.uid1 === uid ? pair.name1 : pair.name2;
    const theirName = pair.uid1 === uid ? (pair.name2 || "Соперник") : pair.name1;
    const scoreMe = data.score_me;
    const scoreThem = n;
    const score1 = pair.uid1 === uid ? scoreMe : scoreThem;
    const score2 = pair.uid1 === uid ? scoreThem : scoreMe;

    db.insertSession(pair.id, score1, score2, data.isoDate);
    clearState(chatId);

    const dateStr = data.isoDate.slice(0, 10);
    const winner =
      scoreMe > scoreThem ? `🏆 Победил *${myName}*!`
      : scoreThem > scoreMe ? `🏆 Победил *${theirName}*!`
      : "🤝 Ничья!";

    sendMenu(
      chatId,
      `✅ Записано! ${dateStr}\n\n` +
        `${myName} *${scoreMe}* — *${scoreThem}* ${theirName}\n\n${winner}`
    );
    return;
  }

  // ── FSM: Period input ─────────────────────────────────────────────────────────
  if (state === "period_input") {
    handlePeriodInput(chatId, uid, text);
    return;
  }

  // ── FSM: Month input ──────────────────────────────────────────────────────────
  if (state === "month_input") {
    handleMonthInput(chatId, uid, text);
    return;
  }

  // ── Menu buttons ──────────────────────────────────────────────────────────────
  const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);

  if (!pair) {
    bot.sendMessage(chatId, "Сначала запусти /start чтобы настроить бота.");
    return;
  }

  const myName = pair.uid1 === uid ? pair.name1 : pair.name2;
  const theirName = pair.uid1 === uid ? (pair.name2 || "Соперник") : pair.name1;

  switch (text) {
    case "🎱 Записать счёт": {
      setState(chatId, "record_score1");
      askNumber(chatId, `Сколько партий выиграл *${myName}*?`);
      break;
    }

    case "🕰 Задним числом": {
      setState(chatId, "record_past_date");
      askWithCancel(chatId, `Введи дату в формате *ГГГГ-ММ-ДД*, например \`2026-03-01\`:`);
      break;
    }

    case "📊 Статистика": {
      const rows = db.getAllSessions(pair.id);
      bot.sendMessage(chatId, formatStats(rows, "Всё время", pair.name1, pair.name2 || "Соперник"), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📋 Последние партии": {
      const rows = db.getLastSessions(pair.id, 10);
      bot.sendMessage(chatId, formatSessions(rows, pair.name1, pair.name2 || "Соперник"), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📅 За месяц": {
      setState(chatId, "month_input");
      askWithCancel(
        chatId,
        `За какой месяц?\n\nНапиши *текущий* или дату в формате *ГГГГ-ММ*, например \`2025-11\``
      );
      break;
    }

    case "🕐 За период": {
      setState(chatId, "period_input");
      askWithCancel(
        chatId,
        `За какой период?\n\n` +
          `\`3w\` — последние 3 недели\n` +
          `\`2m\` — последние 2 месяца\n` +
          `\`10d\` — последние 10 дней\n` +
          `\`2025-01-01 2025-03-01\` — точные даты`
      );
      break;
    }

    case "↩️ Отменить последнюю": {
      const deleted = db.deleteLastSession(pair.id);
      if (deleted) {
        sendMenu(
          chatId,
          `✅ Последняя запись удалена:\n` +
            `${deleted.played_at.slice(0, 10)} — ${pair.name1} ${deleted.score1}:${deleted.score2} ${pair.name2 || "Соперник"}`
        );
      } else {
        bot.sendMessage(chatId, "Нет записей для удаления.");
      }
      break;
    }

    default:
      sendMenu(chatId, "Используй кнопки меню 👇");
  }
});

// ─── Helper: period stats ──────────────────────────────────────────────────────
function handlePeriodInput(chatId, uid, arg) {
  clearState(chatId);
  const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
  if (!pair) return;
  let from, to, label;

  const shortcut = arg.match(/^(\d+)([wmd])$/i);
  if (shortcut) {
    const n = parseInt(shortcut[1]);
    const unit = shortcut[2].toLowerCase();
    to = new Date(); from = new Date();
    if (unit === "w") { from.setDate(from.getDate() - n * 7); label = `последние ${n} нед.`; }
    else if (unit === "m") { from.setMonth(from.getMonth() - n); label = `последние ${n} мес.`; }
    else { from.setDate(from.getDate() - n); label = `последние ${n} дн.`; }
  } else {
    const dates = arg.match(/(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/);
    if (!dates) {
      bot.sendMessage(chatId, "Не понял. Попробуй: `3w`, `2m`, или `2025-01-01 2025-03-01`", { parse_mode: "Markdown" });
      return;
    }
    from = new Date(dates[1]); to = new Date(dates[2]);
    label = `${dates[1]} — ${dates[2]}`;
  }

  const rows = db.getSessionsByPeriod(pair.id, from.toISOString(), to.toISOString());
  bot.sendMessage(chatId, formatStats(rows, label, pair.name1, pair.name2 || "Соперник"), { parse_mode: "Markdown" });
}

// ─── Helper: month stats ───────────────────────────────────────────────────────
function handleMonthInput(chatId, uid, arg) {
  clearState(chatId);
  const pair = db.getPairForUser(uid) || db.getPairByCreator(uid);
  if (!pair) return;
  let year, month;

  if (arg.toLowerCase() === "текущий" || arg.toLowerCase() === "сейчас") {
    const now = new Date();
    year = now.getFullYear(); month = now.getMonth() + 1;
  } else {
    const match = arg.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      bot.sendMessage(chatId, "Не понял. Напиши *текущий* или `2025-11`", { parse_mode: "Markdown" });
      return;
    }
    year = parseInt(match[1]); month = parseInt(match[2]);
  }

  const rows = db.getSessionsByMonth(pair.id, year, month);
  const label = `${year}-${String(month).padStart(2, "0")}`;
  bot.sendMessage(chatId, formatStats(rows, label, pair.name1, pair.name2 || "Соперник"), { parse_mode: "Markdown" });
}

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🎱 Billiard bot started");
