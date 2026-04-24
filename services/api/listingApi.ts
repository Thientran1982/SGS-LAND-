import { api, PaginatedResponse } from './apiClient';

export const listingApi = {
  // Cursor-based: cursorMode=true forces cursor path; cursor token only sent when non-empty
  getListingsCursor: (pageSize = 20, cursor?: string, filters?: Record<string, any>): Promise<any> =>
    api.get('/api/listings', { pageSize, cursorMode: 'true', ...(cursor ? { cursor } : {}), ...filters }),

  // Offset-based (Kanban/Board/legacy)
  getListings: (page = 1, pageSize = 20, filters?: Record<string, any>): Promise<PaginatedResponse<any>> =>
    api.get('/api/listings', { page, pageSize, ...filters }),

  getListingById: (id: string): Promise<any> =>
    api.get(`/api/listings/${id}`),

  createListing: (data: Record<string, any>): Promise<any> =>
    api.post('/api/listings', data),

  updateListing: (id: string, data: Record<string, any>): Promise<any> =>
    api.put(`/api/listings/${id}`, data),

  deleteListing: (id: string): Promise<any> =>
    api.delete(`/api/listings/${id}`),

  toggleFavorite: (id: string): Promise<{ isFavorite: boolean }> =>
    api.post(`/api/listings/${id}/favorite`),

  removeFavorite: (id: string): Promise<{ isFavorite: boolean }> =>
    api.delete(`/api/listings/${id}/favorite`),

  getFavorites: (): Promise<any[]> =>
    api.get('/api/listings/favorites'),

  updateListingStatus: (id: string, status: string): Promise<any> =>
    api.patch(`/api/listings/${id}/status`, { status }),

  assignListing: (id: string, userId: string | null): Promise<any> =>
    api.patch(`/api/listings/${id}/assign`, { userId }),

  getStats: (): Promise<{ availableCount: number; holdCount: number; soldCount: number; rentedCount: number; bookingCount: number; openingCount: number; inactiveCount: number; totalCount: number }> =>
    api.get('/api/listings/stats'),

  bulkCreateListings: (listings: Record<string, unknown>[]): Promise<{ created: number; errors: { row: number; error: string }[] }> =>
    api.post('/api/listings/bulk', { listings }),
};
