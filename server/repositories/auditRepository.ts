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
    if (!SAFE_VERIFICATION_CODES.has(data.reasonCode)
      || !SAFE_VERIFICATION_CHECKS.has(data.checks.oaId)
      || !SAFE_VERIFICATION_CHECKS.has(data.checks.quota)
      || !['READY', 'NOT_READY'].includes(data.status)
      || (data.status === 'READY') !== (data.reasonCode === 'READY')) {
      throw new Error('Invalid Zalo broadcast verification audit data');
    }

    await this.log(tenantId, {
      actorId: data.actorId,
      action: ZALO_BROADCAST_VERIFICATION_ACTION,
      entityType: 'enterprise_config',
      entityId: tenantId,
      details: [
        `status=${data.status}`,
        `reason_code=${data.reasonCode}`,
        `oa_check=${data.checks.oaId}`,
        `quota_check=${data.checks.quota}`,
      ].join(';'),
      ipAddress: data.ipAddress,
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
         LEFT JOIN users u ON al.actor_id = u.id::text
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
