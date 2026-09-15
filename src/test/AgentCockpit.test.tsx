import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentCockpit from '../../pages/AgentCockpit';
import { api } from '../../services/api/apiClient';
import { notificationApi } from '../../services/api/notificationApi';

vi.mock('../../components/GalleryCleanupPanel', () => ({
  GalleryCleanupPanel: () => null,
}));

vi.mock('../../components/AgentNeuronMap', () => ({
  AgentNeuronMap: () => null,
}));

const panelNames = [
  'events',
  'questions',
  'executions',
  'audit',
  'rollouts',
  'weeklyKpi',
  'shiftReports',
  'roleCards',
  'rollbackAudits',
] as const;

function createSummary(overrides: Record<string, unknown> = {}) {
  const availability = Object.fromEntries(
    panelNames.map(panel => [panel, { available: true }]),
  );

  return {
    roleCards: [],
    events: [],
    humanQuestions: [],
    executions: [],
    recentAudit: [],
    rollouts: [],
    weeklyKpi: [],
    shiftReports: [],
    rollbackAudits: [],
    generatedAt: '2026-09-15T00:00:00.000Z',
    availability,
    ...overrides,
  };
}

function mockCockpitRequests(summary: Record<string, unknown>) {
  vi.spyOn(api, 'get').mockImplementation((async (path: string) => {
    if (path === '/api/agent-operating/cockpit') return summary;
    if (path === '/api/agent-operating/questions') return [];
    if (path.startsWith('/api/agent-operating/events')) return [];
    if (path === '/api/live-chat/support-requests') return { data: [] };
    if (path === '/api/agent-operating/marketing-growth') return { brain: [], capabilities: [] };
    if (path === '/api/ai/memory/admin') return [];
    if (path === '/api/ai/weights') return { live: {}, versions: [] };
    throw new Error(`Unexpected GET request in test: ${path}`);
  }) as any);
  vi.spyOn(notificationApi, 'getZaloReadinessWarnings').mockResolvedValue({ warnings: [] });
}

describe('AgentCockpit panel availability', () => {
  beforeEach(() => {
    mockCockpitRequests(createSummary({
      degraded: true,
      warning: 'Một hoặc nhiều panel vận hành chưa tải được; hãy thử làm mới sau.',
      availability: {
        ...Object.fromEntries(panelNames.map(panel => [panel, { available: true }])),
        events: { available: false, error: 'QUERY_FAILED' },
      },
      unavailablePanels: ['events'],
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a panel-specific warning and em dash for unavailable metrics', async () => {
    render(<AgentCockpit />);

    expect(await screen.findByText('Không thể tải sự kiện. Dữ liệu chưa khả dụng; hãy thử làm mới.')).toBeVisible();

    const failedEventsMetric = screen.getByText('Event lỗi').parentElement;
    expect(failedEventsMetric).not.toBeNull();
    expect(within(failedEventsMetric as HTMLElement).getByText('—')).toBeVisible();

    expect(screen.queryByText('Không có sự kiện phù hợp bộ lọc.')).not.toBeInTheDocument();
  });

  it('keeps the normal empty state for a panel that loaded successfully', async () => {
    render(<AgentCockpit />);

    expect(await screen.findByText('Chưa có audit gần đây.')).toBeVisible();
    expect(screen.queryByText('Không thể tải audit gần đây. Dữ liệu chưa khả dụng; hãy thử làm mới.')).not.toBeInTheDocument();
  });
});