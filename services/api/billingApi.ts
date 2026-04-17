import { api } from './apiClient';

export interface CheckoutSessionDTO {
  sessionId: string;
  planId: 'TEAM' | 'ENTERPRISE';
  planName: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  provider: 'mock' | 'stripe';
  providerCheckoutUrl?: string | null;
  expiresAt: string;
  paidAt?: string | null;
}

export interface CheckoutConfirmResult extends CheckoutSessionDTO {
  subscription?: any;
}

export const billingApi = {
  createCheckout: (planId: 'TEAM' | 'ENTERPRISE'): Promise<CheckoutSessionDTO> =>
    api.post('/api/billing/checkout', { planId }),

  getCheckout: (sessionId: string): Promise<CheckoutSessionDTO> =>
    api.get(`/api/billing/checkout/${sessionId}`),

  confirmCheckout: (sessionId: string): Promise<CheckoutConfirmResult> =>
    api.post(`/api/billing/checkout/${sessionId}/confirm`, {}),

  cancelCheckout: (sessionId: string): Promise<{ sessionId: string; status: string }> =>
    api.post(`/api/billing/checkout/${sessionId}/cancel`, {}),

  syncStripe: (stripeSessionId: string): Promise<{ sessionId: string; status: string }> =>
    api.post('/api/billing/checkout/sync-stripe', { stripeSessionId }),

  requestUpgrade: (planId: 'TEAM' | 'ENTERPRISE', reason?: string): Promise<{ success: boolean }> =>
    api.post('/api/billing/upgrade-request', { planId, reason }),
};
