import { notificationRepository } from '../repositories/notificationRepository';
import type { ZaloBroadcastVerificationReasonCode } from '../social-publishing/zaloBroadcastPublisher';

const ZALO_BROADCAST_NOT_READY_TYPE = 'ZALO_BROADCAST_NOT_READY';
const SAFE_REASON_CODES = new Set<ZaloBroadcastVerificationReasonCode>([
  'READY',
  'CONFIG_UNAVAILABLE',
  'ZALO_NOT_CONNECTED',
  'PROBE_USER_MISSING',
  'OA_REQUEST_FAILED',
  'OA_ID_MISMATCH',
  'QUOTA_PERMISSION_DENIED',
  'QUOTA_REQUEST_FAILED',
  'QUOTA_RESPONSE_INVALID',
  'PROVIDER_UNAVAILABLE',
]);

export interface ZaloBroadcastNotReadyNotification {
  reasonCode: ZaloBroadcastVerificationReasonCode;
  checkedAt: string;
  transitionEventId?: string;
}

/**
 * Notify tenant admins using only the reviewed verification code and
 * timestamp. Never pass provider messages, responses, tokens, or probe
 * configuration into the notification layer.
 */
export async function notifyZaloBroadcastNotReady(
  tenantId: string,
  data: ZaloBroadcastNotReadyNotification,
): Promise<void> {
  if (!SAFE_REASON_CODES.has(data.reasonCode)) {
    throw new Error('Invalid Zalo broadcast notification reason code');
  }
  const checkedAt = new Date(data.checkedAt);
  if (Number.isNaN(checkedAt.getTime())) {
    throw new Error('Invalid Zalo broadcast notification timestamp');
  }

  const checkedAtIso = checkedAt.toISOString();
  const metadata = {
    reasonCode: data.reasonCode,
    checkedAt: checkedAtIso,
    ...(data.transitionEventId ? { transitionEventId: data.transitionEventId } : {}),
  };
  await notificationRepository.createForTenantAdmins(tenantId, {
    type: ZALO_BROADCAST_NOT_READY_TYPE,
    title: 'Quyền broadcast Zalo OA không còn sẵn sàng',
    body: `Mã lý do: ${data.reasonCode}. Thời điểm kiểm tra: ${checkedAtIso}.`,
    metadata,
    dedupeKey: data.transitionEventId,
  });
}

export async function recordZaloBroadcastNotReadyNotificationFailure(
  tenantId: string,
  data: Required<Pick<ZaloBroadcastNotReadyNotification, 'reasonCode' | 'checkedAt' | 'transitionEventId'>>,
): Promise<void> {
  if (!SAFE_REASON_CODES.has(data.reasonCode)) {
    throw new Error('Invalid Zalo broadcast notification reason code');
  }
  const checkedAt = new Date(data.checkedAt);
  if (Number.isNaN(checkedAt.getTime())) {
    throw new Error('Invalid Zalo broadcast notification timestamp');
  }
  await notificationRepository.recordZaloReadinessNotificationRetry(
    tenantId,
    data.transitionEventId,
    { reasonCode: data.reasonCode, checkedAt: checkedAt.toISOString() },
  );
}

export const notificationService = {
  notifyZaloBroadcastNotReady,
  recordZaloBroadcastNotReadyNotificationFailure,
};