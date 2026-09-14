/**
 * searchConsoleService.ts — Google Search Console integration for the SEO agent.
 *
 * Pulls real search analytics (average position per keyword) from the GSC API
 * and writes them into seo_target_keywords.current_position so the SEO audit
 * agent and the GEO snapshot (gsc_top20) stop reading stale/empty positions.
 *
 * Authentication: service account via GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL +
 * GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY (Replit secrets). The service account must
 * be added as a "Restricted" user on the GSC property (sgsland.vn).
 * Scope: https://www.googleapis.com/auth/webmasters.readonly
 *
 * Env contract (all optional — the service no-ops with a clear reason when
 * credentials are missing, so the GEO cron never fails because of GSC):
 *   GSC_SITE_URL                default https://sgsland.vn/
 *   GSC_LOOKBACK_DAYS           default 28
 *   GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL
 *   GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY   (\n escapes supported)
 */

import { JWT } from 'google-auth-library';
import { logger } from '../middleware/logger';

const GSC_API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

type GscCredentials = { clientEmail: string; privateKey: string } | null;

function readCredentials(): GscCredentials {
  const clientEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(creds: GscCredentials): Promise<string | null> {
  if (!creds) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const client = new JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: [GSC_SCOPE],
  });
  const res = await client.authorize();
  if (!res.access_token) return null;
  cachedToken = { token: res.access_token, expiresAt: (res.expiry_date || Date.now() + 3000_000) };
  return res.access_token;
}

export type SearchConsoleSyncResult = {
  ok: boolean;
  reason: string;
  keywordsChecked?: number;
  positionsUpdated?: number;
};

type PositionRow = { keyword: string; position: number | null };

async function fetchKeywordPositions(creds: GscCredentials, keywords: string[], lookbackDays: number): Promise<PositionRow[]> {
  const token = await getAccessToken(creds);
  if (!token) throw new Error('GSC auth failed (no access token)');
  const siteUrl = process.env.GSC_SITE_URL || 'https://sgsland.vn/';
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - lookbackDays * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows: PositionRow[] = [];
  // GSC allows max 25k rows per query; keywords here are <= a few hundred so
  // a single dimension=QUERY pull is enough. We average position across days.
  const resp = await fetch(
    GSC_API_BASE + '/sites/' + encodeURIComponent(siteUrl) + '/searchAnalytics/query',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['QUERY'],
        rowLimit: 25000,
        aggregationType: 'auto',
      }),
    },
  );
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => '');
    throw new Error('GSC query failed: HTTP ' + resp.status + ' ' + bodyText.slice(0, 200));
  }
  const data: any = await resp.json();
  const wanted = new Set(keywords.map(k => k.toLowerCase().trim()));
  for (const row of data?.rows || []) {
    const key = String(row.keys?.[0] || '').toLowerCase().trim();
    if (!wanted.has(key)) continue;
    rows.push({ keyword: key, position: Number.isFinite(Number(row.position)) ? Number(row.position) : null });
  }
  // Keywords tracked but absent from GSC results keep null (never ranked).
  for (const k of keywords) {
    const key = k.toLowerCase().trim();
    if (!rows.some(r => r.keyword === key)) rows.push({ keyword: key, position: null });
  }
  return rows;
}

/**
 * Sync real GSC average positions into seo_target_keywords.current_position
 * for one tenant. Safe to call from the GEO cron: missing credentials or API
 * errors are reported in the result, never thrown.
 */
export async function syncKeywordPositionsFromSearchConsole(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  tenantId: string,
): Promise<SearchConsoleSyncResult> {
  const creds = readCredentials();
  if (!creds) {
    return { ok: false, reason: 'GSC credentials not configured (GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL / GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY)' };
  }
  try {
    const kw = await pool.query(
      'SELECT id, keyword FROM seo_target_keywords WHERE tenant_id = $1',
      [tenantId],
    );
    const keywords: string[] = kw.rows.map((r: any) => String(r.keyword));
    if (!keywords.length) return { ok: true, reason: 'no tracked keywords', keywordsChecked: 0, positionsUpdated: 0 };

    const lookback = Number(process.env.GSC_LOOKBACK_DAYS) || 28;
    const positions = await fetchKeywordPositions(creds, keywords, lookback);

    let updated = 0;
    for (const row of positions) {
      await pool.query(
        'UPDATE seo_target_keywords SET current_position = $3, last_checked_at = NOW() WHERE tenant_id = $1 AND LOWER(keyword) = LOWER($2)',
        [tenantId, row.keyword, row.position],
      );
      if (row.position !== null) updated++;
    }
    logger.info('[SearchConsole] tenant=' + tenantId + ' keywords=' + keywords.length + ' positionsUpdated=' + updated);
    return { ok: true, reason: 'synced', keywordsChecked: keywords.length, positionsUpdated: updated };
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.warn('[SearchConsole] sync failed: ' + reason);
    return { ok: false, reason };
  }
}
