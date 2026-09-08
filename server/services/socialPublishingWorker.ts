import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import {
  getSocialPublisher,
  getTenantSocialPlatformCapability,
} from '../social-publishing/registry';
import {
  claimDueSocialTargets,
  getPublicationForTarget,
  recordSocialAttempt,
  updateSocialTarget,
} from '../repositories/socialPublicationRepository';
import { buildPlatformContent } from './socialPublicationService';
import type { SocialPlatform } from '../social-publishing/types';

let inFlight = false;
let timer: NodeJS.Timeout | null = null;

function retryAt(attemptCount: number): Date {
  const seconds = Math.min(60 * 60, Math.max(30, 30 * (2 ** Math.max(attemptCount - 1, 0))));
  return new Date(Date.now() + seconds * 1000);
}

export async function processSocialPublicationTick(pool: Pool, limit = 50) {
  if (inFlight) return { picked: 0, published: 0, failed: 0, skipped: true };
  inFlight = true;
  let published = 0;
  let failed = 0;
  try {
    const claimed = await claimDueSocialTargets(pool, limit);
    for (const target of claimed) {
      const row = await getPublicationForTarget(pool, target.id);
      if (!row) continue;
      const publisher = getSocialPublisher(row.platform as SocialPlatform);
      const requestId = `social:${row.id}:${target.attempt_count}`;
      const contentSnapshot = row.content_snapshot;
      const content = buildPlatformContent(
        contentSnapshot,
        row.platform as SocialPlatform,
        Array.isArray(row.asset_snapshot) ? row.asset_snapshot : [],
      );
      const capability = await getTenantSocialPlatformCapability(
        row.platform as SocialPlatform,
        row.tenant_id,
        row.account_id,
      );
      if (!publisher || !capability.canPublish) {
        const message = capability.reason || 'Nền tảng chưa có publisher hoặc chưa xác minh quyền đăng; không tự retry.';
        const retryable = Boolean(capability.retryable);
        await recordSocialAttempt(pool, target.id, {
          attemptNumber: target.attempt_count,
          requestId,
          resultStatus: retryable ? 'FAILED_RETRYABLE' : 'FAILED_FINAL',
          errorCode: 'PUBLISHER_NOT_READY',
          errorMessage: message,
        });
        await updateSocialTarget(pool, target.id, {
          status: retryable ? 'FAILED_RETRYABLE' : 'FAILED_FINAL',
          nextRetryAt: retryable ? retryAt(target.attempt_count) : null,
          errorCode: 'PUBLISHER_NOT_READY',
          errorMessage: message,
        });
        failed++;
        continue;
      }
      try {
        const result = await publisher.publish({
          tenantId: row.tenant_id,
          accountId: row.account_id,
          content,
          idempotencyKey: requestId,
        });
        await recordSocialAttempt(pool, target.id, {
          attemptNumber: target.attempt_count,
          requestId,
          providerRequestId: result.providerRequestId,
          resultStatus: result.status,
          errorCode: result.errorCode,
          errorMessage: result.safeMessage,
        });
        if (result.status === 'PUBLISHED') {
          await updateSocialTarget(pool, target.id, {
            status: 'PUBLISHED',
            providerPostId: result.providerPostId,
            providerPostUrl: result.providerPostUrl,
            providerRequestId: result.providerRequestId,
          });
          published++;
        } else if (result.status === 'AMBIGUOUS') {
          await updateSocialTarget(pool, target.id, {
            status: 'AMBIGUOUS',
            providerRequestId: result.providerRequestId,
            errorCode: result.errorCode || 'PROVIDER_OUTCOME_UNKNOWN',
            errorMessage: result.safeMessage || 'Provider không xác nhận kết quả; cần kiểm tra thủ công.',
          });
          failed++;
        } else {
          await updateSocialTarget(pool, target.id, {
            status: result.retryable ? 'FAILED_RETRYABLE' : 'FAILED_FINAL',
            nextRetryAt: result.retryable ? retryAt(target.attempt_count) : null,
            providerRequestId: result.providerRequestId,
            errorCode: result.errorCode || 'PUBLISH_FAILED',
            errorMessage: result.safeMessage || 'Provider từ chối đăng bài.',
          });
          failed++;
        }
      } catch (error: any) {
        const message = String(error?.message || 'Lỗi không xác định').slice(0, 1000);
        await recordSocialAttempt(pool, target.id, {
          attemptNumber: target.attempt_count,
          requestId,
          resultStatus: 'FAILED_RETRYABLE',
          errorCode: 'WORKER_ERROR',
          errorMessage: message,
        });
        await updateSocialTarget(pool, target.id, {
          status: 'FAILED_RETRYABLE',
          nextRetryAt: retryAt(target.attempt_count),
          errorCode: 'WORKER_ERROR',
          errorMessage: message,
        });
        failed++;
      }
    }
    return { picked: claimed.length, published, failed, skipped: false };
  } finally {
    inFlight = false;
  }
}

export function startSocialPublishingWorker(pool: Pool, intervalMs = 15 * 60 * 1000) {
  if (timer) return;
  timer = setInterval(() => {
    void processSocialPublicationTick(pool).catch(error => {
      logger.warn(`[SocialPublishing] tick failed: ${error?.message || error}`);
    });
  }, intervalMs);
  timer.unref?.();
  setTimeout(() => {
    void processSocialPublicationTick(pool).catch(error => {
      logger.warn(`[SocialPublishing] initial tick failed: ${error?.message || error}`);
    });
  }, 30_000).unref?.();
  logger.info(`[SocialPublishing] worker started (interval=${intervalMs}ms)`);
}

export function stopSocialPublishingWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}