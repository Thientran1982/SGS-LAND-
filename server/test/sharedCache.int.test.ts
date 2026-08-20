import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  sharedCacheDeleteByPrefix,
  sharedCacheGet,
  sharedCacheKey,
} from '../services/sharedCache';
import {
  getPublicListingsCache,
  setPublicListingsCache,
} from '../services/publicListingsCache';
import {
  getPublicListingDetailCache,
  setPublicListingDetailCache,
} from '../services/publicListingDetailCache';
import {
  getPublicProjectCache,
  setPublicProjectCache,
} from '../services/publicProjectCache';

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
if (!hasRedis) {
  throw new Error('test:cache:integration requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
}
const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
const workerPath = path.resolve(process.cwd(), 'server/test/sharedCache.worker.ts');
const tenantA = `cache-int-a-${randomUUID()}`;
const tenantB = `cache-int-b-${randomUUID()}`;

function cacheKeys(tenantId: string) {
  return {
    rag: sharedCacheKey({
      tenantId,
      namespace: 'rag-embedding',
      version: 'integration',
      dimensions: { contentHash: 'document-content' },
    }),
    document: sharedCacheKey({
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

function runWorker<T>(operation: string, extraEnv: NodeJS.ProcessEnv = {}): Promise<T> {
  const payload = Buffer.from(JSON.stringify({ tenantA, tenantB })).toString('base64url');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, workerPath, operation, payload], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) {
        reject(new Error(`Cache worker "${operation}" failed (${code}): ${stderr || stdout}`));
        return;
      }
      const result = stdout.split(/\r?\n/).find(line => line.startsWith('CACHE_WORKER_RESULT:'));
      if (!result) {
        reject(new Error(`Cache worker "${operation}" returned no result: ${stdout}`));
        return;
      }
      resolve(JSON.parse(result.slice('CACHE_WORKER_RESULT:'.length)) as T);
    });
  });
}

async function readCacheSet(tenantId: string) {
  const keys = cacheKeys(tenantId);
  return {
    listing: await getPublicListingsCache('page=1', tenantId),
    listingDetail: await getPublicListingDetailCache(`pld:${listingId(tenantId)}`, tenantId),
    project: await getPublicProjectCache(projectCode(tenantId), tenantId),
    rag: await sharedCacheGet(keys.rag),
    document: await sharedCacheGet(keys.document),
  };
}

afterEach(async () => {
  await Promise.all([
    sharedCacheDeleteByPrefix(tenantA),
    sharedCacheDeleteByPrefix(tenantB),
  ]);
});

describe('shared cache across instances', () => {
  test('process B reads process A values and sees public and knowledge invalidation immediately', async () => {
    await runWorker('seed');

    expect(await readCacheSet(tenantA)).toMatchObject({
      listing: { label: 'A', kind: 'listing' },
      listingDetail: { label: 'A', kind: 'listing-detail' },
      project: { label: 'A', kind: 'project' },
      rag: { label: 'A', kind: 'rag' },
      document: { label: 'A', kind: 'document' },
    });
    expect(await readCacheSet(tenantB)).toMatchObject({
      listing: { label: 'B', kind: 'listing' },
      listingDetail: { label: 'B', kind: 'listing-detail' },
      project: { label: 'B', kind: 'project' },
      rag: { label: 'B', kind: 'rag' },
      document: { label: 'B', kind: 'document' },
    });

    // Simulate process B having rendered both public payloads locally before
    // process A mutates the underlying records.
    await setPublicListingsCache('page=1', { label: 'A', kind: 'listing' }, tenantA);
    await setPublicListingDetailCache(
      `pld:${listingId(tenantA)}`,
      { label: 'A', kind: 'listing-detail' },
      tenantA,
    );
    await setPublicProjectCache(projectCode(tenantA), { label: 'A', kind: 'project' }, tenantA, tenantA);
    await runWorker('invalidate');

    expect(await readCacheSet(tenantA)).toEqual({
      listing: null,
      listingDetail: null,
      project: null,
      rag: null,
      document: null,
    });
    expect(await readCacheSet(tenantB)).toMatchObject({
      listing: { label: 'B', kind: 'listing' },
      listingDetail: { label: 'B', kind: 'listing-detail' },
      project: { label: 'B', kind: 'project' },
      rag: { label: 'B', kind: 'rag' },
      document: { label: 'B', kind: 'document' },
    });
  });

  test('keeps Redis-outage fallback bounded and tenant-scoped', async () => {
    const result = await runWorker<{
      tenantA: { tenant: string } | null;
      tenantB: { tenant: string } | null;
      stats: { localEntries: number; fallbackReads: number; fallbackWrites: number };
    }>('outage', {
      CACHE_TEST_REDIS_OUTAGE: '1',
      LOG_LEVEL: 'ERROR',
    });

    expect(result.tenantA).toEqual({ tenant: tenantA });
    expect(result.tenantB).toEqual({ tenant: tenantB });
    expect(result.stats.localEntries).toBeLessThanOrEqual(1_000);
    expect(result.stats.fallbackReads).toBeGreaterThan(0);
    expect(result.stats.fallbackWrites).toBeGreaterThan(0);
  });
});