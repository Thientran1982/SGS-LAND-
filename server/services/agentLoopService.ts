/**
 * AGENT OPERATIONS LOOP (vong lap agent) — tim -> sua -> kiem tra -> BAO CAO BO NAO MINH.
 * SEO audit (tim/sua) + GEO freshness check -> ghi lesson vao agent:lessons
 * (block nay duoc tiem truc tiep vao prompt cua Minh) + signal agent_report.
 * Chay in-process 24h — KHONG phu thuoc QStash.
 */
import { pool, withTenantContext } from '../db';
import { runSeoAuditForTenant } from './seoAuditService';
import { getBudgetStatus } from '../ai/minhBrain';
import { agentMemoryService } from './agentMemoryService';
import { logger } from '../middleware/logger';

const GEO_SNAPSHOT_STALE_DAYS = 3;

async function checkGeoFreshness(): Promise<{ lastSnapshotDate: string | null; stale: boolean }> {
  try {
    const rows = await pool.query('SELECT max(date) AS last_date FROM seo_geo_snapshots');
    const last = rows.rows[0]?.last_date ? String(rows.rows[0].last_date).slice(0, 10) : null;
    const stale = !last || Date.now() - new Date(last + 'T00:00:00Z').getTime() > GEO_SNAPSHOT_STALE_DAYS * 86400000;
    return { lastSnapshotDate: last, stale };
  } catch (error: any) {
    logger.warn('[AgentLoop] geo freshness check failed: ' + (error?.message || error));
    return { lastSnapshotDate: null, stale: true };
  }
}

async function reportToBrain(
  tenantId: string,
  report: { seo: { checked: number; flagged: number; questions: number }; geo: { lastSnapshotDate: string | null; stale: boolean } },
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const lesson = 'AGENT REPORT [' + date + '] SEO: audit ' + report.seo.checked + ' keyword, ' + report.seo.flagged + ' flagged, ' + report.seo.questions + ' can nguoi. GEO: snapshot cuoi ' + (report.geo.lastSnapshotDate || 'khong co') + (report.geo.stale ? ' (CU - can kiem tra QStash/token)' : ' (fresh)');
  await agentMemoryService.remember(tenantId, 'agent:lessons', 'agent-report:' + date, lesson, 'procedural', 0.7, 30);
  await agentMemoryService.recordSignal(tenantId, {
    signalType: 'agent_report',
    actorId: 'AGENT_LOOP',
    subjectType: 'agent_operations',
    subjectId: tenantId,
    dedupeKey: 'agent_report:' + tenantId + ':' + date,
    payload: { seo: report.seo, geo: report.geo },
    provenance: 'agent_loop',
  }).catch(signalError => logger.warn('[AgentLoop] report signal failed: ' + (signalError?.message || signalError)));
}

const SIGNAL_RETENTION_DAYS = Math.max(7, Number(process.env.AGENT_SIGNAL_RETENTION_DAYS || 90));

/** P1-9: agent_signals is append-only telemetry — cap retention per tenant so the table stays bounded. */
async function pruneAgentSignals(tenantId: string): Promise<number> {
  try {
    const result = await withTenantContext(tenantId, async client => client.query(
      'DELETE FROM agent_signals WHERE tenant_id=$1 AND created_at < NOW() - make_interval(days => $2::int)',
      [tenantId, SIGNAL_RETENTION_DAYS],
    ));
    return Number(result?.rowCount || 0);
  } catch (error: any) {
    logger.warn('[AgentLoop] signal prune failed: ' + (error?.message || error));
    return 0;
  }
}

export async function runAgentOperationsLoop(tenantId: string): Promise<void> {
  try {
    const prunedSignals = await pruneAgentSignals(tenantId);
    if (prunedSignals > 0) logger.info('[AgentLoop] pruned ' + prunedSignals + ' agent_signals (' + tenantId + ')');
    const seo = await runSeoAuditForTenant(tenantId, 'agent_loop');
    const geo = await checkGeoFreshness();
    await reportToBrain(tenantId, { seo, geo });
    logger.info('[AgentLoop] tenant=' + tenantId + ' SEO flagged=' + seo.flagged + ' GEO stale=' + geo.stale);
  } catch (error: any) {
    logger.warn('[AgentLoop] tenant=' + tenantId + ' loop failed: ' + (error?.message || error));
  }
}

export function startAgentOperationsLoop(getTenantIds: () => Promise<string[]>, intervalMs = 24 * 60 * 60 * 1000) {
  const tick = async () => {
    // P1-8: session-level advisory lock — multiple app instances must never
    // run the operations loop concurrently (double SEO audits, double reports).
    const client = await pool.connect();
    try {
      const locked = await client.query("SELECT pg_try_advisory_lock(hashtext('sgs_agent_ops_loop')) AS ok");
      if (!locked.rows[0]?.ok) return;
      try {
        for (const tenantId of await getTenantIds()) {
          await runAgentOperationsLoop(tenantId);
        }
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('sgs_agent_ops_loop'))");
      }
    } catch (error: any) {
      logger.warn('[AgentLoop] tick failed: ' + (error?.message || error));
    } finally {
      client.release();
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick();
  return { stop: () => clearInterval(timer) };
}

export type BriefingProposal = {
  area: string;
  proposal: string;
  severity: 'high' | 'medium' | 'low';
};

export type MinhBriefing = {
  tenantId: string;
  seo: { keywordsChecked7d: number; issues7d: number };
  geo: { lastSnapshotDate: string | null; stale: boolean };
  sloBreaches24h: number;
  capabilityGaps7d: number;
  deadLetters: number;
  budget: { used: number; budget: number };
  proposals: BriefingProposal[];
};

export async function getMinhBriefing(tenantId: string): Promise<MinhBriefing> {
  const seoKw = await pool.query(
    "SELECT count(*)::int AS c FROM seo_target_keywords WHERE tenant_id=$1 AND last_checked_at > NOW() - INTERVAL '7 days'",
    [tenantId],
  );
  const seoIssues = await pool.query(
    "SELECT count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='seo_audit_issue' AND created_at > NOW() - INTERVAL '7 days'",
    [tenantId],
  );
  const geo = await checkGeoFreshness();
  const slo = await pool.query(
    "SELECT count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='latency_slo_breach' AND created_at > NOW() - INTERVAL '24 hours'",
    [tenantId],
  );
  const gaps = await pool.query(
    "SELECT count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='minh_capability_gap' AND created_at > NOW() - INTERVAL '7 days'",
    [tenantId],
  );
  const dead = await withTenantContext(tenantId, async (client: any) => client.query(
    "SELECT count(*)::int AS c FROM agent_operating_events WHERE status='DEAD_LETTER'",
  ));
  const budget = await getBudgetStatus(tenantId);
  const proposals: BriefingProposal[] = [];
  const deadCount = Number(dead.rows[0]?.c || 0);
  if (deadCount > 0) proposals.push({ area: 'self-repair', proposal: deadCount + ' dead-letter ton dong — chay replay/fix handler', severity: 'high' });
  if (geo.stale) proposals.push({ area: 'GEO', proposal: 'Snapshot GEO cu hon 3 ngay — kiem tra QStash schedule/token', severity: 'medium' });
  const gapCount = Number(gaps.rows[0]?.c || 0);
  if (gapCount > 0) proposals.push({ area: 'capability', proposal: gapCount + ' capability gaps 7 ngay qua — xem minh_capability_gap signals', severity: 'medium' });
  const issueCount = Number(seoIssues.rows[0]?.c || 0);
  if (issueCount > 0) proposals.push({ area: 'SEO', proposal: issueCount + ' keyword co van de — xem seo_audit_issue signals', severity: 'low' });
  return {
    tenantId,
    seo: { keywordsChecked7d: Number(seoKw.rows[0]?.c || 0), issues7d: issueCount },
    geo,
    sloBreaches24h: Number(slo.rows[0]?.c || 0),
    capabilityGaps7d: gapCount,
    deadLetters: deadCount,
    budget: { used: budget.used, budget: budget.budget },
    proposals,
  };
}
