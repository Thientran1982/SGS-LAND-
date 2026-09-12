import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

// Spawning the real backend + Next.js dev server routinely exceeds the global
// 30s hook budget under load — this integration file carries its own budget.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 240_000 });

import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { createSocialPublication } from '../repositories/socialPublicationRepository';

const integrationUrl = process.env.AIVEN_DATABASE_URL || process.env.INTEGRITY_PG_URL;
const describeEntrypoint = integrationUrl ? describe : describe.skip;
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');

const tenantA = randomUUID();
const tenantB = randomUUID();
const actorA = randomUUID();
const actorB = randomUUID();
const fixtureTitle = `entrypoint smoke fixture ${randomUUID()}`;
const jwtSecret = 'social-publication-reconcile-entrypoint-smoke-secret';
const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
const serverEntrypoint = path.resolve(process.cwd(), 'server.ts');
const nextEntrypoint = path.resolve(
  process.cwd(),
  'apps/nextjs/node_modules/next/dist/bin/next',
);

type Fixture = {
  publicationId: string;
  targetId: string;
  listingId: string;
};

type RunningProcess = {
  child: ChildProcess;
  output: () => string;
};

function connectionString(): string {
  return baseConnectionString!;
}

function startProcess(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunningProcess {
  const child = spawn(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => { output += String(chunk); });
  child.stderr?.on('data', chunk => { output += String(chunk); });
  return { child, output: () => output };
}

async function findFreePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === 'string') {
    probe.close();
    throw new Error('Could not allocate a test port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHttp(url: string, processRef: RunningProcess, label: string) {
  const deadline = Date.now() + 60_000;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    if (processRef.child.exitCode !== null) {
      throw new Error(`${label} exited with ${processRef.child.exitCode}:\n${processRef.output()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready (${lastError}):\n${processRef.output()}`);
}

async function stopProcess(processRef: RunningProcess | undefined) {
  if (!processRef || processRef.child.exitCode !== null) return;
  processRef.child.kill('SIGTERM');
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      processRef.child.kill('SIGKILL');
      resolve();
    }, 10_000);
    processRef.child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describeEntrypoint('social publication reconciliation through the preview entrypoint', () => {
  let db: Pool;
  let backend: RunningProcess | undefined;
  let frontend: RunningProcess | undefined;
  let baseUrl: string;
  let csrfCookie: string;
  let csrfToken: string;
  let fixture: Fixture;

  async function issueToken(tenantId: string, actorId: string): Promise<string> {
    return jwt.sign(
      {
        id: actorId,
        tenantId,
        role: 'ADMIN',
        email: `${actorId}@example.test`,
      },
      jwtSecret,
      { expiresIn: '10m' },
    );
  }

  async function postReconcile(
    body: Record<string, unknown>,
    tenantId: string = tenantA,
    actorId: string = actorA,
  ) {
    const token = await issueToken(tenantId, actorId);
    const response = await fetch(
      `${baseUrl}/api/social-publications/${fixture.publicationId}/targets/${fixture.targetId}/reconcile`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${csrfCookie}; token=${token}`,
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(body),
      },
    );
    return { response, body: await responseJson(response) };
  }

  beforeAll(async () => {
    db = new Pool({
      connectionString: connectionString(),
      max: 1,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false },
    });

    const listingId = randomUUID();
    await db.query('INSERT INTO listings (id) VALUES ($1)', [listingId]);
    const publication = await createSocialPublication(db, {
      tenantId: tenantA,
      listingId,
      createdBy: null,
      publishMode: 'NOW',
      scheduledAt: null,
      contentSnapshot: { title: fixtureTitle },
      assetSnapshot: [],
      platforms: ['FACEBOOK_PAGE'],
    });
    const targetId = String(publication.targets[0].id);
    await db.query(
      `UPDATE social_publications SET status = 'PROCESSING' WHERE id = $1`,
      [publication.id],
    );
    await db.query(
      `UPDATE social_publication_targets
          SET status = 'AMBIGUOUS', last_error_code = 'PROVIDER_TIMEOUT'
        WHERE id = $1`,
      [targetId],
    );
    fixture = {
      publicationId: String(publication.id),
      targetId,
      listingId,
    };

    const backendPort = await findFreePort();
    backend = startProcess(process.execPath, [tsxCli, serverEntrypoint], {
      env: {
        AIVEN_DATABASE_URL: connectionString(),
        JWT_SECRET: jwtSecret,
        NODE_ENV: 'development',
        PORT: String(backendPort),
        DB_POOL_MAX: '2',
      },
    });
    await waitForHttp(`http://127.0.0.1:${backendPort}/health`, backend, 'Express server.ts');

    const frontendPort = await findFreePort();
    frontend = startProcess(process.execPath, [
      nextEntrypoint,
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(frontendPort),
    ], {
      cwd: path.resolve(process.cwd(), 'apps/nextjs'),
      env: {
        BACKEND_URL: `http://127.0.0.1:${backendPort}`,
        NODE_ENV: 'development',
      },
    });
    baseUrl = `http://127.0.0.1:${frontendPort}`;
    await waitForHttp(`${baseUrl}/api/health`, frontend, 'Next.js preview proxy');

    const csrfResponse = await fetch(`${baseUrl}/api/csrf-token`);
    expect(csrfResponse.status).toBe(200);
    const csrfBody = await responseJson(csrfResponse);
    csrfToken = String(csrfBody.csrfToken);
    const setCookie = typeof (csrfResponse.headers as any).getSetCookie === 'function'
      ? (csrfResponse.headers as any).getSetCookie()[0]
      : csrfResponse.headers.get('set-cookie');
    csrfCookie = String(setCookie || '').split(';', 1)[0];
    expect(csrfCookie).toMatch(/^csrf_token=.+/);
  }, 120_000);

  afterAll(async () => {
    try {
      await stopProcess(frontend);
      await stopProcess(backend);
      if (fixture) {
        await db?.query('DELETE FROM social_publications WHERE id = $1', [fixture.publicationId]);
        await db?.query('DELETE FROM listings WHERE id = $1', [fixture.listingId]);
      }
    } finally {
      await db?.end();
    }
  });

  it('preserves HTTP 409 and TARGET_STATE_CONFLICT for concurrent requests', async () => {
    const body = {
      action: 'MARK_FAILED',
      reason: 'Xác nhận thủ công sau khi provider timeout.',
    };
    const results = await Promise.all([
      postReconcile(body, tenantA, actorA),
      postReconcile(body, tenantA, actorB),
    ]);

    expect(results.map(({ response }) => response.status).sort()).toEqual([200, 409]);
    const conflict = results.find(({ response }) => response.status === 409);
    expect(conflict?.body).toMatchObject({ code: 'TARGET_STATE_CONFLICT' });
  });

  it('returns 404 across the proxy without writing an audit event for another tenant', async () => {
    const result = await postReconcile(
      {
        action: 'MARK_FAILED',
        reason: 'Tenant khác thử xử lý target.',
      },
      tenantB,
      actorB,
    );

    expect(result.response.status).toBe(404);
    expect(result.body).toEqual({
      error: 'Không tìm thấy publication target trong tenant hiện tại',
    });

    const state = await db.query(
      `SELECT p.status AS publication_status, t.status AS target_status,
              (SELECT count(*) FROM social_publication_events e
                WHERE e.publication_id = p.id AND e.target_id = t.id) AS event_count
         FROM social_publications p
         JOIN social_publication_targets t ON t.publication_id = p.id
        WHERE p.id = $1 AND t.id = $2`,
      [fixture.publicationId, fixture.targetId],
    );
    expect(state.rows[0]).toMatchObject({
      publication_status: 'FAILED',
      target_status: 'FAILED_FINAL',
      event_count: '1',
    });
  });
});