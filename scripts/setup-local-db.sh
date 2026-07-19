#!/usr/bin/env bash
set -euo pipefail

postgres_bin="${RATIONALTRADE_POSTGRES_BIN:-$HOME/Applications/Postgres.app/Contents/Versions/16/bin}"
postgres_data="${RATIONALTRADE_PGDATA:-$HOME/Library/Application Support/RationalTrade/postgres16}"
postgres_port="${RATIONALTRADE_PGPORT:-55432}"
admin_user="rationaltrade_admin"
app_user="rationaltrade_app"
database_name="rationaltrade"
profile_id="local-owner"

if [[ ! -x "$postgres_bin/initdb" ]]; then
  echo "Install Postgres.app 16 in ~/Applications or set RATIONALTRADE_POSTGRES_BIN." >&2
  exit 1
fi

if [[ ! -f "$postgres_data/PG_VERSION" ]]; then
  mkdir -p "$(dirname "$postgres_data")"
  "$postgres_bin/initdb" \
    -D "$postgres_data" \
    -U "$admin_user" \
    --encoding=UTF8 \
    --locale=C \
    --auth-local=trust \
    --auth-host=trust
fi

RATIONALTRADE_POSTGRES_BIN="$postgres_bin" \
RATIONALTRADE_PGDATA="$postgres_data" \
RATIONALTRADE_PGPORT="$postgres_port" \
  ./scripts/local-db.sh start

if ! "$postgres_bin/psql" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" -d postgres -tAc \
  "select 1 from pg_roles where rolname='$app_user'" | rg -q '^1$'; then
  "$postgres_bin/psql" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" -d postgres -c \
    "create role $app_user login;"
fi

if ! "$postgres_bin/psql" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" -d postgres -tAc \
  "select 1 from pg_database where datname='$database_name'" | rg -q '^1$'; then
  "$postgres_bin/createdb" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" "$database_name"
fi

DATABASE_URL="postgresql://$admin_user@127.0.0.1:$postgres_port/$database_name" \
PATH="$postgres_bin:$PATH" \
  ./scripts/apply-schema.sh

"$postgres_bin/psql" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" -d "$database_name" -v ON_ERROR_STOP=1 -c \
  "insert into profiles (id, email, display_name) values ('$profile_id', 'local@rationaltrade.invalid', 'Local Owner') on conflict (id) do nothing;"

"$postgres_bin/psql" -h 127.0.0.1 -p "$postgres_port" -U "$admin_user" -d "$database_name" -v ON_ERROR_STOP=1 -c \
  "grant usage on schema public to $app_user; grant select, insert, update, delete on all tables in schema public to $app_user; grant usage, select on all sequences in schema public to $app_user;"

echo "Local database is ready. Keep these values in ignored .env.local:"
echo "DATABASE_URL=postgresql://$app_user@127.0.0.1:$postgres_port/$database_name"
echo "RATIONALTRADE_SINGLE_USER_ID=$profile_id"
