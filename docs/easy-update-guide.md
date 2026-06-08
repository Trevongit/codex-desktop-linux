# Easy Update Guide

Use this when you want the simplest safe update path for Codex Desktop Linux.

## One Command

From the repo root, run:

```bash
make easy-update
```

That will:

- create a backup branch first
- pull the latest changes from `ilysenko/codex-desktop-linux`
- rebuild and reinstall Codex Desktop Linux
- print a report at the end

## What To Do After

When the update finishes:

- close Codex Desktop if it is open
- start it again from the menu or desktop icon
- if you want to confirm the state, run `make report`

## If It Stops

If the update stops because the working tree has changes, decide which of these you want first:

- commit the changes
- stash the changes
- discard the changes

If it stops because of an old Rust/Cargo setup, rerun the command after the installer finishes bootstrapping Rust.

## Roll Back

If the update causes trouble, use the backup branch name that `make easy-update`
printed and switch back to it:

```bash
git switch main
git reset --hard backup-YYYYMMDD-HHMMSS
```

## When To Use It

- Use it on the travel laptop when you want a safe refresh from upstream.
- Use it on a home box if you want one simple update path and do not want to
  think about the individual steps.
- Use `make report` on any machine when you only want a status check.
