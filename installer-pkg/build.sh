#!/usr/bin/env bash
#
# FFLP-Sanitizer.pkg builder.
#
# Produces a signed + notarized macOS installer that drops the GLiNER
# daemon on an attorney's laptop in one double-click. Per
# docs/q-ff-communication-memo-2026-05-15.md, this is the only
# attorney-facing install required for V2 to function.
#
# Build stages:
#   1. clean         — wipe build/ and dist/
#   2. venv          — fresh isolated venv with gliner + pyinstaller
#   3. weights       — pre-download GLiNER model weights (~1.2 GB) into the bundle
#   4. binary        — PyInstaller single-binary build of gliner_daemon
#   5. payload       — stage the .pkg payload tree
#   6. pkg           — pkgbuild the component package
#   7. sign          — productsign with Developer ID Installer
#   8. notarize      — xcrun notarytool submit + wait (requires Apple ID + app password)
#   9. staple        — xcrun stapler staple
#
# Usage:
#   ./build.sh all              — full pipeline
#   ./build.sh <stage>          — run a single stage
#   APPLE_ID=...
#   APPLE_PASSWORD=...          — app-specific password (use keychain or env)
#   TEAM_ID=P8U4R52G69          — Apple Developer Team ID
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="$ROOT/build"
PAYLOAD="$ROOT/payload"
DIST="$ROOT/dist"
TEMPLATES="$ROOT/templates"
SCRIPTS="$ROOT/scripts"
DAEMON_SRC="$ROOT/../tools/gliner-daemon/gliner_daemon.py"

# Apple signing identities — set via env or fall back to known values
APP_IDENTITY="${APP_IDENTITY:-Developer ID Application: Arjun Divecha (P8U4R52G69)}"
PKG_IDENTITY="${PKG_IDENTITY:-Developer ID Installer: Arjun Divecha (P8U4R52G69)}"
TEAM_ID="${TEAM_ID:-P8U4R52G69}"

# Bundle metadata
BUNDLE_ID="com.fflp.gliner-daemon"
VERSION="${VERSION:-1.0.0}"
PKG_NAME="FFLP-Sanitizer-${VERSION}.pkg"
INSTALL_LOCATION="/Library/Application Support/FFLP/gliner-daemon"

bold() { printf "\033[1m== %s ==\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }
err()  { printf "\033[31m  error: %s\033[0m\n" "$*" >&2; }

stage_clean() {
  bold "clean"
  rm -rf "$BUILD" "$PAYLOAD" "$DIST"
  mkdir -p "$BUILD" "$PAYLOAD" "$DIST"
}

stage_venv() {
  bold "venv (~5 min cold)"
  python3.13 -m venv "$BUILD/venv"
  "$BUILD/venv/bin/pip" install --upgrade pip wheel >/dev/null
  "$BUILD/venv/bin/pip" install --quiet gliner==0.2.26 pyinstaller huggingface_hub
  info "venv ready at $BUILD/venv"
}

stage_weights() {
  bold "weights — both gliner_multi_pii-v1 AND mdeberta-v3-base (~2 GB)"
  mkdir -p "$BUILD/hf-cache"
  # Pre-populate a build-local HF cache so the bundled daemon never
  # phones home on first cold-load. GLiNER's multi_pii model uses
  # microsoft/mdeberta-v3-base as its underlying encoder; without
  # mdeberta in the cache the daemon makes ~700 MB of HF API calls on
  # first /v1/detect.
  HF_HOME="$BUILD/hf-cache" "$BUILD/venv/bin/python" - <<'PY'
import os
from huggingface_hub import snapshot_download
# Main GLiNER multilingual PII model
snapshot_download(repo_id="urchade/gliner_multi_pii-v1")
# Base encoder it relies on
snapshot_download(repo_id="microsoft/mdeberta-v3-base")
print(f"HF cache populated at {os.environ['HF_HOME']}")
PY
  du -sh "$BUILD/hf-cache"
  info "hf-cache at $BUILD/hf-cache"
}

stage_binary() {
  bold "binary (PyInstaller — usually 15–45 min cold; debugging may extend)"
  "$BUILD/venv/bin/pyinstaller" \
    --onefile \
    --name fflp-gliner-daemon \
    --distpath "$BUILD/dist" \
    --workpath "$BUILD/work" \
    --specpath "$BUILD" \
    --hidden-import gliner \
    --hidden-import gliner.model \
    --hidden-import torch \
    --hidden-import transformers \
    --collect-data gliner \
    --collect-data transformers \
    --collect-data tokenizers \
    "$DAEMON_SRC"
  ls -lh "$BUILD/dist/fflp-gliner-daemon"
  bold "smoke-test the binary"
  "$BUILD/dist/fflp-gliner-daemon" --port 47843 &
  PID=$!
  sleep 4
  if curl -sS --max-time 3 http://localhost:47843/v1/health | grep -q '"ok":true'; then
    info "✓ bundled daemon responds on smoke port 47843"
  else
    err "smoke test FAILED"
    kill $PID 2>/dev/null || true
    exit 3
  fi
  kill $PID 2>/dev/null || true
}

stage_payload() {
  bold "payload"
  # Payload root maps to / on the target machine
  local installdir="$PAYLOAD$INSTALL_LOCATION"
  mkdir -p "$installdir"/{bin,hf-cache,logs,certs}
  cp "$BUILD/dist/fflp-gliner-daemon" "$installdir/bin/"
  chmod +x "$installdir/bin/fflp-gliner-daemon"
  # Ship the pre-populated HF cache so first cold-load is offline
  cp -R "$BUILD/hf-cache/." "$installdir/hf-cache/"
  # Sign the daemon binary itself (must happen before pkg signing)
  codesign --deep --force --options runtime --timestamp \
    --sign "$APP_IDENTITY" \
    "$installdir/bin/fflp-gliner-daemon"
  codesign --verify --verbose "$installdir/bin/fflp-gliner-daemon" 2>&1 | tail -3
  du -sh "$installdir/hf-cache"
  info "payload staged at $PAYLOAD"
}

stage_pkg() {
  bold "pkg (build component pkg, unsigned)"
  pkgbuild \
    --root "$PAYLOAD" \
    --identifier "$BUNDLE_ID" \
    --version "$VERSION" \
    --scripts "$SCRIPTS" \
    --install-location "/" \
    "$BUILD/component.pkg"
  info "component pkg at $BUILD/component.pkg"
}

stage_sign() {
  bold "sign (productsign with Developer ID Installer)"
  productsign \
    --sign "$PKG_IDENTITY" \
    "$BUILD/component.pkg" \
    "$DIST/$PKG_NAME"
  info "signed pkg at $DIST/$PKG_NAME"
  pkgutil --check-signature "$DIST/$PKG_NAME" | head -10
}

stage_notarize() {
  bold "notarize (xcrun notarytool — 2–10 min wait)"
  # Credentials come from the keychain profile (see notarytool
  # store-credentials). Never pass the app-specific password on the
  # command line — it would land in shell history.
  local profile="${NOTARY_PROFILE:-FFLP-NOTARY}"
  xcrun notarytool submit "$DIST/$PKG_NAME" \
    --keychain-profile "$profile" \
    --wait
}

stage_staple() {
  bold "staple"
  xcrun stapler staple "$DIST/$PKG_NAME"
  xcrun stapler validate "$DIST/$PKG_NAME"
  info "✓ stapled. Final artifact: $DIST/$PKG_NAME"
}

stage_all() {
  stage_clean
  stage_venv
  stage_weights
  stage_binary
  stage_payload
  stage_pkg
  stage_sign
  stage_notarize
  stage_staple
}

CMD="${1:-all}"
case "$CMD" in
  clean|venv|weights|binary|payload|pkg|sign|notarize|staple|all)
    WEIGHTS_DIR="$BUILD/weights/urchade--gliner_multi_pii-v1" "stage_$CMD"
    ;;
  *)
    echo "Usage: $0 {clean|venv|weights|binary|payload|pkg|sign|notarize|staple|all}"
    exit 1
    ;;
esac
