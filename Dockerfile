# Reproducible production image (Node 22, no Nixpacks / Railway npm cache quirks).
FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["bash", "scripts/railway-start.sh"]
