process.env.JEV_MODE = "local";
import { minhSystemOneIntentJson, verifyMinhAnswer } from "../server/lib/minhSystemOneRouter";
const MODEL = "nex-agi/nex-n2.5-mini:free";
const gen = async (p: any) => {
  const key = process.env.OPENROUTER_API_KEY || "";
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: String(p.system || "") }, { role: "user", content: String(p.prompt || "") }] }),
    signal: AbortSignal.timeout(p.timeoutMs || 30000),
  });
  if (r.status >= 400) throw new Error("openrouter " + r.status + ": " + String(await r.text()).slice(0, 100));
  const d: any = await r.json();
  const text = String(d?.choices?.[0]?.message?.content || "");
  if (!text.trim()) throw new Error("openrouter empty");
  return text;
};
const INTENTS = { VALUATION: "dinh gia", SEARCH: "tim kiem", LEGAL: "phap ly", FINANCE: "vay von", PROJECT: "du an", GENERAL: "chung" };
const t0 = Date.now();
const r1 = await minhSystemOneIntentJson({ generateFn: gen, message: "Ban dat 200m2 mat tien Long Thanh, hoi gia thi truong bao nhieu tien 1 m2?", intents: INTENTS, timeoutMs: 30000 });
console.log("S1-ROUTER", JSON.stringify(r1), "ms=" + (Date.now() - t0));
const t1 = Date.now();
const v = await verifyMinhAnswer({
  generateFn: gen,
  question: "Ban dat 200m2 mat tien Long Thanh gia bao nhieu?",
  answer: "Dat mat tien Long Thanh giao dong 45-60 trieu/m2 tuy vi tri va phap ly. Con so mang tinh tham khao, can khao sat thuc dia truoc khi dinh gia chinh xac.",
  timeoutMs: 30000,
});
console.log("S1-VERIFY", JSON.stringify(v), "ms=" + (Date.now() - t1));
console.log("PROBE4-DONE");
