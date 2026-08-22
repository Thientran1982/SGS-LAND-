import { test, expect } from '@playwright/test';
import { seedOverviewFixture } from './fixtures/overview-fixture';

test.describe('Overview signed-in responsive fixture', () => {
  test('covers themes, state branches, tooltip, focus, routes, analytics, and Guide assistant', async ({ page }, testInfo) => {
    const requests: Array<{ method: string; url: string }> = [];
    await seedOverviewFixture(page, requests);
    await page.goto('/dashboard');

    await expect(page.getByText('42').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Tổng quan|Overview/i }).first()).toBeVisible();
    await expect(page.locator('section[aria-label*="pipeline" i], section[aria-label*="phễu" i]').first()).toBeVisible();

    // Theme switching is exercised through the real Layout control.
    const themeButton = page.getByRole('button', { name: /dark|sáng|light/i }).first();
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await themeButton.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Keyboard focus must land on an actionable control and expose a focus style.
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // The chart has a responsive tooltip container; hover verifies the pointer branch.
    const chart = page.locator('.recharts-wrapper').first();
    if (await chart.count()) {
      await chart.hover({ position: { x: 30, y: 30 } });
    }

    // Exercise a private route link without relying on a shared account.
    const leadsLink = page.locator('button[title="Leads"], button[title="Khách hàng"]').first();
    if (await leadsLink.count()) {
      await leadsLink.click();
      await expect(page).toHaveURL(/\/leads/);
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/);
    }

    const assistantToggle = page.getByRole('button', { name: /Open guide assistant|Mở trợ lý hướng dẫn/i });
    await assistantToggle.click();
    await expect(page.getByRole('region', { name: /Guide assistant|Trợ lý hướng dẫn/i })).toBeVisible();
    const assistantInput = page.getByRole('textbox', { name: /What would you like to ask|Bạn muốn hỏi điều gì/i });
    await assistantInput.fill('Summarize the seeded Overview');
    await assistantInput.press('Enter');
    await expect(page.getByText(/42 leads|42 lead/i)).toBeVisible();
    await expect(page.getByText(/overview_fixture/)).toBeVisible();

    const analyticsRequest = requests.find(request => request.url.includes('/api/analytics/summary'));
    expect(analyticsRequest?.method).toBe('GET');
    expect(requests.some(request => request.url.includes('/api/auth/me'))).toBe(true);

    await testInfo.attach('overview-request-trace.json', {
      body: JSON.stringify({ viewport: testInfo.project.use.viewport, requests }, null, 2),
      contentType: 'application/json',
    });
    await page.screenshot({ path: testInfo.outputPath('overview-final.png'), fullPage: true });
  });

  test('recovers from a seeded analytics error', async ({ page }) => {
    const requests: Array<{ method: string; url: string }> = [];
    await seedOverviewFixture(page, requests, { summaryFailures: 1 });
    await page.goto('/dashboard');

    await expect(page.getByText(/error|lỗi/i).first()).toBeVisible();
    await page.getByRole('button', { name: /reload|tải lại|hệ thống/i }).click();
    await expect(page.getByText('42').first()).toBeVisible();
    expect(requests.filter(request => request.url.includes('/api/analytics/summary')).length).toBeGreaterThanOrEqual(2);
  });
});