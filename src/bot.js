import TelegramBot from "node-telegram-bot-api";
import { db, computeNewRatings } from "./db.js";
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

function askWithCancel(chatId, text) {
  bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: CANCEL_KEYBOARD });
}

function askNumber(chatId, text) {
  bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: CANCEL_KEYBOARD });
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

function getTelegramName(from) {
  if (from.first_name && from.last_name) return `${from.first_name} ${from.last_name}`;
  if (from.first_name) return from.first_name;
  if (from.username) return from.username;
  return "Игрок";
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId  = msg.chat.id;
  const uid     = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : null;
  const telegramName = getTelegramName(msg.from);
  clearState(chatId);

  // 1. Уже зарегистрирован → меню
  let user = db.getUserByUid(uid);
  if (user) {
    sendMenu(chatId, `С возвращением, *${user.name}*! 🎱\nТвой рейтинг: *${user.rating}*`);
    return;
  }

  // 2. Есть запись без uid (по username) — например Алексей из импорта
  if (username) {
    const existing = db.getUserByUsername(username);
    if (existing && !existing.uid) {
      db.linkUserUid(existing.id, uid);
      sendMenu(chatId, `С возвращением, *${existing.name}*! 🎱\nТвой рейтинг: *${existing.rating}*`);
      return;
    }
  }

  // 3. Новый пользователь → только имя
  setState(chatId, "register_confirm_name", { suggestedName: telegramName });
  askNameConfirm(
    chatId,
    `Привет! 🎱 Я веду счёт партий в бильярд.\n\nКак тебя зовут?`,
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
  const text   = msg.text.trim();
  const chatId = msg.chat.id;
  const uid    = msg.from.id;

  if (text.startsWith("/")) return;

  if (text === "❌ Отмена") {
    clearState(chatId);
    const user = db.getUserByUid(uid);
    if (user) sendMenu(chatId, "Отменено.");
    else bot.sendMessage(chatId, "Отменено. Напиши /start чтобы начать.");
    return;
  }

  const { state, data } = getState(chatId);

  // ── Регистрация: подтверждение имени ─────────────────────────────────────────
  if (state === "register_confirm_name") {
    if (text === "✏️ Ввести другое имя") {
      setState(chatId, "register_type_name", data);
      askWithCancel(chatId, "Введи своё имя:");
      return;
    }
    const name = text === data.suggestedName ? data.suggestedName : text;
    if (!name || name.length > 32) {
      bot.sendMessage(chatId, "Имя слишком длинное. Попробуй ещё раз:");
      return;
    }
    finishRegistration(chatId, uid, msg.from.username, name);
    return;
  }

  // ── Регистрация: ручной ввод имени ───────────────────────────────────────────
  if (state === "register_type_name") {
    if (!text || text.length > 32) {
      askWithCancel(chatId, "Имя слишком длинное. Введи покороче:");
      return;
    }
    finishRegistration(chatId, uid, msg.from.username, text);
    return;
  }

  // ── Только зарегистрированные пользователи дальше ────────────────────────────
  const user = db.getUserByUid(uid);
  if (!user) {
    bot.sendMessage(chatId, "Сначала запусти /start чтобы зарегистрироваться.");
    return;
  }

  // ── FSM: Выбор соперника для записи счёта ────────────────────────────────────
  if (state === "record_pick_opponent" || state === "record_past_pick_opponent") {
    const others = db.getAllUsers().filter(u => u.id !== user.id);
    const picked = others.find(u => u.name === text);
    if (!picked) {
      bot.sendMessage(chatId, "Выбери соперника из списка 👇");
      return;
    }
    const isPast = state === "record_past_pick_opponent";
    setState(chatId, isPast ? "record_past_date" : "record_score1", {
      ...data,
      opponentId: picked.id,
      opponentName: picked.name,
    });
    if (isPast) {
      askWithCancel(chatId, `Соперник: *${picked.name}*\n\nВведи дату в формате *ГГГГ-ММ-ДД*, например \`2026-03-01\`:`);
    } else {
      askNumber(chatId, `Сколько партий выиграл *${user.name}*?`);
    }
    return;
  }

  // ── FSM: Ввод счёта шаг 1 ────────────────────────────────────────────────────
  if (state === "record_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) { bot.sendMessage(chatId, "Введи число от 0 до 99:"); return; }
    setState(chatId, "record_score2", { ...data, score_me: n });
    askNumber(chatId, `Понял! Теперь — сколько партий выиграл *${data.opponentName}*?`);
    return;
  }

  // ── FSM: Ввод счёта шаг 2 ────────────────────────────────────────────────────
  if (state === "record_score2") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) { bot.sendMessage(chatId, "Введи число от 0 до 99:"); return; }
    saveSession(chatId, user, data.opponentId, data.opponentName, data.score_me, n, new Date().toISOString());
    return;
  }

  // ── FSM: Задним числом — дата ─────────────────────────────────────────────────
  if (state === "record_past_date") {
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) { askWithCancel(chatId, "Не понял. Введи дату в формате `ГГГГ-ММ-ДД`:"); return; }
    const date = new Date(`${text}T12:00:00.000Z`);
    if (isNaN(date.getTime())) { askWithCancel(chatId, "Некорректная дата. Попробуй ещё раз:"); return; }
    setState(chatId, "record_past_score1", { ...data, isoDate: date.toISOString() });
    askNumber(chatId, `Дата: *${text}*\n\nСколько партий выиграл *${user.name}*?`);
    return;
  }

  // ── FSM: Задним числом — счёт 1 ───────────────────────────────────────────────
  if (state === "record_past_score1") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) { askNumber(chatId, "Введи число от 0 до 99:"); return; }
    setState(chatId, "record_past_score2", { ...data, score_me: n });
    askNumber(chatId, `Сколько партий выиграл *${data.opponentName}*?`);
    return;
  }

  // ── FSM: Задним числом — счёт 2 ───────────────────────────────────────────────
  if (state === "record_past_score2") {
    const n = parseInt(text);
    if (isNaN(n) || n < 0 || n > 99) { askNumber(chatId, "Введи число от 0 до 99:"); return; }
    saveSession(chatId, user, data.opponentId, data.opponentName, data.score_me, n, data.isoDate);
    return;
  }

  // ── FSM: Period / Month ───────────────────────────────────────────────────────
  if (state === "period_input") { handlePeriodInput(chatId, uid, text); return; }
  if (state === "month_input")  { handleMonthInput(chatId, uid, text);  return; }

  // ── Кнопки меню ───────────────────────────────────────────────────────────────
  switch (text) {
    case "🎱 Записать счёт":
      startRecordFlow(chatId, user, false);
      break;

    case "🕰 Задним числом":
      startRecordFlow(chatId, user, true);
      break;

    case "📊 Статистика": {
      const sessions = db.getSessionsForUser(user.id);
      const result   = aggregateStats(sessions, user.id);
      bot.sendMessage(chatId, formatUserStats(result, user.name), { parse_mode: "Markdown" });
      break;
    }

    case "📋 Последние партии": {
      const sessions = db.getSessionsForUser(user.id);
      const recent   = [...sessions].sort((a, b) => b.played_at.localeCompare(a.played_at)).slice(0, 10);
      bot.sendMessage(chatId, formatUserSessions(recent, user), { parse_mode: "Markdown" });
      break;
    }

    case "📅 За месяц":
      setState(chatId, "month_input");
      askWithCancel(chatId, `За какой месяц?\n\nНапиши *текущий* или дату в формате *ГГГГ-ММ*, например \`2025-11\``);
      break;

    case "🕐 За период":
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

    case "↩️ Отменить последнюю": {
      const deleted = db.deleteLastSessionForUser(user.id);
      if (deleted) {
        const opp = deleted.user1_id === user.id
          ? db.getUserById(deleted.user2_id)
          : db.getUserById(deleted.user1_id);
        const oppName = opp?.name || "Соперник";
        const myS  = deleted.user1_id === user.id ? deleted.score1 : deleted.score2;
        const oppS = deleted.user1_id === user.id ? deleted.score2 : deleted.score1;
        sendMenu(chatId, `✅ Последняя запись удалена:\n${deleted.played_at.slice(0, 10)} — ${user.name} ${myS}:${oppS} ${oppName}`);
        // Пересчёт рейтингов не делаем при откате (слишком сложно retroactively)
      } else {
        bot.sendMessage(chatId, "Нет записей для удаления.");
      }
      break;
    }

    default:
      sendMenu(chatId, "Используй кнопки меню 👇");
  }
});

// ─── Helpers: регистрация ─────────────────────────────────────────────────────
function finishRegistration(chatId, uid, rawUsername, name) {
  const username = rawUsername ? `@${rawUsername}` : null;
  db.createUser(uid, username, name);
  clearState(chatId);
  sendMenu(chatId, `Добро пожаловать, *${name}*! 🎱\n\nТы зарегистрирован. Начальный рейтинг: *5.0*`);
}

// ─── Helpers: запуск записи счёта ────────────────────────────────────────────
function startRecordFlow(chatId, user, isPast) {
  const others = db.getAllUsers().filter(u => u.id !== user.id);
  if (!others.length) {
    bot.sendMessage(chatId, "Пока нет других игроков в системе.");
    return;
  }
  setState(chatId, isPast ? "record_past_pick_opponent" : "record_pick_opponent");
  bot.sendMessage(chatId, `С кем играл *${user.name}*?`, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        ...others.map(u => [{ text: u.name }]),
        [{ text: "❌ Отмена" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

// ─── Helpers: сохранение игры + обновление рейтингов ─────────────────────────
function saveSession(chatId, user, opponentId, opponentName, scoreMe, scoreThem, playedAt) {
  const opponent = db.getUserById(opponentId);
  if (!opponent) { bot.sendMessage(chatId, "Не нашёл соперника. Попробуй ещё раз."); return; }

  // user — это тот, кто вводит счёт; user1 в сессии = user
  db.insertSessionForUsers(user.id, opponentId, scoreMe, scoreThem, playedAt);

  // Обновить рейтинги
  const { newR1, newR2 } = computeNewRatings(user.rating, opponent.rating, scoreMe, scoreThem);
  db.updateUserRatings(user.id, newR1, opponentId, newR2);

  clearState(chatId);

  const winner = scoreMe > scoreThem ? `🏆 Победил *${user.name}*!`
    : scoreThem > scoreMe          ? `🏆 Победил *${opponentName}*!`
    : "🤝 Ничья!";

  const ratingLine =
    `\n\n📈 Рейтинги: *${user.name}* ${user.rating} → *${newR1}*, *${opponentName}* ${opponent.rating} → *${newR2}*`;

  sendMenu(
    chatId,
    `✅ Записано! ${playedAt.slice(0, 10)}\n\n` +
      `${user.name} *${scoreMe}* — *${scoreThem}* ${opponentName}\n\n${winner}${ratingLine}`
  );
}

// ─── Stats helpers ────────────────────────────────────────────────────────────
function aggregateStats(sessions, userId) {
  let total = 0, wins = 0, draws = 0;
  for (const s of sessions) {
    const myS  = s.user1_id === userId ? s.score1 : s.score2;
    const oppS = s.user1_id === userId ? s.score2 : s.score1;
    total++;
    if (myS > oppS) wins++;
    else if (myS === oppS) draws++;
  }
  return { total, wins, draws, losses: total - wins - draws };
}

function formatUserStats({ total, wins, draws, losses }, name) {
  if (!total) return `У *${name}* пока нет записанных партий.`;
  const wr = Math.round(wins / total * 100);
  return (
    `📊 *Статистика ${name}*\n\n` +
    `Всего партий: *${total}*\n` +
    `Победы: *${wins}* (${wr}%)\n` +
    `Поражения: *${losses}*\n` +
    (draws ? `Ничьи: *${draws}*\n` : "")
  );
}

function formatUserSessions(sessions, user) {
  if (!sessions.length) return "Нет записей.";
  const lines = sessions.map(s => {
    const myS   = s.user1_id === user.id ? s.score1 : s.score2;
    const oppS  = s.user1_id === user.id ? s.score2 : s.score1;
    const oppId = s.user1_id === user.id ? s.user2_id : s.user1_id;
    const opp   = db.getUserById(oppId);
    const result = myS > oppS ? "✅" : myS < oppS ? "❌" : "🤝";
    return `${result} ${s.played_at.slice(0, 10)}  ${user.name} *${myS}:${oppS}* ${opp?.name ?? "?"}`;
  });
  return `📋 *Последние партии*\n\n${lines.join("\n")}`;
}

// ─── Period / Month (работают по user.id) ────────────────────────────────────
function handlePeriodInput(chatId, uid, arg) {
  clearState(chatId);
  const user = db.getUserByUid(uid);
  if (!user) return;
  let from, to, label;
  const shortcut = arg.match(/^(\d+)([wmd])$/i);
  if (shortcut) {
    const n = parseInt(shortcut[1]), unit = shortcut[2].toLowerCase();
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
  const sessions = db.getSessionsForUser(user.id).filter(
    s => s.played_at >= from.toISOString() && s.played_at <= to.toISOString()
  );
  const result = aggregateStats(sessions, user.id);
  bot.sendMessage(chatId, `📊 *${user.name}* за ${label}\n\n` + formatUserStats(result, user.name).replace(/^📊.*\n\n/, ""), { parse_mode: "Markdown" });
}

function handleMonthInput(chatId, uid, arg) {
  clearState(chatId);
  const user = db.getUserByUid(uid);
  if (!user) return;
  let year, month;
  if (arg.toLowerCase() === "текущий" || arg.toLowerCase() === "сейчас") {
    const now = new Date(); year = now.getFullYear(); month = now.getMonth() + 1;
  } else {
    const match = arg.match(/^(\d{4})-(\d{2})$/);
    if (!match) { bot.sendMessage(chatId, "Не понял. Напиши *текущий* или `2025-11`", { parse_mode: "Markdown" }); return; }
    year = parseInt(match[1]); month = parseInt(match[2]);
  }
  const from  = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 1);
  const to    = toDate.toISOString();
  const sessions = db.getSessionsForUser(user.id).filter(
    s => s.played_at >= from && s.played_at < to
  );
  const label = `${year}-${String(month).padStart(2, "0")}`;
  const result = aggregateStats(sessions, user.id);
  bot.sendMessage(chatId, `📊 *${user.name}* за ${label}\n\n` + formatUserStats(result, user.name).replace(/^📊.*\n\n/, ""), { parse_mode: "Markdown" });
}

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🎱 Billiard bot started");
