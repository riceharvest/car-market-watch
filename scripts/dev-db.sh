#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT_DIR/compose.yaml")
DATABASE_URL="${DATABASE_URL:-postgres://car_market_watch:car_market_watch@localhost:${POSTGRES_PORT:-5433}/car_market_watch}"

usage() {
  cat <<'USAGE'
Usage: scripts/dev-db.sh <command>

Commands:
  up      Start local Postgres
  down    Stop local Postgres
  reset   Stop and remove local Postgres volume, then start again
  wait    Wait until Postgres accepts connections
  setup   Start, wait, and apply db/schema.sql
  logs    Tail Postgres logs
  psql    Open psql using DATABASE_URL or local default
USAGE
}

command="${1:-help}"

case "$command" in
  up)
    "${COMPOSE[@]}" up -d postgres
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  reset)
    "${COMPOSE[@]}" down -v
    "${COMPOSE[@]}" up -d postgres
    "$0" wait
    ;;
  wait)
    for _ in {1..60}; do
      if "${COMPOSE[@]}" exec -T postgres pg_isready -U car_market_watch -d car_market_watch >/dev/null 2>&1; then
        echo 'Postgres is ready.'
        exit 0
      fi
      sleep 1
    done
    echo 'Timed out waiting for Postgres.' >&2
    exit 1
    ;;
  setup)
    "$0" up
    "$0" wait
    if command -v psql >/dev/null 2>&1; then
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/schema.sql"
    else
      "${COMPOSE[@]}" exec -T postgres psql -U car_market_watch -d car_market_watch -v ON_ERROR_STOP=1 < "$ROOT_DIR/db/schema.sql"
    fi
    ;;
  logs)
    "${COMPOSE[@]}" logs -f postgres
    ;;
  psql)
    if command -v psql >/dev/null 2>&1; then
      psql "$DATABASE_URL"
    else
      "${COMPOSE[@]}" exec -it postgres psql -U car_market_watch -d car_market_watch
    fi
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
