# syntax=docker/dockerfile:1

# --- Build Stage ---
FROM node:20-alpine AS builder

# Required build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# --- Production Stage ---
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY static/ ./static/
COPY templates/ ./templates/ 2>/dev/null || true

# Prepare data directory with write permissions for appuser
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
