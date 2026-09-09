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
  timeWindows: [{ start: '08:00', end: '11:00' }],
  recycleAfterDays: 7,
  platforms: ['FACEBOOK_PAGE'],
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
    postsPerDay: Math.min(50, Math.max(1, Number(input.postsPerDay ?? current.postsPerDay))),
    timeWindows: Array.isArray(input.timeWindows) && input.timeWindows.length ? input.timeWindows : current.timeWindows,
    recycleAfterDays: Math.max(0, Number(input.recycleAfterDays ?? current.recycleAfterDays)),
    platforms: Array.isArray(input.platforms) && input.platforms.length ? input.platforms : current.platforms,
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