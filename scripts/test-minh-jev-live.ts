// test-minh-jev-live.ts v4 — kiểm tra P2/P3c/P4: router + verifier + telemetry, LLM THẬT (Gemini trực tiếp)
process.env.JEV_MODE = process.env.JEV_MODE || "local";
import { generateLiveChatText } from "../server/ai/liveChatEngine";
import { minhSystemOneIntentJson, systemOneRouterEnabled, verifyMinhAnswer } from "../server/lib/minhSystemOneRouter";
import { minhChooseSpecialist } from "../server/ai/minhOrchestrator";
import { makeLocalAsker } from "../server/lib/systemone";
import { compact } from "../server/lib/jevcompact";

const INTENTS = { VALUATION: "dinh gia", SEARCH: "tim kiem", LEGAL: "phap ly", FINANCE: "vay von", INVESTMENT: "dau tu", PROJECT: "du an", GENERAL: "chung" };

async function geminiJson(system: string, prompt: string, timeoutMs: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY trống");
  const call = (tc: boolean) => fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: system + "\n\n" + prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 2000, responseMimeType: "application/json", ...(tc ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let r = await call(true);
  if (r.status === 400) r = await call(false);
  if (!r.ok) throw new Error("gemini " + r.status + ": " + String(await r.text()).slice(0, 100));
  const data: any = await r.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  if (!text.trim()) throw new Error("gemini empty");
  return text;
}
const gen: any = (p: any) => geminiJson(String(p.system || ""), String(p.prompt || ""), p.timeoutMs || 20000);
const s1Events: any[] = [];
const rec = (r: any) => { s1Events.push(r); };

async function main() {
  console.log("JEV_MODE =", process.env.JEV_MODE, "· enabled =", systemOneRouterEnabled(), "· LLM = gemini-2.5-flash");

  const t0 = Date.now();
  const r1 = await minhSystemOneIntentJson({ generateFn: gen, message: "Ban dat 200m2 mat tien Long Thanh, hoi gia thi truong bao nhieu tien 1 m2?", intents: INTENTS, timeoutMs: 20000, onResult: rec });
  console.log("ROUTER-1", JSON.stringify(r1), "ms=" + (Date.now() - t0));

  const t1 = Date.now();
  const r2 = await minhSystemOneIntentJson({ generateFn: gen, message: "Em muon kiem tra so hong lo dat co bi tranh chap hay rang buoc gi khong?", intents: INTENTS, timeoutMs: 20000, onResult: rec });
  console.log("ROUTER-2", JSON.stringify(r2), "ms=" + (Date.now() - t1));

  const t2 = Date.now();
  try {
    const plan = await minhChooseSpecialist({ tenantId: "test-jev", message: "Can ho Aqua City 2PN gia 3 ty co dang dau tu khong?", sessionId: "jev-live-v4", generateFn: gen, fallbackIntent: "GENERAL", fallbackTool: "get_platform_knowledge" });
    console.log("PROD-ROUTER", JSON.stringify(plan), "ms=" + (Date.now() - t2));
  } catch (e: any) { console.log("PROD-ROUTER-ERR", String(e?.message || e).slice(0, 120)); }

  const tv1 = Date.now();
  const v1 = await verifyMinhAnswer({
    generateFn: gen,
    question: "Ban dat 200m2 mat tien Long Thanh gia bao nhieu?",
    answer: "Dua tren du lieu thi truong Q3, dat mat tien Long Thanh giao dong 45-60 trieu/m2 tuy vi tri va phap ly. Con so mang tinh tham khao, can khao sat thuc dia truoc khi dinh gia chinh xac. Buoc tiep theo: cung cap so do va vi tri cu the de cham diem.",
    timeoutMs: 20000, onResult: rec,
  });
  console.log("VERIFY-PASS?", JSON.stringify(v1), "ms=" + (Date.now() - tv1));

  const tv2 = Date.now();
  const v2 = await verifyMinhAnswer({
    generateFn: gen,
    question: "Ban dat 200m2 mat tien Long Thanh gia bao nhieu?",
    answer: "Chac chan lo dat nay gia dung 5 ty, cam ket loi nhuan 100% cho quy dinh vi!",
    timeoutMs: 20000, onResult: rec,
  });
  console.log("VERIFY-FLAG?", JSON.stringify(v2), "ms=" + (Date.now() - tv2));

  const asker = makeLocalAsker({
    model: "gemini-2.5-flash",
    llmCall: async (messages: Array<{ role: string; content: string }>) => {
      const text = await geminiJson(messages[0].content, messages[1].content, 25000);
      return { ok: !!String(text || "").trim(), text: String(text || "") };
    },
  });
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
  console.log("LIVE-TEST-DONE");
}
main().catch((e) => { console.log("LIVE-TEST-ERR", String(e?.message || e).slice(0, 300)); process.exit(1); });
