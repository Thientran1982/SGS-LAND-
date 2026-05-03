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
  contentCheck: CheckResult;
  citationCheck: CheckResult;
  durationMs: number;
  error?: string;
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

async function callRouter(client: GoogleGenAI, input: string): Promise<{ intent: string; raw: string }> {
  const res = await client.models.generateContent({
    model: 'gemini-2.5-flash-lite',
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
  return { intent: parsed?.next_step || 'UNKNOWN', raw: txt };
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
  const tagIdx = args.indexOf('--tag');
  const limitIdx = args.indexOf('--limit');
  const thIdx = args.indexOf('--threshold');
  const tag = tagIdx >= 0 ? args[tagIdx + 1] : null;
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const threshold = thIdx >= 0 ? Number(args[thIdx + 1]) : 0.8;

  const goldPath = path.resolve(process.cwd(), 'seed/eval/agent-goldset.json');
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as { cases: GoldCase[] };
  let cases = gold.cases;
  if (tag) cases = cases.filter(c => c.id.startsWith(tag));
  cases = cases.slice(0, limit);

  console.log(`🚀 Running ${cases.length} eval case(s) — mode=${isE2E ? 'E2E' : 'router-only'}, tag=${tag || '*'}, threshold=${threshold}\n`);

  const client = new GoogleGenAI({ apiKey });
  const results: RunResult[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    try {
      let actualIntent: string;
      let textToCheck: string;
      if (isE2E) {
        const e = await callE2E(c.input);
        actualIntent = e.intent;
        textToCheck = e.finalText;
      } else {
        const r = await callRouter(client, c.input);
        actualIntent = r.intent;
        textToCheck = r.raw;
      }

      const intentMatch = actualIntent === c.expectedIntent;
      const mappedAgent = INTENT_TO_AGENT[actualIntent] || 'unknown';
      const agentMatch = mappedAgent === c.expectedAgent;
      const contentCheck = checkContent(textToCheck, c.mustContain, c.mustNotContain);
      // Citation check only meaningful in E2E mode (router JSON never carries citations)
      const citationCheck = isE2E
        ? checkCitation(textToCheck, !!c.mustHaveCitation)
        : { passed: true, reasons: [] };

      results.push({
        id: c.id,
        agent: c.expectedAgent,
        expectedIntent: c.expectedIntent,
        actualIntent,
        intentMatch,
        agentMatch,
        contentCheck,
        citationCheck,
        durationMs: Date.now() - t0,
      });

      const fullPass = intentMatch && agentMatch && contentCheck.passed && citationCheck.passed;
      const mark = fullPass ? '✓' : '✗';
      console.log(
        `${mark} ${c.id.padEnd(15)} ${c.expectedAgent.padEnd(22)} ` +
        `intent=${intentMatch ? 'OK' : `${actualIntent}≠${c.expectedIntent}`}  ` +
        `agent=${agentMatch ? 'OK' : 'FAIL'}  ` +
        `content=${contentCheck.passed ? 'OK' : contentCheck.reasons.join(';')}  ` +
        `cite=${citationCheck.passed ? 'OK' : 'MISSING'}  ` +
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
        contentCheck: { passed: false, reasons: [e?.message || String(e)] },
        citationCheck: { passed: false, reasons: [] },
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
  const fullPass = results.filter(r => r.intentMatch && r.agentMatch && r.contentCheck.passed && r.citationCheck.passed).length;

  const byAgent: Record<string, { total: number; intent: number; agent: number; full: number }> = {};
  for (const r of results) {
    const k = r.agent;
    if (!byAgent[k]) byAgent[k] = { total: 0, intent: 0, agent: 0, full: 0 };
    byAgent[k].total++;
    if (r.intentMatch) byAgent[k].intent++;
    if (r.agentMatch) byAgent[k].agent++;
    if (r.intentMatch && r.agentMatch && r.contentCheck.passed && r.citationCheck.passed) byAgent[k].full++;
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

  const failures = results.filter(r => !r.intentMatch || !r.agentMatch || !r.contentCheck.passed || !r.citationCheck.passed);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      const why: string[] = [];
      if (!f.intentMatch) why.push(`intent ${f.actualIntent}≠${f.expectedIntent}`);
      if (!f.agentMatch) why.push('agent-route');
      if (!f.contentCheck.passed) why.push(`content[${f.contentCheck.reasons.join(';')}]`);
      if (!f.citationCheck.passed) why.push('citation');
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

  // Exit code based on intent accuracy threshold (full pass only enforced in E2E mode)
  const passRate = isE2E ? fullPass / total : intentPass / total;
  if (passRate < threshold) {
    console.log(`\n✗ FAIL: pass rate ${(passRate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}% threshold`);
    process.exit(1);
  }
  console.log(`\n✓ PASS: pass rate ${(passRate * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(0)}% threshold`);
}

main().catch(err => {
  console.error('Eval harness crashed:', err);
  process.exit(1);
});
