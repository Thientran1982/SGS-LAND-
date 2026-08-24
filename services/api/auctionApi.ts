import { api } from './apiClient';

export const auctionApi = {
  list: (params?: Record<string, any>) => api.get<any[]>('/api/auctions', params),
  create: (data: Record<string, any>) => api.post<any>('/api/auctions', data),
  bids: (id: string) => api.get<any[]>(`/api/auctions/${id}/bids`),
  updateStatus: (id: string, status: string) => api.patch<any>(`/api/auctions/${id}/status`, { status }),
  placeBid: (id: string, amount: number, idempotencyKey: string) =>
    api.post<any>(`/api/auctions/${id}/bids`, { amount, idempotencyKey }),
};