import { sharedCacheDeleteByPrefix } from './sharedCache';
import { evictPublicListingDetailCache } from './publicListingDetailCache';
import { evictPublicListingsCache } from './publicListingsCache';
import { evictPublicProjectCache, invalidateTenantCache } from './publicProjectCache';

function distinct(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

export async function invalidateListingCache(params: {
  tenantId: string;
  listingIds?: Array<string | null | undefined>;
  projectCodes?: Array<string | null | undefined>;
}): Promise<void> {
  const listingIds = distinct(params.listingIds || []);
  const projectCodes = distinct(params.projectCodes || []);
  await Promise.all([
    invalidateTenantCache(params.tenantId),
    evictPublicListingsCache(params.tenantId),
    ...listingIds.map(id => evictPublicListingDetailCache(id, params.tenantId)),
    ...projectCodes.map(code => evictPublicProjectCache(code)),
  ]);
}

export async function invalidateProjectCache(
  tenantId: string,
  projectCodes?: Array<string | null | undefined>,
): Promise<void> {
  await Promise.all([
    invalidateTenantCache(tenantId),
    ...distinct(projectCodes || []).map(code => evictPublicProjectCache(code)),
  ]);
}

export async function invalidateKnowledgeCache(tenantId: string): Promise<void> {
  await Promise.all([
    sharedCacheDeleteByPrefix(`${tenantId}:ai-kb`),
    sharedCacheDeleteByPrefix(`${tenantId}:rag-embedding`),
  ]);
}