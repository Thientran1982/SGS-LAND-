import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveChatTelemetryPanel } from '../../pages/SystemStatus';
import { analyticsApi } from '../../services/api/analyticsApi';

const translate = (key: string, params?: Record<string, string | number>) => {
  const labels: Record<string, string> = {
    'system.live_chat_metrics.title': 'Cảnh báo độ trễ live-chat',
    'system.live_chat_metrics.subtitle': 'Theo dõi độ trễ',
    'system.live_chat_metrics.super_admin': 'Chỉ SUPER_ADMIN',
    'system.live_chat_metrics.loading': 'Đang tải snapshot',
    'system.live_chat_metrics.error': 'Không tải được dữ liệu',
    'system.live_chat_metrics.empty': 'Chưa có mẫu trong cửa sổ',
    'system.live_chat_metrics.stale': 'Snapshot đã cũ',
    'system.live_chat_metrics.live': 'Dữ liệu mới',
    'system.live_chat_metrics.refresh_error': 'Làm mới thất bại; đang hiển thị snapshot gần nhất.',
    'system.live_chat_metrics.load_error': 'Không thể tải cảnh báo live-chat.',
    'system.live_chat_metrics.invalid': 'Dữ liệu metrics không hợp lệ.',
    'system.live_chat_metrics.acknowledge': 'Acknowledge',
    'system.live_chat_metrics.final_reply': 'Phản hồi cuối',
    'system.live_chat_metrics.samples': '{count} mẫu',
    'system.live_chat_metrics.slow_endpoints': 'Endpoint chậm',
    'system.live_chat_metrics.slow_events': '{count} lượt vượt ngưỡng',
    'system.live_chat_metrics.db_timeouts': 'Timeout kết nối DB',
    'system.live_chat_metrics.active': 'Đang cảnh báo',
    'system.live_chat_metrics.normal': 'Bình thường',
    'system.live_chat_metrics.timeout_count': '{count} lần / ngưỡng {threshold}',
    'system.live_chat_metrics.endpoint_detail': 'Chi tiết endpoint chậm',
    'system.live_chat_metrics.window': 'Cửa sổ {minutes} phút',
    'system.live_chat_metrics.no_slow_endpoints': 'Không có endpoint chậm trong cửa sổ này.',
    'system.live_chat_metrics.tenant_detail': 'Độ trễ theo tenant',
    'system.live_chat_metrics.hashed_only': 'Chỉ mã đã băm',
    'system.live_chat_metrics.no_tenants': 'Chưa có mẫu theo tenant.',
    'system.live_chat_metrics.tenant_key': 'Mã tenant',
    'system.live_chat_metrics.ack_short': 'Ack P50 / P95',
    'system.live_chat_metrics.reply_short': 'Reply P50 / P95',
    'system.live_chat_metrics.snapshot': 'Snapshot: {time}',
    'system.live_chat_metrics.privacy': 'Không hiển thị payload chat',
    'system.live_chat_metrics.threshold': 'Ngưỡng {threshold}ms',
    'system.live_chat_metrics.endpoint.history': 'Đọc lịch sử',
    'system.live_chat_metrics.endpoint.message': 'Gửi tin nhắn',
    'system.live_chat_metrics.endpoint.ai': 'Xử lý AI',
    'system.live_chat_metrics.status_rate_limit': 'Status polling bị giới hạn',
    'system.live_chat_metrics.status_rate_limit_scope': '{rateLimitName} · môi trường {environment}',
    'system.live_chat_metrics.status_rate': 'Tỷ lệ 429',
    'system.live_chat_metrics.status_count': '{count} lượt / {requests} request',
    'system.live_chat_metrics.status_threshold': 'Ngưỡng cảnh báo',
    'system.live_chat_metrics.status_window': 'Cửa sổ {minutes} phút',
    'system.live_chat_metrics.retry_after': 'Retry-After',
    'system.live_chat_metrics.last_429': '429 gần nhất',
    'system.live_chat_metrics.rate_limit_backend': 'Backend rate-limit',
    'system.live_chat_metrics.backend_counts': 'Redis {redis} · memory {memory}',
    'system.live_chat_metrics.attachment_readability': 'Khả năng đọc tệp',
    'system.live_chat_metrics.attachment_window': 'Cửa sổ {minutes} phút',
    'system.live_chat_metrics.standardized_dimensions': 'Chiều dữ liệu chuẩn hóa',
    'system.live_chat_metrics.attachment_unavailable': 'Metrics khả năng đọc tệp chưa khả dụng trong snapshot này.',
    'system.live_chat_metrics.unreadable_rate': 'Tỷ lệ không đọc được',
    'system.live_chat_metrics.unreadable_count': '{count} tệp không đọc được',
    'system.live_chat_metrics.not_processed': 'Chưa xử lý',
    'system.live_chat_metrics.attachment_total': '{count} tệp trong cửa sổ',
    'system.live_chat_metrics.provider_outcomes': 'Kết quả provider',
    'system.live_chat_metrics.provider.primary': 'Chính',
    'system.live_chat_metrics.provider.fallback': 'Dự phòng',
    'system.live_chat_metrics.provider.timeout': 'Timeout',
    'system.live_chat_metrics.provider.outage': 'Gián đoạn',
    'system.live_chat_metrics.provider.not_attempted': 'Chưa thử',
    'system.live_chat_metrics.attachment_by_tenant': 'Theo tenant',
    'system.live_chat_metrics.no_attachment_tenants': 'Chưa có dữ liệu theo tenant.',
    'system.live_chat_metrics.attachment_by_extraction': 'Theo trạng thái trích xuất',
    'system.live_chat_metrics.attachment_by_type': 'Theo định dạng',
    'system.live_chat_metrics.attachment_privacy': 'Chỉ hiển thị mã tenant đã băm và số liệu tổng hợp; không hiển thị tên tệp, nội dung, hash đầy đủ hoặc danh tính provider.',
    'system.live_chat_metrics.extraction.NOT_APPLICABLE': 'Không áp dụng',
    'system.live_chat_metrics.extraction.READY': 'Sẵn sàng',
    'system.live_chat_metrics.extraction.EMPTY': 'Trống',
    'system.live_chat_metrics.extraction.FAILED': 'Thất bại',
    'system.live_chat_metrics.extraction.UNKNOWN': 'Không xác định',
    'system.live_chat_metrics.file_type.image': 'Ảnh',
    'system.live_chat_metrics.file_type.pdf': 'PDF',
    'system.live_chat_metrics.file_type.docx': 'DOCX',
    'system.live_chat_metrics.file_type.document': 'Tài liệu khác',
    'system.live_chat_metrics.file_type.other': 'Khác',
    'common.retry': 'Thử lại',
  };
  return (labels[key] || key).replace(/{(\w+)}/g, (_match, name) =>
    params?.[name] === undefined ? `{${name}}` : String(params[name]),
  );
};

const snapshot = (generatedAt = new Date().toISOString()) => ({
  windowMs: 900_000,
  generatedAt,
  acknowledgeLatency: { count: 4, p50Ms: 80, p95Ms: 240 },
  finalReplyLatency: { count: 4, p50Ms: 320, p95Ms: 900 },
  byTenant: [
    {
      tenantKey: '0123456789abcdef',
      acknowledgeLatency: { count: 2, p50Ms: 50, p95Ms: 100 },
      finalReplyLatency: { count: 2, p50Ms: 200, p95Ms: 500 },
    },
    {
      tenantKey: 'tenant-raw-value',
      acknowledgeLatency: { count: 1, p50Ms: 1, p95Ms: 1 },
      finalReplyLatency: { count: 1, p50Ms: 1, p95Ms: 1 },
    },
  ],
  slowEndpointAlerts: [
    { endpoint: 'history' as const, thresholdMs: 1500, count: 2, lastDurationMs: 1800 },
    { endpoint: 'message' as const, thresholdMs: 1500, count: 1, lastDurationMs: 1700 },
  ],
  databaseConnectionTimeouts: {
    windowMs: 300_000,
    count: 3,
    threshold: 3,
    alertActive: true,
  },
  statusRateLimits: {
    endpoint: 'status_polling' as const,
    environment: 'test',
    rateLimitName: 'livechat_status',
    windowMs: 300_000,
    requestCount: 10,
    limitedCount: 2,
    limitedRatePercent: 20,
    threshold: 3,
    alertActive: false,
    lastRetryAfterSeconds: 4,
    backend: 'mixed' as const,
    backendCounts: { redis: 8, 'in-memory': 2 },
    byTenant: [{
      tenantKey: '0123456789abcdef',
      requestCount: 10,
      limitedCount: 2,
      limitedRatePercent: 20,
      threshold: 3,
      alertActive: false,
      lastRetryAfterSeconds: 4,
      backend: 'mixed' as const,
      backendCounts: { redis: 8, 'in-memory': 2 },
    }],
  },
  attachmentReadability: {
    windowMs: 900_000,
    overall: {
      total: 4,
      unreadable: 1,
      notProcessed: 2,
      unreadableRatePercent: 25,
      providerOutcomes: { primary: 1, fallback: 0, timeout: 1, outage: 1, not_attempted: 1 },
    },
    byTenant: [{
      tenantKey: '0123456789abcdef',
      total: 4, unreadable: 1, notProcessed: 2, unreadableRatePercent: 25,
      providerOutcomes: { primary: 1, fallback: 0, timeout: 1, outage: 1, not_attempted: 1 },
    }, {
      tenantKey: 'tenant-raw-value',
      total: 1, unreadable: 1, notProcessed: 0, unreadableRatePercent: 100,
      providerOutcomes: { primary: 0, fallback: 0, timeout: 0, outage: 0, not_attempted: 1 },
    }],
    byExtractionStatus: [{
      extractionStatus: 'FAILED',
      total: 1, unreadable: 1, notProcessed: 0, unreadableRatePercent: 100,
      providerOutcomes: { primary: 0, fallback: 0, timeout: 0, outage: 0, not_attempted: 1 },
    }],
    byFileType: [{
      fileType: 'pdf',
      total: 4, unreadable: 1, notProcessed: 2, unreadableRatePercent: 25,
      providerOutcomes: { primary: 1, fallback: 0, timeout: 1, outage: 1, not_attempted: 1 },
    }],
  },
});

const renderPanel = () => render(
  <LiveChatTelemetryPanel
    t={translate}
    formatDateTime={(date) => date}
  />,
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LiveChatTelemetryPanel', () => {
  it('shows latency alerts and only renders hashed tenant keys', async () => {
    vi.spyOn(analyticsApi, 'getSystemMetrics').mockResolvedValue({ liveChat: snapshot() });

    renderPanel();

    expect(await screen.findByText('Cảnh báo độ trễ live-chat')).toBeVisible();
    expect(screen.getByText('Dữ liệu mới')).toBeVisible();
    expect(screen.getByText('80ms')).toBeVisible();
    expect(screen.getByText('900ms')).toBeVisible();
    expect(screen.getAllByText('2')[0]).toBeVisible();
    expect(screen.getByText('Đang cảnh báo')).toBeVisible();
    expect(screen.getByText('Status polling bị giới hạn')).toBeVisible();
    expect(screen.getByText('20%')).toBeVisible();
    expect(screen.getAllByText('4s')[0]).toBeVisible();
    expect(screen.getAllByText('mixed')[0]).toBeVisible();
    expect(screen.getAllByText('0123456789abcdef')[0]).toBeVisible();
    expect(screen.getByText('Khả năng đọc tệp')).toBeVisible();
    expect(screen.getAllByText('25%')[0]).toBeVisible();
    expect(screen.getAllByText('Tỷ lệ không đọc được')[0]).toBeVisible();
    expect(screen.getByText('PDF')).toBeVisible();
    expect(screen.getByText('Thất bại')).toBeVisible();
    expect(screen.queryByText('tenant-raw-value')).not.toBeInTheDocument();
    expect(screen.queryByText('private-document.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText(/payload chat/i)).toBeVisible();
  });

  it('labels an empty or stale snapshot instead of hiding its state', async () => {
    const emptySnapshot = {
      ...snapshot(new Date().toISOString()),
      acknowledgeLatency: { count: 0, p50Ms: 0, p95Ms: 0 },
      finalReplyLatency: { count: 0, p50Ms: 0, p95Ms: 0 },
      byTenant: [],
      slowEndpointAlerts: [],
      databaseConnectionTimeouts: { windowMs: 300_000, count: 0, threshold: 3, alertActive: false },
      statusRateLimits: {
        ...snapshot().statusRateLimits,
        requestCount: 0,
        limitedCount: 0,
        limitedRatePercent: 0,
        alertActive: false,
        lastRetryAfterSeconds: null,
        backend: 'unknown' as const,
        backendCounts: { redis: 0, 'in-memory': 0 },
        byTenant: [],
      },
      attachmentReadability: {
        windowMs: 900_000,
        overall: {
          total: 0,
          unreadable: 0,
          notProcessed: 0,
          unreadableRatePercent: 0,
          providerOutcomes: { primary: 0, fallback: 0, timeout: 0, outage: 0, not_attempted: 0 },
        },
        byTenant: [],
        byExtractionStatus: [],
        byFileType: [],
      },
    };
    vi.spyOn(analyticsApi, 'getSystemMetrics').mockResolvedValue({ liveChat: emptySnapshot });

    renderPanel();

    expect(await screen.findByText('Chưa có mẫu trong cửa sổ')).toBeVisible();
    expect(screen.getByText('Không có endpoint chậm trong cửa sổ này.')).toBeVisible();

    vi.restoreAllMocks();
    vi.spyOn(analyticsApi, 'getSystemMetrics').mockResolvedValue({
      liveChat: snapshot(new Date(Date.now() - 3 * 60_000).toISOString()),
    });
    cleanup();
    renderPanel();
    expect(await screen.findAllByText('Snapshot đã cũ')).not.toHaveLength(0);
  });

  it('keeps an explicit error state when the first snapshot cannot load', async () => {
    vi.spyOn(analyticsApi, 'getSystemMetrics').mockRejectedValue(new Error('offline'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  });
});