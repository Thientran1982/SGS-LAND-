import { createHash } from 'crypto';
import { pool, withTenantContext } from '../db';
import { agentMemoryService } from './agentMemoryService';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { scrubPii } from './agentMemoryService';

const BUCKETS = [
  { label: '0.0-0.5', min: 0, max: 0.5 },
  { label: '0.5-0.6', min: 0.5, max: 0.6 },
  { label: '0.6-0.7', min: 0.6, max: 0.7 },
  { label: '0.7-0.8', min: 0.7, max: 0.8 },
  { label: '0.8-0.9', min: 0.8, max: 0.9 },
  { label: '0.9-1.0', min: 0.9, max: 1.000001 },
];

function parsePayload(value: unknown): Record<string, any> {
  if (value && typeof value === 'object') return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function bucketFor(confidence: number) {
  return BUCKETS.find(bucket => confidence >= bucket.min && confidence < bucket.max) || BUCKETS[0];
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getMinhCalibrationPromptLine(tenantId: string): Promise<string> {
  try {
    const row = await withTenantContext(tenantId, async client => (await client.query(
      `SELECT metadata_json
         FROM ai_calibration_versions
        WHERE tenant_id=$1 AND location_key='MINH_CONFIDENCE'
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId],
    )).rows[0]);
    const metadata = parsePayload(row?.metadata_json);
    const buckets = Array.isArray(metadata.buckets) ? metadata.buckets : [];
    const candidate = buckets
      .filter((bucket: any) => Number(bucket.total) > 0 && Number.isFinite(Number(bucket.accuracy)))
      .sort((a: any, b: any) => Number(b.total) - Number(a.total))[0];
    if (!candidate) return '';
    return `[CALIBRATION] bucket ${candidate.label} thực tế đúng ${Math.round(Number(candidate.accuracy) * 100)}%`;
  } catch {
    return '';
  }
}

export async function runMinhConfidenceCalibration(tenantId: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT signal_type, subject_id, payload, created_at
       FROM agent_signals
      WHERE tenant_id=$1
        AND signal_type IN ('minh_delegation','minh_delegation_result')
        AND created_at >= $2
      ORDER BY created_at ASC`,
    [tenantId, windowStart],
  )).rows);

  const delegations = rows.filter(row => row.signal_type === 'minh_delegation');
  const results = new Map<string, Record<string, any>>();
  for (const row of rows.filter(row => row.signal_type === 'minh_delegation_result')) {
    const payload = parsePayload(row.payload);
    results.set(String(payload.sessionId || row.subject_id), payload);
  }

  const buckets = BUCKETS.map(bucket => ({
    label: bucket.label,
    confidence: Number(((bucket.min + Math.min(bucket.max, 1)) / 2).toFixed(3)),
    correct: 0,
    total: 0,
    accuracy: null as number | null,
  }));
  let resolved = 0;
  let correct = 0;
  for (const row of delegations) {
    const payload = parsePayload(row.payload);
    const confidence = Math.max(0, Math.min(1, Number(payload.confidence) || 0));
    const result = results.get(String(payload.sessionId || row.subject_id));
    if (!result || typeof result.correct !== 'boolean') continue;
    const bucket = buckets.find(item => item.label === bucketFor(confidence).label)!;
    bucket.total++;
    bucket.correct += result.correct ? 1 : 0;
    resolved++;
    if (result.correct) correct++;
  }
  for (const bucket of buckets) {
    bucket.accuracy = bucket.total ? Number((bucket.correct / bucket.total).toFixed(4)) : null;
  }

  const driftBuckets = buckets
    .filter(bucket => bucket.total > 0 && bucket.accuracy !== null)
    .map(bucket => ({
      ...bucket,
      drift: Number(Math.abs(Number(bucket.accuracy) - bucket.confidence).toFixed(4)),
    }))
    .filter(bucket => bucket.drift > 0.15);
  for (const bucket of driftBuckets) {
    await agentMemoryService.recordSignal(tenantId, {
      signalType: 'calibration_drift',
      subjectType: 'minh_confidence_bucket',
      subjectId: bucket.label,
      dedupeKey: `calibration_drift:${bucket.label}:${toDateOnly(now)}`,
      payload: {
        bucket: bucket.label,
        confidence: bucket.confidence,
        accuracy: bucket.accuracy,
        drift: bucket.drift,
        sampleCount: bucket.total,
      },
      provenance: 'minh_calibration',
    });
  }

  const metrics = {
    kind: 'minh_confidence_calibration',
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    delegationSignals: delegations.length,
    resolvedDelegations: resolved,
    correct,
    accuracy: resolved ? Number((correct / resolved).toFixed(4)) : null,
    buckets,
    driftThreshold: 0.15,
    driftBuckets: driftBuckets.map(bucket => bucket.label),
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(metrics)).digest('hex');
  const version = await withTenantContext(tenantId, async client => {
    const current = await client.query(
      `SELECT COALESCE(MAX(version), 0)::int AS version
         FROM ai_calibration_versions
        WHERE tenant_id=$1 AND location_key='MINH_CONFIDENCE'`,
      [tenantId],
    );
    const nextVersion = Number(current.rows[0]?.version || 0) + 1;
    await client.query(
      `INSERT INTO ai_calibration_versions
        (tenant_id, location_key, version, input_fingerprint, calibrated_price_per_m2,
         sample_count, quality_score, drift_score, poisoning_score, status, metadata_json)
       VALUES ($1,'MINH_CONFIDENCE',$2,$3,0,$4,$5,$6,0,'PENDING',$7::jsonb)
       ON CONFLICT (tenant_id, location_key, version) DO NOTHING`,
      [
        tenantId,
        nextVersion,
        fingerprint,
        resolved,
        resolved ? Number((correct / resolved).toFixed(4)) : 0,
        driftBuckets.length ? Math.max(...driftBuckets.map(bucket => bucket.drift)) : 0,
        JSON.stringify(metrics),
      ],
    );
    return nextVersion;
  });
  return { tenantId, version, metrics, driftSignals: driftBuckets.length };
}

export async function runMinhConfidenceCalibrationForAllTenants() {
  const tenants = (await pool.query(`SELECT id FROM tenants ORDER BY id`)).rows;
  const results = await Promise.allSettled(tenants.map(row => runMinhConfidenceCalibration(String(row.id))));
  return results.map((result, index) => ({
    tenantId: String(tenants[index].id),
    status: result.status,
    value: result.status === 'fulfilled' ? result.value : undefined,
    error: result.status === 'rejected' ? scrubPii(result.reason?.message || result.reason) : undefined,
  }));
}

export async function computeMinhWeeklyKpi(
  tenantId: string,
  periodStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  periodEnd = new Date(),
) {
  const rows = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT signal_type, subject_id, payload
       FROM agent_signals
      WHERE tenant_id=$1
        AND signal_type IN ('minh_delegation','minh_delegation_result')
        AND created_at >= $2::timestamptz
        AND created_at < ($3::timestamptz + INTERVAL '1 day')
      ORDER BY created_at ASC`,
    [tenantId, periodStart, periodEnd],
  )).rows);
  const feedbackRows = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT rating, metadata
       FROM ai_feedback
      WHERE tenant_id=$1
        AND created_at >= $2::timestamptz
        AND created_at < ($3::timestamptz + INTERVAL '1 day')`,
    [tenantId, periodStart, periodEnd],
  )).rows);
  const delegations = rows.filter(row => row.signal_type === 'minh_delegation');
  const resultRows = rows.filter(row => row.signal_type === 'minh_delegation_result');
  const results = resultRows.map(row => parsePayload(row.payload));
  const resolved = results.filter(result => typeof result.correct === 'boolean');
  const latencyValues = results.map(result => Number(result.latencyMs)).filter(value => Number.isFinite(value) && value >= 0);
  const groundedValues = results.filter(result => typeof result.grounded === 'boolean');
  const feedbackMetadata = feedbackRows.map(row => parsePayload(row.metadata));
  const groundedFeedback = feedbackMetadata.filter(metadata => metadata.groundingStatus === 'GROUNDED').length;
  const groundedTotal = groundedValues.length + feedbackMetadata.filter(metadata => metadata.groundingStatus).length;
  const correct = resolved.filter(result => result.correct).length;
  const escalated = results.filter(result => result.escalated === true).length;
  const metrics = {
    delegation_accuracy: resolved.length ? Number((correct / resolved.length).toFixed(4)) : 0,
    latency_avg_ms: latencyValues.length
      ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
      : 0,
    escalation_rate: results.length ? Number((escalated / results.length).toFixed(4)) : 0,
    groundedness: groundedTotal ? Number(((groundedValues.filter(result => result.grounded).length + groundedFeedback) / groundedTotal).toFixed(4)) : 0,
    samples: {
      delegationSignals: delegations.length,
      resolvedDelegations: resolved.length,
      resultSignals: results.length,
      feedbackRows: feedbackRows.length,
      latencySamples: latencyValues.length,
      escalationSamples: results.length,
      groundedSamples: groundedTotal,
    },
    source: 'agent_signals_and_ai_feedback',
  };
  return agentOperatingRepository.upsertWeeklyKpi(tenantId, {
    agentKey: 'MINH',
    periodStart: toDateOnly(periodStart),
    periodEnd: toDateOnly(periodEnd),
    metrics,
  });
}

export async function computeMinhWeeklyKpiForAllTenants() {
  const tenants = (await pool.query(`SELECT id FROM tenants ORDER BY id`)).rows;
  const results = await Promise.allSettled(tenants.map(row => computeMinhWeeklyKpi(String(row.id))));
  return results.map((result, index) => ({
    tenantId: String(tenants[index].id),
    status: result.status,
    value: result.status === 'fulfilled' ? result.value : undefined,
    error: result.status === 'rejected' ? scrubPii(result.reason?.message || result.reason) : undefined,
  }));
}