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

  /**
   * Bulk-upload listing images for a project. Filenames are matched to
   * `listing.code` (case/accent-insensitive, with optional `-N` numeric suffix).
   * `mapping` lets the caller override matches manually for individual files.
   * Pass an `onProgress` callback to receive 0-100 upload progress (uses XHR).
   */
  bulkUploadImagesByCode: async (
    projectCode: string,
    files: File[],
    mapping?: Record<string, string>,
    /** Optional callback invoked with upload progress as a 0-100 integer. */
    onProgress?: (percent: number) => void
  ): Promise<{ summary: any; results: any[] }> => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    if (mapping && Object.keys(mapping).length > 0) {
      fd.append('mapping', JSON.stringify(mapping));
    }
    const url = `/api/listings/by-project/${encodeURIComponent(projectCode)}/bulk-images`;

    // Use XHR when caller wants progress (fetch lacks an upload progress event).
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          let parsed: any = null;
          try { parsed = JSON.parse(xhr.responseText); } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300 && parsed?.summary) {
            resolve(parsed);
          } else {
            reject(new Error(parsed?.error || `HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Lỗi mạng. Vui lòng thử lại.'));
        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.send(fd);
      });
    }

    const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || 'Tải ảnh hàng loạt thất bại');
    }
    return res.json();
  },
};
