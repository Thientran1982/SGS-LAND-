import { randomUUID } from 'node:crypto';

let sharedCache: typeof import('../services/sharedCache');
let publicListingsCache: typeof import('../services/publicListingsCache');
let publicListingDetailCache: typeof import('../services/publicListingDetailCache');
let publicProjectCache: typeof import('../services/publicProjectCache');
let cacheInvalidation: typeof import('../services/cacheInvalidationService');

type Payload = {
  tenantA: string;
  tenantB?: string;
};

function cacheKeys(tenantId: string) {
  return {
    rag: sharedCache.sharedCacheKey({
      tenantId,
      namespace: 'rag-embedding',
      version: 'integration',
      dimensions: { contentHash: 'document-content' },
    }),
    document: sharedCache.sharedCacheKey({
      tenantId,
      namespace: 'ai-kb',
      version: 2,
      dimensions: { cacheKey: `document:${tenantId}:latest` },
    }),
  };
}

function projectCode(tenantId: string): string {
  return `CACHE-${tenantId.slice(-12)}`.toUpperCase();
}

function listingId(tenantId: string): string {
  return `listing-${tenantId.slice(-12)}`;
}

async function seed(tenantId: string, label: string) {
  const keys = cacheKeys(tenantId);
  await publicListingsCache.setPublicListingsCache('page=1', { label, kind: 'listing' }, tenantId);
  await publicListingDetailCache.setPublicListingDetailCache(
    `pld:${listingId(tenantId)}`,
    { label, kind: 'listing-detail' },
    tenantId,
  );
  await publicProjectCache.setPublicProjectCache(projectCode(tenantId), { label, kind: 'project' }, tenantId, tenantId);
  await sharedCache.sharedCacheSet(keys.rag, { label, kind: 'rag' }, 60_000);
  await sharedCache.sharedCacheSet(keys.document, { label, kind: 'document' }, 60_000);
}

async function read(tenantId: string) {
  const keys = cacheKeys(tenantId);
  return {
    listing: await publicListingsCache.getPublicListingsCache('page=1', tenantId),
    listingDetail: await publicListingDetailCache.getPublicListingDetailCache(`pld:${listingId(tenantId)}`, tenantId),
    project: await publicProjectCache.getPublicProjectCache(projectCode(tenantId), tenantId),
    rag: await sharedCache.sharedCacheGet(keys.rag),
    document: await sharedCache.sharedCacheGet(keys.document),
  };
}

async function main() {
  const operation = process.argv[2];
  const payload = JSON.parse(Buffer.from(process.argv[3], 'base64url').toString('utf8')) as Payload;
  sharedCache = await import('../services/sharedCache');
  publicListingsCache = await import('../services/publicListingsCache');
  publicListingDetailCache = await import('../services/publicListingDetailCache');
  publicProjectCache = await import('../services/publicProjectCache');
  cacheInvalidation = await import('../services/cacheInvalidationService');
  if (process.env.CACHE_TEST_REDIS_OUTAGE === '1') {
    const outage = async () => {
      throw new Error('simulated Redis outage');
    };
    sharedCache.setSharedCacheRedisForTesting({
      get: outage,
      set: outage,
      del: outage,
      scan: outage,
    });
  }

  switch (operation) {
    case 'seed':
      await seed(payload.tenantA, 'A');
      if (payload.tenantB) await seed(payload.tenantB, 'B');
      return { ok: true };
    case 'read':
      return read(payload.tenantA);
    case 'invalidate':
      await Promise.all([
        cacheInvalidation.invalidateListingCache({
          tenantId: payload.tenantA,
          listingIds: [listingId(payload.tenantA)],
        }),
        cacheInvalidation.invalidateProjectCache(
          payload.tenantA,
          [projectCode(payload.tenantA)],
        ),
        cacheInvalidation.invalidateKnowledgeCache(payload.tenantA),
      ]);
      return { ok: true };
    case 'outage': {
      const tenantB = payload.tenantB || `cache-fallback-${randomUUID()}`;
      await publicListingsCache.setPublicListingsCache('same-query', { tenant: payload.tenantA }, payload.tenantA);
      await publicListingsCache.setPublicListingsCache('same-query', { tenant: tenantB }, tenantB);
      for (let index = 0; index <= 1_000; index++) {
        const key = sharedCache.sharedCacheKey({
          tenantId: payload.tenantA,
          namespace: 'bounded-fallback',
          dimensions: { index },
        });
        await sharedCache.sharedCacheSet(key, index, 60_000);
      }
      return {
        tenantA: await publicListingsCache.getPublicListingsCache('same-query', payload.tenantA),
        tenantB: await publicListingsCache.getPublicListingsCache('same-query', tenantB),
        stats: sharedCache.sharedCacheStats(),
      };
    }
    default:
      throw new Error(`Unknown cache worker operation: ${operation}`);
  }
}

main()
  .then(result => console.log(`CACHE_WORKER_RESULT:${JSON.stringify(result)}`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });