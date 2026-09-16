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
      const status = panelGroup.getByRole('status');
      await expect(status).toHaveCount(1);
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
      await expect(panelGroup.getByRole('status')).toHaveCount(1);
      await expect(panelGroup.getByRole('status')).toHaveAttribute('aria-label', `${title}: Không khả dụng. ${title} is unavailable`);
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

  test('announces the current panel state once after refresh and clears recovered warnings', async ({ page }) => {
    let commandCenterReads = 0;
    await mockCockpitApis(page, commandCenter());
    await page.route('**/api/internal/minh-brain/command-center', route => {
      commandCenterReads += 1;
      const response = commandCenterReads === 1
        ? commandCenter({
          opportunityQueue: panel('available', []),
        })
        : commandCenterReads === 2
          ? commandCenter({
            opportunityQueue: panel('unavailable', null, 'Opportunity queue is unavailable after refresh'),
          })
          : commandCenter({
            opportunityQueue: panel('available', []),
          });
      return route.fulfill({ json: response });
    });
    await page.goto(`${BASE_URL}/agent-cockpit`);
    await expect(page.getByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();

    const opportunities = page.getByRole('group', { name: 'Opportunity queue' });
    const refresh = page.getByRole('button', { name: 'Làm mới' }).first();

    await refresh.click();
    await expect(opportunities.getByRole('status')).toHaveCount(1);
    await expect(opportunities.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Opportunity queue: Không khả dụng. Opportunity queue is unavailable after refresh',
    );
    await expect(opportunities).toContainText('Opportunity queue is unavailable after refresh');

    await refresh.click();
    await expect(opportunities.getByRole('status')).toHaveCount(1);
    await expect(opportunities.getByRole('status')).toHaveAttribute('aria-label', 'Opportunity queue: Sẵn sàng');
    await expect(opportunities).toContainText('0 cơ hội');
    await expect(opportunities).not.toContainText('Opportunity queue is unavailable after refresh');
  });

  test('announces when Command Center refresh is in progress and clears it when results arrive', async ({ page }) => {
    let refreshStarted = false;
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve; });
    await mockCockpitApis(page, commandCenter());
    await page.route('**/api/internal/minh-brain/command-center', async route => {
      if (!refreshStarted) return route.fulfill({ json: commandCenter() });
      await refreshGate;
      return route.fulfill({
        json: commandCenter({
          opportunityQueue: panel('degraded', [], 'Opportunity queue is temporarily degraded after refresh'),
        }),
      });
    });
    await page.goto(`${BASE_URL}/agent-cockpit`);
    await expect(page.getByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();

    const refresh = page.getByRole('button', { name: 'Làm mới' }).first();
    const refreshAnnouncement = page.getByRole('status', { name: 'Đang làm mới Command Center' });
    const opportunities = page.getByRole('group', { name: 'Opportunity queue' });

    refreshStarted = true;
    await refresh.click();
    await expect(refreshAnnouncement).toHaveCount(1);
    await expect(refreshAnnouncement).toHaveAttribute('aria-live', 'polite');
    await expect(opportunities).toContainText('0 cơ hội');

    releaseRefresh();
    await expect(refreshAnnouncement).toHaveCount(0);
    await expect(opportunities).toContainText('Opportunity queue is temporarily degraded after refresh');
  });

  test('announces a failed refresh and marks the last-known Command Center snapshot stale', async ({ page }) => {
    let refreshStarted = false;
    await mockCockpitApis(page, commandCenter());
    await page.route('**/api/internal/minh-brain/command-center', route => {
      return refreshStarted ? route.abort('failed') : route.fulfill({ json: commandCenter() });
    });
    await page.goto(`${BASE_URL}/agent-cockpit`);
    await expect(page.getByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();

    refreshStarted = true;
    await page.getByRole('button', { name: 'Làm mới' }).first().click();

    const warning = page.getByRole('alert', { name: 'Không thể làm mới Command Center' });
    await expect(warning).toHaveCount(1);
    await expect(warning).toContainText('Dữ liệu đang hiển thị có thể đã cũ');
    await expect(page.getByText('Snapshot cuối có thể đã cũ')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Opportunity queue' })).toContainText('0 cơ hội');
  });

  test('keeps the newest refresh result when an older request finishes afterward', async ({ page }) => {
    let refreshPhase = 0;
    let markOlderRefreshSeen!: () => void;
    const olderRefreshSeen = new Promise<void>(resolve => { markOlderRefreshSeen = resolve; });
    let releaseOlderRefresh!: () => void;
    const olderRefreshGate = new Promise<void>(resolve => { releaseOlderRefresh = resolve; });
    await mockCockpitApis(page, commandCenter());
    await page.route('**/api/internal/minh-brain/command-center', async route => {
      if (refreshPhase === 0) return route.fulfill({ json: commandCenter() });
      if (refreshPhase === 1) {
        markOlderRefreshSeen();
        await olderRefreshGate;
        return route.abort('failed');
      }
      return route.fulfill({
        json: commandCenter({
          generatedAt: '2026-09-15T10:05:00.000Z',
          opportunityQueue: panel('degraded', [], 'Newest refresh completed'),
        }),
      });
    });
    await page.goto(`${BASE_URL}/agent-cockpit`);
    await expect(page.getByRole('heading', { name: 'Command Center của Minh' })).toBeVisible();

    const refresh = page.getByRole('button', { name: 'Làm mới' }).first();
    const opportunities = page.getByRole('group', { name: 'Opportunity queue' });

    refreshPhase = 1;
    await refresh.click();
    await expect(page.getByRole('status', { name: 'Đang làm mới Command Center' })).toHaveCount(1);
    await olderRefreshSeen;
    refreshPhase = 2;
    await page.getByLabel('Khoảng thời gian learning của Minh').selectOption('7');

    await expect(opportunities).toContainText('Newest refresh completed');
    await expect(page.getByText('Snapshot cuối có thể đã cũ')).toHaveCount(0);
    await expect(page.getByRole('alert', { name: 'Không thể làm mới Command Center' })).toHaveCount(0);

    releaseOlderRefresh();
    await expect(opportunities).toContainText('Newest refresh completed');
    await expect(page.getByText('Snapshot cuối có thể đã cũ')).toHaveCount(0);
    await expect(page.getByRole('alert', { name: 'Không thể làm mới Command Center' })).toHaveCount(0);
  });
});
