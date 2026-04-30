/**
 * GET /api/download-daemon-installer
 *
 * Serves a macOS .command file that installs the OPF privacy-filter daemon.
 * The user double-clicks it; Terminal opens and runs the branch-pinned
 * installer automatically.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const INSTALL_SCRIPT_URL =
  'https://raw.githubusercontent.com/ArjunDivecha/California-Law-Chatbot/codex/drafting-magic/tools/opf-daemon/install-remote.sh';

const SCRIPT = `#!/usr/bin/env bash
# femme & femme LLP - Privacy Filter setup
# Double-click this file to install. Terminal will open automatically.

set -euo pipefail

clear
printf "\\033[1mfemme & femme LLP - Privacy Filter setup\\033[0m\\n\\n"

if [[ "$(uname)" != "Darwin" ]]; then
  printf "\\033[31m  error: This installer supports macOS only.\\033[0m\\n" >&2
  read -r -p "Press Enter to close..." _
  exit 1
fi

if ! curl -fsSL "${INSTALL_SCRIPT_URL}" | bash; then
  printf "\\n\\033[31mSetup did not finish. Keep this window open and try the command from the chatbot again.\\033[0m\\n"
  read -r -p "Press Enter to close..." _
  exit 1
fi

printf "\\n"
read -r -p "Press Enter to close..." _
`;

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Install Privacy Filter.command"');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(SCRIPT);
}
