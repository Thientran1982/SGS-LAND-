/**
 * Buyer data API client (Task #52) — favorites, leads, saved searches.
 * All endpoints require the buyer JWT, attached automatically by `apiRequest`.
 */
import { apiRequest } from './client';
import type { SavedSearchFilters } from './push';
export interface ServerFavorite {
  listingId: string;
  createdAt: string;
}
export interface BuyerLead {
  id: string;
  tenantId: string;
  stage: string | null;
  createdAt: string;
  listingId: string | null;
  listingTitle: string | null;
  listingCode: string | null;
  tenantName: string | null;
}
export interface BuyerSearch {
  id: string;
  label: string;
  filters: SavedSearchFilters;
  notificationsEnabled: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export const buyerApi = {
  // Favorites ----------------------------------------------------------------
  listFavorites() {
    return apiRequest<{ favorites: ServerFavorite[] }>('/api/buyer/favorites');
  },
  addFavorite(listingId: string) {
    return apiRequest<{ ok: true; favorites: ServerFavorite[] }>('/api/buyer/favorites', {
      method: 'POST',
      body: { listingId },
    });
  },
  addFavoritesBulk(listingIds: string[]) {
    return apiRequest<{ ok: true; favorites: ServerFavorite[] }>('/api/buyer/favorites', {
      method: 'POST',
      body: { listingIds },
    });
  },
  removeFavorite(listingId: string) {
    return apiRequest<{ ok: true; removed: boolean }>(
      `/api/buyer/favorites/${encodeURIComponent(listingId)}`,
      { method: 'DELETE' },
    );
  },
  // Leads --------------------------------------------------------------------
  listLeads(limit = 50) {
    return apiRequest<{ leads: BuyerLead[] }>('/api/buyer/leads', { params: { limit } });
  },
  // Saved searches -----------------------------------------------------------
  listSearches() {
    return apiRequest<{ searches: BuyerSearch[] }>('/api/buyer/searches');
  },
  createSearch(input: {
    label: string;
    filters: SavedSearchFilters;
    notificationsEnabled?: boolean;
    deviceId?: string;
  }) {
    return apiRequest<{ search: BuyerSearch }>('/api/buyer/searches', {
      method: 'POST',
      body: input,
    });
  },
  updateSearch(
    id: string,
    patch: { label?: string; filters?: SavedSearchFilters; notificationsEnabled?: boolean },
  ) {
    return apiRequest<{ search: BuyerSearch }>(`/api/buyer/searches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },
  deleteSearch(id: string) {
    return apiRequest<{ ok: true }>(`/api/buyer/searches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};