/**
 * Buyer deposit booking API client (Task #56).
 *
 * All endpoints require the buyer JWT (attached automatically by apiRequest).
 * The single exception is the VNPay return/IPN endpoints which are public —
 * the mobile app never calls those directly.
 */
import { apiRequest } from './client';
export type BookingStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export interface Booking {
  id: string;
  tenantId: string;
  listingId: string;
  unitId: string | null;
  buyerUserId: string;
  agentUserId: string | null;
  buyerEmail: string | null;
  depositAmount: number;
  currency: string;
  status: BookingStatus;
  vnpayTxnRef: string;
  vnpayResponseCode: string | null;
  vnpayBankCode: string | null;
  paidAt: string | null;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string | null;
  listingCode?: string | null;
}
export interface CreateBookingInput {
  listingId: string;
  unitId?: string | null;
  depositAmount?: number;
  email?: string | null;
  notes?: string | null;
}
export const bookingsApi = {
  create(input: CreateBookingInput) {
    return apiRequest<{ booking: Booking; paymentUrl: string }>('/api/bookings', {
      method: 'POST',
      body: input,
    });
  },
  listMine(limit = 20) {
    return apiRequest<{ bookings: Booking[] }>('/api/bookings/me', { params: { limit } });
  },
  get(id: string) {
    return apiRequest<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}`);
  },
  /** Mint a short-lived signed URL the system browser can open standalone. */
  receiptUrl(id: string) {
    return apiRequest<{ url: string; expiresInSec: number }>(
      `/api/bookings/${encodeURIComponent(id)}/receipt-token`,
    );
  },
};
export function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫';
}
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã huỷ',
  REFUNDED: 'Đã hoàn tiền',
};
export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING: '#D97706',
  PAID: 'var(--sgs-verified)',
  FAILED: '#DC2626',
  CANCELLED: '#64748B',
  REFUNDED: '#7C3AED',
};