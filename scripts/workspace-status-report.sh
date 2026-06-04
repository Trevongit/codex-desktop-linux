#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

short_ref() {
    git -C "$REPO_DIR" rev-parse --short "$1" 2>/dev/null || printf '%s' "unknown"
}

rev_count() {
    git -C "$REPO_DIR" rev-list --left-right --count "$1...$2" 2>/dev/null || printf '%s' "unknown unknown"
}

print_section() {
    printf '\n[%s]\n' "$1"
}

refresh_remotes() {
    git -C "$REPO_DIR" fetch upstream --prune >/dev/null 2>&1 || true
    git -C "$REPO_DIR" fetch origin --prune >/dev/null 2>&1 || true
}

report_repo_state() {
    local branch local_head upstream_head origin_head upstream_diff fork_diff upstream_ahead upstream_behind fork_ahead fork_behind

    branch="$(git -C "$REPO_DIR" symbolic-ref --quiet --short HEAD 2>/dev/null || printf '%s' "detached")"
    local_head="$(short_ref HEAD)"
    upstream_head="$(short_ref upstream/main)"
    origin_head="$(short_ref origin/main)"
    upstream_diff="$(rev_count HEAD upstream/main)"
    fork_diff="$(rev_count HEAD origin/main)"
    set -- $upstream_diff
    upstream_ahead="${1:-unknown}"
    upstream_behind="${2:-unknown}"
    set -- $fork_diff
    fork_ahead="${1:-unknown}"
    fork_behind="${2:-unknown}"

    printf '  branch:        %s\n' "$branch"
    printf '  local head:    %s\n' "$local_head"
    printf '  upstream/main: %s\n' "$upstream_head"
    printf '  origin/main:   %s\n' "$origin_head"
    printf '  vs upstream:   %s ahead, %s behind\n' "$upstream_ahead" "$upstream_behind"
    printf '  vs fork:       %s ahead, %s behind\n' "$fork_ahead" "$fork_behind"
}

report_updater_state() {
    if ! command -v codex-update-manager >/dev/null 2>&1; then
        printf '  codex-update-manager: not installed\n'
        return 0
    fi

    status_output="$(codex-update-manager status --json 2>&1 || true)"
    case "$status_output" in
        \{*)
            python3 - "$status_output" <<'PY'
import json, sys

data = json.loads(sys.argv[1])
status = data.get("status", "unknown")
state = data.get("state", {})
update = state.get("update", {})
ready = update.get("ready", None)
package = update.get("package_path") or update.get("packagePath") or update.get("path")
print(f"  status:        {status}")
if ready is not None:
    print(f"  update ready:  {ready}")
if package:
    print(f"  package:       {package}")
PY
            return 0
            ;;
    esac

    printf '  codex-update-manager: installed, status unavailable\n'
    if [ -n "$status_output" ]; then
        printf '  reason:        %s\n' "${status_output%%$'\n'*}"
    fi
}

summarize_url() {
    local label="$1"
    local url="$2"
    shift 2

    python3 - "$label" "$url" "$@" <<'PY'
import html
import re
import sys
import urllib.request
from subprocess import run, PIPE

label = sys.argv[1]
url = sys.argv[2]
keywords = [value.lower() for value in sys.argv[3:]]

raw = ""
curl_result = run(["curl", "-fsSL", "-A", "Mozilla/5.0", url], stdout=PIPE, stderr=PIPE, check=False, text=True)
if curl_result.returncode == 0 and curl_result.stdout:
    raw = curl_result.stdout
else:
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            raw = response.read().decode("utf-8", "ignore")
    except Exception as exc:
        print(f"  - {label}: unavailable ({exc})")
        raise SystemExit(0)

raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "\n", raw, flags=re.S | re.I)
raw = re.sub(r"<[^>]+>", "\n", raw)
raw = html.unescape(raw)

lines = []
seen = set()
for line in raw.splitlines():
    line = " ".join(line.split())
    if not line or line in seen:
        continue
    lower = line.lower()
    if keywords and not any(keyword in lower for keyword in keywords):
        continue
    seen.add(line)
    lines.append(line)
    if len(lines) >= 6:
        break

if not lines:
    print(f"  - {label}: no matching highlights found")
else:
    for line in lines:
        print(f"  - {label}: {line}")
PY
}

print_section "Repo"
refresh_remotes
report_repo_state

print_section "Updater"
report_updater_state

print_section "OpenAI"
summarize_url \
    "release notes" \
    "https://help.openai.com/en/articles/6825453-chatgpt-release-notes?stream=top" \
    codex android mobile update release notes
summarize_url \
    "codex site" \
    "https://developers.openai.com/codex/" \
    codex update mobile release notes app

print_section "Next steps"
printf '  - Use `make backup-sync` before syncing upstream\n'
printf '  - Use `make sync-upstream` to pull the latest wrapper changes\n'
printf '  - Use `make publish-fork` to save your local improvements to your fork\n'
printf '  - Use `make status-all` on the travel laptop at startup or before work\n'
