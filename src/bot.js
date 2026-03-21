import TelegramBot from "node-telegram-bot-api";
import { db } from "./db.js";
import { formatStats, formatSessions } from "./formatter.js";
import { getState, setState, clearState } from "./fsm.js";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendMenu(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "🎱 Записать счёт" }],
        [{ text: "📊 Статистика" }, { text: "📋 Последние партии" }],
        [{ text: "📅 За месяц" }, { text: "🕐 За период" }],
        [{ text: "↩️ Отменить последнюю" }],
      ],
      resize_keyboard: true,
    },
  });
}

function askNumber(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      force_reply: true,
      input_field_placeholder: "Введи число...",
    },
  });
}

function forceReply(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { force_reply: true },
  });
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const uid = msg.from.id;
  const username = msg.from.username || null; // e.g. "soulin" (no @)
  clearState(chatId);

  // 1. Already in a complete pair → menu
  const existingPair = db.getPairForUser(uid);
  if (existingPair) {
    const { myName, theirName } = db.getNamesForUser(existingPair, uid);
    sendMenu(chatId, `С возвращением, *${myName}*! 🎱\nТвой соперник: *${theirName}*`);
    return;
  }

  // 2. Someone invited this user (by @username or numeric ID) → ask their name
  const pendingPair = db.getPendingPairForPartner(uid, username);
  if (pendingPair) {
    setState(chatId, "join_name", { pairId: pendingPair.id });
    forceReply(
      chatId,
      `Привет! 👋 *${pendingPair.name1}* пригласил тебя вести счёт партий в бильярд.\n\n` +
        `Как тебя зовут?`
    );
    return;
  }

  // 3. Brand new user → setup flow
  setState(chatId, "setup_name");
  forceReply(chatId, `Привет! 🎱 Я буду вести счёт ваших партий в бильярд.\n\nКак тебя зовут?`);
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

  const { state, data } = getState(chatId);

  // ── FSM: Enter your name ──────────────────────────────────────────────────────
  if (state === "setup_name") {
    if (!text || text.length > 32) {
      bot.sendMessage(chatId, "Имя не должно быть пустым или слишком длинным. Попробуй ещё раз:");
      return;
    }
    setState(chatId, "setup_partner", { myName: text });
    forceReply(
      chatId,
      `Отлично, *${text}*! 👋\n\n` +
        `Теперь введи *@username* соперника в Telegram.\n\n` +
        `Например: \`@soulin\`\n\n` +
        `_Если у соперника нет username — введи его числовой ID (узнать можно у @userinfobot)_`
    );
    return;
  }

  // ── FSM: Enter partner's @username or numeric ID ──────────────────────────────
  if (state === "setup_partner") {
    const input = text.trim();

    // Validate: must be @username or a positive number
    const isUsername = /^@?[a-zA-Z0-9_]{4,32}$/.test(input);
    const isNumericId = /^\d{5,}$/.test(input);

    if (!isUsername && !isNumericId) {
      bot.sendMessage(
        chatId,
        "Не понял. Введи @username соперника (например `@soulin`) или его числовой Telegram ID:",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const { myName } = data;
    db.createPair(uid, myName, input);
    clearState(chatId);

    const displayPartner = input.startsWith("@") ? input : `@${input}`;
    sendMenu(
      chatId,
      `✅ Готово, *${myName}*!\n\n` +
        `Как только *${isNumericId ? input : displayPartner}* запустит бота — он автоматически попадёт в вашу общую таблицу.\n\n` +
        `Пока можешь уже записывать партии 👇`
    );
    return;
  }

  // ── FSM: Partner joins — enters their name ────────────────────────────────────
  if (state === "join_name") {
    if (!text || text.length > 32) {
      bot.sendMessage(chatId, "Имя не должно быть пустым. Попробуй ещё раз:");
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

  // ── FSM: Record score step 1 ──────────────────────────────────────────────────
  if (state === "record_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      bot.sendMessage(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    const pair = db.getPairForUser(uid);
    const { theirName } = db.getNamesForUser(pair, uid);
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

    const pair = db.getPairForUser(uid);
    const { myName, theirName } = db.getNamesForUser(pair, uid);
    const scoreMe = data.score_me;
    const scoreThem = n;
    const now = new Date().toISOString();

    // Always persist score1=uid1, score2=uid2
    const score1 = pair.uid1 === uid ? scoreMe : scoreThem;
    const score2 = pair.uid1 === uid ? scoreThem : scoreMe;

    db.insertSession(pair.id, score1, score2, now);
    clearState(chatId);

    const winner =
      scoreMe > scoreThem
        ? `🏆 Победил *${myName}*!`
        : scoreThem > scoreMe
        ? `🏆 Победил *${theirName}*!`
        : "🤝 Ничья!";

    sendMenu(
      chatId,
      `✅ Записано! ${now.slice(0, 10)}\n\n` +
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
  const pair = db.getPairForUser(uid);

  if (!pair) {
    bot.sendMessage(chatId, "Сначала запусти /start чтобы настроить бота.");
    return;
  }

  const { myName, theirName } = db.getNamesForUser(pair, uid);

  switch (text) {
    case "🎱 Записать счёт": {
      setState(chatId, "record_score1");
      askNumber(chatId, `Сколько партий выиграл *${myName}*?`);
      break;
    }

    case "📊 Статистика": {
      const rows = db.getAllSessions(pair.id);
      bot.sendMessage(chatId, formatStats(rows, "Всё время", pair.name1, pair.name2), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📋 Последние партии": {
      const rows = db.getLastSessions(pair.id, 10);
      bot.sendMessage(chatId, formatSessions(rows, pair.name1, pair.name2), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📅 За месяц": {
      setState(chatId, "month_input");
      forceReply(
        chatId,
        `За какой месяц?\n\n` +
          `Напиши *текущий* — за текущий месяц,\n` +
          `или дату в формате *ГГГГ-ММ*, например \`2025-11\``
      );
      break;
    }

    case "🕐 За период": {
      setState(chatId, "period_input");
      forceReply(
        chatId,
        `За какой период?\n\n` +
          `*Примеры:*\n` +
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
            `${deleted.played_at.slice(0, 10)} — ${pair.name1} ${deleted.score1}:${deleted.score2} ${pair.name2}`
        );
      } else {
        bot.sendMessage(chatId, "Нет записей для удаления.");
      }
      break;
    }

    default:
      bot.sendMessage(chatId, "Используй кнопки меню 👇 или /help для справки.");
  }
});

// ─── Helper: period stats ──────────────────────────────────────────────────────
function handlePeriodInput(chatId, uid, arg) {
  clearState(chatId);
  const pair = db.getPairForUser(uid);
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
      bot.sendMessage(chatId, "Не понял формат. Попробуй: `3w`, `2m`, или `2025-01-01 2025-03-01`", { parse_mode: "Markdown" });
      return;
    }
    from = new Date(dates[1]); to = new Date(dates[2]);
    label = `${dates[1]} — ${dates[2]}`;
  }

  const rows = db.getSessionsByPeriod(pair.id, from.toISOString(), to.toISOString());
  bot.sendMessage(chatId, formatStats(rows, label, pair.name1, pair.name2), { parse_mode: "Markdown" });
}

// ─── Helper: month stats ───────────────────────────────────────────────────────
function handleMonthInput(chatId, uid, arg) {
  clearState(chatId);
  const pair = db.getPairForUser(uid);
  if (!pair) return;
  let year, month;

  if (arg.toLowerCase() === "текущий" || arg.toLowerCase() === "сейчас") {
    const now = new Date();
    year = now.getFullYear(); month = now.getMonth() + 1;
  } else {
    const match = arg.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      bot.sendMessage(chatId, "Не понял. Напиши *текущий* или дату в формате `2025-11`", { parse_mode: "Markdown" });
      return;
    }
    year = parseInt(match[1]); month = parseInt(match[2]);
  }

  const rows = db.getSessionsByMonth(pair.id, year, month);
  const label = `${year}-${String(month).padStart(2, "0")}`;
  bot.sendMessage(chatId, formatStats(rows, label, pair.name1, pair.name2), { parse_mode: "Markdown" });
}

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🎱 Billiard bot started");
