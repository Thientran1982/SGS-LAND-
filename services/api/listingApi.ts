import { api, PaginatedResponse } from './apiClient';

export const listingApi = {
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
};
