/**
 * Favorites store — local-first with opportunistic server sync (Task #52).
 *
 * Behaviour:
 *   • Local source of truth = AsyncStorage (so anonymous browsing always works
 *     and toggles are instant offline).
 *   • When a buyer JWT is present, every mutation is mirrored to the server
 *     (best-effort, fire-and-forget — local state is never blocked on the
 *     network). Failures get queued and retried on the next `syncFavorites`.
 *   • On login, `syncFavorites()` performs a union-merge with the server set:
 *     anything local-only gets POSTed up; the server set then becomes the new
 *     local set so other devices' favorites appear immediately.
 *   • On logout, the local cache is intentionally preserved so the user can
 *     keep browsing their picks anonymously.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buyerApi } from '../api/buyer';
import { ApiError } from '../api/client';
import { getBuyerToken } from './auth';
const KEY = 'sgs.favorites.v1';
const PENDING_KEY = 'sgs.favorites.pending.v1';
interface PendingOps {
  add: string[];
  remove: string[];
}
// ── Local cache primitives ──────────────────────────────────────────────────
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
    /* best-effort */
  }
}
/**
 * Wipe local favorites + pending sync queue. Call this on logout so the next
 * buyer who signs in on this device cannot inherit (or accidentally upload)
 * the previous account's favorites via `syncFavorites()`.
 */
export async function clearLocalFavorites(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, PENDING_KEY]);
  } catch {
    /* best-effort */
  }
}
async function loadPending(): Promise<PendingOps> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return { add: [], remove: [] };
    const p = JSON.parse(raw);
    return {
      add: Array.isArray(p?.add) ? p.add.filter((x: any) => typeof x === 'string') : [],
      remove: Array.isArray(p?.remove) ? p.remove.filter((x: any) => typeof x === 'string') : [],
    };
  } catch {
    return { add: [], remove: [] };
  }
}
async function savePending(p: PendingOps): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* best-effort */
  }
}
async function pushPending(op: 'add' | 'remove', id: string): Promise<void> {
  const p = await loadPending();
  // Cancel out conflicting ops — e.g. add then remove → both gone.
  const other: 'add' | 'remove' = op === 'add' ? 'remove' : 'add';
  p[other] = p[other].filter((x) => x !== id);
  if (!p[op].includes(id)) p[op].push(id);
  await savePending(p);
}
// ── Server sync ─────────────────────────────────────────────────────────────
/** Fire-and-forget: kick a server mutation but never throw to the caller. */
async function tryServer(op: 'add' | 'remove', id: string): Promise<void> {
  const token = await getBuyerToken();
  if (!token) return;
  try {
    if (op === 'add') await buyerApi.addFavorite(id);
    else await buyerApi.removeFavorite(id);
  } catch (err) {
    // Auth issues: client.ts already cleared the token; queue locally so a
    // later login picks the change up.
    if (err instanceof ApiError && err.status === 401) {
      await pushPending(op, id);
      return;
    }
    // Network / 5xx: queue and try again later.
    await pushPending(op, id);
  }
}
/**
 * Merge local + server favorites. Call after login (and opportunistically on
 * app launch when a token exists). Returns the reconciled local set.
 */
export async function syncFavorites(): Promise<Set<string>> {
  const token = await getBuyerToken();
  const local = await loadFavorites();
  if (!token) return local;
  // 1. Replay pending ops first so the server reflects local intent.
  const pending = await loadPending();
  if (pending.add.length) {
    try {
      await buyerApi.addFavoritesBulk(pending.add);
      pending.add = [];
    } catch {
      // leave queued for next attempt
    }
  }
  if (pending.remove.length) {
    const stillPending: string[] = [];
    for (const id of pending.remove) {
      try {
        await buyerApi.removeFavorite(id);
      } catch {
        stillPending.push(id);
      }
    }
    pending.remove = stillPending;
  }
  await savePending(pending);
  // 2. Pull server state, union with any local-only IDs (first-time login —
  //    user had favorites before signing in).
  let serverIds: string[] = [];
  try {
    const r = await buyerApi.listFavorites();
    serverIds = r.favorites.map((f) => f.listingId);
  } catch {
    return local; // network down — keep local truth
  }
  const merged = new Set<string>([...serverIds, ...local]);
  // 3. Push any local-only IDs to the server so other devices see them.
  const localOnly = Array.from(local).filter((id) => !serverIds.includes(id));
  if (localOnly.length) {
    try {
      await buyerApi.addFavoritesBulk(localOnly);
    } catch {
      // queue for next sync
      const p = await loadPending();
      for (const id of localOnly) if (!p.add.includes(id)) p.add.push(id);
      await savePending(p);
    }
  }
  await saveFavorites(merged);
  return merged;
}
// ── Public mutations (used by all screens) ─────────────────────────────────
export async function toggleFavorite(id: string): Promise<Set<string>> {
  const cur = await loadFavorites();
  const op: 'add' | 'remove' = cur.has(id) ? 'remove' : 'add';
  if (op === 'add') cur.add(id);
  else cur.delete(id);
  await saveFavorites(cur);
  // Don't await — UI shouldn't wait on the network.
  void tryServer(op, id);
  return cur;
}
export async function removeFavorite(id: string): Promise<Set<string>> {
  const cur = await loadFavorites();
  if (!cur.has(id)) return cur;
  cur.delete(id);
  await saveFavorites(cur);
  void tryServer('remove', id);
  return cur;
}