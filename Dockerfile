FROM node:20-alpine

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src/ ./src/

# Data directory for SQLite persistence
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/billiard.db

CMD ["node", "src/bot.js"]
