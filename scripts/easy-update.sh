#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[update] Working tree has changes. Commit, stash, or discard them before updating." >&2
  git status --short --branch >&2
  exit 1
fi

echo "[update] Creating a backup branch"
make backup-sync

echo "[update] Syncing from upstream"
make sync-upstream

echo "[update] Reinstalling the updated build"
make deploy
