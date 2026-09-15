import type { Pool } from 'pg';
import {
  activateSocialPublication,
  createSocialPublication,
  markSocialTargetsPending,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  countAutoPostingRunsToday,
  claimMarketingFacebookBackfillRun,
  claimMarketingFacebookDailyRun,
  createMarketingFacebookBackfillRequest,
  finishMarketingFacebookBackfillRequest,
  finishMarketingFacebookDailyRun,
  getMarketingFacebookBackfillRequest,
  getAutoPostingSettings,
  getNextAutoPostingSlotIndex,
  listEnabledAutoPostingTenants,
  markMarketingFacebookBackfillRunning,
  upsertAutoPostingSettings,
  type AutoPostingSettings,
  type AutoPostingTimeWindow,
} from '../repositories/autoPostingRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import {
  buildPlatformContent,
  buildSocialProductSnapshot,
  buildSocialProjectSnapshot,
  getSocialProjectImageCandidates,
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
const ZALO_PLATFORM: SocialPlatform = 'ZALO_BROADCAST';
const INSTAGRAM_PLATFORM: SocialPlatform = 'INSTAGRAM';
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

const MIN_READY_PLATFORMS_FOR_BOOST = 2;
const CONTENT_WEEKS_REQUIRED = 3;
const BASE_POSTS_PER_DAY = 1;
const BASE_TIME_WINDOWS: AutoPostingTimeWindow[] = [{ start: '18:30', end: '23:59' }];
const EXPANDED_TIME_WINDOWS: Record<number, AutoPostingTimeWindow[]> = {
  2: [
    { start: '09:00', end: '11:30' },
    { start: '18:30', end: '21:30' },
  ],
  3: [
    { start: '09:00', end: '10:30' },
    { start: '13:00', end: '15:00' },
    { start: '18:30', end: '21:30' },
  ],
};
const STALE_NOT_READY_HOURS = 6;
const STALE_NOT_READY_TITLE = [77,7897,116,32,107,234,110,104,32,273,259,110,103,32,98,224,105,32,273,97,110,103,32,107,7865,116,32,7903,32,116,114,7841,110,103,32,116,104,225,105,32,99,104,432,97,32,115,7861,110,32,115,224,110,103].map(function (c) { return String.fromCharCode(c); }).join('');
const STALE_NOT_READY_BODY_PREFIX = [78,7873,110,32,116,7843,110,103,32].map(function (c) { return String.fromCharCode(c); }).join('');
const STALE_NOT_READY_BODY_MID1 = [32,99,7911,97,32,112,117,98,108,105,99,97,116,105,111,110,32].map(function (c) { return String.fromCharCode(c); }).join('');
const STALE_NOT_READY_BODY_MID2 = [32,118,7851,110,32,78,79,84,95,82,69,65,68,89,32,116,7915,32].map(function (c) { return String.fromCharCode(c); }).join('');
const STALE_NOT_READY_BODY_MID3 = [44,32,113,117,225,32].map(function (c) { return String.fromCharCode(c); }).join('');
const STALE_NOT_READY_BODY_SUFFIX = [32,103,105,7901,46,32,86,117,105,32,108,242,110,103,32,107,105,7875,109,32,116,114,97,32,107,7871,116,32,110,7889,105,47,113,117,121,7873,110,32,273,259,110,103,32,98,224,105,46].map(function (c) { return String.fromCharCode(c); }).join('');

type AutoPostingReadiness = {
  readyPlatforms: SocialPlatform[];
  eligibleContentCount: number;
};

// Evaluate multi-platform posting readiness for a tenant: how many
// platforms are connected and can really publish, plus how much eligible
// content (listings/projects with images) is available. Used to decide
// whether posts_per_day can safely go up.
async function evaluateAutoPostingReadiness(pool: Pool, tenantId: string): Promise<AutoPostingReadiness> {
  const readyPlatforms: SocialPlatform[] = [];
  for (const platform of [FACEBOOK_PLATFORM, INSTAGRAM_PLATFORM, ZALO_PLATFORM]) {
    const capability = await getTenantSocialPlatformCapability(platform, tenantId);
    if (capability.status === 'READY' && capability.canPublish) readyPlatforms.push(platform);
  }
  const candidates = await eligibleCandidates(pool, tenantId);
  const eligibleContentCount = candidates.filter(item => (
    item.sourceType === 'LISTING'
      ? listingImages(item.images).length > 0
      : projectImages(item.images).length > 0
  )).length;
  return { readyPlatforms, eligibleContentCount };
}

// Automatically raise or lower posts_per_day and the posting time windows
// based on readiness, persisting the change when it happens. Only raises
// above 1 post/day when: (1) at least 2 platforms are READY, and (2) the
// eligible content pool is large enough to last several weeks at the new
// rate. When conditions regress, cadence is lowered back automatically.
async function computeEffectiveSettings(
  pool: Pool,
  tenantId: string,
  settings: AutoPostingSettings,
): Promise<AutoPostingSettings> {
  if (!settings.enabled) {
    const platforms = normalizeSocialPlatforms(settings.platforms)
      .filter(platform => platform === FACEBOOK_PLATFORM || platform === ZALO_PLATFORM || platform === INSTAGRAM_PLATFORM);
    return { ...settings, platforms: platforms.length ? platforms : [FACEBOOK_PLATFORM] };
  }

  const { readyPlatforms, eligibleContentCount } = await evaluateAutoPostingReadiness(pool, tenantId);

  let targetPostsPerDay = BASE_POSTS_PER_DAY;
  if (readyPlatforms.length >= MIN_READY_PLATFORMS_FOR_BOOST) {
    for (const rate of [3, 2]) {
      const weeksOfContent = eligibleContentCount / (rate * 7);
      if (weeksOfContent >= CONTENT_WEEKS_REQUIRED) {
        targetPostsPerDay = rate;
        break;
      }
    }
  }
  const targetTimeWindows = targetPostsPerDay > 1
    ? (EXPANDED_TIME_WINDOWS[targetPostsPerDay] || BASE_TIME_WINDOWS)
    : BASE_TIME_WINDOWS;
  const targetPlatforms = readyPlatforms.length ? readyPlatforms : [FACEBOOK_PLATFORM];

  const changed = targetPostsPerDay !== settings.postsPerDay
    || JSON.stringify(targetTimeWindows) !== JSON.stringify(settings.timeWindows)
    || JSON.stringify([...targetPlatforms].sort()) !== JSON.stringify([...settings.platforms].sort());

  if (changed) {
    logger.info(
      `[MarketingAgent] ${tenantId}: auto-adjusting cadence - `
      + `posts_per_day ${settings.postsPerDay} -> ${targetPostsPerDay}, `
      + `windows ${JSON.stringify(settings.timeWindows)} -> ${JSON.stringify(targetTimeWindows)}, `
      + `platforms ${JSON.stringify(settings.platforms)} -> ${JSON.stringify(targetPlatforms)} `
      + `(readyPlatforms=${readyPlatforms.length}, eligibleContent=${eligibleContentCount}).`,
    );
    await upsertAutoPostingSettings(pool, tenantId, {
      postsPerDay: targetPostsPerDay,
      timeWindows: targetTimeWindows,
      platforms: targetPlatforms,
    });
  }

  return { ...settings, postsPerDay: targetPostsPerDay, timeWindows: targetTimeWindows, platforms: targetPlatforms };
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function eligibleCandidates(
  pool: Pool,
  tenantId: string,
  logicalDay?: string,
): Promise<AutoPostingCandidate[]> {
  const autoPostingPrefix = logicalDay ? `${logicalDay}:%` : null;
  const result = await pool.query(
    `WITH candidate_rows AS (
       SELECT 'LISTING'::text AS source_type,
              l.id AS source_id,
              l.images AS images,
              l.updated_at AS updated_at,
              l.created_at AS created_at,
                CASE WHEN p.id IS NOT NULL THEN 0 ELSE 1 END AS priority,
              (
                SELECT MAX(t.published_at)
                  FROM social_publications sp
                  JOIN social_publication_targets t ON t.publication_id = sp.id
                 WHERE sp.tenant_id = l.tenant_id::text
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
           AND (
             $4::text IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM social_publications prior
                WHERE prior.tenant_id = l.tenant_id::text
                  AND prior.source = 'AUTO'
                  AND prior.auto_posting_key LIKE $4
                  AND prior.listing_id = l.id
             )
           )

       UNION ALL

       SELECT 'PROJECT'::text AS source_type,
              p.id AS source_id,
              p.metadata AS images,
              p.updated_at AS updated_at,
              p.created_at AS created_at,
                0 AS priority,
              (
                SELECT MAX(t.published_at)
                  FROM social_publications sp
                  JOIN social_publication_targets t ON t.publication_id = sp.id
                 WHERE sp.tenant_id = p.tenant_id::text
                   AND sp.project_id = p.id
                   AND t.platform = 'FACEBOOK_PAGE'
                   AND t.status = 'PUBLISHED'
              ) AS last_facebook_published_at
         FROM projects p
        WHERE p.tenant_id = $1
          AND UPPER(p.status) = ANY($3::text[])
          AND (
            $4::text IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM social_publications prior
               WHERE prior.tenant_id = p.tenant_id::text
                 AND prior.source = 'AUTO'
                 AND prior.auto_posting_key LIKE $4
                 AND prior.project_id = p.id
            )
          )
     )
     SELECT *
       FROM candidate_rows
      ORDER BY priority ASC,
                 last_facebook_published_at ASC NULLS FIRST,
               updated_at ASC NULLS FIRST,
               created_at ASC NULLS FIRST,
               source_type ASC,
               source_id ASC`,
    [
      tenantId,
      Array.from(PUBLISHABLE_LISTING_STATUSES),
      Array.from(PUBLISHABLE_PROJECT_STATUSES),
      autoPostingPrefix,
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
  return normalizePublicationImages(getSocialProjectImageCandidates(metadata));
}

type AutoPostingResult = {
  created: number;
  published: number;
  skipped: number;
  reason: string;
  warning?: string;
  publicationId?: string;
  sourceType?: 'LISTING' | 'PROJECT';
  sourceId?: string;
  delivery?: Record<string, unknown>;
  backfillRequestId?: string;
  backfillStatus?: string;
};

export async function runAutoPostingForTenant(
  pool: Pool,
  tenantId: string,
  now = new Date(),
  options?: {
    logicalDay?: string;
    mode?: 'DAILY' | 'BACKFILL';
    backfillRequestId?: string;
    backfillReason?: string;
    requestedBy?: string;
    slotIndex?: number;
  },
): Promise<AutoPostingResult> {
  const settings = await computeEffectiveSettings(pool, tenantId, await getAutoPostingSettings(pool, tenantId));
  const isBackfill = options?.mode === 'BACKFILL';
  const slotIndex = isBackfill ? 0 : (options?.slotIndex ?? 0);
  if (!settings.enabled || (!isBackfill && !inTimeWindow(settings, now))) {
    const result = { created: 0, published: 0, skipped: 0, reason: 'DISABLED_OR_OUTSIDE_WINDOW' };
    if (options?.backfillRequestId) {
      await finishMarketingFacebookBackfillRequest(pool, options.backfillRequestId, {
        status: 'SKIPPED',
        result,
        errorCode: result.reason,
        errorMessage: 'Cấu hình tự động đăng đang tắt.',
      });
    }
    return result;
  }

  const logicalDayKey = options?.logicalDay || localDayKey(now);
  let run;
  if (isBackfill) {
    if (!options?.backfillRequestId) throw new Error('Backfill request ID là bắt buộc');
    await markMarketingFacebookBackfillRunning(pool, options.backfillRequestId);
    const claim = await claimMarketingFacebookBackfillRun(pool, tenantId, logicalDayKey);
    if (claim.kind === 'BLOCKED') {
      await finishMarketingFacebookBackfillRequest(pool, options.backfillRequestId, {
        status: 'BLOCKED',
        result: { reason: claim.errorCode, logicalDay: logicalDayKey },
        errorCode: claim.errorCode,
        errorMessage: claim.reason,
      });
      return { created: 0, published: 0, skipped: 0, reason: claim.errorCode, warning: claim.reason };
    }
    run = claim.run;
  } else {
    run = await claimMarketingFacebookDailyRun(pool, tenantId, logicalDayKey, slotIndex);
    if (!run) {
      return { created: 0, published: 0, skipped: 0, reason: 'DAILY_RUN_ALREADY_CLAIMED' };
    }
  }

  const finishRun = async (update: Parameters<typeof finishMarketingFacebookDailyRun>[2]) => {
    const result = {
      ...(update.result || {}),
      ...(isBackfill
        ? {
            mode: 'BACKFILL',
            logicalDay: logicalDayKey,
            backfillReason: options?.backfillReason,
            requestedBy: options?.requestedBy,
          }
        : {}),
    };
    const finished = await finishMarketingFacebookDailyRun(pool, run.id, { ...update, result });
    if (options?.backfillRequestId) {
      await finishMarketingFacebookBackfillRequest(pool, options.backfillRequestId, {
        status: update.status,
        result,
        errorCode: update.errorCode,
        errorMessage: update.errorMessage,
      });
    }
    return finished;
  };

  try {
    const capabilityChecks: Array<{ platform: SocialPlatform; status: string; canPublish: boolean; reason: string }> = [];
    const readyPlatforms: SocialPlatform[] = [];
    for (const platform of settings.platforms as SocialPlatform[]) {
      const capability = await getTenantSocialPlatformCapability(platform, tenantId);
      capabilityChecks.push({ platform, status: capability.status, canPublish: capability.canPublish, reason: capability.reason });
      if (capability.status === 'READY' && capability.canPublish) readyPlatforms.push(platform);
    }
    const capability = { status: readyPlatforms.length ? 'READY' : 'NOT_READY', canPublish: readyPlatforms.length > 0, reason: capabilityChecks.map(item => item.platform + '=' + item.status).join(', ') };
    if (capability.status !== 'READY' || !capability.canPublish) {
      const reason = capability.reason || 'Facebook Page chưa sẵn sàng để đăng tự động.';
      await finishRun({
        status: 'SKIPPED',
        result: { reason: 'NO_READY_PLATFORM', checks: capabilityChecks, checkedAt: new Date().toISOString() },
        errorCode: 'NO_READY_PLATFORM',
        errorMessage: reason,
      });
      logger.warn(`[MarketingAgent] ${tenantId}: ${reason}`);
      return { created: 0, published: 0, skipped: 1, reason: 'NO_READY_PLATFORM', warning: reason };
    }

    const candidates = await eligibleCandidates(pool, tenantId, logicalDayKey);
    const candidate = candidates.find(item => (
      item.sourceType === 'LISTING'
        ? listingImages(item.images).length > 0
        : projectImages(item.images).length > 0
    ));
    if (!candidate) {
      const reason = 'Hôm nay không có listing hoặc dự án ACTIVE đủ điều kiện và có ít nhất một ảnh HTTPS để đăng Facebook.';
      await finishRun({
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
      await finishRun({
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
      platforms: readyPlatforms,
      source: 'AUTO',
      autoPostingKey: `${logicalDayKey}:${slotIndex}:${candidate.sourceType}:${candidate.sourceId}`,
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
    await finishRun({
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
    await finishRun({
      status: 'FAILED',
      result: { reason: 'ERROR', failedAt: new Date().toISOString() },
      errorCode: String(error?.code || 'MARKETING_AGENT_ERROR'),
      errorMessage: message,
    }).catch(finishError => logger.error('[MarketingAgent] Failed to persist daily run failure', finishError));
    logger.error(`[MarketingAgent] tenant ${tenantId} failed`, error);
    return { created: 0, published: 0, skipped: 0, reason: 'ERROR', warning: message };
  }
}

export async function runAutoPostingBackfill(
  pool: Pool,
  tenantId: string,
  logicalDay: string,
  reason: string,
  requestedBy: string,
  now = new Date(),
) {
  const request = await createMarketingFacebookBackfillRequest(pool, {
    tenantId,
    logicalDay,
    reason,
    requestedBy,
  });
  if (!request.created) {
    return {
      created: 0,
      published: 0,
      skipped: 0,
      reason: 'BACKFILL_ALREADY_REQUESTED',
      backfillRequestId: request.request.id,
      backfillStatus: request.request.status,
    };
  }
  try {
    const result = await runAutoPostingForTenant(pool, tenantId, now, {
      mode: 'BACKFILL',
      logicalDay,
      backfillRequestId: request.request.id,
      backfillReason: reason,
      requestedBy,
    });
    return { ...result, backfillRequestId: request.request.id };
  } catch (error: any) {
    const message = String(error?.message || 'Không thể chạy bù bài Marketing').slice(0, 1000);
    await finishMarketingFacebookBackfillRequest(pool, request.request.id, {
      status: 'FAILED',
      result: { reason: 'ERROR', logicalDay },
      errorCode: String(error?.code || 'MARKETING_BACKFILL_ERROR'),
      errorMessage: message,
    }).catch(finishError => logger.error('[MarketingAgent] Failed to persist backfill failure', finishError));
    logger.error(`[MarketingAgent] backfill tenant ${tenantId} failed`, error);
    return {
      created: 0,
      published: 0,
      skipped: 0,
      reason: 'ERROR',
      warning: message,
      backfillRequestId: request.request.id,
    };
  }
}

export async function runAutoPostingTick(pool: Pool, now = new Date()) {
  const tenants = await listEnabledAutoPostingTenants(pool);
  const results = [];
  const logicalDayKey = localDayKey(now);
  for (const tenantId of tenants) {
    const settings = await computeEffectiveSettings(pool, tenantId, await getAutoPostingSettings(pool, tenantId));
    if (!settings.enabled || !inTimeWindow(settings, now)) continue;
    const postsAttemptedToday = await countAutoPostingRunsToday(pool, tenantId, logicalDayKey);
    if (postsAttemptedToday >= settings.postsPerDay) continue;
    const slotIndex = await getNextAutoPostingSlotIndex(pool, tenantId, logicalDayKey);
    results.push({
      tenantId,
      ...(await runAutoPostingForTenant(pool, tenantId, now, { logicalDay: logicalDayKey, slotIndex })),
    });
  }
  await checkStaleNotReadySocialTargets(pool).catch(error => (
    logger.error('[MarketingAgent] stale NOT_READY check failed', error)
  ));
  return results;
}

export async function runAutoPostingCatchUp(pool: Pool, now = new Date()): Promise<void> {
  const today = localDayKey(now);
  const currentMinutes = localMinutes(now);
  const tenants = await listEnabledAutoPostingTenants(pool);
  for (const tenantId of tenants) {
    const settings = await computeEffectiveSettings(pool, tenantId, await getAutoPostingSettings(pool, tenantId));
    if (!settings.enabled) continue;
    const validWindows = settings.timeWindows
      .map(window => {
        const [startHour, startMinute] = String(window.start || '').split(':').map(Number);
        const [endHour, endMinute] = String(window.end || '').split(':').map(Number);
        return {
          start: startHour * 60 + startMinute,
          end: endHour * 60 + endMinute,
          valid: [startHour, startMinute, endHour, endMinute].every(Number.isFinite),
        };
      })
      .filter(window => window.valid);
    if (!validWindows.length) continue;
    const earliestWindowStart = validWindows.reduce((min, window) => Math.min(min, window.start), 24 * 60);
    const lastWindowEndMinutes = validWindows.reduce((max, window) => {
      if (window.end >= window.start) return Math.max(max, window.end);
      return Math.max(max, window.end);
    }, -1);
    const previousDay = localDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    // A failed request for today's scheduled day is safe to retry as soon as
    // the posting window opens. The backfill claim still blocks any uncertain
    // or already-delivered provider target.
    const todayBackfill = await getMarketingFacebookBackfillRequest(pool, tenantId, today);
    if (todayBackfill?.status === 'FAILED' && currentMinutes >= earliestWindowStart) {
      logger.info(`[MarketingAgent] Catch-up: retrying failed backfill for tenant ${tenantId}, day ${today}.`);
      const result = await runAutoPostingBackfill(
        pool,
        tenantId,
        today,
        'BOOT_CATCHUP_RETRY',
        'system:auto-scheduler',
        now,
      );
      logger.info('[MarketingAgent] Catch-up retry result: ' + JSON.stringify(result));
      continue;
    }

    // Before today's first window, a process that missed yesterday's trigger
    // should reconcile yesterday rather than waiting for today's date to end.
    const catchUpDay = currentMinutes < earliestWindowStart
      ? previousDay
      : currentMinutes >= lastWindowEndMinutes
        ? today
        : null;
    if (!catchUpDay) continue;

    const existingBackfill = catchUpDay === today
      ? todayBackfill
      : await getMarketingFacebookBackfillRequest(pool, tenantId, catchUpDay);
    if (existingBackfill?.status === 'FAILED') {
      logger.info(`[MarketingAgent] Catch-up: retrying failed backfill for tenant ${tenantId}, day ${catchUpDay}.`);
      const result = await runAutoPostingBackfill(
        pool,
        tenantId,
        catchUpDay,
        'BOOT_CATCHUP_RETRY',
        'system:auto-scheduler',
        now,
      );
      logger.info('[MarketingAgent] Catch-up retry result: ' + JSON.stringify(result));
      continue;
    }

    const postsAttemptedToday = await countAutoPostingRunsToday(pool, tenantId, catchUpDay);
    if (postsAttemptedToday > 0) continue;
    logger.info(`[MarketingAgent] Catch-up: tenant ${tenantId} has no posting attempt for ${catchUpDay}, running backfill slot 0.`);
    const result = await runAutoPostingBackfill(pool, tenantId, catchUpDay, 'BOOT_CATCHUP', 'system:auto-scheduler', now);
    logger.info('[MarketingAgent] Catch-up result: ' + JSON.stringify(result));
  }
}

async function checkStaleNotReadySocialTargets(pool: Pool): Promise<void> {
  const result = await pool.query(
    `SELECT t.id, t.tenant_id, t.publication_id, t.platform, t.created_at
       FROM social_publication_targets t
      WHERE t.status = 'NOT_READY'
        AND t.created_at <= NOW() - make_interval(hours => $1)
      ORDER BY t.created_at ASC
      LIMIT 200`,
    [STALE_NOT_READY_HOURS],
  );
  for (const row of result.rows) {
    const createdAtIso = new Date(row.created_at).toISOString();
    try {
      await notificationRepository.createForTenantAdmins(String(row.tenant_id), {
        type: 'SOCIAL_PUBLICATION_TARGET_STALE_NOT_READY',
        title: STALE_NOT_READY_TITLE,
        body: STALE_NOT_READY_BODY_PREFIX + row.platform + STALE_NOT_READY_BODY_MID1 + row.publication_id + STALE_NOT_READY_BODY_MID2 + createdAtIso + STALE_NOT_READY_BODY_MID3 + STALE_NOT_READY_HOURS + STALE_NOT_READY_BODY_SUFFIX,
        metadata: {
          transitionEventId: String(row.id),
          targetId: String(row.id),
          publicationId: String(row.publication_id),
          platform: row.platform,
          createdAt: createdAtIso,
        },
        dedupeKey: String(row.id),
      });
    } catch (error) {
      logger.error(`[MarketingAgent] failed to send stale NOT_READY alert for target ${row.id}`, error);
    }
  }
}

let schedulerStarted = false;
export function startAutoPostingScheduler(pool: Pool) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const TICK_INTERVAL_MS = 10 * 60 * 1000;
  const tick = () => runAutoPostingTick(pool).catch(error => logger.error('[MarketingAgent] tick failed', error));
  const tickTimer = setInterval(() => { void tick(); }, TICK_INTERVAL_MS);
  tickTimer.unref?.();
  const catchUpMissedTodayRun = async () => {
    try {
      await runAutoPostingCatchUp(pool, new Date());
    } catch (error: any) {
      logger.error('[MarketingAgent] Boot catch-up failed', error);
    }
  };
  const catchUpGuard = setInterval(() => {
    void catchUpMissedTodayRun();
  }, 15 * 60 * 1000);
  catchUpGuard.unref?.();
  void catchUpMissedTodayRun();
  void tick();
  logger.info(`[MarketingAgent] Scheduler started (tick every ${TICK_INTERVAL_MS / 60000} min, timezone=${DEFAULT_TIME_ZONE})`);
}
