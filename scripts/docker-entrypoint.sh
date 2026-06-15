#!/bin/sh
# Container entrypoint: bring the schema up to date, then start the server.
# `exec` replaces the shell with Node so SIGTERM/SIGINT reach it directly and the
# Next.js server can drain in-flight requests on shutdown.
set -e

echo "[entrypoint] applying database migrations…"
node scripts/migrate.mjs

echo "[entrypoint] starting BragBit…"
exec node server.js
