#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Waiting for Postgres..."
until node -e "require('net').createConnection({host: 'db', port: 5432}).on('connect', () => {console.log('ok'); process.exit(0)}).on('error',()=>process.exit(1))" >/dev/null 2>&1; do
  sleep 1
done

echo "[entrypoint] Prisma generate/migrate"
pnpm prisma generate
pnpm prisma migrate deploy || pnpm prisma db push

echo "[entrypoint] Seeding database (idempotent)"
pnpm tsx prisma/seed.ts || true

echo "[entrypoint] Starting dev server"
pnpm dev

