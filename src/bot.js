import TelegramBot from "node-telegram-bot-api";
import { db } from "./db.js";
import { getState, setState, clearState } from "./fsm.js";
import { startApiServer } from "./api.js";

startApiServer();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function webAppButton(chatId, label = "🎱 Открыть приложение") {
  if (!process.env.WEBAPP_URL) return null;
  return { text: label, web_app: { url: `${process.env.WEBAPP_URL}?uid=${chatId}` } };
}

/** Единственное сообщение для зарегистрированного пользователя — открыть мини-апп. */
function sendOpenApp(chatId, text) {
  const btn = webAppButton(chatId);
  const reply_markup = btn
    ? { keyboard: [[btn]], resize_keyboard: true, is_persistent: true }
    : { remove_keyboard: true };
  bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup });
}

const CANCEL_KEYBOARD = {
  keyboard: [[{ text: "❌ Отмена" }]],
  resize_keyboard: true,
};

function askWithCancel(chatId, text) {
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

  // 1. Уже зарегистрирован → сразу кнопка открыть
  let user = db.getUserByUid(uid);
  if (user) {
    sendOpenApp(chatId, `С возвращением, *${user.name}*! 🎱`);
    return;
  }

  // 2. Есть запись без uid (по username) — связываем
  if (username) {
    const existing = db.getUserByUsername(username);
    if (existing && !existing.uid) {
      db.linkUserUid(existing.id, uid);
      sendOpenApp(chatId, `С возвращением, *${existing.name}*! 🎱`);
      return;
    }
  }

  // 3. Новый пользователь → спрашиваем имя
  setState(chatId, "register_confirm_name", { suggestedName: telegramName });
  askNameConfirm(
    chatId,
    `Привет! 🎱 Я веду счёт партий в бильярд.\n\nКак тебя зовут?`,
    telegramName
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  sendOpenApp(msg.chat.id, `Всё управление в мини-приложении. Открой его кнопкой ниже 👇`);
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
    if (user) sendOpenApp(chatId, "Отменено.");
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

  // ── Любое другое сообщение — отсылаем к мини-аппу ───────────────────────────
  const user = db.getUserByUid(uid);
  if (!user) {
    bot.sendMessage(chatId, "Сначала запусти /start чтобы зарегистрироваться.");
    return;
  }
  sendOpenApp(chatId, `Всё управление в мини-приложении. Открой его кнопкой ниже 👇`);
});

// ─── Helpers: регистрация ─────────────────────────────────────────────────────
function finishRegistration(chatId, uid, rawUsername, name) {
  const username = rawUsername ? `@${rawUsername}` : null;
  db.createUser(uid, username, name);
  clearState(chatId);
  sendOpenApp(chatId, `Добро пожаловать, *${name}*! 🎱\n\nОткрой мини-приложение, чтобы начать.`);
}

bot.on("polling_error", (err) => console.error("Polling error:", err.message));
console.log("🎱 Billiard bot started");
