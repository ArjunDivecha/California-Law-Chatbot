/**
 * =============================================================================
 * SCRIPT NAME: scripts/build-desktop-installer.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Packages the notarized desktop .app into a zip an attorney can install
 * with two clicks. The zip contains:
 *   1. AskPauli.app       — the signed + notarized app
 *   2. Install AskPauli.command — double-clickable installer:
 *      copies the app to /Applications, writes the API-keys file to
 *      ~/Library/Application Support/AskPauli/.env
 *      (chmod 600, with a freshly generated per-machine AUDIT_HMAC_KEY),
 *      then launches the app.
 *   3. INSTALL-INSTRUCTIONS.md          — attorney-facing steps (right-click
 *      → Open pattern, same as the earlier FFLP-Sanitizer install doc).
 *
 * ⚠️ THE ZIP CONTAINS LIVE API KEYS (Anthropic, CourtListener, CiteLaw,
 * OpenStates, LegiScan) read from the repo .env at build time. Never commit it (output
 * dir is gitignored); share only via a private channel (Dropbox link to the
 * recipients). Keys can be rotated at the providers at any time.
 *
 * INPUT FILES (repo-root relative):
 * - src-tauri/target/release/bundle/macos/AskPauli.app
 *   (must already be notarized — run `yarn desktop:app` first)
 * - .env, then /Users/arjundivecha/Dropbox/AAA Backup/.env.txt as fallback —
 *   source of ANTHROPIC_API_KEY, COURTLISTENER_API_KEY, CITELAW_API_KEY,
 *   OPENSTATES_API_KEY, LEGISCAN_API_KEY (fails loudly if any is missing)
 *
 * OUTPUT FILES:
 * - installer-pkg/dist/AskPauli-Desktop-<YYYY-MM-DD>.zip
 *
 * USAGE: node scripts/build-desktop-installer.mjs
 * =============================================================================
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'macos', 'AskPauli.app');
const OUT_DIR = join(ROOT, 'installer-pkg', 'dist');
const KEYS = [
  'ANTHROPIC_API_KEY',
  'COURTLISTENER_API_KEY',
  'CITELAW_API_KEY',
  'BOX_CLIENT_ID',
  'BOX_CLIENT_SECRET',
  'OPENSTATES_API_KEY',
  'LEGISCAN_API_KEY',
];

if (!existsSync(APP)) {
  console.error('❌ notarized .app not found — run `yarn desktop:app` first.');
  process.exit(1);
}

const env = {};
function mergeEnvFile(path) {
  if (!existsSync(path)) return;
  const envText = readFileSync(path, 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*"?([^"#\s]+)"?/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}
// Repo-local values win; the standard global file fills newly added keys
// such as CITELAW_API_KEY without requiring plaintext duplication.
mergeEnvFile(join(ROOT, '.env'));
mergeEnvFile('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');
const missing = KEYS.filter((k) => !env[k]);
if (missing.length) {
  console.error(`❌ missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

// Verify the app we're shipping is actually notarized/stapled.
try {
  execFileSync('xcrun', ['stapler', 'validate', APP], { stdio: 'pipe' });
} catch {
  console.error('❌ .app is not stapled — run `yarn desktop:app` (notarization) first.');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const stage = join(OUT_DIR, `stage-${date}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// 1. The app (ditto preserves signatures/extended attributes).
execFileSync('ditto', [APP, join(stage, 'AskPauli.app')]);

// 2. The installer .command.
const envFileBody = KEYS.map((k) => `${k}=${env[k]}`).join('\n');
const command = `#!/bin/bash
# AskPauli — one-time installer.
# Copies the app to /Applications and sets up your private keys file.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "Installing AskPauli…"

ditto "$HERE/AskPauli.app" "/Applications/AskPauli.app"

SUPPORT="$HOME/Library/Application Support/AskPauli"
mkdir -p "$SUPPORT"
cat > "$SUPPORT/.env" <<EOF
${envFileBody}
AUDIT_HMAC_KEY=$(openssl rand -hex 32)
EOF
chmod 600 "$SUPPORT/.env"

echo "Done. Launching the app…"
open "/Applications/AskPauli.app"
echo ""
echo "✅ Installed. You can find it in Applications and in Launchpad."
echo "   (You can close this window.)"
`;
writeFileSync(join(stage, 'Install AskPauli.command'), command);
chmodSync(join(stage, 'Install AskPauli.command'), 0o755);

// 3. Attorney instructions.
writeFileSync(
  join(stage, 'INSTALL-INSTRUCTIONS.md'),
  `# Installing AskPauli (desktop app)

Takes about 2 minutes, once.

1. Download the zip Arjun sent you and double-click it to unzip
   (you'll get a folder with the app, this file, and an installer).
2. **Right-click** (or Control-click) **"Install AskPauli.command"**
   and choose **Open**. If macOS asks "are you sure?", click **Open**.
   (Right-click-then-Open matters the first time — a plain double-click
   may be blocked because the installer script isn't from the App Store.)
3. A Terminal window opens, installs the app into Applications, and
   launches it. When it says **Installed**, close the window.
4. Sign in with the same account you use on the website. That's it —
   from now on, open it from Applications or Launchpad like any app.

**Already have AskPauli installed?** Same steps — the installer replaces
the old version in place. Your chats, drafts, and settings are kept.

**What's different from the website?** Everything you type and every
document you draft stays on YOUR Mac (a local database in your Library
folder). Nothing is stored in the cloud — the only thing that leaves your
machine is the anonymized text sent to Anthropic to generate answers,
under the firm's data-protection agreement.

---

# What's new in this version (August 2026)

**Box, connected.** AskPauli now links directly to the firm's Box.
- **Draft a document → 📦 Load from Box** — browse your Box folders and
  open a document straight into the editor. First time, a browser window
  asks you to sign in to Box and grant access (once per computer).
- **Save to Box** — saves your edited document back to Box. If it came
  FROM Box, it saves as a **new version of the same file**, so Box stays
  the one true home of the document with its full version history.

**Scanned PDFs now work.** A PDF that's just a scan (no selectable text)
is read with OCR — on your Mac, page by page, with a progress bar. Review
the recovered text before using it; scans of poor copies can have errors.

**Attach documents in Chat.** The 📎 (your Mac) and 📦 (Box) buttons next
to the chat box attach a document to your question — "what does this
filing say about custody?" now works directly. The chip above the box
shows how many private items will be protected before anything is sent.

**Version history & redlining (Draft page).** The **Versions** button
keeps automatic snapshots of your document as you apply changes, plus
named checkpoints (**+ Save checkpoint** inside the panel). **Compare**
shows a lawyer-style redline — insertions underlined, deletions struck
through — against any earlier version. **Restore** never deletes history.

**Stronger privacy protection.** Protected client names now stay
protected even when documents mangle them — ALL-CAPS scans, middle names,
and file names like "First Last_Case.pdf" are all caught. After each
message you'll see exactly how many items were anonymized on your Mac and
confirmation that nothing raw reached the server.

**Tidier Draft toolbar.** One **Export** menu (Word / PDF / web page)
instead of a row of buttons.
`,
);

// 4. Zip it.
mkdirSync(OUT_DIR, { recursive: true });
const zipPath = join(OUT_DIR, `AskPauli-Desktop-${date}.zip`);
rmSync(zipPath, { force: true });
execFileSync('ditto', ['-c', '-k', '--keepParent', stage, zipPath]);
rmSync(stage, { recursive: true, force: true });

console.log('✅ installer zip ready (CONTAINS LIVE API KEYS — private channels only):');
console.log(`   ${zipPath}`);
