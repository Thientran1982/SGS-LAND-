// ═══ JEV COMPACTION cho Nexus (port zero-dep từ tamaratran/fast-jev-compaction) ═══
// Transport cloud căn theo SDK chính chủ typesafe-ai/typesafe-sdk-js (không install,
// port tay để giữ zero-dep): endpoint POST {base}/v1/systemone, auth Bearer, builders
// noul/score/choice + validateQuestions, retry 408+429+5xx (jitter + Retry-After),
// retry timeout/connection theo policy, error taxonomy (401 key hỏng fail rõ),
// usage tokens cộng dồn vào stats. Xem khối "SDK-ALIGNED TRANSPORT" dưới.
// Nguyên tắc JEV: KHÔNG tóm tắt. Chỉ xóa/cắt tool call + tool result mà Jev
// chấm "không còn cần", mọi thứ giữ lại giữ NGUYÊN VĂN, user/assistant text
// không bao giờ bị xóa hay viết lại. Thất bại/mất key/thiếu giảm → throw để
// caller fallback về hành vi cũ (slice history), không bao giờ trắng trang.
//
// Shape JEV Message (đồng bộ repo gốc):
//   { role:'user'|'assistant', text:string, toolUses:[{tool_use_id,tool,input,text?,isError?}], toolResults?:[{tool_use_id,text,isError?}] }
// Nexus history OpenAI: [{role:'user'|'assistant', content:string}]
// Adapter nexusToJevMessages() bọc toolLog các lượt trước thành cặp
// assistant-toolUses / user-toolResults để Jev chấm được.

export const SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_MODEL = "jev-latest";

export const STATE_CONTEXT =
  "A coding assistant conversation is being compacted to free context. `history` is the whole conversation so far, oldest first; tool outputs are replaced by a short `result` note and long texts may be abridged. Each question asks whether one tool call, or the full output of that call, still needs to stay in the history verbatim. Whatever is not kept is deleted permanently, but the assistant can always re-run a tool or re-read a file.";

export const JEV_DEFAULTS = {
  enabled: false, // có key (typesafe) hoặc mode local mới bật — fail-closed, mặc định giữ hành vi cũ
  mode: "typesafe", // "typesafe" = cloud api.typesafe.ai (cần key) | "local" = self-hosted SystemOne trên LLM nội bộ (src/systemone.js)
  localModel: "glm-5.3-flash", // model LLM nội bộ dùng khi mode="local"
  keepThreshold: 0.5,
  preserveRecentMessages: 6,
  maxStateTokens: 25000,
  maxRequestTokens: 30000,
  truncateHeadChars: 300,
  minReductionRatio: 0.25,
  triggerTokens: 4000, // chỉ gọi Jev khi history+steps ước vượt ngưỡng (tránh đốt latency mỗi lượt)
  timeoutMs: 10000, // timeout mỗi attempt — theo SDK chính chủ (DEFAULT_TIMEOUT_MS)
  maxRetries: 2, // thử lại 429/529/503 (backoff 0.5s·2^attempt, tối đa 3 attempts)
  model: DEFAULT_MODEL,
  baseUrl: SYSTEM_ONE_URL,
};

const INPUT_CHARS = [1000, 200, 60];
const TEXT_HEAD = 400;
const TEXT_TAIL = 150;
const REQUEST_OVERHEAD_TOKENS = 20;
const TOKEN_PIECES = /[A-Za-z]+|\d+|[^\sA-Za-z\d]/g;

export function estimateTokens(text) {
  let tokens = 0;
  const s = String(text || "");
  for (const m of s.matchAll(TOKEN_PIECES)) {
    const piece = m[0];
    const first = piece.charCodeAt(0);
    if (first >= 48 && first <= 57) tokens += piece.length / 2;
    else if ((first >= 65 && first <= 90) || (first >= 97 && first <= 122)) tokens += 1 + Math.floor((piece.length - 1) / 6);
    else tokens += 0.9;
  }
  return Math.ceil(tokens);
}

export function truncate(text, limit) {
  const s = String(text ?? "");
  return s.length <= limit ? s : `${s.slice(0, Math.max(0, limit - 1))}…`;
}

function abridge(text, head, tail) {
  const s = String(text || "");
  if (s.length <= head + tail + 40) return s;
  const omitted = s.length - head - tail;
  return `${s.slice(0, head)}\n[… ${omitted} chars omitted …]\n${s.slice(-tail)}`;
}

export function isPinned(index, total, preserveRecentMessages) {
  return index === 0 || index >= total - preserveRecentMessages;
}

export function collectToolCalls(messages, preserveRecentMessages) {
  const results = new Map();
  messages.forEach((message, index) => {
    for (const r of message.toolResults || []) results.set(r.tool_use_id, { index, result: r });
  });
  const calls = [];
  messages.forEach((message, callIndex) => {
    for (const tool of message.toolUses || []) {
      const found = results.get(tool.tool_use_id);
      if (!found) continue;
      calls.push({
        id: `t${calls.length + 1}`,
        tool_use_id: tool.tool_use_id,
        tool: tool.tool,
        input: tool.input || {},
        callIndex,
        resultIndex: found.index,
        resultChars: String(found.result.text || "").length,
        isError: !!found.result.isError,
        pinned:
          isPinned(callIndex, messages.length, preserveRecentMessages) ||
          isPinned(found.index, messages.length, preserveRecentMessages),
      });
    }
  });
  return calls;
}

function inputText(input, limit) {
  let json = "";
  try { json = JSON.stringify(input); } catch { json = "[unserializable input]"; }
  return truncate(json, limit);
}
function resultNote(call) {
  return `${call.isError ? "error" : "ok"}, ${call.resultChars} chars (omitted)`;
}
function compactCall(call) {
  const input = Object.entries(call.input || {})
    .map(([key, value]) => {
      const text = typeof value === "string" ? value : inputText({ [key]: value }, 200);
      return `${key}=${String(text).replace(/\s+/g, " ")}`;
    })
    .join(" ");
  return `${call.id} ${call.tool} ${truncate(input, INPUT_CHARS[2])} → ${call.isError ? "error" : "ok"} ${call.resultChars}ch`;
}
function mergeCallRuns(history, pinned) {
  const merged = [];
  for (const entry of history) {
    const prev = merged[merged.length - 1];
    const foldable = (e) => !pinned(e) && (e.text || "").length === 0 && typeof e.tool_calls?.[0] === "string";
    if (prev && foldable(prev) && foldable(entry) && prev.role === entry.role) {
      prev.tool_calls = [...prev.tool_calls, ...entry.tool_calls];
      continue;
    }
    merged.push({ ...entry });
  }
  return merged;
}
function callsByMessage(calls) {
  const by = new Map();
  for (const call of calls) {
    const list = by.get(call.callIndex) || [];
    list.push(call);
    by.set(call.callIndex, list);
  }
  return by;
}
function historyEntries(messages, calls, inputChars) {
  const byMessage = callsByMessage(calls);
  const entries = [];
  messages.forEach((message, i) => {
    const toolCalls = (byMessage.get(i) || []).map((call) => ({
      id: call.id, tool: call.tool, input: inputText(call.input, inputChars), result: resultNote(call),
    }));
    if (!String(message.text || "").trim() && toolCalls.length === 0) return;
    const entry = { i, role: message.role, text: String(message.text || "") };
    if (toolCalls.length) entry.tool_calls = toolCalls;
    entries.push(entry);
  });
  return entries;
}

export function goalFromMessages(messages) {
  return messages
    .filter((m) => m.role === "user" && String(m.text || "").trim() && !((m.toolResults || []).length))
    .slice(-3)
    .map((m) => truncate(m.text, 500))
    .join("\n");
}

export function fitState(messages, calls, options) {
  const goal = options.goal || goalFromMessages(messages);
  const stateOf = (history) => ({ context: STATE_CONTEXT, goal, history });
  const entryTokens = (e) => estimateTokens(JSON.stringify(e)) + 1;
  const baseTokens = estimateTokens(JSON.stringify(stateOf([])));
  const fitted = (history, tokens, stage) => ({ state: stateOf(history), tokens, stage });

  let history = [], perEntry = [], tokens = 0;
  const rebuild = (inputChars) => {
    history = historyEntries(messages, calls, inputChars);
    perEntry = history.map(entryTokens);
    tokens = baseTokens + perEntry.reduce((s, n) => s + n, 0);
  };
  const fits = () => tokens <= options.maxStateTokens;
  const shrink = (index, change) => {
    const entry = history[index];
    if (!entry) return;
    change(entry);
    const now = entryTokens(entry);
    tokens += now - (perEntry[index] || 0);
    perEntry[index] = now;
  };

  rebuild(INPUT_CHARS[0]);
  if (fits()) return fitted(history, tokens, "full");
  for (const limit of INPUT_CHARS.slice(1)) {
    rebuild(limit);
    if (fits()) return fitted(history, tokens, `inputs<=${limit}`);
  }
  const pinned = (e) => isPinned(e.i, messages.length, options.preserveRecentMessages);
  const indices = history.map((_, i) => i);
  const order = [...indices.filter((i) => !pinned(history[i])), ...indices.filter((i) => pinned(history[i]))];
  for (const idx of order) {
    const e = history[idx];
    if (!e || String(e.text || "").length <= TEXT_HEAD + TEXT_TAIL + 40) continue;
    shrink(idx, (x) => { x.text = abridge(x.text, TEXT_HEAD, TEXT_TAIL); });
    if (fits()) return fitted(history, tokens, "texts abridged");
  }
  for (const idx of order) {
    const e = history[idx];
    if (!e || pinned(e) || !String(e.text || "").length) continue;
    const original = messages[e.i]?.text?.length ?? String(e.text).length;
    shrink(idx, (x) => { x.text = `[… ${original} chars omitted …]`; });
    if (fits()) return fitted(history, tokens, "old messages collapsed");
  }
  const byMessage = callsByMessage(calls);
  for (const idx of order) {
    const e = history[idx];
    const own = e ? byMessage.get(e.i) : null;
    if (!e || pinned(e) || !own) continue;
    shrink(idx, (x) => { x.tool_calls = own.map(compactCall); });
    if (fits()) return fitted(history, tokens, "old calls compacted");
  }
  const left = new Set();
  for (const idx of order) {
    const e = history[idx];
    if (!e || pinned(e) || e.tool_calls) continue;
    left.add(idx);
    tokens -= perEntry[idx] || 0;
    if (fits()) return fitted(history.filter((_, i) => !left.has(i)), tokens, "old messages left out");
  }
  history = mergeCallRuns(history.filter((_, i) => !left.has(i)), pinned);
  perEntry = history.map(entryTokens);
  tokens = baseTokens + perEntry.reduce((s, n) => s + n, 0);
  if (fits()) return fitted(history, tokens, "old calls merged");
  throw new Error(`history too large for Jev (~${tokens} tokens after truncation, limit ${options.maxStateTokens})`);
}

export function questionsFor(call) {
  return {
    [`call_${call.id}`]: noul(
      `Tool call ${call.id} (${call.tool}) should stay in the history: knowing this call was made, with its input, still matters for what the assistant does next`,
    ),
    [`result_${call.id}`]: noul(
      `The full output of tool call ${call.id} (${call.tool}, ${call.resultChars} chars) should stay in the history verbatim: the assistant still needs its contents and re-running the tool would not do`,
    ),
  };
}

export function batchCalls(calls, stateTokens, options) {
  const budget = options.maxRequestTokens - stateTokens - REQUEST_OVERHEAD_TOKENS;
  const batches = [];
  let current = [], currentTokens = 0;
  for (const call of calls) {
    const t = estimateTokens(JSON.stringify(questionsFor(call)));
    if (current.length > 0 && currentTokens + t > budget) { batches.push(current); current = []; currentTokens = 0; }
    if (current.length === 0 && t > budget)
      throw new Error(`state leaves no room for questions (~${stateTokens} of ${options.maxRequestTokens} tokens)`);
    current.push(call);
    currentTokens += t;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function decideCall(call, answer, options) {
  const base = { id: call.id, tool: call.tool, ...answer };
  if (call.pinned) return { ...base, action: "keep", reason: "pinned" };
  if (answer.keepResult >= options.keepThreshold) return { ...base, action: "keep", reason: "kept" };
  if (answer.keepCall >= options.keepThreshold) return { ...base, action: "drop_result", reason: "result_dropped" };
  return { ...base, action: "drop_call", reason: "call_dropped" };
}

export const JEV_USER_AGENT = "sgs-nexus-jevcompact";

export function buildJevRequest(params, state, questions) {
  return {
    url: params.baseUrl || SYSTEM_ONE_URL,
    method: "POST",
    headers: {
      authorization: `Bearer ${params.apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": JEV_USER_AGENT,
    },
    body: JSON.stringify({ model: params.model || DEFAULT_MODEL, state, questions }),
  };
}

// ─── SDK-ALIGNED TRANSPORT (port từ typesafe-ai/typesafe-sdk-js, zero-dep) ───
// Giữ nguyên semantics SDK: error taxonomy, retry 408+429+5xx (jitter + Retry-After),
// retry timeout/connection theo policy, timeout 10s/attempt, usage passthrough.

export class TypeSafeError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

const isRecord = (v) => typeof v === "object" && v !== null;

function extractErrorMessage(body) {
  if (typeof body === "string") return body || undefined;
  if (!isRecord(body)) return undefined;
  const { error, message, detail } = body;
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  if (typeof message === "string") return message;
  if (typeof detail === "string") return detail;
  return undefined;
}

const MAX_RAW_BODY = 200;

export class APIError extends TypeSafeError {
  constructor(status, body, headers, message) {
    super(message ?? APIError.describe(status, body));
    this.status = status;
    this.body = body;
    this.headers = headers;
    this.requestId = getHeader(headers, "x-typesafe-request-id") || undefined;
  }
  static describe(status, body) {
    const detail = extractErrorMessage(body);
    if (detail) return `${status} ${detail}`.slice(0, MAX_RAW_BODY + 20);
    if (body === undefined) return `${status} status code (no body)`;
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    return `${status} ${raw.length > MAX_RAW_BODY ? `${raw.slice(0, MAX_RAW_BODY)}…` : raw}`;
  }
  static fromResponse(status, body, headers) {
    if (status === 400) return new BadRequestError(status, body, headers);
    if (status === 401) return new AuthenticationError(status, body, headers);
    if (status === 403) return new PermissionDeniedError(status, body, headers);
    if (status === 404) return new NotFoundError(status, body, headers);
    if (status === 422) return new UnprocessableEntityError(status, body, headers);
    if (status === 429) return new RateLimitError(status, body, headers);
    if (status >= 500) return new InternalServerError(status, body, headers);
    return new APIError(status, body, headers);
  }
}

export class BadRequestError extends APIError {}
export class AuthenticationError extends APIError {}
export class PermissionDeniedError extends APIError {}
export class NotFoundError extends APIError {}
export class UnprocessableEntityError extends APIError {}
export class RateLimitError extends APIError {
  get retryAfterMs() { return parseRetryAfter(this.headers); }
}
export class InternalServerError extends APIError {}
export class APIConnectionError extends TypeSafeError {
  constructor(message = "Connection error.", options) { super(message, options); }
}
export class APITimeoutError extends APIConnectionError {
  constructor(timeoutMs, options) {
    super(`Request timed out after ${timeoutMs}ms.`, options);
    this.timeoutMs = timeoutMs;
  }
}
export class APIUserAbortError extends TypeSafeError {
  constructor(message = "Request was aborted.", options) { super(message, options); }
}

// Đọc header chịu cả Headers instance lẫn object thường (fetch mock trong test).
export function getHeader(headers, name) {
  if (!headers) return undefined;
  try {
    if (typeof headers.get === "function") {
      const v = headers.get(name);
      return v === null ? undefined : v;
    }
  } catch {}
  const low = String(name).toLowerCase();
  for (const k of Object.keys(headers)) {
    if (String(k).toLowerCase() === low) {
      const v = headers[k];
      return v === null ? undefined : v;
    }
  }
  return undefined;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export const DEFAULT_RETRY_POLICY = {
  maxRetries: 2,
  backoffInitialMs: 500,
  backoffMaxMs: 5_000,
  backoffJitter: 0.25,
  httpStatuses: new Set([408, 429, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 529]),
  respectRetryAfter: true,
  maxRetryAfterMs: 60_000,
  apiConnectionError: true,
  apiTimeoutError: true,
};

export function isRetryableStatus(status, policy = DEFAULT_RETRY_POLICY) {
  return (policy.httpStatuses || DEFAULT_RETRY_POLICY.httpStatuses).has(status);
}

export function parseRetryAfter(headers, now = Date.now()) {
  if (!headers) return undefined;
  const msRaw = getHeader(headers, "retry-after-ms");
  if (msRaw !== undefined) {
    const ms = Number(msRaw);
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  const raw = getHeader(headers, "retry-after");
  if (raw === undefined) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return undefined;
}

export function retryDelayMs(attempt, headers, policy = DEFAULT_RETRY_POLICY, random = Math.random) {
  const p = policy || DEFAULT_RETRY_POLICY;
  if (p.respectRetryAfter !== false && headers !== undefined) {
    const ra = parseRetryAfter(headers);
    if (ra !== undefined && ra <= (p.maxRetryAfterMs ?? 60_000)) return ra;
  }
  const exponential = Math.min((p.backoffInitialMs ?? 500) * 2 ** attempt, p.backoffMaxMs ?? 5_000);
  return Math.round(exponential * (1 - (random() || 0) * (p.backoffJitter ?? 0.25)));
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse body nới lỏng như SDK: rỗng → undefined; JSON hỏng → text thô (để caller quyết).
export function parseBodyLenient(text) {
  const s = String(text ?? "");
  if (!s) return undefined;
  try { return JSON.parse(s); } catch { return s; }
}

export function parseJevResponse(status, ok, text, headers) {
  const body = parseBodyLenient(text);
  if (!ok) throw APIError.fromResponse(status, body, headers);
  let parsed = body;
  if (typeof parsed === "string") throw new TypeSafeError("Jev returned malformed JSON");
  if (!parsed || typeof parsed !== "object" || !parsed.answers || typeof parsed.answers !== "object")
    throw new TypeSafeError("Jev response is missing answers");
  const reqId = getHeader(headers, "x-typesafe-request-id");
  if (reqId && parsed.requestId === undefined) {
    try { parsed = { ...parsed, requestId: reqId }; } catch {}
  }
  return parsed;
}

// Builders câu hỏi theo SDK (noul/score/choice) — JSON ra giống hệt object tay cũ.
export function noul(instructions = null, criteria) {
  const q = { type: "noul", instructions };
  if (criteria !== undefined) q.criteria = criteria;
  return q;
}

export function score(instructions, criteria) {
  if (!Array.isArray(criteria))
    throw new TypeSafeError("Score criteria must be a list of descriptions indexed by score from zero, not a map.");
  return { type: "score", instructions, criteria };
}

export function choice(instructions, criteria) {
  if (Array.isArray(criteria))
    throw new TypeSafeError("Choice criteria must be a map of labels to descriptions, not a list.");
  return { type: "choice", instructions, criteria };
}

// Validate theo SDK: cấm rỗng + score cần list ≥ 2 entry.
export function validateQuestions(questions) {
  if (!questions || typeof questions !== "object" || Array.isArray(questions) || !Object.keys(questions).length)
    throw new TypeSafeError("At least one question is required.");
  for (const [name, q] of Object.entries(questions)) {
    if (!q || typeof q !== "object") throw new TypeSafeError(`Question "${name}" has invalid shape.`);
    if (q.type === "score" && (!Array.isArray(q.criteria) || q.criteria.length < 2))
      throw new TypeSafeError(`Score question "${name}" needs a list of at least two criteria.`);
  }
  return questions;
}

export function noulAnswer(answers, name) {
  const a = answers[name];
  if (!a || !("noul" in a) || typeof a.noul !== "number" || !Number.isFinite(a.noul))
    throw new Error(`Invalid Jev answer for ${name}`);
  return a.noul;
}

// ─── ULTRA-JEV: validate `choice` answers (port từ browser-use/jev-ultrafast model.py) ───
// Bắt buộc: choice thuộc ids · keys probabilities khớp đúng ids · mọi số finite 0..1 ·
// tổng ≈1 (±0.02) · choice là argmax. Sai 1 điều → throw để caller fallback, không execute mù.
export function validateChoice(answer, ids) {
  const rawList = Array.isArray(ids) ? ids : Object.keys(ids || {});
  const idSet = new Set(rawList);
  // Mảng ids trùng nhau là lỗi caller — fail-closed thay vì so length sai.
  if (idSet.size !== rawList.length) throw new Error("Invalid TypeSafe response; duplicate choice ids.");
  try {
    const probs = answer.probabilities;
    const nums = [...Object.values(probs), answer.confidence];
    const valid =
      idSet.has(answer.choice) &&
      Object.keys(probs).length === idSet.size &&
      Object.keys(probs).every((k) => idSet.has(k)) &&
      nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) &&
      Math.abs(Object.values(probs).reduce((s, n) => s + n, 0) - 1) < 0.02 &&
      probs[answer.choice] >= Math.max(...Object.values(probs)) - 1e-6;
    if (!valid) throw new Error("bad choice");
  } catch {
    throw new Error("Invalid TypeSafe response; no action executed.");
  }
  return answer;
}

export function choiceAnswer(answers, name, ids) {
  const a = answers[name];
  if (!a || typeof a !== "object") throw new Error(`Invalid TypeSafe response; no action executed (missing ${name}).`);
  return validateChoice(a, ids).choice;
}

export function scoreAnswer(answers, name) {
  const a = answers[name];
  if (!a || typeof a !== "object" || typeof a.score !== "number" || !Number.isFinite(a.score))
    throw new TypeSafeError(`Invalid TypeSafe response; no action executed (bad score ${name}).`);
  return a;
}

async function askBatch(asker, state, batch) {
  const questions = Object.assign({}, ...batch.map(questionsFor));
  validateQuestions(questions);
  const resp = await asker.ask(state, questions);
  const answers = resp.answers || {};
  const usage = resp.usage && typeof resp.usage === "object" ? resp.usage : {};
  return {
    map: new Map(batch.map((call) => [call.id, {
      keepCall: noulAnswer(answers, `call_${call.id}`),
      keepResult: noulAnswer(answers, `result_${call.id}`),
    }])),
    usage: {
      inputTokens: Number(usage.input_tokens) || 0,
      outputTokens: Number(usage.output_tokens) || 0,
    },
    model: typeof resp.model === "string" ? resp.model : undefined,
    requestId: typeof resp.requestId === "string" ? resp.requestId : undefined,
  };
}

function truncatedResultText(text, isError, headChars) {
  const s = String(text || "");
  if (s.length <= headChars + 120) return s;
  const head = headChars > 0 ? `${s.slice(0, headChars)}\n` : "";
  return `${head}[fast-jev-compaction truncated ${s.length - headChars} chars of this tool result${isError ? " (error)" : ""}; re-run the tool if needed]`;
}

export function applyDecisions(messages, decisions, calls, headChars) {
  const byId = new Map(calls.map((c) => [c.id, c]));
  const actions = new Map();
  for (const d of decisions) {
    const call = byId.get(d.id);
    if (call && d.action !== "keep") actions.set(call.tool_use_id, d.action);
  }
  const kept = [];
  for (const m of messages) {
    const touched =
      (m.toolUses || []).some((t) => actions.has(t.tool_use_id)) ||
      (m.toolResults || []).some((r) => actions.has(r.tool_use_id));
    if (!touched) { kept.push(m); continue; }
    const toolUses = (m.toolUses || [])
      .filter((t) => actions.get(t.tool_use_id) !== "drop_call")
      .map((t) => {
        if (actions.get(t.tool_use_id) !== "drop_result") return t;
        const text = truncatedResultText(t.text || "", !!t.isError, headChars);
        if ((t.text || "") === text) return t;
        // Giữ mọi field gốc (spread) rồi override text — tránh drift mất field lạ/isError:false.
        return { ...t, text };
      });
    const toolResults = (m.toolResults || [])
      .filter((r) => actions.get(r.tool_use_id) !== "drop_call")
      .map((r) => {
        if (actions.get(r.tool_use_id) !== "drop_result") return r;
        const text = truncatedResultText(r.text, !!r.isError, headChars);
        return text === r.text ? r : { ...r, text };
      });
    const sameUses = toolUses.every((t, i) => t === m.toolUses[i]) && toolUses.length === (m.toolUses || []).length;
    const sameResults = toolResults.every((r, i) => r === (m.toolResults || [])[i]) && toolResults.length === ((m.toolResults || []).length);
    const noDropCall =
      !(m.toolUses || []).some((t) => actions.get(t.tool_use_id) === "drop_call") &&
      !(m.toolResults || []).some((r) => actions.get(r.tool_use_id) === "drop_call");
    if (noDropCall && sameUses && sameResults) { kept.push(m); continue; }
    if (!String(m.text || "").trim() && toolUses.length === 0 && toolResults.length === 0) continue;
    const rebuilt = { role: m.role, text: m.text || "", toolUses };
    if (toolResults.length) rebuilt.toolResults = toolResults;
    kept.push(rebuilt);
  }
  return kept;
}

export function messageChars(message) {
  let total = String(message.text || "").length;
  for (const t of message.toolUses || []) {
    try { total += JSON.stringify(t.input).length; } catch { total += 20; }
    total += String(t.text || "").length;
  }
  for (const r of message.toolResults || []) total += String(r.text || "").length;
  return total;
}

export function reductionRatio(result) {
  const { charsBefore, charsAfter } = result.stats;
  return charsBefore === 0 ? 0 : (charsBefore - charsAfter) / charsBefore;
}

function countReason(decisions, reason) {
  return decisions.filter((d) => d.reason === reason).length;
}

export function resolveOptions(options = {}) {
  const finite = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  return {
    goal: options.goal ?? JEV_DEFAULTS.goal ?? "",
    keepThreshold: finite(options.keepThreshold, JEV_DEFAULTS.keepThreshold),
    preserveRecentMessages: Math.max(0, Math.floor(finite(options.preserveRecentMessages, JEV_DEFAULTS.preserveRecentMessages))),
    maxStateTokens: Math.max(1, finite(options.maxStateTokens, JEV_DEFAULTS.maxStateTokens)),
    maxRequestTokens: Math.max(1, finite(options.maxRequestTokens, JEV_DEFAULTS.maxRequestTokens)),
    truncateHeadChars: Math.max(0, Math.floor(finite(options.truncateHeadChars, JEV_DEFAULTS.truncateHeadChars))),
  };
}

// Resolve transport thành RetryPolicy đầy đủ (theo SDK; maxRetryAfterMs trần thấp hơn
// SDK vì Nexus gọi trong request chat — chờ Retry-After 60s sẽ treo lượt chat).
function resolveTransportPolicy(transport = {}) {
  const num = (v, fb, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
  };
  return {
    maxRetries: Number.isFinite(Number(transport.maxRetries)) ? Math.max(0, Math.min(5, Math.floor(Number(transport.maxRetries)))) : DEFAULT_RETRY_POLICY.maxRetries,
    backoffInitialMs: num(transport.backoffInitialMs, DEFAULT_RETRY_POLICY.backoffInitialMs, 0, 30_000),
    backoffMaxMs: num(transport.backoffMaxMs, DEFAULT_RETRY_POLICY.backoffMaxMs, 0, 120_000),
    backoffJitter: num(transport.backoffJitter, DEFAULT_RETRY_POLICY.backoffJitter, 0, 1),
    httpStatuses: DEFAULT_RETRY_POLICY.httpStatuses,
    respectRetryAfter: transport.respectRetryAfter !== false,
    maxRetryAfterMs: num(transport.maxRetryAfterMs, 5_000, 0, 300_000),
    apiConnectionError: transport.apiConnectionError !== false,
    apiTimeoutError: transport.apiTimeoutError !== false,
    timeoutMs: num(transport.timeoutMs, DEFAULT_TIMEOUT_MS, 1, 120_000),
  };
}

const readText = async (r) => (typeof r.text === "string" ? r.text : await r.text());

export function jevAskerViaFetch(fetchFn, apiKey, model, baseUrl, transport = {}) {
  const policy = resolveTransportPolicy(transport);
  const timeoutMs = policy.timeoutMs;
  const maxRetries = policy.maxRetries;
  return {
    async ask(state, questions) {
      validateQuestions(questions);
      const req = buildJevRequest({ apiKey, model, baseUrl }, state, questions);
      for (let attempt = 0; ; attempt++) {
        const retriesLeft = maxRetries - attempt;
        const headers = attempt === 0
          ? req.headers
          : { ...req.headers, "x-typesafe-retry-count": String(attempt) };
        // AbortController riêng mỗi attempt để phân biệt timeout vs lỗi mạng (như SDK).
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; try { controller.abort(); } catch {} }, timeoutMs);
        let r;
        try {
          r = await fetchFn(req.url, { method: req.method, headers, body: req.body, signal: controller.signal });
        } catch (e) {
          clearTimeout(timer);
          const err = timedOut
            ? new APITimeoutError(timeoutMs, { cause: e })
            : new APIConnectionError(e instanceof Error && e.message ? `Connection error: ${e.message}` : undefined, { cause: e });
          const retryable = err instanceof APITimeoutError ? policy.apiTimeoutError : policy.apiConnectionError;
          if (retriesLeft <= 0 || !retryable) throw err;
          await sleepMs(retryDelayMs(attempt, undefined, policy));
          continue;
        }
        clearTimeout(timer);
        let text;
        try {
          text = await readText(r);
        } catch (e) {
          const err = new APIConnectionError("Connection error: unreadable body.", { cause: e });
          if (retriesLeft <= 0 || !policy.apiConnectionError) throw err;
          await sleepMs(retryDelayMs(attempt, undefined, policy));
          continue;
        }
        if (r.ok) return parseJevResponse(r.status, true, text, r.headers);
        const err = APIError.fromResponse(r.status, parseBodyLenient(text), r.headers);
        if (retriesLeft <= 0 || !isRetryableStatus(r.status, policy)) throw err;
        await sleepMs(retryDelayMs(attempt, r.headers, policy));
      }
    },
  };
}

// Wrapper tiện dụng tương đương `compactMessages` của npm package:
// tự dựng asker từ apiKey, khỏi truyền asker tay.
export async function compactMessages(messages, options = {}) {
  const env = (k) => (typeof process !== "undefined" && process.env ? process.env[k] : undefined);
  const apiKey = options.apiKey || env("TYPESAFE_API_KEY") || "";
  if (!apiKey) throw new TypeSafeError("TYPESAFE_API_KEY is not configured");
  const fetchFn = options.fetch || fetch;
  const asker = jevAskerViaFetch(fetchFn, apiKey, options.model || env("TYPESAFE_DEFAULT_MODEL"), options.baseUrl || env("TYPESAFE_BASE_URL"), options);
  return compact(messages, asker, options);
}

// ─── ULTRA-JEV: speculative fan-out 1-request (port pattern từ jev-ultrafast) ───
// 1 request duy nhất hỏi `operation` + head target cho MỖI operation ứng viên.
// Chỉ head khớp operation được validate + execute; head thừa không gây action.
// heads: { [opKey]: { criteria: {index: {...}}, ids: {index: actionId} } }
// Trả { operation, operationProbs, confidence, target, choice, targetProbs, rawAnswers }.
export async function chooseSpeculative(asker, { state, operationCriteria, operationInstructions, targetHeads, goal }) {
  const questions = {
    operation: { type: "choice", criteria: operationCriteria, instructions: operationInstructions },
  };
  // Key head dùng lower-case theo ultra-jev; 2 operation chỉ khác case sẽ đụng key → throw sớm.
  const seenHead = new Set();
  for (const [op, head] of Object.entries(targetHeads || {})) {
    const qk = op.toLowerCase() + "_target";
    if (seenHead.has(qk)) throw new Error(`Duplicate target head for operation "${op}" (case-insensitive collision).`);
    seenHead.add(qk);
    questions[qk] = {
      type: "choice",
      criteria: head.criteria,
      instructions: { goal, operation: op, rules: head.rules || operationInstructions },
    };
  }
  validateQuestions(questions);
  const { answers, ...rest } = await asker.ask(state, questions);
  const opIds = Object.keys(operationCriteria);
  const opAnswer = validateChoice(answers.operation || {}, opIds);
  const operation = opAnswer.choice;
  let target = null, choice = operation, targetProbs = {}, targetConfidence = null;
  const head = (targetHeads || {})[operation];
  if (head) {
    const tIds = Object.keys(head.criteria || {});
    const tAnswer = validateChoice(answers[operation.toLowerCase() + "_target"] || {}, tIds);
    target = tAnswer.choice;
    choice = (head.ids || {})[target] || target;
    targetProbs = tAnswer.probabilities;
    targetConfidence = tAnswer.confidence;
  }
  return {
    operation, operationProbs: opAnswer.probabilities, confidence: opAnswer.confidence,
    target, choice, targetProbs, targetConfidence, rawAnswers: answers, ...rest,
  };
}

export async function compact(messages, asker, options = {}) {
  const started = Date.now();
  const resolved = resolveOptions(options);
  const calls = collectToolCalls(messages, resolved.preserveRecentMessages);
  const candidates = calls.filter((c) => !c.pinned);
  const charsBefore = messages.reduce((s, m) => s + messageChars(m), 0);
  let fitted = { tokens: 0, stage: "" };
  let batches = [];
  const answers = new Map();
  let jevIn = 0, jevOut = 0, jevModel, jevRequestId;
  if (candidates.length > 0) {
    const fit = fitState(messages, calls, resolved);
    fitted = fit;
    batches = batchCalls(candidates, fit.tokens, resolved);
    const answered = await Promise.all(batches.map((b) => askBatch(asker, fit.state, b)));
    // Cộng dồn usage tokens từ mọi response (theo SDK: usage luôn có) để đo chi phí Jev thật.
    for (const ans of answered) {
      for (const [id, a] of ans.map) answers.set(id, a);
      jevIn += ans.usage.inputTokens; jevOut += ans.usage.outputTokens;
      if (jevModel === undefined) jevModel = ans.model;
      if (jevRequestId === undefined) jevRequestId = ans.requestId;
    }
  }
  const decisions = calls.map((call) =>
    decideCall(call, answers.get(call.id) || { keepCall: 1, keepResult: 1 }, resolved));
  const kept = applyDecisions(messages, decisions, calls, resolved.truncateHeadChars);
  return {
    messages: kept,
    decisions,
    stats: {
      messagesBefore: messages.length, messagesAfter: kept.length, charsBefore,
      charsAfter: kept.reduce((s, m) => s + messageChars(m), 0),
      calls: calls.length, kept: countReason(decisions, "kept"),
      resultsDropped: countReason(decisions, "result_dropped"),
      callsDropped: countReason(decisions, "call_dropped"),
      pinned: countReason(decisions, "pinned"),
      stateTokens: fitted.tokens, stateStage: fitted.stage, requests: batches.length, ms: Date.now() - started,
      jevInputTokens: jevIn, jevOutputTokens: jevOut, jevModel, jevRequestId,
    },
  };
}

// ─── Nexus adapter: OpenAI history + tool steps → JEV messages ───
// steps: [{tool, args, ok, result}] (toolLog). Mỗi step thành 1 cặp:
//   assistant {toolUses:[...]} + user {toolResults:[...]} để Jev chấm keepCall/keepResult.
// Text các lượt giữ nguyên văn, không tóm tắt.
//
// PRIVACY (hội đồng bảo mật): state gửi ra api.typesafe.ai BẮT BUỘC chứa history +
// tool outputs nghiệp vụ (đúng thiết kế "không tóm tắt"), nên redact PII phổ biến
// (email, SĐT VN) TRƯỚC khi gửi. Infra secret (key TypeSafe ở header, token agent,
// GW_SECRET) không bao giờ vào state. Model cần số liệu cứ gọi lại tool (tool-first).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(\+?84|0)(3|5|7|8|9)\d{8}\b/g;
export function redactPII(text) {
  // Dùng ?? chứ không || để giữ "0"/false (bug B12 hội đồng: || nuốt falsy hợp lệ).
  return String(text ?? "").replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[sdt]");
}
let jevSeq = 0;
export function nexusToJevMessages(history, steps) {
  const msgs = (Array.isArray(history) ? history : []).map((h) => ({
    role: h.role === "user" ? "user" : "assistant",
    text: redactPII(h.content ?? ""),
    toolUses: [],
  }));
  for (const s of Array.isArray(steps) ? steps : []) {
    if (!s || typeof s !== "object") continue;
    const id = `nx_${++jevSeq}_${Date.now().toString(36)}`;
    const input = (s.args && typeof s.args === "object") ? s.args : { raw: String(s.args ?? "") };
    const out = redactPII(s.result ?? "");
    msgs.push({
      role: "assistant", text: "",
      toolUses: [{ tool_use_id: id, tool: String(s.tool || "tool"), input, text: out, isError: !s.ok }],
    });
    msgs.push({ role: "user", text: "", toolUses: [], toolResults: [{ tool_use_id: id, text: out, isError: !s.ok }] });
  }
  return msgs;
}

// JEV messages đã prune → OpenAI messages cho Nexus (text giữ nguyên, tool đã rớt biến mất,
// result bị cắt giữ head + note để model biết re-run). Emit đúng 1 bản mỗi tool:
// ưu tiên Uses (đã kèm text), Results-only (transcript generic) emit khi Uses không có text.
export function jevToNexusMessages(jevMessages) {
  const out = [];
  for (const m of jevMessages) {
    if ((m.toolUses || []).length || (m.toolResults || []).length) {
      let emitted = false;
      for (const t of m.toolUses || []) {
        if (String(t.text || "").trim()) {
          out.push({ role: "assistant", content: `[tool ${t.tool} ${JSON.stringify(t.input || {}).slice(0, 300)}]\n${String(t.text).slice(0, 2000)}` });
          emitted = true;
        }
      }
      if (!emitted) {
        for (const r of m.toolResults || []) {
          if (String(r.text || "").trim()) {
            out.push({ role: "assistant", content: `[tool result]\n${String(r.text).slice(0, 2000)}` });
            emitted = true;
          }
        }
      }
      if (String(m.text || "").trim()) out.push({ role: m.role, content: m.text });
      continue;
    }
    if (String(m.text || "").trim()) out.push({ role: m.role, content: m.text });
  }
  return out;
}

export function decisionLog(result) {
  return (result.decisions || [])
    .filter((d) => d.reason !== "pinned")
    .map((d) => `${d.id}:${d.tool}:${d.action}/call=${Number(d.keepCall || 0).toFixed(2)}/result=${Number(d.keepResult || 0).toFixed(2)}`)
    .join(" ");
}

// Bản cap ký tự cho trace/log (tránh traces.json phình khi nhiều call)
export function decisionLogCapped(result, maxChars = 2000) {
  const full = decisionLog(result);
  return full.length <= maxChars ? full : full.slice(0, maxChars) + "…";
}
