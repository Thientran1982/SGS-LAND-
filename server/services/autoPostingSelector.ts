import type { Pool } from 'pg';
import {
  activateSocialPublication,
  createSocialPublication,
  markSocialTargetsPending,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  claimMarketingFacebookDailyRun,
  finishMarketingFacebookDailyRun,
  getAutoPostingSettings,
  listEnabledAutoPostingTenants,
  type AutoPostingSettings,
} from '../repositories/autoPostingRepository';
import {
  buildPlatformContent,
  buildSocialProductSnapshot,
  buildSocialProjectSnapshot,
  normalizePublicationImages,
  normalizeSocialPlatforms,
  PUBLISHABLE_LISTING_STATUSES,
  PUBLISHABLE_PROJECT_STATUSES,
} from './socialPublicationService';
import { processSocialPublicationTick } from './socialPublishingWorker';
import { getTenantSocialPlatformCapability } from '../social-publishing/registry';
import type { SocialPlatform } from '../social-publishing/types';
import { logger } from '../middleware/logger';

const FACEBOOK_PLATFORM: SocialPlatform = 'FACEBOOK_PAGE';
const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type AutoPostingCandidate = {
  sourceType: 'LISTING' | 'PROJECT';
  sourceId: string;
  images: unknown;
  lastFacebookPublishedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export function localDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Number(parts.find(part => part.type === 'hour')?.value || 0) * 60
    + Number(parts.find(part => part.type === 'minute')?.value || 0);
}

function inTimeWindow(settings: AutoPostingSettings, now = new Date()): boolean {
  const minutes = localMinutes(now);
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
    .filter(platform => platform === FACEBOOK_PLATFORM);
  return {
    ...settings,
    postsPerDay: 1,
    timeWindows: [{ start: '18:30', end: '23:59' }],
    platforms: platforms.length ? platforms : [FACEBOOK_PLATFORM],
  };
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function eligibleCandidates(pool: Pool, tenantId: string): Promise<AutoPostingCandidate[]> {
  const result = await pool.query(
    `WITH candidate_rows AS (
       SELECT 'LISTING'::text AS source_type,
              l.id AS source_id,
              l.images AS images,
              l.updated_at AS updated_at,
              l.created_at AS created_at,
              (
                SELECT MAX(t.published_at)
                  FROM social_publications sp
                  JOIN social_publication_targets t ON t.publication_id = sp.id
                 WHERE sp.tenant_id::uuid = l.tenant_id
                   AND sp.listing_id = l.id
                   AND t.platform = 'FACEBOOK_PAGE'
                   AND t.status = 'PUBLISHED'
              ) AS last_facebook_published_at
         FROM listings l
         LEFT JOIN projects p
           ON p.tenant_id = l.tenant_id
          AND (p.id = l.project_id
               OR (l.project_id IS NULL AND l.project_code IS NOT NULL AND UPPER(p.code) = UPPER(l.project_code)))
        WHERE l.tenant_id = $1
          AND UPPER(l.status) = ANY($2::text[])
          AND (p.id IS NULL OR UPPER(p.status) = ANY($3::text[]))

       UNION ALL

       SELECT 'PROJECT'::text AS source_type,
              p.id AS source_id,
              p.metadata AS images,
              p.updated_at AS updated_at,
              p.created_at AS created_at,
              (
                SELECT MAX(t.published_at)
                  FROM social_publications sp
                  JOIN social_publication_targets t ON t.publication_id = sp.id
                 WHERE sp.tenant_id::uuid = p.tenant_id
                   AND sp.project_id = p.id
                   AND t.platform = 'FACEBOOK_PAGE'
                   AND t.status = 'PUBLISHED'
              ) AS last_facebook_published_at
         FROM projects p
        WHERE p.tenant_id = $1
          AND UPPER(p.status) = ANY($3::text[])
     )
     SELECT *
       FROM candidate_rows
      ORDER BY last_facebook_published_at ASC NULLS FIRST,
               updated_at ASC NULLS FIRST,
               created_at ASC NULLS FIRST,
               source_type ASC,
               source_id ASC`,
    [
      tenantId,
      Array.from(PUBLISHABLE_LISTING_STATUSES),
      Array.from(PUBLISHABLE_PROJECT_STATUSES),
    ],
  );
  return result.rows.map(row => ({
    sourceType: row.source_type,
    sourceId: String(row.source_id),
    images: jsonValue(row.images),
    lastFacebookPublishedAt: row.last_facebook_published_at || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  }));
}

function listingImages(value: unknown): string[] {
  return normalizePublicationImages(jsonValue(value));
}

function projectImages(value: unknown): string[] {
  const metadata = jsonValue(value);
  if (!metadata || typeof metadata !== 'object') return [];
  const record = metadata as Record<string, unknown>;
  return normalizePublicationImages([
    record.coverImage,
    record.cover_image,
    ...(Array.isArray(record.gallery) ? record.gallery : []),
  ]);
}

export async function runAutoPostingForTenant(
  pool: Pool,
  tenantId: string,
  now = new Date(),
) {
  const settings = normalizeSettings(await getAutoPostingSettings(pool, tenantId));
  if (!settings.enabled || !inTimeWindow(settings, now)) {
    return { created: 0, published: 0, skipped: 0, reason: 'DISABLED_OR_OUTSIDE_WINDOW' };
  }

  const logicalDayKey = localDayKey(now);
  const run = await claimMarketingFacebookDailyRun(pool, tenantId, logicalDayKey);
  if (!run) {
    return { created: 0, published: 0, skipped: 0, reason: 'DAILY_RUN_ALREADY_CLAIMED' };
  }

  try {
    const capability = await getTenantSocialPlatformCapability(FACEBOOK_PLATFORM, tenantId);
    if (capability.status !== 'READY' || !capability.canPublish) {
      const reason = capability.reason || 'Facebook Page chưa sẵn sàng để đăng tự động.';
      await finishMarketingFacebookDailyRun(pool, run.id, {
        status: 'SKIPPED',
        result: { reason: 'FACEBOOK_NOT_READY', checkedAt: new Date().toISOString() },
        errorCode: 'FACEBOOK_NOT_READY',
        errorMessage: reason,
      });
      logger.warn(`[MarketingAgent] ${tenantId}: ${reason}`);
      return { created: 0, published: 0, skipped: 1, reason: 'FACEBOOK_NOT_READY', warning: reason };
    }

    const candidates = await eligibleCandidates(pool, tenantId);
    const candidate = candidates.find(item => (
      item.sourceType === 'LISTING'
        ? listingImages(item.images).length > 0
        : projectImages(item.images).length > 0
    ));
    if (!candidate) {
      const reason = 'Hôm nay không có listing hoặc dự án ACTIVE đủ điều kiện và có ít nhất một ảnh HTTPS để đăng Facebook.';
      await finishMarketingFacebookDailyRun(pool, run.id, {
        status: 'SKIPPED',
        result: {
          reason: 'NO_ELIGIBLE_SOURCE',
          candidatesChecked: candidates.length,
          checkedAt: new Date().toISOString(),
        },
        errorCode: 'NO_ELIGIBLE_SOURCE',
        errorMessage: reason,
      });
      logger.warn(`[MarketingAgent] ${tenantId}: ${reason}`);
      return { created: 0, published: 0, skipped: 1, reason: 'NO_ELIGIBLE_SOURCE', warning: reason };
    }

    const snapshot = candidate.sourceType === 'LISTING'
      ? await buildSocialProductSnapshot(tenantId, candidate.sourceId)
      : await buildSocialProjectSnapshot(tenantId, candidate.sourceId);
    const images = candidate.sourceType === 'LISTING'
      ? listingImages(candidate.images)
      : normalizePublicationImages('images' in snapshot ? snapshot.images : []);
    if (!images.length) {
      const reason = 'Nguồn được chọn không còn ảnh HTTPS hợp lệ khi tạo snapshot.';
      await finishMarketingFacebookDailyRun(pool, run.id, {
        status: 'SKIPPED',
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        result: { reason: 'SOURCE_IMAGES_CHANGED', checkedAt: new Date().toISOString() },
        errorCode: 'SOURCE_IMAGES_CHANGED',
        errorMessage: reason,
      });
      logger.warn(`[MarketingAgent] ${tenantId}: ${reason}`);
      return { created: 0, published: 0, skipped: 1, reason: 'SOURCE_IMAGES_CHANGED', warning: reason };
    }

    const content = buildPlatformContent(snapshot, FACEBOOK_PLATFORM, images);
    const publication = await createSocialPublication(pool, {
      tenantId,
      listingId: candidate.sourceType === 'LISTING' ? candidate.sourceId : null,
      projectId: candidate.sourceType === 'PROJECT' ? candidate.sourceId : null,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { ...snapshot, caption: content.text },
      assetSnapshot: images,
      platforms: [FACEBOOK_PLATFORM],
      source: 'AUTO',
      autoPostingKey: `${logicalDayKey}:${candidate.sourceType}:${candidate.sourceId}`,
    });
    await recordSocialPublicationEvent(pool, {
      tenantId,
      publicationId: publication.id,
      eventType: 'AUTO_PUBLICATION_CREATED',
      toStatus: 'DRAFT',
      reason: 'Agent Marketing chọn nguồn theo vòng quay Facebook và tạo snapshot tự động.',
      metadata: {
        source: 'AUTO',
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        logicalDay: logicalDayKey,
        imageCount: images.length,
        lastFacebookPublishedAt: candidate.lastFacebookPublishedAt,
      },
    });

    const activated = await activateSocialPublication(pool, tenantId, publication.id);
    if (!activated) throw new Error('Không thể chuyển publication tự động sang trạng thái xử lý');
    await markSocialTargetsPending(pool, tenantId, publication.id);
    await recordSocialPublicationEvent(pool, {
      tenantId,
      publicationId: publication.id,
      eventType: 'AUTO_PUBLICATION_ACTIVATED',
      fromStatus: 'DRAFT',
      toStatus: 'PROCESSING',
      reason: 'Agent Marketing đăng thẳng qua pipeline Facebook đã xác minh, không chờ duyệt thủ công.',
      metadata: { source: 'AUTO', logicalDay: logicalDayKey },
    });

    const delivery = await processSocialPublicationTick(pool, 1);
    const deliveryFailed = Number(delivery.failed || 0) > 0;
    await finishMarketingFacebookDailyRun(pool, run.id, {
      status: deliveryFailed ? 'FAILED' : 'SUCCESS',
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      publicationId: publication.id,
      result: {
        reason: deliveryFailed ? 'FACEBOOK_DELIVERY_FAILED' : 'PUBLICATION_QUEUED',
        delivery,
        imageCount: images.length,
        selectedAt: new Date().toISOString(),
      },
      ...(deliveryFailed
        ? {
            errorCode: 'FACEBOOK_DELIVERY_FAILED',
            errorMessage: `Worker Facebook báo ${delivery.failed} target thất bại.`,
          }
        : {}),
    });
    return {
      created: 1,
      published: delivery.published,
      skipped: delivery.skipped ? 1 : 0,
      reason: deliveryFailed ? 'PUBLISH_FAILED' : 'OK',
      publicationId: publication.id,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      delivery,
    };
  } catch (error: any) {
    const message = String(error?.message || 'Agent Marketing đăng Facebook thất bại').slice(0, 1000);
    await finishMarketingFacebookDailyRun(pool, run.id, {
      status: 'FAILED',
      result: { reason: 'ERROR', failedAt: new Date().toISOString() },
      errorCode: String(error?.code || 'MARKETING_AGENT_ERROR'),
      errorMessage: message,
    }).catch(finishError => logger.error('[MarketingAgent] Failed to persist daily run failure', finishError));
    logger.error(`[MarketingAgent] tenant ${tenantId} failed`, error);
    return { created: 0, published: 0, skipped: 0, reason: 'ERROR', warning: message };
  }
}
export async function runAutoPostingTick(pool: Pool, now = new Date()) {
  const tenants = await listEnabledAutoPostingTenants(pool);
  const results = [];
  for (const tenantId of tenants) {
    results.push({ tenantId, ...(await runAutoPostingForTenant(pool, tenantId, now)) });
  }
  return results;
}

let schedulerStarted = false;
export function startAutoPostingScheduler(pool: Pool) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = () => runAutoPostingTick(pool).catch(error => logger.error('[MarketingAgent] tick failed', error));
  const scheduleNextRun = () => {
    const now = new Date();
    const today = localDayKey(now);
    let nextRun = new Date(`${today}T18:30:00+07:00`);
    if (nextRun.getTime() <= now.getTime()) {
      const tomorrow = new Date(nextRun.getTime() + 24 * 60 * 60 * 1000);
      nextRun = new Date(`${localDayKey(tomorrow)}T18:30:00+07:00`);
    }
    const timer = setTimeout(() => {
      tick();
      scheduleNextRun();
    }, Math.max(1_000, nextRun.getTime() - now.getTime()));
    timer.unref?.();
  };
  scheduleNextRun();
  logger.info(`[MarketingAgent] Facebook daily scheduler started (18:30, timezone=${DEFAULT_TIME_ZONE})`);
}
