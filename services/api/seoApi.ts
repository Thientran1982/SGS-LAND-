import { api } from './apiClient';

export interface SeoOverride {
  routeKey: string;
  title: string;
  description: string;
  ogImage?: string | null;
  updatedAt?: string;
}

export interface TargetKeyword {
  id: string;
  keyword: string;
  targetUrl: string | null;
  currentPosition: number | null;
  targetPosition: number;
  searchVolume: number | null;
  notes: string | null;
  lastCheckedAt: string | null;
  aiVisibility: {
    chatgpt?: boolean | null;
    gemini?: boolean | null;
    claude?: boolean | null;
    perplexity?: boolean | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AiVisibilityStatus {
  llmsTxt: { ok: boolean; status: number; bytes: number };
  llmsFullTxt: { ok: boolean; status: number; bytes: number };
  bots: { name: string; allowed: boolean; userAgent: string }[];
  sitemaps: { url: string; ok: boolean; status: number }[];
}

const seoApi = {
  async getAll(): Promise<Record<string, SeoOverride>> {
    return api.get('/api/seo-overrides');
  },

  async upsert(routeKey: string, title: string, description: string, ogImage?: string | null): Promise<SeoOverride> {
    return api.post(`/api/seo-overrides/${encodeURIComponent(routeKey)}`, {
      title,
      description,
      ogImage: ogImage ?? null,
    });
  },

  async remove(routeKey: string): Promise<void> {
    return api.delete(`/api/seo-overrides/${encodeURIComponent(routeKey)}`);
  },

  // ── GEO / AI Search ──────────────────────────────────────────────────────
  async listKeywords(): Promise<TargetKeyword[]> {
    return api.get('/api/seo/target-keywords');
  },

  async upsertKeyword(input: Partial<TargetKeyword> & { keyword: string }): Promise<TargetKeyword> {
    return api.post('/api/seo/target-keywords', input);
  },

  async deleteKeyword(id: string): Promise<void> {
    return api.delete(`/api/seo/target-keywords/${encodeURIComponent(id)}`);
  },

  async aiVisibilityStatus(): Promise<AiVisibilityStatus> {
    return api.get('/api/seo/ai-visibility');
  },

  async seedDefaultKeywords(): Promise<{ success: boolean; inserted: number; skipped: number; total: number }> {
    return api.post('/api/seo/target-keywords/seed-defaults', {});
  },

  async auditUrl(path: string): Promise<{ target: string; fetchedAt: string; items: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; tip?: string }> }> {
    return api.post('/api/seo/audit-url', { path });
  },
};

export default seoApi;
