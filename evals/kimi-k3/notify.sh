#!/bin/bash
# =============================================================================
# notify.sh — iMessage progress notifier for the Kimi-K3 eval build loop
# =============================================================================
# WHAT THIS DOES:
#   Sends a one-line progress iMessage to Arjun's own handle (self-chat) via
#   AppleScript / Messages.app, so build-loop checkpoints reach his phone.
#
# INPUT FILES:  none (message text is the first CLI argument)
# OUTPUT FILES: none (side effect only: an outgoing iMessage)
#
# USAGE:
#   ./evals/kimi-k3/notify.sh "Checkpoint 3/12: calibration gate green"
#
# NOTES:
#   - Recipient is the iMessage self-chat handle; edit HANDLE to change it.
#   - Exits non-zero if Messages.app scripting fails; callers should log but
#     never let a notification failure abort the build loop.
# =============================================================================
set -euo pipefail

HANDLE="arjun.divecha@gmo.com"
MSG="${1:?usage: notify.sh <message>}"

osascript - "$HANDLE" "$MSG" <<'EOF'
on run argv
    set theHandle to item 1 of argv
    set theMsg to item 2 of argv
    tell application "Messages"
        set targetService to 1st account whose service type = iMessage and enabled is true
        set targetBuddy to participant theHandle of targetService
        send theMsg to targetBuddy
    end tell
end run
EOF
