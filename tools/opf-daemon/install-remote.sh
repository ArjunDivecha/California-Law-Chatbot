#!/usr/bin/env bash
#
# femme & femme LLP — Privacy Filter daemon installer (macOS)
#
# Run this once in Terminal:
#   curl -fsSL https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/bedrock-confidentiality-migration/tools/opf-daemon/install-remote.sh | bash
#
# What it does:
#   1. Checks macOS + Python 3.10+
#   2. Creates a virtualenv at ~/.opf-daemon/venv
#   3. Clones openai/privacy-filter and installs the opf package
#   4. Downloads the daemon script from GitHub
#   5. Registers it as a launchd agent so it starts automatically at login
#   6. Probes the health endpoint to confirm it's running
#
# Uninstall:
#   launchctl unload ~/Library/LaunchAgents/com.fflp.opf-daemon.plist
#   rm -rf ~/.opf-daemon ~/Library/LaunchAgents/com.fflp.opf-daemon.plist

set -euo pipefail

LABEL="com.fflp.opf-daemon"
PORT="47821"
ROOT="$HOME/.opf-daemon"
VENV="$ROOT/venv"
REPO="$ROOT/repo"
DAEMON_PY="$ROOT/opf_daemon.py"
LOG_DIR="$ROOT/logs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

DAEMON_URL="https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/bedrock-confidentiality-migration/tools/opf-daemon/opf_daemon.py"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
warn() { printf "\033[33m  warn: %s\033[0m\n" "$*"; }
err()  { printf "\033[31m  error: %s\033[0m\n" "$*" >&2; }

bold "femme & femme LLP — Privacy Filter installer"
echo

# ── 1. macOS check ──────────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
  err "This installer supports macOS only."
  exit 1
fi

# ── 2. Python 3.10+ ─────────────────────────────────────────────────────────
PYTHON_BIN=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    ver=$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
    major=${ver%%.*}; minor=${ver##*.}
    if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 10 ]]; }; then
      PYTHON_BIN=$(command -v "$candidate")
      info "Python: $PYTHON_BIN ($ver)"
      break
    fi
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  err "Python 3.10+ is required."
  err "Install it with: brew install python@3.13"
  err "Then re-run this script."
  exit 1
fi

# ── 3. venv ──────────────────────────────────────────────────────────────────
mkdir -p "$ROOT" "$LOG_DIR"
if [[ ! -d "$VENV" ]]; then
  info "creating virtualenv at $VENV"
  "$PYTHON_BIN" -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip

# ── 4. openai/privacy-filter ─────────────────────────────────────────────────
if [[ ! -d "$REPO/.git" ]]; then
  info "cloning openai/privacy-filter (this takes a minute)..."
  git clone --depth 1 https://github.com/openai/privacy-filter.git "$REPO" >/dev/null 2>&1
else
  info "updating openai/privacy-filter"
  (cd "$REPO" && git fetch --depth 1 origin main >/dev/null 2>&1 && git reset --hard origin/main >/dev/null 2>&1) \
    || warn "git update failed (offline?) — continuing with existing checkout"
fi

info "installing opf package and dependencies (first time may take a few minutes)..."
"$VENV/bin/pip" install --quiet -e "$REPO"

# ── 5. download daemon script ────────────────────────────────────────────────
info "downloading daemon from GitHub..."
curl -fsSL "$DAEMON_URL" -o "$DAEMON_PY"
chmod +x "$DAEMON_PY"

# ── 6. launchd plist ─────────────────────────────────────────────────────────
info "registering daemon with macOS launchd..."
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

# ── 7. load the agent ────────────────────────────────────────────────────────
if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi
launchctl load -w "$PLIST"

# ── 8. health check ──────────────────────────────────────────────────────────
info "waiting for daemon to start..."
for i in $(seq 1 15); do
  if curl -sS -m 1 "http://127.0.0.1:$PORT/v1/health" >/tmp/opf-health.json 2>/dev/null; then
    echo
    bold "✓ Privacy filter is running"
    echo
    info "You can now use the femme & femme LLP chatbot at:"
    info "  https://california-law-chatbot-git-c996e5-arjundivecha-gmailcoms-projects.vercel.app"
    echo
    info "The privacy filter starts automatically when you log in."
    info "Logs: $LOG_DIR/daemon.err.log"
    echo
    info "To uninstall:"
    info "  launchctl unload ~/Library/LaunchAgents/com.fflp.opf-daemon.plist"
    info "  rm -rf ~/.opf-daemon ~/Library/LaunchAgents/com.fflp.opf-daemon.plist"
    exit 0
  fi
  sleep 1
done

err "Daemon did not start within 15 seconds."
err "Check logs: $LOG_DIR/daemon.err.log"
exit 1
