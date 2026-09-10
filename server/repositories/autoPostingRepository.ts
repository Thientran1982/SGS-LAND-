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

export async function upsertAutoPostingSettings(
  pool: Pool,
  tenantId: string,
  input: Partial<Omit<AutoPostingSettings, 'tenantId'>>,
): Promise<AutoPostingSettings> {
  const current = await getAutoPostingSettings(pool, tenantId);
  const next = {
    enabled: input.enabled ?? current.enabled,
    postsPerDay: 1,
    timeWindows: DEFAULT_SETTINGS.timeWindows,
    recycleAfterDays: Math.max(0, Number(input.recycleAfterDays ?? current.recycleAfterDays)),
    platforms: ['FACEBOOK_PAGE'],
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

export async function claimMarketingFacebookDailyRun(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
): Promise<MarketingFacebookDailyRun | null> {
  const result = await pool.query(
    `INSERT INTO marketing_facebook_daily_runs (tenant_id, logical_day, status)
     VALUES ($1, $2::date, 'RUNNING')
     ON CONFLICT (tenant_id, logical_day) DO NOTHING
     RETURNING *`,
    [tenantId, logicalDay],
  );
  return result.rows[0] ? mapDailyRun(result.rows[0]) : null;
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
  lastRun: MarketingFacebookDailyRun | null;
  warning: string | null;
}> {
  const [settings, result] = await Promise.all([
    getAutoPostingSettings(pool, tenantId),
    pool.query(
      `SELECT *
         FROM marketing_facebook_daily_runs
        WHERE tenant_id = $1
        ORDER BY logical_day DESC, started_at DESC
        LIMIT 10`,
      [tenantId],
    ),
  ]);
  const runs = result.rows.map(mapDailyRun);
  const todayRun = runs.find(run => run.logicalDay === logicalDay) || null;
  const lastRun = runs[0] || null;
  const warning = todayRun?.status === 'SKIPPED'
    ? todayRun.errorMessage || 'Agent Marketing hôm nay chưa tìm thấy nguồn đủ điều kiện để đăng Facebook.'
    : todayRun?.status === 'FAILED'
      ? todayRun.errorMessage || 'Agent Marketing đăng Facebook hôm nay bị lỗi.'
      : null;
  return { settings, todayRun, lastRun, warning };
}