import { withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { deleteFile } from './storageService';

export type GalleryCleanupStatus = 'PENDING' | 'RUNNING' | 'FAILED' | 'SUCCEEDED';

export interface GalleryCleanupJob {
  id: string;
  tenantId: string;
  status: GalleryCleanupStatus;
  attempts: number;
  lastErrorCode: string | null;
  lastAttemptAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredGalleryCleanupJob extends GalleryCleanupJob {
  filename: string;
  landingPageId: string | null;
}

const STORAGE_DELETE_ERROR = 'STORAGE_DELETE_FAILED';

function toPublicJob(row: any): GalleryCleanupJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    status: row.status as GalleryCleanupStatus,
    attempts: Number(row.attempts || 0),
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toStoredJob(row: any): StoredGalleryCleanupJob {
  return {
    ...toPublicJob(row),
    filename: String(row.filename),
    landingPageId: row.landing_page_id ? String(row.landing_page_id) : null,
  };
}

function publicColumns(): string {
  return 'id, tenant_id, status, attempts, last_error_code, last_attempt_at, completed_at, created_at, updated_at';
}

/**
 * The filename is intentionally the only storage target persisted by the
 * cleanup job. URLs are not accepted here, which prevents a retry from
 * accidentally becoming a delete-by-arbitrary-URL operation.
 */
export function isSafeGalleryFilename(filename: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(filename) && filename !== '.' && filename !== '..';
}

export async function enqueueGalleryCleanup(
  tenantId: string,
  landingPageId: string,
  filename: string,
): Promise<GalleryCleanupJob> {
  if (!isSafeGalleryFilename(filename)) {
    throw new Error('Invalid gallery cleanup filename');
  }

  return withTenantContext(tenantId, async (client: any) => {
    const result = await client.query(
      `INSERT INTO gallery_cleanup_jobs (tenant_id, landing_page_id, filename)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, filename) DO UPDATE
       SET landing_page_id = COALESCE(gallery_cleanup_jobs.landing_page_id, EXCLUDED.landing_page_id),
           status = CASE
             WHEN gallery_cleanup_jobs.status = 'SUCCEEDED' THEN gallery_cleanup_jobs.status
             ELSE 'PENDING'
           END,
           updated_at = NOW()
       RETURNING ${publicColumns()}`,
      [tenantId, landingPageId, filename],
    );
    return toPublicJob(result.rows[0]);
  });
}

async function getStoredGalleryCleanupJob(tenantId: string, jobId: string): Promise<StoredGalleryCleanupJob | null> {
  return withTenantContext(tenantId, async (client: any) => {
    const result = await client.query(
      `SELECT id, tenant_id, landing_page_id, filename, status, attempts,
              last_error_code, last_attempt_at, completed_at, created_at, updated_at
         FROM gallery_cleanup_jobs
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, jobId],
    );
    return result.rows[0] ? toStoredJob(result.rows[0]) : null;
  });
}

export async function listGalleryCleanupJobs(
  tenantId: string,
  limit = 50,
): Promise<GalleryCleanupJob[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  return withTenantContext(tenantId, async (client: any) => {
    const result = await client.query(
      `SELECT ${publicColumns()}
         FROM gallery_cleanup_jobs
        WHERE tenant_id = $1 AND status IN ('PENDING', 'RUNNING', 'FAILED')
        ORDER BY updated_at DESC
        LIMIT $2`,
      [tenantId, boundedLimit],
    );
    return result.rows.map(toPublicJob);
  });
}

/**
 * Claiming is conditional so concurrent operator clicks or workers can never
 * turn one retry into multiple independent delete attempts.
 */
export async function processGalleryCleanup(
  tenantId: string,
  jobId: string,
): Promise<GalleryCleanupJob | null> {
  const claimed = await withTenantContext(tenantId, async (client: any) => {
    const result = await client.query(
      `UPDATE gallery_cleanup_jobs
          SET status = 'RUNNING',
              attempts = attempts + 1,
              last_attempt_at = NOW(),
              updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2 AND status IN ('PENDING', 'FAILED')
      RETURNING id, tenant_id, landing_page_id, filename, status, attempts,
                last_error_code, last_attempt_at, completed_at, created_at, updated_at`,
      [tenantId, jobId],
    );
    return result.rows[0] ? toStoredJob(result.rows[0]) : null;
  });

  if (!claimed) {
    const current = await getStoredGalleryCleanupJob(tenantId, jobId);
    return current;
  }

  try {
    await deleteFile(tenantId, claimed.filename);
    const result = await withTenantContext(tenantId, async (client: any) => {
      const updated = await client.query(
        `UPDATE gallery_cleanup_jobs
            SET status = 'SUCCEEDED',
                last_error_code = NULL,
                completed_at = NOW(),
                updated_at = NOW()
          WHERE tenant_id = $1 AND id = $2
        RETURNING ${publicColumns()}`,
        [tenantId, jobId],
      );
      return updated.rows[0] ? toPublicJob(updated.rows[0]) : null;
    });
    return result;
  } catch (error) {
    // Do not persist provider/DB messages: they may contain URLs, paths, or
    // connection details. Operators only need a stable retry classification.
    logger.warn('[galleryCleanup] storage delete failed', {
      event: 'gallery_cleanup_failed',
      tenantId,
      jobId,
      errorCode: STORAGE_DELETE_ERROR,
    });
    try {
      return await withTenantContext(tenantId, async (client: any) => {
        const updated = await client.query(
          `UPDATE gallery_cleanup_jobs
              SET status = 'FAILED',
                  last_error_code = $3,
                  updated_at = NOW()
            WHERE tenant_id = $1 AND id = $2
          RETURNING ${publicColumns()}`,
          [tenantId, jobId, STORAGE_DELETE_ERROR],
        );
        return updated.rows[0] ? toPublicJob(updated.rows[0]) : null;
      });
    } catch (persistError) {
      logger.error('[galleryCleanup] failed to persist cleanup failure', {
        event: 'gallery_cleanup_failure_signal_failed',
        tenantId,
        jobId,
      });
      throw persistError;
    }
  }
}

export async function retryGalleryCleanup(
  tenantId: string,
  jobId: string,
): Promise<GalleryCleanupJob | null> {
  const job = await getStoredGalleryCleanupJob(tenantId, jobId);
  if (!job) return null;
  if (job.status === 'SUCCEEDED' || job.status === 'RUNNING') return job;
  return processGalleryCleanup(tenantId, jobId);
}