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
  let leadId = '';
  let approvalId = '';
  let deliveryId = '';
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
    leadId = randomUUID();
    approvalId = randomUUID();
    deliveryId = randomUUID();

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

    await db.query(
      `INSERT INTO leads (id, tenant_id, name, email, source, stage)
       VALUES ($1, $2, $3, $4, 'E2E_FIXTURE', 'QUALIFIED')`,
      [leadId, fixtureTenantId, 'Dispute evidence lead', 'lead@example.test'],
    );

    await db.query(
      `INSERT INTO approval_requests
        (id, tenant_id, lead_id, channel, action_type, payload, reasoning, status,
         reviewed_by, reviewed_at, resumed_at)
       VALUES ($1, $2, $3, 'EMAIL', 'DRAFT_OUTREACH', $4::jsonb, $5, 'APPROVED',
               $6, NOW(), NOW())`,
      [
        approvalId,
        fixtureTenantId,
        leadId,
        JSON.stringify({
          draftVariants: [{
            id: 'email-1',
            channel: 'EMAIL',
            subject: 'Đối soát bằng chứng tranh chấp',
            message: 'Nội dung đã được broker duyệt.',
          }],
          providerPayload: {
            recipient: 'provider-payload-secret@example.test',
            rawEvent: 'must-not-export',
          },
        }),
        'Browser export fixture with provider payload that must stay internal.',
        managerId,
      ],
    );

    await db.query(
      `INSERT INTO agent_outbound_deliveries
        (id, tenant_id, execution_id, lead_id, channel, status, content_hash,
         provider_message_id, sent_at, updated_at, approval_request_id, variant_id, delivery_key)
       VALUES ($1, $2, NULL, $3, 'EMAIL', 'SENT', 'fixture-content-hash',
               'provider-message-browser-123', NOW(), NOW(), $4, 'email-1', $5)`,
      [deliveryId, fixtureTenantId, leadId, approvalId, `approval-export:${deliveryId}`],
    );

    await db.query(
      `INSERT INTO outreach_delivery_audit_events
        (tenant_id, delivery_id, approval_request_id, variant_id, event_type, provider,
         lookup_status, provider_event, provider_message_id, decision_status,
         decision_note, operator_id, operator_name)
       VALUES ($1, $2, $3, 'email-1', 'OPERATOR_DECISION', 'BREVO',
               'DELIVERED', 'delivered', 'provider-message-browser-123', 'SENT',
               'Đã đối chiếu bằng chứng provider trong browser smoke.', $4, $5)`,
      [fixtureTenantId, deliveryId, approvalId, managerId, 'Approval export manager'],
    );
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

  test('manager downloads the allowlisted dispute evidence while broker is denied', async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    await loginAndOpenApprovalInbox(page, request, managerEmail, managerPassword);
    const exportButton = page.getByRole('button', { name: 'Xuất lịch sử đối soát' });
    await expect(exportButton).toBeVisible({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const csv = await readFile(downloadPath!, 'utf8');
    const expectedFilename = `outreach-audit-${approvalId}-${new Date().toISOString().slice(0, 10)}.csv`;
    expect(download.suggestedFilename()).toBe(expectedFilename);
    expect(csv).toContain('Lookup time');
    expect(csv).toContain('provider-message-browser-123');
    expect(csv).toContain('Approval export manager');
    expect(csv).not.toContain('provider-payload-secret@example.test');
    expect(csv).not.toContain('must-not-export');

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
      }, approvalId);
      expect(deniedExport.status).toBe(403);
      expect(deniedExport.body).toContain('Only authorized managers can export outreach delivery history');
    } finally {
      await brokerContext.close();
    }
  });
});