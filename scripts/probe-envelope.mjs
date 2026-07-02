import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
// Load both .env.local + dropbox .env.txt (matches dev-server.js convention)
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        // Handle quoted value possibly followed by comment
        if (v.startsWith('"')) {
          const close = v.indexOf('"', 1);
          v = close > 0 ? v.slice(1, close) : v.slice(1);
        } else if (v.startsWith("'")) {
          const close = v.indexOf("'", 1);
          v = close > 0 ? v.slice(1, close) : v.slice(1);
        } else {
          // Stop at whitespace or comment
          const cut = v.search(/\s|#/);
          if (cut >= 0) v = v.slice(0, cut);
        }
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnv(`${repoRoot}/.env.local`);
loadEnv('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt');
// Original loop body is now dead — remove via second pass
for (const line of readFileSync(`${repoRoot}/.env.local`,'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]]) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
const { writeRedactionEnvelope } = await import(`${repoRoot}/api/_shared/auditLog.ts`);
const id = await writeRedactionEnvelope({
  session_id: 'sess_probe', attorney_id: 'user_probe',
  input_sha256: 'fake_input_hmac', sanitized_sha256: 'fake_sanitized_hmac',
  redaction_decisions_count: 3, by_category_counts: { name: 2, phone: 1 },
  confidence: 0.95, privileged_bool: true, compound_risk_buckets: 0,
});
console.log('envelope id:', id);
// Small sleep to ensure Upstash write propagates (auto-pipeline can
// defer the SET batch).
await new Promise((r) => setTimeout(r, 500));
const { Redis } = await import('@upstash/redis');
const r = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
const raw = await r.get(`audit_record_envelope:${id}`);
if (raw == null) {
  console.error('FAIL: envelope not found in Upstash. id =', id);
  process.exit(1);
}
console.log('stored:', JSON.stringify(raw).slice(0, 250));
// Decrypt to verify shape integrity
const { createDecipheriv } = await import('node:crypto');
const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
const dek = Buffer.from(process.env.AUDIT_ENVELOPE_DEK, 'base64');
const iv = Buffer.from(parsed.iv, 'base64');
const tag = Buffer.from(parsed.tag, 'base64');
const enc = Buffer.from(parsed.payload, 'base64');
const decipher = createDecipheriv('aes-256-gcm', dek, iv);
decipher.setAuthTag(tag);
const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
console.log('decrypted plaintext:', plain);
