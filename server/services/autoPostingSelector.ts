import type { Pool } from 'pg';
import {
  activateSocialPublication,
  createSocialPublication,
  markSocialTargetsPending,
  recordSocialPublicationEvent,
} from '../repositories/socialPublicationRepository';
import {
  claimMarketingFacebookBackfillRun,
  claimMarketingFacebookDailyRun,
  createMarketingFacebookBackfillRequest,
  finishMarketingFacebookBackfillRequest,
  finishMarketingFacebookDailyRun,
  getAutoPostingSettings,
  listEnabledAutoPostingTenants,
  markMarketingFacebookBackfillRunning,
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

function normalizeSettings(settings: AutoPostingSettings): AutoPostingSettings {
  const platforms = normalizeSocialPlatforms(settings.platforms)
    .filter(platform => platform === FACEBOOK_PLATFORM || platform === ZALO_PLATFORM || platform === INSTAGRAM_PLATFORM);
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
      ORDER BY last_facebook_published_at ASC NULLS FIRST,
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
  if (!metadata || typeof metadata !== 'object') return [];
  const record = metadata as Record<string, unknown>;
  return normalizePublicationImages([
    record.coverImage,
    record.cover_image,
    ...(Array.isArray(record.gallery) ? record.gallery : []),
  ]);
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
  },
): Promise<AutoPostingResult> {
  const settings = normalizeSettings(await getAutoPostingSettings(pool, tenantId));
  const isBackfill = options?.mode === 'BACKFILL';
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
    run = await claimMarketingFacebookDailyRun(pool, tenantId, logicalDayKey);
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
  const catchUpMissedTodayRun = async () => {
    try {
      const now = new Date();
      const today = localDayKey(now);
      if (new Date(today + 'T18:30:00+07:00').getTime() > now.getTime()) return;
      const tenants = await listEnabledAutoPostingTenants(pool);
      for (const tenantId of tenants) {
        const existing = await pool.query(
          "SELECT status FROM marketing_facebook_daily_runs WHERE tenant_id = $1 AND logical_day = $2::date ORDER BY started_at DESC LIMIT 1",
          [tenantId, today],
        );
        const currentStatus = existing.rows[0]?.status || 'NOT_RUN';
        if (currentStatus === 'SUCCESS' || currentStatus === 'RUNNING') continue;
        logger.info('[MarketingAgent] Boot catch-up: running missed Facebook job for tenant ' + tenantId + ', day ' + today + ' (current status: ' + currentStatus + ')');
        const result = await runAutoPostingBackfill(pool, tenantId, today, 'BOOT_CATCHUP', 'system:auto-scheduler', now);
        logger.info('[MarketingAgent] Boot catch-up result: ' + JSON.stringify(result));
      }
    } catch (error: any) {
      logger.error('[MarketingAgent] Boot catch-up failed', error);
    }
  };
  const catchUpGuard = setInterval(() => {
    void catchUpMissedTodayRun();
  }, 15 * 60 * 1000);
  catchUpGuard.unref?.();
  void catchUpMissedTodayRun();
  scheduleNextRun();
  logger.info(`[MarketingAgent] Facebook daily scheduler started (18:30, timezone=${DEFAULT_TIME_ZONE})`);
}
