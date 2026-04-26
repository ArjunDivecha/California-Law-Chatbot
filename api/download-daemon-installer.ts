/**
 * GET /api/download-daemon-installer
 *
 * Serves a macOS .command file that installs the OPF privacy-filter daemon.
 * The user double-clicks it; Terminal opens and runs it automatically.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAEMON_PY_URL =
  'https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/bedrock-confidentiality-migration/tools/opf-daemon/opf_daemon.py';

const SCRIPT = `#!/usr/bin/env bash
# femme & femme LLP — Privacy Filter setup
# Double-click this file to install. Terminal will open automatically.

set -euo pipefail

LABEL="com.fflp.opf-daemon"
PORT="47821"
ROOT="$HOME/.opf-daemon"
VENV="$ROOT/venv"
REPO="$ROOT/repo"
DAEMON_PY="$ROOT/opf_daemon.py"
LOG_DIR="$ROOT/logs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DAEMON_URL="${DAEMON_PY_URL}"

bold() { printf "\\033[1m%s\\033[0m\\n" "$*"; }
info() { printf "  %s\\n" "$*"; }
err()  { printf "\\033[31m  error: %s\\033[0m\\n" "$*" >&2; }

clear
bold "femme & femme LLP — Privacy Filter setup"
echo

# macOS only
if [[ "$(uname)" != "Darwin" ]]; then
  err "This installer supports macOS only."
  read -p "Press Enter to close..." _
  exit 1
fi

# Python 3.10+
PYTHON_BIN=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    ver=$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
    major=\${ver%%.*}; minor=\${ver##*.}
    if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 10 ]]; }; then
      PYTHON_BIN=$(command -v "$candidate")
      info "Python $ver found"
      break
    fi
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  err "Python 3.10+ is required."
  err ""
  err "Install it by running this in Terminal:"
  err "  brew install python@3.13"
  err ""
  err "Then double-click this file again."
  read -p "Press Enter to close..." _
  exit 1
fi

mkdir -p "$ROOT" "$LOG_DIR"

# virtualenv
if [[ ! -d "$VENV" ]]; then
  info "Creating virtual environment..."
  "$PYTHON_BIN" -m venv "$VENV"
fi
"$VENV/bin/pip" install --quiet --upgrade pip

# clone openai/privacy-filter
if [[ ! -d "$REPO/.git" ]]; then
  info "Downloading privacy-filter model (this takes 1-2 minutes)..."
  git clone --depth 1 https://github.com/openai/privacy-filter.git "$REPO" >/dev/null 2>&1
else
  info "Updating privacy-filter..."
  (cd "$REPO" && git fetch --depth 1 origin main >/dev/null 2>&1 && git reset --hard origin/main >/dev/null 2>&1) || true
fi

info "Installing dependencies..."
"$VENV/bin/pip" install --quiet -e "$REPO"

# download daemon
info "Downloading daemon..."
curl -fsSL "$DAEMON_URL" -o "$DAEMON_PY"
chmod +x "$DAEMON_PY"

# launchd plist
mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST_EOF
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
PLIST_EOF

if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi
launchctl load -w "$PLIST"

# wait for daemon
info "Starting privacy filter..."
for i in $(seq 1 15); do
  if curl -sS -m 1 "http://127.0.0.1:$PORT/v1/health" >/dev/null 2>&1; then
    echo
    bold "✓ Privacy filter is ready!"
    echo
    info "You can now close this window and go back to the chatbot."
    info "The privacy filter will start automatically every time you log in."
    echo
    read -p "Press Enter to close..." _
    exit 0
  fi
  sleep 1
done

err "Setup completed but daemon did not respond. Try reopening the chatbot."
read -p "Press Enter to close..." _
exit 1
`;

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Install Privacy Filter.command"');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(SCRIPT);
}
