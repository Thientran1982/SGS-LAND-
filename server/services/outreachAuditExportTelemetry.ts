import { withTenantContext } from '../db';

export const OUTREACH_AUDIT_EXPORT_FAILURE_CATEGORIES = [
  'APPROVAL_LOOKUP',
  'AUDIT_HISTORY_LOOKUP',
  'CSV_SERIALIZATION',
  'UNKNOWN',
] as const;

export type OutreachAuditExportFailureCategory =
  typeof OUTREACH_AUDIT_EXPORT_FAILURE_CATEGORIES[number];

export type OutreachAuditExportFailureSummary = {
  windowHours: number;
  windowStart: string;
  windowEnd: string;
  totalFailures: number;
  failureRatePerHour: number;
  categories: Array<{
    category: OutreachAuditExportFailureCategory;
    count: number;
    firstFailedAt: string;
    lastFailedAt: string;
  }>;
  rawPayloadIncluded: false;
  approvalContentsIncluded: false;
  providerPayloadIncluded: false;
};

export function normalizeOutreachAuditExportFailureWindow(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 24;
  return Math.max(1, Math.min(24 * 30, Math.trunc(parsed)));
}

export async function recordOutreachAuditExportFailure(
  tenantId: string,
  category: OutreachAuditExportFailureCategory,
): Promise<void> {
  await withTenantContext(tenantId, async client => {
    await client.query(
      `INSERT INTO outreach_audit_export_failure_telemetry
         (tenant_id, failure_category, bucket_start, failure_count, first_failed_at, last_failed_at, updated_at)
       VALUES ($1::uuid, $2, date_trunc('hour', NOW()), 1, NOW(), NOW(), NOW())
       ON CONFLICT (tenant_id, failure_category, bucket_start) DO UPDATE SET
         failure_count = LEAST(10000, outreach_audit_export_failure_telemetry.failure_count + 1),
         last_failed_at = NOW(),
         updated_at = NOW()`,
      [tenantId, category],
    );

    // Keep this operational aggregate bounded: four weeks of hourly buckets
    // and a fixed category set is enough for incident triage.
    await client.query(
      `DELETE FROM outreach_audit_export_failure_telemetry
        WHERE tenant_id=$1::uuid
          AND bucket_start < NOW() - INTERVAL '30 days'`,
      [tenantId],
    );
  });
}

export async function recordOutreachAuditExportFailureSafely(
  tenantId: string,
  category: OutreachAuditExportFailureCategory,
): Promise<void> {
  try {
    await recordOutreachAuditExportFailure(tenantId, category);
  } catch {
    // Export availability must not depend on a second telemetry write.
  }
}

export async function getOutreachAuditExportFailureSummary(
  tenantId: string,
  requestedWindowHours: unknown = 24,
): Promise<OutreachAuditExportFailureSummary> {
  const windowHours = normalizeOutreachAuditExportFailureWindow(requestedWindowHours);
  const result = await withTenantContext(tenantId, client => client.query(
    `SELECT failure_category AS category,
            SUM(failure_count)::int AS count,
            MIN(first_failed_at) AS first_failed_at,
            MAX(last_failed_at) AS last_failed_at
       FROM outreach_audit_export_failure_telemetry
      WHERE tenant_id=$1::uuid
        AND bucket_start >= NOW() - ($2::int * INTERVAL '1 hour')
      GROUP BY failure_category
      ORDER BY count DESC, failure_category ASC`,
    [tenantId, windowHours],
  ));

  const categories = result.rows.map(row => ({
    category: String(row.category) as OutreachAuditExportFailureCategory,
    count: Number(row.count) || 0,
    firstFailedAt: new Date(row.first_failed_at).toISOString(),
    lastFailedAt: new Date(row.last_failed_at).toISOString(),
  }));
  const totalFailures = categories.reduce((total, item) => total + item.count, 0);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60 * 1000);

  return {
    windowHours,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalFailures,
    failureRatePerHour: Number((totalFailures / windowHours).toFixed(2)),
    categories,
    rawPayloadIncluded: false,
    approvalContentsIncluded: false,
    providerPayloadIncluded: false,
  };
}