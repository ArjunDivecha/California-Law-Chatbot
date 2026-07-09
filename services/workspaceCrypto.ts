/*
 * =============================================================================
 * workspaceCrypto.ts — at-rest encryption for the Drafting Magic workspace
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 * The Drafting Magic page keeps an in-progress estate-planning workspace
 * (source documents, comparison rows, drafted sections, strategy notes) so an
 * attorney can close the tab and pick up later. That snapshot used to be saved
 * to the browser's localStorage as PLAINTEXT JSON, so anything able to read the
 * on-disk profile (a forensic dump, a synced backup, a casual inspection) could
 * read raw client matter content.
 *
 * This module encrypts that snapshot at rest with AES-256-GCM using a
 * DEVICE-LOCAL key that:
 *   - is generated once, on this device, in this browser;
 *   - is NON-EXTRACTABLE (the raw key bytes can never be read back out of the
 *     browser, even by our own code) and stored in IndexedDB;
 *   - has NO passphrase — matching the token-map "device key, no passphrase"
 *     posture in the §Q partner memo. Clearing browser data destroys the key
 *     (and the token map); prior encrypted workspaces then become unreadable.
 *     That is the same deliberate "no recovery" trade-off the token map makes.
 *
 * SCOPE / HONEST LIMITS: this protects data AT REST. It does NOT defend against
 * malicious same-origin JavaScript (which could call decrypt itself) — that
 * threat is addressed by removing third-party CDN scripts (see index.html /
 * tailwind build pipeline) and is the reason that hardening shipped alongside
 * this. Encryption here is defense-in-depth for the on-disk surface.
 *
 * INPUT FILES:  none.
 * OUTPUT FILES: none (operates on in-memory strings; the ciphertext is written
 *               to localStorage by the caller — components/v2/V2DraftingMagicPage.tsx
 *               under key 'drafting-magic:estate-workspace:v1').
 *
 * STORAGE SIDE EFFECT: creates IndexedDB database 'ffllp-workspace-crypto'
 *               (object store 'keys', record 'workspace-aes-gcm-v1') to hold the
 *               non-extractable CryptoKey.
 *
 * USED BY: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/components/v2/V2DraftingMagicPage.tsx
 * TESTED BY: /Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/tests/workspaceCrypto.test.ts
 * =============================================================================
 */

const DB_NAME = 'ffllp-workspace-crypto';
const STORE = 'keys';
const KEY_ID = 'workspace-aes-gcm-v1';
const IV_BYTES = 12; // 96-bit nonce, the standard for AES-GCM
const ENC_PREFIX = 'enc:v1:';

/** True when a stored blob is one of our AES-GCM ciphertexts (vs legacy plaintext). */
export function isEncrypted(payload: string | null | undefined): payload is string {
  return typeof payload === 'string' && payload.startsWith(ENC_PREFIX);
}

// ── base64 over raw bytes (browser btoa/atob; both also exist in Node ≥18) ──
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

// ── AES-GCM core. Takes an explicit key so it is unit-testable without IndexedDB ──

/** Encrypt `plaintext` with `key`; returns "enc:v1:" + base64(iv ‖ ciphertext). */
export async function encryptStringWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return ENC_PREFIX + bytesToBase64(combined);
}

/** Decrypt a "enc:v1:" blob produced by encryptStringWithKey. Throws on tamper / wrong key. */
export async function decryptStringWithKey(key: CryptoKey, payload: string): Promise<string> {
  if (!isEncrypted(payload)) {
    throw new Error('decryptStringWithKey: payload is not an encrypted workspace blob');
  }
  const combined = base64ToBytes(payload.slice(ENC_PREFIX.length));
  const iv = combined.slice(0, IV_BYTES);
  const cipher = combined.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// ── Device key management (browser only; cached for the page lifetime) ──
let keyPromise: Promise<CryptoKey> | null = null;

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('workspaceCrypto: IndexedDB unavailable in this context'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('workspaceCrypto: IndexedDB open failed'));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('workspaceCrypto: IndexedDB get failed'));
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('workspaceCrypto: IndexedDB put failed'));
  });
}

/**
 * Get (or, on first use, generate + persist) this device's non-extractable
 * AES-GCM workspace key. The CryptoKey object is structured-cloned into
 * IndexedDB; its raw bytes never leave the browser.
 */
async function getDeviceKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const db = await openKeyDb();
    const existing = (await idbGet(db, KEY_ID)) as CryptoKey | undefined;
    if (existing) return existing;
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'],
    );
    await idbPut(db, KEY_ID, key);
    return key;
  })();
  return keyPromise;
}

/** Encrypt a workspace snapshot string with the device-local key. */
export async function encryptWorkspace(plaintext: string): Promise<string> {
  return encryptStringWithKey(await getDeviceKey(), plaintext);
}

/** Decrypt a workspace blob with the device-local key. Throws if the key is gone. */
export async function decryptWorkspace(payload: string): Promise<string> {
  return decryptStringWithKey(await getDeviceKey(), payload);
}
