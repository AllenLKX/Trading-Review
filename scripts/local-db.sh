#!/usr/bin/env bash
set -euo pipefail

postgres_bin="${RATIONALTRADE_POSTGRES_BIN:-$HOME/Applications/Postgres.app/Contents/Versions/16/bin}"
postgres_data="${RATIONALTRADE_PGDATA:-$HOME/Library/Application Support/RationalTrade/postgres16}"
postgres_log="${RATIONALTRADE_PGLOG:-$HOME/Library/Application Support/RationalTrade/postgres16.log}"
postgres_port="${RATIONALTRADE_PGPORT:-55432}"

if [[ ! -x "$postgres_bin/pg_ctl" ]]; then
  echo "PostgreSQL binaries were not found at: $postgres_bin" >&2
  exit 1
fi

case "${1:-status}" in
  start)
    if "$postgres_bin/pg_isready" -h 127.0.0.1 -p "$postgres_port" >/dev/null 2>&1; then
      echo "Local PostgreSQL is already running on port $postgres_port."
      exit 0
    fi

    if [[ ! -f "$postgres_data/PG_VERSION" ]]; then
      echo "Local database is not initialized. Run ./scripts/setup-local-db.sh first." >&2
      exit 1
    fi

    mkdir -p "$(dirname "$postgres_log")"
    "$postgres_bin/pg_ctl" -D "$postgres_data" -l "$postgres_log" -o "-p $postgres_port -h 127.0.0.1" start
    ;;
  stop)
    if ! "$postgres_bin/pg_isready" -h 127.0.0.1 -p "$postgres_port" >/dev/null 2>&1; then
      echo "Local PostgreSQL is not running."
      exit 0
    fi

    "$postgres_bin/pg_ctl" -D "$postgres_data" stop
    ;;
  status)
    "$postgres_bin/pg_isready" -h 127.0.0.1 -p "$postgres_port"
    ;;
  *)
    echo "Usage: ./scripts/local-db.sh {start|stop|status}" >&2
    exit 1
    ;;
esac
