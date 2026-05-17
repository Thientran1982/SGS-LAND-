/**
 * Public projects API (Sprint 7 — #57).
 *
 * `featured` powers the "Dự án nổi bật" carousel on the Discover tab. The
 * endpoint is whitelisted public (no auth) and is cached on the server for
 * 5 minutes — we additionally let TanStack Query treat it as fresh for
 * 5 minutes, which is plenty for a marketing surface.
 */
import { apiRequest } from './client';
export interface PublicProjectSummary {
  id: string;
  name: string;
  code: string;
  location: string | null;
  status: string | null;
  totalUnits: number | null;
  coverImage: string | null;
  description: string | null;
  developer: string | null;
}
export interface FeaturedProjectsResponse {
  ok: true;
  projects: PublicProjectSummary[];
}
export const projectsApi = {
  featured(opts: { limit?: number; signal?: AbortSignal } = {}) {
    const { limit = 8, signal } = opts;
    return apiRequest<FeaturedProjectsResponse>('/api/public/projects/featured', {
      params: { limit },
      auth: false,
      signal,
    });
  },
};