import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, withTenantContext, deleteFile, loggerWarn, loggerError } = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(),
  deleteFile: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../db', () => ({ withTenantContext }));
vi.mock('../services/storageService', () => ({ deleteFile }));
vi.mock('../middleware/logger', () => ({
  logger: { warn: loggerWarn, error: loggerError },
}));

import {
  enqueueGalleryCleanup,
  isSafeGalleryFilename,
  processGalleryCleanup,
  retryGalleryCleanup,
} from '../services/galleryCleanupService';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const JOB_ID = '00000000-0000-0000-0000-000000000010';
const PAGE_ID = '00000000-0000-0000-0000-000000000020';
const dates = {
  created_at: '2026-09-08T00:00:00.000Z',
  updated_at: '2026-09-08T00:00:00.000Z',
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    tenant_id: TENANT_ID,
    landing_page_id: PAGE_ID,
    filename: 'owned.webp',
    status: 'PENDING',
    attempts: 0,
    last_error_code: null,
    last_attempt_at: null,
    completed_at: null,
    ...dates,
    ...overrides,
  };
}

describe('gallery cleanup durability and retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTenantContext.mockImplementation(async (
      _tenantId: string,
      callback: (client: { query: typeof query }) => Promise<unknown>,
    ) => callback({ query }));
    deleteFile.mockResolvedValue(undefined);
  });

  it('accepts only a generated storage filename, never a path', () => {
    expect(isSafeGalleryFilename('1700000000-abc.webp')).toBe(true);
    expect(isSafeGalleryFilename('../keep.webp')).toBe(false);
    expect(isSafeGalleryFilename('nested/other.webp')).toBe(false);
    expect(isSafeGalleryFilename('https://cdn.example/other.webp')).toBe(false);
  });

  it('creates one durable job for repeated requests for the same file', async () => {
    query.mockResolvedValueOnce({ rows: [row()] }).mockResolvedValueOnce({ rows: [row({ status: 'PENDING' })] });

    const first = await enqueueGalleryCleanup(TENANT_ID, PAGE_ID, 'owned.webp');
    const second = await enqueueGalleryCleanup(TENANT_ID, PAGE_ID, 'owned.webp');

    expect(first.id).toBe(JOB_ID);
    expect(second.id).toBe(JOB_ID);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain('ON CONFLICT (tenant_id, filename)');
    expect(query.mock.calls[1][1]).toEqual([TENANT_ID, PAGE_ID, 'owned.webp']);
  });

  it('records a transient storage failure and succeeds on the next retry', async () => {
    query
      .mockResolvedValueOnce({ rows: [row({ status: 'RUNNING', attempts: 1, last_attempt_at: dates.updated_at })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'FAILED', attempts: 1, last_error_code: 'STORAGE_DELETE_FAILED' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'FAILED', attempts: 1, last_error_code: 'STORAGE_DELETE_FAILED' })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'RUNNING', attempts: 2, last_attempt_at: dates.updated_at })] })
      .mockResolvedValueOnce({ rows: [row({ status: 'SUCCEEDED', attempts: 2, completed_at: dates.updated_at })] });
    deleteFile.mockRejectedValueOnce(new Error('temporary storage outage')).mockResolvedValueOnce(undefined);

    const failed = await processGalleryCleanup(TENANT_ID, JOB_ID);
    const retried = await retryGalleryCleanup(TENANT_ID, JOB_ID);

    expect(failed?.status).toBe('FAILED');
    expect(failed?.lastErrorCode).toBe('STORAGE_DELETE_FAILED');
    expect(retried?.status).toBe('SUCCEEDED');
    expect(deleteFile).toHaveBeenNthCalledWith(1, TENANT_ID, 'owned.webp');
    expect(deleteFile).toHaveBeenNthCalledWith(2, TENANT_ID, 'owned.webp');
    expect(loggerWarn).toHaveBeenCalledWith('[galleryCleanup] storage delete failed', expect.objectContaining({
      event: 'gallery_cleanup_failed',
      jobId: JOB_ID,
      errorCode: 'STORAGE_DELETE_FAILED',
    }));
    expect(loggerWarn.mock.calls[0][1]).not.toHaveProperty('filename');
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('does not delete again when an already successful job is retried', async () => {
    query.mockResolvedValueOnce({ rows: [row({ status: 'SUCCEEDED', attempts: 1 })] });

    const result = await retryGalleryCleanup(TENANT_ID, JOB_ID);

    expect(result?.status).toBe('SUCCEEDED');
    expect(deleteFile).not.toHaveBeenCalled();
  });
});