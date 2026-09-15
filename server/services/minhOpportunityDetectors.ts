import { randomUUID } from 'node:crypto';
import { withTenantContext } from '../db';
import { logger } from '../middleware/logger';

export const PROACTIVE_OPPORTUNITY_SIGNAL = 'proactive_opportunity';

export type OpportunityKind = 'COLD_LEAD' | 'MARKET_PRICE_DRIFT' | 'CSAT_DROP';

export type ProactiveOpportunity = {
  kind: OpportunityKind;
  subjectType: 'lead' | 'listing' | 'tenant';
  subjectId: string;
  priority: number;
  confidence: number;
  title: string;
  rationale: string;
  suggestedNextStep: string;
  evidence: Record<string, unknown>;
};

export type OpportunityDetectorConfig = {
  coldLeadDays: number;
  minLeadScore: number;
  marketDeviationPct: number;
  csatCurrentDays: number;
  csatBaselineDays: number;
  minCsatSamples: number;
  minBaselineSamples: number;
  minCsatDrop: number;
  maxOpportunitiesPerDetector: number;
};

export const DEFAULT_OPPORTUNITY_DETECTOR_CONFIG: OpportunityDetectorConfig = {
  coldLeadDays: 3,
  minLeadScore: 70,
  marketDeviationPct: 0.2,
  csatCurrentDays: 7,
  csatBaselineDays: 30,
  minCsatSamples: 3,
  minBaselineSamples: 3,
  minCsatDrop: 0.7,
  maxOpportunitiesPerDetector: 50,
};

export type ColdLeadRow = {
  id: string;
  stage?: string | null;
  score?: unknown;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastInteractionAt?: string | Date | null;
  outboundInteractions?: number | string | null;
};

export type MarketListingRow = {
  id: string;
  title?: string | null;
  price?: number | string | null;
  area?: number | string | null;
  location?: string | null;
  address?: string | null;
  type?: string | null;
};

export type MarketReferenceRow = {
  locationKey: string;
  locationDisplay?: string | null;
  pricePerM2: number | string;
  confidence?: number | string | null;
  source?: string | null;
  recordedAt?: string | Date | null;
};

type NormalizedMarketReference = {
  reference: MarketReferenceRow;
  key: string;
};

export type CsatRow = {
  payload: unknown;
  createdAt: string | number | Date;
};

const TERMINAL_LEAD_STAGES = new Set(['WON', 'LOST', 'CLOSED', 'CONVERTED', 'ARCHIVED']);

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : typeof value === 'number'
      ? new Date(value)
      : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysSince(value: unknown, now: Date): number | null {
  const date = asDate(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function leadScore(value: unknown): number | null {
  const data = parseJsonObject(value);
  return numeric(data?.score ?? data?.value ?? data?.leadScore ?? value);
}

function scoreConfidence(score: number): number {
  return Number(Math.min(0.98, Math.max(0.7, 0.7 + (score - 70) / 300)).toFixed(3));
}

function normalizeLocationKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function marketMatch(
  location: string,
  references: readonly NormalizedMarketReference[],
  exactIndex: ReadonlyMap<string, NormalizedMarketReference>,
): { reference: MarketReferenceRow; similarity: number } | null {
  const listingKey = normalizeLocationKey(location);
  if (listingKey.length < 8) return null;
  const exact = exactIndex.get(listingKey);
  if (exact) return { reference: exact.reference, similarity: 1 };
  const matches = references
    .map(reference => {
      const referenceKey = reference.key;
      if (!referenceKey) return null;
      const similarity = referenceKey === listingKey
        ? 1
        : referenceKey.length >= 8 && ` ${listingKey} `.includes(` ${referenceKey} `)
          ? 0.9
          : listingKey.length >= 8 && ` ${referenceKey} `.includes(` ${listingKey} `)
            ? 0.8
            : 0;
      return similarity > 0 ? { reference: reference.reference, similarity } : null;
    })
    .filter((match): match is { reference: MarketReferenceRow; similarity: number } => Boolean(match))
    .sort((a, b) => b.similarity - a.similarity
      || Number(b.reference.confidence || 0) - Number(a.reference.confidence || 0)
      || new Date(String(b.reference.recordedAt || 0)).getTime() - new Date(String(a.reference.recordedAt || 0)).getTime());
  return matches[0] || null;
}

function csatScore(payload: unknown): number | null {
  const data = parseJsonObject(payload);
  const candidate = data?.score ?? data?.rating ?? data?.csat ?? data?.value;
  const score = numeric(candidate);
  return score !== null && score >= 1 && score <= 5 ? score : null;
}

export function detectColdLeads(
  rows: readonly ColdLeadRow[],
  now = new Date(),
  config: OpportunityDetectorConfig = DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
): ProactiveOpportunity[] {
  return rows
    .map(row => {
      const score = leadScore(row.score);
      const inactiveDays = daysSince(row.lastInteractionAt || row.updatedAt || row.createdAt, now);
      if (
        !row.id
        || score === null
        || score < config.minLeadScore
        || inactiveDays === null
        || inactiveDays < config.coldLeadDays
        || TERMINAL_LEAD_STAGES.has(String(row.stage || '').toUpperCase())
      ) return null;
      const priority = clamp(55 + (score - config.minLeadScore) * 0.65 + (inactiveDays - config.coldLeadDays) * 6);
      return {
        kind: 'COLD_LEAD' as const,
        subjectType: 'lead' as const,
        subjectId: String(row.id),
        priority,
        confidence: scoreConfidence(score),
        title: 'Lead tiềm năng đang nguội',
        rationale: `Lead có điểm ${score} nhưng chưa có tương tác trong ${Math.floor(inactiveDays)} ngày.`,
        suggestedNextStep: 'Xem lại ngữ cảnh lead và soạn follow-up để admin cân nhắc.',
        evidence: {
          detector: 'cold_lead',
          score,
          inactiveDays: Number(inactiveDays.toFixed(1)),
          lastInteractionAt: asDate(row.lastInteractionAt || row.updatedAt || row.createdAt)?.toISOString() || null,
          outboundInteractions: numeric(row.outboundInteractions) ?? 0,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, config.maxOpportunitiesPerDetector);
}

export function detectMarketPriceDrift(
  listings: readonly MarketListingRow[],
  references: readonly MarketReferenceRow[],
  config: OpportunityDetectorConfig = DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
): ProactiveOpportunity[] {
  const normalizedReferences = references.map(reference => ({
    reference,
    key: normalizeLocationKey(reference.locationKey),
  }));
  const exactReferenceIndex = new Map(
    normalizedReferences
      .filter(reference => reference.key.length >= 8)
      .map(reference => [reference.key, reference]),
  );
  return listings
    .map(listing => {
      const price = numeric(listing.price);
      const area = numeric(listing.area);
      const location = String(listing.location || listing.address || '').trim();
      const match = marketMatch(location, normalizedReferences, exactReferenceIndex);
      if (!listing.id || price === null || area === null || price <= 0 || area <= 0 || !match) return null;
      const marketPricePerM2 = numeric(match.reference.pricePerM2);
      if (marketPricePerM2 === null || marketPricePerM2 <= 0) return null;
      const listingPricePerM2 = price / area;
      const deviationPct = (listingPricePerM2 - marketPricePerM2) / marketPricePerM2;
      if (Math.abs(deviationPct) < config.marketDeviationPct) return null;
      const direction = deviationPct > 0 ? 'cao hơn' : 'thấp hơn';
      const confidence = Number(Math.min(
        0.96,
        Math.max(0.65, (Number(match.reference.confidence || 60) / 100) * match.similarity),
      ).toFixed(3));
      return {
        kind: 'MARKET_PRICE_DRIFT' as const,
        subjectType: 'listing' as const,
        subjectId: String(listing.id),
        priority: clamp(55 + Math.abs(deviationPct) * 100),
        confidence,
        title: 'Giá niêm yết lệch tham chiếu thị trường',
        rationale: `Giá niêm yết ${direction} ${Math.round(Math.abs(deviationPct) * 100)}% so với tham chiếu cùng khu vực.`,
        suggestedNextStep: 'Kiểm tra lại dữ liệu định giá và nội dung listing trước khi đề xuất thay đổi.',
        evidence: {
          detector: 'market_price_drift',
          listingPricePerM2: Math.round(listingPricePerM2),
          marketPricePerM2: Math.round(marketPricePerM2),
          deviationPct: Number(deviationPct.toFixed(4)),
          location: location.slice(0, 160),
          marketLocation: match.reference.locationDisplay || match.reference.locationKey,
          marketSource: match.reference.source || 'unknown',
          marketConfidence: Number(match.reference.confidence || 0),
          locationSimilarity: match.similarity,
          observedAt: asDate(match.reference.recordedAt)?.toISOString() || null,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, config.maxOpportunitiesPerDetector);
}

export function detectCsatDrop(
  rows: readonly CsatRow[],
  now = new Date(),
  config: OpportunityDetectorConfig = DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
): ProactiveOpportunity[] {
  const currentCutoff = now.getTime() - config.csatCurrentDays * 86_400_000;
  const baselineCutoff = currentCutoff - config.csatBaselineDays * 86_400_000;
  const currentScores: number[] = [];
  const baselineScores: number[] = [];
  for (const row of rows) {
    const createdAt = asDate(row.createdAt)?.getTime();
    const score = csatScore(row.payload);
    if (createdAt === undefined || createdAt === null || score === null) continue;
    if (createdAt >= currentCutoff && createdAt <= now.getTime()) currentScores.push(score);
    else if (createdAt >= baselineCutoff && createdAt < currentCutoff) baselineScores.push(score);
  }
  if (
    currentScores.length < config.minCsatSamples
    || baselineScores.length < config.minBaselineSamples
  ) return [];
  const currentAverage = currentScores.reduce((sum, value) => sum + value, 0) / currentScores.length;
  const baselineAverage = baselineScores.reduce((sum, value) => sum + value, 0) / baselineScores.length;
  const drop = baselineAverage - currentAverage;
  if (drop < config.minCsatDrop) return [];
  return [{
    kind: 'CSAT_DROP',
    subjectType: 'tenant',
    subjectId: '__tenant__',
    priority: clamp(60 + drop * 20 + Math.max(0, currentScores.length - config.minCsatSamples) * 2),
    confidence: Number(Math.min(0.95, 0.65 + Math.min(0.3, baselineScores.length / 100)).toFixed(3)),
    title: 'CSAT giảm bất thường',
    rationale: `CSAT ${config.csatCurrentDays} ngày gần nhất giảm ${drop.toFixed(2)} điểm so với giai đoạn nền.`,
    suggestedNextStep: 'Xem nhóm lý do CSAT thấp trong Command Center và xác minh mẫu hội thoại.',
    evidence: {
      detector: 'csat_drop',
      currentAverage: Number(currentAverage.toFixed(2)),
      baselineAverage: Number(baselineAverage.toFixed(2)),
      drop: Number(drop.toFixed(2)),
      currentSamples: currentScores.length,
      baselineSamples: baselineScores.length,
      currentWindowDays: config.csatCurrentDays,
      baselineWindowDays: config.csatBaselineDays,
    },
  }];
}

type DetectorRunResult = {
  detector: string;
  status: 'OBSERVED' | 'DEGRADED';
  found: number;
  persisted: number;
  error?: string;
};

export type MinhOpportunityDetectorRun = DetectorRunResult;

function observationDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function persistOpportunities(
  client: any,
  tenantId: string,
  opportunities: readonly ProactiveOpportunity[],
  now: Date,
  traceId: string,
): Promise<number> {
  let persisted = 0;
  for (const opportunity of opportunities) {
    const payload = {
      schemaVersion: 1,
      kind: opportunity.kind,
      priority: opportunity.priority,
      confidence: opportunity.confidence,
      title: opportunity.title,
      rationale: opportunity.rationale,
      suggestedNextStep: opportunity.suggestedNextStep,
      evidence: opportunity.evidence,
      permission: 'READ',
      actionCreated: false,
      observedAt: now.toISOString(),
      traceId,
    };
    const dedupeKey = [
      'proactive-opportunity',
      opportunity.kind,
      opportunity.subjectType,
      opportunity.subjectId,
      observationDate(now),
    ].join(':').slice(0, 240);
    const result = await client.query(
      `INSERT INTO agent_signals
         (id, tenant_id, signal_type, actor_id, subject_type, subject_id, payload, dedupe_key, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        tenantId,
        PROACTIVE_OPPORTUNITY_SIGNAL,
        'MINH',
        opportunity.subjectType,
        opportunity.subjectId,
        JSON.stringify(payload),
        dedupeKey,
        'minh_week_2_read_only_detector',
      ],
    );
    if (!result.rows[0]) continue;
    await client.query(
      `INSERT INTO ai_learning_audit_events
         (tenant_id, event_type, entity_type, entity_id, reason, metrics_json, trace_id)
       VALUES ($1,'PROACTIVE_OPPORTUNITY_RECORDED','AGENT_SIGNAL',$2,$3,$4::jsonb,$5)`,
      [
        tenantId,
        result.rows[0].id,
        `detector:${opportunity.kind}`,
        JSON.stringify({
          detector: opportunity.kind,
          subjectType: opportunity.subjectType,
          subjectId: opportunity.subjectId,
          priority: opportunity.priority,
          confidence: opportunity.confidence,
          permission: 'READ',
        }),
        traceId,
      ],
    );
    persisted++;
  }
  return persisted;
}

export async function runMinhOpportunityDetectors(
  tenantId: string,
  now = new Date(),
  config: OpportunityDetectorConfig = DEFAULT_OPPORTUNITY_DETECTOR_CONFIG,
  traceId: string = randomUUID(),
): Promise<DetectorRunResult[]> {
  return withTenantContext(tenantId, async client => {
    const results: DetectorRunResult[] = [];

    try {
      const leads = await client.query(
        `SELECT l.id::text, l.stage, l.score::text, l.created_at, l.updated_at,
                MAX(i.timestamp) AS last_interaction_at,
                COUNT(i.id) FILTER (WHERE UPPER(COALESCE(i.direction,''))='OUTBOUND')::int AS outbound_interactions
           FROM leads l
           LEFT JOIN interactions i
             ON i.tenant_id=l.tenant_id AND i.lead_id=l.id
          WHERE l.tenant_id=$1
            AND COALESCE(l.care_status,'ACTIVE') <> 'INACTIVE'
          GROUP BY l.id, l.stage, l.score, l.created_at, l.updated_at
          ORDER BY l.updated_at ASC
          LIMIT 1000`,
        [tenantId],
      );
      const opportunities = detectColdLeads(leads.rows.map((row: any) => ({
        id: row.id,
        stage: row.stage,
        score: row.score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastInteractionAt: row.last_interaction_at,
        outboundInteractions: row.outbound_interactions,
      })), now, config);
      results.push({
        detector: 'cold_lead',
        status: 'OBSERVED',
        found: opportunities.length,
        persisted: await persistOpportunities(client, tenantId, opportunities, now, traceId),
      });
    } catch (error: any) {
      logger.warn(`[MinhOpportunity] cold_lead degraded tenant=${tenantId}: ${error?.message || error}`);
      results.push({ detector: 'cold_lead', status: 'DEGRADED', found: 0, persisted: 0, error: 'QUERY_FAILED' });
    }

    try {
      const [listings, references] = await Promise.all([
        client.query(
          `SELECT id::text, title, price, area, location, address, type
             FROM listings
            WHERE tenant_id=$1
              AND status NOT IN ('SOLD','RENTED','INACTIVE')
              AND price IS NOT NULL AND price > 0
              AND area IS NOT NULL AND area > 0
            ORDER BY updated_at DESC
            LIMIT 150`,
          [tenantId],
        ),
        client.query(
          `SELECT location_key, location_display, price_per_m2, confidence, source, recorded_at
             FROM market_price_history
            WHERE recorded_at > NOW() - INTERVAL '180 days'
           UNION ALL
           SELECT location_key, location_display, calibrated_price_per_m2 AS price_per_m2,
                  confidence_score AS confidence, 'avm_calibration' AS source,
                  last_calibrated_at AS recorded_at
             FROM avm_calibration
            WHERE last_calibrated_at > NOW() - INTERVAL '180 days'
            ORDER BY recorded_at DESC
            LIMIT 300`,
        ),
      ]);
      const opportunities = detectMarketPriceDrift(
        listings.rows.map((row: any) => row),
        references.rows.map((row: any) => ({
          locationKey: row.location_key,
          locationDisplay: row.location_display,
          pricePerM2: row.price_per_m2,
          confidence: row.confidence,
          source: row.source,
          recordedAt: row.recorded_at,
        })),
        config,
      );
      results.push({
        detector: 'market_price_drift',
        status: 'OBSERVED',
        found: opportunities.length,
        persisted: await persistOpportunities(client, tenantId, opportunities, now, traceId),
      });
    } catch (error: any) {
      logger.warn(`[MinhOpportunity] market_price_drift degraded tenant=${tenantId}: ${error?.message || error}`);
      results.push({ detector: 'market_price_drift', status: 'DEGRADED', found: 0, persisted: 0, error: 'QUERY_FAILED' });
    }

    try {
      const csat = await client.query(
        `SELECT payload, created_at
           FROM agent_signals
          WHERE tenant_id=$1
            AND signal_type='support_csat'
            AND created_at > NOW() - INTERVAL '60 days'
          ORDER BY created_at DESC
          LIMIT 1000`,
        [tenantId],
      );
      const opportunities = detectCsatDrop(
        csat.rows.map((row: any) => ({ payload: row.payload, createdAt: row.created_at })),
        now,
        config,
      ).map(opportunity => ({ ...opportunity, subjectId: tenantId }));
      results.push({
        detector: 'csat_drop',
        status: 'OBSERVED',
        found: opportunities.length,
        persisted: await persistOpportunities(client, tenantId, opportunities, now, traceId),
      });
    } catch (error: any) {
      logger.warn(`[MinhOpportunity] csat_drop degraded tenant=${tenantId}: ${error?.message || error}`);
      results.push({ detector: 'csat_drop', status: 'DEGRADED', found: 0, persisted: 0, error: 'QUERY_FAILED' });
    }

    return results;
  });
}

export async function listMinhOpportunities(
  tenantId: string,
  limit = 100,
): Promise<Array<Record<string, unknown>>> {
  return withTenantContext(tenantId, async client => {
    const result = await client.query(
      `SELECT id, subject_type, subject_id, payload, created_at
         FROM agent_signals
        WHERE tenant_id=$1 AND signal_type=$2
        ORDER BY created_at DESC
        LIMIT $3`,
      [tenantId, PROACTIVE_OPPORTUNITY_SIGNAL, Math.max(1, Math.min(200, Number(limit) || 100))],
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      createdAt: row.created_at,
      ...(parseJsonObject(row.payload) || { payload: row.payload }),
    }));
  });
}