/**
 * =============================================================================
 * SCRIPT: scripts/reembed-ceb-local.mjs
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Re-embeds the CEB corpus LOCALLY (BGE-M3 / Qwen3 via the local embeddings
 *   daemon) into a firm-controlled sqlite-vec store, so protected_discovery and
 *   Restricted-Data matters can do CEB search without sending anything to
 *   OpenAI or Upstash (PRD §5.7a; decision 2026-06-24). The CEB corpus is
 *   PUBLISHED practice-guide content, so it is stored under the pseudo-matter
 *   `ceb_public` (not a client matter). OpenAI's 1536-dim vectors are not
 *   interchangeable with BGE-M3's, so a re-embed is required.
 *
 *   FAIL CLOSED: requires the local embeddings daemon (EMBEDDINGS_DAEMON_URL).
 *   It will NOT fall back to a cloud embedder.
 *
 * INPUT FILES (full paths via flags/env):
 *   --input  <chunks.jsonl>   JSONL with one object per line: {id, text, ...}
 *                             (e.g. /Users/.../scripts/data/ceb_processed/<cat>/chunks.jsonl)
 * OUTPUT FILES:
 *   FIRM_STORE_PATH           the sqlite-vec database file written/updated
 *                             (e.g. /Users/.../data/firm-store/ceb.sqlite)
 *
 * ENV:
 *   EMBEDDINGS_DAEMON_URL     required — local BGE-M3 daemon endpoint
 *   FIRM_STORE_PATH           required — sqlite-vec db file path
 *
 * USAGE:
 *   EMBEDDINGS_DAEMON_URL=http://127.0.0.1:8077/embed \
 *   FIRM_STORE_PATH=./data/firm-store/ceb.sqlite \
 *   node scripts/reembed-ceb-local.mjs --input ./scripts/data/ceb_processed/trusts_estates/chunks.jsonl
 *
 * NOTES:
 *   - Idempotent: upserts by chunk id, so re-running updates rather than dupes.
 *   - Batches embedding requests; writes incrementally (fault tolerant).
 * =============================================================================
 */
import fs from 'node:fs';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { embedLocal, isLocalEmbeddingsConfigured } from '../api/_lib/compliance/localEmbeddings.js';
import { SqliteVecStore } from '../api/_lib/compliance/sqliteVecStore.js';

const CEB_MATTER = 'ceb_public'; // CEB is published content, not a client matter
const BATCH = 64;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function main() {
  const input = arg('--input');
  if (!input) throw new Error('missing --input <chunks.jsonl>');
  if (!isLocalEmbeddingsConfigured()) {
    throw new Error('EMBEDDINGS_DAEMON_URL not set — refusing to re-embed via a cloud provider (fail closed).');
  }
  if (!process.env.FIRM_STORE_PATH) throw new Error('FIRM_STORE_PATH not set (sqlite-vec db file path).');
  if (!fs.existsSync(input)) throw new Error(`input not found: ${input}`);

  // Probe one embedding to learn the dimensionality, then open the store.
  const probe = await embedLocal(['dimension probe']);
  const dim = probe[0].length;
  console.log(`[reembed] local embeddings dim = ${dim}; store = ${process.env.FIRM_STORE_PATH}`);
  const store = new SqliteVecStore({ dim });

  const rl = readline.createInterface({ input: fs.createReadStream(input), crlfDelay: Infinity });
  let buf = [];
  let n = 0;
  const flush = async () => {
    if (buf.length === 0) return;
    const texts = buf.map((c) => c.text);
    const vecs = await embedLocal(texts);
    for (let i = 0; i < buf.length; i += 1) {
      store.upsertVector(CEB_MATTER, String(buf[i].id), vecs[i], sha256(buf[i].text));
    }
    n += buf.length;
    console.log(`[reembed] upserted ${n} chunks`);
    buf = [];
  };

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (!obj || typeof obj.text !== 'string' || obj.id == null) continue;
    buf.push({ id: obj.id, text: obj.text });
    if (buf.length >= BATCH) await flush();
  }
  await flush();
  console.log(`[reembed] DONE — ${n} CEB chunks embedded into ${process.env.FIRM_STORE_PATH} (matter=${CEB_MATTER}, dim=${dim}).`);
  store.close();
}

main().catch((err) => {
  console.error('[reembed] FAILED:', err.message);
  process.exit(1);
});
