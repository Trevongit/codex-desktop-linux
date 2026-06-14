# G-CODEX_ROOT_CERTIFICATE_ENGINEER_HANDOFF.md

**Date:** 2026-06-14  
**Prepared by:** Macro Managing Director (MD) for G-Codex ecosystem  
**Target repo:** `/home/trev/Desktop/comuse/codex-desktop-linux`  
**Purpose:** Engineer handoff note for the local root certificate in this repo. MD will not push this repo.

## 1. What `G-CODEX_ROOT_CERTIFICATE.md` is

A visible root-level identity and safety marker.

It tells future Trevor, MD, Codex, Grok, or other agents whether this folder is:
- ✅ ACTIVE DEVELOPMENT ROOT
- ✅ ACTIVE OPERATIONAL ROOT
- 👁️ READ-ONLY REFERENCE
- 🧪 DEV WORKTREE
- 🗄️ HISTORICAL ROOT
- ⚠️ OLD / INACTIVE / AVOID
- ❓ UNCERTAIN — VERIFY FIRST

## 2. Why the certificate exists

Trevor has multiple local clones/worktrees/reference folders across the filesystem (worktrees/, Desktop/, Documents/, APPDEV/, PROJECTS/, etc.).

Wrong-folder development is a real risk (e.g., editing in an old/historical/uncertain clone by mistake).

The certificate reduces mistakes by forcing a pre-work identity check before any development, synthesis, or coordination work.

## 3. What the local certificate currently says for this repo

**Path:** `/home/trev/Desktop/comuse/codex-desktop-linux`

**Classification:** `✅ ACTIVE DEVELOPMENT ROOT`

**Organ:** codex-desktop-linux

**Local role:** Active dev root

**Absolute path:** /home/trev/Desktop/comuse/codex-desktop-linux

**GitHub remote + default branch:** https://github.com/Trevongit/codex-desktop-linux.git (main)

**Safe terminal launch command:** cd /home/trev/Desktop/comuse/codex-desktop-linux

**Last MD check timestamp:** 2026-06-13

**Use this folder for:** Codex desktop Linux development, ahead commits indicate active work.

**Do not use this folder for:** Other organs.

**Required pre-work checks:**
- pwd
- git remote -v
- git status --short --branch
- check this certificate before work

(The certificate file itself was added locally via path-specific commit `ae47b41 chore: add G-CODEX root certificate`.)

## 4. Safety principle

Never assume a folder is active just because it is a Git repo (or clean, or has recent commits).

Git state alone is not enough to identify the active organ root — especially for development roots with ahead commits or runtime organs.

Always check:
- `pwd`
- `git remote -v`
- `git status --short --branch`
- `G-CODEX_ROOT_CERTIFICATE.md` (and re-read any associated handoff or map)

See also the G-CODEX_ROOT_CERTIFICATE_STANDARD.md (principle for runtime/app organs and operational evidence).

## 5. Why MD is not pushing this repo

- At the time of the MD review, this repo was already 19 commits ahead of `upstream/main` before the certificate commit (then 20 ahead of `upstream/main`).
- Those 19 development commits were already present on Trevor's `origin/main`; they were not additional unpushed commits that a normal push to Trevor's fork would introduce.
- The repo still had meaningful upstream divergence and engineer-owned history that needed review before any integration or publication decision.
- The Codex Desktop Linux engineer/workflow (not MD) should review the existing ahead commits and decide how/when to integrate or push them.
- Per MD push-readiness review (2026-06-14): this repo is classified `🚫 DO NOT PUSH FROM MD — ENGINEER WORKFLOW SHOULD HANDLE`.

MD performed only the local certificate preservation commit (path-specific) and this handoff note. No push was or will be done by MD for this repo in the current slice.

## 6. Recommended engineer action

- Review the existing ahead commits (see `git log --oneline --max-count=20` or full history).
- Confirm the repo is truly the active development root (cross-check with operational evidence: recent builds, local tests, launcher usage, etc.).
- Decide whether to include `G-CODEX_ROOT_CERTIFICATE.md` in the next normal codex-desktop-linux push/PR (or rebase/squash as appropriate for the workflow).
- Keep publication under the engineer workflow until upstream divergence and the intended branch scope are understood.
- After any push decision, re-verify the certificate is still present and up-to-date.
- Update this handoff note if the classification or push strategy changes.

## 7. Relationship to wider G-CODEX safety system

This certificate is part of the wider local organ safety layer (root certificates + LOCAL_ORGAN_ROOTS_AND_SYNC_MAP.md + G_CODEX_ROOT_CERTIFICATE_STANDARD.md).

Other active roots (g-codex-md, g-codex-central-intel dev, g-code-brain-template-private, local-gemma-workflow, thai-teacher, Tailscale-GUI-Manager primary) have similar certificates.

The system is preparing for a future harmonious local layout (active/reference/worktrees/archive/uncertain under a central CODEX-ORGANS parent — see macro-managing-director/synthesis/2026-06-14--harmonious-local-organ-layout-plan.md), but no relocation has happened yet. All current work remains in existing scattered paths.

This handoff ensures the codex-desktop-linux engineer workflow owns its own push and history decisions.

---

**MD contact:** This note prepared by the Macro Managing Director instance (g-codex-md harness) per green light refinement 2026-06-14. All actions were review + targeted write/commit in this repo only. No other repos were modified or pushed.

**Person as Prime. The system builds itself through me.**
