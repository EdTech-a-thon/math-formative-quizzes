#!/usr/bin/env bash

# This file is sourced by the production scripts.
set -a
if [[ -f "${FACT_FRIENDS_ENV_FILE:-.env.production}" ]]; then
  # shellcheck disable=SC1090
  source "${FACT_FRIENDS_ENV_FILE:-.env.production}"
fi
set +a

export NODE_ENV="${NODE_ENV:-production}"
export ADDRESS="${ADDRESS:-0.0.0.0}"
export PORT="${PORT:-8000}"
export ORIGIN="${ORIGIN:-https://math-formative-quizzes.edtechathon.com}"
export POCKETBASE_DATA_DIR="${POCKETBASE_DATA_DIR:-pb_data}"
export POCKETBASE_BACKUP_DIR="${POCKETBASE_BACKUP_DIR:-pb_backups}"
