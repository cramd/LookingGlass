# ── dev stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── build stage ───────────────────────────────────────────────────────────────
FROM dev AS builder

ARG NEXT_PUBLIC_API_URL=http://localhost:5001
ARG NEXT_PUBLIC_VICTORIALOGS_URL=http://192.168.0.100:9428
ARG NEXT_PUBLIC_GRAFANA_URL=http://192.168.0.100:3001
ARG NEXT_PUBLIC_VM_DIRECT_URL=http://192.168.0.100:8428

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VICTORIALOGS_URL=$NEXT_PUBLIC_VICTORIALOGS_URL
ENV NEXT_PUBLIC_GRAFANA_URL=$NEXT_PUBLIC_GRAFANA_URL
ENV NEXT_PUBLIC_VM_DIRECT_URL=$NEXT_PUBLIC_VM_DIRECT_URL

RUN npm run build

# ── production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "start"]
