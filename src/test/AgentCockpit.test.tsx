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

function mockCockpitRequests(summary: Record<string, unknown>, overview?: Record<string, unknown>) {
  vi.spyOn(api, 'get').mockImplementation((async (path: string) => {
    if (path === '/api/agent-operating/cockpit') return summary;
    if (path === '/api/agent-operating/questions') return [];
    if (path.startsWith('/api/agent-operating/events')) return [];
    if (path === '/api/live-chat/support-requests') return { data: [] };
    if (path === '/api/agent-operating/marketing-growth') return { brain: [], capabilities: [] };
    if (path.startsWith('/api/internal/minh-brain/overview')) return overview || {
      scheduler: { mode: 'shadow', enabled: true, lastTickAt: null, detectorSummary: { enabled: true, lastRunAt: null, tenantRuns: 0, opportunitiesFound: 0, opportunitiesPersisted: 0, degradedRuns: 0, detectorStatus: [] } },
      routing: { registryErrors: [] },
      opportunities: [],
    };
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

  it('renders proactive opportunities as read-only observations', async () => {
    mockCockpitRequests(createSummary(), {
      scheduler: {
        mode: 'shadow',
        enabled: true,
        lastTickAt: '2026-09-15T10:00:00.000Z',
        detectorSummary: {
          enabled: true,
          lastRunAt: '2026-09-15T10:00:00.000Z',
          tenantRuns: 1,
          opportunitiesFound: 1,
          opportunitiesPersisted: 1,
          degradedRuns: 0,
          detectorStatus: [{ detector: 'cold_lead', status: 'OBSERVED', tenantRuns: 1, found: 1, persisted: 1 }],
        },
      },
      routing: { registryErrors: [] },
      opportunities: [{
        id: 'signal-1',
        subjectType: 'lead',
        subjectId: 'lead-1',
        createdAt: '2026-09-15T10:00:00.000Z',
        kind: 'COLD_LEAD',
        priority: 82,
        confidence: 0.87,
        title: 'Lead tiềm năng đang nguội',
        rationale: 'Lead có điểm 86 nhưng chưa có tương tác trong 5 ngày.',
        suggestedNextStep: 'Xem lại ngữ cảnh lead.',
        evidence: { detector: 'cold_lead', score: 86, inactiveDays: 5 },
        permission: 'READ',
        actionCreated: false,
      }],
    });
    render(<AgentCockpit />);

    expect(await screen.findByText('Cơ hội proactive của Minh')).toBeVisible();
    expect(screen.getByText('Lead tiềm năng đang nguội')).toBeVisible();
    expect(screen.getByText('READ-only')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === 'score: 86')).toBeVisible();
    expect(screen.queryByText('Gửi follow-up')).not.toBeInTheDocument();
  });
});