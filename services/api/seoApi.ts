import { api } from './apiClient';

export interface SeoOverride {
  routeKey: string;
  title: string;
  description: string;
  ogImage?: string | null;
  updatedAt?: string;
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
};

export default seoApi;
