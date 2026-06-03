# Fork And Upstream Workflow

This repository is often used in a fork-and-sync setup:

- `upstream` points to `https://github.com/ilysenko/codex-desktop-linux`
- `origin` points to your fork, such as `https://github.com/Trevongit/codex-desktop-linux`
- local development happens on feature branches
- upstream updates are pulled into `main`
- your own changes are pushed only to the fork

This keeps the local repo aligned with the original project while preserving
your custom changes in a separate GitHub repository.

## Recommended Remote Layout

After cloning or reconfiguring the repo, use this layout:

```bash
git remote rename origin upstream
git remote add origin https://github.com/Trevongit/codex-desktop-linux.git
git config remote.pushDefault origin
git branch --set-upstream-to=upstream/main main
git fetch upstream --prune
git fetch origin --prune
```

Verify the result:

```bash
git remote -v
git branch -vv
```

## Daily Workflow

Start from a clean sync branch:

```bash
git switch main
git pull --ff-only upstream main
```

Create a branch for your own change:

```bash
git switch -c trev/short-description
```

When the change is ready, push it to your fork:

```bash
git push -u origin HEAD
```

If you want to keep the current work locally without publishing it, stay on
the feature branch and do not push.

## Safe Update And Rollback

Before syncing a larger upstream change, create a backup branch:

```bash
make backup-sync
```

If the update is not acceptable, roll back to the saved branch name:

```bash
git switch main
git reset --hard backup-YYYYMMDD-HHMMSS
```

Use the exact backup branch name printed by `make backup-sync`.

## Local Shortcuts In This Repo

This workspace is configured with these aliases:

- `git sync-upstream` — fetch and fast-forward `main` from `upstream`
- `git publish-fork` — push the current branch to your fork
- `git rollback-local` — restore the saved backup point used in this workspace

The repository also provides matching `make` targets:

```bash
make sync-upstream
make backup-sync
make publish-fork
make status-all
```

These are the preferred shortcuts for day-to-day use in this repo.

`make status-all` is the quickest way to see:

- whether your local repo is ahead or behind `ilysenko/main`
- whether your fork has the same tip as your local branch
- whether `codex-update-manager` reports a ready or pending update

## Practical Rule

Only one GitHub repo should receive your custom changes:

- `ilysenko/codex-desktop-linux` is the source of upstream updates
- `Trevongit/codex-desktop-linux` is where your work should land

That separation keeps update flow predictable and avoids accidental pushes back
to the original project.
