/**
 * storageService.ts — type-safe localStorage/sessionStorage wrapper
 * Features: JSON serialization, TTL/expiry, error resilience, SSR-safe
 */

interface StorageEntry<T> {
  value: T;
  expires?: number; // Unix timestamp ms
  version?: string;
}

type StorageType = 'local' | 'session';

function getStorage(type: StorageType): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Set a value with optional TTL in seconds and version tag */
export function storageSet<T>(
  key: string,
  value: T,
  options: { ttlSeconds?: number; version?: string; type?: StorageType } = {}
): boolean {
  const { ttlSeconds, version, type = 'local' } = options;
  const storage = getStorage(type);
  if (!storage) return false;

  const entry: StorageEntry<T> = { value };
  if (ttlSeconds != null) entry.expires = Date.now() + ttlSeconds * 1000;
  if (version) entry.version = version;

  try {
    storage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (e) {
    // QuotaExceededError — silently fail
    console.warn('[storageService] set failed:', key, e);
    return false;
  }
}

/** Get a typed value, returns null if missing/expired/version mismatch */
export function storageGet<T>(
  key: string,
  options: { version?: string; type?: StorageType } = {}
): T | null {
  const { version, type = 'local' } = options;
  const storage = getStorage(type);
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const entry: StorageEntry<T> = JSON.parse(raw);

    // Check expiry
    if (entry.expires != null && Date.now() > entry.expires) {
      storage.removeItem(key);
      return null;
    }

    // Check version
    if (version != null && entry.version !== version) {
      storage.removeItem(key);
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

/** Remove a key */
export function storageRemove(key: string, type: StorageType = 'local'): void {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {}
}

/** Clear all keys matching a prefix */
export function storageClearPrefix(prefix: string, type: StorageType = 'local'): void {
  const storage = getStorage(type);
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach(k => storage.removeItem(k));
  } catch {}
}

/** Check if a key exists and is not expired */
export function storageHas(key: string, type: StorageType = 'local'): boolean {
  return storageGet(key, { type }) !== null;
}

/** Get all keys matching a prefix */
export function storageKeys(prefix: string, type: StorageType = 'local'): string[] {
  const storage = getStorage(type);
  if (!storage) return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

// --- Convenience session wrappers ---
export const sessionSet = <T>(key: string, value: T, ttlSeconds?: number) =>
  storageSet(key, value, { type: 'session', ttlSeconds });

export const sessionGet = <T>(key: string): T | null =>
  storageGet<T>(key, { type: 'session' });

export const sessionRemove = (key: string) => storageRemove(key, 'session');

// --- App-specific named constants for common keys ---
export const STORAGE_KEYS = {
  THEME: 'sgs:theme',
  LANG: 'sgs:lang',
  LAST_ROUTE: 'sgs:last-route',
  AUTH_USER: 'sgs:auth-user',
  FILTER_LEADS: 'sgs:filter:leads',
  FILTER_INVENTORY: 'sgs:filter:inventory',
  FILTER_PROJECTS: 'sgs:filter:projects',
  ONBOARDING_DISMISSED: 'sgs:onboarding:dismissed',
  AI_VALUATION_CACHE: 'sgs:ai-valuation:cache',
  BANK_RATES_CACHE: 'sgs:bank-rates:cache',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
