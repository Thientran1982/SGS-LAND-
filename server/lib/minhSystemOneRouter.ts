// ═══ MINH × SYSTEMONE v2 (JEV-ULTRAFAST P2/P3c/P4) ═══
// P2  : model nhỏ cho việc nhỏ — S1 mặc định dùng EXTRACTOR (jsonMode) của generateFn;
//       ghim cứng bằng env JEV_S1_MODEL khi cần. Model lớn chỉ cho suy luận thật.
// P3c : verifyMinhAnswer — DONE không bao giờ tự chứng minh thành công: chấm đáp án delegated
//       bằng 3 noul (answers_question / concrete_content / no_unsupported_guarantee), 1 request.
// P4  : onResult callback ở mọi đường — caller ghi signal/telemetry (outcome, ms, fallback).
// Env: JEV_MODE=local|typesafe · JEV_S1_MODEL · JEV_VERIFY=1 · TYPESAFE_API_KEY (mode typesafe).
// Không bật / lỗi bất kỳ → trả null → caller đi đường cũ. FAIL-CLOSED.
// @ts-ignore -- module JS thuần không có .d.ts (zero-dep, port từ sgs-agentic-hub)
import { makeLocalAsker } from "./systemone.js";
// @ts-ignore
import { jevAskerViaFetch } from "./jevcompact.js";

export interface MinhIntentMap { [intent: string]: string }
export interface SystemOneIntent { intent: string; reason: string; confidence: number }
export interface SystemOneResultMeta { outcome: "ok" | "fallback" | "disabled"; intent?: string; confidence?: number; ms?: number; error?: string }
export interface VerifyResult { verdict: "pass" | "flag"; confidence: number; checks: { answers_question: number; concrete_content: number; no_unsupported_guarantee: number } }

export function systemOneRouterEnabled(): boolean {
  return process.env.JEV_MODE === "local" || process.env.JEV_MODE === "typesafe";
}

type GenerateFn = (params: { system?: string; prompt: string; jsonMode?: boolean; timeoutMs?: number; feature?: string; model?: string }) => Promise<string>;

const S1_SYSTEM_PROMPT = 'Bạn là engine SystemOne chấm câu hỏi theo STATE đã cho. CHỈ trả về JSON thuần, không markdown, không giải thích, đúng shape: {"answers": {"<tên câu hỏi>": <kết quả>}}. Kiểu choice trả về: {"choice": "<chọn đúng 1 label trong criteria>", "confidence": số 0..1, "probabilities": {mỗi label: số 0..1, tổng ≈ 1, label được chọn phải có xác suất cao nhất}}. Kiểu noul trả về: {"noul": số 0..1}. Chấm TỪNG câu độc lập, chỉ dựa trên STATE, không suy diễn ngoài dữ liệu.';

async function askSystemOne(args: { generateFn: GenerateFn; state: unknown; questions: Record<string, any>; feature?: string; timeoutMs?: number }): Promise<Record<string, any>> {
  if (process.env.JEV_MODE === "typesafe") {
    const key = process.env.TYPESAFE_API_KEY || "";
    if (!key) throw new Error("no-key");
    const asker = jevAskerViaFetch(fetch, key, process.env.JEV_MODEL || "jev-latest", undefined, { timeoutMs: args.timeoutMs ?? 2500, maxRetries: 1 });
    const { answers } = await asker.ask(args.state, args.questions);
    return answers;
  }
  const asker = makeLocalAsker({
    model: process.env.JEV_S1_MODEL || process.env.JEV_LOCAL_MODEL || undefined, // P2: model nhỏ (EXTRACTOR) — pin qua JEV_S1_MODEL
    llmCall: async (messages: Array<{ role: string; content: string }>) => {
      const text = await args.generateFn({
        system: S1_SYSTEM_PROMPT,
        prompt: "STATE:\n" + JSON.stringify(args.state ?? null).slice(0, 20000) + "\n\nQUESTIONS:\n" + JSON.stringify(args.questions),
        jsonMode: true,
        timeoutMs: args.timeoutMs ?? 2500,
        feature: (args.feature || "MINH_ORCHESTRATOR") + "-S1",
        model: process.env.JEV_S1_MODEL || undefined,
      });
      return { ok: !!String(text || "").trim(), text: String(text || "") };
    },
  });
  const { answers } = await asker.ask(args.state, args.questions);
  return answers;
}

export async function minhSystemOneIntentJson(args: {
  generateFn: GenerateFn;
  message: string;
  intents: MinhIntentMap;
  feature?: string;
  timeoutMs?: number;
  onResult?: (r: SystemOneResultMeta) => void; // P4
}): Promise<SystemOneIntent | null> {
  const t0 = Date.now();
  if (!systemOneRouterEnabled()) {
    try { args.onResult?.({ outcome: "disabled", ms: 0 }); } catch {}
    return null;
  }
  try {
    const criteria: Record<string, string> = {};
    for (const k of Object.keys(args.intents)) criteria[k] = k;
    const questions = {
      specialist: {
        type: "choice",
        instructions: { goal: "Chon 1 chuyen gia xu ly tin nhan khach bat dong san", rules: "Chi chon label trong criteria; tin chung thong thuong → GENERAL" },
        criteria,
      },
    };
    const state = { message: String(args.message || "").slice(0, 1200) };
    const answers = await askSystemOne({ generateFn: args.generateFn, state, questions, feature: args.feature, timeoutMs: args.timeoutMs });
    const a = answers?.specialist;
    if (!a || typeof a.choice !== "string" || !criteria[a.choice]) throw new Error("bad-choice");
    const probs = (a.probabilities || {}) as Record<string, number>;
    const vals = Object.values(probs);
    if (!vals.length || !vals.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error("bad-probs");
    if (Math.abs(vals.reduce((s, n) => s + n, 0) - 1) > 0.02) throw new Error("bad-probs");
    const confidence = Math.max(0, Math.min(1, Number(a.confidence) || Math.max(...vals)));
    const out = { intent: a.choice, reason: "systemone:" + (process.env.JEV_MODE === "typesafe" ? "typesafe" : "local"), confidence };
    try { args.onResult?.({ outcome: "ok", intent: out.intent, confidence, ms: Date.now() - t0 }); } catch {}
    return out;
  } catch (e: any) {
    // Fail-closed: mọi lỗi (LLM rác, probs sai, timeout) → null, caller đi đường cũ
    try { args.onResult?.({ outcome: "fallback", ms: Date.now() - t0, error: String(e?.message || e).slice(0, 120) }); } catch {}
    return null;
  }
}

// ═══ P3c: VERIFIER ĐỘC LẬP — "DONE không bao giờ tự chứng minh thành công" ═══
// 1 request, 3 noul: trả lời đúng câu hỏi? có nội dung cụ thể? không cam kết vượt dữ liệu?
// pass  = answers_question ≥ 0.6 && no_unsupported_guarantee ≥ 0.5
// flag  = rơi vào rủi ro — caller chỉ GHI DẤU + signal, KHÔNG chặn (không phá UX chat)
// null  = engine lỗi/tắt → bỏ qua xác minh (fail-closed theo nghĩa "không thêm rủi ro mới")
export async function verifyMinhAnswer(args: {
  generateFn: GenerateFn;
  question: string;
  answer: string;
  timeoutMs?: number;
  feature?: string;
  onResult?: (r: SystemOneResultMeta & { verdict?: string }) => void; // P4
}): Promise<VerifyResult | null> {
  const t0 = Date.now();
  if (!systemOneRouterEnabled()) {
    try { args.onResult?.({ outcome: "disabled", ms: 0 }); } catch {}
    return null;
  }
  try {
    const questions = {
      answers_question: { type: "noul", instructions: "Đáp án có trả lời trực tiếp câu hỏi của khách không (không đi lạc đề)?" },
      concrete_content: { type: "noul", instructions: "Đáp án có nội dung cụ thể (con số/dữ liệu/bước tiếp theo) chứ không chung chung?" },
      no_unsupported_guarantee: { type: "noul", instructions: "Đáp án CÓ tránh cam kết chắc chắn/khẳng định giá chính xác tuyệt đối khi thiếu dữ liệu không? (1 = tránh tốt)" },
    };
    const state = { question: String(args.question || "").slice(0, 1200), answer: String(args.answer || "").slice(0, 3000) };
    const answers = await askSystemOne({ generateFn: args.generateFn, state, questions, feature: args.feature || "MINH_VERIFY", timeoutMs: args.timeoutMs ?? 12000 });
    const num = (name: string): number => {
      const v = answers?.[name];
      if (!v || typeof v.noul !== "number" || !Number.isFinite(v.noul) || v.noul < 0 || v.noul > 1) throw new Error("bad-noul:" + name);
      return v.noul;
    };
    const checks = { answers_question: num("answers_question"), concrete_content: num("concrete_content"), no_unsupported_guarantee: num("no_unsupported_guarantee") };
    const verdict: "pass" | "flag" = checks.answers_question >= 0.6 && checks.no_unsupported_guarantee >= 0.5 ? "pass" : "flag";
    const confidence = Math.round(((checks.answers_question + checks.concrete_content + checks.no_unsupported_guarantee) / 3) * 100) / 100;
    try { args.onResult?.({ outcome: "ok", verdict, confidence, ms: Date.now() - t0 }); } catch {}
    return { verdict, confidence, checks };
  } catch (e: any) {
    try { args.onResult?.({ outcome: "fallback", ms: Date.now() - t0, error: String(e?.message || e).slice(0, 120) }); } catch {}
    return null; // không xác minh được → không thêm rủi ro mới, caller bỏ qua
  }
}
