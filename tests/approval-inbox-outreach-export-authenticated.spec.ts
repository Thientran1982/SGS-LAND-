import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.APPROVAL_INBOX_BASE_URL
  || process.env.BASE_URL
  || 'http://localhost:5001';
const DATABASE_URL = process.env.AIVEN_DATABASE_URL;

function hasUsableDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return Boolean(hostname && !['undefined', 'null', 'localhost'].includes(hostname));
  } catch {
    return false;
  }
}

function databaseConnectionString() {
  return DATABASE_URL!
    .replace(/[?&](?:sslmode|channel_binding)=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

test.skip(
  !hasUsableDatabaseUrl(DATABASE_URL),
  'requires AIVEN_DATABASE_URL with a reachable development hostname',
);

test.describe('Authenticated Approval Inbox outreach evidence export', () => {
  let db: Pool | undefined;
  let fixtureTenantId = '';
  let managerId = '';
  const approvalIds = [randomUUID(), randomUUID()];
  const leadIds = [randomUUID(), randomUUID()];
  const deliveryIds = [randomUUID(), randomUUID()];
  let managerEmail = '';
  let brokerEmail = '';
  const managerPassword = `ApprovalExportManager-${randomUUID()}`;
  const brokerPassword = `ApprovalExportBroker-${randomUUID()}`;

  const loginAndOpenApprovalInbox = async (
    page: Page,
    request: APIRequestContext,
    email: string,
    password: string,
  ) => {
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.token).toBeTruthy();

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.context().addCookies([{
      name: 'token',
      value: loginBody.token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    }]);
    await page.goto(`${BASE_URL}/#/approvals`, { waitUntil: 'domcontentloaded' });
  };

  test.beforeAll(async () => {
    db = new Pool({
      connectionString: databaseConnectionString(),
      max: 1,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false },
    });
    // Keep fixture cleanup isolated from append-only audit triggers.
    await db.query('SET session_replication_role = replica');

    fixtureTenantId = randomUUID();
    managerEmail = `approval-export-manager-${randomUUID()}@example.test`;
    brokerEmail = `approval-export-broker-${randomUUID()}@example.test`;

    const managerPasswordHash = await bcrypt.hash(managerPassword, 12);
    const brokerPasswordHash = await bcrypt.hash(brokerPassword, 12);

    await db.query(
      `INSERT INTO tenants (id, name, domain)
       VALUES ($1, $2, $3)`,
      [fixtureTenantId, 'Approval Inbox browser smoke', `${fixtureTenantId}.example.test`],
    );

    const managerResult = await db.query(
      `INSERT INTO users
        (tenant_id, name, email, password_hash, role, status, email_verified, source, phone)
       VALUES ($1, $2, $3, $4, 'MANAGER', 'ACTIVE', TRUE, 'E2E_FIXTURE', NULL)
       RETURNING id`,
      [fixtureTenantId, 'Approval export manager', managerEmail, managerPasswordHash],
    );
    managerId = String(managerResult.rows[0].id);

    await db.query(
      `INSERT INTO users
        (tenant_id, name, email, password_hash, role, status, email_verified, source, phone)
       VALUES ($1, $2, $3, $4, 'BROKER', 'ACTIVE', TRUE, 'E2E_FIXTURE', NULL)
      `,
      [fixtureTenantId, 'Approval export broker', brokerEmail, brokerPasswordHash],
    );

    const fixtures = [
      {
        approvalId: approvalIds[0],
        leadId: leadIds[0],
        deliveryId: deliveryIds[0],
        leadName: 'Dispute evidence lead one',
        leadEmail: 'lead-one@example.test',
        variantId: 'email-one',
        providerMessageId: 'provider-message-browser-one',
        providerEvent: 'delivered-one',
        decisionNote: 'Đã đối soát bộ bằng chứng approval một.',
        providerPayload: {
          recipient: 'provider-payload-secret-one@example.test',
          rawEvent: 'must-not-export-one',
        },
      },
      {
        approvalId: approvalIds[1],
        leadId: leadIds[1],
        deliveryId: deliveryIds[1],
        leadName: 'Dispute evidence lead two',
        leadEmail: 'lead-two@example.test',
        variantId: 'email-two',
        providerMessageId: 'provider-message-browser-two',
        providerEvent: 'delivered-two',
        decisionNote: 'Đã đối soát bộ bằng chứng approval hai.',
        providerPayload: {
          recipient: 'provider-payload-secret-two@example.test',
          rawEvent: 'must-not-export-two',
        },
      },
    ];

    for (const fixture of fixtures) {
      await db.query(
        `INSERT INTO leads (id, tenant_id, name, email, source, stage)
         VALUES ($1, $2, $3, $4, 'E2E_FIXTURE', 'QUALIFIED')`,
        [fixture.leadId, fixtureTenantId, fixture.leadName, fixture.leadEmail],
      );

      await db.query(
        `INSERT INTO approval_requests
          (id, tenant_id, lead_id, channel, action_type, payload, reasoning, status,
           reviewed_by, reviewed_at, resumed_at)
         VALUES ($1, $2, $3, 'EMAIL', 'DRAFT_OUTREACH', $4::jsonb, $5, 'APPROVED',
                 $6, NOW(), NOW())`,
        [
          fixture.approvalId,
          fixtureTenantId,
          fixture.leadId,
          JSON.stringify({
            draftVariants: [{
              id: fixture.variantId,
              channel: 'EMAIL',
              subject: 'Đối soát bằng chứng tranh chấp',
              message: 'Nội dung đã được broker duyệt.',
            }],
            providerPayload: fixture.providerPayload,
          }),
          `Browser export fixture ${fixture.approvalId} with provider payload that must stay internal.`,
          managerId,
        ],
      );

      await db.query(
        `INSERT INTO agent_outbound_deliveries
          (id, tenant_id, execution_id, lead_id, channel, status, content_hash,
           provider_message_id, sent_at, updated_at, approval_request_id, variant_id, delivery_key)
         VALUES ($1, $2, NULL, $3, 'EMAIL', 'SENT', $4,
                 $5, NOW(), NOW(), $6, $7, $8)`,
        [
          fixture.deliveryId,
          fixtureTenantId,
          fixture.leadId,
          `fixture-content-hash-${fixture.variantId}`,
          fixture.providerMessageId,
          fixture.approvalId,
          fixture.variantId,
          `approval-export:${fixture.deliveryId}`,
        ],
      );

      await db.query(
        `INSERT INTO outreach_delivery_audit_events
          (tenant_id, delivery_id, approval_request_id, variant_id, event_type, provider,
           lookup_status, provider_event, provider_message_id, decision_status,
           decision_note, operator_id, operator_name)
         VALUES ($1, $2, $3, $4, 'OPERATOR_DECISION', 'BREVO',
                 'DELIVERED', $5, $6, 'SENT', $7, $8, $9)`,
        [
          fixtureTenantId,
          fixture.deliveryId,
          fixture.approvalId,
          fixture.variantId,
          fixture.providerEvent,
          fixture.providerMessageId,
          fixture.decisionNote,
          managerId,
          'Approval export manager',
        ],
      );
    }
  });

  test.afterAll(async () => {
    try {
      await db?.query('SET session_replication_role = replica');
      if (db && fixtureTenantId) {
        await db.query('DELETE FROM outreach_delivery_audit_events WHERE tenant_id = $1', [fixtureTenantId]);
        await db.query('DELETE FROM agent_outbound_deliveries WHERE tenant_id = $1', [fixtureTenantId]);
        await db.query('DELETE FROM approval_requests WHERE tenant_id = $1', [fixtureTenantId]);
        await db.query('DELETE FROM leads WHERE tenant_id = $1', [fixtureTenantId]);
        await db.query('DELETE FROM users WHERE tenant_id = $1', [fixtureTenantId]);
        await db.query('DELETE FROM tenants WHERE id = $1', [fixtureTenantId]);
      }
    } finally {
      await db?.end();
    }
  });

  test('manager downloads each approval only with its own allowlisted dispute evidence while broker is denied', async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    await loginAndOpenApprovalInbox(page, request, managerEmail, managerPassword);
    const cards = approvalIds.map(id => page.getByTestId(`outreach-approval-card-${id}`));
    for (const card of cards) await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Xuất lịch sử đối soát' })).toHaveCount(2);

    const evidence = [
      {
        approvalId: approvalIds[0],
        providerMessageId: 'provider-message-browser-one',
        providerEvent: 'delivered-one',
        decisionNote: 'Đã đối soát bộ bằng chứng approval một.',
        deliveryId: deliveryIds[0],
        providerPayloadRecipient: 'provider-payload-secret-one@example.test',
        providerPayloadEvent: 'must-not-export-one',
        otherApprovalId: approvalIds[1],
        otherProviderMessageId: 'provider-message-browser-two',
        otherProviderEvent: 'delivered-two',
        otherDecisionNote: 'Đã đối soát bộ bằng chứng approval hai.',
        otherDeliveryId: deliveryIds[1],
        otherProviderPayloadRecipient: 'provider-payload-secret-two@example.test',
        otherProviderPayloadEvent: 'must-not-export-two',
      },
      {
        approvalId: approvalIds[1],
        providerMessageId: 'provider-message-browser-two',
        providerEvent: 'delivered-two',
        decisionNote: 'Đã đối soát bộ bằng chứng approval hai.',
        deliveryId: deliveryIds[1],
        providerPayloadRecipient: 'provider-payload-secret-two@example.test',
        providerPayloadEvent: 'must-not-export-two',
        otherApprovalId: approvalIds[0],
        otherProviderMessageId: 'provider-message-browser-one',
        otherProviderEvent: 'delivered-one',
        otherDecisionNote: 'Đã đối soát bộ bằng chứng approval một.',
        otherDeliveryId: deliveryIds[0],
        otherProviderPayloadRecipient: 'provider-payload-secret-one@example.test',
        otherProviderPayloadEvent: 'must-not-export-one',
      },
    ];

    for (const expected of evidence) {
      const card = page.getByTestId(`outreach-approval-card-${expected.approvalId}`);
      const downloadPromise = page.waitForEvent('download');
      await card.getByRole('button', { name: 'Xuất lịch sử đối soát' }).click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();

      const csv = await readFile(downloadPath!, 'utf8');
      const expectedFilename = `outreach-audit-${expected.approvalId}-${new Date().toISOString().slice(0, 10)}.csv`;
      expect(download.suggestedFilename()).toBe(expectedFilename);
      expect(csv).toContain('Lookup time');
      expect(csv).toContain(expected.approvalId);
      expect(csv).toContain(expected.deliveryId);
      expect(csv).toContain(expected.providerMessageId);
      expect(csv).toContain(expected.providerEvent);
      expect(csv).toContain(expected.decisionNote);
      expect(csv).toContain('Approval export manager');
      expect(csv).not.toContain(expected.providerPayloadRecipient);
      expect(csv).not.toContain(expected.providerPayloadEvent);
      expect(csv).not.toContain(expected.otherApprovalId);
      expect(csv).not.toContain(expected.otherDeliveryId);
      expect(csv).not.toContain(expected.otherProviderMessageId);
      expect(csv).not.toContain(expected.otherProviderEvent);
      expect(csv).not.toContain(expected.otherDecisionNote);
      expect(csv).not.toContain(expected.otherProviderPayloadRecipient);
      expect(csv).not.toContain(expected.otherProviderPayloadEvent);
    }

    const brokerContext = await browser.newContext();
    try {
      const brokerPage = await brokerContext.newPage();
      await loginAndOpenApprovalInbox(brokerPage, request, brokerEmail, brokerPassword);
      await expect(
        brokerPage.getByRole('button', { name: 'Xuất lịch sử đối soát' }),
      ).toHaveCount(0);

      const deniedExport = await brokerPage.evaluate(async (id) => {
        const response = await fetch(`/api/approval-requests/${id}/outreach-audit-export`, {
          credentials: 'include',
          cache: 'no-store',
        });
        return { status: response.status, body: await response.text() };
      }, approvalIds[0]);
      expect(deniedExport.status).toBe(403);
      expect(deniedExport.body).toContain('Only authorized managers can export outreach delivery history');
    } finally {
      await brokerContext.close();
    }
  });
});