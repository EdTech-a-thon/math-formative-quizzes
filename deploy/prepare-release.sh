#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
source deploy/load-environment.sh

if [[ ! -x ./pocketbase ]]; then
  echo "PocketBase is missing. Follow deploy/README.md before preparing a release." >&2
  exit 1
fi

bun install --frozen-lockfile
bun run build

mkdir -p "$POCKETBASE_BACKUP_DIR"
if [[ -d "$POCKETBASE_DATA_DIR" ]]; then
  backup_file="$POCKETBASE_BACKUP_DIR/pb_data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  tar -czf "$backup_file" "$POCKETBASE_DATA_DIR"
  echo "Database backup created at $backup_file"
fi

migration_args=(
  migrate up
  --dir="$POCKETBASE_DATA_DIR"
  --hooksDir=pb_hooks
  --migrationsDir=pb_migrations
)
if [[ -n "${POCKETBASE_ENCRYPTION_ENV:-}" ]]; then
  migration_args+=(--encryptionEnv="$POCKETBASE_ENCRYPTION_ENV")
fi
./pocketbase "${migration_args[@]}"

echo "Release prepared. Restart the production service when ready."
