#!/usr/bin/env bash
#
# OPF daemon uninstaller (macOS).
#
# Stops the daemon, unloads the launchd agent, removes the plist, the venv,
# and the cloned repo. Does NOT delete the OPF model weights at
# ~/.opf/privacy_filter — those are reusable across reinstalls and ~2.8GB,
# so deletion is opt-in via the --purge-model flag.

set -euo pipefail

LABEL="com.fflp.opf-daemon"
ROOT="$HOME/.opf-daemon"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
MODEL_DIR="$HOME/.opf/privacy_filter"
PURGE_MODEL=0

for arg in "$@"; do
  case "$arg" in
    --purge-model) PURGE_MODEL=1 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
info() { printf "  %s\n" "$*"; }

bold "OPF daemon uninstaller"

if launchctl list | grep -q "$LABEL"; then
  info "stopping launchd agent"
  launchctl unload "$PLIST" 2>/dev/null || true
fi

if [[ -f "$PLIST" ]]; then
  info "removing $PLIST"
  rm -f "$PLIST"
fi

if [[ -d "$ROOT" ]]; then
  info "removing $ROOT (venv, repo, daemon script, logs)"
  rm -rf "$ROOT"
fi

if [[ "$PURGE_MODEL" -eq 1 ]]; then
  if [[ -d "$MODEL_DIR" ]]; then
    info "removing OPF model weights at $MODEL_DIR (--purge-model)"
    rm -rf "$MODEL_DIR"
  fi
else
  if [[ -d "$MODEL_DIR" ]]; then
    info "leaving OPF model at $MODEL_DIR (re-use on reinstall). Pass --purge-model to delete."
  fi
fi

bold "✓ uninstalled"
