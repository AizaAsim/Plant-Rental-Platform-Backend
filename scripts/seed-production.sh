#!/usr/bin/env bash
# Run on the production EC2 host (13.60.32.214). RDS is private — not reachable from your Mac.
#
# The API usually runs in Docker; host may not have npm. This script tries Docker first.
#
#   chmod +x scripts/seed-production.sh
#   ./scripts/seed-production.sh
#   SEED_MODE=scenarios ./scripts/seed-production.sh
#
# Or without the script (replace CONTAINER with name from `docker ps`):
#   docker exec -it CONTAINER sh -c 'cd /app && npx prisma migrate deploy && SEED_MODE=full npx prisma db seed'
set -euo pipefail

SEED_MODE="${SEED_MODE:-full}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_in_repo() {
  cd "$REPO_ROOT"
  if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  echo "== prisma migrate deploy =="
  npx prisma migrate deploy
  echo "== prisma db seed (SEED_MODE=$SEED_MODE) =="
  SEED_MODE="$SEED_MODE" npx prisma db seed
}

find_backend_container() {
  local name
  for name in $(docker ps --format '{{.Names}}' 2>/dev/null); do
    case "$name" in
      *backend*|*mybackend*|*plant*|*api*|*sabonah*)
        echo "$name"
        return 0
        ;;
    esac
  done
  docker ps --format '{{.Names}}' 2>/dev/null | head -1
}

run_in_docker() {
  local container="$1"
  echo "== Using Docker container: $container =="
  if [[ "$SEED_MODE" == "full" ]]; then
    echo "WARNING: SEED_MODE=full DELETES ALL DATA in the database."
    echo "         Press Ctrl+C within 5s to abort..."
    sleep 5
  fi
  docker exec -i "$container" sh -c "
    set -e
    cd /app
    export NODE_OPTIONS='--max-old-space-size=768'
    echo '== prisma migrate deploy =='
    npx prisma migrate deploy
    echo '== prisma db seed (SEED_MODE=$SEED_MODE) =='
    SEED_MODE=$SEED_MODE npx prisma db seed
  "
}

echo "== Production seed (mode=$SEED_MODE) =="

CONTAINER="$(find_backend_container || true)"
if [[ -n "${CONTAINER:-}" ]] && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  run_in_docker "$CONTAINER"
elif command -v npx >/dev/null 2>&1 && [[ -f "$REPO_ROOT/package.json" ]]; then
  if [[ "$SEED_MODE" == "full" ]]; then
    echo "WARNING: SEED_MODE=full DELETES ALL DATA in the database."
    echo "         Press Ctrl+C within 5s to abort..."
    sleep 5
  fi
  run_in_repo
else
  echo ""
  echo "Could not find npm on host or a running backend Docker container."
  echo ""
  echo "Run these on the server to diagnose:"
  echo "  docker ps"
  echo "  ls -la ~"
  echo "  find ~ -maxdepth 3 -name package.json 2>/dev/null"
  echo ""
  echo "Then seed manually (replace MY_CONTAINER):"
  echo "  docker exec -it MY_CONTAINER sh -c 'cd /app && export NODE_OPTIONS=--max-old-space-size=768 && npx prisma migrate deploy && SEED_MODE=penalty npx prisma db seed'"
  exit 1
fi

echo ""
echo "Done. Password: Password123! | Penalty: ORD-SEED-1005 | customer1@example.com"
