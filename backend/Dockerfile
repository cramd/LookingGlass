# ── dev stage ────────────────────────────────────────────────────────────────
FROM node:18-alpine AS dev

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]

# ── build stage ───────────────────────────────────────────────────────────────
FROM dev AS builder
RUN npm run build

# ── production stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000
CMD ["npm", "start"]
