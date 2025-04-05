FROM node:18-slim

# Install system dependencies (including postgresql-client)
RUN apt-get update && apt-get install -y openssl python3 make g++ postgresql-client

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
# COPY prisma/migrations ./prisma/migrations

RUN npm install && npx prisma generate

COPY . .

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]