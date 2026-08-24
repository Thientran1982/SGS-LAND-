import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * End-to-end coverage for the real Brevo webhook boundary.
 *
 * The fixture uses the host tenant because the public webhook intentionally
 * has no authenticated user/tenant context. The delivery key remains the
 * tenant boundary for tracking events.
 */
test.skip(!process.env.AIVEN_DATABASE_URL, 'requires the integration PostgreSQL database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const HOST_TENANT = '00000000-0000-0000-0000-000000000001';
const secret = process.env.BREVO_WEBHOOK_SECRET || '';

function signedHeaders(rawBody: string) {
  return {
    'content-type': 'application/json',
    // In development the endpoint permits an unset secret; still send the
    // exact HMAC header used by Brevo so this exercises the signed contract.
    'x-brevo-signature': createHmac('sha256', secret).update(rawBody).digest('hex'),
  };
}

async function postBrevo(request: APIRequestContext, body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  return request.post(`${BASE_URL}/api/webhooks/brevo`, {
    data: rawBody,
    headers: signedHeaders(rawBody),
  });
}

test.describe('Brevo Customer Care webhook', () => {
  let db: Pool;
  let leadId: string;
  let otherTenantId: string;
  let otherLeadId: string;
  let email: string;
  let deliveryKey: string;
  let otherDeliveryKey: string;
  let fixtureReady = false;
  const eventKeys: string[] = [];

  test.beforeAll(async () => {
    // pg's connection-string parser lets sslmode=require override the
    // explicit ssl object, so remove that libpq-only option before connecting.
    const databaseUrl = process.env.AIVEN_DATABASE_URL!
      .replace(/[?&]sslmode=[^&]*/i, '')
      .replace(/\?$/, '');
    db = new Pool({
      connectionString: databaseUrl,
      // Aiven's CA is trusted by the application through its checked-in
      // certificate; Playwright's direct fixture connection needs the same
      // practical compatibility in CI/local test environments.
      ssl: { rejectUnauthorized: false },
    });
    const suffix = randomUUID();
    email = `brevo-care-${suffix}@example.test`;
    leadId = randomUUID();
    otherTenantId = randomUUID();
    otherLeadId = randomUUID();
    deliveryKey = `care-followup:${HOST_TENANT}:${leadId}:D1`;
    otherDeliveryKey = `care-followup:${otherTenantId}:${otherLeadId}:D1`;

    await db.query(
      `INSERT INTO tenants (id, name, domain)
       VALUES ($1, 'Brevo webhook E2E fixture', $2)`,
      [otherTenantId, `brevo-webhook-${suffix}.test`],
    );
    await db.query(
      `INSERT INTO leads (id, tenant_id, name, email, phone, stage, care_status, created_at)
       VALUES ($1, $2, 'Brevo Care E2E', $3, '0900000000', 'NEW', 'ACTIVE', NOW() - INTERVAL '8 days'),
              ($4, $5, 'Other tenant decoy', $3, '0900000001', 'NEW', 'ACTIVE', NOW() - INTERVAL '8 days')`,
      [leadId, HOST_TENANT, email, otherLeadId, otherTenantId],
    );
    await db.query(
      `INSERT INTO care_followup_log
         (tenant_id, lead_id, day_mark, delivery_key, subject, status, sent_at)
       VALUES
         ($1, $2, 'D1', $3, 'D1 fixture', 'SENT', NOW()),
          ($4, $5, 'D1', $6, 'decoy fixture', 'SENT', NOW())`,
      [
        HOST_TENANT, leadId, deliveryKey,
        otherTenantId, otherLeadId, otherDeliveryKey,
      ],
    );
    fixtureReady = true;
  });

  test.afterAll(async () => {
    if (!db) return;
    if (!fixtureReady) {
      await db.end();
      return;
    }
    await db.query(`DELETE FROM webhook_events WHERE event_key = ANY($1::text[])`, [eventKeys]);
    await db.query(`DELETE FROM care_followup_log WHERE lead_id = ANY($1::uuid[])`, [[leadId, otherLeadId]]);
    await db.query(`DELETE FROM leads WHERE id = ANY($1::uuid[])`, [[leadId, otherLeadId]]);
    await db.query(`DELETE FROM tenants WHERE id = $1`, [otherTenantId]);
    await db.end();
  });

  test('applies signed opened/clicked events to the correct tenant delivery and is retry-safe', async ({ request }) => {
    const openedKey = `opened-${randomUUID()}`;
    const clickedKey = `clicked-${randomUUID()}`;
    eventKeys.push(`email-engagement:brevo:${openedKey}:opened:1700000000000:${deliveryKey}`);
    eventKeys.push(`email-engagement:brevo:${clickedKey}:clicked:1700000001000:${deliveryKey}`);

    for (const [event, eventId, timestamp] of [
      ['opened', openedKey, 1700000000],
      ['clicked', clickedKey, 1700000001],
    ] as const) {
      const response = await postBrevo(request, {
        event, id: eventId, email, ts: timestamp,
        tags: [`delivery-key:${deliveryKey}`],
      });
      expect(response.status()).toBe(200);
    }

    const row = await db.query(
      `SELECT tenant_id, lead_id, engagement_status, opened_at, clicked_at
       FROM care_followup_log WHERE delivery_key = $1`,
      [deliveryKey],
    );
    expect(row.rows[0]).toMatchObject({
      tenant_id: HOST_TENANT,
      lead_id: leadId,
      engagement_status: 'CLICKED',
    });
    expect(row.rows[0].opened_at).not.toBeNull();
    expect(row.rows[0].clicked_at).not.toBeNull();

    const decoy = await db.query(
      `SELECT engagement_status, opened_at, clicked_at
       FROM care_followup_log WHERE delivery_key = $1`,
      [otherDeliveryKey],
    );
    expect(decoy.rows[0]).toMatchObject({ engagement_status: 'SENT', opened_at: null, clicked_at: null });

    const beforeReplay = await db.query(
      `SELECT engagement_status, opened_at, clicked_at FROM care_followup_log WHERE delivery_key = $1`,
      [deliveryKey],
    );
    const replay = await postBrevo(request, {
      event: 'clicked', id: clickedKey, email, ts: 1700000001,
      tags: [`delivery-key:${deliveryKey}`],
    });
    expect(replay.status()).toBe(200);
    const afterReplay = await db.query(
      `SELECT engagement_status, opened_at, clicked_at FROM care_followup_log WHERE delivery_key = $1`,
      [deliveryKey],
    );
    expect(afterReplay.rows).toEqual(beforeReplay.rows);
    expect((await db.query(
      `SELECT count(*)::int AS count FROM webhook_events
       WHERE platform='email-engagement' AND event_key LIKE $1`,
      [`%:${deliveryKey}`],
    )).rows[0].count).toBe(2);
  });

  test('updates only the matching lead on signed reply, stops remaining Care milestones, and ignores replay', async ({ request }) => {
    const messageId = `reply-${randomUUID()}`;
    eventKeys.push(`inbound:${messageId}`);
    const replyBody = {
      From: email,
      To: 'care@sgsland.vn',
      Subject: 'Re: D1 fixture',
      RawTextBody: 'Tôi muốn được tư vấn thêm.',
      MessageID: messageId,
    };
    const first = await postBrevo(request, replyBody);
    expect(first.status()).toBe(200);

    const lead = await db.query(
      `SELECT tenant_id, stage, care_status FROM leads WHERE id = $1`,
      [leadId],
    );
    expect(lead.rows[0]).toMatchObject({
      tenant_id: HOST_TENANT,
      stage: 'NEW',
      care_status: 'REPLIED',
    });
    const decoyLead = await db.query(`SELECT stage, care_status FROM leads WHERE id = $1`, [otherLeadId]);
    expect(decoyLead.rows[0]).toMatchObject({ stage: 'NEW', care_status: 'ACTIVE' });

    const milestones = await db.query(
      `SELECT day_mark, status FROM care_followup_log WHERE lead_id = $1 ORDER BY day_mark`,
      [leadId],
    );
    expect(milestones.rows).toEqual([{ day_mark: 'D1', status: 'SENT' }]);

    // The webhook queues the normal email interaction asynchronously. It must
    // be created once for the first delivery, not once per provider retry.
    await expect.poll(async () => (await db.query(
      `SELECT count(*)::int AS count FROM interactions WHERE lead_id = $1`,
      [leadId],
    )).rows[0].count, { timeout: 10_000 }).toBe(1);

    const replay = await postBrevo(request, replyBody);
    expect(replay.status()).toBe(200);
    const replayState = await db.query(
      `SELECT care_status, updated_at FROM leads WHERE id = $1`,
      [leadId],
    );
    expect(replayState.rows[0].care_status).toBe('REPLIED');
    expect((await db.query(
      `SELECT count(*)::int AS count FROM webhook_events
       WHERE platform='brevo-care' AND event_key = $1`,
      [`inbound:${messageId}`],
    )).rows[0].count).toBe(1);
    expect((await db.query(
      `SELECT count(*)::int AS count FROM interactions WHERE lead_id = $1`,
      [leadId],
    )).rows[0].count).toBe(1);

    const stopped = await db.query(
      `SELECT day_mark, status FROM care_followup_log WHERE lead_id = $1 ORDER BY day_mark`,
      [leadId],
    );
    expect(stopped.rows).toEqual([
      { day_mark: 'D1', status: 'SENT' },
      { day_mark: 'D3', status: 'SKIPPED' },
      { day_mark: 'D5', status: 'SKIPPED' },
      { day_mark: 'D7', status: 'SKIPPED' },
    ]);
  });
});