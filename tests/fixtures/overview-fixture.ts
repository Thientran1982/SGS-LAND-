import type { Page } from '@playwright/test';

export const OVERVIEW_USER = {
  id: 'overview-qa-user',
  name: 'Overview QA',
  email: 'overview-qa@example.invalid',
  role: 'ADMIN',
  tenantId: 'overview-qa-tenant',
};

export const OVERVIEW_ANALYTICS = {
  user: OVERVIEW_USER,
  totalLeads: 42,
  totalLeadsDelta: 8,
  conversionRate: 18,
  revenue: 125000000,
  revenueDelta: 12,
  pipelineValue: 480000000,
  winProbability: 64,
  aiDeflectionRate: 31,
  aiDeflectionRateDelta: 4,
  salesVelocity: 14,
  salesVelocityDelta: -2,
  leadsByStage: [
    { stage: 'NEW', count: 12 },
    { stage: 'QUALIFIED', count: 18 },
    { stage: 'WON', count: 12 },
  ],
  leadsTrend: [
    { date: '2026-08-20', leads: 14 },
    { date: '2026-08-21', leads: 16 },
    { date: '2026-08-22', leads: 12 },
  ],
  marketPulse: [{ location: 'Ho Chi Minh City', demand: 76, supply: 42 }],
  agentLeaderboard: [{ name: 'Overview QA', total: 42, won: 12 }],
  teamLeaderboard: [{ name: 'Sales QA', total: 42, won: 12 }],
  recentActivities: [{ id: 'activity-1', description: 'Seeded Overview activity', createdAt: '2026-08-22T08:00:00.000Z' }],
  demandAreas: [{ name: 'District 1', score: 82 }, { name: 'District 7', score: 61 }],
  targets: { revenue: { monthly_target: 200000000 }, pipeline: { monthly_target: 600000000 } },
  inventoryOverview: { total: 8, available: 5, sold: 3 },
  inboxOverview: { total: 6, unread: 2, avgResponseMinutes: 8 },
  searchAnalytics: { topViewedListings: [], topSearches: [], topCategorySearches: [] },
  aiAdvisor: { suggestions: [], anomalies: [] },
};

/**
 * Seeds one browser context with a signed-in identity and deterministic API data.
 * This is intentionally test-local: it never creates a user or accepts credentials.
 */
export async function seedOverviewFixture(
  page: Page,
  requests: Array<{ method: string; url: string }>,
  options: { summaryFailures?: number } = {},
) {
  let summaryFailuresRemaining = options.summaryFailures ?? 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    requests.push({ method: request.method(), url: request.url() });
    const url = new URL(request.url());

    if (url.pathname === '/api/auth/me') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: OVERVIEW_USER }) });
    }
    if (url.pathname === '/api/analytics/summary') {
      if (summaryFailuresRemaining > 0) {
        summaryFailuresRemaining -= 1;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'fixture summary unavailable' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OVERVIEW_ANALYTICS) });
    }
    if (url.pathname === '/api/analytics/visitors' || url.pathname === '/api/analytics/visitor-funnel') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 10, visitors: 10, views: 25, interactions: 5, conversionRate: 20, funnel: [] }) });
    }
    if (url.pathname === '/api/analytics/kpi-targets') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (url.pathname === '/api/live-chat/chat') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'The seeded Overview has 42 leads in the company scope.',
          sources: [{ source: 'overview_fixture' }],
          dataScope: 'company',
          freshness: '2026-08-22T08:00:00.000Z',
          status: 'ok',
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  // The app only uses this marker for its client-side cache; the auth response above
  // is the actual gate and is scoped to this Playwright context.
  await page.addInitScript(() => localStorage.setItem('sgs_auth_cached', '1'));
}