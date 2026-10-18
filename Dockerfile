# syntax=docker/dockerfile:1
# Imaginile de producție (D-081): `server` (Colyseus + Fastify) și `web` (Caddy cu clientul web + TLS).
# Se construiesc din deploy/docker-compose.yml; vezi docs/deploy.md.

FROM node:22-alpine AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=1
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM build AS server-build
RUN pnpm --filter @fitil/server build \
  && pnpm --filter @fitil/server deploy --legacy --prod /out

FROM build AS web-build
ARG VITE_SERVER_URL
ARG VITE_API_URL
ARG VITE_WEB_URL
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST=https://eu.i.posthog.com
ARG VITE_SENTRY_DSN
ARG VITE_STORE_IOS
ARG VITE_STORE_ANDROID
RUN pnpm --filter @fitil/client... build

FROM node:22-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-build /out .
USER node
EXPOSE 2567 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /repo/apps/client/dist /srv
