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

legacy_thread_approval_count() {
    local state_db="${CODEX_HOME:-$HOME/.codex}/state_5.sqlite"

    if [ ! -f "$state_db" ]; then
        printf '%s\n' "unknown"
        return 0
    fi

    python3 - "$state_db" <<'PY'
import sqlite3
import sys

path = sys.argv[1]
try:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
except sqlite3.Error:
    print("unknown")
    raise SystemExit(0)

try:
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM threads WHERE approval_mode LIKE '%granular%'")
    print(int(cur.fetchone()[0] or 0))
finally:
    conn.close()
PY
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
    UPDATER_STATUS="unknown"
    UPDATER_READY="unknown"
    UPDATER_PACKAGE=""

    if ! command -v codex-update-manager >/dev/null 2>&1; then
        printf '  codex-update-manager: not installed\n'
        return 0
    fi

    status_output="$(codex-update-manager status --json 2>&1 || true)"
    case "$status_output" in
        \{*)
            eval "$(
                python3 - "$status_output" <<'PY'
import json
import shlex
import sys

data = json.loads(sys.argv[1])
status = data.get("status", "unknown")
state = data.get("state", {})
update = state.get("update", {})
ready = update.get("ready", None)
package = update.get("package_path") or update.get("packagePath") or update.get("path") or ""

print(f"UPDATER_STATUS={shlex.quote(str(status))}")
print(f"UPDATER_READY={shlex.quote('unknown' if ready is None else ('true' if bool(ready) else 'false'))}")
print(f"UPDATER_PACKAGE={shlex.quote(str(package))}")
PY
            )"
            printf '  status:        %s\n' "$UPDATER_STATUS"
            if [ "$UPDATER_READY" != "unknown" ]; then
                printf '  update ready:  %s\n' "$UPDATER_READY"
            fi
            if [ -n "$UPDATER_PACKAGE" ]; then
                printf '  package:       %s\n' "$UPDATER_PACKAGE"
            fi
            return 0
            ;;
    esac

    printf '  codex-update-manager: installed, status unavailable\n'
    if [ -n "$status_output" ]; then
        printf '  reason:        %s\n' "${status_output%%$'\n'*}"
    fi
}

report_thread_state() {
    local state_db="${CODEX_HOME:-$HOME/.codex}/state_5.sqlite"
    local thread_count

    thread_count="$(legacy_thread_approval_count)"
    if [ "$thread_count" = "unknown" ]; then
        printf '  legacy thread approvals: unavailable\n'
        return 0
    fi
    if [ "$thread_count" = "0" ]; then
        printf '  legacy thread approvals: clean\n'
        return 0
    fi

    if [ ! -f "$state_db" ]; then
        printf '  legacy thread approvals: no Codex state database found\n'
        return 0
    fi

    python3 - "$state_db" <<'PY'
import sqlite3
import sys

path = sys.argv[1]
try:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
except sqlite3.Error as exc:
    print(f"  legacy thread approvals: unavailable ({exc})")
    raise SystemExit(0)

try:
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) FROM threads WHERE approval_mode LIKE '%granular%'"
    )
    count = int(cur.fetchone()[0] or 0)
    if count == 0:
        print("  legacy thread approvals: clean")
        raise SystemExit(0)

    cur.execute(
        "SELECT title, cwd FROM threads WHERE approval_mode LIKE '%granular%' ORDER BY updated_at_ms DESC LIMIT 3"
    )
    rows = cur.fetchall()
    print(f"  legacy thread approvals: {count} thread(s) need repair")
    for title, cwd in rows:
        label = title.strip() if isinstance(title, str) and title.strip() else "(untitled thread)"
        location = cwd or "unknown cwd"
        print(f"    - {label} @ {location}")
finally:
    conn.close()
PY
}

report_next_action() {
    local upstream_diff fork_diff upstream_ahead upstream_behind fork_ahead fork_behind thread_count

    upstream_diff="$(rev_count HEAD upstream/main)"
    fork_diff="$(rev_count HEAD origin/main)"
    set -- $upstream_diff
    upstream_ahead="${1:-unknown}"
    upstream_behind="${2:-unknown}"
    set -- $fork_diff
    fork_ahead="${1:-unknown}"
    fork_behind="${2:-unknown}"
    thread_count="$(legacy_thread_approval_count)"

    if [ "$thread_count" != "unknown" ] && [ "$thread_count" != "0" ]; then
        printf '  - close Codex Desktop, then reopen it once to let the launcher repair legacy threads\n'
        printf '  - if you also want the repo refreshed first, run `make easy-update`\n'
        return 0
    fi

    if [ "$upstream_behind" != "unknown" ] && [ "$upstream_behind" -gt 0 ] 2>/dev/null; then
        printf '  - run `make easy-update` to sync from upstream and reinstall\n'
        return 0
    fi

    if [ "$fork_ahead" != "unknown" ] && [ "$fork_ahead" -gt 0 ] 2>/dev/null; then
        printf '  - run `make publish-fork` to save local changes to your fork\n'
        return 0
    fi

    if [ "${UPDATER_READY:-unknown}" = "true" ]; then
        printf '  - install the ready update from Codex Desktop or run `codex-update-manager install-ready`\n'
        return 0
    fi

    printf '  - no action required right now\n'
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

print_section "Codex State"
report_thread_state

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
report_next_action
printf '  - Use `make backup-sync` before syncing upstream\n'
printf '  - Use `make sync-upstream` to pull the latest wrapper changes\n'
printf '  - Use `make publish-fork` to save your local improvements to your fork\n'
printf '  - Use `make status-all` on the travel laptop at startup or before work\n'
