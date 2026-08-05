#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
source deploy/load-environment.sh

if [[ ! -x ./pocketbase ]]; then
  echo "PocketBase is missing. Follow deploy/README.md before starting production." >&2
  exit 1
fi
if [[ ! -f build/index.js ]]; then
  echo "The production build is missing. Run bun run production:prepare first." >&2
  exit 1
fi

pocketbase_args=(
  serve
  --http=127.0.0.1:8090
  --dir="$POCKETBASE_DATA_DIR"
  --hooksDir=pb_hooks
  --migrationsDir=pb_migrations
  --hooksWatch=false
)
if [[ -n "${POCKETBASE_ENCRYPTION_ENV:-}" ]]; then
  pocketbase_args+=(--encryptionEnv="$POCKETBASE_ENCRYPTION_ENV")
fi

cleanup() {
  kill "$pocketbase_pid" "$website_pid" 2>/dev/null || true
  wait "$pocketbase_pid" "$website_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

./pocketbase "${pocketbase_args[@]}" &
pocketbase_pid=$!
node build &
website_pid=$!

# If either service stops, exit so the machine's service manager can restart both.
wait -n "$pocketbase_pid" "$website_pid"
