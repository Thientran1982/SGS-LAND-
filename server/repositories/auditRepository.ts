import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';
import type { ZaloBroadcastVerificationReasonCode } from '../social-publishing/zaloBroadcastPublisher';

type ZaloBroadcastVerificationStatus = 'READY' | 'NOT_READY';
type VerificationCheck = 'PASS' | 'FAIL' | 'NOT_RUN';

export interface ZaloBroadcastVerificationAudit {
  actorId: string;
  status: ZaloBroadcastVerificationStatus;
  reasonCode: ZaloBroadcastVerificationReasonCode;
  checks: {
    oaId: VerificationCheck;
    quota: VerificationCheck;
  };
  ipAddress?: string;
}

export interface ZaloBroadcastVerificationTransition {
  transitionedToNotReady: boolean;
  previousStatus: ZaloBroadcastVerificationStatus | null;
  transitionEventId?: string;
}

export interface ZaloBroadcastVerificationHistoryEntry {
  checkedAt: string;
  status: ZaloBroadcastVerificationStatus;
  reasonCode: ZaloBroadcastVerificationReasonCode;
  checks: {
    oaId: VerificationCheck;
    quota: VerificationCheck;
  };
  actorName?: string | null;
}

const ZALO_BROADCAST_VERIFICATION_ACTION = 'ZALO_BROADCAST_ACCESS_VERIFIED';
const SAFE_VERIFICATION_CODES = new Set<ZaloBroadcastVerificationReasonCode>([
  'READY',
  'CONFIG_UNAVAILABLE',
  'ZALO_NOT_CONNECTED',
  'PROBE_USER_MISSING',
  'OA_REQUEST_FAILED',
  'OA_ID_MISMATCH',
  'QUOTA_PERMISSION_DENIED',
  'QUOTA_REQUEST_FAILED',
  'QUOTA_RESPONSE_INVALID',
  'PROVIDER_UNAVAILABLE',
]);
const SAFE_VERIFICATION_CHECKS = new Set<VerificationCheck>(['PASS', 'FAIL', 'NOT_RUN']);

function parseVerificationDetails(details: string | null): Pick<
  ZaloBroadcastVerificationHistoryEntry,
  'status' | 'reasonCode' | 'checks'
> | null {
  if (!details) return null;
  const values = Object.fromEntries(
    details.split(';').map(pair => {
      const separator = pair.indexOf('=');
      return separator === -1 ? [pair, ''] : [pair.slice(0, separator), pair.slice(separator + 1)];
    }),
  );
  const status = values.status as ZaloBroadcastVerificationStatus;
  const reasonCode = values.reason_code as ZaloBroadcastVerificationReasonCode;
  const oaId = values.oa_check as VerificationCheck;
  const quota = values.quota_check as VerificationCheck;
  if (!['READY', 'NOT_READY'].includes(status)
    || !SAFE_VERIFICATION_CODES.has(reasonCode)
    || !SAFE_VERIFICATION_CHECKS.has(oaId)
    || !SAFE_VERIFICATION_CHECKS.has(quota)) {
    return null;
  }
  return { status, reasonCode, checks: { oaId, quota } };
}

export class AuditRepository extends BaseRepository {
  constructor() {
    super('audit_logs');
  }

  async log(tenantId: string, data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: string;
    metadata?: any;
    ipAddress?: string;
  }): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, ip_address)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6)`,
        [
          data.actorId, data.action, data.entityType, data.entityId,
          data.details || null,
          data.ipAddress || null,
        ]
      );
    });
  }

  async logZaloBroadcastVerification(
    tenantId: string,
    data: ZaloBroadcastVerificationAudit,
  ): Promise<void> {
    this.validateZaloBroadcastVerification(data);

    await this.withTenant(tenantId, (client) =>
      this.insertZaloBroadcastVerification(client, tenantId, data));
  }

  /**
   * Record a verification and atomically determine whether it is the first
   * NOT_READY result after a READY result for this tenant. The transaction
   * advisory lock prevents concurrent admin checks from both sending the
   * same transition alert.
   */
  async logZaloBroadcastVerificationAndDetectTransition(
    tenantId: string,
    data: ZaloBroadcastVerificationAudit,
  ): Promise<ZaloBroadcastVerificationTransition> {
    this.validateZaloBroadcastVerification(data);

    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`zalo_broadcast_verification:${tenantId}`],
      );

      const previousResult = await client.query<{ details: string | null }>(
        `SELECT details
         FROM audit_logs
         WHERE tenant_id = $1 AND action = $2
         ORDER BY timestamp DESC, id DESC
         LIMIT 1`,
        [tenantId, ZALO_BROADCAST_VERIFICATION_ACTION],
      );
      const previous = previousResult.rows[0]
        ? parseVerificationDetails(previousResult.rows[0].details)
        : null;

      const inserted = await this.insertZaloBroadcastVerification(client, tenantId, data);

      return {
        transitionedToNotReady: previous?.status === 'READY' && data.status === 'NOT_READY',
        previousStatus: previous?.status || null,
        ...(previous?.status === 'READY' && data.status === 'NOT_READY' && inserted?.id
          ? { transitionEventId: inserted.id }
          : {}),
      };
    });
  }

  async findZaloBroadcastVerificationHistory(
    tenantId: string,
    limit = 10,
  ): Promise<ZaloBroadcastVerificationHistoryEntry[]> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 50));
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT al.timestamp, al.details, u.name AS actor_name
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         WHERE al.tenant_id = $1
           AND al.action = $2
         ORDER BY al.timestamp DESC
         LIMIT $3`,
        [tenantId, ZALO_BROADCAST_VERIFICATION_ACTION, safeLimit],
      );

      return result.rows.flatMap(row => {
        const parsed = parseVerificationDetails(row.details);
        if (!parsed) return [];
        return [{
          checkedAt: new Date(row.timestamp).toISOString(),
          ...parsed,
          actorName: row.actor_name || null,
        }];
      });
    });
  }

  private validateZaloBroadcastVerification(data: ZaloBroadcastVerificationAudit): void {
    if (!SAFE_VERIFICATION_CODES.has(data.reasonCode)
      || !SAFE_VERIFICATION_CHECKS.has(data.checks.oaId)
      || !SAFE_VERIFICATION_CHECKS.has(data.checks.quota)
      || !['READY', 'NOT_READY'].includes(data.status)
      || (data.status === 'READY') !== (data.reasonCode === 'READY')) {
      throw new Error('Invalid Zalo broadcast verification audit data');
    }
  }

  private async insertZaloBroadcastVerification(
    client: Parameters<Parameters<typeof this.withTenant>[1]>[0],
    tenantId: string,
    data: ZaloBroadcastVerificationAudit,
  ): Promise<{ id: string; timestamp: string } | null> {
    const result = await client.query<{ id: string; timestamp: string }>(
      `INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6)
       RETURNING id, timestamp`,
      [
        data.actorId,
        ZALO_BROADCAST_VERIFICATION_ACTION,
        'enterprise_config',
        tenantId,
        [
          `status=${data.status}`,
          `reason_code=${data.reasonCode}`,
          `oa_check=${data.checks.oaId}`,
          `quota_check=${data.checks.quota}`,
        ].join(';'),
        data.ipAddress || null,
      ],
    );
    return result.rows[0] || null;
  }

  async findLogs(
    tenantId: string,
    pagination: PaginationParams,
    filters?: { actorId?: string; action?: string; entityType?: string; entityId?: string; since?: string }
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.actorId) {
        conditions.push(`actor_id = $${paramIndex++}`);
        values.push(filters.actorId);
      }
      if (filters?.action) {
        conditions.push(`action = $${paramIndex++}`);
        values.push(filters.action);
      }
      if (filters?.entityType) {
        conditions.push(`entity_type = $${paramIndex++}`);
        values.push(filters.entityType);
      }
      if (filters?.entityId) {
        conditions.push(`entity_id = $${paramIndex++}`);
        values.push(filters.entityId);
      }
      if (filters?.since) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(filters.since);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM audit_logs ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT al.*, u.name as actor_name
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         ${whereClause}
         ORDER BY al.timestamp DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }
}

export const auditRepository = new AuditRepository();
