# Stage 1: Build environment
FROM node:18-slim AS builder

# Install build tools for native modules
RUN apt-get update && \
    apt-get install -y \
    python3 \
    make \
    g++ \
    postgresql-client \
    openssl

WORKDIR /app

COPY post-service/package*.json ./
COPY post-service/prisma/ ./prisma/

# Install and rebuild native modules
RUN npm ci --include=dev
RUN npx prisma generate

COPY post-service/src/ ./src
COPY shared/ ./shared/

# Create a default .env file if none exists
RUN touch .env

# Stage 2: Production image
FROM node:18-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y \
    postgresql-client \
    openssl \
    && rm -rf /var/lib/apt/lists/*

    WORKDIR /app

    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package*.json ./
    COPY --from=builder /app/prisma ./prisma
    COPY --from=builder /app/src ./src
    COPY --from=builder /app/shared ./shared
    COPY --from=builder /app/.env ./


# Startup command
CMD ["sh", "-c", "while ! pg_isready -h yeet-db -U $YEET_DB_USER -d $YEET_DB_NAME; do echo 'Waiting for database...'; sleep 2; done && npx prisma migrate deploy && node src/index.js"]