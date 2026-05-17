/**
 * Saved-searches store (Task #52).
 *
 * Routing rules:
 *   • Authenticated buyer (JWT in secure store) → /api/buyer/searches
 *     (account-scoped, syncs across devices).
 *   • Anonymous → legacy /api/buyer/saved-searches keyed by deviceId.
 *
 * On login, `syncSavedSearches()` migrates any device-scoped searches into
 * the buyer's account and deletes the device-scoped originals so they don't
 * appear twice or leak to another buyer who later signs in on this device.
 */
import { getDeviceId } from './device';
import { getBuyerToken } from './auth';
import { pushApi, type BuyerSavedSearch, type SavedSearchFilters } from '../api/push';
import { buyerApi, type BuyerSearch } from '../api/buyer';
export type { SavedSearchFilters } from '../api/push';
/** Normalized shape used by the UI — works for both anonymous and buyer. */
export interface SavedSearch {
  id: string;
  label: string;
  filters: SavedSearchFilters;
  notificationsEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
function fromDevice(s: BuyerSavedSearch): SavedSearch {
  return {
    id: s.id,
    label: s.label,
    filters: s.filters,
    notificationsEnabled: s.notificationsEnabled,
    lastNotifiedAt: s.lastNotifiedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
function fromBuyer(s: BuyerSearch): SavedSearch {
  return {
    id: s.id,
    label: s.label,
    filters: s.filters,
    notificationsEnabled: s.notificationsEnabled,
    lastNotifiedAt: s.lastNotifiedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
export async function listSavedSearches(): Promise<SavedSearch[]> {
  const token = await getBuyerToken();
  if (token) {
    const r = await buyerApi.listSearches();
    return r.searches.map(fromBuyer);
  }
  const deviceId = await getDeviceId();
  const res = await pushApi.listSavedSearches(deviceId);
  return res.searches.map(fromDevice);
}
export async function createSavedSearch(input: {
  label: string;
  filters: SavedSearchFilters;
  notificationsEnabled?: boolean;
}): Promise<SavedSearch> {
  const token = await getBuyerToken();
  if (token) {
    const r = await buyerApi.createSearch(input);
    return fromBuyer(r.search);
  }
  const deviceId = await getDeviceId();
  const res = await pushApi.createSavedSearch({ deviceId, ...input });
  return fromDevice(res.search);
}
export async function deleteSavedSearch(id: string): Promise<void> {
  const token = await getBuyerToken();
  if (token) {
    await buyerApi.deleteSearch(id);
    return;
  }
  const deviceId = await getDeviceId();
  await pushApi.deleteSavedSearch(deviceId, id);
}
export async function toggleSavedSearchNotifications(
  id: string,
  enabled: boolean,
): Promise<SavedSearch> {
  const token = await getBuyerToken();
  if (token) {
    const r = await buyerApi.updateSearch(id, { notificationsEnabled: enabled });
    return fromBuyer(r.search);
  }
  const deviceId = await getDeviceId();
  const res = await pushApi.updateSavedSearch(deviceId, id, { notificationsEnabled: enabled });
  return fromDevice(res.search);
}
/**
 * Migrate any device-scoped searches into the signed-in buyer's account.
 * Best-effort: failures are swallowed and the device-scoped row is left in
 * place so the next sync attempt can retry it.
 */
export async function syncSavedSearches(): Promise<void> {
  const token = await getBuyerToken();
  if (!token) return;
  let deviceId: string;
  try {
    deviceId = await getDeviceId();
  } catch {
    return;
  }
  let deviceSearches: BuyerSavedSearch[] = [];
  try {
    const r = await pushApi.listSavedSearches(deviceId);
    deviceSearches = r.searches;
  } catch {
    return; // nothing we can do without a device list
  }
  if (!deviceSearches.length) return;
  for (const s of deviceSearches) {
    try {
      await buyerApi.createSearch({
        label: s.label,
        filters: s.filters,
        notificationsEnabled: s.notificationsEnabled,
      });
      // Only delete the device copy after a successful migrate so we never
      // lose the user's data on a transient failure.
      try {
        await pushApi.deleteSavedSearch(deviceId, s.id);
      } catch {
        /* leave for next sync */
      }
    } catch {
      /* leave for next sync */
    }
  }
}