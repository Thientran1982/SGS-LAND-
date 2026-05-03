// Lightweight wrapper around the saved-searches API. Mirrors `favorites.ts`:
// a thin layer the screens can call without thinking about deviceId.

import { getDeviceId } from './device';
import { pushApi, BuyerSavedSearch, SavedSearchFilters } from '../api/push';

export async function listSavedSearches(): Promise<BuyerSavedSearch[]> {
  const deviceId = await getDeviceId();
  const res = await pushApi.listSavedSearches(deviceId);
  return res.searches;
}

export async function createSavedSearch(input: {
  label: string;
  filters: SavedSearchFilters;
  notificationsEnabled?: boolean;
}): Promise<BuyerSavedSearch> {
  const deviceId = await getDeviceId();
  const res = await pushApi.createSavedSearch({ deviceId, ...input });
  return res.search;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const deviceId = await getDeviceId();
  await pushApi.deleteSavedSearch(deviceId, id);
}

export async function toggleSavedSearchNotifications(
  id: string,
  enabled: boolean,
): Promise<BuyerSavedSearch> {
  const deviceId = await getDeviceId();
  const res = await pushApi.updateSavedSearch(deviceId, id, { notificationsEnabled: enabled });
  return res.search;
}
