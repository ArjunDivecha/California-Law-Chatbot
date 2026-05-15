#!/usr/bin/env bash
#
# GLiNER daemon installer (macOS).
#
# Per docs/phase-c-decision-2026-05-15.md: GLiNER replaced stock OPF as
# the primary PII detector. This installer mirrors the OPF daemon's
# install pattern (~/.opf-daemon/install.sh) but uses GLiNER's model
# and ports 47841/47842.
#
# Prerequisite: the OPF daemon installer must have run first
# (~/.opf-daemon/venv/ provides the Python env + we reuse the same
# localhost cert from ~/.opf-daemon/certs/).
#
# Idempotent. Safe to re-run.

set -euo pipefail

LABEL="com.fflp.gliner-daemon"
ROOT="$HOME/.gliner-daemon"
VENV="$HOME/.opf-daemon/venv"   # reuse OPF venv (has gliner installed)
DAEMON_PY="$ROOT/gliner_daemon.py"
LOG_DIR="$ROOT/logs"
CERT_DIR="$HOME/.opf-daemon/certs"
SERVER_CHAIN="$CERT_DIR/localhost-chain.crt.pem"
SERVER_KEY="$CERT_DIR/localhost.key.pem"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
err()  { printf "\033[31m  error: %s\033[0m\n" "$*" >&2; }

bold "GLiNER daemon installer"

# 1. Prereqs
if [[ ! -x "$VENV/bin/python" ]]; then
  err "OPF venv at $VENV not found. Run ~/.opf-daemon/install.sh first."
  exit 2
fi
if [[ ! -f "$SERVER_CHAIN" ]] || [[ ! -f "$SERVER_KEY" ]]; then
  err "localhost cert not found at $CERT_DIR. Run ~/.opf-daemon/install.sh first."
  exit 2
fi

# 2. Ensure gliner is installed in the OPF venv
info "verifying gliner package..."
if ! "$VENV/bin/python" -c "import gliner" 2>/dev/null; then
  info "installing gliner into OPF venv..."
  "$VENV/bin/pip" install gliner
fi

# 3. Stage daemon
info "staging daemon at $ROOT/"
mkdir -p "$ROOT" "$LOG_DIR"
cp "$SCRIPT_DIR/gliner_daemon.py" "$DAEMON_PY"

# 4. Write launchd plist
info "writing launchd agent at $PLIST"
cp "$SCRIPT_DIR/com.fflp.gliner-daemon.plist" "$PLIST"

# 5. Load (or reload) the agent
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

# 6. Probe
info "waiting for daemon to come up..."
sleep 3
if curl -sS --max-time 3 http://localhost:47841/v1/health > /dev/null 2>&1; then
  info "✓ GLiNER daemon responding on http://localhost:47841"
else
  err "daemon did not respond. Check $LOG_DIR/daemon.err.log"
  exit 3
fi
if curl -sk --max-time 3 https://localhost:47842/v1/health > /dev/null 2>&1; then
  info "✓ GLiNER daemon responding on https://localhost:47842"
else
  err "HTTPS endpoint not responding"
fi

bold "Done."
info "Logs: $LOG_DIR/daemon.{out,err}.log"
info "Restart: launchctl kickstart -k gui/\$(id -u)/$LABEL"
info "Stop:    launchctl unload $PLIST"
