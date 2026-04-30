#!/usr/bin/env bash
#
# femme & femme LLP — Privacy Filter daemon installer (macOS)
#
# Run this once in Terminal:
#   curl -fsSL https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/drafting-magic/tools/opf-daemon/install-remote.sh | bash
#
# What it does:
#   1. Checks macOS + Python 3.10+
#   2. Creates a virtualenv at ~/.opf-daemon/venv
#   3. Clones openai/privacy-filter and installs the opf package
#   4. Downloads the daemon script from GitHub
#   5. Creates a local HTTPS certificate trusted by macOS/Safari
#   6. Registers it as a launchd agent so it starts automatically at login
#   7. Probes the HTTPS health endpoint to confirm it's running
#
# Uninstall:
#   launchctl unload ~/Library/LaunchAgents/com.fflp.opf-daemon.plist
#   rm -rf ~/.opf-daemon ~/Library/LaunchAgents/com.fflp.opf-daemon.plist

set -euo pipefail

LABEL="com.fflp.opf-daemon"
BRANCH="${OPF_INSTALL_BRANCH:-codex/drafting-magic}"
PORT="47821"
HTTPS_PORT="47822"
ROOT="$HOME/.opf-daemon"
VENV="$ROOT/venv"
REPO="$ROOT/repo"
DAEMON_PY="$ROOT/opf_daemon.py"
LOG_DIR="$ROOT/logs"
CERT_DIR="$ROOT/certs"
CA_KEY="$CERT_DIR/fflp-opf-local-ca.key.pem"
CA_CERT="$CERT_DIR/fflp-opf-local-ca.crt.pem"
SERVER_KEY="$CERT_DIR/localhost.key.pem"
SERVER_CERT="$CERT_DIR/localhost.crt.pem"
SERVER_CHAIN="$CERT_DIR/localhost-chain.crt.pem"
SERVER_CSR="$CERT_DIR/localhost.csr.pem"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

DAEMON_URL="${OPF_DAEMON_SCRIPT_URL:-https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/$BRANCH/tools/opf-daemon/opf_daemon.py}"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
warn() { printf "\033[33m  warn: %s\033[0m\n" "$*"; }
err()  { printf "\033[31m  error: %s\033[0m\n" "$*" >&2; }

run_with_timeout() {
  local timeout_s="$1"
  shift
  "$@" &
  local pid=$!
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if [[ "$elapsed" -ge "$timeout_s" ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  wait "$pid"
}

ensure_https_cert() {
  mkdir -p "$CERT_DIR"
  chmod 700 "$CERT_DIR"

  if [[ ! -f "$CA_CERT" || ! -f "$CA_KEY" ]]; then
    info "creating local HTTPS certificate authority for Safari"
    cat > "$CERT_DIR/ca.cnf" <<'CERT_EOF'
[req]
prompt = no
distinguished_name = dn
x509_extensions = v3_ca

[dn]
CN = femme and femme LLP OPF Local Privacy Filter CA
O = femme and femme LLP

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical,CA:true,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
CERT_EOF
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
      -keyout "$CA_KEY" \
      -out "$CA_CERT" \
      -config "$CERT_DIR/ca.cnf" >/dev/null 2>&1
  fi

  if [[ ! -f "$SERVER_CERT" || ! -f "$SERVER_KEY" ]] || \
     ! openssl x509 -checkend 2592000 -noout -in "$SERVER_CERT" >/dev/null 2>&1; then
    info "creating localhost HTTPS certificate"
    cat > "$CERT_DIR/server-req.cnf" <<'CERT_EOF'
[req]
prompt = no
distinguished_name = dn
req_extensions = v3_req

[dn]
CN = localhost
O = femme and femme LLP

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
CERT_EOF
    cat > "$CERT_DIR/server-ext.cnf" <<'CERT_EOF'
[v3_server]
subjectAltName = @alt_names
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
CERT_EOF
    openssl req -new -newkey rsa:2048 -nodes \
      -keyout "$SERVER_KEY" \
      -out "$SERVER_CSR" \
      -config "$CERT_DIR/server-req.cnf" >/dev/null 2>&1
    openssl x509 -req \
      -in "$SERVER_CSR" \
      -CA "$CA_CERT" \
      -CAkey "$CA_KEY" \
      -CAcreateserial \
      -out "$SERVER_CERT" \
      -days 397 \
      -sha256 \
      -extfile "$CERT_DIR/server-ext.cnf" \
      -extensions v3_server >/dev/null 2>&1
  fi

  cat "$SERVER_CERT" "$CA_CERT" > "$SERVER_CHAIN"
  chmod 600 "$CA_KEY" "$SERVER_KEY"

  local keychain="$HOME/Library/Keychains/login.keychain-db"
  if [[ ! -f "$keychain" ]]; then
    keychain="$HOME/Library/Keychains/login.keychain"
  fi
  info "trusting local HTTPS certificate in macOS Keychain"
  local trust_timeout="${OPF_CERT_TRUST_TIMEOUT_SECONDS:-60}"
  if ! run_with_timeout "$trust_timeout" security add-trusted-cert -r trustRoot -p ssl -s localhost -k "$keychain" "$CA_CERT" >/dev/null 2>&1; then
    warn "macOS did not automatically trust the local certificate; Safari will not connect until it is trusted"
  fi
}

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

# ── 6. HTTPS certificate for Safari/WebKit ───────────────────────────────────
ensure_https_cert

# ── 7. launchd plist ─────────────────────────────────────────────────────────
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
    <string>--https-port</string>
    <string>$HTTPS_PORT</string>
    <string>--cert-file</string>
    <string>$SERVER_CHAIN</string>
    <string>--key-file</string>
    <string>$SERVER_KEY</string>
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

# ── 8. load the agent ────────────────────────────────────────────────────────
if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi
launchctl load -w "$PLIST"

# ── 9. health check ──────────────────────────────────────────────────────────
info "waiting for daemon to start..."
for i in $(seq 1 15); do
  if curl -sS -m 1 "https://localhost:$HTTPS_PORT/v1/health" >/tmp/opf-health.json 2>/dev/null; then
    echo
    bold "✓ Privacy filter is running and Safari-ready"
    echo
    info "You can now return to the chatbot."
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

if curl -sS -m 1 "http://127.0.0.1:$PORT/v1/health" >/tmp/opf-health.json 2>/dev/null; then
  echo
  bold "✓ Privacy filter is running"
  echo
  warn "Safari will use the local privacy-filter bridge window if HTTPS certificate trust is unavailable."
  info "You can now return to the chatbot."
  info "The privacy filter starts automatically when you log in."
  info "Logs: $LOG_DIR/daemon.err.log"
  exit 0
fi

err "Daemon did not start within 15 seconds."
err "Check logs: $LOG_DIR/daemon.err.log"
exit 1
