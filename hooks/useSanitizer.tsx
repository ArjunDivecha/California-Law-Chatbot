/**
 * useSanitizer — React context for the passphrase-unlocked sanitization
 * store.
 *
 * On unlock, the context constructs a RealChatSanitizer and installs it
 * as the active ChatSanitizer via setChatSanitizer(). Every chat save
 * and every chat load immediately starts running through real
 * tokenize/rehydrate instead of the pass-through default.
 *
 * Lifecycle:
 *   - Mount: check IndexedDB for an existing `cla-sanitization-v1` db.
 *     If it exists, the provider reports hasExistingStore=true and
 *     the UI prompts the attorney to unlock; if not, first-time
 *     create flow.
 *   - unlock(passphrase): instantiates the store, derives the key,
 *     verifies the sentinel, loads the rehydrate map, installs the
 *     RealChatSanitizer. WrongPassphraseError is surfaced to the
 *     caller.
 *   - lock(): tears down the store, restores the pass-through adapter.
 *     Called on sign-out or when the attorney explicitly locks.
 *
 * The provider is browser-only. Under SSR / Node test environments
 * hasExistingStore stays false and unlock no-ops gracefully.
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
import { setChatSanitizer } from '../services/sanitization/chatAdapter';
import { RealChatSanitizer } from '../services/sanitization/realSanitizer.ts';

export interface SanitizerContextValue {
  unlocked: boolean;
  /** True after the mount check found a pre-existing db. */
  hasExistingStore: boolean;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  /** Size of the current in-memory token map. Re-renders on change. */
  tokenCount: number;
}

const DEFAULT_CTX: SanitizerContextValue = {
  unlocked: false,
  hasExistingStore: false,
  unlock: async () => {},
  lock: () => {},
  tokenCount: 0,
};

const SanitizerContext = createContext<SanitizerContextValue>(DEFAULT_CTX);

const DB_NAME = 'cla-sanitization-v1';

async function dbExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  // indexedDB.databases() is the standard way; fall back to an open-
  // with-no-version probe if the browser lacks it.
  const api = indexedDB as IDBFactory & {
    databases?: () => Promise<IDBDatabaseInfo[]>;
  };
  if (typeof api.databases === 'function') {
    try {
      const list = await api.databases();
      return list.some((d) => d.name === DB_NAME);
    } catch {
      // fall through to the open probe
    }
  }
  return await new Promise<boolean>((resolve) => {
    // Open with version=1. If the db exists, onsuccess fires with the
    // existing stores intact. If not, onupgradeneeded fires first — we
    // abort and report false. Either way we close the handle.
    let wasNew = false;
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      wasNew = true;
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      req.result.close();
      resolve(!wasNew);
    };
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}

export const SanitizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storeRef = useRef<SanitizationStore | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [hasExistingStore, setHasExistingStore] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);

  // Detect an existing db on mount so the UI can pick between "unlock"
  // and "create" copy. Fails open: if we can't check, we assume no
  // existing store and show the create flow — worst case the attorney
  // sees a create form when they should see an unlock form, then gets
  // a WrongPassphraseError and re-enters.
  useEffect(() => {
    let cancelled = false;
    dbExists().then((exists) => {
      if (!cancelled) setHasExistingStore(exists);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const store = new SanitizationStore();
    await store.init(passphrase);
    const map = await store.rehydrateMap();
    const real = new RealChatSanitizer(store, map);
    setChatSanitizer(real);
    storeRef.current = store;
    setUnlocked(true);
    setHasExistingStore(true);
    setTokenCount(map.size);
  }, []);

  const lock = useCallback(() => {
    setChatSanitizer(null);
    storeRef.current?.close();
    storeRef.current = null;
    setUnlocked(false);
    setTokenCount(0);
  }, []);

  const value = useMemo<SanitizerContextValue>(
    () => ({ unlocked, hasExistingStore, unlock, lock, tokenCount }),
    [unlocked, hasExistingStore, unlock, lock, tokenCount]
  );

  return <SanitizerContext.Provider value={value}>{children}</SanitizerContext.Provider>;
};

export function useSanitizer(): SanitizerContextValue {
  return useContext(SanitizerContext);
}

export { WrongPassphraseError };
