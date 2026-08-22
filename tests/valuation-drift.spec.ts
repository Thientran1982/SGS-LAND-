/**
 * Integration coverage for the protected valuation drift-threshold settings.
 *
 * These tests use the real login/session middleware and the real database.
 * Set ADMIN_EMAIL/ADMIN_PASS and NON_ADMIN_EMAIL/NON_ADMIN_PASS to run them.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sgs.vn';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const NON_ADMIN_EMAIL = process.env.NON_ADMIN_EMAIL || '';
const NON_ADMIN_PASS = process.env.NON_ADMIN_PASS || '';

type DriftConfig = {
  version: number;
  thresholds: {
    maeVndPerM2: number;
    mape: number;
    consecutiveRuns: number;
  };
  updatedBy: string | null;
};

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(response.status(), `login failed for ${email}`).toBe(200);
  return response.json();
}

test.describe('valuation drift threshold administration', () => {
  test.skip(
    !ADMIN_PASS || !NON_ADMIN_EMAIL || !NON_ADMIN_PASS,
    'Set ADMIN_PASS, NON_ADMIN_EMAIL and NON_ADMIN_PASS to run drift-threshold integration tests',
  );

  test('non-admin users receive 403 from both drift-threshold endpoints', async ({ request }) => {
    await login(request, NON_ADMIN_EMAIL, NON_ADMIN_PASS);

    const getResponse = await request.get('/api/valuation/admin/drift-thresholds');
    expect(getResponse.status()).toBe(403);

    const putResponse = await request.put('/api/valuation/admin/drift-thresholds', {
      data: {
        maeVndPerM2: 21_000_000,
        mape: 0.21,
        consecutiveRuns: 4,
      },
    });
    expect(putResponse.status()).toBe(403);
  });

  test('admin updates retain the author and append an auditable history entry', async ({ request }) => {
    await login(request, ADMIN_EMAIL, ADMIN_PASS);

    const beforeResponse = await request.get('/api/valuation/admin/drift-thresholds');
    expect(beforeResponse.status()).toBe(200);
    const before = await beforeResponse.json() as {
      config: DriftConfig;
      history: Array<{ version: number; authorId: string | null; newThresholds: DriftConfig['thresholds'] }>;
    };

    const updatedThresholds = {
      maeVndPerM2: before.config.thresholds.maeVndPerM2 + 1_000_000,
      mape: Math.min(2, before.config.thresholds.mape + 0.01),
      consecutiveRuns: before.config.thresholds.consecutiveRuns + 1,
    };

    try {
      const updateResponse = await request.put('/api/valuation/admin/drift-thresholds', {
        data: updatedThresholds,
      });
      expect(updateResponse.status()).toBe(200);
      const updated = await updateResponse.json() as {
        config: DriftConfig;
        history: Array<{ version: number; authorId: string | null; newThresholds: DriftConfig['thresholds'] }>;
      };

      expect(updated.config.version).toBe(before.config.version + 1);
      expect(updated.config.thresholds).toEqual(updatedThresholds);
      expect(updated.config.updatedBy).toBeTruthy();
      expect(updated.history[0]).toMatchObject({
        version: updated.config.version,
        authorId: updated.config.updatedBy,
        newThresholds: updatedThresholds,
      });
    } finally {
      await request.put('/api/valuation/admin/drift-thresholds', {
        data: before.config.thresholds,
      });
    }
  });

  test('saved backtests include the threshold version and applied-threshold snapshot', async ({ request }) => {
    await login(request, ADMIN_EMAIL, ADMIN_PASS);

    const beforeResponse = await request.get('/api/valuation/admin/drift-thresholds');
    expect(beforeResponse.status()).toBe(200);
    const before = await beforeResponse.json() as { config: DriftConfig };
    const appliedThresholds = {
      maeVndPerM2: before.config.thresholds.maeVndPerM2 + 2_000_000,
      mape: Math.min(2, before.config.thresholds.mape + 0.02),
      consecutiveRuns: before.config.thresholds.consecutiveRuns + 1,
    };

    try {
      const updateResponse = await request.put('/api/valuation/admin/drift-thresholds', {
        data: appliedThresholds,
      });
      expect(updateResponse.status()).toBe(200);
      const updated = await updateResponse.json() as { config: DriftConfig };

      const reportResponse = await request.get('/api/valuation/admin/evaluation-report');
      expect(reportResponse.status()).toBe(200);
      const body = await reportResponse.json() as {
        report: {
          thresholdVersion?: number;
          appliedThresholds?: DriftConfig['thresholds'];
        };
        history: Array<{
          thresholdVersion: number | null;
          thresholds: DriftConfig['thresholds'] | null;
        }>;
      };

      expect(body.report.thresholdVersion).toBe(updated.config.version);
      expect(body.report.appliedThresholds).toEqual(appliedThresholds);
      expect(body.history.at(-1)).toMatchObject({
        thresholdVersion: updated.config.version,
        thresholds: appliedThresholds,
      });
    } finally {
      await request.put('/api/valuation/admin/drift-thresholds', {
        data: before.config.thresholds,
      });
    }
  });
});