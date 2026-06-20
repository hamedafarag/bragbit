# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# BragBit production image — multi-stage, Next.js standalone output.
#
#   deps     install the full dependency set (fresh, so native modules build for
#            this image's musl libc)
#   builder  compile the app into a self-contained `.next/standalone` server
#   runner   a slim, non-root image with only the standalone server, static
#            assets, and the DB migrator (run on container start)
#
# Build:  docker build -t bragbit .
# Run:    see docker-compose.yml (app + Postgres in one `docker compose up`)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:26-alpine AS base
# libc6-compat smooths over glibc-vs-musl edges for Next.js on Alpine.
RUN apk add --no-cache libc6-compat
# pnpm comes from corepack, pinned by package.json's `packageManager` field.
RUN corepack enable
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts skips the dev-only `prepare` hook (lefthook needs git, absent
# here) and dependency postinstalls; @node-rs/argon2 ships prebuilt binaries, so
# nothing needs a build step. The cache mount persists the pnpm store across builds.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder DATABASE_URL / BETTER_AUTH_SECRET (inlined on the build step, not
# persisted as image ENV) so src/lib/env.ts validates. `next build` renders routes
# dynamically and never opens a DB connection, so they're never used to connect —
# real values are supplied at runtime (docker-compose / env).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
  BETTER_AUTH_SECRET=build-time-placeholder-overridden-at-runtime \
  pnpm build

# ── runner ───────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The standalone server, plus the static assets and public/ it doesn't bundle.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# DB migrations + the migrator + the entrypoint that applies them before boot.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./migrations
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh \
  && mkdir -p ./.data/uploads \
  && chown -R nextjs:nodejs ./.data

USER nextjs
EXPOSE 3000

# Runs pending migrations, then `exec node server.js` (so SIGTERM reaches Node for
# a graceful shutdown). Compose sets `init: true` to reap the entrypoint shell.
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
