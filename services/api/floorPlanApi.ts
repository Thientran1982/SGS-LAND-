import { api } from './apiClient';

export interface FloorPlanSummary {
  id: string;
  tower: string;
  floor: string;
  svgUrl: string;
  svgFilename: string;
  codeCount: number;
  notes?: string | null;
  updatedAt: string;
}

export interface FloorPlanListingDetail {
  id: string;
  code: string;
  status: string;
  area: number | null;
  price: number | null;
  title: string | null;
}

export interface FloorPlanDetail {
  plan: FloorPlanSummary;
  codes: string[];
  /** data-code (UPPERCASE) → listingId */
  mapping: Record<string, string>;
  /** listingId → status */
  statuses: Record<string, string>;
  /** listingId → richer detail used by the hover tooltip (area / price / title) */
  listings: Record<string, FloorPlanListingDetail>;
  /** codes that have no matching listing in this project (admin-only) */
  unmatchedCodes: string[];
}

export interface FloorPlanUploadResponse {
  plan: FloorPlanSummary;
  codes: string[];
  mapping: Record<string, string>;
  unmatchedCodes: string[];
  extraListings: Array<{ id: string; code: string; tower: string | null; floor: string | null }>;
  sanitizerStats: { tags: number; attrs: number; refs: number };
}

export const floorPlanApi = {
  list: (projectId: string): Promise<FloorPlanSummary[]> =>
    api.get(`/api/projects/${projectId}/floor-plans`),

  get: (projectId: string, planId: string): Promise<FloorPlanDetail> =>
    api.get(`/api/projects/${projectId}/floor-plans/${planId}`),

  pollStatuses: (
    projectId: string,
    planId: string,
  ): Promise<{ statuses: Record<string, string>; refreshedAt: string }> =>
    api.get(`/api/projects/${projectId}/floor-plans/${planId}/statuses`),

  /** Returns the absolute URL — the SVG content is served as XML, not JSON. */
  svgUrl: (projectId: string, planId: string): string =>
    `/api/projects/${projectId}/floor-plans/${planId}/svg`,

  upload: async (
    projectId: string,
    params: { tower: string; floor: string; notes?: string; file: File },
  ): Promise<FloorPlanUploadResponse> => {
    const fd = new FormData();
    fd.append('tower', params.tower || 'ALL');
    fd.append('floor', params.floor || 'ALL');
    if (params.notes) fd.append('notes', params.notes);
    fd.append('svg', params.file, params.file.name);
    const res = await fetch(`/api/projects/${projectId}/floor-plans`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) {
      let msg = `Upload failed: ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return (await res.json()) as FloorPlanUploadResponse;
  },

  delete: (projectId: string, planId: string): Promise<{ success: boolean }> =>
    api.delete(`/api/projects/${projectId}/floor-plans/${planId}`),
};
