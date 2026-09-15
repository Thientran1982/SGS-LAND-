import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const commandCenterPanelNames = [
  ['brainHealth', 'Brain health'],
  ['opportunityQueue', 'Opportunity queue'],
  ['approvalQueue', 'Approval queue'],
  ['learningStatus', 'Learning status'],
  ['schedulerRepair', 'Scheduler / repair'],
] as const;

type CommandCenterState = 'available' | 'degraded' | 'unavailable';

function createCommandCenterPanel<T>(data: T | null, state: CommandCenterState = 'available', message?: string) {
  return { state, data, ...(message ? { message } : {}) };
}

function createCommandCenter(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-09-15T00:00:00.000Z',
    brainHealth: createCommandCenterPanel({
      delegations7d: 12,
      delegationSuccess7d: 10,
      capabilityGaps7d: 2,
      latencySloBreaches24h: 1,
      pendingRuns: 3,
      errors24h: 1,
    }),
    opportunityQueue: createCommandCenterPanel([]),
    approvalQueue: createCommandCenterPanel([]),
    learningStatus: createCommandCenterPanel({
      candidate: null,
      evaluation: null,
      gateStatus: null,
      canary: null,
      regression: null,
      rollback: null,
    }),
    schedulerRepair: createCommandCenterPanel({
      timer: { mode: 'shadow', enabled: true, startedAt: null, lastTickAt: null, tickCount: 0, lastStatus: 'OBSERVED' },
      deadLetterCount: 0,
      staleLeaseCount: 0,
      repairSpikeCount7d: 0,
      lastSuccessfulRunAt: null,
    }),
    ...overrides,
  };
}

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

function mockCockpitRequests(
  summary: Record<string, unknown>,
  overview?: Record<string, unknown>,
  commandCenter: Record<string, unknown> = createCommandCenter(),
) {
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
    if (path === '/api/internal/minh-brain/command-center') return commandCenter;
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

  it.each([
    ['available', 'Sẵn sàng', createCommandCenter()],
    ['degraded', 'Degraded', createCommandCenter(Object.fromEntries(
      commandCenterPanelNames.map(([key]) => [key, createCommandCenterPanel(
        key === 'brainHealth'
          ? {
            delegations7d: 12,
            delegationSuccess7d: 10,
            capabilityGaps7d: 2,
            latencySloBreaches24h: 1,
            pendingRuns: null,
            errors24h: null,
          }
          : key === 'opportunityQueue' || key === 'approvalQueue'
            ? []
            : key === 'learningStatus'
              ? { candidate: null, evaluation: null, gateStatus: null, canary: null, regression: null, rollback: null }
              : {
                timer: { mode: 'shadow', enabled: true, startedAt: null, lastTickAt: null, tickCount: 0, lastStatus: 'OBSERVED' },
                deadLetterCount: null,
                staleLeaseCount: null,
                repairSpikeCount7d: null,
                lastSuccessfulRunAt: null,
              },
        'degraded',
        `${key} is temporarily degraded`,
      )]),
    ))],
    ['unavailable', 'Không khả dụng', createCommandCenter(Object.fromEntries(
      commandCenterPanelNames.map(([key]) => [key, createCommandCenterPanel(null, 'unavailable', `${key} is unavailable`)]),
    ))],
  ] as const)('renders the %s state for every Command Center panel', async (_state, stateLabel, commandCenter) => {
    mockCockpitRequests(createSummary(), undefined, commandCenter);
    render(<AgentCockpit />);

    expect(await screen.findByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();
    for (const [, title] of commandCenterPanelNames) {
      const panelHeading = screen.getByRole('heading', { name: title });
      const panel = panelHeading.parentElement?.parentElement;
      expect(panel).not.toBeNull();
      expect(within(panel as HTMLElement).getByText(stateLabel)).toBeVisible();
    }
  });

  it('shows unavailable warnings without fabricated counts or empty-success copy', async () => {
    const unavailable = createCommandCenter(Object.fromEntries(
      commandCenterPanelNames.map(([key]) => [key, createCommandCenterPanel(null, 'unavailable', `${key} did not load`)]),
    ));
    mockCockpitRequests(createSummary(), undefined, unavailable);
    render(<AgentCockpit />);

    expect(await screen.findByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();
    for (const [key, title] of commandCenterPanelNames) {
      const panelHeading = screen.getByRole('heading', { name: title });
      const panel = panelHeading.parentElement?.parentElement as HTMLElement;
      expect(within(panel).getByText(`${key} did not load`)).toBeVisible();
    }

    expect(screen.queryByText('0 cơ hội')).not.toBeInTheDocument();
    expect(screen.queryByText('0 đang chờ duyệt')).not.toBeInTheDocument();
    expect(screen.queryByText('Gate:')).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduler:')).not.toBeInTheDocument();
  });

  it('distinguishes loaded empty queues from unavailable queues', async () => {
    mockCockpitRequests(createSummary(), undefined, createCommandCenter({
      opportunityQueue: createCommandCenterPanel([]),
      approvalQueue: createCommandCenterPanel([]),
    }));
    render(<AgentCockpit />);

    expect(await screen.findByText('0 cơ hội')).toBeVisible();
    expect(screen.getByText('0 đang chờ duyệt')).toBeVisible();
    expect(screen.queryByText('Không thể tải Opportunity queue. Dữ liệu chưa khả dụng; hãy thử làm mới.')).not.toBeInTheDocument();
    expect(screen.queryByText('Không thể tải Approval queue. Dữ liệu chưa khả dụng; hãy thử làm mới.')).not.toBeInTheDocument();
  });

  it('keeps healthy Command Center panels visible when one panel is unavailable', async () => {
    mockCockpitRequests(createSummary(), undefined, createCommandCenter({
      opportunityQueue: createCommandCenterPanel(null, 'unavailable', 'Opportunity queue did not load'),
    }));
    render(<AgentCockpit />);

    expect(await screen.findByText('Opportunity queue did not load')).toBeVisible();
    expect(screen.queryByText('0 cơ hội')).not.toBeInTheDocument();
    expect(screen.getByText('0 đang chờ duyệt')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();

    for (const [, title] of commandCenterPanelNames.filter(([key]) => key !== 'opportunityQueue')) {
      const panelHeading = screen.getByRole('heading', { name: title });
      const panel = panelHeading.parentElement?.parentElement as HTMLElement;
      expect(within(panel).getByText('Sẵn sàng')).toBeVisible();
    }
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
       decisionQueue: [{
         id: 'approval-1',
         actionType: 'DRAFT_PROACTIVE_FOLLOWUP',
         status: 'PENDING',
         reasoning: 'Lead có điểm cao nhưng đã nguội.',
         subjectType: 'lead',
         subjectId: 'lead-1',
       }],
       proactiveBudget: { used: 1, budget: 20, exceeded: false },
       proactiveRollout: { capabilityKey: 'MINH_PROACTIVE_DECISION_QUEUE', rollout: 'CANARY_25', active: true },
       learning: {
         windowDays: 30,
         totals: { total: 3, approved: 1, rejected: 1, executed: 1, execution_failed: 0, answered: 0 },
          byOutcome: [{ outcome: 'APPROVED', count: 1 }, { outcome: 'REJECTED', count: 1 }, { outcome: 'EXECUTED', count: 1 }],
          byCategory: [{ category: 'OPERATOR_APPROVED', count: 1 }],
          byAction: [{ action_type: 'REVIEW_LISTING_PRICE', outcome: 'APPROVED', count: 1 }],
         rawPayloadIncluded: false,
       },
    });
    render(<AgentCockpit />);

    expect(await screen.findByText('Cơ hội proactive của Minh')).toBeVisible();
    expect(screen.getByText('Lead tiềm năng đang nguội')).toBeVisible();
    expect(screen.getByText('READ-only')).toBeVisible();
     expect(screen.getByText('Decision Queue')).toBeVisible();
     expect(screen.getByText('DRAFT_PROACTIVE_FOLLOWUP')).toBeVisible();
     expect(screen.getByRole('button', { name: 'Duyệt' })).toBeVisible();
     expect(screen.getByText('Learning loop')).toBeVisible();
     expect(screen.getByText('Theo outcome')).toBeVisible();
     expect(screen.getByText('OPERATOR_APPROVED')).toBeVisible();
     expect(screen.getByText('Rollout: CANARY_25')).toBeVisible();
    expect(screen.getByText((_, element) => element?.textContent === 'score: 86')).toBeVisible();
    expect(screen.queryByText('Gửi follow-up')).not.toBeInTheDocument();
  });

  it('shows an explicit empty learning state and requests the selected bounded window', async () => {
    mockCockpitRequests(createSummary(), {
      scheduler: { mode: 'shadow', enabled: true, lastTickAt: null, detectorSummary: { enabled: true, lastRunAt: null, tenantRuns: 0, opportunitiesFound: 0, opportunitiesPersisted: 0, degradedRuns: 0, detectorStatus: [] } },
      routing: { registryErrors: [] },
      opportunities: [],
      learning: {
        windowDays: 30,
        totals: { total: 0, approved: 0, rejected: 0, executed: 0, execution_failed: 0, answered: 0 },
        byOutcome: [],
        byCategory: [],
        byAction: [],
        rawPayloadIncluded: false,
      },
    });
    render(<AgentCockpit />);

    expect(await screen.findByText('Chưa có dữ liệu learning trong khoảng thời gian này.')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Khoảng thời gian learning của Minh' }), { target: { value: '7' } });
    expect(await screen.findByText('Chưa có dữ liệu learning trong khoảng thời gian này.')).toBeVisible();
    expect((api.get as any).mock.calls.some(([path]: [string]) => path.includes('/api/internal/minh-brain/overview?limit=50&days=7'))).toBe(true);
  });

  it('makes learning degradation explicit when the overview cannot load it', async () => {
    mockCockpitRequests(createSummary(), {
      degraded: true,
      warning: 'Dữ liệu Minh Brain tạm thời chưa tải được.',
      scheduler: { mode: 'shadow', enabled: true, lastTickAt: null, detectorSummary: { enabled: true, lastRunAt: null, tenantRuns: 0, opportunitiesFound: 0, opportunitiesPersisted: 0, degradedRuns: 0, detectorStatus: [] } },
      routing: { registryErrors: [] },
      opportunities: [],
      learning: null,
    });
    render(<AgentCockpit />);

    expect(await screen.findByText('Dữ liệu Minh Brain tạm thời chưa tải được.')).toBeVisible();
  });
});