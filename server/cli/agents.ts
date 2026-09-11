/**
 * AGENT NEURON CLI (v0) — cong van hanh he thong agents.
 * Chay: npx tsx server/cli/agents.ts <lenh> [tham so]
 * Lenh: tenants | agents list <tenant> | runs <tenant> [n] | events <tenant> [status] [n]
 *       replay <tenant> <eventId> | signals <tenant> [n] | minh confidence <tenant>
 *       onboarding <tenant>
 */
import crypto from 'node:crypto';
import { pool, withTenantContext } from '../db';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { getMinhCalibrationPromptLine, runMinhConfidenceCalibration } from '../services/minhCalibrationService';
import { buildAutoPostingOnboarding } from '../services/autoPostingOnboarding';
import { minhPlanTask, minhDelegateTask } from '../ai/minhBrain';
import { liveChatEngine } from '../ai/liveChatEngine';
import { recordAgentRun } from '../services/agentRunsService';
import { getMinhBrainHealth } from '../ai/minhHealth';
import { getMinhBriefing } from '../services/agentLoopService';
import { runMinhGraph } from '../ai/minhGraphAdapter';
import { getOrchestrationDecision } from '../services/orchestrationMode';
import { listGraphThreads, getGraphThreadState, resumeMinhGraph } from '../ai/minhGraphAdapter';

const HELP = [
  'AGENT NEURON CLI v0',
  'Cach dung: npx tsx server/cli/agents.ts <lenh> [tham so]',
  '  tenants                        - liet ke tat ca tenant',
  '  agents list <tenant>           - danh sach agents cua tenant',
  '  runs <tenant> [n]              - agent_runs gan nhat (mac dinh 10)',
  '  events <tenant> [status] [n]   - agent_operating_events theo trang thai',
  '  replay <tenant> <eventId>      - re-enqueue 1 event DEAD_LETTER',
  '  signals <tenant> [n]           - agent_signals gan nhat (hoc cua Minh)',
  '  minh confidence <tenant>       - dong calibration cua Minh + dem signal 7 ngay',
  '  onboarding <tenant>            - trang thai kênh quang cao cua tenant',
  '<tenant> co the la UUID day du hoac 4-8 ky tu dau.',
].join(String.fromCharCode(10));

async function resolveTenant(prefix: string): Promise<{ id: string; name: string }> {
  const clean = prefix.trim();
  const rows = await pool.query(
    'SELECT id::text AS id, name FROM tenants WHERE id::text ILIKE $1 ORDER BY id LIMIT 5',
    [clean + '%'],
  );
  if (rows.rows.length === 0) throw new Error('Khong tim thay tenant voi tien to: ' + clean);
  if (rows.rows.length > 1) {
    const matches = rows.rows.map(row => row.id.slice(0, 8) + ' ' + row.name).join('; ');
    throw new Error('Tien to trung nhieu tenant: ' + matches);
  }
  return { id: rows.rows[0].id, name: rows.rows[0].name };
}

function line(text: string): void {
  console.log(text);
}

async function cmdTenants(): Promise<void> {
  const rows = await pool.query('SELECT id::text AS id, name FROM tenants ORDER BY name');
  for (const row of rows.rows) line(row.id.slice(0, 8) + '  ' + row.name);
  line('Tong: ' + rows.rows.length + ' tenant');
}

async function cmdAgentsList(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const rows = await pool.query(
    'SELECT name, role, active FROM ai_agents WHERE tenant_id=$1 ORDER BY name',
    [tenant.id],
  );
  line('Tenant: ' + tenant.name + ' (' + tenant.id.slice(0, 8) + ') — ' + rows.rows.length + ' agents');
  for (const row of rows.rows) {
    line((row.active ? '[ON ] ' : '[OFF] ') + row.name + ' (' + row.role + ')');
  }
}

async function cmdRuns(prefix: string, limit: number): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const rows = await withTenantContext(tenant.id, async client => client.query(
    'SELECT agent_name, trigger_source, status, started_at, duration_ms, left(error_text, 80) AS err' +
    ' FROM agent_runs ORDER BY created_at DESC LIMIT $1',
    [limit],
  ));
  line('agent_runs gan nhat (toan he thong, limit ' + limit + '):');
  for (const row of rows.rows) {
    line(
      String(row.started_at).slice(0, 19) + ' ' + String(row.agent_name).slice(0, 28).padEnd(28) +
      ' ' + String(row.status).padEnd(10) + ' ' + String(row.duration_ms ?? '-') + 'ms ' + row.err,
    );
  }
  void tenant;
}

async function cmdEvents(prefix: string, status: string | null, limit: number): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const params: unknown[] = [tenant.id];
  let where = 'tenant_id=$1';
  if (status) {
    where += ' AND status=$2';
    params.push(status.toUpperCase());
  }
  const rows = await pool.query(
    'SELECT event_id, event_type, status, attempts, last_error, created_at' +
    ' FROM agent_operating_events WHERE ' + where + ' ORDER BY created_at DESC LIMIT ' + Number(limit),
    params,
  );
  line('agent_operating_events (' + (status || 'tat ca') + '): ' + rows.rows.length + ' dong');
  for (const row of rows.rows) {
    line(
      String(row.created_at).slice(0, 19) + ' ' + String(row.status).padEnd(12) +
      ' try=' + String(row.attempts).padEnd(3) + String(row.event_type).slice(0, 26).padEnd(26) +
      ' ' + String(row.last_error ?? '').slice(0, 70),
    );
  }
}

async function cmdReplay(prefix: string, eventId: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const rows = await pool.query(
    'SELECT id, event_id, event_type, idempotency_key, payload_json, status FROM agent_operating_events' +
    ' WHERE tenant_id=$1 AND (event_id=$2 OR id::text=$2) ORDER BY created_at DESC LIMIT 1',
    [tenant.id, eventId],
  );
  const original = rows.rows[0];
  if (!original) throw new Error('Khong tim thay event: ' + eventId);
  if (original.status !== 'DEAD_LETTER') {
    throw new Error('Event khong o trang thai DEAD_LETTER (hiện tại: ' + original.status + ')');
  }
  const replayEventId = crypto.randomUUID();
  const result = await agentOperatingRepository.enqueueEvent(tenant.id, {
    eventId: replayEventId,
    eventType: original.event_type,
    idempotencyKey: original.idempotency_key + ':replay:' + Date.now(),
    actor: 'SYSTEM',
    payload: (original.payload_json || {}) as Record<string, unknown>,
  });
  line('Da re-enqueue. Event moi: ' + (result && (result as any).event_id ? (result as any).event_id : replayEventId));
}

async function cmdSignals(prefix: string, limit: number): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const rows = await pool.query(
    'SELECT signal_type, subject_type, subject_id, provenance, created_at FROM agent_signals' +
    ' WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2',
    [tenant.id, limit],
  );
  line('agent_signals gan nhat: ' + rows.rows.length + ' dong');
  for (const row of rows.rows) {
    line(
      String(row.created_at).slice(0, 19) + ' ' + String(row.signal_type).slice(0, 34).padEnd(34) +
      ' ' + String(row.subject_type ?? '').slice(0, 22).padEnd(22) + ' ' + String(row.subject_id ?? '').slice(0, 12),
    );
  }
}

async function cmdMinhConfidence(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const promptLine = await getMinhCalibrationPromptLine(tenant.id);
  line('Calibration prompt line: ' + (promptLine || '(chua du du lieu)'));
  const rows = await pool.query(
    "SELECT signal_type, count(*)::int AS total, max(created_at) AS last_at FROM agent_signals" +
    " WHERE tenant_id=$1 AND (signal_type LIKE 'minh%' OR signal_type LIKE 'calibration%')" +
    " AND created_at > NOW() - INTERVAL '7 days' GROUP BY signal_type ORDER BY signal_type",
    [tenant.id],
  );
  line('Signal 7 ngay qua:');
  for (const row of rows.rows) {
    line('  ' + row.signal_type.padEnd(34) + ' x' + row.total + '  last=' + String(row.last_at).slice(0, 19));
  }
  if (!rows.rows.length) line('  (khong co signal nao — Minh chua delegate hoac writer chua gay)');
}

async function cmdMinhCalibrate(prefix: string): Promise<void> {  const tenant = await resolveTenant(prefix);  const metrics = await runMinhConfidenceCalibration(tenant.id);  line('Calibration chay xong cho ' + tenant.name);  line(JSON.stringify(metrics).slice(0, 700));}async function cmdMinhPlan(prefix: string, task: string): Promise<void> {  const tenant = await resolveTenant(prefix);  const plan = await minhPlanTask(tenant.id, task);  line('Plan: ' + JSON.stringify(plan));}
async function cmdMinhDelegate(prefix: string, task: string): Promise<void> {  const tenant = await resolveTenant(prefix);  const result = await minhDelegateTask(tenant.id, task, { triggerSource: 'cli' });  line('Plan: ' + JSON.stringify(result.plan));  line('Tool: ' + result.tool + ' | Status: ' + result.status + ' | ' + result.durationMs + 'ms | runId=' + result.runId);  line('Output head: ' + JSON.stringify(result.output ?? result.error).slice(0, 600));}
async function cmdAgentRun(prefix: string, tool: string, argsJson: string): Promise<void> {  const tenant = await resolveTenant(prefix);  const parsedArgs = JSON.parse(argsJson || '{}');  const out = await recordAgentRun(pool, tool, () => liveChatEngine.callTool(tool, { tenantId: tenant.id, ...parsedArgs }), { triggerSource: 'cli' });  line('Output head: ' + JSON.stringify(out ?? null).slice(0, 800));}async function cmdOnboarding(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const result = await buildAutoPostingOnboarding(pool, tenant.id, { autoEnable: false });
  line('Tenant: ' + tenant.name + ' autoPostingEnabled=' + result.autoPostingEnabled);
  for (const item of result.platforms) {
    line('  ' + item.platform.padEnd(16) + ' ' + item.status.padEnd(12) + ' ' + item.reason.slice(0, 80));
  }
}

async function cmdGraphRun(prefix: string, task: string): Promise<void> {  const tenant = await resolveTenant(prefix);  const state = await runMinhGraph(tenant.id, task, { triggerSource: 'cli' });  line('Status: ' + state.status + ' | Tool: ' + state.tool + ' | Intent: ' + state.intent + ' (conf ' + state.confidence + ')');  line('Output head: ' + JSON.stringify(state.output ?? state.error).slice(0, 700));}
async function cmdGraphStatus(): Promise<void> {  const decision = getOrchestrationDecision();  line('Orchestration mode: ' + decision.mode + ' (enabled=' + decision.enabled + ')');  line('Reason: ' + decision.reason);  line('Adapter: server/ai/minhGraphAdapter.ts da san sang. Bat langgraph bang 3 env:');  line('  AI_ORCHESTRATION_MODE=langgraph');  line('  LANGGRAPH_ORCHESTRATION_APPROVED=true');  line('  LANGGRAPH_ORCHESTRATION_ADAPTER_READY=true');}async function cmdGraphThreads(limit: number): Promise<void> {  for (const t of await listGraphThreads(limit)) line(t.threadId + ' checkpoints=' + t.checkpoints);}
async function cmdGraphState(threadId: string): Promise<void> {  const s = await getGraphThreadState(threadId);  line(s ? JSON.stringify(s).slice(0, 700) : 'NO_STATE');}
async function cmdMinhHealth(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const h = await getMinhBrainHealth(tenant.id);
  line('MINH BRAIN HEALTH [' + tenant.name + ']');
  line('mode=' + h.mode + ' | budget=' + h.budget.used + '/' + h.budget.budget + (h.budget.exceeded ? ' EXCEEDED' : ''));
  line('calibration: ' + (h.calibration || '(chua du du lieu)'));
  line('delegations 7d=' + h.delegations7d + ' | success=' + h.delegationSuccess7d + ' | gaps=' + h.capabilityGaps7d + ' | SLO breaches 24h=' + h.sloBreaches24h);
  for (const item of h.byIntent) line('  ' + item.intent + ' x' + item.count);
}

async function cmdMinhSelfcheck(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const questions = [
    'dinh gia can ho 80m2 thu duc',
    'thi truong long thanh hien nay',
    'phap ly dat nen du an nhu the nao',
  ];
  let pass = 0;
  for (const question of questions) {
    const started = Date.now();
    const plan = await minhPlanTask(tenant.id, question);
    const ok = plan.confidence >= 0.3;
    if (ok) pass++;
    line((ok ? 'PASS ' : 'FAIL ') + question + ' -> ' + plan.intent + ' conf=' + plan.confidence + ' (' + (Date.now() - started) + 'ms)');
  }
  line('SELFCHECK: ' + pass + '/' + questions.length + ' PASS');
}
async function cmdMinhBriefing(prefix: string): Promise<void> {
  const tenant = await resolveTenant(prefix);
  const b = await getMinhBriefing(tenant.id);
  line('MINH BRIEFING [' + tenant.name + ']');
  line('SEO: ' + b.seo.keywordsChecked7d + ' keyword audit 7d, ' + b.seo.issues7d + ' issue | GEO: snapshot ' + (b.geo.lastSnapshotDate || '-') + (b.geo.stale ? ' (STALE)' : 'OK'));
  line('SLO breaches 24h=' + b.sloBreaches24h + ' | gaps=' + b.capabilityGaps7d + ' | dead-letters=' + b.deadLetters + ' | budget=' + b.budget.used + '/' + b.budget.budget);
  for (const pr of b.proposals) line('  [' + pr.severity.toUpperCase() + '][' + pr.area + '] ' + pr.proposal);
}
async function cmdGraphResume(threadId: string): Promise<void> {  const s = await resumeMinhGraph(threadId);  line('Resume done: ' + JSON.stringify(s).slice(0, 500));}async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    line(HELP);
    return;
  }
  if (command === 'tenants') return cmdTenants();
  if (command === 'agents' && args[0] === 'list') return cmdAgentsList(args[1] || '00000000');
  if (command === 'runs') return cmdRuns(args[0], Number(args[1] || 10));
  if (command === 'events') return cmdEvents(args[0], args[1] && /^\d+$/.test(args[1]) ? null : args[1], Number(args[1] && /^\d+$/.test(args[1]) ? args[1] : args[2] || 10));
  if (command === 'replay') return cmdReplay(args[0], args[1]);
  if (command === 'signals') return cmdSignals(args[0], Number(args[1] || 15));
  if (command === 'minh' && args[0] === 'confidence') return cmdMinhConfidence(args[1]);
  if (command === 'minh' && args[0] === 'calibrate') return cmdMinhCalibrate(args[1]);
  if (command === 'minh' && args[0] === 'health') return cmdMinhHealth(args[1]);
  if (command === 'minh' && args[0] === 'briefing') return cmdMinhBriefing(args[1]);
  if (command === 'minh' && args[0] === 'selfcheck') return cmdMinhSelfcheck(args[1]);
  if (command === 'minh' && args[0] === 'plan') return cmdMinhPlan(args[1], args.slice(2).join(' '));
  if (command === 'minh' && args[0] === 'delegate') return cmdMinhDelegate(args[1], args.slice(2).join(' '));
  if (command === 'agent' && args[0] === 'run') return cmdAgentRun(args[1], args[2], args.slice(3).join(' '));
  if (command === 'graph' && args[0] === 'run') return cmdGraphRun(args[1], args.slice(2).join(' '));
  if (command === 'graph' && args[0] === 'status') return cmdGraphStatus();
  if (command === 'graph' && args[0] === 'threads') return cmdGraphThreads(Number(args[1]) || 10);
  if (command === 'graph' && args[0] === 'state') return cmdGraphState(args[1]);
  if (command === 'graph' && args[0] === 'resume') return cmdGraphResume(args[1]);
  if (command === 'onboarding') return cmdOnboarding(args[0]);
  line('Lenh khong hop le. ' + HELP);
  process.exitCode = 1;
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error('CLI_LOI: ' + (error?.message || error));
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
