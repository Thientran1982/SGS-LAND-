import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { emailService } from '../services/emailService';
import { processDueSequenceEnrollments } from '../services/sequenceService';

const connectionString = process.env.INTEGRITY_PG_URL;
const describePostgres = connectionString ? describe : describe.skip;
const baseConnectionString = connectionString?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

describePostgres('sequence worker concurrency against PostgreSQL', () => {
  let setupPool: Pool;
  let workerA: Pool;
  let workerB: Pool;
  let schema: string;
  let tenantId: string;
  let sequenceId: string;
  let enrollmentId: string;

  function workerConnection(): string {
    const separator = baseConnectionString!.includes('?') ? '&' : '?';
    const options = encodeURIComponent(`-c search_path="${schema}",public`);
    return `${baseConnectionString}${separator}options=${options}`;
  }

  async function row() {
    return setupPool.query(
      `SELECT step_index, status, sent_at, error
         FROM sequence_enrollments WHERE id = $1`,
      [enrollmentId],
    );
  }

  beforeAll(async () => {
    schema = `sequence_concurrency_${process.pid}_${Date.now()}`;
    setupPool = new Pool({
      connectionString: baseConnectionString,
      max: 1,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    await setupPool.query(`CREATE SCHEMA "${schema}"`);
    await setupPool.query(`SET search_path TO "${schema}", public`);
    await setupPool.query(`
      CREATE TABLE sequences (
        id UUID PRIMARY KEY, tenant_id UUID NOT NULL, is_active BOOLEAN NOT NULL,
        steps JSONB NOT NULL
      );
      CREATE TABLE leads (
        tenant_id UUID NOT NULL, email TEXT NOT NULL,
        marketing_email_consent BOOLEAN NOT NULL, opt_out_channels JSONB
      );
      CREATE TABLE sequence_enrollments (
        id UUID PRIMARY KEY, tenant_id UUID NOT NULL, sequence_id UUID NOT NULL,
        lead_email TEXT NOT NULL, lead_name TEXT, step_index INT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING', sent_at TIMESTAMPTZ, error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    tenantId = '11111111-1111-4111-8111-111111111111';
    sequenceId = '22222222-2222-4222-8222-222222222222';
    enrollmentId = '33333333-3333-4333-8333-333333333333';
    await setupPool.query(
      `INSERT INTO sequences (id, tenant_id, is_active, steps)
       VALUES ($1, $2, true, $3::jsonb)`,
      [sequenceId, tenantId, JSON.stringify([
        { type: 'EMAIL', delayHours: 0, subject: 'Step 1', content: 'Hello {{name}}' },
        { type: 'EMAIL', delayHours: 0, subject: 'Step 2', content: 'Again {{email}}' },
      ])],
    );
    await setupPool.query(
      `INSERT INTO leads (tenant_id, email, marketing_email_consent, opt_out_channels)
       VALUES ($1, $2, true, '[]'::jsonb)`,
      [tenantId, 'lead@example.com'],
    );
    await setupPool.query(
      `INSERT INTO sequence_enrollments
         (id, tenant_id, sequence_id, lead_email, lead_name, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '1 hour')`,
      [enrollmentId, tenantId, sequenceId, 'lead@example.com', 'Test Lead'],
    );

    workerA = new Pool({ connectionString: workerConnection(), max: 1, ssl: useSsl ? { rejectUnauthorized: false } : false });
    workerB = new Pool({ connectionString: workerConnection(), max: 1, ssl: useSsl ? { rejectUnauthorized: false } : false });
  });

  afterAll(async () => {
    await workerA?.end();
    await workerB?.end();
    if (setupPool) {
      await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await setupPool.end();
    }
  });

  it('allows only one concurrent worker to send each step', async () => {
    const send = vi.spyOn(emailService, 'sendSequenceEmail').mockResolvedValue({
      success: true, status: 'sent', messageId: 'test-message',
    });
    try {
      const first = await Promise.all([
        processDueSequenceEnrollments(workerA),
        processDueSequenceEnrollments(workerB),
      ]);
      expect(first.map((stats) => stats.sent).sort()).toEqual([0, 1]);
      expect(send).toHaveBeenCalledTimes(1);
      expect((await row()).rows[0]).toMatchObject({ step_index: 1, status: 'PENDING' });

      const second = await Promise.all([
        processDueSequenceEnrollments(workerA),
        processDueSequenceEnrollments(workerB),
      ]);
      expect(second.map((stats) => stats.sent).sort()).toEqual([0, 1]);
      expect(send).toHaveBeenCalledTimes(2);
      expect((await row()).rows[0]).toMatchObject({ step_index: 2, status: 'COMPLETED' });
    } finally {
      send.mockRestore();
    }
  });

  it('retries a failed claim without creating a duplicate successful step', async () => {
    await setupPool.query(
      `UPDATE sequence_enrollments SET step_index = 0, status = 'PENDING', sent_at = NULL, error = NULL
       WHERE id = $1`,
      [enrollmentId],
    );
    const send = vi.spyOn(emailService, 'sendSequenceEmail')
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValue({ success: true, status: 'sent', messageId: 'retry-message' });
    try {
      const first = await Promise.all([
        processDueSequenceEnrollments(workerA),
        processDueSequenceEnrollments(workerB),
      ]);
      expect(first.reduce((sum, stats) => sum + stats.failed, 0)).toBe(1);
      expect((await row()).rows[0]).toMatchObject({ step_index: 0, status: 'PENDING' });

      const retry = await Promise.all([
        processDueSequenceEnrollments(workerA),
        processDueSequenceEnrollments(workerB),
      ]);
      expect(retry.map((stats) => stats.sent).sort()).toEqual([0, 1]);
      expect(send).toHaveBeenCalledTimes(2);
      expect((await row()).rows[0]).toMatchObject({ step_index: 1, status: 'PENDING' });
    } finally {
      send.mockRestore();
    }
  });
});