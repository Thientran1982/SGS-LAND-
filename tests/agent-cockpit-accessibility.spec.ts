import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const panelNames = [
  ['brainHealth', 'Brain health'],
  ['opportunityQueue', 'Opportunity queue'],
  ['approvalQueue', 'Approval queue'],
  ['learningStatus', 'Learning status'],
  ['schedulerRepair', 'Scheduler / repair'],
] as const;

const panel = (state: 'available' | 'degraded' | 'unavailable', data: unknown, message?: string) => ({
  state,
  data,
  ...(message ? { message } : {}),
});

function commandCenter(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-09-15T10:00:00.000Z',
    brainHealth: panel('available', {
      delegations7d: 12,
      delegationSuccess7d: 10,
      capabilityGaps7d: 2,
      latencySloBreaches24h: 1,
      pendingRuns: 3,
      errors24h: 1,
    }),
    opportunityQueue: panel('available', []),
    approvalQueue: panel('available', []),
    learningStatus: panel('available', {
      candidate: null,
      evaluation: null,
      gateStatus: null,
      canary: null,
      regression: null,
      rollback: null,
    }),
    schedulerRepair: panel('available', {
      timer: { mode: 'shadow', enabled: true, startedAt: null, lastTickAt: null, tickCount: 0, lastStatus: 'OBSERVED' },
      deadLetterCount: 0,
      staleLeaseCount: 0,
      repairSpikeCount7d: 0,
      lastSuccessfulRunAt: null,
    }),
    ...overrides,
  };
}

const cockpitSummary = {
  roleCards: [],
  events: [],
  humanQuestions: [],
  executions: [],
  recentAudit: [],
  rollouts: [],
  weeklyKpi: [],
  shiftReports: [],
  rollbackAudits: [],
  generatedAt: '2026-09-15T10:00:00.000Z',
  availability: {},
};

async function mockCockpitApis(page: Page, commandCenterResponse: Record<string, unknown>) {
  await page.route('**/api/agent-operating/cockpit', route => route.fulfill({ json: cockpitSummary }));
  await page.route('**/api/internal/minh-brain/command-center', route => route.fulfill({ json: commandCenterResponse }));
  await page.route('**/api/agent-operating/questions', route => route.fulfill({ json: [] }));
  await page.route('**/api/agent-operating/events**', route => route.fulfill({ json: [] }));
  await page.route('**/api/live-chat/support-requests', route => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/agent-operating/marketing-growth', route => route.fulfill({ json: { brain: [], capabilities: [] } }));
  await page.route('**/api/auto-posting/diagnostic', route => route.fulfill({ json: { ok: true, code: 'SMOKE', dryRun: true, checkedAt: '2026-09-15T10:00:00.000Z', failedComponents: [], endpoint: { ready: true, code: 'OK', message: 'OK', path: '/api/internal/auto-posting/scheduled' }, cronSecret: { ready: true, code: 'OK', message: 'OK', configured: true }, qstash: { ready: true, code: 'OK', message: 'OK', endpoint: 'https://qstash.upstash.io', schedule: { id: 'fixture-schedule', cron: '30 18 * * *' } } } }));
  await page.route('**/api/internal/minh-brain/overview**', route => route.fulfill({
    json: {
      scheduler: { mode: 'shadow', enabled: true, lastTickAt: null, detectorSummary: { enabled: true, lastRunAt: null, tenantRuns: 0, opportunitiesFound: 0, opportunitiesPersisted: 0, degradedRuns: 0, detectorStatus: [] } },
      routing: { registryErrors: [] },
      opportunities: [],
      learning: null,
    },
  }));
  await page.route('**/api/internal/minh-brain/learning/trends**', route => route.fulfill({ json: { degraded: false, trend: null } }));
  await page.route('**/api/internal/minh-brain/learning/trends/exports**', route => route.fulfill({ json: { exports: [], limit: 20, offset: 0, hasMore: false, nextOffset: null } }));
  await page.route('**/api/notifications/zalo-readiness**', route => route.fulfill({ json: { warnings: [] } }));
  await page.route('**/api/ai/memory/admin', route => route.fulfill({ json: [] }));
  await page.route('**/api/ai/weights', route => route.fulfill({ json: { live: {}, versions: [] } }));
}

async function openCommandCenter(page: Page, response: Record<string, unknown>) {
  await mockCockpitApis(page, response);
  await page.goto(`${BASE_URL}/agent-cockpit`);
  await expect(page.getByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();
}

test.describe('Command Center accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([{
      name: 'token',
      value: 'accessibility-fixture-token',
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    }]);
    const fulfillCurrentUser = (route: Route) => route.fulfill({
      json: {
        user: {
          id: 'accessibility-fixture-user',
          tenantId: 'accessibility-fixture-tenant',
          role: 'TEAM_LEAD',
          name: 'Accessibility fixture',
          email: 'accessibility@example.test',
        },
      },
    });
    await page.route('**/api/users/me', fulfillCurrentUser);
    await page.route('**/api/auth/me', fulfillCurrentUser);
    await page.goto(BASE_URL);
  });

  test('announces every panel name and state through the browser accessibility tree', async ({ page }) => {
    for (const [key, title] of panelNames) {
      const states = key === 'opportunityQueue'
        ? { [key]: panel('degraded', [], `${title} is temporarily degraded`) }
        : { [key]: panel('available', null, `${title} is unavailable`) };
      await openCommandCenter(page, commandCenter(states));
      const panelGroup = page.getByRole('group', { name: title });
      await expect(panelGroup).toHaveCount(1);
      const status = panelGroup.getByRole('status').first();
      await expect(status).toBeVisible();
      await expect(status).toHaveAttribute('aria-live', 'polite');
      await expect(status).toHaveAttribute('aria-atomic', 'true');
    }
  });

  test('does not expose fabricated success counts for unavailable panels', async ({ page }) => {
    const unavailable = Object.fromEntries(panelNames.map(([key, title]) => [
      key,
      panel('unavailable', null, `${title} is unavailable`),
    ]));
    await openCommandCenter(page, commandCenter(unavailable));

    for (const [key, title] of panelNames) {
      const panelGroup = page.getByRole('group', { name: title });
      await expect(panelGroup.getByRole('status').first()).toHaveAttribute('aria-label', `${title}: Không khả dụng`);
      if (key === 'opportunityQueue') await expect(panelGroup).not.toContainText('0 cơ hội');
      if (key === 'approvalQueue') await expect(panelGroup).not.toContainText('0 đang chờ duyệt');
      if (key === 'learningStatus') await expect(panelGroup).not.toContainText('Gate:');
      if (key === 'schedulerRepair') await expect(panelGroup).not.toContainText('Scheduler:');
    }
  });

  test('announces loaded empty queues as empty instead of unavailable', async ({ page }) => {
    await openCommandCenter(page, commandCenter({
      opportunityQueue: panel('available', []),
      approvalQueue: panel('available', []),
    }));

    const opportunities = page.getByRole('group', { name: 'Opportunity queue' });
    const approvals = page.getByRole('group', { name: 'Approval queue' });
    await expect(opportunities).toContainText('0 cơ hội');
    await expect(approvals).toContainText('0 đang chờ duyệt');
    await expect(opportunities.getByRole('status')).toHaveAttribute('aria-label', 'Opportunity queue: Sẵn sàng');
    await expect(approvals.getByRole('status')).toHaveAttribute('aria-label', 'Approval queue: Sẵn sàng');
    await expect(opportunities).not.toContainText('unavailable');
    await expect(approvals).not.toContainText('unavailable');
  });
});