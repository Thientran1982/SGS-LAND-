import type { Pool } from 'pg';

export type AutoPostingTimeWindow = { start: string; end: string };

export type AutoPostingSettings = {
  tenantId: string;
  enabled: boolean;
  postsPerDay: number;
  timeWindows: AutoPostingTimeWindow[];
  recycleAfterDays: number;
  platforms: string[];
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_SETTINGS: Omit<AutoPostingSettings, 'tenantId'> = {
  enabled: false,
  postsPerDay: 1,
  timeWindows: [{ start: '18:30', end: '23:59' }],
  recycleAfterDays: 7,
  platforms: ['FACEBOOK_PAGE'],
};

export type MarketingFacebookDailyRun = {
  id: string;
  tenantId: string;
  logicalDay: string;
  slotIndex: number;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  sourceType: 'LISTING' | 'PROJECT' | null;
  sourceId: string | null;
  publicationId: string | null;
  result: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type MarketingFacebookBackfillRequest = {
  id: string;
  tenantId: string;
  logicalDay: string;
  reason: string;
  requestedBy: string;
  status: 'REQUESTED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'BLOCKED';
  result: Record<string, unknown>;
  publicationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

function asJson<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return (value as T) ?? fallback;
}

function mapSettings(row: any, tenantId: string): AutoPostingSettings {
  const windows = asJson<AutoPostingTimeWindow[]>(row?.time_windows, DEFAULT_SETTINGS.timeWindows);
  const platforms = asJson<string[]>(row?.platforms, DEFAULT_SETTINGS.platforms);
  return {
    tenantId,
    enabled: Boolean(row?.enabled),
    postsPerDay: Number(row?.posts_per_day || DEFAULT_SETTINGS.postsPerDay),
    timeWindows: Array.isArray(windows) ? windows : DEFAULT_SETTINGS.timeWindows,
    recycleAfterDays: Math.max(0, Number(row?.recycle_after_days ?? DEFAULT_SETTINGS.recycleAfterDays)),
    platforms: Array.isArray(platforms) && platforms.length ? platforms : DEFAULT_SETTINGS.platforms,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  };
}

export function defaultAutoPostingSettings(tenantId: string): AutoPostingSettings {
  return { tenantId, ...DEFAULT_SETTINGS, timeWindows: [...DEFAULT_SETTINGS.timeWindows], platforms: [...DEFAULT_SETTINGS.platforms] };
}

export async function getAutoPostingSettings(pool: Pool, tenantId: string): Promise<AutoPostingSettings> {
  const result = await pool.query(
    `SELECT tenant_id, enabled, posts_per_day, time_windows, recycle_after_days, platforms, created_at, updated_at
       FROM auto_posting_settings WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0] ? mapSettings(result.rows[0], tenantId) : defaultAutoPostingSettings(tenantId);
}

function clampAutoPostingPostsPerDay(value: unknown, fallback: number): number {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(50, Math.max(1, num));
}

function sanitizeAutoPostingTimeWindows(
  value: unknown,
  fallback: AutoPostingTimeWindow[],
): AutoPostingTimeWindow[] {
  if (!Array.isArray(value) || !value.length) return fallback;
  const cleaned = value
    .map(item => ({
      start: String((item as any)?.start || ''),
      end: String((item as any)?.end || ''),
    }))
    .filter(window => /^\d{2}:\d{2}$/.test(window.start) && /^\d{2}:\d{2}$/.test(window.end));
  return cleaned.length ? cleaned : fallback;
}

export async function upsertAutoPostingSettings(
  pool: Pool,
  tenantId: string,
  input: Partial<Omit<AutoPostingSettings, 'tenantId'>>,
): Promise<AutoPostingSettings> {
  const current = await getAutoPostingSettings(pool, tenantId);
  const next = {
    enabled: input.enabled ?? current.enabled,
    postsPerDay: input.postsPerDay !== undefined
      ? clampAutoPostingPostsPerDay(input.postsPerDay, current.postsPerDay)
      : current.postsPerDay,
    timeWindows: input.timeWindows !== undefined
      ? sanitizeAutoPostingTimeWindows(input.timeWindows, current.timeWindows)
      : current.timeWindows,
    recycleAfterDays: Math.max(0, Number(input.recycleAfterDays ?? current.recycleAfterDays)),
    platforms: input.platforms && input.platforms.length ? input.platforms : current.platforms,
  };
  const result = await pool.query(
    `INSERT INTO auto_posting_settings
       (tenant_id, enabled, posts_per_day, time_windows, recycle_after_days, platforms)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       posts_per_day = EXCLUDED.posts_per_day,
       time_windows = EXCLUDED.time_windows,
       recycle_after_days = EXCLUDED.recycle_after_days,
       platforms = EXCLUDED.platforms,
       updated_at = NOW()
     RETURNING *`,
    [tenantId, next.enabled, next.postsPerDay, JSON.stringify(next.timeWindows), next.recycleAfterDays, JSON.stringify(next.platforms)],
  );
  return mapSettings(result.rows[0], tenantId);
}

export async function listEnabledAutoPostingTenants(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    `SELECT tenant_id FROM auto_posting_settings WHERE enabled = TRUE`,
  );
  return result.rows.map(row => String(row.tenant_id));
}

function mapDailyRun(row: any): MarketingFacebookDailyRun {
  const logicalDay = row.logical_day instanceof Date
    ? row.logical_day.toISOString().slice(0, 10)
    : String(row.logical_day || '').slice(0, 10);
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    logicalDay,
    slotIndex: Number(row.slot_index || 0),
    status: row.status,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    publicationId: row.publication_id || null,
    result: row.result && typeof row.result === 'object' ? row.result : {},
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    startedAt: row.started_at,
    finishedAt: row.finished_at || null,
  };
}

function mapBackfillRequest(row: any): MarketingFacebookBackfillRequest {
  const logicalDay = row.logical_day instanceof Date
    ? row.logical_day.toISOString().slice(0, 10)
    : String(row.logical_day || '').slice(0, 10);
  const result = row.result && typeof row.result === 'object' ? row.result : {};
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    logicalDay,
    reason: String(row.reason || ''),
    requestedBy: String(row.requested_by || ''),
    status: row.status,
    result,
    publicationId: typeof result.publicationId === 'string' ? result.publicationId : null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    requestedAt: row.requested_at,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
  };
}

export async function claimMarketingFacebookDailyRun(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
  slotIndex = 0,
): Promise<MarketingFacebookDailyRun | null> {
  const result = await pool.query(
    `INSERT INTO marketing_facebook_daily_runs (tenant_id, logical_day, slot_index, status)
     VALUES ($1, $2::date, $3, 'RUNNING')
     ON CONFLICT (tenant_id, logical_day, slot_index) DO NOTHING
     RETURNING *`,
    [tenantId, logicalDay, slotIndex],
  );
  return result.rows[0] ? mapDailyRun(result.rows[0]) : null;
}

export async function countSuccessfulAutoPostingRunsToday(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM marketing_facebook_daily_runs
      WHERE tenant_id = $1 AND logical_day = $2::date AND status = 'SUCCESS'`,
    [tenantId, logicalDay],
  );
  return Number(result.rows[0]?.total || 0);
}

export async function countAutoPostingRunsToday(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM marketing_facebook_daily_runs
      WHERE tenant_id = $1
        AND logical_day = $2::date
        AND status IN ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')`,
    [tenantId, logicalDay],
  );
  return Number(result.rows[0]?.total || 0);
}

export async function getNextAutoPostingSlotIndex(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM marketing_facebook_daily_runs
      WHERE tenant_id = $1 AND logical_day = $2::date`,
    [tenantId, logicalDay],
  );
  return Number(result.rows[0]?.total || 0);
}

export type BackfillRunClaim =
  | { kind: 'CLAIMED'; run: MarketingFacebookDailyRun }
  | { kind: 'BLOCKED'; reason: string; errorCode: string };

/**
 * Reuses the tenant/day ledger row only for a controlled backfill. The unique
 * day claim remains the idempotency boundary; an ambiguous provider result or
 * an in-flight target always blocks a second provider submission.
 */
export async function claimMarketingFacebookBackfillRun(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<BackfillRunClaim> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT r.*,
              EXISTS (
                SELECT 1
                  FROM social_publication_targets t
                  JOIN social_publications p ON p.id = t.publication_id
                 WHERE p.tenant_id = $1
                   AND p.source = 'AUTO'
                   AND p.auto_posting_key LIKE ($2::text || ':%')
                   AND t.status = 'AMBIGUOUS'
              ) AS has_ambiguous_target,
              EXISTS (
                SELECT 1
                  FROM social_publication_targets t
                  JOIN social_publications p ON p.id = t.publication_id
                 WHERE p.tenant_id = $1
                   AND p.source = 'AUTO'
                   AND p.auto_posting_key LIKE ($2::text || ':%')
                   AND t.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRYABLE')
              ) AS has_unresolved_target,
              EXISTS (
                SELECT 1
                  FROM social_publication_targets t
                  JOIN social_publications p ON p.id = t.publication_id
                 WHERE p.tenant_id = $1
                   AND p.source = 'AUTO'
                   AND p.auto_posting_key LIKE ($2::text || ':%')
                   AND t.status = 'PUBLISHED'
              ) AS has_successful_target
         FROM marketing_facebook_daily_runs r
        WHERE r.tenant_id = $1 AND r.logical_day = $2::date AND r.slot_index = 0
        FOR UPDATE`,
      [tenantId, logicalDay],
    );
    const row = existing.rows[0];

    if (row?.has_ambiguous_target) {
      await client.query('ROLLBACK');
      return {
        kind: 'BLOCKED',
        reason: 'Facebook không xác nhận kết quả lần đăng trước; cần reconcile thủ công trước khi chạy bù.',
        errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
      };
    }
    if (row?.has_unresolved_target) {
      await client.query('ROLLBACK');
      return {
        kind: 'BLOCKED',
        reason: 'Lần đăng trước vẫn đang chờ xử lý hoặc retry; không tạo thêm một lần gửi.',
        errorCode: 'DAILY_RUN_DELIVERY_IN_PROGRESS',
      };
    }
    if (row?.status === 'SUCCESS' || row?.has_successful_target) {
      await client.query('ROLLBACK');
      return {
        kind: 'BLOCKED',
        reason: 'Ngày này đã đăng thành công; khóa chống đăng trùng vẫn được giữ nguyên.',
        errorCode: 'DAILY_RUN_ALREADY_SUCCESS',
      };
    }

    // A crashed process can leave a row RUNNING without a provider target.
    // A recent RUNNING row is still protected from concurrent manual takeover.
    if (
      row?.status === 'RUNNING'
      && row.started_at
      && Date.now() - new Date(row.started_at).getTime() < 15 * 60 * 1000
    ) {
      await client.query('ROLLBACK');
      return {
        kind: 'BLOCKED',
        reason: 'Lần chạy trong ngày vẫn đang hoạt động; hãy chờ kết quả trước khi chạy bù.',
        errorCode: 'DAILY_RUN_IN_PROGRESS',
      };
    }

    let runRow = row;
    if (!runRow) {
      const inserted = await client.query(
        `INSERT INTO marketing_facebook_daily_runs (tenant_id, logical_day, slot_index, status)
         VALUES ($1, $2::date, 0, 'RUNNING')
         ON CONFLICT (tenant_id, logical_day, slot_index) DO NOTHING
         RETURNING *`,
        [tenantId, logicalDay],
      );
      runRow = inserted.rows[0];
      if (!runRow) {
        const raced = await client.query(
          `SELECT * FROM marketing_facebook_daily_runs
            WHERE tenant_id = $1 AND logical_day = $2::date AND slot_index = 0
            FOR UPDATE`,
          [tenantId, logicalDay],
        );
        runRow = raced.rows[0];
      }
    }

    const updated = await client.query(
      `UPDATE marketing_facebook_daily_runs
          SET status = 'RUNNING',
              result = jsonb_build_object('mode', 'BACKFILL', 'logicalDay', $2::text),
              error_code = NULL,
              error_message = NULL,
              finished_at = NULL,
              started_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [runRow.id, logicalDay],
    );
    await client.query('COMMIT');
    return { kind: 'CLAIMED', run: mapDailyRun(updated.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createMarketingFacebookBackfillRequest(
  pool: Pool,
  input: {
    tenantId: string;
    logicalDay: string;
    reason: string;
    requestedBy: string;
  },
): Promise<{ created: boolean; request: MarketingFacebookBackfillRequest }> {
  const result = await pool.query(
    `INSERT INTO marketing_facebook_backfill_requests
       (tenant_id, logical_day, reason, requested_by)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (tenant_id, logical_day) DO UPDATE
        SET reason = EXCLUDED.reason,
            requested_by = EXCLUDED.requested_by,
            status = 'REQUESTED',
            result = '{}'::jsonb,
            error_code = NULL,
            error_message = NULL,
            started_at = NULL,
            finished_at = NULL
      WHERE marketing_facebook_backfill_requests.status IN ('FAILED', 'SKIPPED')
     RETURNING *`,
    [input.tenantId, input.logicalDay, input.reason.trim(), input.requestedBy],
  );
  if (result.rows[0]) return { created: true, request: mapBackfillRequest(result.rows[0]) };
  const existing = await pool.query(
    `SELECT * FROM marketing_facebook_backfill_requests
      WHERE tenant_id = $1 AND logical_day = $2::date`,
    [input.tenantId, input.logicalDay],
  );
  return { created: false, request: mapBackfillRequest(existing.rows[0]) };
}

export async function markMarketingFacebookBackfillRunning(
  pool: Pool,
  requestId: string,
): Promise<MarketingFacebookBackfillRequest | null> {
  const result = await pool.query(
    `UPDATE marketing_facebook_backfill_requests
        SET status = 'RUNNING', started_at = NOW()
      WHERE id = $1 AND status = 'REQUESTED'
      RETURNING *`,
    [requestId],
  );
  return result.rows[0] ? mapBackfillRequest(result.rows[0]) : null;
}

export async function finishMarketingFacebookBackfillRequest(
  pool: Pool,
  requestId: string,
  update: {
    status: MarketingFacebookBackfillRequest['status'];
    result?: Record<string, unknown>;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<MarketingFacebookBackfillRequest | null> {
  const result = await pool.query(
    `UPDATE marketing_facebook_backfill_requests
        SET status = $2,
            result = $3::jsonb,
            error_code = $4,
            error_message = $5,
            finished_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      requestId,
      update.status,
      JSON.stringify(update.result || {}),
      update.errorCode || null,
      update.errorMessage || null,
    ],
  );
  return result.rows[0] ? mapBackfillRequest(result.rows[0]) : null;
}

export async function listMarketingFacebookBackfillRequests(
  pool: Pool,
  tenantId: string,
  limit = 20,
): Promise<MarketingFacebookBackfillRequest[]> {
  const result = await pool.query(
    `SELECT *
       FROM marketing_facebook_backfill_requests
      WHERE tenant_id = $1
      ORDER BY requested_at DESC
      LIMIT $2`,
    [tenantId, Math.min(Math.max(Math.floor(limit), 1), 50)],
  );
  return result.rows.map(mapBackfillRequest);
}

export async function finishMarketingFacebookDailyRun(
  pool: Pool,
  runId: string,
  update: {
    status: MarketingFacebookDailyRun['status'];
    sourceType?: 'LISTING' | 'PROJECT' | null;
    sourceId?: string | null;
    publicationId?: string | null;
    result?: Record<string, unknown>;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<MarketingFacebookDailyRun | null> {
  const result = await pool.query(
    `UPDATE marketing_facebook_daily_runs
        SET status = $2,
            source_type = $3,
            source_id = $4,
            publication_id = $5,
            result = $6::jsonb,
            error_code = $7,
            error_message = $8,
            finished_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      runId,
      update.status,
      update.sourceType || null,
      update.sourceId || null,
      update.publicationId || null,
      JSON.stringify(update.result || {}),
      update.errorCode || null,
      update.errorMessage || null,
    ],
  );
  return result.rows[0] ? mapDailyRun(result.rows[0]) : null;
}

export async function getMarketingFacebookDailyStatus(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<{
  settings: AutoPostingSettings;
  todayRun: MarketingFacebookDailyRun | null;
  todayRuns: MarketingFacebookDailyRun[];
  postsCompletedToday: number;
  lastRun: MarketingFacebookDailyRun | null;
  backfillRequests: MarketingFacebookBackfillRequest[];
  warning: string | null;
}> {
  const [settings, result, backfillRequests] = await Promise.all([
    getAutoPostingSettings(pool, tenantId),
    pool.query(
      `SELECT *
         FROM marketing_facebook_daily_runs
        WHERE tenant_id = $1
        ORDER BY logical_day DESC, started_at DESC
        LIMIT 20`,
      [tenantId],
    ),
    listMarketingFacebookBackfillRequests(pool, tenantId),
  ]);
  const runs = result.rows.map(mapDailyRun);
  const todayRuns = runs
    .filter(run => run.logicalDay === logicalDay)
    .sort((a, b) => a.slotIndex - b.slotIndex);
  const todayRun = todayRuns.length ? todayRuns[todayRuns.length - 1] : null;
  const postsCompletedToday = todayRuns.filter(run => run.status === 'SUCCESS').length;
  const lastRun = runs[0] || null;
  const warning = todayRun?.status === 'SKIPPED'
    ? todayRun.errorMessage || 'Agent Marketing hôm nay chưa tìm thấy nguồn đủ điều kiện để đăng Facebook.'
    : todayRun?.status === 'FAILED'
      ? todayRun.errorMessage || 'Agent Marketing đăng Facebook hôm nay bị lỗi.'
      : null;
  return { settings, todayRun, todayRuns, postsCompletedToday, lastRun, backfillRequests, warning };
}