import { afterEach, describe, expect, it, vi } from 'vitest';

const qstashMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@upstash/qstash', () => ({
  Client: class MockQstashClient {
    schedules = qstashMocks;
  },
}));

const ENV_KEYS = [
  'NODE_ENV',
  'PROD_DOMAIN',
  'QSTASH_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'AUTO_POSTING_CRON_SECRET',
  'SOCIAL_PUBLISHING_CRON_SECRET',
  'JWT_SECRET',
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map(key => [key, process.env[key]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe('QStash Facebook auto-posting schedule', () => {
  afterEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  it('verifies the configured QStash endpoint and upserts the 18:30 Vietnam trigger safely', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PROD_DOMAIN = 'sgs-land.example.test';
    process.env.QSTASH_URL = 'https://qstash.example.test';
    process.env.QSTASH_TOKEN = 'qstash-test-token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'signing-test-key';
    process.env.AUTO_POSTING_CRON_SECRET = 'cron-test-secret';

    qstashMocks.list.mockResolvedValueOnce([]);
    qstashMocks.create.mockResolvedValue({});
    qstashMocks.get.mockResolvedValue({
      scheduleId: 'marketing-auto-posting-daily-1830',
      destination: 'https://sgs-land.example.test/api/internal/auto-posting-cron',
      cron: '30 11 * * *',
    });

    const {
      getQstashOperationalStatus,
      registerAutoPostingSchedule,
      verifyQstashTokenAtStartup,
    } = await import('../queue');

    expect(await verifyQstashTokenAtStartup()).toBe(true);
    const firstRegistration = await registerAutoPostingSchedule();
    const secondRegistration = await registerAutoPostingSchedule();

    expect(firstRegistration).toMatchObject({
      status: 'REGISTERED',
      destination: 'https://sgs-land.example.test/api/internal/auto-posting-cron',
      cron: '30 11 * * *',
    });
    expect(secondRegistration.status).toBe('REGISTERED');
    expect(qstashMocks.create).toHaveBeenCalledTimes(2);
    expect(qstashMocks.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      scheduleId: 'marketing-auto-posting-daily-1830',
      destination: 'https://sgs-land.example.test/api/internal/auto-posting-cron',
      cron: '30 11 * * *',
      method: 'POST',
      body: '{}',
      headers: expect.objectContaining({
        'x-internal-secret': 'cron-test-secret',
      }),
    }));

    const operational = getQstashOperationalStatus();
    expect(operational).toMatchObject({
      configured: true,
      verified: true,
      endpoint: 'qstash.example.test',
      autoPostingSchedule: {
        status: 'REGISTERED',
        id: 'marketing-auto-posting-daily-1830',
        cron: '30 11 * * *',
      },
    });
    expect(JSON.stringify(operational)).not.toContain('qstash-test-token');
    expect(JSON.stringify(operational)).not.toContain('cron-test-secret');
  });

  it('does not claim registration when QStash verification is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PROD_DOMAIN = 'sgs-land.example.test';
    process.env.QSTASH_URL = 'https://qstash.example.test';
    process.env.QSTASH_TOKEN = 'qstash-test-token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'signing-test-key';
    process.env.AUTO_POSTING_CRON_SECRET = 'cron-test-secret';

    qstashMocks.list.mockRejectedValueOnce(new Error('401 unauthorized'));

    const {
      getQstashOperationalStatus,
      registerAutoPostingSchedule,
      verifyQstashTokenAtStartup,
    } = await import('../queue');

    expect(await verifyQstashTokenAtStartup()).toBe(false);
    const registration = await registerAutoPostingSchedule();

    expect(registration).toMatchObject({ status: 'NOT_READY' });
    expect(qstashMocks.create).not.toHaveBeenCalled();
    expect(getQstashOperationalStatus().autoPostingSchedule.status).toBe('NOT_READY');
  });

  it('reads current schedule metadata without changing the schedule or triggering a run', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PROD_DOMAIN = 'sgs-land.example.test';
    process.env.QSTASH_URL = 'https://qstash.example.test';
    process.env.QSTASH_TOKEN = 'qstash-test-token';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'signing-test-key';
    process.env.AUTO_POSTING_CRON_SECRET = 'cron-test-secret';

    qstashMocks.list.mockResolvedValueOnce([]);
    qstashMocks.get.mockResolvedValueOnce({
      scheduleId: 'marketing-auto-posting-daily-1830',
      destination: 'https://sgs-land.example.test/api/internal/auto-posting-cron',
      cron: '30 11 * * *',
      method: 'POST',
    });

    const {
      getAutoPostingTriggerDiagnostic,
      verifyQstashTokenAtStartup,
    } = await import('../queue');

    expect(await verifyQstashTokenAtStartup()).toBe(true);
    const diagnostic = await getAutoPostingTriggerDiagnostic('cron-test-secret');

    expect(diagnostic).toMatchObject({
      ok: true,
      code: 'AUTO_POSTING_TRIGGER_READY',
      dryRun: true,
      endpoint: {
        ready: true,
        code: 'ENDPOINT_READY',
      },
      cronSecret: {
        ready: true,
        code: 'CRON_SECRET_CONFIGURED',
      },
      qstash: {
        ready: true,
        code: 'QSTASH_READY',
        schedule: {
          current: {
            destination: 'https://sgs-land.example.test/api/internal/auto-posting-cron',
            cron: '30 11 * * *',
            method: 'POST',
          },
        },
      },
      sideEffects: {
        dailyRuns: false,
        ledgerWrites: false,
        publications: false,
        providerCalls: false,
        qstashWrites: false,
      },
    });
    expect(qstashMocks.get).toHaveBeenCalledWith('marketing-auto-posting-daily-1830');
    expect(qstashMocks.create).not.toHaveBeenCalled();
    expect(JSON.stringify(diagnostic)).not.toContain('qstash-test-token');
    expect(JSON.stringify(diagnostic)).not.toContain('cron-test-secret');
  });

  it('reports separate configuration failure codes without contacting or changing QStash', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PROD_DOMAIN;
    delete process.env.QSTASH_URL;
    delete process.env.QSTASH_TOKEN;

    const { getAutoPostingTriggerDiagnostic } = await import('../queue');
    const diagnostic = await getAutoPostingTriggerDiagnostic('');

    expect(diagnostic).toMatchObject({
      ok: false,
      code: 'AUTO_POSTING_TRIGGER_NOT_READY',
      endpoint: {
        ready: false,
        code: 'ENDPOINT_DOMAIN_MISSING',
      },
      cronSecret: {
        ready: false,
        configured: false,
        code: 'CRON_SECRET_MISSING',
      },
      qstash: {
        ready: false,
        configured: false,
        code: 'QSTASH_TOKEN_MISSING',
      },
    });
    expect(diagnostic.failedComponents).toEqual(['endpoint', 'cronSecret', 'qstash']);
    expect(qstashMocks.list).not.toHaveBeenCalled();
    expect(qstashMocks.get).not.toHaveBeenCalled();
    expect(qstashMocks.create).not.toHaveBeenCalled();
  });
});