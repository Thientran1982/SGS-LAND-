/**
 * Tenant white-label API client (task #28).
 *
 * Đọc/ghi branding (logo, favicon, màu, displayName, hotline, zalo, messenger),
 * quản lý subdomain `<slug>.sgsland.vn` và custom domain (TXT verify).
 * Mọi mutation chỉ ADMIN/SUPER_ADMIN tenant.
 */

import { api } from './apiClient';

export interface TenantBrandingFields {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  displayName: string | null;
  hotline: string | null;
  hotlineDisplay: string | null;
  zalo: string | null;
  messenger: string | null;
}

export interface TenantBindingPayload {
  apexDomain: string;
  subdomainSlug: string | null;
  subdomainUrl: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  customDomainTxtRecord: { name: string; value: string } | null;
}

export interface TenantBrandingResponse {
  tenantId: string;
  tenantName: string;
  branding: TenantBrandingFields;
  binding: TenantBindingPayload;
}

export interface VerifyResponse extends TenantBrandingResponse {
  verified: boolean;
}

export const EMPTY_BRANDING: TenantBrandingFields = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  displayName: null,
  hotline: null,
  hotlineDisplay: null,
  zalo: null,
  messenger: null,
};

const BASE = '/api/tenant';

export const tenantApi = {
  getBranding: (): Promise<TenantBrandingResponse> =>
    api.get(`${BASE}/branding`),

  updateBranding: (branding: Partial<TenantBrandingFields>): Promise<TenantBrandingResponse> =>
    api.put(`${BASE}/branding`, { branding }),

  setSubdomain: (slug: string): Promise<TenantBrandingResponse> =>
    api.post(`${BASE}/subdomain`, { slug }),

  removeSubdomain: (): Promise<TenantBrandingResponse> =>
    api.delete(`${BASE}/subdomain`),

  setCustomDomain: (hostname: string): Promise<TenantBrandingResponse> =>
    api.post(`${BASE}/custom-domain`, { hostname }),

  verifyCustomDomain: (): Promise<VerifyResponse> =>
    api.post(`${BASE}/custom-domain/verify`, {}),

  removeCustomDomain: (): Promise<TenantBrandingResponse> =>
    api.delete(`${BASE}/custom-domain`),
};
