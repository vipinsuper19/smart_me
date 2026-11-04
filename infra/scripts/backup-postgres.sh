#!/usr/bin/env bash
#
# Back up the SmartMe PostgreSQL database in pg_dump custom format.
#
# Required:
#   DATABASE_URL          PostgreSQL connection string
# Optional:
#   BACKUP_DIR            Destination directory (default: ./backups)
#   BACKUP_RETENTION_DAYS Keep this many days of backups (default: 30)
#
# Example:
#   DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/smartme \
#     ./infra/scripts/backup-postgres.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump is not installed or not on PATH." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/smartme-$timestamp.dump"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$file" \
  "$DATABASE_URL"

# A custom-format dump is not a valid archive if the write was interrupted.
pg_restore --list "$file" >/dev/null

echo "$file"
find "$BACKUP_DIR" -type f -name 'smartme-*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete

echo "Backup complete: $file"
