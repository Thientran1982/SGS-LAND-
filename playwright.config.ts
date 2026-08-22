import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  outputDir: 'test-results/overview',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    // Set BASE_URL to the deployed origin to run the unchanged Overview fixture
    // against a release build. Relative page URLs keep local and deployed runs
    // identical.
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/overview-responsive.spec.ts',
    },
    {
      name: 'overview-desktop',
      testMatch: '**/overview-responsive.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'overview-tablet',
      testMatch: '**/overview-responsive.spec.ts',
      use: { ...devices['iPad (gen 7)'] },
    },
    {
      name: 'overview-mobile',
      testMatch: '**/overview-responsive.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
  ],
});