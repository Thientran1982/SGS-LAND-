import { withTenantContext } from '../db';

type AuditEvent = {
  eventKey: string;
  eventType: 'CHAT_MESSAGE' | 'TOOL_EXECUTION' | 'ENTITY_OBSERVED';
  direction?: 'INBOUND' | 'OUTBOUND';
  sessionId?: string;
  leadId?: string;
  runId?: string;
  traceId?: string;
  toolName?: string;
  entityType?: string;
  entityId?: string;
  entityCode?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  status?: string;
  input?: Record<string, any>;
  output?: Record<string, any> | any[];
  metadata?: Record<string, any>;
  latencyMs?: number;
};

function scrub(value: any, depth = 0): any {
  if (depth > 5) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => scrub(item, depth + 1));
  const secretKeys = /token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key/i;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [
    key, secretKeys.test(key) ? '[redacted]' : scrub(item, depth + 1),
  ]));
}

class AgentAuditRepository {
  async record(tenantId: string, event: AuditEvent): Promise<void> {
    await withTenantContext(tenantId, async client => {
      await client.query(
        `INSERT INTO agent_audit_events
          (tenant_id,event_key,event_type,direction,session_id,lead_id,run_id,trace_id,
           tool_name,entity_type,entity_id,entity_code,parent_entity_type,parent_entity_id,
           status,input_json,output_json,metadata_json,latency_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19)
         ON CONFLICT (tenant_id,event_key) DO NOTHING`,
        [
          tenantId, event.eventKey, event.eventType, event.direction || null,
          event.sessionId || null, event.leadId || null, event.runId || null, event.traceId || null,
          event.toolName || null, event.entityType || null, event.entityId || null, event.entityCode || null,
          event.parentEntityType || null, event.parentEntityId || null, event.status || 'SUCCESS',
          JSON.stringify(scrub(event.input || {})), JSON.stringify(scrub(event.output || {})),
          JSON.stringify(scrub(event.metadata || {})), event.latencyMs || null,
        ],
      );
    });
  }

  async list(tenantId: string, filters: {
    sessionId?: string; runId?: string; entityType?: string; entityId?: string;
    from?: string; to?: string; limit?: number; offset?: number;
  }): Promise<{ events: any[]; total: number }> {
    return withTenantContext(tenantId, async client => {
      const where = ['tenant_id = $1'];
      const values: any[] = [tenantId];
      const add = (sql: string, value: any) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
      if (filters.sessionId) add('session_id = ?', filters.sessionId);
      if (filters.runId) add('run_id = ?', filters.runId);
      if (filters.entityType) add('entity_type = ?', filters.entityType);
      if (filters.entityId) add('entity_id = ?', filters.entityId);
      if (filters.from) add('created_at >= ?', filters.from);
      if (filters.to) add('created_at <= ?', filters.to);
      const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
      const offset = Math.max(Number(filters.offset) || 0, 0);
      const base = `FROM agent_audit_events WHERE ${where.join(' AND ')}`;
      const [rows, count] = await Promise.all([
        client.query(`SELECT * ${base} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, values),
        client.query(`SELECT COUNT(*)::int AS total ${base}`, values),
      ]);
      return { events: rows.rows, total: count.rows[0]?.total || 0 };
    });
  }
}

export const agentAuditRepository = new AgentAuditRepository();