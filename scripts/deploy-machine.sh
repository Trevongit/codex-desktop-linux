#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_DIR"

echo "[deploy] Installing Codex Desktop Linux"
make bootstrap-native

echo "[deploy] Running workspace report"
make report
