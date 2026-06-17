/*
 * =============================================================================
 * workspaceCrypto.test.ts — round-trip + tamper test for the AES-GCM core
 * =============================================================================
 *
 * Verifies the device-key encryption used to protect the Drafting Magic
 * workspace at rest (services/workspaceCrypto.ts). The IndexedDB key-management
 * wrapper needs a browser, so this test exercises the crypto CORE directly by
 * generating a key in-process and asserting:
 *   1. encrypt -> decrypt round-trips an exact JSON string;
 *   2. output carries the "enc:v1:" version prefix and is detected by isEncrypted;
 *   3. a DIFFERENT key cannot decrypt (confidentiality / wrong-device);
 *   4. tampered ciphertext is rejected (GCM auth tag / integrity);
 *   5. legacy plaintext JSON is correctly identified as NOT encrypted (migration).
 *
 * INPUT FILES:  none.   OUTPUT FILES: none (prints PASS/FAIL to stdout).
 * RUN: ./node_modules/.bin/tsx tests/workspaceCrypto.test.ts
 * =============================================================================
 */
import {
  encryptStringWithKey,
  decryptStringWithKey,
  isEncrypted,
} from '../services/workspaceCrypto.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log(`  ok: ${msg}`);
}

async function newKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function main(): Promise<void> {
  const key = await newKey();
  const sample = JSON.stringify({ version: 1, client: 'Riley Q. Sample', amount: '$1,250,000' });

  // 1. round-trip
  const blob = await encryptStringWithKey(key, sample);
  const back = await decryptStringWithKey(key, blob);
  assert(back === sample, 'round-trips exact plaintext');

  // 2. version prefix + detection
  assert(blob.startsWith('enc:v1:'), 'ciphertext carries enc:v1: prefix');
  assert(isEncrypted(blob), 'isEncrypted() recognizes ciphertext');
  assert(blob.indexOf('Sample') === -1 && blob.indexOf('1,250,000') === -1, 'plaintext not visible in ciphertext');

  // 3. wrong key cannot decrypt
  const other = await newKey();
  let wrongKeyThrew = false;
  try { await decryptStringWithKey(other, blob); } catch { wrongKeyThrew = true; }
  assert(wrongKeyThrew, 'a different device key cannot decrypt');

  // 4. tampered ciphertext rejected
  const tampered = blob.slice(0, -4) + (blob.endsWith('A') ? 'B' : 'A') + blob.slice(-3);
  let tamperThrew = false;
  try { await decryptStringWithKey(key, tampered); } catch { tamperThrew = true; }
  assert(tamperThrew, 'tampered ciphertext is rejected (GCM integrity)');

  // 5. legacy plaintext is not mistaken for ciphertext
  assert(!isEncrypted('{"version":1,"sources":[]}'), 'legacy plaintext JSON detected as NOT encrypted');
  assert(!isEncrypted(null) && !isEncrypted(undefined), 'null/undefined handled');

  console.log('\nworkspaceCrypto: ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('workspaceCrypto test crashed:', err);
  process.exitCode = 1;
});
