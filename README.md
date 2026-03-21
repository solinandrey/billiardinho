# 🎱 Billiard Bot

Telegram-бот для записи партий в бильярд. Хранит результаты в SQLite, умеет показывать статистику за любой период.

---

## Быстрый старт (локально)

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env файл
cp .env.example .env
# Вставить свой BOT_TOKEN

# 3. Создать папку для базы данных
mkdir data

# 4. Запустить
npm start
```

---

## Как пользоваться

| Действие | Что написать боту |
|---|---|
| Записать счёт | `3-1` или `3:1` |
| Общая статистика | `/stats` |
| Последние 10 сессий | `/sessions` |
| Последние N сессий | `/sessions 5` |
| Текущий месяц | `/month` |
| Конкретный месяц | `/month 2025-11` |
| Последние 3 недели | `/period 3w` |
| Последние 2 месяца | `/period 2m` |
| Произвольный период | `/period 2025-01-01 2025-03-01` |
| Отменить последнее | `/undo` |

---

## Деплой на Railway (рекомендуется, бесплатно)

Railway — самый простой вариант. Бесплатный план покрывает лёгкий бот с запасом.

### Шаги:

1. Зарегистрируйся на [railway.app](https://railway.app)
2. Залей проект на GitHub (просто создай репозиторий и `git push`)
3. В Railway: **New Project → Deploy from GitHub repo**
4. В разделе **Variables** добавь:
   - `BOT_TOKEN` = твой токен от @BotFather
5. В разделе **Volumes** создай volume и примонтируй к `/app/data` — это нужно, чтобы база не терялась при рестартах
6. Нажми **Deploy** — готово!

---

## Альтернатива: VPS + Docker

Если есть любой VPS (Hetzner, DigitalOcean, и т.д.):

```bash
# На сервере:
git clone <твой репо>
cd billiard-bot
cp .env.example .env
nano .env   # вставить BOT_TOKEN
mkdir data
docker compose up -d
```

Бот запустится и будет автоматически рестартовать при падении.

---

## Конфигурация имён игроков

Открой `src/config.js` и поменяй имена:

```js
export const PLAYER1 = "Andrey";  // ← твоё имя
export const PLAYER2 = "Friend";  // ← имя друга
```

---

## Структура проекта

```
billiard-bot/
├── src/
│   ├── bot.js        — основная логика, обработка команд
│   ├── db.js         — работа с SQLite базой данных
│   ├── parser.js     — парсинг счёта из сообщения
│   ├── formatter.js  — форматирование ответов
│   └── config.js     — имена игроков
├── data/             — папка для billiard.db (создать вручную)
├── .env.example      — шаблон переменных окружения
├── Dockerfile
├── docker-compose.yml
└── package.json
```
