/**
 * Public mini-site API client — no auth, no JWT.
 *
 * Sử dụng `fetch` trực tiếp (không qua apiClient.ts) để tránh dispatch
 * `auth:unauthorized` event nếu user chưa login. Mini-site luôn public.
 */

export interface PublicListing {
  id: string;
  code: string | null;
  title: string | null;
  type: string | null;
  transaction: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  area: number | null;
  builtArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location: string | null;
  images: string[];
  attributes: Record<string, any>;
}

export interface PublicProject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  status: string | null;
  totalUnits: number | null;
  openDate: string | null;
  handoverDate: string | null;
  coverImage: string | null;
  metadata: {
    coverImage: string | null;
    gallery: string[];
    amenities: string[];
    highlights: string[];
    developer: string | null;
    website: string | null;
  };
}

export interface PublicProjectPayload {
  ok: true;
  project: PublicProject;
  listings: PublicListing[];
  listingCount: number;
  tenantContact: {
    brandName: string;
    hotline: string;
    hotlineDisplay: string;
    zalo: string;
  };
  /** Captcha config — server chỉ trả khi env `TURNSTILE_SECRET_KEY` được set. */
  captcha: { provider: 'turnstile'; siteKey: string } | null;
  cachedAt: string;
}

export interface PublicLeadInput {
  name: string;
  phone: string;
  email?: string;
  note?: string;
  interest?: string;
  pageUrl?: string;
  referrer?: string;
  /** Cloudflare Turnstile token (chỉ cần khi server bật TURNSTILE_SECRET_KEY). */
  captchaToken?: string;
}

export interface PublicLeadResponse {
  ok: boolean;
  leadId?: string | null;
  deduped?: boolean;
  message?: string;
  error?: string;
}

const BASE = '/api/public/projects';

export const publicProjectApi = {
  async fetchProject(code: string): Promise<PublicProjectPayload> {
    const url = `${BASE}/${encodeURIComponent(code)}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) {
      throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(data?.error || `Lỗi tải dữ liệu (${res.status})`);
    }
    return res.json();
  },

  async submitLead(code: string, input: PublicLeadInput): Promise<PublicLeadResponse> {
    const url = `${BASE}/${encodeURIComponent(code)}/leads`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const data: PublicLeadResponse = await res.json().catch(() => ({
      ok: false,
      error: `HTTP ${res.status}`,
    }));
    if (!res.ok && !data?.error) {
      data.error = `Lỗi ${res.status}`;
    }
    if (res.status === 429) {
      data.error =
        data.error ||
        'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ hoặc gọi hotline.';
    }
    return data;
  },
};
