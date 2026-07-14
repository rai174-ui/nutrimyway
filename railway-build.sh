#!/usr/bin/env bash
# Railway build pipeline for NutriMyWay.
#
# Builds both frontends (member app at "/", admin panel at "/admin") and the
# API server, then assembles the frontend output into the API server's
# dist/public directory so the single Express service can serve everything
# (see artifacts/api-server/src/app.ts for the static-serving logic).
set -euo pipefail

# Limit Node memory to prevent OOM on Railway 500MB instances
export NODE_OPTIONS="--max_old_space_size=410"
echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Typechecking shared libs"
pnpm run typecheck:libs

echo "==> Building member app (served at /)"
PORT=8080 BASE_PATH=/ pnpm --filter @workspace/nutrimyway run build

echo "==> Building admin panel (served at /admin)"
BASE_PATH=/admin pnpm --filter @workspace/nutrimyway-admin run build

echo "==> Building API server"
pnpm --filter @workspace/api-server run build

echo "==> Assembling static assets into api-server/dist/public"
rm -rf artifacts/api-server/dist/public
mkdir -p artifacts/api-server/dist/public/admin
cp -r artifacts/nutrimyway/dist/public/. artifacts/api-server/dist/public/
cp -r artifacts/nutrimyway-admin/dist/public/. artifacts/api-server/dist/public/admin/

echo "==> Build complete"
