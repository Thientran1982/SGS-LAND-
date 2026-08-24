import { createHash, randomUUID } from 'crypto';
import { withTenantContext } from '../db';

export type MemoryKind = 'fact' | 'episodic' | 'procedural';
export type MemoryRow = {
  id: string; tenant_id: string; namespace: string; key: string; kind: MemoryKind;
  value: string; importance: number; hits: number; expires_at: string | null;
  created_at: string; updated_at: string;
};
export type MatcherWeights = { location: number; price: number; legal: number; rating: number };
export const DEFAULT_MATCHER_WEIGHTS: MatcherWeights = { location: 0.4, price: 0.25, legal: 0.2, rating: 0.15 };
const VALID_KINDS = new Set<MemoryKind>(['fact', 'episodic', 'procedural']);
const MAX_ITEMS = 200;
const signalWriteFailures = new Map<string, { count: number; lastAt: string; lastError: string }>();

export function scrubPii(input: unknown): string {
  return String(input ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email đã ẩn]')
    .replace(/(?<!\d)(?:\+?84|0)(?:\s|[-.])?(?:3|5|7|8|9)(?:\s|[-.]|\d){8,10}(?!\d)/g, '[số điện thoại đã ẩn]')
    .replace(/\b\d{9,12}\b/g, '[mã định danh đã ẩn]')
    .replace(/\b(?:stk|tài khoản ngân hàng|account)\s*[:#-]?\s*\d{6,20}\b/gi, '[tài khoản ngân hàng đã ẩn]')
    .replace(/\b(?:số nhà|địa chỉ đầy đủ|address)\s*[:#-]?\s*[^,;\n]{8,120}/gi, '[địa chỉ đã ẩn]')
    .slice(0, 10000);
}

function safeNamespace(namespace: string): string {
  const value = String(namespace || '').trim();
  if (!/^(?:customer|agent):[^:]{1,180}$/.test(value) && value !== 'global') {
    throw new Error('Invalid memory namespace');
  }
  return value;
}

function lexicalScore(value: string, query: string): number {
  const haystack = value.toLocaleLowerCase('vi-VN');
  const terms = query.toLocaleLowerCase('vi-VN').split(/\s+/).filter(Boolean);
  return terms.length ? terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) / terms.length : 0;
}

export function validateWeights(input: Partial<MatcherWeights>): MatcherWeights {
  const values = {
    location: Number(input.location),
    price: Number(input.price),
    legal: Number(input.legal),
    rating: Number(input.rating),
  };
  if (Object.values(values).some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid matcher weights');
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('Matcher weights must have a positive total');
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number((v / total).toFixed(6))])) as MatcherWeights;
}

async function trimNamespace(client: any, tenantId: string, namespace: string): Promise<void> {
  await client.query(
    `DELETE FROM agent_store WHERE tenant_id=$1 AND namespace=$2
     AND id IN (
       SELECT id FROM agent_store WHERE tenant_id=$1 AND namespace=$2
       ORDER BY importance ASC, updated_at ASC OFFSET $3
     )`,
    [tenantId, namespace, MAX_ITEMS],
  );
}

export const agentMemoryService = {
  async remember(tenantId: string, namespace: string, key: string, value: unknown, kind: MemoryKind = 'fact', importance = 0.5, ttlDays?: number | null) {
    const ns = safeNamespace(namespace);
    if (!VALID_KINDS.has(kind)) throw new Error('Invalid memory kind');
    const rawValue = String(value ?? '');
    const cleanValue = scrubPii(value);
    if (!cleanValue.trim()) throw new Error('Memory value cannot be empty');
    const score = Math.max(0, Math.min(1, Number(importance) || 0.5));
    const expiresAt = kind === 'episodic'
      ? new Date(Date.now() + (Number(ttlDays) > 0 ? Number(ttlDays) : 90) * 86400000)
      : (Number(ttlDays) > 0 ? new Date(Date.now() + Number(ttlDays) * 86400000) : null);
    return withTenantContext(tenantId, async client => {
      const existing = (await client.query(
        `SELECT * FROM agent_store WHERE tenant_id=$1 AND namespace=$2 AND key=$3`,
        [tenantId, ns, String(key).slice(0, 200)],
      )).rows[0] as MemoryRow | undefined;
      if (existing && kind === 'fact' && existing.kind === 'fact' && Number(existing.importance) >= 0.7 && existing.value !== cleanValue) {
        await client.query(
          `INSERT INTO ai_learning_audit_events (tenant_id,event_type,entity_type,entity_id,reason,metrics_json)
           VALUES ($1,'MEMORY_CONFLICT','MEMORY',$2,'high_importance_fact_not_overwritten',$3::jsonb)`,
          [tenantId, existing.id, JSON.stringify({ old: existing.value, new: cleanValue, namespace: ns, key })],
        );
        return { ...existing, conflict: true, piiScrubbed: cleanValue !== rawValue };
      }
      const row = (await client.query(
        `INSERT INTO agent_store (id,tenant_id,namespace,key,kind,value,importance,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id,namespace,key) DO UPDATE SET kind=$5,value=$6,importance=$7,expires_at=$8,updated_at=NOW()
         RETURNING *`,
        [randomUUID(), tenantId, ns, String(key).slice(0, 200), kind, cleanValue, score, expiresAt],
      )).rows[0];
      await trimNamespace(client, tenantId, ns);
      return { ...row, piiScrubbed: cleanValue !== rawValue, conflict: false };
    });
  },

  async listAdminMemory(tenantId: string, filters: { namespace?: string; kind?: string; importance?: string }) {
    const params: any[] = [tenantId];
    const where = ['tenant_id=$1'];
    if (filters.namespace) { params.push(safeNamespace(filters.namespace)); where.push(`namespace=$${params.length}`); }
    if (filters.kind && VALID_KINDS.has(filters.kind as MemoryKind)) { params.push(filters.kind); where.push(`kind=$${params.length}`); }
    if (filters.importance === 'HIGH') where.push('importance >= 0.7');
    if (filters.importance === 'MEDIUM') where.push('importance >= 0.4 AND importance < 0.7');
    if (filters.importance === 'LOW') where.push('importance < 0.4');
    return withTenantContext(tenantId, async client => {
      const rows = (await client.query(
        `SELECT *, (expires_at IS NOT NULL AND expires_at <= NOW()) AS expired
         FROM agent_store WHERE ${where.join(' AND ')}
         ORDER BY expired DESC, importance DESC, updated_at DESC LIMIT 500`, params,
      )).rows as Array<MemoryRow & { expired: boolean }>;
      const conflicts = (await client.query(
        `SELECT entity_id, metrics_json FROM ai_learning_audit_events
         WHERE tenant_id=$1 AND event_type='MEMORY_CONFLICT' ORDER BY created_at DESC LIMIT 500`, [tenantId],
      )).rows;
      const conflictIds = new Set(conflicts.map((row: any) => row.entity_id));
      return rows.map(row => ({ ...row, conflict: conflictIds.has(row.id), piiScrubbed: false }));
    });
  },

  async updateMemory(tenantId: string, id: string, input: { namespace: string; key: string; value: unknown; kind?: MemoryKind; importance?: number; ttlDays?: number | null }) {
    const ns = safeNamespace(input.namespace);
    const current = await withTenantContext(tenantId, async client =>
      (await client.query('SELECT * FROM agent_store WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rows[0]);
    if (!current) return null;
    const row = await this.remember(tenantId, ns, input.key, input.value, input.kind || current.kind, input.importance ?? Number(current.importance), input.ttlDays);
    if (row && row.id !== id) await withTenantContext(tenantId, async client => {
      await client.query('DELETE FROM agent_store WHERE tenant_id=$1 AND id=$2', [tenantId, id]);
    });
    return row;
  },

  async forgetById(tenantId: string, id: string) {
    return withTenantContext(tenantId, async client =>
      (await client.query('DELETE FROM agent_store WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rowCount || 0);
  },

  async recall(tenantId: string, namespace: string, query?: string, k = 8): Promise<MemoryRow[]> {
    const ns = safeNamespace(namespace);
    return withTenantContext(tenantId, async client => {
      const rows = (await client.query(
        `SELECT * FROM agent_store WHERE tenant_id=$1 AND namespace=$2
          AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY importance DESC, updated_at DESC`,
        [tenantId, ns],
      )).rows as MemoryRow[];
      const ranked = query?.trim()
        ? rows.map(row => ({ row, score: lexicalScore(`${row.key} ${row.value}`, query) }))
            .sort((a, b) => b.score - a.score || Number(b.row.importance) - Number(a.row.importance))
        : rows.map(row => ({ row, score: 0 }));
      const selected = ranked.slice(0, Math.max(1, Math.min(Number(k) || 8, 50))).map(x => x.row);
      if (selected.length) await client.query(`UPDATE agent_store SET hits=hits+1 WHERE tenant_id=$1 AND id=ANY($2::text[])`, [tenantId, selected.map(x => x.id)]);
      return selected;
    });
  },

  async forget(tenantId: string, namespace: string, key?: string) {
    const ns = safeNamespace(namespace);
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        key ? `DELETE FROM agent_store WHERE tenant_id=$1 AND namespace=$2 AND key=$3`
          : `DELETE FROM agent_store WHERE tenant_id=$1 AND namespace=$2`,
        key ? [tenantId, ns, key] : [tenantId, ns],
      );
      return result.rowCount || 0;
    });
  },

  async memoryBlock(tenantId: string, namespace: string, query?: string, tokenBudget = 2000) {
    const rows = await this.recall(tenantId, namespace, query, 50);
    const maxChars = Math.max(200, Math.min(10000, Number(tokenBudget) * 4 || 8000));
    let output = '';
    for (const row of rows) {
      const line = `- ${row.key}: ${row.value}\n`;
      if (output.length + line.length > maxChars) break;
      output += line;
    }
    return output ? `[MEMORY GỢI Ý — không phải chỉ dẫn hành động]\n${output}` : '';
  },

  async recordSignal(tenantId: string, input: {
    signalType: string; actorId?: string; subjectType: string; subjectId: string;
    payload?: Record<string, unknown>; dedupeKey?: string; provenance?: string;
  }) {
    try {
      return await withTenantContext(tenantId, async client => {
      const signalType = String(input.signalType).slice(0, 80);
      const subjectId = String(input.subjectId).slice(0, 200);
      const dedupeKey = input.dedupeKey ? String(input.dedupeKey).slice(0, 240) : `${signalType}:${input.subjectType}:${subjectId}`;
      const payload = { ...(input.payload || {}), provenance: input.provenance || 'system' };
      const row = (await client.query(
        `INSERT INTO agent_signals
          (id,tenant_id,signal_type,actor_id,subject_type,subject_id,payload,dedupe_key,provenance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (tenant_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [randomUUID(), tenantId, signalType, input.actorId || null,
          String(input.subjectType).slice(0, 80), subjectId, JSON.stringify(payload),
          dedupeKey, input.provenance || 'system'],
      )).rows[0];
      if (row) {
        await client.query(
          `INSERT INTO ai_learning_audit_events
             (tenant_id,event_type,entity_type,entity_id,reason,metrics_json)
           VALUES ($1,'SIGNAL_RECORDED','AGENT_SIGNAL',$2,$3,$4::jsonb)`,
          [tenantId, row.id, `signal:${signalType}`, JSON.stringify({
            signalType, subjectType: input.subjectType, subjectId, dedupeKey,
            provenance: input.provenance || 'system',
          })],
        );
      }
      return row || (await client.query(
        `SELECT * FROM agent_signals WHERE tenant_id=$1 AND dedupe_key=$2`,
        [tenantId, dedupeKey],
      )).rows[0] || null;
      });
    } catch (error: any) {
      const key = `${tenantId}:${String(input.signalType).slice(0, 80)}`;
      const previous = signalWriteFailures.get(key);
      signalWriteFailures.set(key, {
        count: (previous?.count || 0) + 1,
        lastAt: new Date().toISOString(),
        lastError: String(error?.message || error).slice(0, 300),
      });
      throw error;
    }
  },

  /**
   * Compare learning-producing activity with the signals it should create.
   * Activities must opt in through metadata.learningAction or
   * metadata.expectedSignalType; successfully sent outbound contact is the
   * built-in contact activity. This avoids treating ordinary page/inbox
   * traffic as a false learning alarm.
   */
  async getSignalHealth(tenantId: string, options: { since?: Date; windowHours?: number } = {}) {
    const windowHours = Math.max(1, Math.min(24 * 30, Number(options.windowHours) || 24));
    const since = options.since || new Date(Date.now() - windowHours * 3600000);
    const rows = await withTenantContext(tenantId, async client => (await client.query(
      `WITH expected AS (
         SELECT
           COALESCE(NULLIF(metadata->>'learningAction',''),
                    NULLIF(metadata->>'action',''),
                    CASE WHEN direction='OUTBOUND' THEN 'contact' ELSE 'unspecified' END) AS action,
           COALESCE(NULLIF(metadata->>'expectedSignalType',''), 'match_chosen') AS signal_type,
           COUNT(*)::int AS expected_count
         FROM interactions
         WHERE tenant_id=$1 AND timestamp >= $2
           AND ((metadata ? 'learningAction') OR (metadata ? 'expectedSignalType')
                OR (direction='OUTBOUND' AND status='SENT'))
         GROUP BY 1,2
       ), recorded AS (
         SELECT COALESCE(NULLIF(payload::jsonb->>'action',''), 'unspecified') AS action,
                signal_type, COUNT(*)::int AS recorded_count
         FROM agent_signals
         WHERE tenant_id=$1 AND created_at >= $2
         GROUP BY 1,2
       )
       SELECT e.action, e.signal_type, e.expected_count,
              COALESCE(r.recorded_count,0)::int AS recorded_count
       FROM expected e
       LEFT JOIN recorded r ON r.action=e.action AND r.signal_type=e.signal_type
       ORDER BY e.action, e.signal_type`,
      [tenantId, since],
    )).rows);
    const byAction = rows.map((row: any) => {
      const failures = signalWriteFailures.get(`${tenantId}:${row.signal_type}`);
      const expected = Number(row.expected_count) || 0;
      const recorded = Number(row.recorded_count) || 0;
      const failed = failures && new Date(failures.lastAt) >= since ? failures.count : 0;
      return {
        action: row.action,
        signalType: row.signal_type,
        expectedSignals: expected,
        recordedSignals: recorded,
        failedSignals: failed,
        status: failed > 0 ? 'SIGNAL_WRITE_FAILED' : recorded < expected ? 'SIGNAL_MISSING' : 'HEALTHY',
      };
    });
    const failures = [...signalWriteFailures.entries()]
      .filter(([key, value]) => key.startsWith(`${tenantId}:`) && new Date(value.lastAt) >= since)
      .map(([key, value]) => ({ signalType: key.slice(tenantId.length + 1), ...value }));
    const hasActivity = byAction.length > 0;
    return {
      tenantId, windowHours, since: since.toISOString(),
      activityStatus: hasActivity ? 'ACTIVE' : 'NO_ACTIVITY',
      byAction,
      alerts: byAction.filter((row: any) => row.status !== 'HEALTHY'),
      writeFailures: failures,
    };
  },

  async recordSuccessfulContactSignal(tenantId: string, input: {
    deliveryStatus: string;
    actorId?: string;
    subjectId: string;
    channel: string;
    dedupeKey: string;
  }) {
    // Customer-facing delivery is intentionally best-effort. A queued or
    // failed message is not evidence that contact succeeded.
    if (input.deliveryStatus !== 'SENT') return null;
    return this.recordSignal(tenantId, {
      signalType: 'match_chosen',
      actorId: input.actorId,
      subjectType: 'lead',
      subjectId: input.subjectId,
      dedupeKey: input.dedupeKey,
      provenance: 'staff',
      payload: {
        action: 'contact',
        channel: input.channel,
        factors: { rating: true },
      },
    });
  },

  async recordPriceEstimateEditDistance(tenantId: string, input: {
    subjectType: string; subjectId: string; estimatedPrice: unknown; actualPrice: unknown;
    actorId?: string; source?: string;
  }) {
    const estimate = Number(input.estimatedPrice);
    const actual = Number(input.actualPrice);
    if (!Number.isFinite(estimate) || !Number.isFinite(actual) || estimate <= 0 || actual <= 0) return null;
    const absolute = Math.abs(estimate - actual);
    return this.recordSignal(tenantId, {
      signalType: 'price_estimate_edit_distance', actorId: input.actorId,
      subjectType: input.subjectType, subjectId: input.subjectId,
      dedupeKey: `price_estimate_edit_distance:${input.subjectType}:${input.subjectId}`,
      provenance: input.source || 'verified_transaction',
      payload: { estimatedPrice: estimate, actualPrice: actual, absoluteError: absolute,
        relativeError: Number((absolute / actual).toFixed(6)), source: input.source || 'verified_transaction' },
    });
  },

  async summarizeSession(tenantId: string, namespace: string, transcript: string) {
    const clean = scrubPii(transcript).replace(/\s+/g, ' ').trim().slice(0, 1800);
    if (!clean) return null;
    return this.remember(tenantId, namespace, `session:${new Date().toISOString().slice(0, 10)}`, clean, 'episodic', 0.45, 90);
  },

  async listSignals(tenantId: string, signalType?: string, since?: Date) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM agent_signals WHERE tenant_id=$1
        AND ($2::text IS NULL OR signal_type=$2)
        AND ($3::timestamptz IS NULL OR created_at >= $3)
       ORDER BY created_at DESC LIMIT 500`,
      [tenantId, signalType || null, since || null],
    )).rows);
  },

  async getWeights(tenantId: string): Promise<MatcherWeights> {
    return withTenantContext(tenantId, async client => {
      const row = (await client.query(`SELECT weights FROM agent_weight_versions WHERE tenant_id=$1 AND status='live' ORDER BY created_at DESC LIMIT 1`, [tenantId])).rows[0];
      if (!row) return DEFAULT_MATCHER_WEIGHTS;
      try { return validateWeights(JSON.parse(row.weights)); } catch { return DEFAULT_MATCHER_WEIGHTS; }
    });
  },

  async listWeights(tenantId: string) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM agent_weight_versions WHERE tenant_id=$1 ORDER BY
       CASE status WHEN 'draft' THEN 0 WHEN 'live' THEN 1 ELSE 2 END, created_at DESC LIMIT 50`, [tenantId],
    )).rows.map((row: any) => {
      let weights = row.weights;
      let metrics = row.metrics;
      try { weights = typeof weights === 'string' ? JSON.parse(weights) : weights; } catch { /* expose raw for diagnosis */ }
      try { metrics = typeof metrics === 'string' ? JSON.parse(metrics) : metrics; } catch { /* expose raw for diagnosis */ }
      return { ...row, weights, metrics, goldenSetPassed: metrics?.goldenSetPassed === true };
    }));
  },

  async fitWeights(tenantId: string, createdBy?: string) {
    return withTenantContext(tenantId, async client => {
      const rows = (await client.query(
        `SELECT id,payload FROM agent_signals
          WHERE tenant_id=$1 AND signal_type='match_chosen' AND provenance IN ('system','staff','buyer')
          ORDER BY created_at DESC LIMIT 500`,
        [tenantId],
      )).rows;
      const counts = { location: 0, price: 0, legal: 0, rating: 0 };
      for (const row of rows) {
        let payload: any;
        try { payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload; } catch { continue; }
        for (const key of Object.keys(counts) as Array<keyof typeof counts>) if (payload?.factors?.[key] === true) counts[key]++;
      }
      const weights = validateWeights(Object.values(counts).some(Boolean) ? counts : DEFAULT_MATCHER_WEIGHTS);
      return (await client.query(
        `INSERT INTO agent_weight_versions (id,tenant_id,weights,status,metrics,created_by,note)
         VALUES ($1,$2,$3,'draft',$4,$5,'Đề xuất từ tín hiệu match_chosen') RETURNING *`,
        [randomUUID(), tenantId, JSON.stringify(weights), JSON.stringify({ sampleCount: rows.length, source: 'deduplicated_verified_signals', factorCounts: counts }), createdBy || null],
      )).rows[0];
    });
  },

  async promoteWeights(tenantId: string, id: string, passed: boolean, operatorId: string, metrics: Record<string, unknown> = {}) {
    if (!passed) throw new Error('Golden-set gate chưa đạt; không thể promote weights');
    return withTenantContext(tenantId, async client => {
      const candidate = (await client.query(`SELECT * FROM agent_weight_versions WHERE tenant_id=$1 AND id=$2 AND status='draft'`, [tenantId, id])).rows[0];
      if (!candidate) return null;
      await client.query(`UPDATE agent_weight_versions SET status='shadow' WHERE tenant_id=$1 AND status='live'`, [tenantId]);
      const promoted = (await client.query(
        `UPDATE agent_weight_versions SET status='live',metrics=$3,created_by=$4 WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [tenantId, id, JSON.stringify({ ...metrics, goldenSetPassed: true }), operatorId],
      )).rows[0];
      await client.query(
        `INSERT INTO ai_learning_audit_events (tenant_id,event_type,entity_type,entity_id,reason,metrics_json)
         VALUES ($1,'WEIGHTS_PROMOTED','MATCHER_WEIGHTS',$2,'golden_set_gate_and_admin_approval',$3::jsonb)`,
        [tenantId, id, JSON.stringify({ ...metrics, operatorId })],
      );
      return promoted;
    });
  },

  fingerprint,
};

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}