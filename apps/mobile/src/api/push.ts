// Buyer push + saved-search API client. Mirrors `server/routes/buyerPushRoutes.ts`.
//
// All requests are anonymous and identified by an `x-buyer-device-id` header
// that the caller is expected to populate from `getDeviceId()`.
import { apiRequest } from './client';
export interface BuyerDevice {
  id: string;
  deviceId: string;
  expoPushToken: string | null;
  platform: string | null;
  appVersion: string | null;
  notificationsEnabled: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface SavedSearchFilters {
  type?: string;
  transaction?: string;
  location?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  areaMin?: number;
  areaMax?: number;
  isVerified?: boolean;
}
export interface BuyerSavedSearch {
  id: string;
  deviceId: string;
  label: string;
  filters: SavedSearchFilters;
  notificationsEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
function deviceHeaders(deviceId: string): Record<string, string> {
  return { 'x-buyer-device-id': deviceId };
}
export const pushApi = {
  registerDevice(input: {
    deviceId: string;
    expoPushToken?: string | null;
    platform?: 'ios' | 'android' | 'web' | null;
    appVersion?: string | null;
  }) {
    return apiRequest<{ device: BuyerDevice }>('/api/buyer/devices', {
      method: 'POST',
      headers: deviceHeaders(input.deviceId),
      body: input,
    });
  },
  setPreference(deviceId: string, notificationsEnabled: boolean) {
    return apiRequest<{ device: BuyerDevice }>(
      `/api/buyer/devices/${encodeURIComponent(deviceId)}/preferences`,
      {
        method: 'PATCH',
        headers: deviceHeaders(deviceId),
        body: { notificationsEnabled },
      },
    );
  },
  listSavedSearches(deviceId: string) {
    return apiRequest<{ searches: BuyerSavedSearch[] }>('/api/buyer/saved-searches', {
      headers: deviceHeaders(deviceId),
      params: { deviceId },
    });
  },
  createSavedSearch(input: {
    deviceId: string;
    label: string;
    filters: SavedSearchFilters;
    notificationsEnabled?: boolean;
  }) {
    return apiRequest<{ search: BuyerSavedSearch }>('/api/buyer/saved-searches', {
      method: 'POST',
      headers: deviceHeaders(input.deviceId),
      body: input,
    });
  },
  updateSavedSearch(
    deviceId: string,
    id: string,
    patch: { label?: string; filters?: SavedSearchFilters; notificationsEnabled?: boolean },
  ) {
    return apiRequest<{ search: BuyerSavedSearch }>(
      `/api/buyer/saved-searches/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: deviceHeaders(deviceId),
        body: patch,
      },
    );
  },
  deleteSavedSearch(deviceId: string, id: string) {
    return apiRequest<{ ok: true }>(`/api/buyer/saved-searches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: deviceHeaders(deviceId),
    });
  },
};