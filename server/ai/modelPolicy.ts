/**
 * modelPolicy.ts — SINGLE SOURCE OF TRUTH for AI model configuration.
 *
 * Muc tieu: KHONG hardcode ten model (vd gemini-3) rai rac trong code.
 * Tat ca model / provider / gia / task-mapping / deprecation deu khai bao o day.
 * Ho tro nhieu nha cung cap (provider): Google Gemini (dang dung), va cac
 * diem cam san sang cho OpenAI (ChatGPT), Anthropic (Claude), xAI (Grok)...
 *
 * Cach doi model KHONG can sua code: dat bien moi truong (ENV):
 *   AI_MODEL_ROUTER, AI_MODEL_EXTRACTOR, AI_MODEL_WRITER, AI_MODEL_EMBEDDING
 *   AI_DEFAULT_PROVIDER  (google | openai | anthropic | xai)
 *   AI_SAFE_FALLBACK     (ten model fallback an toan)
 */

export type AiProvider = 'google' | 'openai' | 'anthropic' | 'xai';

export interface ModelSpec {
  /** ID model dung khi goi API */
  id: string;
  provider: AiProvider;
  /** Gia USD uoc tinh cho 1K token (dung cho tracking chi phi) */
  costPer1k: number;
  /** Model cu -> se bi ensureSafeModel nang cap len fallback */
  deprecated?: boolean;
  /** Model preview/thu nghiem — co the chua san sang production */
  preview?: boolean;
  /** Ho tro che do 'thinking' (Gemini 2.5+/3.x) */
  supportsThinking?: boolean;
}

/**
 * REGISTRY: khai bao 1 lan, dung o moi noi.
 * Them model moi (vd gemini-3, gpt-4o, claude-3.5, grok-2) => them 1 dong o day.
 */
export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // ---- Google Gemini 3.x (preview) ----
  'gemini-3.1-pro-preview':        { id: 'gemini-3.1-pro-preview',        provider: 'google', costPer1k: 0.008000, preview: true,  supportsThinking: true },
  'gemini-3-pro-preview':          { id: 'gemini-3-pro-preview',          provider: 'google', costPer1k: 0.007000, preview: true,  supportsThinking: true, deprecated: true },
  'gemini-3.1-flash-lite-preview': { id: 'gemini-3.1-flash-lite-preview', provider: 'google', costPer1k: 0.000200, preview: true,  supportsThinking: true },
  'gemini-3-flash-preview':        { id: 'gemini-3-flash-preview',        provider: 'google', costPer1k: 0.000500, preview: true,  supportsThinking: true },
  // ---- Google Gemini 2.5 (stable — recommended) ----
  'gemini-2.5-pro':        { id: 'gemini-2.5-pro',        provider: 'google', costPer1k: 0.005000, supportsThinking: true, deprecated: true },
  'gemini-2.5-flash':      { id: 'gemini-2.5-flash',      provider: 'google', costPer1k: 0.000375, supportsThinking: true },
  'gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', provider: 'google', costPer1k: 0.000100, supportsThinking: true, deprecated: true },
  // ---- Google Gemini 2.0 / 1.5 (deprecated — auto-upgraded) ----
  'gemini-2.0-flash':      { id: 'gemini-2.0-flash',      provider: 'google', costPer1k: 0.000150, deprecated: true },
  'gemini-2.0-flash-lite': { id: 'gemini-2.0-flash-lite', provider: 'google', costPer1k: 0.000075, deprecated: true },
  'gemini-1.5-flash':      { id: 'gemini-1.5-flash',      provider: 'google', costPer1k: 0.000200, deprecated: true },
  'gemini-1.5-pro':        { id: 'gemini-1.5-pro',        provider: 'google', costPer1k: 0.003500, deprecated: true },
  // ---- Embedding ----
  'gemini-embedding-001':  { id: 'gemini-embedding-001',  provider: 'google', costPer1k: 0.000010 },
};

/** Nha cung cap mac dinh (co the doi bang ENV). */
export const DEFAULT_PROVIDER: AiProvider =
  (process.env.AI_DEFAULT_PROVIDER as AiProvider) || 'google';

/** Model fallback an toan khi model bi null/deprecated. */
export const SAFE_MODEL_FALLBACK: string =
  process.env.AI_SAFE_FALLBACK || 'gemini-2.5-flash';

/**
 * TASK -> MODEL. Doi model chi can sua o day (hoac dat ENV), khong dung o code goi.
 * ROUTER: phan loai y dinh | EXTRACTOR: trich xuat JSON | WRITER: sinh noi dung.
 */
export const TASK_MODELS = {
  ROUTER:    process.env.AI_MODEL_ROUTER    || 'gemini-2.5-flash',
  EXTRACTOR: process.env.AI_MODEL_EXTRACTOR || 'gemini-2.5-flash',
  WRITER:    process.env.AI_MODEL_WRITER    || 'gemini-2.5-flash',
  EMBEDDING: process.env.AI_MODEL_EMBEDDING || 'gemini-embedding-001',
} as const;

/**
 * ===== TASK PROFILES =====
 * Gom cau hinh sinh noi dung (temperature / maxOutputTokens / thinkingBudget)
 * theo tung "task profile" -> mot bang duy nhat de chinh, thay vi rai rac trong ai.ts.
 * thinkingBudget: 0 = tat suy luan (nhanh), 2048 = standard, 8192 = extended (deep).
 * Moi truong deu co the override qua ENV: AI_PROFILE_<NAME>_TEMP / _TOKENS / _THINK.
 */
export interface TaskProfile {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingBudget: number;
}

function numEnv(name: string, def: number | undefined): number | undefined {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function P(name: string, temperature: number | undefined, maxOutputTokens: number | undefined, thinkingBudget: number, topP?: number): TaskProfile {
  return {
    temperature: numEnv(`AI_PROFILE_${name}_TEMP`, temperature),
    topP: numEnv(`AI_PROFILE_${name}_TOPP`, topP),
    maxOutputTokens: numEnv(`AI_PROFILE_${name}_TOKENS`, maxOutputTokens),
    thinkingBudget: numEnv(`AI_PROFILE_${name}_THINK`, thinkingBudget) as number,
  };
}

export const TASK_PROFILES: Record<string, TaskProfile> = {
  // Router phan loai y dinh: nhanh, khong suy luan sau.
  ROUTER:              P('ROUTER',             undefined, undefined, 0),
  // Grounding lai suat ngan hang (Google Search) - giu native Gemini.
  BANK_RATES:          P('BANK_RATES',         undefined, 400, 0),
  // Specialist reasoning nhe: inventory / finance / sales / marketing.
  SPECIALIST_STANDARD: P('SPECIALIST_STANDARD', undefined, 350, 2048),
  // Specialist reasoning sau: legal / contract / lead-analyst.
  SPECIALIST_EXTENDED: P('SPECIALIST_EXTENDED', undefined, 350, 8192),
  // Writer tra loi cuoi cung cho user.
  WRITER:              P('WRITER',             undefined, 1024, 0),
  // Tin nhan follow-up chu dong.
  FOLLOWUP:            P('FOLLOWUP',           undefined, 600, 2048),
  // Dinh gia - tim kiem gia ban (grounding).
  VALUATION_SALE:      P('VALUATION_SALE',     0.3, 2048, 0),
  // Dinh gia - tim kiem gia thue (grounding).
  VALUATION_RENTAL:    P('VALUATION_RENTAL',   0.3, 1536, 0),
  // Dinh gia - tong hop JSON (deterministic, no hallucination).
  VALUATION_JSON:      P('VALUATION_JSON',     0.1, 1024, 0, 0.8),
  // Dinh gia - kiem chung/trich nguon (grounding).
  VALUATION_VERIFY:    P('VALUATION_VERIFY',   0.3, 1024, 0),
};

/**
 * Tra ve object config san sang spread vao `config` cua generateContent:
 * { temperature?, maxOutputTokens?, thinkingConfig: { thinkingBudget } }.
 * Neu profile khong ton tai -> tra ve {} (an toan, giu hanh vi mac dinh).
 */
export function taskProfile(name: keyof typeof TASK_PROFILES): {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingConfig: { thinkingBudget: number };
} {
  const p = TASK_PROFILES[name];
  const out: any = { thinkingConfig: { thinkingBudget: p ? p.thinkingBudget : 0 } };
  if (p?.temperature !== undefined) out.temperature = p.temperature;
  if (p?.topP !== undefined) out.topP = p.topP;
  if (p?.maxOutputTokens !== undefined) out.maxOutputTokens = p.maxOutputTokens;
  return out;
}

/** Cac tien to model da deprecated — suy ra tu REGISTRY (khong hardcode rai rac). */
export const DEPRECATED_MODEL_PREFIXES: string[] = Object.values(MODEL_REGISTRY)
  .filter(m => m.deprecated)
  .map(m => m.id);

/** Map cost de tuong thich nguoc voi code cu (GENAI_CONFIG.MODEL_COSTS). */
export const MODEL_COSTS: Record<string, number> = Object.fromEntries(
  Object.values(MODEL_REGISTRY).map(m => [m.id, m.costPer1k])
);

/** Neu model null/deprecated -> tra ve fallback an toan; nguoc lai giu nguyen. */
export function ensureSafeModel(model: string | undefined | null): string {
  if (!model) return SAFE_MODEL_FALLBACK;
  const spec = MODEL_REGISTRY[model];
  if (spec && spec.deprecated) return SAFE_MODEL_FALLBACK;
  // Model la khong biet nhung khop tien to deprecated -> nang cap
  if (!spec && DEPRECATED_MODEL_PREFIXES.some(p => model.startsWith(p))) {
    return SAFE_MODEL_FALLBACK;
  }
  return model;
}

/** Xac dinh provider cua 1 model (de sau nay route sang SDK dung nha cung cap). */
export function getProviderForModel(model: string): AiProvider {
  return MODEL_REGISTRY[model]?.provider || DEFAULT_PROVIDER;
}

/** Chi phi USD/1K token cua model (fallback theo TASK_MODELS.WRITER neu chua biet). */
export function getModelCost(model: string): number {
  // Doc truc tiep tu REGISTRY (da gom ca provider mo rong) thay vi snapshot MODEL_COSTS.
  return MODEL_REGISTRY[model]?.costPer1k ?? MODEL_REGISTRY[TASK_MODELS.WRITER]?.costPer1k ?? 0;
}

/**
 * GENAI_CONFIG — tuong thich nguoc voi code cu trong ai.ts.
 * ai.ts se import cai nay thay vi tu dinh nghia => 1 nguon su that duy nhat.
 */
export const GENAI_CONFIG = {
  MODELS: {
    ROUTER: TASK_MODELS.ROUTER,
    EXTRACTOR: TASK_MODELS.EXTRACTOR,
    WRITER: TASK_MODELS.WRITER,
  },
  MODEL_COSTS,
} as const;

// ============================================================
// MULTI-PROVIDER EXTENSION (OpenAI / Anthropic / xAI)
// Them model moi cua cac provider khac => them 1 dong o day.
// Ten model co the chinh lai cho khop danh muc thuc te cua tung hang.
// ============================================================
Object.assign(MODEL_REGISTRY, {
  // ---- OpenAI (ChatGPT) ----
  'gpt-4o':      { id: 'gpt-4o',      provider: 'openai' as AiProvider, costPer1k: 0.005000 },
  'gpt-4o-mini': { id: 'gpt-4o-mini', provider: 'openai' as AiProvider, costPer1k: 0.000150 },
  'gpt-4.1':     { id: 'gpt-4.1',     provider: 'openai' as AiProvider, costPer1k: 0.002000 },
  'gpt-4.1-mini':{ id: 'gpt-4.1-mini',provider: 'openai' as AiProvider, costPer1k: 0.000400 },
  // ---- Anthropic (Claude) ----
  // ---- Anthropic (Claude) -- CU, xac nhan CHET 2026-08-18 (404 not_found_error, EOL) ----
  'claude-3-5-sonnet-latest': { id: 'claude-3-5-sonnet-latest', provider: 'anthropic' as AiProvider, costPer1k: 0.003000, supportsThinking: true, deprecated: true },
  'claude-3-5-haiku-latest': { id: 'claude-3-5-haiku-latest', provider: 'anthropic' as AiProvider, costPer1k: 0.000800, deprecated: true },
  'claude-3-7-sonnet-latest': { id: 'claude-3-7-sonnet-latest', provider: 'anthropic' as AiProvider, costPer1k: 0.003000, supportsThinking: true, deprecated: true },
  // ---- Anthropic (Claude) -- xac nhan DANG HOAT DONG (live probe 2026-08-18) ----
  'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', provider: 'anthropic' as AiProvider, costPer1k: 0.003000, supportsThinking: true },
  'claude-opus-4-5': { id: 'claude-opus-4-5', provider: 'anthropic' as AiProvider, costPer1k: 0.015000, supportsThinking: true },
  'claude-haiku-4-5': { id: 'claude-haiku-4-5', provider: 'anthropic' as AiProvider, costPer1k: 0.000800 },
  // ---- xAI (Grok) -- CU, xac nhan CHET 2026-08-18 (400 Model not found) ----
  'grok-2': { id: 'grok-2', provider: 'xai' as AiProvider, costPer1k: 0.002000, deprecated: true },
  'grok-2-mini': { id: 'grok-2-mini', provider: 'xai' as AiProvider, costPer1k: 0.000500, deprecated: true },
  'grok-beta': { id: 'grok-beta', provider: 'xai' as AiProvider, costPer1k: 0.005000, deprecated: true },
  // ---- xAI (Grok) -- ten model HOP LE (live probe 2026-08-18), nhung account dang HET CREDIT (403) ----
  // Se tu dong hoat dong ngay khi tai khoan xAI duoc nap them credit, khong can sua code.
  'grok-4': { id: 'grok-4', provider: 'xai' as AiProvider, costPer1k: 0.005000 },
  'grok-3': { id: 'grok-3', provider: 'xai' as AiProvider, costPer1k: 0.003000 },
  'grok-3-mini': { id: 'grok-3-mini', provider: 'xai' as AiProvider, costPer1k: 0.000500 },
});

/**
 * Danh sach provider/model dung de fallback CHEO PROVIDER khi toan bo
 * FALLBACK_CHAIN cua Gemini da het (quota/loi). Thu theo dung thu tu.
 * Chi provider da cau hinh API key (Secret) moi duoc thu.
 */
export const CROSS_PROVIDER_FALLBACK: { provider: AiProvider; model: string }[] = [
  { provider: 'anthropic', model: process.env.AI_FALLBACK_ANTHROPIC_MODEL || 'claude-sonnet-4-5' },
  { provider: 'xai', model: process.env.AI_FALLBACK_XAI_MODEL || 'grok-4' },
];

/** Ten bien moi truong (Secret) chua API key cua tung provider. */
export const PROVIDER_ENV_KEYS: Record<AiProvider, string[]> = {
  google:    ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'API_KEY'],
  openai:    ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  xai:       ['XAI_API_KEY', 'GROK_API_KEY'],
};

/** Lay API key cua provider tu process.env (KHONG bao gio hardcode). */
export function getProviderApiKey(provider: AiProvider): string | undefined {
  for (const name of PROVIDER_ENV_KEYS[provider] || []) {
    const v = process.env[name];
    if (v) return v;
  }
  return undefined;
}

/** Provider da co key chua? (dung de fallback an toan khi thieu key). */
export function isProviderConfigured(provider: AiProvider): boolean {
  return !!getProviderApiKey(provider);
}

/**
 * Danh sach model kha dung, nhom theo nha cung cap.
 * - Loai bo model deprecated (Gemini 1.x / 2.x — Google khong con dung).
 * - Loai bo model embedding (khong dung cho chat/agent).
 * - Danh dau provider da cau hinh API key hay chua.
 * Dung cho endpoint GET /api/ai/models de UI Quan tri AI lay dong.
 */
export interface ModelInfo {
  id: string;
  provider: AiProvider;
  costPer1k: number;
  preview: boolean;
  supportsThinking: boolean;
}
export interface ProviderModelGroup {
  provider: AiProvider;
  label: string;
  configured: boolean;
  models: ModelInfo[];
}
const PROVIDER_LABELS: Record<AiProvider, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  xai: 'xAI (Grok)',
};
const PROVIDER_ORDER: AiProvider[] = ['google', 'openai', 'anthropic', 'xai'];
export function listAvailableModels(): ProviderModelGroup[] {
  const groups = new Map<AiProvider, ModelInfo[]>();
  for (const spec of Object.values(MODEL_REGISTRY)) {
    if (spec.deprecated) continue;
    if (spec.id.includes('embedding')) continue;
    if (!groups.has(spec.provider)) groups.set(spec.provider, []);
    groups.get(spec.provider)!.push({
      id: spec.id,
      provider: spec.provider,
      costPer1k: spec.costPer1k,
      preview: !!spec.preview,
      supportsThinking: !!spec.supportsThinking,
    });
  }
  return PROVIDER_ORDER.filter((p) => groups.has(p)).map((p) => ({
    provider: p,
    label: PROVIDER_LABELS[p],
    configured: isProviderConfigured(p),
    models: groups.get(p)!,
  }));
}
