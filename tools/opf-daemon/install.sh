#!/usr/bin/env bash
#
# OPF daemon installer (macOS).
#
# Idempotent: safe to run repeatedly. On second run, refreshes the venv +
# plist without re-downloading the model.
#
# What it does:
#   1. Verifies macOS + Python 3.10+.
#   2. Creates a venv at ~/.opf-daemon/venv.
#   3. Clones / pulls openai/privacy-filter into ~/.opf-daemon/repo and
#      installs it editable (`pip install -e .`) so the `opf` package is
#      importable.
#   4. Copies opf_daemon.py to ~/.opf-daemon/opf_daemon.py.
#   5. Writes ~/Library/LaunchAgents/com.fflp.opf-daemon.plist.
#   6. Loads the agent (kickstarts the daemon).
#   7. Probes http://127.0.0.1:47821/v1/health and prints the response.
#
# Uninstall: see uninstall.sh.

set -euo pipefail

LABEL="com.fflp.opf-daemon"
PORT="${OPF_DAEMON_PORT:-47821}"
ROOT="$HOME/.opf-daemon"
VENV="$ROOT/venv"
REPO="$ROOT/repo"
DAEMON_PY="$ROOT/opf_daemon.py"
LOG_DIR="$ROOT/logs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
warn() { printf "\033[33m  warn: %s\033[0m\n" "$*"; }
err()  { printf "\033[31m  error: %s\033[0m\n" "$*" >&2; }

bold "OPF daemon installer"

# 1. macOS + Python check
if [[ "$(uname)" != "Darwin" ]]; then
  err "This installer supports macOS only."
  exit 1
fi

PYTHON_BIN=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    ver=$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
    major=${ver%%.*}
    minor=${ver##*.}
    if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 10 ]]; }; then
      PYTHON_BIN=$(command -v "$candidate")
      info "using Python: $PYTHON_BIN ($ver)"
      break
    fi
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  err "Python 3.10+ required. Install via 'brew install python@3.13' and re-run."
  exit 1
fi

# 2. venv
mkdir -p "$ROOT" "$LOG_DIR"
if [[ ! -d "$VENV" ]]; then
  info "creating venv at $VENV"
  "$PYTHON_BIN" -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip

# 3. clone or pull privacy-filter, then editable install
if [[ ! -d "$REPO/.git" ]]; then
  info "cloning openai/privacy-filter"
  git clone --depth 1 https://github.com/openai/privacy-filter.git "$REPO" >/dev/null
else
  info "updating openai/privacy-filter"
  (cd "$REPO" && git fetch --depth 1 origin main >/dev/null 2>&1 && git reset --hard origin/main >/dev/null 2>&1) || warn "git pull failed (offline?); continuing with existing checkout"
fi
info "installing opf package + dependencies (this may take a few minutes the first time)"
"$VENV/bin/pip" install --quiet -e "$REPO"

# 4. copy daemon
info "installing daemon script to $DAEMON_PY"
cp "$SCRIPT_DIR/opf_daemon.py" "$DAEMON_PY"
chmod +x "$DAEMON_PY"

# 5. plist
info "writing launchd plist to $PLIST"
mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$VENV/bin/python</string>
    <string>$DAEMON_PY</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>$PORT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/daemon.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/daemon.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONUNBUFFERED</key>
    <string>1</string>
    <key>PATH</key>
    <string>$VENV/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

# 6. (re)load
if launchctl list | grep -q "$LABEL"; then
  info "reloading existing daemon"
  launchctl unload "$PLIST" 2>/dev/null || true
fi
launchctl load -w "$PLIST"
info "launchd loaded $LABEL"

# 7. probe health (give it a moment to bind)
info "probing http://127.0.0.1:$PORT/v1/health (waiting up to 10s)"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sS -m 1 "http://127.0.0.1:$PORT/v1/health" >/tmp/opf-health.json 2>/dev/null; then
    bold "✓ daemon alive"
    cat /tmp/opf-health.json
    echo
    info "logs: $LOG_DIR/daemon.{out,err}.log"
    info "to uninstall: $SCRIPT_DIR/uninstall.sh"
    exit 0
  fi
  sleep 1
done

err "daemon did not respond within 10s"
err "check logs: $LOG_DIR/daemon.err.log"
exit 1
