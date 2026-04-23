FROM node:20-alpine

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY webapp/ ./webapp/
COPY import.js ./
COPY migrate.js ./

# Data directory for SQLite persistence
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/billiard.db

CMD ["sh", "-c", "node import.js && node migrate.js && node src/bot.js"]
