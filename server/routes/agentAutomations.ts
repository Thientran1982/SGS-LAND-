/**
 * agentAutomations.ts — P0.2 Webhook Automations
 * Cho phep ben ngoai (Zalo OA, form, sao BDS khac) danh thuc agent qua
 * POST /api/public/automations/:slug/run voi header x-automation-secret.
 * Admin CRUD: GET/POST/PATCH/DELETE /api/admin/automations.
 */
import { Router, type Request, type Response } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';

export const automationRouter = Router();

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ===== ADMIN CRUD =====
automationRouter.get('/', apiRateLimit, async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, name, slug, description, enabled, agent_name, trigger_kind,
              schedule_cron, last_triggered_at, trigger_count, created_at
         FROM agent_automations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [DEFAULT_TENANT],
    );
    res.json({ automations: r.rows });
  } catch (err: any) {
    logger.warn(`[automations] list failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Khong tai duoc danh sach automation' });
  }
});

// Tao automation moi (webhook secret duoc sinh server-side, tra ve 1 lan duy nhat)
automationRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, slug, description, agent_name, trigger_kind, schedule_cron, payload_template } = req.body || {};
    if (!name || !slug || !agent_name) {
      return res.status(400).json({ error: 'name, slug, agent_name la bat buoc' });
    }
    if (!/^[a-z0-9-]{3,64}$/.test(String(slug))) {
      return res.status(400).json({ error: 'slug chi gom a-z 0-9 va dau gach noi (3-64 ky tu)' });
    }
    const webhook_secret = randomBytes(24).toString('hex');
    const r = await pool.query(
      `INSERT INTO agent_automations
         (tenant_id, name, slug, description, webhook_secret, agent_name, trigger_kind, schedule_cron, payload_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, slug, enabled, agent_name, trigger_kind, created_at`,
      [DEFAULT_TENANT, name, slug, description || null, webhook_secret, agent_name,
       trigger_kind || 'webhook', schedule_cron || null, payload_template || null],
    );
    return res.status(201).json({ automation: r.rows[0], webhook_secret });
  } catch (err: any) {
    if (/duplicate key|unique constraint/i.test(err?.message || '')) {
      return res.status(409).json({ error: 'slug da ton tai trong tenant' });
    }
    logger.warn(`[automations] create failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Tao automation that bai' });
  }
});

// Bat/tat automation
automationRouter.patch('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled phai la boolean' });
    }
    const r = await pool.query(
      `UPDATE agent_automations SET enabled = $2, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $3 RETURNING id, name, slug, enabled`,
      [req.params.id, enabled, DEFAULT_TENANT],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Automation khong ton tai' });
    res.json({ automation: r.rows[0] });
  } catch (err: any) {
    logger.warn(`[automations] toggle failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Cap nhat that bai' });
  }
});

// Xoa automation
automationRouter.delete('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      'DELETE FROM agent_automations WHERE id = $1 AND tenant_id = $2',
      [req.params.id, DEFAULT_TENANT],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Automation khong ton tai' });
    res.json({ success: true });
  } catch (err: any) {
    logger.warn(`[automations] delete failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Xoa that bai' });
  }
});

// Lich su run cua mot automation
automationRouter.get('/:id/runs', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const r = await pool.query(
      `SELECT id, status, payload, result, error_text, duration_ms, started_at, finished_at
         FROM agent_automation_runs ar
         JOIN agent_automations a ON a.id = ar.automation_id
         WHERE ar.automation_id = $1 AND a.tenant_id = $2
         ORDER BY ar.started_at DESC LIMIT $3`,
      [req.params.id, DEFAULT_TENANT, limit],
    );
    res.json({ runs: r.rows });
  } catch (err: any) {
    logger.warn(`[automations] runs failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Khong tai duoc lich su run' });
  }
});

// ===== PUBLIC WEBHOOK TRIGGER =====
// POST /api/public/automations/:slug/run
// Headers: x-automation-secret: <webhook_secret tao khi POST admin>
// Body: payload tuy y — se duoc ghi vao agent_automation_runs.payload
async function executeAutomation(automationId: string, payload: any): Promise<{ runId: string; status: string }> {
  const runRow = await pool.query(
    `INSERT INTO agent_automation_runs (automation_id, payload)
     VALUES ($1, $2::jsonb) RETURNING id`,
    [automationId, JSON.stringify(payload ?? {})],
  );
  const runId = runRow.rows[0].id;
  const startedMs = Date.now();
  try {
    // Placeholder executor: xay dung summary tu payload. Agent that (vd competitive_intelligence)
    // se duoc noi sau qua agentOperatorDaemon event 'automation_triggered'.
    const summary = {
      receivedKeys: Array.isArray(payload) ? payload.length : Object.keys(payload ?? {}).length,
      note: 'Webhook nhan thanh cong. Agent processing se duoc gan qua daemon.',
    };
    await pool.query(
      `UPDATE agent_automation_runs
         SET status='success', result=$2::jsonb, finished_at=NOW(), duration_ms=$3
         WHERE id=$1`,
      [runId, JSON.stringify(summary), Date.now() - startedMs],
    );
    await pool.query(
      `UPDATE agent_automations
         SET last_triggered_at=NOW(), trigger_count=trigger_count+1 WHERE id=$1`,
      [automationId],
    );
    return { runId, status: 'success' };
  } catch (err: any) {
    await pool.query(
      `UPDATE agent_automation_runs
         SET status='error', error_text=$2, finished_at=NOW(), duration_ms=$3
         WHERE id=$1`,
      [runId, String(err?.message || err).slice(0, 500), Date.now() - startedMs],
    ).catch(() => undefined);
    return { runId, status: 'error' };
  }
}

export const automationWebhookRouter = Router();
automationWebhookRouter.post('/:slug/run', apiRateLimit, async (req: Request, res: Response) => {
  const secret = req.header('x-automation-secret') || '';
  try {
    const r = await pool.query(
      `SELECT id, enabled, webhook_secret FROM agent_automations
         WHERE slug=$1 AND tenant_id=$2`,
      [req.params.slug, DEFAULT_TENANT],
    );
    const automation = r.rows[0];
    if (!automation) return res.status(404).json({ error: 'Automation khong ton tai' });
    if (!automation.enabled) return res.status(423).json({ error: 'Automation dang tat' });
    if (!secret || !safeEqual(secret, automation.webhook_secret)) {
      return res.status(401).json({ error: 'Webhook secret khong dung' });
    }
    const result = await executeAutomation(automation.id, req.body);
    return res.status(result.status === 'success' ? 200 : 500).json(result);
  } catch (err: any) {
    logger.warn(`[automations] webhook failed: ${err?.message || err}`);
    res.status(500).json({ error: 'Webhook trigger that bai' });
  }
});
