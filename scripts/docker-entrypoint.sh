#!/bin/sh
set -e

cd /app

echo "== prisma migrate deploy =="
npx prisma migrate deploy

echo "== starting API =="
exec node dist/main.js
