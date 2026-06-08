# Home Machine Terminal Setup

Use this on the always-on Linux Mint computer that you want to keep stable.
It assumes you want the same Codex Desktop Linux workflow as the travel
laptop, but with less day-to-day editing.

## 1. Update The System

Run the normal system update first:

```bash
sudo apt update
sudo apt upgrade -y
```

If a reboot is requested, reboot before continuing:

```bash
test -f /var/run/reboot-required && echo reboot-required
```

## 2. Clone Your Fork

```bash
mkdir -p ~/Apps/COMP
cd ~/Apps/COMP
git clone https://github.com/Trevongit/codex-desktop-linux.git
cd codex-desktop-linux
```

If the repo already exists, just enter it and pull the latest changes:

```bash
cd ~/Apps/COMP/codex-desktop-linux
git pull --ff-only origin main
```

## 3. Install Codex Desktop

Run the one-command deploy path:

```bash
make deploy
```

That will:

- install or refresh the native package
- build the app from the repo
- print a status report at the end

If the machine already has old system Cargo and `make deploy` complains about
`Cargo.lock` version 4, run:

```bash
source "$HOME/.cargo/env" 2>/dev/null || true
cargo --version
```

If `cargo` is still old or missing, let `make deploy` run again after the
installer has bootstrapped Rust. The repo now prefers the Rustup toolchain when
it is available.

## 4. Add The Desktop Shortcuts

If you want clickable icons in the menu and on the desktop:

```bash
./contrib/user-local-install/install-user-local.sh
```

That gives you:

- `Codex Desktop (Local)`
- `Codex Desktop Report`
- `Codex Desktop Deploy`

## 5. Daily Check

Use this when you want a quick status report:

```bash
cd ~/Apps/COMP/codex-desktop-linux
make report
```

## 6. Keep It In Sync

For the easiest safe update path, use:

```bash
make easy-update
```

That creates a backup branch, syncs the latest upstream changes, rebuilds the
app, and prints a report.

If you want to run the steps yourself before a larger update from the original
repo:

```bash
cd ~/Apps/COMP/codex-desktop-linux
make backup-sync
make sync-upstream
make report
```

If you want to publish your local changes to your fork:

```bash
make publish-fork
```

## 7. Roll Back If Needed

If an upstream update causes trouble, use the backup branch name that
`make backup-sync` printed:

```bash
git switch main
git reset --hard backup-YYYYMMDD-HHMMSS
```

## 8. What To Use On The Home Box

For the always-on machine:

- use `make report` for health checks
- use `make deploy` only when you are bootstrapping or refreshing the install
- keep development changes on the travel laptop
- let the home box stay stable unless you are fixing something specific
