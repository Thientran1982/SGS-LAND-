/**
 * Buyer auth token storage (Task #52).
 *
 * The JWT issued by /api/buyer/auth/verify-otp is sensitive — kept in
 * expo-secure-store (Keychain on iOS, EncryptedSharedPreferences on Android)
 * instead of AsyncStorage so other apps / a rooted file scrape can't read it.
 *
 * The cached user payload (id + phone + displayName) lives in AsyncStorage
 * because it's non-sensitive and we want synchronous-ish bootstrap of the UI.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'sgs.buyer.jwt.v1';
const USER_KEY = 'sgs.buyer.user.v1';

export interface BuyerUserCache {
  id: string;
  phone: string;
  displayName?: string | null;
}

let memoryToken: string | null | undefined; // undefined = not yet loaded

export async function getBuyerToken(): Promise<string | null> {
  if (memoryToken !== undefined) return memoryToken;
  try {
    memoryToken = (await SecureStore.getItemAsync(TOKEN_KEY)) || null;
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export async function setBuyerToken(token: string): Promise<void> {
  memoryToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // best effort — keep in-memory copy so the session works for this launch
  }
}

export async function clearBuyerToken(): Promise<void> {
  memoryToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export async function getCachedBuyerUser(): Promise<BuyerUserCache | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.phone === 'string') {
      return parsed as BuyerUserCache;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setCachedBuyerUser(user: BuyerUserCache): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}
