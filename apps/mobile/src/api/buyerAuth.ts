/**
 * Buyer auth API client (Task #52).
 *
 * Mirrors `server/routes/buyerAuthRoutes.ts`. The OTP request/verify endpoints
 * are explicitly unauthenticated — we pass `auth: false` so no stale token
 * leaks into the issuer flow.
 */

import { apiRequest } from './client';

export interface BuyerUser {
  id: string;
  phone: string;
  displayName?: string | null;
  lastLoginAt?: string | null;
}

export const buyerAuthApi = {
  requestOtp(phone: string) {
    return apiRequest<{ ok: true; phone: string; devCode?: string }>('/api/buyer/auth/request-otp', {
      method: 'POST',
      body: { phone },
      auth: false,
    });
  },

  verifyOtp(phone: string, code: string) {
    return apiRequest<{ token: string; user: BuyerUser }>('/api/buyer/auth/verify-otp', {
      method: 'POST',
      body: { phone, code },
      auth: false,
    });
  },

  me() {
    return apiRequest<{ user: BuyerUser }>('/api/buyer/auth/me');
  },

  setDisplayName(displayName: string) {
    return apiRequest<{ user: BuyerUser }>('/api/buyer/auth/me', {
      method: 'PATCH',
      body: { displayName },
    });
  },

  logout() {
    return apiRequest<{ ok: true }>('/api/buyer/auth/logout', { method: 'POST' });
  },
};
