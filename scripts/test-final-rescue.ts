// test-final-rescue.ts — JEV×Minh full pipeline trên ĐƯỜNG PRODUCTION vừa được cứu (không Gemini, không fake)
process.env.JEV_MODE = process.env.JEV_MODE || "local";
import { generateLiveChatText } from "../server/ai/liveChatEngine";
import { minhSystemOneIntentJson, verifyMinhAnswer, systemOneRouterEnabled } from "../server/lib/minhSystemOneRouter";
import { minhChooseSpecialist } from "../server/ai/minhOrchestrator";
import { makeLocalAsker } from "../server/lib/systemone";
import { compact } from "../server/lib/jevcompact";

const INTENTS = { VALUATION: "dinh gia", SEARCH: "tim kiem", LEGAL: "phap ly", FINANCE: "vay von", INVESTMENT: "dau tu", PROJECT: "du an", GENERAL: "chung" };
const gen: any = (p: any) => generateLiveChatText({ ...p, timeoutMs: p.timeoutMs || 30000, feature: p.feature || "MINH_RESCUE_TEST" });
const s1Events: any[] = [];
const rec = (e: any) => s1Events.push(e);

async function main() {
  console.log("JEV_MODE =", process.env.JEV_MODE, "· enabled =", systemOneRouterEnabled(), "· LLM = đường production (bai→anthropic→xai→openai→openrouter)");

  const t0 = Date.now();
  const r1 = await minhSystemOneIntentJson({ generateFn: gen, message: "Ban dat 200m2 mat tien Long Thanh, hoi gia thi truong bao nhieu tien 1 m2?", intents: INTENTS, timeoutMs: 30000, onResult: rec });
  console.log("S1-ROUTER", JSON.stringify(r1), "ms=" + (Date.now() - t0));

  const t1 = Date.now();
  try {
    const plan = await minhChooseSpecialist({ tenantId: "00000000-0000-0000-0000-000000000001", message: "Can ho Aqua City 2PN gia 3 ty co dang dau tu khong?", sessionId: "rescue-final", generateFn: gen, fallbackIntent: "GENERAL", fallbackTool: "get_platform_knowledge" });
    console.log("PROD-ROUTER", JSON.stringify(plan), "ms=" + (Date.now() - t1));
  } catch (e: any) { console.log("PROD-ROUTER-ERR", String(e?.message || e).slice(0, 140)); }

  const t2 = Date.now();
  const v = await verifyMinhAnswer({ generateFn: gen, question: "Ban dat 200m2 Long Thanh gia bao nhieu?", answer: "Dat mat tien Long Thanh giao dong 45-60 trieu/m2 tuy vi tri va phap ly. Con so mang tinh tham khao, can khao sat thuc dia truoc khi dinh gia chinh xac.", timeoutMs: 30000, onResult: rec });
  console.log("VERIFY", JSON.stringify(v), "ms=" + (Date.now() - t2));

  const asker = makeLocalAsker({ llmCall: async (messages: Array<{ role: string; content: string }>) => {
    const text = await gen({ system: messages[0].content, prompt: messages[1].content, jsonMode: true, timeoutMs: 30000, feature: "JEV_COMPACT_RESCUE" });
    return { ok: !!String(text || "").trim(), text: String(text || "") };
  } });
  const long = "KET-QUA-TOOL-DU-LIEU-THAT ".repeat(120);
  const history = [
    { role: "user", text: "Lay bao cao phong cskh va doanh thu thang 8" },
    { role: "assistant", text: "", toolUses: [{ tool_use_id: "t1", tool: "get_report", input: { dept: "cskh" }, text: long }] },
    { role: "user", text: "", toolResults: [{ tool_use_id: "t1", text: long }] },
    { role: "assistant", text: "", toolUses: [{ tool_use_id: "t2", tool: "get_finance_summary", input: { months: 6 }, text: long }] },
    { role: "user", text: "", toolResults: [{ tool_use_id: "t2", text: long }] },
    { role: "user", text: "Tong hop lai giup minh" },
    { role: "assistant", text: "Ket qua tong hop quan trong can giu nguyen van." },
  ];
  const t3 = Date.now();
  const result = await compact(history, asker, { preserveRecentMessages: 1, minReductionRatio: 0.1 });
  console.log("COMPACT", JSON.stringify({ requests: result.stats.requests, giamPct: Math.round((1 - result.stats.charsAfter / result.stats.charsBefore) * 100), ms: Date.now() - t3 }));
  console.log("P4-SIGNALS", JSON.stringify(s1Events.map((e) => e.outcome + (e.intent ? ":" + e.intent : "") + (e.verdict ? ":" + e.verdict : "") + (e.ms != null ? "@" + e.ms + "ms" : ""))));
  console.log("RESCUE-TEST-DONE");
}
main().catch((e) => { console.log("RESCUE-ERR", String(e?.message || e).slice(0, 300)); process.exit(1); });
