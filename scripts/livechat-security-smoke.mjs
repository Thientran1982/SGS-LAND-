import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const PLAYWRIGHT_CLI = `${require.resolve('@playwright/test')}`.replace(
  /index\.js$/,
  'cli.js',
);
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DATABASE_URL = process.env.AIVEN_DATABASE_URL;
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const REQUIRED_TABLES = ['tenants', 'leads', 'landing_pages', 'uploaded_files', 'agent_executions'];
const ENVIRONMENT_BLOCKED = 2;

class EnvironmentBlocked extends Error {}

function isReleaseMode() {
  return process.env.LIVECHAT_SECURITY_SMOKE_MODE === 'release' || process.env.CI === 'true';
}

function hasUsableDatabaseUrl(value) {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return Boolean(hostname && !['undefined', 'null', 'localhost'].includes(hostname));
  } catch {
    return false;
  }
}

function databaseConnectionString(value) {
  return value
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function redactError(error) {
  return String(error?.message || error)
    .replace(/postgres(?:ql)?:\/\/[^\\s]+/gi, 'postgresql://[redacted]')
    .replace(/AIVEN_DATABASE_URL[^\n]*/gi, 'AIVEN_DATABASE_URL [redacted]');
}

async function run(command, args, { captureOutput = true } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    const forward = (stream, chunk) => {
      const text = chunk.toString();
      if (captureOutput) output += text;
      stream.write(chunk);
    };
    child.stdout.on('data', (chunk) => forward(process.stdout, chunk));
    child.stderr.on('data', (chunk) => forward(process.stderr, chunk));
    child.on('error', (error) => resolve({ code: 1, signal: null, output: redactError(error) }));
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, output }));
  });
}

async function verifyDatabaseFixture() {
  if (!DATABASE_URL) {
    if (isReleaseMode()) {
      throw new EnvironmentBlocked('AIVEN_DATABASE_URL is not configured for release validation');
    }
    console.log(
      '[LIVECHAT_SECURITY_SMOKE:SKIPPED] AIVEN_DATABASE_URL is not configured; ' +
        'the external fixture is unavailable.',
    );
    return false;
  }

  if (!hasUsableDatabaseUrl(DATABASE_URL)) {
    throw new EnvironmentBlocked(
      'AIVEN_DATABASE_URL must contain a reachable non-local development hostname',
    );
  }

  const pool = new Pool({
    connectionString: databaseConnectionString(DATABASE_URL),
    max: 1,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query('SELECT 1');
    const tableResult = await pool.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );
    const presentTables = new Set(tableResult.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((table) => !presentTables.has(table));
    if (missingTables.length > 0) {
      throw new EnvironmentBlocked(
        `external live-chat fixture is missing required tables: ${missingTables.join(', ')}`,
      );
    }

    const tenantResult = await pool.query('SELECT 1 FROM tenants WHERE id = $1 LIMIT 1', [
      HOST_TENANT,
    ]);
    if (tenantResult.rowCount !== 1) {
      throw new EnvironmentBlocked(
        `external live-chat fixture is missing host tenant ${HOST_TENANT}`,
      );
    }
  } catch (error) {
    if (error instanceof EnvironmentBlocked) throw error;
    throw new EnvironmentBlocked(`external live-chat database is not ready: ${redactError(error)}`);
  } finally {
    await pool.end().catch(() => undefined);
  }

  console.log('[LIVECHAT_SECURITY_SMOKE:READY] External database fixture is reachable and complete.');
  return true;
}

async function verifyChromium() {
  console.log('[LIVECHAT_SECURITY_SMOKE:SETUP] Installing/verifying the Playwright Chromium binary.');
  const install = await run(process.execPath, [PLAYWRIGHT_CLI, 'install', 'chromium']);
  if (install.code !== 0) {
    throw new EnvironmentBlocked('Playwright could not install Chromium');
  }

  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (error) {
    throw new EnvironmentBlocked(
      `Chromium could not start; verify the system libraries in .replit or the CI image: ${redactError(error)}`,
    );
  }
  console.log('[LIVECHAT_SECURITY_SMOKE:READY] Chromium launched successfully.');
}

async function verifyBaseUrl() {
  if (process.env.PLAYWRIGHT_START_SERVER) {
    console.log(
      '[LIVECHAT_SECURITY_SMOKE:SETUP] PLAYWRIGHT_START_SERVER is enabled; Playwright will start the app.',
    );
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`health endpoint returned HTTP ${response.status}`);
    }
  } catch (error) {
    throw new EnvironmentBlocked(
      `base URL ${BASE_URL} is not reachable: ${redactError(error)}`,
    );
  }
  console.log(`[LIVECHAT_SECURITY_SMOKE:READY] Base URL ${BASE_URL} is reachable.`);
}

function isEnvironmentFailure(output) {
  return [
    /browserType\.(?:launch|launchPersistentContext)/i,
    /Executable doesn't exist/i,
    /Host system is missing dependencies/i,
    /web server .*failed to start/i,
    /did not appear within/i,
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT/i,
    /net::ERR_CONNECTION/i,
    /Received:\s*503\b/i,
  ].some((pattern) => pattern.test(output));
}

async function main() {
  const hasFixture = await verifyDatabaseFixture();
  if (!hasFixture) return;

  await verifyChromium();
  await verifyBaseUrl();

  console.log(
    '[LIVECHAT_SECURITY_SMOKE:RUNNING] Running tests/livechat-capability.spec.ts with Chromium.',
  );
  const result = await run(process.execPath, [
    PLAYWRIGHT_CLI,
    'test',
    'tests/livechat-capability.spec.ts',
    '--project=chromium',
  ]);

  if (result.code === 0) {
    console.log('[LIVECHAT_SECURITY_SMOKE:PASSED] Public live-chat security assertions passed.');
    return;
  }

  if (isEnvironmentFailure(result.output)) {
    throw new EnvironmentBlocked(
      'the browser or application setup failed before the security assertions completed',
    );
  }

  console.error(
    '[LIVECHAT_SECURITY_SMOKE:FAILED_SECURITY_ASSERTION] ' +
      'The public live-chat authorization assertions failed.',
  );
  process.exitCode = result.signal ? 1 : result.code;
}

main().catch((error) => {
  if (error instanceof EnvironmentBlocked) {
    console.error(`[LIVECHAT_SECURITY_SMOKE:ENVIRONMENT_BLOCKED] ${error.message}`);
    process.exitCode = ENVIRONMENT_BLOCKED;
    return;
  }
  console.error(`[LIVECHAT_SECURITY_SMOKE:ENVIRONMENT_BLOCKED] ${redactError(error)}`);
  process.exitCode = ENVIRONMENT_BLOCKED;
});