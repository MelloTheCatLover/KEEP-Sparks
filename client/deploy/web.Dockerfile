# Build the SPA, then serve it with Caddy (which also reverse-proxies /api).
# Build context is the repo root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# Prod uses relative "/api" (no VITE_API_BASE_URL needed).
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
