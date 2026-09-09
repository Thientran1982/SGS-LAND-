import type { Pool } from 'pg';
import {
  buildPlatformContent,
  buildSocialProductSnapshot,
  normalizePublicationImages,
  PUBLISHABLE_LISTING_STATUSES,
} from './socialPublicationService';
import {
  createSocialPublication,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  getAutoPostingSettings,
  listEnabledAutoPostingTenants,
  type AutoPostingSettings,
} from '../repositories/autoPostingRepository';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';
import { normalizeSocialPlatforms } from './socialPublicationService';
import type { SocialPlatform } from '../social-publishing/types';
import { logger } from '../middleware/logger';

const AUTO_PLATFORMS = new Set<SocialPlatform>(['FACEBOOK_PAGE', 'ZALO_BROADCAST']);

function localDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function inTimeWindow(settings: AutoPostingSettings, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const minutes = Number(parts.find(part => part.type === 'hour')?.value || 0) * 60
    + Number(parts.find(part => part.type === 'minute')?.value || 0);
  return settings.timeWindows.some(window => {
    const [startHour, startMinute] = String(window.start || '').split(':').map(Number);
    const [endHour, endMinute] = String(window.end || '').split(':').map(Number);
    if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return false;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  });
}

function normalizeSettings(settings: AutoPostingSettings): AutoPostingSettings {
  const platforms = normalizeSocialPlatforms(settings.platforms)
    .filter(platform => AUTO_PLATFORMS.has(platform));
  return {
    ...settings,
    platforms: platforms.length ? platforms : ['FACEBOOK_PAGE'],
  };
}

async function eligibleCandidates(pool: Pool, tenantId: string, limit: number) {
  const result = await pool.query(
    `WITH candidate_rows AS (
       SELECT l.*,
              p.name AS project_name,
              p.is_featured AS project_is_featured,
              p.priority AS project_priority,
              COALESCE(p.updated_at, l.updated_at, l.created_at) AS priority_updated_at
         FROM listings l
         LEFT JOIN projects p
           ON p.tenant_id = l.tenant_id
          AND (p.id = l.project_id OR (l.project_id IS NULL AND l.project_code IS NOT NULL AND UPPER(p.code) = UPPER(l.project_code)))
        WHERE l.tenant_id = $1
          AND UPPER(l.status) = ANY($2::text[])
          AND (p.id IS NULL OR UPPER(p.status) = 'ACTIVE')
     )
     SELECT c.*
       FROM candidate_rows c
      ORDER BY c.project_is_featured DESC NULLS LAST,
               c.project_priority DESC NULLS LAST,
               c.priority_updated_at ASC NULLS FIRST,
               c.created_at ASC
      LIMIT $3`,
    [tenantId, Array.from(PUBLISHABLE_LISTING_STATUSES), limit],
  );
  return result.rows;
}

async function recentlyUsedPlatforms(
  pool: Pool,
  tenantId: string,
  listingId: string,
  platforms: string[],
  recycleAfterDays: number,
): Promise<Set<string>> {
  if (!platforms.length) return new Set();
  const result = await pool.query(
    `SELECT DISTINCT st.platform
       FROM social_publications sp
       JOIN social_publication_targets st ON st.publication_id = sp.id
      WHERE sp.tenant_id = $1
        AND sp.listing_id = $2
        AND sp.source = 'AUTO'
        AND st.platform = ANY($3::text[])
        AND sp.created_at >= NOW() - ($4::text || ' days')::interval
        AND sp.status <> 'CANCELLED'`,
    [tenantId, listingId, platforms, recycleAfterDays],
  );
  return new Set(result.rows.map(row => String(row.platform)));
}

function listingImages(row: any): string[] {
  const value = typeof row.images === 'string' ? (() => { try { return JSON.parse(row.images); } catch { return []; } })() : row.images;
  return normalizePublicationImages(value);
}

export async function runAutoPostingForTenant(
  pool: Pool,
  tenantId: string,
  now = new Date(),
) {
  const settings = normalizeSettings(await getAutoPostingSettings(pool, tenantId));
  if (!settings.enabled || !inTimeWindow(settings, now)) {
    return { created: 0, skipped: 0, reason: 'DISABLED_OR_OUTSIDE_WINDOW' };
  }

  const dailyCount = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM social_publications
      WHERE tenant_id = $1
        AND source = 'AUTO'
        AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND created_at < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '1 day') AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND status <> 'CANCELLED'`,
    [tenantId],
  );
  const remaining = Math.max(0, settings.postsPerDay - Number(dailyCount.rows[0]?.count || 0));
  if (!remaining) return { created: 0, skipped: 0, reason: 'DAILY_LIMIT_REACHED' };

  const candidates = await eligibleCandidates(pool, tenantId, remaining * 5);
  const readiness = await Promise.all(settings.platforms.map(async platform => ({
    platform: platform as SocialPlatform,
    capability: await getTenantSocialPlatformCapability(platform as SocialPlatform, tenantId),
  })));
  let created = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    if (created >= remaining) break;
    const recentlyUsed = await recentlyUsedPlatforms(
      pool,
      tenantId,
      String(candidate.id),
      settings.platforms,
      settings.recycleAfterDays,
    );
    const readyPlatforms = readiness
      .filter(item => item.capability.status === 'READY' && !recentlyUsed.has(item.platform))
      .map(item => item.platform);
    if (!readyPlatforms.length) {
      skipped++;
      continue;
    }

    const snapshot = await buildSocialProductSnapshot(tenantId, String(candidate.id));
    const images = listingImages(candidate);
    const primaryContent = buildPlatformContent(snapshot, readyPlatforms[0] as SocialPlatform, images);
    const autoPostingKey = `${localDayKey(now)}:${candidate.id}`;
    try {
      const publication = await createSocialPublication(pool, {
        tenantId,
        listingId: String(candidate.id),
        createdBy: null,
        publishMode: 'NOW',
        scheduledAt: null,
        contentSnapshot: { ...snapshot, caption: primaryContent.text },
        assetSnapshot: images,
        platforms: readyPlatforms,
        source: 'AUTO',
        autoPostingKey,
      });
      await recordSocialPublicationEvent(pool, {
        tenantId,
        publicationId: publication.id,
        eventType: 'AUTO_DRAFT_CREATED',
        toStatus: 'DRAFT',
        reason: 'Selector tự động tạo bản nháp để admin kiểm tra trước khi đăng.',
        metadata: { source: 'AUTO', platforms: readyPlatforms, autoPostingKey },
      });
      for (const item of readiness.filter(item => item.capability.status !== 'READY')) {
        await recordSocialPublicationEvent(pool, {
          tenantId,
          publicationId: publication.id,
          eventType: 'AUTO_PLATFORM_SKIPPED',
          reason: `Bỏ qua ${item.platform}: ${item.capability.reason || 'nền tảng chưa sẵn sàng'}`,
          metadata: {
            source: 'AUTO',
            platform: item.platform,
            reasonCode: item.capability.reason || null,
            retryable: item.capability.retryable ?? false,
          },
        });
      }
      for (const item of readiness.filter(item => item.capability.status === 'READY' && recentlyUsed.has(item.platform))) {
        await recordSocialPublicationEvent(pool, {
          tenantId,
          publicationId: publication.id,
          eventType: 'AUTO_PLATFORM_SKIPPED',
          reason: `Bỏ qua ${item.platform}: tin đã được auto-post trên nền tảng này trong thời gian recycle.`,
          metadata: {
            source: 'AUTO',
            platform: item.platform,
            recycleAfterDays: settings.recycleAfterDays,
          },
        });
      }
      created++;
    } catch (error: any) {
      if (String(error?.code) === '23505') continue;
      throw error;
    }
  }
  return { created, skipped, reason: 'OK' };
}

export async function runAutoPostingTick(pool: Pool) {
  const tenants = await listEnabledAutoPostingTenants(pool);
  const results = [];
  for (const tenantId of tenants) {
    try {
      results.push({ tenantId, ...(await runAutoPostingForTenant(pool, tenantId)) });
    } catch (error: any) {
      logger.error(`[AutoPosting] tenant ${tenantId} failed`, error);
      results.push({ tenantId, created: 0, skipped: 0, reason: 'ERROR' });
    }
  }
  return results;
}

let schedulerStarted = false;
export function startAutoPostingScheduler(pool: Pool, intervalMs = 15 * 60 * 1000) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = () => runAutoPostingTick(pool).catch(error => logger.error('[AutoPosting] tick failed', error));
  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);
  logger.info(`[AutoPosting] in-process scheduler started (interval=${intervalMs}ms)`);
}