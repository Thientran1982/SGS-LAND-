// Stable per-install device identifier + notification preference cache.
// We don't have buyer auth yet (Sprint 3+), so the saved-search / push
// system is keyed by a UUID generated on first launch and persisted with
// AsyncStorage. Survives app updates; resets on reinstall (which is fine —
// the old token would have been invalidated by the OS anyway).

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'sgs.device.id.v1';
const PREF_KEY = 'sgs.push.enabled.v1';
const TOKEN_KEY = 'sgs.push.token.v1';
const TOKEN_REGISTERED_AT_KEY = 'sgs.push.token.registeredAt.v1';

function uuidv4(): string {
  // RFC4122 v4 — Math.random() is fine for an opaque client id.
  // Position 14 is the version nibble (always 4); position 19 is the
  // variant nibble whose top two bits must be `10` → value in 8..b.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[((Math.random() * 4) | 0) + 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}

export async function getDeviceId(): Promise<string> {
  try {
    const cur = await AsyncStorage.getItem(DEVICE_KEY);
    if (cur && cur.length >= 8) return cur;
  } catch {
    // fall through and regenerate
  }
  const next = uuidv4();
  try {
    await AsyncStorage.setItem(DEVICE_KEY, next);
  } catch {
    // best-effort
  }
  return next;
}

export async function getCachedPushPreference(): Promise<boolean | null> {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    if (v === null) return null;
    return v === '1';
  } catch {
    return null;
  }
}

export async function setCachedPushPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? '1' : '0');
  } catch {
    /* best-effort */
  }
}

export async function getCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setCachedPushToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(TOKEN_REGISTERED_AT_KEY, String(Date.now()));
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(TOKEN_REGISTERED_AT_KEY);
    }
  } catch {
    /* best-effort */
  }
}

export async function getTokenRegisteredAt(): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(TOKEN_REGISTERED_AT_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
