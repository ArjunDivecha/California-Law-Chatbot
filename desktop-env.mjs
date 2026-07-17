/**
 * =============================================================================
 * SCRIPT NAME: desktop-env.mjs
 * =============================================================================
 *
 * DESCRIPTION:
 * Side-effect module that prepares the environment for the desktop sidecar.
 * MUST be the FIRST import in desktop-server.mjs: ESM evaluates imports in
 * order, so this guarantees env loading + cloud-credential stripping happen
 * before any API handler module is evaluated.
 *
 * Load order (first hit wins per key):
 *   1. process env (whatever the Tauri shell passed through)
 *   2. <cwd>/.env then <cwd>/.env.local (dev runs from the repo root)
 *   3. ~/Library/Application Support/California Law Chatbot/.env
 *      (the packaged .app has no repo — users/installers put keys here)
 *   4. /Users/arjundivecha/Dropbox/AAA Backup/.env.txt (global fallback per
 *      ~/CLAUDE.md convention; same parser as dev-server.js)
 *
 * Then DELETES Upstash/Blob credentials so no cloud data-store is reachable:
 * any missed code path fails closed instead of silently writing session data
 * off-device. (The desktop server injects the SQLite adapter instead.)
 *
 * INPUT FILES: the .env files listed above (all optional)
 * OUTPUT FILES: none
 * =============================================================================
 */

import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });
dotenv.config({
  path: join(homedir(), 'Library', 'Application Support', 'California Law Chatbot', '.env'),
});

(function loadFallbackEnv() {
  const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'COURTLISTENER_API_KEY'];
  if (required.every((k) => process.env[k])) return;
  let text;
  try {
    text = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw.trim();
    if (v.startsWith('"')) {
      const close = v.indexOf('"', 1);
      v = close > 0 ? v.slice(1, close) : v.slice(1);
    } else if (v.startsWith("'")) {
      const close = v.indexOf("'", 1);
      v = close > 0 ? v.slice(1, close) : v.slice(1);
    } else {
      const cut = v.search(/\s|#/);
      if (cut >= 0) v = v.slice(0, cut);
    }
    process.env[k] = v;
  }
})();

// LOCAL-ONLY MODE: sever every cloud data-store.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN;
