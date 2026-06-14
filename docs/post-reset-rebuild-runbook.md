# Post-Reset Rebuild Runbook

Use this after the quota reset when you want to refresh the installed Linux app
from the current checkout and then verify the result cleanly.

## Scope

This runbook assumes:

- the working tree is already in the state you want to test
- the currently installed app may still be running from `/opt/codex-desktop`
- you want a normal engineer-owned rebuild and reinstall
- you do not want to push new code as part of the rebuild step

This is an operational runbook, not an upstream-sync guide.

## Preflight

From the repo root:

```bash
git status --short --branch
make report
```

Confirm:

- you are on the intended branch
- the tree is clean or only contains changes you explicitly want in the rebuild
- the report does not show a conflicting updater/install problem that must be
  resolved first

## Stop The Running App

Close Codex Desktop before rebuilding over the installed package.

If the desktop app is still open, exit it normally first. Then verify the user
service and launcher are not still holding the live instance:

```bash
systemctl --user status codex-update-manager.service
pgrep -af codex-desktop
```

If `pgrep` still shows the live GUI instance, wait a moment and check again
before continuing.

## Rebuild And Reinstall

If dependencies are already in place, use:

```bash
make install-native
```

If you want the full native bootstrap flow instead:

```bash
make bootstrap-native
```

`make install-native` is the normal choice for an existing development machine.
It rebuilds `codex-app/`, builds the native package for the current distro, and
installs the newest artifact from `dist/`.

## Immediate Verification

After install completes, verify the package and updater state:

```bash
make report
codex-update-manager status --json
```

Then start the app and verify the refreshed behavior:

```bash
codex-desktop
```

Check for:

- the app launches cleanly
- the expected branch-built behavior is present
- no duplicate-launch problem appears
- no immediate launcher or updater error is reported

## If You Need A Lower-Risk Probe First

Before reinstalling over the live system package, you can generate a side-by-side
candidate build:

```bash
./scripts/rebuild-candidate.sh ./Codex.dmg
```

That path is useful when you want to inspect the rebuilt app first without
replacing the current `/opt/codex-desktop` install.

## If It Fails

Use these first:

```bash
sed -n '1,160p' ~/.local/state/codex-update-manager/service.log
sed -n '1,160p' ~/.cache/codex-desktop/launcher.log
systemctl --user status codex-update-manager.service
```

If the rebuild itself fails, rerun the relevant focused checks:

```bash
bash tests/scripts_smoke.sh
node --test scripts/patch-linux-window-ui.test.js
cargo test -p codex-update-manager
```

## Recommended Sequence For The Next Session

1. Verify branch and tree with `git status --short --branch`.
2. Close Codex Desktop completely.
3. Run `make install-native`.
4. Run `make report`.
5. Launch `codex-desktop`.
6. Check the rebuilt behavior and launcher/updater health.
