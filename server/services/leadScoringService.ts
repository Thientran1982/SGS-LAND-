/**
 * leadScoringService.ts
 *
 * Scores leads with the tenant's saved scoring configuration (Customers → Scoring
 * configuration). Each criterion is measured as a 0–100 "fulfilment" from real CRM
 * data, then combined as Σ(weight × fulfilment) ÷ Σweight and graded with the
 * tenant's A/B/C/D thresholds. The pure helpers (computeFactors, scoreWithConfig)
 * have no DB dependency so they can be unit tested; the DB is imported lazily.
 */
import { parseBudget, parseTimeline } from './leadQualificationService';

export type WeightKey = 'engagement' | 'completeness' | 'budgetFit' | 'velocity';
export type Grade = 'A' | 'B' | 'C' | 'D';
export type ScoringWeights = Record<WeightKey, number>;
export type ScoringThresholds = Record<Grade, number>;
export type ScoringConfigInput = { weights?: Partial<ScoringWeights> | null; thresholds?: Partial<ScoringThresholds> | null; version?: number | null };

export const DEFAULT_WEIGHTS: ScoringWeights = { engagement: 15, completeness: 10, budgetFit: 40, velocity: 10 };
export const DEFAULT_THRESHOLDS: ScoringThresholds = { A: 80, B: 60, C: 40, D: 20 };
const KEYS: WeightKey[] = ['engagement', 'completeness', 'budgetFit', 'velocity'];
const LABEL_VN: Record<WeightKey, string> = {
  engagement: 'Mức độ tương tác',
  completeness: 'Độ đầy đủ hồ sơ',
  budgetFit: 'Phù hợp ngân sách',
  velocity: 'Tốc độ phản hồi',
};
const LABEL_EN: Record<WeightKey, string> = {
  engagement: 'Engagement',
  completeness: 'Profile completeness',
  budgetFit: 'Budget fit',
  velocity: 'Response velocity',
};

export type LeadLike = {
  id?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  stage?: string | null;
  notes?: string | null;
  createdAt?: string | Date | null;
  preferences?: {
    budgetMin?: number | null;
    budgetMax?: number | null;
    regions?: string[] | null;
    propertyTypes?: string[] | null;
    timeline?: string | null;
  } | null;
};

type Prefs = NonNullable<LeadLike['preferences']>;

export type LeadSignals = {
  lead: LeadLike;
  /** Latest customer text (new message) plus recent inbound messages. */
  text?: string;
  inboundCount?: number;
  lastInboundAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  /** Listings for sale within the lead's budget; null when not known. */
  matchingListings?: number | null;
  now?: Date;
};

export type Factors = Record<WeightKey, number>;

export type ConfiguredScore = {
  score: number;
  grade: Grade;
  reasoning: string;
  factors: Factors;
  configVersion: number;
};

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

const cap = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function daysSince(value: string | Date | null | undefined, now: Date): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

const PLACEHOLDER_NAME = /^(khach|khach hang|guest|visitor|zalo user|facebook user|nguoi dung)\b/;

/** Budget in VND from preferences, falling back to what the customer wrote. */
export function budgetOf(lead: LeadLike, text = ''): { min: number | null; max: number | null } {
  const p: Prefs = lead.preferences || {};
  const min = Number(p.budgetMin) > 0 ? Number(p.budgetMin) : null;
  let max = Number(p.budgetMax) > 0 ? Number(p.budgetMax) : null;
  if (!min && !max) {
    const parsed = parseBudget(`${text}\n${lead.notes || ''}`);
    if (parsed && parsed > 0) max = parsed;
  }
  return { min, max };
}

/** Measures each criterion as 0–100 from the lead's data. */
export function computeFactors(signals: LeadSignals): Factors {
  const { lead } = signals;
  const now = signals.now || new Date();
  const text = `${signals.text || ''}\n${lead.notes || ''}`;
  const n = normalize(text);
  const prefs: Prefs = lead.preferences || {};
  const stage = String(lead.stage || '').toUpperCase();

  // Engagement: inbound messages plus buying-intent questions.
  const inbound = Math.max(0, Number(signals.inboundCount) || 0);
  let engagement = Math.min(60, inbound * 12);
  if (/(phap ly|so hong|so do|giay to|quy hoach)/.test(n)) engagement += 10;
  if (/(dinh gia|gia bao nhieu|bang gia|gia ban|chinh sach|thanh toan|tra gop|vay)/.test(n)) engagement += 10;
  if (/(xem nha|di xem|dat lich|hen xem|xem thuc te|tham quan)/.test(n)) engagement += 20;
  if (['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].includes(stage)) engagement += 10;

  // Completeness: the details a salesperson needs to act.
  const budget = budgetOf(lead, signals.text);
  const timeline = prefs.timeline || parseTimeline(text);
  let completeness = 0;
  if (lead.phone && String(lead.phone).replace(/\D/g, '').length >= 9) completeness += 25;
  if (lead.email && /@/.test(String(lead.email))) completeness += 15;
  if (budget.min || budget.max) completeness += 20;
  if (prefs.regions && prefs.regions.length) completeness += 15;
  if (prefs.propertyTypes && prefs.propertyTypes.length) completeness += 15;
  const name = normalize(String(lead.name || '').trim());
  if (name.length > 1 && !PLACEHOLDER_NAME.test(name)) completeness += 5;
  if (timeline) completeness += 5;

  // Budget fit: a known budget, and stock that actually matches it.
  let budgetFit = 0;
  if (budget.min || budget.max) {
    budgetFit = 40;
    if (budget.min && budget.max) budgetFit += 10;
    const m = signals.matchingListings;
    if (m == null) budgetFit += 20;
    else if (m >= 5) budgetFit += 50;
    else if (m >= 1) budgetFit += 35;
  }

  // Velocity: how recently the customer engaged and how soon they want to buy.
  const lastSeen = daysSince(signals.lastInboundAt || signals.lastActivityAt || lead.createdAt, now);
  let velocity = lastSeen == null ? 0
    : lastSeen <= 1 ? 50 : lastSeen <= 3 ? 40 : lastSeen <= 7 ? 25 : lastSeen <= 30 ? 10 : 0;
  const tl = String(timeline || '').toUpperCase();
  velocity += tl === 'URGENT' || tl === '1M' ? 30 : tl === '3M' ? 20 : tl === '6M' ? 10 : 0;
  velocity += stage === 'NEGOTIATION' || stage === 'WON' ? 20 : stage === 'PROPOSAL' ? 15 : stage === 'QUALIFIED' ? 10 : 0;
  if (stage === 'LOST') velocity *= 0.3;

  return {
    engagement: cap(engagement),
    completeness: cap(completeness),
    budgetFit: cap(budgetFit),
    velocity: cap(velocity),
  };
}

export function resolveConfig(config?: ScoringConfigInput | null): { weights: ScoringWeights; thresholds: ScoringThresholds; version: number } {
  const weights = { ...DEFAULT_WEIGHTS };
  for (const k of KEYS) {
    const v = Number(config?.weights?.[k]);
    if (Number.isFinite(v) && v >= 0) weights[k] = v;
  }
  if (KEYS.reduce((s, k) => s + weights[k], 0) <= 0) Object.assign(weights, DEFAULT_WEIGHTS);
  const th = { ...DEFAULT_THRESHOLDS, ...(config?.thresholds || {}) } as ScoringThresholds;
  const valid = th.A <= 100 && th.A > th.B && th.B > th.C && th.C > th.D && th.D >= 0;
  return { weights, thresholds: valid ? th : { ...DEFAULT_THRESHOLDS }, version: Number(config?.version) || 1 };
}

export function gradeFor(score: number, th: ScoringThresholds): Grade {
  if (score >= th.A) return 'A';
  if (score >= th.B) return 'B';
  if (score >= th.C) return 'C';
  return 'D';
}

/** Combines factors with the tenant's weights and thresholds. */
export function scoreWithConfig(factors: Factors, config?: ScoringConfigInput | null, lang = 'vn'): ConfiguredScore {
  const { weights, thresholds, version } = resolveConfig(config);
  const total = KEYS.reduce((s, k) => s + weights[k], 0);
  const got = KEYS.reduce((s, k) => s + weights[k] * (factors[k] / 100), 0);
  const score = cap((got / total) * 100);
  const grade = gradeFor(score, thresholds);
  const labels = lang === 'en' ? LABEL_EN : LABEL_VN;
  const used = KEYS.filter(k => weights[k] > 0).sort((a, b) => factors[b] - factors[a]);
  const strong = used.filter(k => factors[k] >= 60).slice(0, 2).map(k => `${labels[k]} ${factors[k]}%`);
  const weak = [...used].reverse().filter(k => factors[k] < 50).slice(0, 2).map(k => `${labels[k]} ${factors[k]}%`);
  const reasoning = lang === 'en'
    ? [`${score}/100, grade ${grade} (scoring configuration v${version}).`, strong.length ? `Strong: ${strong.join(', ')}.` : '', weak.length ? `To improve: ${weak.join(', ')}.` : ''].filter(Boolean).join(' ')
    : [`${score}/100, hạng ${grade} (cấu hình điểm số v${version}).`, strong.length ? `Điểm mạnh: ${strong.join(', ')}.` : '', weak.length ? `Cần bổ sung: ${weak.join(', ')}.` : ''].filter(Boolean).join(' ');
  return { score, grade, reasoning, factors, configVersion: version };
}

// ── DB-backed helpers ───────────────────────────────────────────────────────

const CONFIG_TTL_MS = 60_000;
const configCache = new Map<string, { at: number; config: ScoringConfigInput | null }>();

export function invalidateScoringConfig(tenantId?: string) {
  if (tenantId) configCache.delete(tenantId);
  else configCache.clear();
}

export async function getTenantScoringConfig(tenantId: string): Promise<ScoringConfigInput | null> {
  const hit = configCache.get(tenantId);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.config;
  let config: ScoringConfigInput | null = null;
  try {
    const { scoringConfigRepository } = await import('../repositories/scoringConfigRepository');
    config = await scoringConfigRepository.getByTenant(tenantId);
  } catch {
    config = null; // fall back to defaults; never block scoring on config reads
  }
  configCache.set(tenantId, { at: Date.now(), config });
  return config;
}

const AVAILABLE_LISTING = `status IN ('AVAILABLE', 'OPENING', 'BEST_MARKET')`;

function rowToLead(row: any): LeadLike {
  return {
    id: row.id, name: row.name, phone: row.phone, email: row.email, source: row.source,
    stage: row.stage, notes: row.notes, createdAt: row.created_at, preferences: row.preferences || {},
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scores one lead for a tenant. When the lead has an id, the stored lead, its
 * inbound messages and matching stock are loaded so the score reflects real data.
 */
export async function scoreLeadForTenant(
  tenantId: string,
  leadData: LeadLike,
  messageText = '',
  lang = 'vn',
): Promise<ConfiguredScore> {
  const config = await getTenantScoringConfig(tenantId);
  let lead: LeadLike = { ...leadData };
  let inboundCount = 0;
  let lastInboundAt: Date | null = null;
  let recentText = '';
  let matchingListings: number | null = null;
  if (UUID_RE.test(tenantId)) {
    try {
      const { withTenantContext } = await import('../db');
      await withTenantContext(tenantId, async (client) => {
        if (lead.id && UUID_RE.test(lead.id)) {
          const stored = await client.query('SELECT * FROM leads WHERE id = $1 LIMIT 1', [lead.id]);
          if (stored.rows[0]) {
            const base = rowToLead(stored.rows[0]);
            lead = { ...base, ...Object.fromEntries(Object.entries(leadData).filter(([, v]) => v != null && v !== '')), preferences: { ...(base.preferences || {}), ...(leadData.preferences || {}) } };
          }
          const stats = await client.query(
            `SELECT count(*)::int AS inbound, max(timestamp) AS last_at,
                    string_agg(left(content, 400), E'\n') FILTER (WHERE rn <= 20) AS recent
               FROM (SELECT content, timestamp, row_number() OVER (ORDER BY timestamp DESC) AS rn
                       FROM interactions WHERE lead_id = $1 AND direction = 'INBOUND') i`,
            [lead.id],
          );
          inboundCount = Number(stats.rows[0]?.inbound || 0);
          lastInboundAt = stats.rows[0]?.last_at || null;
          recentText = stats.rows[0]?.recent || '';
        }
        const b = budgetOf(lead, `${messageText}\n${recentText}`);
        if (b.min || b.max) {
          const lo = (b.min || (b.max as number) * 0.7) * 0.9;
          const hi = (b.max || (b.min as number) * 1.3) * 1.1;
          const m = await client.query(
            `SELECT count(*)::int AS n FROM listings WHERE ${AVAILABLE_LISTING} AND price BETWEEN $1 AND $2`,
            [lo, hi],
          );
          matchingListings = Number(m.rows[0]?.n || 0);
        }
      });
    } catch {
      // Stats are best-effort: score from the data we were given.
    }
  }
  const factors = computeFactors({
    lead,
    text: [messageText, recentText].filter(Boolean).join('\n'),
    inboundCount: Math.max(inboundCount, messageText ? 1 : 0),
    lastInboundAt: lastInboundAt || (messageText ? new Date() : null),
    matchingListings,
  });
  return scoreWithConfig(factors, config, lang);
}

/**
 * Re-scores every lead of a tenant with the current configuration, using bulk
 * queries (one for message stats, one for stock prices) instead of per-lead calls.
 */
export async function rescoreTenantLeads(tenantId: string, lang = 'vn', limit = 5000): Promise<{ updated: number; grades: Record<Grade, number> }> {
  invalidateScoringConfig(tenantId);
  const config = await getTenantScoringConfig(tenantId);
  const { withTenantContext } = await import('../db');
  return withTenantContext(tenantId, async (client) => {
    const leads = await client.query('SELECT * FROM leads ORDER BY updated_at DESC NULLS LAST LIMIT $1', [limit]);
    const stats = await client.query(
      `SELECT lead_id, count(*)::int AS inbound, max(timestamp) AS last_at,
              string_agg(left(content, 300), E'\n') FILTER (WHERE rn <= 10) AS recent
         FROM (SELECT lead_id, content, timestamp,
                      row_number() OVER (PARTITION BY lead_id ORDER BY timestamp DESC) AS rn
                 FROM interactions WHERE direction = 'INBOUND') i
        GROUP BY lead_id`,
    );
    const byLead = new Map<string, any>(stats.rows.map((r: any) => [r.lead_id, r]));
    const prices = (await client.query(`SELECT price FROM listings WHERE ${AVAILABLE_LISTING} AND price > 0`))
      .rows.map((r: any) => Number(r.price)).filter(Number.isFinite);
    const grades: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
    let updated = 0;
    const ids: string[] = [];
    const scores: string[] = [];
    for (const row of leads.rows) {
      const lead = rowToLead(row);
      const s = byLead.get(row.id);
      const b = budgetOf(lead, s?.recent || '');
      let matchingListings: number | null = null;
      if (b.min || b.max) {
        const lo = (b.min || (b.max as number) * 0.7) * 0.9;
        const hi = (b.max || (b.min as number) * 1.3) * 1.1;
        matchingListings = prices.filter(p => p >= lo && p <= hi).length;
      }
      const result = scoreWithConfig(computeFactors({
        lead,
        text: s?.recent || '',
        inboundCount: Number(s?.inbound || 0),
        lastInboundAt: s?.last_at || null,
        lastActivityAt: row.updated_at,
        matchingListings,
      }), config, lang);
      const score = {
        score: result.score, grade: result.grade, reasoning: result.reasoning,
        factors: result.factors, configVersion: result.configVersion, scoredAt: new Date().toISOString(),
      };
      ids.push(row.id);
      scores.push(JSON.stringify(score));
      grades[result.grade] += 1;
      updated += 1;
    }
    // One round trip per 500 leads instead of one per lead (the DB is remote).
    for (let i = 0; i < ids.length; i += 500) {
      await client.query(
        `UPDATE leads AS l SET score = v.score
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::jsonb[]) AS score) AS v
          WHERE l.id = v.id`,
        [ids.slice(i, i + 500), scores.slice(i, i + 500)],
      );
    }
    return { updated, grades };
  });
}
