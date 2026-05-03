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

  // ── GEO Monitor (Sprint #64 follow-up) ───────────────────────────────────
  async listGeoSnapshots(days = 30): Promise<{
    days: number;
    snapshots: Array<{
      date: string;
      aiMentions: any;
      gscTop20: any;
      backlinks: any;
      lighthouse: any;
      createdAt: string;
    }>;
  }> {
    return api.get(`/api/seo/geo-snapshots?days=${days}`);
  },

  async runGeoSnapshotNow(): Promise<{ ok: boolean; date: string }> {
    return api.post('/api/seo/geo-snapshots/run-now', {});
  },

  // ── Agent Runs (unified audit trail) ─────────────────────────────────────
  async listAgentRuns(params: { agent?: string; status?: string; days?: number; limit?: number } = {}): Promise<{
    days: number;
    runs: Array<{
      id: string;
      agent_name: string;
      trigger_source: string;
      status: 'running' | 'success' | 'error' | 'skipped';
      started_at: string;
      finished_at: string | null;
      duration_ms: number | null;
      summary_json: any;
      error_text: string | null;
    }>;
    agents: Array<{
      agentName: string;
      total: number; success: number; errors: number; skipped: number; running: number;
      avgDurationMs: number | null;
      lastRunAt: string | null;
    }>;
  }> {
    const qs = new URLSearchParams();
    if (params.agent)  qs.set('agent', params.agent);
    if (params.status) qs.set('status', params.status);
    qs.set('days',  String(params.days  ?? 7));
    qs.set('limit', String(params.limit ?? 200));
    return api.get(`/api/admin/agent-runs?${qs.toString()}`);
  },
};

export default seoApi;
