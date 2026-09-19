// test-p234-check.ts — kiểm tra lại P2/P3c/P4 trên bản đã deploy (fake LLM tất định, không cần mạng/key)
process.env.JEV_MODE = "local";
import { minhSystemOneIntentJson, systemOneRouterEnabled, verifyMinhAnswer } from "../server/lib/minhSystemOneRouter";

const INTENTS = { VALUATION: "dinh gia", LEGAL: "phap ly", GENERAL: "chung" };
const results: string[] = [];
const ok = (n: string, c: boolean, e = "") => { results.push((c ? "PASS " : "FAIL ") + n + (c ? "" : " | " + e)); };

// ── P2: model nhỏ cho việc nhỏ ──
process.env.JEV_S1_MODEL = "glm-5.3-flash";
const seen: any[] = [];
const genP2 = async (p: any) => { seen.push(p); return JSON.stringify({ answers: { specialist: { choice: "LEGAL", confidence: 0.8, probabilities: { VALUATION: 0.1, LEGAL: 0.8, GENERAL: 0.1 } } } }); };
const rP2 = await minhSystemOneIntentJson({ generateFn: genP2, message: "So hong co rang buoc gi khong?", intents: INTENTS, timeoutMs: 5000 });
ok("P2 route đúng intent", rP2?.intent === "LEGAL" && rP2?.reason === "systemone:local", JSON.stringify(rP2));
ok("P2 jsonMode=true → generateFn chọn EXTRACTOR (model nhỏ)", seen[0]?.jsonMode === true);
ok("P2 pin JEV_S1_MODEL truyền xuống generateFn", seen[0]?.model === "glm-5.3-flash", JSON.stringify(seen[0]?.model));
delete process.env.JEV_S1_MODEL;
const genP2b = async (p: any) => { seen.push(p); return JSON.stringify({ answers: { specialist: { choice: "GENERAL", confidence: 0.7, probabilities: { VALUATION: 0.1, LEGAL: 0.2, GENERAL: 0.7 } } } }); };
await minhSystemOneIntentJson({ generateFn: genP2b, message: "q", intents: INTENTS, timeoutMs: 5000 });
ok("P2 không pin → model undefined (generateFn tự chọn EXTRACTOR)", seen[1]?.model === undefined, JSON.stringify(seen[1]?.model));

// ── P3c: verifier độc lập ──
const good = async () => JSON.stringify({ answers: { answers_question: { noul: 0.95 }, concrete_content: { noul: 0.9 }, no_unsupported_guarantee: { noul: "0.9" } } });
const v1 = await verifyMinhAnswer({ generateFn: good, question: "q", answer: "a" });
ok("P3c pass case (kèm noul dạng string — tolerant)", v1?.verdict === "pass" && (v1?.confidence ?? 0) > 0.8, JSON.stringify(v1));
const over = async () => JSON.stringify({ answers: { answers_question: { noul: 1 }, concrete_content: { noul: 1 }, no_unsupported_guarantee: { noul: 0 } } });
const v2 = await verifyMinhAnswer({ generateFn: over, question: "q", answer: "a" });
ok("P3c flag case (cam kết vượt dữ liệu)", v2?.verdict === "flag" && v2?.checks?.no_unsupported_guarantee === 0, JSON.stringify(v2));
const garbage = async () => "rac khong phai json";
const v3 = await verifyMinhAnswer({ generateFn: garbage, question: "q", answer: "a" });
ok("P3c LLM rác → null (fail-closed)", v3 === null, JSON.stringify(v3));
const saveMode = process.env.JEV_MODE; delete process.env.JEV_MODE;
const v4 = await verifyMinhAnswer({ generateFn: async () => "x", question: "q", answer: "a" });
ok("P3c JEV_MODE tắt → disabled/null", v4 === null, JSON.stringify(v4));
process.env.JEV_MODE = saveMode;

// ── P4: onResult telemetry ──
const events: any[] = [];
const genP4 = async () => JSON.stringify({ answers: { specialist: { choice: "VALUATION", confidence: 0.9, probabilities: { VALUATION: 0.9, LEGAL: 0.05, GENERAL: 0.05 } } } });
await minhSystemOneIntentJson({ generateFn: genP4, message: "Gia bao nhieu?", intents: INTENTS, timeoutMs: 5000, onResult: (e) => events.push(e) });
await minhSystemOneIntentJson({ generateFn: async () => "rac", message: "x", intents: INTENTS, timeoutMs: 5000, onResult: (e) => events.push(e) });
ok("P4 ghi đủ 2 event (ok + fallback)", events.length === 2 && events[0]?.outcome === "ok" && events[1]?.outcome === "fallback", JSON.stringify(events));
ok("P4 event có ms + intent + confidence", typeof events[0]?.ms === "number" && events[0]?.intent === "VALUATION" && typeof events[0]?.confidence === "number", JSON.stringify(events[0]));
ok("P4 fallback event có error ngắn gọn", typeof events[1]?.error === "string" && events[1]!.error!.length > 0, JSON.stringify(events[1]));

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log("P234-CHECK " + (fails ? "FAIL" : "ALL-PASS") + " (" + results.length + " assertion, " + fails + " fail)");
