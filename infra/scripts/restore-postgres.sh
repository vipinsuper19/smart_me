#!/usr/bin/env bash
#
# Restore a SmartMe PostgreSQL backup into a target database.
#
# Required:
#   DATABASE_URL          Target connection string (the database is overwritten)
#   RESTORE_CONFIRM=yes   Explicit confirmation; prevents accidental production restores
#   DUMP_FILE             Path to a pg_dump custom-format file
#
# Example (restore drill into a staging database):
#   DATABASE_URL=postgresql://.../smartme_restore \
#     RESTORE_CONFIRM=yes DUMP_FILE=./backups/smartme-20261104T120000Z.dump \
#     ./infra/scripts/restore-postgres.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DUMP_FILE:?DUMP_FILE is required}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=yes after verifying the target database}"

if [ "$RESTORE_CONFIRM" != "yes" ]; then
  echo "Refusing to restore without RESTORE_CONFIRM=yes." >&2
  exit 1
fi

command -v pg_restore >/dev/null 2>&1 || {
  echo "pg_restore is not installed or not on PATH." >&2
  exit 1
}

[ -f "$DUMP_FILE" ] || {
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
}

pg_restore --list "$DUMP_FILE" >/dev/null

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --dbname="$DATABASE_URL" \
  "$DUMP_FILE"

echo "Restore complete. Run /health/ready and a smoke test against the restored database."
