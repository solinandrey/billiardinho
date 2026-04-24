FROM node:20-alpine

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install bot dependencies
COPY package*.json ./
RUN npm install

# Install and build React webapp
COPY webapp-react/package*.json ./webapp-react/
RUN npm --prefix webapp-react install

COPY webapp-react/ ./webapp-react/
RUN npm --prefix webapp-react run build

# Copy bot source
COPY src/ ./src/
COPY import.js ./
COPY migrate.js ./

# Data directory for SQLite persistence
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/billiard.db

CMD ["sh", "-c", "node import.js && node migrate.js && node src/bot.js"]
