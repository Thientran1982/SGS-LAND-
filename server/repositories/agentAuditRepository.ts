import { withTenantContext } from '../db';
import { randomUUID } from 'crypto';

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

export type ProviderHealthFilters = {
  from?: string;
  to?: string;
};

export type ProviderHealthSummary = {
  range: { from: string; to: string };
  summary: {
    totalRequests: number;
    fallbackRequests: number;
    degradedRequests: number;
    exhaustedRequests: number;
    fallbackRate: number;
    p95LatencyMs: number | null;
  };
  providers: Array<{
    provider: string;
    attempts: number;
    successes: number;
    failures: number;
    skipped: number;
    fallbackSuccesses: number;
    avgLatencyMs: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    errorsByStatus: Record<string, number>;
  }>;
  alerts: {
    allFallbackProvidersFailed: boolean;
    exhaustedRequests: number;
  };
};

export type LandingClassificationHealth = {
  range: { from: string; to: string };
  summary: {
    totalRequests: number;
    detectedRequests: number;
    candidateRequests: number;
    candidateDetectedRequests: number;
    draftCreated: number;
    draftFailures: number;
    falseNegatives: number;
    falsePositives: number;
    detectionRate: number;
  };
  byLanguage: Array<{
    language: string;
    totalRequests: number;
    detectedRequests: number;
    candidateRequests: number;
    draftCreated: number;
    falseNegatives: number;
    falsePositives: number;
  }>;
};

export const LANDING_CLASSIFICATION_REVIEW_LABELS = [
  'CONFIRMED_FALSE_NEGATIVE',
  'CONFIRMED_FALSE_POSITIVE',
  'NOT_AN_ERROR',
] as const;

export type LandingClassificationReviewLabel = typeof LANDING_CLASSIFICATION_REVIEW_LABELS[number];

export type LandingClassificationReview = {
  auditEventId: string;
  createdAt: string;
  runId: string | null;
  language: string;
  suspectedType: 'FALSE_NEGATIVE' | 'FALSE_POSITIVE';
  detected: boolean;
  candidate: boolean;
  initialIntent: string;
  finalIntent: string;
  draftStatus: string;
  reviewLabel: LandingClassificationReviewLabel | null;
  reviewerId: string | null;
  reviewedAt: string | null;
};

export type LandingClassificationReviewFilters = {
  from?: string;
  to?: string;
  language?: string;
  status?: 'pending' | 'reviewed' | 'all';
  label?: LandingClassificationReviewLabel;
  limit?: number;
  offset?: number;
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

  async recordProviderFallbackChange(
    tenantId: string,
    data: {
      actorId?: string;
      actorRole?: string;
      previous: Record<string, any>;
      next: Record<string, any>;
    },
  ): Promise<void> {
    await this.record(tenantId, {
      eventKey: `provider-fallback-config:${randomUUID()}`,
      eventType: 'ENTITY_OBSERVED',
      status: 'UPDATED',
      entityType: 'AI_PROVIDER_FALLBACK_CONFIG',
      entityId: tenantId,
      input: { previous: data.previous },
      output: { next: data.next },
      metadata: {
        source: 'ai-governance',
        actorId: data.actorId || null,
        actorRole: data.actorRole || null,
      },
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

  /**
   * Aggregate provider telemetry from sanitized outbound audit metadata.
   * This intentionally returns counts and latency only; prompt/response JSON
   * never leaves the database query.
   */
  async providerHealth(tenantId: string, filters: ProviderHealthFilters = {}): Promise<ProviderHealthSummary> {
    const to = filters.to || new Date().toISOString();
    const from = filters.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    return withTenantContext(tenantId, async client => {
      const baseCte = `
        WITH outbound AS (
          SELECT id, status, metadata_json, created_at
          FROM agent_audit_events
          WHERE tenant_id = $1
            AND event_type = 'CHAT_MESSAGE'
            AND direction = 'OUTBOUND'
            AND created_at >= $2::timestamptz
            AND created_at <= $3::timestamptz
        ),
        attempts AS (
          SELECT
            o.id,
            o.status AS request_status,
            a.value,
            a.ordinality,
            NULLIF(a.value->>'provider', '') AS provider,
            a.value->>'outcome' AS outcome,
            NULLIF(a.value->>'status', '') AS attempt_status,
            CASE
              WHEN (a.value->>'latencyMs') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (a.value->>'latencyMs')::numeric
              ELSE NULL
            END AS latency_ms
          FROM outbound o
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(o.metadata_json->'aiProviderAttempts') = 'array'
              THEN o.metadata_json->'aiProviderAttempts'
              ELSE '[]'::jsonb
            END
          ) WITH ORDINALITY AS a(value, ordinality)
        )
      `;

      const [summaryResult, providerResult] = await Promise.all([
        client.query(
          `${baseCte}
           SELECT
             (SELECT COUNT(*)::int FROM outbound) AS total_requests,
             (SELECT COUNT(*)::int FROM outbound
                WHERE metadata_json->>'aiFallbackUsed' = 'true') AS fallback_requests,
             (SELECT COUNT(*)::int FROM outbound WHERE status = 'DEGRADED') AS degraded_requests,
             (SELECT COUNT(*)::int FROM outbound o
                WHERE o.status = 'DEGRADED'
                  AND NOT EXISTS (
                    SELECT 1 FROM attempts a
                    WHERE a.id = o.id AND a.outcome = 'success'
                  )) AS exhausted_requests,
             (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
                FROM attempts WHERE latency_ms IS NOT NULL) AS p95_latency_ms`,
          [tenantId, from, to],
        ),
        client.query(
          `${baseCte}
           SELECT
             provider,
             COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE outcome = 'success')::int AS successes,
             COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failures,
             COUNT(*) FILTER (WHERE outcome = 'skipped')::int AS skipped,
             COUNT(*) FILTER (WHERE outcome = 'success' AND ordinality > 1)::int AS fallback_successes,
             ROUND(AVG(latency_ms))::int AS avg_latency_ms,
             percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
             COALESCE(
               (SELECT jsonb_object_agg(status_counts.status_key, status_counts.total)
                FROM (
                  SELECT COALESCE(attempt_status, 'unknown') AS status_key, COUNT(*)::int AS total
                  FROM attempts failed_attempts
                  WHERE failed_attempts.provider = attempts.provider
                    AND failed_attempts.outcome = 'failed'
                  GROUP BY COALESCE(attempt_status, 'unknown')
                ) status_counts),
               '{}'::jsonb
             ) AS errors_by_status
           FROM attempts
           WHERE provider IS NOT NULL
           GROUP BY provider
           ORDER BY failures DESC, attempts DESC, provider ASC`,
          [tenantId, from, to],
        ),
      ]);

      const rawSummary = summaryResult.rows[0] || {};
      const totalRequests = Number(rawSummary.total_requests || 0);
      const fallbackRequests = Number(rawSummary.fallback_requests || 0);
      const exhaustedRequests = Number(rawSummary.exhausted_requests || 0);
      const providers = providerResult.rows.map(row => ({
        provider: String(row.provider),
        attempts: Number(row.attempts || 0),
        successes: Number(row.successes || 0),
        failures: Number(row.failures || 0),
        skipped: Number(row.skipped || 0),
        fallbackSuccesses: Number(row.fallback_successes || 0),
        avgLatencyMs: row.avg_latency_ms == null ? null : Number(row.avg_latency_ms),
        p50LatencyMs: row.p50_latency_ms == null ? null : Math.round(Number(row.p50_latency_ms)),
        p95LatencyMs: row.p95_latency_ms == null ? null : Math.round(Number(row.p95_latency_ms)),
        errorsByStatus: row.errors_by_status && typeof row.errors_by_status === 'object'
          ? Object.fromEntries(Object.entries(row.errors_by_status).map(([key, value]) => [key, Number(value || 0)]))
          : {},
      }));

      return {
        range: { from, to },
        summary: {
          totalRequests,
          fallbackRequests,
          degradedRequests: Number(rawSummary.degraded_requests || 0),
          exhaustedRequests,
          fallbackRate: totalRequests ? Math.round((fallbackRequests / totalRequests) * 10000) / 100 : 0,
          p95LatencyMs: rawSummary.p95_latency_ms == null ? null : Math.round(Number(rawSummary.p95_latency_ms)),
        },
        providers,
        alerts: {
          allFallbackProvidersFailed: exhaustedRequests > 0,
          exhaustedRequests,
        },
      };
    });
  }

  /**
   * Aggregate the privacy-safe LANDING_CLASSIFICATION events. The query only
   * reads booleans/categories written by the live-chat telemetry writer.
   */
  async landingClassificationHealth(
    tenantId: string,
    filters: ProviderHealthFilters = {},
  ): Promise<LandingClassificationHealth> {
    const to = filters.to || new Date().toISOString();
    const from = filters.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    return withTenantContext(tenantId, async client => {
      const where = `
        FROM agent_audit_events
        WHERE tenant_id = $1
          AND entity_type = 'LANDING_CLASSIFICATION'
          AND created_at >= $2
          AND created_at <= $3`;
      const values = [tenantId, from, to];
      const [summaryResult, languageResult] = await Promise.all([
        client.query(
          `SELECT
             COUNT(*)::int AS total_requests,
             COUNT(*) FILTER (WHERE output_json->>'detected' = 'true')::int AS detected_requests,
             COUNT(*) FILTER (WHERE output_json->>'candidate' = 'true')::int AS candidate_requests,
             COUNT(*) FILTER (WHERE output_json->>'candidate' = 'true'
                               AND output_json->>'detected' = 'true')::int AS candidate_detected_requests,
             COUNT(*) FILTER (WHERE output_json->>'draftCreated' = 'true')::int AS draft_created,
             COUNT(*) FILTER (WHERE output_json->>'candidate' = 'true'
                               AND output_json->>'draftStatus' IN ('ERROR', 'RETURNED'))::int AS draft_failures,
             COUNT(*) FILTER (WHERE output_json->>'falseNegative' = 'true')::int AS false_negatives,
             COUNT(*) FILTER (WHERE output_json->>'falsePositive' = 'true')::int AS false_positives
           ${where}`,
          values,
        ),
        client.query(
          `SELECT
             COALESCE(NULLIF(output_json->>'language', ''), 'unknown') AS language,
             COUNT(*)::int AS total_requests,
             COUNT(*) FILTER (WHERE output_json->>'detected' = 'true')::int AS detected_requests,
             COUNT(*) FILTER (WHERE output_json->>'candidate' = 'true')::int AS candidate_requests,
             COUNT(*) FILTER (WHERE output_json->>'draftCreated' = 'true')::int AS draft_created,
             COUNT(*) FILTER (WHERE output_json->>'falseNegative' = 'true')::int AS false_negatives,
             COUNT(*) FILTER (WHERE output_json->>'falsePositive' = 'true')::int AS false_positives
           ${where}
           GROUP BY 1
           ORDER BY total_requests DESC, language ASC`,
          values,
        ),
      ]);

      const row = summaryResult.rows[0] || {};
      const totalRequests = Number(row.total_requests || 0);
      return {
        range: { from, to },
        summary: {
          totalRequests,
          detectedRequests: Number(row.detected_requests || 0),
          candidateRequests: Number(row.candidate_requests || 0),
          candidateDetectedRequests: Number(row.candidate_detected_requests || 0),
          draftCreated: Number(row.draft_created || 0),
          draftFailures: Number(row.draft_failures || 0),
          falseNegatives: Number(row.false_negatives || 0),
          falsePositives: Number(row.false_positives || 0),
          detectionRate: Number(row.candidate_requests || 0)
            ? Math.round((Number(row.candidate_detected_requests || 0) / Number(row.candidate_requests || 0)) * 10000) / 100
            : 0,
        },
        byLanguage: languageResult.rows.map(language => ({
          language: String(language.language),
          totalRequests: Number(language.total_requests || 0),
          detectedRequests: Number(language.detected_requests || 0),
          candidateRequests: Number(language.candidate_requests || 0),
          draftCreated: Number(language.draft_created || 0),
          falseNegatives: Number(language.false_negatives || 0),
          falsePositives: Number(language.false_positives || 0),
        })),
      };
    });
  }

  /**
   * Return only bounded classifier features for human review. Do not select
   * input_json, output_json, metadata_json, lead/session identifiers, or the
   * event key: older audit rows must not accidentally expose a brief or answer.
   */
  async listLandingClassificationReviews(
    tenantId: string,
    filters: LandingClassificationReviewFilters = {},
  ): Promise<{ reviews: LandingClassificationReview[]; total: number }> {
    const to = filters.to || new Date().toISOString();
    const from = filters.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const status = filters.status || 'pending';
    const where = [
      'e.tenant_id = $1',
      `e.entity_type = 'LANDING_CLASSIFICATION'`,
      `e.created_at >= $2`,
      `e.created_at <= $3`,
      `(e.output_json->>'falseNegative' = 'true' OR e.output_json->>'falsePositive' = 'true')`,
    ];
    const values: any[] = [tenantId, from, to];
    const add = (sql: string, value: any) => {
      values.push(value);
      where.push(sql.replace('?', `$${values.length}`));
    };
    if (filters.language) add(`COALESCE(NULLIF(e.output_json->>'language', ''), 'unknown') = ?`, filters.language);
    if (status === 'pending') where.push('r.id IS NULL');
    if (status === 'reviewed') where.push('r.id IS NOT NULL');
    if (filters.label) add('r.label = ?', filters.label);

    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    const base = `
      FROM agent_audit_events e
      LEFT JOIN landing_classification_reviews r
        ON r.tenant_id = e.tenant_id AND r.audit_event_id = e.id
      WHERE ${where.join(' AND ')}`;
    const projection = `
      e.id AS audit_event_id,
      e.created_at,
      e.run_id,
      COALESCE(NULLIF(e.output_json->>'language', ''), 'unknown') AS language,
      CASE WHEN e.output_json->>'falseNegative' = 'true'
        THEN 'FALSE_NEGATIVE' ELSE 'FALSE_POSITIVE' END AS suspected_type,
      e.output_json->>'detected' = 'true' AS detected,
      e.output_json->>'candidate' = 'true' AS candidate,
      COALESCE(e.output_json->>'initialIntent', 'UNKNOWN') AS initial_intent,
      COALESCE(e.output_json->>'finalIntent', 'UNKNOWN') AS final_intent,
      COALESCE(e.output_json->>'draftStatus', 'NOT_ATTEMPTED') AS draft_status,
      r.label AS review_label,
      r.reviewer_id,
      r.reviewed_at`;

    return withTenantContext(tenantId, async client => {
      const [rows, count] = await Promise.all([
        client.query(
          `SELECT ${projection} ${base} ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
          values,
        ),
        client.query(`SELECT COUNT(*)::int AS total ${base}`, values),
      ]);
      return {
        reviews: rows.rows.map(row => ({
          auditEventId: String(row.audit_event_id),
          createdAt: new Date(row.created_at).toISOString(),
          runId: row.run_id ? String(row.run_id) : null,
          language: String(row.language || 'unknown'),
          suspectedType: row.suspected_type === 'FALSE_NEGATIVE' ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE',
          detected: row.detected === true,
          candidate: row.candidate === true,
          initialIntent: String(row.initial_intent || 'UNKNOWN'),
          finalIntent: String(row.final_intent || 'UNKNOWN'),
          draftStatus: String(row.draft_status || 'NOT_ATTEMPTED'),
          reviewLabel: row.review_label
            ? String(row.review_label) as LandingClassificationReviewLabel
            : null,
          reviewerId: row.reviewer_id ? String(row.reviewer_id) : null,
          reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
        })),
        total: Number(count.rows[0]?.total || 0),
      };
    });
  }

  async reviewLandingClassification(
    tenantId: string,
    auditEventId: string,
    label: LandingClassificationReviewLabel,
    reviewerId: string,
  ): Promise<LandingClassificationReview | null> {
    if (!LANDING_CLASSIFICATION_REVIEW_LABELS.includes(label)) {
      throw new Error('Invalid landing classification review label');
    }
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO landing_classification_reviews
           (tenant_id, audit_event_id, label, reviewer_id, reviewed_at, updated_at)
         SELECT $1, e.id, $3, $4, NOW(), NOW()
           FROM agent_audit_events e
          WHERE e.tenant_id = $1
            AND e.id = $2
            AND e.entity_type = 'LANDING_CLASSIFICATION'
            AND (e.output_json->>'falseNegative' = 'true'
              OR e.output_json->>'falsePositive' = 'true')
         ON CONFLICT (tenant_id, audit_event_id) DO UPDATE
           SET label = EXCLUDED.label,
               reviewer_id = EXCLUDED.reviewer_id,
               reviewed_at = NOW(),
               updated_at = NOW()
         RETURNING audit_event_id, label, reviewer_id, reviewed_at`,
        [tenantId, auditEventId, label, reviewerId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const detail = await client.query(
        `SELECT
           e.id AS audit_event_id,
           e.created_at,
           e.run_id,
           COALESCE(NULLIF(e.output_json->>'language', ''), 'unknown') AS language,
           CASE WHEN e.output_json->>'falseNegative' = 'true'
             THEN 'FALSE_NEGATIVE' ELSE 'FALSE_POSITIVE' END AS suspected_type,
           e.output_json->>'detected' = 'true' AS detected,
           e.output_json->>'candidate' = 'true' AS candidate,
           COALESCE(e.output_json->>'initialIntent', 'UNKNOWN') AS initial_intent,
           COALESCE(e.output_json->>'finalIntent', 'UNKNOWN') AS final_intent,
           COALESCE(e.output_json->>'draftStatus', 'NOT_ATTEMPTED') AS draft_status,
           r.label AS review_label,
           r.reviewer_id,
           r.reviewed_at
          FROM agent_audit_events e
          JOIN landing_classification_reviews r
            ON r.tenant_id = e.tenant_id AND r.audit_event_id = e.id
         WHERE e.tenant_id = $1 AND e.id = $2`,
        [tenantId, auditEventId],
      );
      const reviewed = detail.rows[0];
      if (!reviewed) return null;
      return {
        auditEventId: String(reviewed.audit_event_id),
        createdAt: new Date(reviewed.created_at).toISOString(),
        runId: reviewed.run_id ? String(reviewed.run_id) : null,
        language: String(reviewed.language || 'unknown'),
        suspectedType: reviewed.suspected_type === 'FALSE_NEGATIVE' ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE',
        detected: reviewed.detected === true,
        candidate: reviewed.candidate === true,
        initialIntent: String(reviewed.initial_intent || 'UNKNOWN'),
        finalIntent: String(reviewed.final_intent || 'UNKNOWN'),
        draftStatus: String(reviewed.draft_status || 'NOT_ATTEMPTED'),
        reviewLabel: String(reviewed.review_label) as LandingClassificationReviewLabel,
        reviewerId: reviewed.reviewer_id ? String(reviewed.reviewer_id) : null,
        reviewedAt: reviewed.reviewed_at ? new Date(reviewed.reviewed_at).toISOString() : null,
      };
    });
  }
}

export const agentAuditRepository = new AgentAuditRepository();
