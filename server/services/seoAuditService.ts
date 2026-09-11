/**
 * SEO AGENT EXECUTOR (muc 1+2) — audit tu dong theo seo_target_keywords.
 * Chay duoc KHONG CAN QStash: in-process loop 24h (fallback khi QStash het token).
 * QStash schedule cung goi dung endpoint nay khi co (parity voi GEO).
 * Tu sua muc 1: cap nhat last_checked_at, ghi signal loi, HumanQuestion cho
 * keyword chua co trang phu hop (can nguoi tao landing).
 */
import { pool, withTenantContext } from '../db';
import { startAgentRun, finishAgentRun } from './agentRunsService';
import { agentMemoryService } from './agentMemoryService';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { logger } from '../middleware/logger';

type KeywordRow = {
  id: string;
  keyword: string;
  target_url: string | null;
  current_position: number | null;
  target_position: number | null;
  ai_visibility: unknown;
  last_checked_at: string | null;
};

export async function runSeoAuditForTenant(
  tenantId: string,
  triggerSource: string,
): Promise<{ checked: number; flagged: number; questions: number }> {
  const runId = await startAgentRun(pool, 'seo-audit-cron', triggerSource);
  let checked = 0;
  let flagged = 0;
  let questions = 0;
  try {
    const kw = await withTenantContext(tenantId, async client => client.query(
      "SELECT id, keyword, target_url, current_position, target_position, ai_visibility, last_checked_at FROM seo_target_keywords WHERE tenant_id = $1 AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '7 days') ORDER BY id",
      [tenantId],
    ));
    for (const row of kw.rows) {
      checked++;
      const issues: string[] = [];
      if (row.current_position === null) issues.push('chua co position');
      else if (Number(row.target_position) > 0 && Number(row.current_position) > Number(row.target_position)) issues.push('position vuot muc tieu');
      if (row.ai_visibility === null || row.ai_visibility === undefined) issues.push('chua do ai_visibility');
      let covered = false;
      if (row.target_url) {
        const slug = String(row.target_url).split('/').filter(Boolean).pop() || '';
        const cov = await withTenantContext(tenantId, async client => client.query(
          'SELECT EXISTS(SELECT 1 FROM projects WHERE tenant_id=$1 AND (code ILIKE $2 OR name ILIKE $2)) AS covered',
          [tenantId, '%' + slug + '%'],
        ));
        covered = Boolean(cov.rows[0]?.covered);
      }
      if (!covered && row.target_url) issues.push('target_url chua co trang/du an tuong ung');
      await withTenantContext(tenantId, async client => client.query(
        'UPDATE seo_target_keywords SET last_checked_at = NOW() WHERE id = $1',
        [row.id],
      ));
      if (issues.length) {
        flagged++;
        await agentMemoryService.recordSignal(tenantId, {
          signalType: 'seo_audit_issue',
          actorId: 'SEO_AGENT',
          subjectType: 'seo_keyword',
          subjectId: String(row.id),
          dedupeKey: 'seo_audit_issue:' + row.id + ':' + new Date().toISOString().slice(0, 10),
          payload: { keyword: row.keyword, targetUrl: row.target_url, issues },
          provenance: 'seo_audit_service',
        }).catch(signalError => logger.warn('[SeoAudit] signal failed: ' + (signalError?.message || signalError)));
        if (issues.some(issue => issue.startsWith('target_url'))) {
          const existing = await agentOperatingRepository.listHumanQuestions(tenantId, 'OPEN');
          const dup = (existing as any[]).some(question => String(question.question).includes(String(row.keyword)));
          if (!dup) {
            await agentOperatingRepository.createHumanQuestion(tenantId, {
              agentKey: 'SEO_AGENT',
              question: 'SEO: keyword ' + row.keyword + ' chua co trang phu hop (target_url ' + String(row.target_url || '-') + '). Can tao landing hoac gan url.',
              priority: 60,
              context: { keyword: row.keyword, targetUrl: row.target_url, issues },
            });
            questions++;
          }
        }
      }
    }
    await finishAgentRun(
      pool,
      runId,
      'success',
      { tenantId, checked, flagged, questions },
      null,
      Date.now(),
    );
    logger.info('[SeoAudit] tenant=' + tenantId + ' checked=' + checked + ' flagged=' + flagged);
  } catch (error: any) {
    await finishAgentRun(pool, runId, 'error', { checked }, String(error?.message || error), Date.now()).catch(() => undefined);
    logger.error('[SeoAudit] audit failed tenant=' + tenantId + ': ' + (error?.message || error));
  }
  return { checked, flagged, questions };
}

export async function runSeoAuditAllTenants(triggerSource: string) {
  const tenants = await pool.query(
    "SELECT DISTINCT tenant_id FROM seo_target_keywords WHERE last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '7 days'",
  );
  const results = [];
  for (const row of tenants.rows) {
    results.push({ tenantId: row.tenant_id, ...(await runSeoAuditForTenant(row.tenant_id, triggerSource)) });
  }
  return results;
}

export function startSeoAuditLoop(getTenantIds: () => Promise<string[]>, intervalMs = 24 * 60 * 60 * 1000) {
  const tick = async () => {
    try {
      for (const tenantId of await getTenantIds()) {
        await runSeoAuditForTenant(tenantId, 'in_process_loop');
      }
    } catch (error: any) {
      logger.warn('[SeoAudit] loop tick failed: ' + (error?.message || error));
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick();
  return { stop: () => clearInterval(timer) };
}
