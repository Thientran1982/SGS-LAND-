/**
 * AI Agent Evaluation Harness — Task #38
 *
 * Chạy gold-set qua ROUTER (intent classification) + WRITER (output keyword check).
 * Báo cáo accuracy per-intent, fail cases, và lưu run log.
 *
 * Usage:
 *   npm run ai:eval                          # full gold-set
 *   npm run ai:eval -- --tag router          # chỉ chạy case có id bắt đầu 'router-'
 *   npm run ai:eval -- --limit 5             # 5 case đầu
 *
 * Yêu cầu: GEMINI_API_KEY + DATABASE_URL trong env.
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
  mustContain?: string[];
  mustNotContain?: string[];
}

interface RunResult {
  id: string;
  input: string;
  expectedIntent: string;
  actualIntent: string;
  intentMatch: boolean;
  containCheck: { passed: boolean; missing: string[]; forbidden: string[] };
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

function checkContent(
  text: string,
  mustContain: string[] = [],
  mustNotContain: string[] = []
): { passed: boolean; missing: string[]; forbidden: string[] } {
  const lower = text.toLowerCase();
  const missing = mustContain.filter(k => !lower.includes(k.toLowerCase()));
  const forbidden = mustNotContain.filter(k => lower.includes(k.toLowerCase()));
  return { passed: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('✗ GEMINI_API_KEY missing in env.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const tagIdx = args.indexOf('--tag');
  const limitIdx = args.indexOf('--limit');
  const tag = tagIdx >= 0 ? args[tagIdx + 1] : null;
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  const goldPath = path.resolve(process.cwd(), 'seed/eval/agent-goldset.json');
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as { cases: GoldCase[] };
  let cases = gold.cases;
  if (tag) cases = cases.filter(c => c.id.startsWith(tag));
  cases = cases.slice(0, limit);

  console.log(`🚀 Running ${cases.length} eval case(s) (tag=${tag || '*'}, limit=${limit})\n`);

  const client = new GoogleGenAI({ apiKey });
  const results: RunResult[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    try {
      const router = await callRouter(client, c.input);
      const intentMatch = router.intent === c.expectedIntent;
      // Note: full WRITER call would require DB + tenant context. For now we
      // validate keyword presence on ROUTER's raw JSON — a lightweight proxy.
      const containCheck = checkContent(router.raw, c.mustContain, c.mustNotContain);
      results.push({
        id: c.id,
        input: c.input,
        expectedIntent: c.expectedIntent,
        actualIntent: router.intent,
        intentMatch,
        containCheck,
        durationMs: Date.now() - t0,
      });
      const mark = intentMatch ? '✓' : '✗';
      console.log(`${mark} ${c.id.padEnd(15)} expect=${c.expectedIntent.padEnd(20)} got=${router.intent.padEnd(20)} (${Date.now() - t0}ms)`);
    } catch (e: any) {
      results.push({
        id: c.id,
        input: c.input,
        expectedIntent: c.expectedIntent,
        actualIntent: 'ERROR',
        intentMatch: false,
        containCheck: { passed: false, missing: [], forbidden: [] },
        durationMs: Date.now() - t0,
        error: e?.message || String(e),
      });
      console.log(`✗ ${c.id.padEnd(15)} ERROR: ${e?.message}`);
    }
  }

  // Aggregate
  const total = results.length;
  const intentPass = results.filter(r => r.intentMatch).length;
  const fullPass = results.filter(r => r.intentMatch && r.containCheck.passed).length;

  const byIntent: Record<string, { total: number; pass: number }> = {};
  for (const r of results) {
    const k = r.expectedIntent;
    if (!byIntent[k]) byIntent[k] = { total: 0, pass: 0 };
    byIntent[k].total++;
    if (r.intentMatch) byIntent[k].pass++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 EVAL SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total cases:        ${total}`);
  console.log(`Intent accuracy:    ${intentPass}/${total} (${((intentPass / total) * 100).toFixed(1)}%)`);
  console.log(`Full pass:          ${fullPass}/${total} (${((fullPass / total) * 100).toFixed(1)}%)`);
  console.log('\nPer-intent breakdown:');
  for (const [intent, s] of Object.entries(byIntent).sort()) {
    const pct = ((s.pass / s.total) * 100).toFixed(0);
    console.log(`  ${intent.padEnd(22)} ${s.pass}/${s.total} (${pct}%)`);
  }

  const failures = results.filter(r => !r.intentMatch);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  [${f.id}] "${f.input.slice(0, 60)}" → expected ${f.expectedIntent}, got ${f.actualIntent}${f.error ? ` (${f.error})` : ''}`);
    }
  }

  // Persist run log
  const outDir = path.resolve(process.cwd(), '.local/eval-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `eval-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, intentPass, fullPass, accuracy: intentPass / total },
    byIntent,
    results,
  }, null, 2));
  console.log(`\n📝 Run saved to ${path.relative(process.cwd(), outFile)}`);

  // Exit code reflects pass rate (fail if < 80% intent accuracy)
  const passRate = intentPass / total;
  if (passRate < 0.8) {
    console.log(`\n✗ FAIL: intent accuracy ${(passRate * 100).toFixed(1)}% < 80% threshold`);
    process.exit(1);
  }
  console.log(`\n✓ PASS: intent accuracy ${(passRate * 100).toFixed(1)}% ≥ 80% threshold`);
}

main().catch(err => {
  console.error('Eval harness crashed:', err);
  process.exit(1);
});
