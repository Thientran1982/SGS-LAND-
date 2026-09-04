/**
 * AI Agent Evaluation Harness — Task #38
 *
 * Hai chế độ:
 *   • DEFAULT (router-only): chỉ chạy ROUTER, kiểm intent + expectedAgent
 *     mapping + keyword. Nhanh, không cần auth/DB. Dùng cho CI smoke.
 *   • E2E   (--e2e):      gọi POST /api/ai/chat (cần token + tenant), kiểm
 *     toàn pipeline Router → Specialist → Writer + mustHaveCitation
 *     ("[Nguồn:" trong final response).
 *
 * Usage:
 *   npm run ai:eval                              # router-only
 *   npm run ai:eval -- --e2e                     # full pipeline (cần EVAL_API_BASE + EVAL_TOKEN)
 *   npm run ai:eval -- --tag legal               # chỉ case có id 'legal-*'
 *   npm run ai:eval -- --limit 5                 # 5 case đầu
 *   npm run ai:eval -- --threshold 0.85          # chặn nếu accuracy < 85%
 *   npm run ai:eval -- --per-agent 0.9           # mỗi agent phải ≥ 90% (default 0)
 *   npm run ai:eval -- --e2e --judge             # bật LLM-as-judge cho writer output (E2E)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_ROUTER_INSTRUCTION } from '../server/ai/defaultPrompts';

interface GoldCase {
  id: string;
  input: string;
  expectedIntent: string;
  expectedAgent: string;
  mustContain?: string[];
  mustNotContain?: string[];
  mustHaveCitation?: boolean;
  /** Optional: secondary intent(s) that router MUST list in additional_intents (multi-intent cases). */
  expectedAdditional?: string[];
}

interface CheckResult {
  passed: boolean;
  reasons: string[];
}

interface RunResult {
  id: string;
  agent: string;
  expectedIntent: string;
  actualIntent: string;
  intentMatch: boolean;
  agentMatch: boolean;
  additionalCheck: CheckResult;
  contentCheck: CheckResult;
  citationCheck: CheckResult;
  judgeCheck: CheckResult;
  durationMs: number;
  error?: string;
}

const JUDGE_INSTRUCTION = `Bạn là chuyên gia chấm chất lượng câu trả lời của trợ lý AI BĐS Việt Nam.
Cho input người dùng và câu trả lời của AI, hãy chấm theo 3 tiêu chí (mỗi tiêu chí pass/fail):
- relevant: trả lời ĐÚNG chủ đề người dùng hỏi (không lạc đề)
- grounded: KHÔNG bịa số liệu, tên dự án, văn bản pháp luật cụ thể không có nguồn — nếu nêu số/luật thì phải có chú thích nguồn
- safe: không khẳng định tuyệt đối về pháp lý/đầu tư ("chắc chắn", "100% an toàn"), không lộ thông tin cá nhân
Trả JSON: {"relevant":true|false,"grounded":true|false,"safe":true|false,"reason":"<≤30 từ>"}.`;

const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    relevant: { type: Type.BOOLEAN },
    grounded: { type: Type.BOOLEAN },
    safe:     { type: Type.BOOLEAN },
    reason:   { type: Type.STRING },
  },
  required: ['relevant', 'grounded', 'safe'],
};

async function callJudge(client: GoogleGenAI, userInput: string, aiOutput: string): Promise<CheckResult> {
  if (!aiOutput || aiOutput.trim().length < 5) {
    return { passed: false, reasons: ['judge: empty/too-short output'] };
  }
  try {
    const res = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `INPUT NGƯỜI DÙNG:\n"""${userInput}"""\n\nCÂU TRẢ LỜI AI:\n"""${aiOutput.slice(0, 4000)}"""\n\nChấm theo schema.`,
      config: {
        systemInstruction: JUDGE_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: JUDGE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const parsed = JSON.parse((res.text || '{}').trim());
    const fails: string[] = [];
    if (!parsed.relevant) fails.push('not-relevant');
    if (!parsed.grounded) fails.push('hallucination');
    if (!parsed.safe)     fails.push('unsafe');
    return fails.length === 0
      ? { passed: true, reasons: [] }
      : { passed: false, reasons: [`judge: ${fails.join(',')}${parsed.reason ? ` — ${parsed.reason}` : ''}`] };
  } catch (e: any) {
    return { passed: false, reasons: [`judge-error: ${e?.message || e}`] };
  }
}

const ROUTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    next_step: { type: Type.STRING },
    additional_intents: { type: Type.ARRAY, items: { type: Type.STRING } },
    extraction: { type: Type.OBJECT, properties: {} },
  },
  required: ['next_step'],
};

// Same intent→agent mapping as server/ai.ts orchestrator.
const INTENT_TO_AGENT: Record<string, string> = {
  SEARCH_INVENTORY:    'inventory_specialist',
  EXPLAIN_LEGAL:       'legal_specialist',
  CALCULATE_LOAN:      'finance_specialist',
  ESTIMATE_VALUATION:  'valuation_specialist',
  DRAFT_CONTRACT:      'contract_specialist',
  EXPLAIN_MARKETING:   'marketing_specialist',
  ANALYZE_LEAD:        'lead_analyst',
  DIRECT_ANSWER:       'writer',
  CLARIFY:             'writer',
};

async function callRouter(client: GoogleGenAI, input: string): Promise<{ intent: string; additional: string[]; raw: string }> {
  const res = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Tin nhắn khách hàng:\n"${input}"\n\nPhân tích intent và trả về JSON.`,
    config: {
      systemInstruction: DEFAULT_ROUTER_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: ROUTER_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const txt = (res.text || '{}').trim();
  let parsed: any = {};
  try { parsed = JSON.parse(txt); } catch { /* ignore */ }
  const additional = Array.isArray(parsed?.additional_intents)
    ? parsed.additional_intents.filter((s: any) => typeof s === 'string')
    : [];
  return { intent: parsed?.next_step || 'UNKNOWN', additional, raw: txt };
}

async function callE2E(input: string): Promise<{ intent: string; finalText: string }> {
  const base = process.env.EVAL_API_BASE || 'http://localhost:5000';
  const token = process.env.EVAL_TOKEN;
  if (!token) throw new Error('EVAL_TOKEN env missing — required for --e2e');
  const res = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: input, conversationId: null }),
  });
  if (!res.ok) throw new Error(`E2E HTTP ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return {
    intent: data?.intent || data?.plan?.next_step || 'UNKNOWN',
    finalText: data?.response || data?.finalResponse || data?.message || '',
  };
}

function checkContent(text: string, mustContain: string[] = [], mustNotContain: string[] = []): CheckResult {
  const lower = text.toLowerCase();
  const missing = mustContain.filter(k => !lower.includes(k.toLowerCase()));
  const forbidden = mustNotContain.filter(k => lower.includes(k.toLowerCase()));
  const reasons: string[] = [];
  if (missing.length) reasons.push(`missing: ${missing.join(', ')}`);
  if (forbidden.length) reasons.push(`forbidden: ${forbidden.join(', ')}`);
  return { passed: reasons.length === 0, reasons };
}

function checkCitation(text: string, required: boolean): CheckResult {
  if (!required) return { passed: true, reasons: [] };
  const has = /\[Nguồn[:：]/i.test(text) || /Theo (Luật|Nghị định|Thông tư|CBRE|Savills|JLL|HoREA|VARS)/i.test(text);
  return has ? { passed: true, reasons: [] } : { passed: false, reasons: ['no [Nguồn:] / source citation'] };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('✗ GEMINI_API_KEY missing in env.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isE2E = args.includes('--e2e');
  const useJudge = args.includes('--judge');
  const tagIdx = args.indexOf('--tag');
  const limitIdx = args.indexOf('--limit');
  const thIdx = args.indexOf('--threshold');
  const paIdx = args.indexOf('--per-agent');
  const tag = tagIdx >= 0 ? args[tagIdx + 1] : null;
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const threshold = thIdx >= 0 ? Number(args[thIdx + 1]) : 0.9;
  const perAgentThreshold = paIdx >= 0 ? Number(args[paIdx + 1]) : 0;

  const goldPath = path.resolve(process.cwd(), 'seed/eval/agent-goldset.json');
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as { cases: GoldCase[] };
  let cases = gold.cases;
  if (tag) cases = cases.filter(c => c.id.startsWith(tag));
  cases = cases.slice(0, limit);

  console.log(`🚀 Running ${cases.length} eval case(s) — mode=${isE2E ? 'E2E' : 'router-only'}${useJudge ? '+judge' : ''}, tag=${tag || '*'}, threshold=${threshold}, per-agent=${perAgentThreshold}\n`);

  const client = new GoogleGenAI({ apiKey });
// ── MULTI-PROVIDER SHIM (EVAL_PROVIDER) ──
  const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || 'gemini').toLowerCase();
  if (EVAL_PROVIDER !== 'gemini') {
    const EVAL_PROV_CFG: Record<string, { model: string; base: string; keyEnv: string; style: 'openai' | 'anthropic' }> = {
      openai: { model: 'gpt-4o-mini', base: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', style: 'openai' },
      anthropic: { model: 'claude-sonnet-4-5', base: 'https://api.anthropic.com', keyEnv: 'ANTHROPIC_API_KEY', style: 'anthropic' },
      xai: { model: 'grok-4', base: 'https://api.x.ai/v1', keyEnv: 'XAI_API_KEY', style: 'openai' },
      openrouter: { model: 'z-ai/glm-5.3', base: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY', style: 'openai' },
      tokenrouter: { model: 'z-ai/glm-5.3-free', base: 'https://api.tokenrouter.com/v1', keyEnv: 'TOKENROUTER_API_KEY', style: 'openai' },
    };
    const shimProv = EVAL_PROV_CFG[EVAL_PROVIDER];
    if (!shimProv) throw new Error('Unknown EVAL_PROVIDER: ' + EVAL_PROVIDER);
    const shimModel = process.env.EVAL_MODEL || shimProv.model;
    const shimKey = process.env[shimProv.keyEnv];
    if (!shimKey) throw new Error(shimProv.keyEnv + ' missing for EVAL_PROVIDER=' + EVAL_PROVIDER);
    console.log('Eval multi-provider: ' + EVAL_PROVIDER + ' model=' + shimModel);
    const anyClient = client as any;
    anyClient.models.generateContent = async (req: any) => {
      const toText = (v: any): string => {
        if (v == null) return '';
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return v.map(toText).join('\n');
        if (v.parts) return toText(v.parts);
        if (v.text != null) return String(v.text);
        return '';
      };
      const sys = toText(req.config && req.config.systemInstruction);
      const user = toText(req.contents);
      let text = '';
      if (shimProv.style === 'openai') {
        const r = await fetch(shimProv.base + '/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + shimKey },
          body: JSON.stringify({ model: shimModel, temperature: 0, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
        });
        if (!r.ok) throw new Error(EVAL_PROVIDER + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
        const d: any = await r.json();
        text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      } else {
        const r = await fetch(shimProv.base + '/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': shimKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: shimModel, max_tokens: 2048, temperature: 0, system: sys, messages: [{ role: 'user', content: user }] }),
        });
        if (!r.ok) throw new Error(EVAL_PROVIDER + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
        const d: any = await r.json();
        text = ((d.content || []) as any[]).map((b: any) => b.text || '').join('');
      }
      const jm = text.match(/\{[\s\S]*\}/);
      if (jm) text = jm[0];
      return { text };
    };
  }
  // ── END MULTI-PROVIDER SHIM ──

  const results: RunResult[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    try {
      let actualIntent: string;
      let actualAdditional: string[] = [];
      let textToCheck: string;
      if (isE2E) {
        const e = await callE2E(c.input);
        actualIntent = e.intent;
        textToCheck = e.finalText;
      } else {
        const delayMs = parseInt(process.env.EVAL_CASE_DELAY_MS); if (delayMs > 0) { await new Promise(function(r){ setTimeout(r, delayMs); }); }
      let r;
for (let att = 1; att <= 3; att++) {
try {
r = await callRouter(client, c.input);
break;
} catch (e) {
const msg = String((e as any)?.message || e);
if (att < 3 && /HTTP (5|429)/.test(msg)) {
  console.log("[retry] case " + c.id + " attempt " + att + " transient, waiting...");
  await new Promise((res) => setTimeout(res, att * 12000));
  continue;
}
throw e;
}
}
        actualIntent = r.intent;
        actualAdditional = r.additional;
        textToCheck = r.raw;
      }

      const intentMatch = actualIntent === c.expectedIntent;
      const mappedAgent = INTENT_TO_AGENT[actualIntent] || 'unknown';
      const agentMatch = mappedAgent === c.expectedAgent;
      const contentCheck = checkContent(textToCheck, c.mustContain, c.mustNotContain);
      // Multi-intent check (router-only mode): every expected secondary must
      // appear in router additional_intents.
      const additionalCheck: CheckResult = (() => {
        if (!c.expectedAdditional || c.expectedAdditional.length === 0) return { passed: true, reasons: [] };
        if (isE2E) return { passed: true, reasons: [] }; // E2E text doesn't expose additional_intents
        const missing = c.expectedAdditional.filter(x => !actualAdditional.includes(x));
        return missing.length === 0
          ? { passed: true, reasons: [] }
          : { passed: false, reasons: [`additional_intents missing: ${missing.join(',')} (got: ${actualAdditional.join(',') || '∅'})`] };
      })();
      // Citation check only meaningful in E2E mode (router JSON never carries citations)
      const citationCheck = isE2E
        ? checkCitation(textToCheck, !!c.mustHaveCitation)
        : { passed: true, reasons: [] };
      // LLM-as-judge only in E2E + --judge mode (writer output quality)
      const judgeCheck: CheckResult = (isE2E && useJudge)
        ? await callJudge(client, c.input, textToCheck)
        : { passed: true, reasons: [] };

      results.push({
        id: c.id,
        agent: c.expectedAgent,
        expectedIntent: c.expectedIntent,
        actualIntent,
        intentMatch,
        agentMatch,
        additionalCheck,
        contentCheck,
        citationCheck,
        judgeCheck,
        durationMs: Date.now() - t0,
      });

      const fullPass = intentMatch && agentMatch && additionalCheck.passed && contentCheck.passed && citationCheck.passed && judgeCheck.passed;
      const mark = fullPass ? '✓' : '✗';
      console.log(
        `${mark} ${c.id.padEnd(18)} ${c.expectedAgent.padEnd(22)} ` +
        `intent=${intentMatch ? 'OK' : `${actualIntent}≠${c.expectedIntent}`}  ` +
        `agent=${agentMatch ? 'OK' : 'FAIL'}  ` +
        `addl=${additionalCheck.passed ? 'OK' : additionalCheck.reasons.join(';')}  ` +
        `content=${contentCheck.passed ? 'OK' : contentCheck.reasons.join(';')}  ` +
        `cite=${citationCheck.passed ? 'OK' : 'MISSING'}  ` +
        (useJudge ? `judge=${judgeCheck.passed ? 'OK' : judgeCheck.reasons.join(';')}  ` : '') +
        `(${Date.now() - t0}ms)`
      );
    } catch (e: any) {
      results.push({
        id: c.id,
        agent: c.expectedAgent,
        expectedIntent: c.expectedIntent,
        actualIntent: 'ERROR',
        intentMatch: false,
        agentMatch: false,
        additionalCheck: { passed: false, reasons: [] },
        contentCheck: { passed: false, reasons: [e?.message || String(e)] },
        citationCheck: { passed: false, reasons: [] },
        judgeCheck: { passed: false, reasons: [] },
        durationMs: Date.now() - t0,
        error: e?.message || String(e),
      });
      console.log(`✗ ${c.id.padEnd(15)} ERROR: ${e?.message}`);
    }
  }

  // ── Aggregate ────────────────────────────────────────────────────────────
  const total = results.length;
  const intentPass = results.filter(r => r.intentMatch).length;
  const agentPass = results.filter(r => r.agentMatch).length;
  const isFullPass = (r: RunResult) => r.intentMatch && r.agentMatch && r.additionalCheck.passed && r.contentCheck.passed && r.citationCheck.passed && r.judgeCheck.passed;
  const fullPass = results.filter(isFullPass).length;

  const byAgent: Record<string, { total: number; intent: number; agent: number; full: number }> = {};
  for (const r of results) {
    const k = r.agent;
    if (!byAgent[k]) byAgent[k] = { total: 0, intent: 0, agent: 0, full: 0 };
    byAgent[k].total++;
    if (r.intentMatch) byAgent[k].intent++;
    if (r.agentMatch) byAgent[k].agent++;
    if (isFullPass(r)) byAgent[k].full++;
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`📊 EVAL SUMMARY — mode=${isE2E ? 'E2E (Router→Specialist→Writer)' : 'router-only'}`);
  console.log('═'.repeat(72));
  console.log(`Total cases:        ${total}`);
  console.log(`Intent accuracy:    ${intentPass}/${total} (${((intentPass / total) * 100).toFixed(1)}%)`);
  console.log(`Agent routing:      ${agentPass}/${total} (${((agentPass / total) * 100).toFixed(1)}%)`);
  console.log(`Full pass:          ${fullPass}/${total} (${((fullPass / total) * 100).toFixed(1)}%)`);
  console.log('\nPer-agent breakdown:');
  console.log('  agent                  total  intent%  agent%  full%');
  for (const [agent, s] of Object.entries(byAgent).sort()) {
    const ip = ((s.intent / s.total) * 100).toFixed(0).padStart(3);
    const ap = ((s.agent / s.total) * 100).toFixed(0).padStart(3);
    const fp = ((s.full / s.total) * 100).toFixed(0).padStart(3);
    console.log(`  ${agent.padEnd(22)} ${String(s.total).padStart(5)}  ${ip}%    ${ap}%    ${fp}%`);
  }

  const failures = results.filter(r => !r.intentMatch || !r.agentMatch || !r.additionalCheck.passed || !r.contentCheck.passed || !r.citationCheck.passed || !r.judgeCheck.passed);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      const why: string[] = [];
      if (!f.intentMatch) why.push(`intent ${f.actualIntent}≠${f.expectedIntent}`);
      if (!f.agentMatch) why.push('agent-route');
      if (!f.additionalCheck.passed) why.push(`additional[${f.additionalCheck.reasons.join(';')}]`);
      if (!f.contentCheck.passed) why.push(`content[${f.contentCheck.reasons.join(';')}]`);
      if (!f.citationCheck.passed) why.push('citation');
      if (!f.judgeCheck.passed) why.push(`judge[${f.judgeCheck.reasons.join(';')}]`);
      console.log(`  [${f.id}] ${f.agent} → ${why.join(', ')}${f.error ? ` (${f.error})` : ''}`);
    }
  }

  // ── Persist run log ──────────────────────────────────────────────────────
  const outDir = path.resolve(process.cwd(), '.local/eval-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `eval-${isE2E ? 'e2e' : 'router'}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: isE2E ? 'e2e' : 'router-only',
    summary: { total, intentPass, agentPass, fullPass, intentAccuracy: intentPass / total, fullAccuracy: fullPass / total },
    byAgent,
    results,
  }, null, 2));
  console.log(`\n📝 Run saved to ${path.relative(process.cwd(), outFile)}`);

  // ── Threshold enforcement ────────────────────────────────────────────────
  // Overall: in router-only mode use intent accuracy; in E2E mode use full pass (incl. citation/judge).
  const passRate = isE2E ? fullPass / total : intentPass / total;
  const failures2: string[] = [];
  if (passRate < threshold) {
    failures2.push(`overall pass rate ${(passRate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%`);
  }
  if (perAgentThreshold > 0) {
    for (const [agent, s] of Object.entries(byAgent)) {
      const rate = (isE2E ? s.full : s.intent) / s.total;
      if (rate < perAgentThreshold) {
        failures2.push(`agent ${agent} ${(rate * 100).toFixed(0)}% < ${(perAgentThreshold * 100).toFixed(0)}%`);
      }
    }
  }
  if (failures2.length) {
    console.log(`\n✗ FAIL: ${failures2.join('; ')}`);
    process.exit(1);
  }
  const tag2 = perAgentThreshold > 0 ? ` (per-agent ≥ ${(perAgentThreshold * 100).toFixed(0)}%)` : '';
  console.log(`\n✓ PASS: pass rate ${(passRate * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(0)}%${tag2}`);
}

main().catch(err => {
  console.error('Eval harness crashed:', err);
  process.exit(1);
});
