/**
 * Sanitization crypto primitives.
 *
 * Pure WebCrypto. Callers provide a Crypto instance (browser: globalThis.crypto;
 * Node 19+: globalThis.crypto is a webcrypto implementation). No browser-only
 * APIs are touched here — keeps the module testable under Node without
 * polyfills.
 *
 * Passphrase handling:
 *  - PBKDF2-SHA-256, 210_000 iterations (2024 OWASP guidance), 16-byte salt.
 *  - Derived key is an AES-GCM 256-bit key. The passphrase is never stored.
 *  - The salt is public and persisted alongside the store.
 *
 * Entity encryption:
 *  - AES-GCM with a fresh 12-byte IV per record.
 *  - Encodes strings as UTF-8.
 *  - Authenticated (GCM tag) so a wrong-passphrase decrypt fails cleanly.
 *
 * A "sentinel" record is written at init. If it decrypts cleanly, the
 * passphrase was correct; if it throws, we surface a WrongPassphraseError
 * rather than letting the caller see a cascade of garbage.
 */

export class WrongPassphraseError extends Error {
  constructor() {
    super('Sanitization store could not be unlocked with the provided passphrase.');
    this.name = 'WrongPassphraseError';
  }
}

const KDF_ITERATIONS = 210_000;
const KDF_HASH = 'SHA-256';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_BITS = 256;
const SENTINEL = 'cla-sanitization-v1-sentinel';

function getCrypto(): Crypto {
  // `globalThis.crypto` is available in browsers and in Node ≥19.
  const g: Crypto | undefined = (globalThis as { crypto?: Crypto }).crypto;
  if (!g || !g.subtle) {
    throw new Error('WebCrypto is unavailable. Sanitization cannot run here.');
  }
  return g;
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  getCrypto().getRandomValues(out);
  return out;
}

export function newSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH);
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getCrypto().subtle;
  const passKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: KDF_ITERATIONS,
      hash: KDF_HASH,
    },
    passKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// Encryption record shape
// ---------------------------------------------------------------------------

export interface EncryptedBlob {
  iv: Uint8Array;
  ct: Uint8Array;
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_LENGTH);
  const ct = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv, ct: new Uint8Array(ct) };
}

export async function decryptString(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  try {
    const pt = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: blob.iv as BufferSource },
      key,
      blob.ct as BufferSource
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new WrongPassphraseError();
  }
}

// ---------------------------------------------------------------------------
// Sentinel — round-trip proof for passphrase verification on re-open
// ---------------------------------------------------------------------------

export async function createSentinel(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptString(key, SENTINEL);
}

export async function verifySentinel(key: CryptoKey, blob: EncryptedBlob): Promise<void> {
  const text = await decryptString(key, blob);
  if (text !== SENTINEL) throw new WrongPassphraseError();
}

// ---------------------------------------------------------------------------
// Deterministic lookup key — SHA-256 of (category + ':' + lowercased raw)
// ---------------------------------------------------------------------------

export async function lookupKey(category: string, raw: string): Promise<string> {
  const input = `${category}:${raw.trim().toLowerCase()}`;
  const hash = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(input));
  // Hex-encode for use as an IndexedDB key.
  const bytes = new Uint8Array(hash);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
