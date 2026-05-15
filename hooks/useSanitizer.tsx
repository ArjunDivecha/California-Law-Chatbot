/**
 * useSanitizer — React context for the auto-unlocked sanitization store.
 *
 * There is intentionally no attorney-facing passphrase. On first mount
 * we generate a device-scoped random key and persist it in localStorage
 * under `cla-sanitization-device-key`. On subsequent mounts we read
 * that same key and auto-open the encrypted IndexedDB store. The
 * RealChatSanitizer is installed as the active ChatSanitizer via
 * setChatSanitizer(), and chat saves/loads round-trip through tokenize
 * and rehydrate transparently.
 *
 * Trust model:
 *   - Token map lives ONLY in the attorney's browser IndexedDB.
 *   - The device key never leaves the browser. localStorage is same-
 *     origin protected.
 *   - If the attorney clears site data / switches devices, the key is
 *     gone and prior tokenized chats become un-rehydrate-able (tokens
 *     show through instead of real names). This is the same
 *     "no-recovery" property we want without making attorneys type a
 *     passphrase. A reset() action is exposed for explicit rotation.
 *
 * Under SSR / Node tests (no window / no indexedDB) the provider
 * renders children immediately with ready=false and unlocked=false.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SanitizationStore,
  WrongPassphraseError,
} from '../api/_shared/sanitization/store.ts';
import type { SpanCategory } from '../api/_shared/sanitization/index.ts';
import { setChatSanitizer } from '../services/sanitization/chatAdapter';
import { RealChatSanitizer } from '../services/sanitization/realSanitizer.ts';
import {
  getHealth,
  warmup as opfWarmup,
  type DaemonStatus,
} from '../services/sanitization/opfClient';

export interface SanitizerContextValue {
  /** True once the store is open and the RealChatSanitizer is installed. */
  unlocked: boolean;
  /** True once the provider has finished its mount-time init attempt. */
  ready: boolean;
  /** Size of the current in-memory token map. Re-renders on change. */
  tokenCount: number;
  /** Force a hard reset: wipe the device key and the IndexedDB store. */
  reset: () => Promise<void>;
  /** Error captured during auto-init, if any. */
  initError: string | null;
  /** Snapshot of token→raw mappings for UI display. */
  getMap: () => Map<string, string>;
  /** Manually add an entity to the persistent store and return its token. */
  addEntity: (raw: string, category: SpanCategory) => Promise<string | null>;
  /** Forget a token (deletes from store + cache). */
  forgetToken: (token: string) => Promise<void>;
  /** Health of the local OPF detection daemon. Polled every 30s. */
  daemonStatus: DaemonStatus;
}

const DEFAULT_CTX: SanitizerContextValue = {
  unlocked: false,
  ready: false,
  tokenCount: 0,
  reset: async () => {},
  initError: null,
  getMap: () => new Map(),
  addEntity: async () => null,
  forgetToken: async () => {},
  daemonStatus: { state: 'unknown' },
};

const SanitizerContext = createContext<SanitizerContextValue>(DEFAULT_CTX);

const DB_NAME = 'cla-sanitization-v1';
const DEVICE_KEY_STORAGE = 'cla-sanitization-device-key';

function hasBrowserStorage(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof indexedDB !== 'undefined'
  );
}

function getOrCreateDeviceKey(): string {
  const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);
  if (existing && existing.length >= 32) return existing;
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  window.localStorage.setItem(DEVICE_KEY_STORAGE, hex);
  return hex;
}

async function deleteDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export const SanitizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storeRef = useRef<SanitizationStore | null>(null);
  const sanitizerRef = useRef<RealChatSanitizer | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>({ state: 'unknown' });

  const openStore = useCallback(async () => {
    if (!hasBrowserStorage()) {
      setReady(true);
      return;
    }
    try {
      const key = getOrCreateDeviceKey();
      const store = new SanitizationStore();
      await store.init(key);
      const map = await store.rehydrateMap();
      const real = new RealChatSanitizer(store, map);
      setChatSanitizer(real);
      storeRef.current = store;
      sanitizerRef.current = real;
      setTokenCount(map.size);
      setUnlocked(true);
      setInitError(null);
    } catch (err) {
      // WrongPassphraseError means the device-key and the stored salt
      // are out of sync (e.g., localStorage was cleared while IndexedDB
      // survived). Wipe the db and start fresh — prior tokenized chats
      // will appear as tokens, which is the correct compliance outcome.
      if (err instanceof WrongPassphraseError) {
        console.warn('[sanitizer] device key mismatch; resetting store');
        await deleteDb();
        // Generate a new device key and try once more.
        window.localStorage.removeItem(DEVICE_KEY_STORAGE);
        try {
          const key = getOrCreateDeviceKey();
          const store = new SanitizationStore();
          await store.init(key);
          const map = await store.rehydrateMap();
          const real = new RealChatSanitizer(store, map);
          setChatSanitizer(real);
          storeRef.current = store;
          setTokenCount(map.size);
          setUnlocked(true);
        } catch (retryErr) {
          setInitError(
            (retryErr as { message?: string })?.message ?? 'Sanitization init failed.'
          );
          setChatSanitizer(null);
        }
      } else {
        setInitError(
          (err as { message?: string })?.message ?? 'Sanitization init failed.'
        );
        setChatSanitizer(null);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void openStore();
    return () => {
      storeRef.current?.close();
      storeRef.current = null;
      setChatSanitizer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── OPF daemon lifecycle (Option C: warm on app open) ────────────────────
  // Fires once when the SanitizerProvider mounts — typically right after
  // sign-in, before the user navigates into a chat or drafting tab. By the
  // time they finish typing their first message the model is already
  // loaded. After that, the model stays warm during active use and the
  // daemon's own idle-watcher unloads it after 10 minutes.
  //
  // Health is polled every 30s. If the daemon goes from healthy →
  // unreachable mid-session, the SanitizationBanner flips state and
  // outbound sends will fail-closed.
  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        const health = await getHealth();
        if (!cancelled) setDaemonStatus({ state: 'healthy', health });
        return health;
      } catch (err) {
        if (!cancelled) {
          setDaemonStatus({
            state: 'unreachable',
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return null;
      }
    };

    // Initial probe + warmup. We don't await warmup because it can take
    // 19s on a launchd-spawned process; let it happen in the background.
    void (async () => {
      const initial = await probe();
      if (cancelled) return;
      if (initial && !initial.modelLoaded) {
        // Fire and forget: triggers cold load while the user is reading.
        opfWarmup()
          .catch(() => { /* warmup failure is non-fatal — health probe will surface it */ })
          .finally(() => {
            if (!cancelled) void probe();
          });
      }
    })();

    const interval = window.setInterval(() => { void probe(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const reset = useCallback(async () => {
    setUnlocked(false);
    setTokenCount(0);
    setChatSanitizer(null);
    storeRef.current?.close();
    storeRef.current = null;
    sanitizerRef.current = null;
    if (hasBrowserStorage()) {
      window.localStorage.removeItem(DEVICE_KEY_STORAGE);
      await deleteDb();
    }
    await openStore();
  }, [openStore]);

  const getMap = useCallback((): Map<string, string> => {
    return sanitizerRef.current?.snapshotMap() ?? new Map();
  }, []);

  const addEntity = useCallback(
    async (raw: string, category: SpanCategory): Promise<string | null> => {
      const store = storeRef.current;
      const sanitizer = sanitizerRef.current;
      if (!store || !sanitizer) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const tok = await store.assignToken(trimmed, category);
      // Reload the in-memory cache so rehydrate picks up the new entry.
      const map = await store.rehydrateMap();
      sanitizer.replaceMap(map);
      setTokenCount(map.size);
      return tok.value;
    },
    []
  );

  const forgetToken = useCallback(async (token: string): Promise<void> => {
    const sanitizer = sanitizerRef.current;
    if (!sanitizer) return;
    await sanitizer.forgetEntity(token);
    setTokenCount(sanitizer.snapshotMap().size);
  }, []);

  const value = useMemo<SanitizerContextValue>(
    () => ({ unlocked, ready, tokenCount, reset, initError, getMap, addEntity, forgetToken, daemonStatus }),
    [unlocked, ready, tokenCount, reset, initError, getMap, addEntity, forgetToken, daemonStatus]
  );

  return <SanitizerContext.Provider value={value}>{children}</SanitizerContext.Provider>;
};

export function useSanitizer(): SanitizerContextValue {
  return useContext(SanitizerContext);
}
