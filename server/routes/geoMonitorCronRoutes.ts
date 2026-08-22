/**
 * geoMonitorCronRoutes.ts
 *
 * Sprint #64 follow-up — daily snapshot of GEO (Generative Engine Optimization)
 * health. Triggered by QStash once per day; also exposes a read endpoint so
 * the SeoManager → GEO tab can chart the last 30 days.
 *
 * Writes one row per day into `seo_geo_snapshots`:
 *   - ai_mentions_json: per-engine probe results (queries, mentions, rate)
 *   - gsc_top20_json:   current_position snapshot of top-20 target keywords
 *   - backlinks_json:   competitor backlink summary with explicit CSE provenance
 *   - lighthouse_json:  PageSpeed Insights performance/accessibility/SEO scores
 *
 * Idempotent: re-running for the same date upserts via UNIQUE(date).
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { DEFAULT_TENANT_ID } from '../constants';
import { startAgentRun, finishAgentRun } from '../services/agentRunsService';

// Curated brand probes — short list to keep daily AI quota cost low.
const BRAND_QUERIES = [
  'SGS Land là công ty gì?',
  'Đại lý phân phối Aqua City Novaland chính thức là ai?',
  'sgsland.vn bán những dự án nào?',
  'Sàn bất động sản uy tín TP.HCM 2026',
  'Mua The Global City Masterise ở đâu uy tín?',
];

const BRAND_PATTERNS = [/sgs\s*[-_]?\s*land/i, /sgsland\.vn/i];

function mentioned(text: string | null | undefined): boolean {
  if (!text) return false;
  return BRAND_PATTERNS.some((p) => p.test(text));
}

interface EngineResult {
  engine: string;
  queries: number;
  mentions: number;
  rate: number;
  skipped?: string;
  details: { query: string; mentioned: boolean; error?: string }[];
}

async function probeGemini(): Promise<EngineResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  const out: EngineResult = { engine: 'gemini', queries: 0, mentions: 0, rate: 0, details: [] };
  if (!apiKey) {
    out.skipped = 'no GEMINI_API_KEY';
    return out;
  }
  for (const q of BRAND_QUERIES) {
    out.queries++;
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: q }] }] }),
        },
      );
      if (!resp.ok) {
        out.details.push({ query: q, mentioned: false, error: `HTTP ${resp.status}` });
        continue;
      }
      const data: any = await resp.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p?.text || '')
        .join('\n');
      const isMention = mentioned(text);
      if (isMention) out.mentions++;
      out.details.push({ query: q, mentioned: isMention });
    } catch (err: any) {
      out.details.push({ query: q, mentioned: false, error: err?.message || String(err) });
    }
  }
  out.rate = out.queries ? +(out.mentions / out.queries).toFixed(3) : 0;
  return out;
}

async function probeOpenAI(): Promise<EngineResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const out: EngineResult = { engine: 'chatgpt', queries: 0, mentions: 0, rate: 0, details: [] };
  if (!apiKey) {
    out.skipped = 'no OPENAI_API_KEY';
    return out;
  }
  for (const q of BRAND_QUERIES) {
    out.queries++;
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: q }],
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        out.details.push({ query: q, mentioned: false, error: `HTTP ${resp.status}` });
        continue;
      }
      const data: any = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const isMention = mentioned(text);
      if (isMention) out.mentions++;
      out.details.push({ query: q, mentioned: isMention });
    } catch (err: any) {
      out.details.push({ query: q, mentioned: false, error: err?.message || String(err) });
    }
  }
  out.rate = out.queries ? +(out.mentions / out.queries).toFixed(3) : 0;
  return out;
}

async function probeAnthropic(): Promise<EngineResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const out: EngineResult = { engine: 'claude', queries: 0, mentions: 0, rate: 0, details: [] };
  if (!apiKey) {
    out.skipped = 'no ANTHROPIC_API_KEY';
    return out;
  }
  for (const q of BRAND_QUERIES) {
    out.queries++;
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 512,
          messages: [{ role: 'user', content: q }],
        }),
      });
      if (!resp.ok) {
        out.details.push({ query: q, mentioned: false, error: `HTTP ${resp.status}` });
        continue;
      }
      const data: any = await resp.json();
      const text = (data?.content || []).map((c: any) => c?.text || '').join('\n');
      const isMention = mentioned(text);
      if (isMention) out.mentions++;
      out.details.push({ query: q, mentioned: isMention });
    } catch (err: any) {
      out.details.push({ query: q, mentioned: false, error: err?.message || String(err) });
    }
  }
  out.rate = out.queries ? +(out.mentions / out.queries).toFixed(3) : 0;
  return out;
}

async function probePerplexity(): Promise<EngineResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY;
  const out: EngineResult = { engine: 'perplexity', queries: 0, mentions: 0, rate: 0, details: [] };
  if (!apiKey) {
    out.skipped = 'no PERPLEXITY_API_KEY';
    return out;
  }
  for (const q of BRAND_QUERIES) {
    out.queries++;
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: q }],
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        out.details.push({ query: q, mentioned: false, error: `HTTP ${resp.status}` });
        continue;
      }
      const data: any = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '';
      // Perplexity also returns citations — count brand citations as a mention too.
      const citations = (data?.citations || []).join(' ');
      const isMention = mentioned(text) || mentioned(citations);
      if (isMention) out.mentions++;
      out.details.push({ query: q, mentioned: isMention });
    } catch (err: any) {
      out.details.push({ query: q, mentioned: false, error: err?.message || String(err) });
    }
  }
  out.rate = out.queries ? +(out.mentions / out.queries).toFixed(3) : 0;
  return out;
}

async function probeGrok(): Promise<EngineResult> {
  const apiKey = process.env.XAI_API_KEY;
  const out: EngineResult = { engine: 'grok', queries: 0, mentions: 0, rate: 0, details: [] };
  if (!apiKey) {
    out.skipped = 'no XAI_API_KEY';
    return out;
  }
  for (const q of BRAND_QUERIES) {
    out.queries++;
    try {
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          messages: [{ role: 'user', content: q }],
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        out.details.push({ query: q, mentioned: false, error: `HTTP ${resp.status}` });
        continue;
      }
      const data: any = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const isMention = mentioned(text);
      if (isMention) out.mentions++;
      out.details.push({ query: q, mentioned: isMention });
    } catch (err: any) {
      out.details.push({ query: q, mentioned: false, error: err?.message || String(err) });
    }
  }
  out.rate = out.queries ? +(out.mentions / out.queries).toFixed(3) : 0;
  return out;
}

// Snapshot top-20 target keywords for the host tenant (sgsland.vn brand
// monitor). The GEO snapshot table is intentionally global to the host tenant
// — we filter `seo_target_keywords` by DEFAULT_TENANT_ID so other tenants'
// keyword data never leaks into the brand snapshot, and so endpoint readers
// only ever see host-tenant data.
async function buildGscTop20(pool: Pool): Promise<any> {
  try {
    const r = await pool.query(
      `
      SELECT keyword,
             MIN(NULLIF(current_position, 0))      AS best_position,
             MAX(target_position)                  AS target_position,
             MAX(search_volume)                    AS search_volume,
             MAX(target_url)                       AS target_url
        FROM seo_target_keywords
       WHERE tenant_id = $1
         AND current_position IS NOT NULL
    GROUP BY lower(keyword), keyword
    ORDER BY best_position ASC NULLS LAST
       LIMIT 20
      `,
      [DEFAULT_TENANT_ID],
    );
    return {
      capturedAt: new Date().toISOString(),
      keywords: r.rows.map((row) => ({
        keyword: row.keyword,
        position: row.best_position == null ? null : Number(row.best_position),
        targetPosition: row.target_position == null ? null : Number(row.target_position),
        searchVolume: row.search_volume == null ? null : Number(row.search_volume),
        targetUrl: row.target_url || null,
      })),
    };
  } catch (err: any) {
    logger.warn(`[GeoMonitorCron] gscTop20 query failed: ${err?.message || err}`);
    return { capturedAt: new Date().toISOString(), keywords: [], error: err?.message || String(err) };
  }
}

// Compute the current calendar date in Asia/Ho_Chi_Minh (ICT, UTC+7) so the
// snapshot's `date` column matches the Vietnamese business day even when the
// QStash schedule fires at 21:30 UTC (=04:30 ICT next day).
function ictDateString(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
}

// Competitor list to track for backlinks/visibility (mirrors geo-monitor.mjs).
const COMPETITORS = [
  'batdongsan.com.vn',
  'nhatot.com',
  'cafeland.vn',
  'kingsland.vn',
  'cenland.vn',
];

const LIGHTHOUSE_PAGES = [
  { path: '/', label: 'Trang chủ' },
  { path: '/marketplace', label: 'Marketplace' },
  { path: '/bat-dong-san-dong-nai', label: 'BĐS Đồng Nai' },
] as const;

interface LighthousePageResult {
  path: string;
  label: string;
  strategy: 'mobile';
  source: 'PageSpeed Insights';
  status: 'measured' | 'error' | 'skipped';
  fetchedAt: string;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  responseMs: number | null;
  error?: string;
}

interface CompetitorBacklink {
  domain: string;
  reachable: boolean;
  status: number | null;
  responseMs: number | null;
  contentLength: number | null;
  brandLinkOnHomepage: boolean;
  // Approximate referring-domain count from Google CSE if configured.
  cseLinkResults: number | null;
  error?: string;
}

async function probeCompetitorBacklinks(): Promise<{
  capturedAt: string;
  brandDomain: string;
  competitors: CompetitorBacklink[];
  cseConfigured: boolean;
}> {
  const cseKey = process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cseCx  = process.env.GOOGLE_CSE_CX  || process.env.GOOGLE_CUSTOM_SEARCH_CX;
  const cseConfigured = !!(cseKey && cseCx);
  const brandDomain = (process.env.TARGET_URL || 'https://sgsland.vn').replace(/^https?:\/\//, '').replace(/\/$/, '');

  const results: CompetitorBacklink[] = [];

  for (const domain of COMPETITORS) {
    const row: CompetitorBacklink = {
      domain,
      reachable: false,
      status: null,
      responseMs: null,
      contentLength: null,
      brandLinkOnHomepage: false,
      cseLinkResults: null,
    };
    // 1) Liveness + outbound link to our brand on the competitor homepage.
    const start = Date.now();
    try {
      const resp = await fetch(`https://${domain}/`, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'SGSLandGeoMonitor/1.0 (+https://sgsland.vn)' },
        signal: AbortSignal.timeout(8000),
      });
      row.status = resp.status;
      row.reachable = resp.ok;
      row.responseMs = Date.now() - start;
      const text = await resp.text();
      row.contentLength = text.length;
      row.brandLinkOnHomepage =
        new RegExp(`href=["'][^"']*${brandDomain.replace(/\./g, '\\.')}`, 'i').test(text);
    } catch (err: any) {
      row.error = err?.message || String(err);
      row.responseMs = Date.now() - start;
    }

    // 2) Approximate referring-domain count: Google CSE `link:` is deprecated
    //    so we instead count indexed pages on the competitor that mention our
    //    brand domain (proxy for backlink + co-mention surface).
    if (cseConfigured) {
      try {
        const q = encodeURIComponent(`site:${domain} "${brandDomain}"`);
        const url = `https://www.googleapis.com/customsearch/v1?key=${cseKey}&cx=${cseCx}&q=${q}&num=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const data: any = await r.json();
          const total = Number(data?.searchInformation?.totalResults || 0);
          row.cseLinkResults = isFinite(total) ? total : 0;
        }
      } catch { /* ignore — leave as null */ }
    }

    results.push(row);
  }

  return {
    capturedAt: new Date().toISOString(),
    brandDomain,
    competitors: results,
    cseConfigured,
  };
}

/**
 * PageSpeed Insights is used instead of a locally installed Lighthouse binary:
 * it is reproducible in the Replit workflow and returns Lighthouse category
 * scores plus field/lab evidence. A missing response is never represented as
 * a zero score.
 */
async function probeLighthouse(): Promise<{
  capturedAt: string;
  source: 'PageSpeed Insights';
  strategy: 'mobile';
  pages: LighthousePageResult[];
}> {
  const capturedAt = new Date().toISOString();
  const baseUrl = (process.env.TARGET_URL || 'https://sgsland.vn').replace(/\/+$/, '');
  const pages = await Promise.all(
    LIGHTHOUSE_PAGES.map(async ({ path, label }): Promise<LighthousePageResult> => {
      const started = Date.now();
      const result: LighthousePageResult = {
        path,
        label,
        strategy: 'mobile',
        source: 'PageSpeed Insights',
        status: 'error',
        fetchedAt: capturedAt,
        scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
        responseMs: null,
      };
      try {
        const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        endpoint.searchParams.set('url', `${baseUrl}${path}`);
        endpoint.searchParams.set('strategy', 'mobile');
        for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) {
          endpoint.searchParams.append('category', category);
        }
        const response = await fetch(endpoint, {
          headers: { 'User-Agent': 'SGSLandGeoMonitor/1.0 (+https://sgsland.vn)' },
          signal: AbortSignal.timeout(30_000),
        });
        result.responseMs = Date.now() - started;
        if (!response.ok) {
          result.status = response.status === 429 ? 'skipped' : 'error';
          result.error = `PageSpeed Insights HTTP ${response.status}`;
          return result;
        }
        const data: any = await response.json();
        const categories = data?.lighthouseResult?.categories || {};
        const score = (key: string) => {
          const value = categories[key]?.score;
          return typeof value === 'number' ? Math.round(value * 100) : null;
        };
        result.scores = {
          performance: score('performance'),
          accessibility: score('accessibility'),
          bestPractices: score('best-practices'),
          seo: score('seo'),
        };
        result.status = 'measured';
        return result;
      } catch (error: any) {
        result.responseMs = Date.now() - started;
        result.error = error?.name === 'TimeoutError'
          ? 'PageSpeed Insights timeout'
          : error?.message || String(error);
        return result;
      }
    }),
  );
  return { capturedAt, source: 'PageSpeed Insights', strategy: 'mobile', pages };
}

async function runSnapshot(pool: Pool): Promise<any> {
  const today = ictDateString();

  const [gemini, chatgpt, claude, perplexity, grok, gscTop20, backlinks, lighthouse] = await Promise.all([
    probeGemini(),
    probeOpenAI(),
    probeAnthropic(),
    probePerplexity(),
    probeGrok(),
    buildGscTop20(pool),
    probeCompetitorBacklinks(),
    probeLighthouse(),
  ]);

  const engines = { gemini, chatgpt, claude, perplexity, grok };
  const totals = Object.values(engines).reduce(
    (acc, e) => ({ queries: acc.queries + e.queries, mentions: acc.mentions + e.mentions }),
    { queries: 0, mentions: 0 },
  );
  const overallRate = totals.queries ? +(totals.mentions / totals.queries).toFixed(3) : 0;

  const aiMentions = {
    capturedAt: new Date().toISOString(),
    source: 'Provider API answer probes — not crawler access logs',
    methodology: '5 fixed prompts per configured provider; a mention means the returned answer or citation contains SGS LAND.',
    queries: BRAND_QUERIES,
    engines: Object.fromEntries(Object.entries(engines).map(([name, engine]) => {
      const errors = engine.details.filter((detail) => !!detail.error).length;
      return [name, {
        ...engine,
        status: engine.skipped ? 'skipped' : errors > 0 && errors === engine.queries ? 'error' : 'measured',
        errorCount: errors,
      }];
    })),
    totals: { ...totals, rate: overallRate },
  };

  await pool.query(
    `
    INSERT INTO seo_geo_snapshots (date, ai_mentions_json, gsc_top20_json, backlinks_json, lighthouse_json)
    VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)
    ON CONFLICT (date) DO UPDATE SET
      ai_mentions_json = EXCLUDED.ai_mentions_json,
      gsc_top20_json   = EXCLUDED.gsc_top20_json,
      backlinks_json   = EXCLUDED.backlinks_json,
      lighthouse_json  = EXCLUDED.lighthouse_json
    `,
    [today, JSON.stringify(aiMentions), JSON.stringify(gscTop20), JSON.stringify(backlinks), JSON.stringify(lighthouse)],
  );

  return { date: today, ai_mentions: aiMentions, gsc_top20: gscTop20, backlinks, lighthouse };
}

export function createGeoMonitorCronRouter(
  pool: Pool,
  cronSecret: string,
  authenticateToken: any,
): Router {
  const router = Router();

  // POST /api/internal/geo-monitor-cron — invoked daily by QStash.
  router.post('/api/internal/geo-monitor-cron', async (req: Request, res: Response) => {
    const provided =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!cronSecret || provided !== cronSecret) {
      logger.warn('[GeoMonitorCron] HTTP từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info('[GeoMonitorCron] Bắt đầu snapshot ngày — ' + new Date().toISOString());
    const startedMs = Date.now();
    const runId = await startAgentRun(pool, 'geo-monitor-cron', 'qstash');
    try {
      const result = await runSnapshot(pool);
      const totalRate = result.ai_mentions?.totals?.rate ?? 0;
      const kwCount = result.gsc_top20?.keywords?.length ?? 0;
      logger.info(
        `[GeoMonitorCron] Snapshot ${result.date} — overall mention rate=${totalRate} kw=${kwCount}`,
      );
      await finishAgentRun(pool, runId, 'success', {
        date: result.date,
        overall_rate: totalRate,
        keyword_count: kwCount,
        engines: Object.fromEntries(
          Object.entries(result.ai_mentions?.engines || {}).map(([k, v]: [string, any]) => [
            k, { queries: v?.queries ?? 0, mentions: v?.mentions ?? 0, rate: v?.rate ?? 0, skipped: v?.skipped ?? null },
          ]),
        ),
        competitors_probed: result.backlinks?.competitors?.length ?? 0,
      }, null, startedMs);
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[GeoMonitorCron] Lỗi snapshot:', err?.message || err);
      await finishAgentRun(pool, runId, 'error', {}, (err?.message || String(err)).slice(0, 4000), startedMs);
      return res.status(500).json({ error: 'Internal error', detail: err?.message || String(err) });
    }
  });

  // Host-tenant SUPER_ADMIN gate — mirrors the policy used by other GEO/SEO
  // management endpoints in server.ts. The snapshot table holds competitive
  // intelligence (competitor backlinks, AI mention rates) and is global to the
  // host tenant, so we restrict it to the host tenant's super admin only.
  const requireHostSuperAdmin = (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN' || user.tenantId !== DEFAULT_TENANT_ID) {
      return res.status(403).json({ error: 'Chỉ SUPER_ADMIN của host tenant mới truy cập được GEO Monitor' });
    }
    return next();
  };

  // GET /api/seo/geo-snapshots?days=30 — chart data for SeoManager GEO tab.
  router.get(
    '/api/seo/geo-snapshots',
    authenticateToken,
    requireHostSuperAdmin,
    async (req: Request, res: Response) => {
      const days = Math.max(1, Math.min(180, Number(req.query.days) || 30));
      try {
        const r = await pool.query(
          `
          SELECT date, ai_mentions_json, gsc_top20_json, backlinks_json, lighthouse_json, created_at
            FROM seo_geo_snapshots
           WHERE date >= (CURRENT_DATE - ($1::int - 1))
        ORDER BY date ASC
          `,
          [days],
        );
        return res.json({
          days,
          snapshots: r.rows.map((row) => ({
            date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
            aiMentions: row.ai_mentions_json,
            gscTop20: row.gsc_top20_json,
            backlinks: row.backlinks_json,
            lighthouse: row.lighthouse_json,
            createdAt: row.created_at,
          })),
        });
      } catch (err: any) {
        logger.error('[GeoMonitorCron] /api/seo/geo-snapshots lỗi:', err?.message || err);
        return res.status(500).json({ error: 'Internal error' });
      }
    },
  );

  // POST /api/seo/geo-snapshots/run-now — host-tenant SUPER_ADMIN manual trigger.
  router.post(
    '/api/seo/geo-snapshots/run-now',
    authenticateToken,
    requireHostSuperAdmin,
    async (_req: Request, res: Response) => {
      const startedMs = Date.now();
      const runId = await startAgentRun(pool, 'geo-monitor-cron', 'manual_admin');
      try {
        const result = await runSnapshot(pool);
        const totalRate = result.ai_mentions?.totals?.rate ?? 0;
        const kwCount = result.gsc_top20?.keywords?.length ?? 0;
        await finishAgentRun(pool, runId, 'success', { date: result.date, overall_rate: totalRate, keyword_count: kwCount, manual: true }, null, startedMs);
        return res.json({ ok: true, ...result });
      } catch (err: any) {
        logger.error('[GeoMonitorCron] run-now lỗi:', err?.message || err);
        await finishAgentRun(pool, runId, 'error', { manual: true }, (err?.message || String(err)).slice(0, 4000), startedMs);
        return res.status(500).json({ error: 'Internal error', detail: err?.message || String(err) });
      }
    },
  );

  return router;
}
