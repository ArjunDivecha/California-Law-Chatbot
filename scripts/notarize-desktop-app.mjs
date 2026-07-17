/**
 * =============================================================================
 * SCRIPT NAME: scripts/notarize-desktop-app.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Post-build notarization for the desktop app. Run after `tauri build`
 * (chained in the `yarn desktop:app` script). Steps:
 *   1. Zips the signed .app (ditto -c -k --keepParent — Apple's required form).
 *   2. Submits to Apple notarization via `notarytool submit --wait`, using
 *      the Keychain profile "clc-notary" (created one-time with
 *      `xcrun notarytool store-credentials clc-notary --apple-id …
 *       --team-id P8U4R52G69 --password <app-specific-password>`).
 *   3. Staples the notarization ticket to the .app (`stapler staple`).
 *   4. Verifies Gatekeeper acceptance (`spctl --assess`).
 * Fails loudly (nonzero exit) on any step — no silent fallbacks. If the
 * Keychain profile is missing, step 2 fails with notarytool's own error.
 *
 * INPUT FILES:
 * - <repo>/src-tauri/target/release/bundle/macos/California Law Chatbot.app
 *   (signed .app produced by `tauri build --config src-tauri/tauri.desktop.conf.json`)
 * - Keychain profile "clc-notary" (macOS Keychain; not a file in the repo)
 *
 * OUTPUT FILES:
 * - <os tmpdir>/clc-notarize-<timestamp>.zip (submission artifact, deleted on success)
 * - The .app above, modified in place (stapled notarization ticket)
 *
 * USAGE: node scripts/notarize-desktop-app.mjs   (or via `yarn desktop:app`)
 * =============================================================================
 */

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = join(
  process.cwd(),
  'src-tauri', 'target', 'release', 'bundle', 'macos',
  'California Law Chatbot.app',
);
const PROFILE = process.env.NOTARY_KEYCHAIN_PROFILE || 'clc-notary';

if (!existsSync(APP)) {
  console.error(`❌ .app not found at ${APP} — run the tauri build first.`);
  process.exit(1);
}

const zip = join(tmpdir(), `clc-notarize-${Date.now()}.zip`);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

console.log('📦 zipping for submission…');
run('ditto', ['-c', '-k', '--keepParent', APP, zip]);

console.log(`🚀 submitting to Apple notarization (profile: ${PROFILE}) — typically 2-10 min…`);
run('xcrun', ['notarytool', 'submit', zip, '--keychain-profile', PROFILE, '--wait']);

console.log('📎 stapling ticket…');
run('xcrun', ['stapler', 'staple', APP]);

console.log('🔎 verifying Gatekeeper acceptance…');
run('spctl', ['--assess', '--type', 'execute', '-v', APP]);

rmSync(zip, { force: true });
console.log('✅ notarized, stapled, and Gatekeeper-accepted:');
console.log(`   ${APP}`);
