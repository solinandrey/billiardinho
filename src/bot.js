import TelegramBot from "node-telegram-bot-api";
import { db } from "./db.js";
import { formatStats, formatSessions } from "./formatter.js";
import { getState, setState, clearState } from "./fsm.js";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send the main menu keyboard */
function sendMenu(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "🎱 Записать счёт" }],
        [{ text: "📊 Статистика" }, { text: "📋 Последние партии" }],
        [{ text: "📅 За месяц" }, { text: "🕐 За период" }],
        [{ text: "↩️ Отменить последнюю" }, { text: "⚙️ Сменить имена" }],
      ],
      resize_keyboard: true,
    },
  });
}

/** Ask for a number with force reply */
function askNumber(chatId, text) {
  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      force_reply: true,
      input_field_placeholder: "Введи число...",
    },
  });
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  clearState(msg.chat.id);
  const { player1 } = db.getPlayers();

  if (!player1) {
    setState(msg.chat.id, "setup_p1");
    bot.sendMessage(
      msg.chat.id,
      `Привет! 🎱 Я буду вести счёт ваших партий в бильярд.\n\n` +
        `Для начала давай познакомимся.\n\n*Как зовут первого игрока?*`,
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
  } else {
    sendMenu(msg.chat.id, `Привет снова! Что делаем? 🎱`);
  }
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
      `↩️ *Отменить последнюю* — удалить ошибочную запись\n` +
      `⚙️ *Сменить имена* — переименовать игроков`,
    { parse_mode: "Markdown" }
  );
});

// ─── Central message router ───────────────────────────────────────────────────
bot.on("message", (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;

  // Skip commands — handled by onText above
  if (text.startsWith("/")) return;

  const { state, data } = getState(chatId);

  // ── FSM: Setup — Player 1 name ───────────────────────────────────────────────
  if (state === "setup_p1") {
    if (!text || text.length > 32) {
      bot.sendMessage(chatId, "Имя не должно быть пустым или слишком длинным. Попробуй ещё раз:");
      return;
    }
    setState(chatId, "setup_p2", { player1: text });
    bot.sendMessage(
      chatId,
      `Отлично, *${text}*! А как зовут второго игрока?`,
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
    return;
  }

  // ── FSM: Setup — Player 2 name ───────────────────────────────────────────────
  if (state === "setup_p2") {
    if (!text || text.length > 32) {
      bot.sendMessage(chatId, "Имя не должно быть пустым или слишком длинным. Попробуй ещё раз:");
      return;
    }
    const { player1 } = data;
    db.setPlayers(player1, text);
    clearState(chatId);
    sendMenu(
      chatId,
      `Готово! 🎉\nИгроки: *${player1}* и *${text}*\n\nТеперь можно записывать партии 👇`
    );
    return;
  }

  // ── FSM: Record — Score 1 ────────────────────────────────────────────────────
  if (state === "record_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      bot.sendMessage(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    const { player2 } = db.getPlayers();
    setState(chatId, "record_score2", { score1: n });
    askNumber(chatId, `Понял! Теперь — сколько партий выиграл *${player2}*?`);
    return;
  }

  // ── FSM: Record — Score 2 ────────────────────────────────────────────────────
  if (state === "record_score2") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) {
      bot.sendMessage(chatId, "Введи корректное число от 0 до 99:");
      return;
    }
    const { player1, player2 } = db.getPlayers();
    const score1 = data.score1;
    const score2 = n;
    const now = new Date().toISOString();
    db.insertSession(score1, score2, now);
    clearState(chatId);

    const winner =
      score1 > score2
        ? `🏆 Победил *${player1}*!`
        : score2 > score1
        ? `🏆 Победил *${player2}*!`
        : "🤝 Ничья!";

    sendMenu(
      chatId,
      `✅ Записано! ${now.slice(0, 10)}\n\n` +
        `${player1} *${score1}* — *${score2}* ${player2}\n\n${winner}`
    );
    return;
  }

  // ── FSM: Period input ─────────────────────────────────────────────────────────
  if (state === "period_input") {
    handlePeriodInput(chatId, text);
    return;
  }

  // ── FSM: Month input ──────────────────────────────────────────────────────────
  if (state === "month_input") {
    handleMonthInput(chatId, text);
    return;
  }

  // ── Menu buttons ──────────────────────────────────────────────────────────────
  const { player1, player2 } = db.getPlayers();

  if (!player1) {
    bot.sendMessage(chatId, "Сначала запусти /start чтобы настроить бота.");
    return;
  }

  switch (text) {
    case "🎱 Записать счёт": {
      setState(chatId, "record_score1");
      askNumber(chatId, `Сколько партий выиграл *${player1}*?`);
      break;
    }

    case "📊 Статистика": {
      const rows = db.getAllSessions();
      bot.sendMessage(chatId, formatStats(rows, "Всё время", player1, player2), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📋 Последние партии": {
      const rows = db.getLastSessions(10);
      bot.sendMessage(chatId, formatSessions(rows, player1, player2), {
        parse_mode: "Markdown",
      });
      break;
    }

    case "📅 За месяц": {
      setState(chatId, "month_input");
      bot.sendMessage(
        chatId,
        `За какой месяц?\n\n` +
          `Напиши *текущий* — за текущий месяц,\n` +
          `или дату в формате *ГГГГ-ММ*, например \`2025-11\``,
        { parse_mode: "Markdown", reply_markup: { force_reply: true } }
      );
      break;
    }

    case "🕐 За период": {
      setState(chatId, "period_input");
      bot.sendMessage(
        chatId,
        `За какой период?\n\n` +
          `*Примеры:*\n` +
          `\`3w\` — последние 3 недели\n` +
          `\`2m\` — последние 2 месяца\n` +
          `\`10d\` — последние 10 дней\n` +
          `\`2025-01-01 2025-03-01\` — точные даты`,
        { parse_mode: "Markdown", reply_markup: { force_reply: true } }
      );
      break;
    }

    case "↩️ Отменить последнюю": {
      const deleted = db.deleteLastSession();
      if (deleted) {
        sendMenu(
          chatId,
          `✅ Последняя запись удалена:\n` +
            `${deleted.played_at.slice(0, 10)} — ${player1} ${deleted.score1}:${deleted.score2} ${player2}`
        );
      } else {
        bot.sendMessage(chatId, "Нет записей для удаления.");
      }
      break;
    }

    case "⚙️ Сменить имена": {
      setState(chatId, "setup_p1");
      bot.sendMessage(chatId, `Как зовут первого игрока?`, {
        reply_markup: { force_reply: true },
      });
      break;
    }

    default: {
      bot.sendMessage(chatId, "Используй кнопки меню 👇 или /help для справки.");
    }
  }
});

// ─── Helper: period stats ──────────────────────────────────────────────────────
function handlePeriodInput(chatId, arg) {
  clearState(chatId);
  const { player1, player2 } = db.getPlayers();
  let from, to, label;

  const shortcut = arg.match(/^(\d+)([wmd])$/i);
  if (shortcut) {
    const n = parseInt(shortcut[1]);
    const unit = shortcut[2].toLowerCase();
    to = new Date();
    from = new Date();
    if (unit === "w") { from.setDate(from.getDate() - n * 7); label = `последние ${n} нед.`; }
    else if (unit === "m") { from.setMonth(from.getMonth() - n); label = `последние ${n} мес.`; }
    else { from.setDate(from.getDate() - n); label = `последние ${n} дн.`; }
  } else {
    const dates = arg.match(/(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})/);
    if (!dates) {
      bot.sendMessage(chatId, "Не понял формат. Попробуй: `3w`, `2m`, или `2025-01-01 2025-03-01`", {
        parse_mode: "Markdown",
      });
      return;
    }
    from = new Date(dates[1]);
    to = new Date(dates[2]);
    label = `${dates[1]} — ${dates[2]}`;
  }

  const rows = db.getSessionsByPeriod(from.toISOString(), to.toISOString());
  bot.sendMessage(chatId, formatStats(rows, label, player1, player2), {
    parse_mode: "Markdown",
  });
}

// ─── Helper: month stats ───────────────────────────────────────────────────────
function handleMonthInput(chatId, arg) {
  clearState(chatId);
  const { player1, player2 } = db.getPlayers();
  let year, month;

  if (arg.toLowerCase() === "текущий" || arg.toLowerCase() === "сейчас") {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  } else {
    const match = arg.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      bot.sendMessage(chatId, "Не понял. Напиши *текущий* или дату в формате `2025-11`", {
        parse_mode: "Markdown",
      });
      return;
    }
    year = parseInt(match[1]);
    month = parseInt(match[2]);
  }

  const rows = db.getSessionsByMonth(year, month);
  const label = `${year}-${String(month).padStart(2, "0")}`;
  bot.sendMessage(chatId, formatStats(rows, label, player1, player2), {
    parse_mode: "Markdown",
  });
}

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🎱 Billiard bot started");
