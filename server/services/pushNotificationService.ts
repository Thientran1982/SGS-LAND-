/**
 * pushNotificationService.ts (Task #53)
 *
 * Sends Expo push notifications and runs the periodic match job that finds
 * new listings matching buyer saved searches.
 *
 * - Uses Expo's HTTPS push API directly (https://exp.host/--/api/v2/push/send),
 *   which works for any project_id without needing the @expo/server-sdk
 *   dependency.
 * - Notifications carry a `data.slugId` payload that the mobile app uses to
 *   deep-link into `/bds/[slugId]`.
 * - Match cycle is gated by both a per-search `last_notified_at` watermark
 *   (so we never re-emit a listing that existed before the search was
 *   created) and an idempotent `buyer_push_notification_log` (UNIQUE on
 *   device+search+listing) so we never push the same listing twice.
 */
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { buyerPushRepository, BuyerSavedSearch } from '../repositories/buyerPushRepository';
import { listingRepository } from '../repositories/listingRepository';
import { DEFAULT_TENANT_ID } from '../constants';
// Local helper: same slugify as the mobile app uses, so server-emitted slugIds
// match the URLs the mobile router expects.
function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, any>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}
interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}
/**
 * Validate that a token looks like an ExponentPushToken[…]/ExpoPushToken[…]
 * — Expo will 400 otherwise.
 */
export function isValidExpoPushToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$/.test(token);
}
/**
 * Send a batch of push messages. Expo accepts arrays of up to 100 per
 * request — we keep batches small here (caller is expected to batch).
 *
 * Returns the per-message tickets aligned to `messages`. Missing entries
 * are returned as `{ status: 'error', message }`.
 */
export async function sendExpoPushBatch(
  messages: ExpoPushMessage[],
): Promise<ExpoTicket[]> {
  if (!messages.length) return [];
  try {
    const r = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      logger.warn(`[push] Expo push HTTP ${r.status}: ${body.slice(0, 200)}`);
      return messages.map(() => ({ status: 'error', message: `HTTP ${r.status}` }));
    }
    const json = (await r.json()) as { data?: ExpoTicket[]; errors?: any[] };
    if (Array.isArray(json.data)) return json.data;
    return messages.map(() => ({ status: 'error', message: 'Unknown Expo response' }));
  } catch (err: any) {
    logger.warn(`[push] Expo push transport error: ${err?.message || err}`);
    return messages.map(() => ({ status: 'error', message: String(err?.message || err) }));
  }
}
// ── Saved-search matching ────────────────────────────────────────────────────
interface MatchedListing {
  id: string;
  title: string;
  slugId: string;
  price: number | null;
  location: string | null;
  createdAt: Date;
}
function buildSlugId(row: { id: string; title?: string | null; code?: string | null; location?: string | null }): string {
  const base = slugify(row.title || row.code || row.location || 'bat-dong-san') || 'bat-dong-san';
  return `${base}-${row.id}`;
}
/**
 * Find listings created/updated AFTER `since` that match the saved search
 * filters. Public surface — only AVAILABLE/BOOKING/OPENING listings, mirroring
 * /api/public/listings.
 */
async function findMatchingListings(
  search: BuyerSavedSearch,
  since: Date,
  tenantId: string,
): Promise<MatchedListing[]> {
  const f = search.filters || {};
  // Translate the mobile filter shape into the listingRepository.findListings
  // filter shape.
  const filters: any = {
    status_in: ['AVAILABLE', 'BOOKING', 'OPENING'],
  };
  if (f.type && f.type !== 'ALL') filters.type = f.type;
  if (f.transaction && f.transaction !== 'ALL') filters.transaction = f.transaction;
  if (f.location && f.location !== 'ALL') filters.location_contains = f.location;
  if (f.search) filters.search = f.search;
  if (typeof f.priceMin === 'number') filters.price_gte = f.priceMin;
  if (typeof f.priceMax === 'number') filters.price_lte = f.priceMax;
  if (typeof f.bedroomsMin === 'number') filters.bedrooms_gte = f.bedroomsMin;
  if (typeof f.areaMin === 'number') filters.area_gte = f.areaMin;
  if (typeof f.areaMax === 'number') filters.area_lte = f.areaMax;
  if (f.isVerified) filters.isVerified = true;
  // listingRepository.findListings returns DESC by created_at with keyset
  // cursors. Walk pages until we cross the watermark so we never miss older
  // unseen matches when more than `pageSize` rows accumulated since the
  // last tick. Hard cap at MAX_PAGES * PAGE_SIZE rows scanned per tick to
  // bound work; the watermark only advances by what we actually claim, so
  // anything beyond the cap is picked up on subsequent ticks.
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20; // 2,000 rows max per search per tick
  const sinceMs = since.getTime();
  const out: MatchedListing[] = [];
  let cursor: string | undefined;
  let crossedWatermark = false;
  for (let page = 0; page < MAX_PAGES && !crossedWatermark; page++) {
    const result = await listingRepository.findListingsCursor(tenantId, {
      pageSize: PAGE_SIZE,
      cursor,
      filters,
      sortBy: 'recent',
    });
    const rows = result.data || [];
    if (!rows.length) break;
    for (const row of rows) {
      const created = row.createdAt ? new Date(row.createdAt).getTime() : 0;
      if (!created) continue;
      if (created <= sinceMs) {
        // DESC stream → everything after this is older too. Stop walking.
        crossedWatermark = true;
        break;
      }
      out.push({
        id: row.id,
        title: row.title || 'Bất động sản mới',
        slugId: buildSlugId(row),
        price: typeof row.price === 'number' ? row.price : Number(row.price) || null,
        location: row.location || null,
        createdAt: new Date(row.createdAt),
      });
    }
    if (!result.hasNext || !result.nextCursor) break;
    cursor = result.nextCursor;
  }
  // Oldest first so the per-tick cap deterministically processes the
  // earliest unseen matches and the watermark advances monotonically.
  out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return out;
}
function formatPrice(price: number | null): string {
  if (!price || price <= 0) return 'Liên hệ';
  if (price >= 1_000_000_000) {
    const v = price / 1_000_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} tỷ`;
  }
  if (price >= 1_000_000) {
    return `${Math.round(price / 1_000_000)} triệu`;
  }
  return String(price);
}
export interface MatchTickResult {
  searchesScanned: number;
  matchesFound: number;
  pushesSent: number;
  pushesFailed: number;
}
/**
 * One pass of the matching engine. Idempotent + safe to run concurrently
 * (claim is atomic via UNIQUE constraint on the dedup table).
 */
export async function tickBuyerPushNotifications(
  _pool: Pool,
  opts?: { tenantId?: string },
): Promise<MatchTickResult> {
  const tenantId = opts?.tenantId || DEFAULT_TENANT_ID;
  const result: MatchTickResult = {
    searchesScanned: 0,
    matchesFound: 0,
    pushesSent: 0,
    pushesFailed: 0,
  };
  const candidates = await buyerPushRepository.findActiveSearchesWithDevice();
  result.searchesScanned = candidates.length;
  if (!candidates.length) return result;

  const messages: ExpoPushMessage[] = [];
  // Track everything we need for post-send bookkeeping: dedup release on
  // failure, watermark advancement on success, and the source createdAt
  // so we never advance the watermark past a listing we failed to deliver.
  interface SendMeta {
    deviceId: string;
    savedSearchId: string;
    listingId: string;
    token: string;
    createdAt: Date;
  }
  const meta: SendMeta[] = [];
  for (const { search, device } of candidates) {
    const token = device.expoPushToken;
    if (!isValidExpoPushToken(token) || !token) continue;
    // Watermark: anchor at search creation so we never blast the user with
    // the existing back-catalog. After the first tick, the watermark moves
    // forward via `last_notified_at` — but only for successfully delivered
    // listings (see post-send loop below).
    const since = search.lastNotifiedAt || search.createdAt;
    let matched: MatchedListing[];
    try {
      matched = await findMatchingListings(search, since, tenantId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[push] Match failed for search ${search.id}: ${msg}`);
      continue;
    }
    if (!matched.length) continue;
    // Per-tick cap — applied BEFORE claiming so we don't lock listings
    // into the dedup log only to drop them. Remaining matches stay
    // unclaimed and roll over to the next tick.
    const PER_TICK_CAP = 3;
    const slice = matched.slice(0, PER_TICK_CAP);
    const ids = slice.map((m) => m.id);
    const claimed = await buyerPushRepository.claimUnnotifiedListings(
      device.deviceId,
      search.id,
      ids,
    );
    const claimedSet = new Set(claimed);
    const fresh = slice.filter((m) => claimedSet.has(m.id));
    if (!fresh.length) continue;
    result.matchesFound += fresh.length;
    for (const m of fresh) {
      const priceTxt = formatPrice(m.price);
      const locTxt = m.location ? ` · ${m.location}` : '';
      messages.push({
        to: token,
        title: `🏠 BĐS mới khớp "${search.label}"`,
        body: `${m.title} — ${priceTxt}${locTxt}`,
        sound: 'default',
        priority: 'high',
        channelId: 'matches',
        data: {
          type: 'listing_match',
          listingId: m.id,
          slugId: m.slugId,
          url: `/bds/${m.slugId}`,
          savedSearchId: search.id,
        },
      });
      meta.push({
        deviceId: device.deviceId,
        savedSearchId: search.id,
        listingId: m.id,
        token,
        createdAt: m.createdAt,
      });
    }
  }
  // Track per-saved-search the max createdAt of SUCCESSFULLY delivered
  // listings. Watermark advances only for those — failed listings get
  // their dedup claim released so the next tick retries them.
  const successMaxByStore = new Map<string, Date>();
  // Send in batches of 100 (Expo's per-request cap).
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    let tickets;
    try {
      tickets = await sendExpoPushBatch(batch);
    } catch (err) {
      // Whole-batch transport error: release every claim in this batch
      // so the next tick retries them. Don't advance any watermark.
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[push] Expo batch send failed (${batch.length} msgs): ${msg}`);
      result.pushesFailed += batch.length;
      for (let j = 0; j < batch.length; j++) {
        const m = meta[i + j];
        if (!m) continue;
        await buyerPushRepository
          .releaseClaim(m.deviceId, m.savedSearchId, m.listingId)
          .catch(() => {});
      }
      continue;
    }
    for (let j = 0; j < tickets.length; j++) {
      const t = tickets[j];
      const m = meta[i + j];
      if (!m) continue;
      if (t.status === 'ok') {
        result.pushesSent++;
        const prev = successMaxByStore.get(m.savedSearchId);
        if (!prev || m.createdAt.getTime() > prev.getTime()) {
          successMaxByStore.set(m.savedSearchId, m.createdAt);
        }
      } else {
        result.pushesFailed++;
        const errMsg = t.message || t.details?.error || 'unknown';
        await buyerPushRepository
          .recordFailure(m.deviceId, m.savedSearchId, m.listingId, errMsg)
          .catch(() => {});
        if (t.details?.error === 'DeviceNotRegistered') {
          // Token is dead — scrub it and release the claim so once the
          // device re-registers, the same listing can still notify.
          await buyerPushRepository.invalidateToken(m.token).catch(() => {});
          await buyerPushRepository
            .releaseClaim(m.deviceId, m.savedSearchId, m.listingId)
            .catch(() => {});
        } else {
          // Transient error — release so next tick retries.
          await buyerPushRepository
            .releaseClaim(m.deviceId, m.savedSearchId, m.listingId)
            .catch(() => {});
        }
      }
    }
  }
  // Advance watermarks ONLY for successfully delivered listings. Anything
  // failed has already been released from the dedup log and will be
  // re-evaluated on the next tick (because watermark is unchanged for it).
  for (const [savedSearchId, maxCreatedAt] of successMaxByStore) {
    await buyerPushRepository.setLastNotifiedAt(savedSearchId, maxCreatedAt);
  }
  return result;
}
// ── In-process cron driver ───────────────────────────────────────────────────
let pushTimer: NodeJS.Timeout | null = null;
let pushInFlight = false;
async function runTickGuarded(pool: Pool, label: string): Promise<void> {
  if (pushInFlight) {
    logger.warn(`[push] tick ${label} skipped — previous still in flight`);
    return;
  }
  pushInFlight = true;
  try {
    const r = await tickBuyerPushNotifications(pool);
    if (r.searchesScanned > 0 || r.pushesSent > 0) {
      logger.info(
        `[push] tick ${label} — searches=${r.searchesScanned} matches=${r.matchesFound} sent=${r.pushesSent} failed=${r.pushesFailed}`,
      );
    }
  } catch (err: any) {
    logger.warn(`[push] tick ${label} failed: ${err?.message || err}`);
  } finally {
    pushInFlight = false;
  }
}
export function startBuyerPushCron(pool: Pool, opts?: { intervalMs?: number }): void {
  if (pushTimer) return;
  const intervalMs = opts?.intervalMs ?? 15 * 60 * 1000;
  pushTimer = setInterval(() => {
    void runTickGuarded(pool, 'interval');
  }, intervalMs);
  if (typeof (pushTimer as any).unref === 'function') (pushTimer as any).unref();
  // Initial run after 60s so we don't compete with boot.
  setTimeout(() => {
    void runTickGuarded(pool, 'initial');
  }, 60_000).unref?.();
  logger.info(`[push] In-process buyer-push cron started (interval=${intervalMs}ms)`);
}
export function stopBuyerPushCron(): void {
  if (pushTimer) {
    clearInterval(pushTimer);
    pushTimer = null;
  }
}