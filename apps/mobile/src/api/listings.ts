import { apiRequest } from './client';
import type {
  CursorListings,
  LeadInput,
  LeadResponse,
  ListingFilters,
  PaginatedListings,
  PublicListing,
} from './types';

function buildListingParams(filters: ListingFilters | undefined) {
  if (!filters) return {};
  const out: Record<string, string | number | boolean | undefined> = {};
  if (filters.type && filters.type !== 'ALL') out.type = filters.type;
  if (filters.transaction && filters.transaction !== 'ALL') out.transaction = filters.transaction;
  if (filters.location && filters.location !== 'ALL') out.location = filters.location;
  if (filters.search) out.search = filters.search;
  if (filters.priceMin) out.priceMin = filters.priceMin;
  if (filters.priceMax) out.priceMax = filters.priceMax;
  if (filters.isVerified) out.isVerified = true;
  if (filters.projectCode) out.projectCode = filters.projectCode;
  return out;
}

export const listingsApi = {
  // Cursor-based feed. Backend keys cache by an explicit param whitelist so
  // unknown query params get dropped — keep this function aligned with the
  // server's CACHE_KEY_PARAMS list.
  listCursor(opts: { pageSize?: number; cursor?: string; filters?: ListingFilters; signal?: AbortSignal } = {}) {
    const { pageSize = 20, cursor, filters, signal } = opts;
    return apiRequest<CursorListings>('/api/public/listings', {
      params: {
        pageSize,
        cursorMode: 'true',
        cursor,
        ...buildListingParams(filters),
      },
      signal,
    });
  },

  listPaged(opts: { page?: number; pageSize?: number; filters?: ListingFilters; signal?: AbortSignal } = {}) {
    const { page = 1, pageSize = 20, filters, signal } = opts;
    return apiRequest<PaginatedListings>('/api/public/listings', {
      params: { page, pageSize, ...buildListingParams(filters) },
      signal,
    });
  },

  locations(signal?: AbortSignal) {
    return apiRequest<string[]>('/api/public/listings/locations', { signal });
  },

  detail(slugId: string, signal?: AbortSignal) {
    return apiRequest<PublicListing>(`/api/public/listings/${encodeURIComponent(slugId)}`, { signal });
  },

  similar(slugId: string, signal?: AbortSignal) {
    return apiRequest<PublicListing[]>(`/api/public/listings/${encodeURIComponent(slugId)}/similar`, { signal });
  },

  submitLead(listingId: string, input: LeadInput) {
    return apiRequest<LeadResponse>(`/api/public/listings/${encodeURIComponent(listingId)}/leads`, {
      method: 'POST',
      body: { ...input, source: input.source || 'mobile-app' },
    });
  },
};
