// Local-only favorites store for anonymous users. Backed by AsyncStorage so
// values survive app restarts. When buyer auth ships in Sprint 3 we'll add a
// sync layer that pushes/pulls from `/api/buyer/favorites`.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sgs.favorites.v1';

export async function loadFavorites(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveFavorites(set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    // best-effort — storage failures shouldn't crash the UI
  }
}

export async function toggleFavorite(id: string): Promise<Set<string>> {
  const cur = await loadFavorites();
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  await saveFavorites(cur);
  return cur;
}

export async function removeFavorite(id: string): Promise<Set<string>> {
  const cur = await loadFavorites();
  if (!cur.has(id)) return cur;
  cur.delete(id);
  await saveFavorites(cur);
  return cur;
}
