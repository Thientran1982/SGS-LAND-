export type GuardrailFlag =
  | 'PROMPT_INJECTION'
  | 'SECRET_EXPOSURE'
  | 'EMPTY_OUTPUT'
  | 'UNSUPPORTED_SENSITIVE_CLAIM'
  | 'HIGH_IMPACT_ACTION'
  | 'OUTPUT_TRUNCATED'
  | 'TECHNICAL_MARKUP'
  | 'DUPLICATE_CONTENT';

export interface GuardrailReport {
  safe: boolean;
  blocked: boolean;
  escalate: boolean;
  flags: GuardrailFlag[];
  requiresVerification: boolean;
  approvalRequired: boolean;
  sanitizedContent?: string;
  reason?: string;
}

export type MarketingApprovalDecision =
  | 'draft'
  | 'needs_human_review'
  | 'approved'
  | 'rejected';

export type MarketingApprovalInput = {
  capability: string;
  complianceDecision?: 'approved' | 'rejected' | 'needs_human_review';
  seoDecision?: 'approved_for_publish' | 'needs_revision';
  humanPublishApproved?: boolean;
  brokerApproved?: boolean;
  consentValid?: boolean;
};

/**
 * Central gate for the two irreversible marketing actions. Callers may create
 * drafts freely, but public content needs both automated reviews and a human
 * click; outreach additionally needs broker approval and valid consent.
 */
export function evaluateMarketingApproval(input: MarketingApprovalInput): {
  decision: MarketingApprovalDecision;
  reasons: string[];
} {
  const reasons: string[] = [];
  const isOutreach = input.capability === 'OUTREACH' || input.capability === 'outreach';
  if (isOutreach) {
    if (input.consentValid !== true) reasons.push('missing_or_expired_consent');
    if (input.brokerApproved !== true) reasons.push('broker_approval_required');
    return {
      decision: reasons.length > 0 ? 'needs_human_review' : 'approved',
      reasons,
    };
  }

  const gatedPublish = ['PROJECT_PAGE', 'PRICING_INVENTORY_SYNC', 'COMPLIANCE_GUARDIAN', 'SEO_AEO_AUDITOR']
    .includes(String(input.capability).toUpperCase());
  if (!gatedPublish) return { decision: 'approved', reasons: [] };
  if (input.complianceDecision !== 'approved') reasons.push('compliance_guardian_not_approved');
  if (input.seoDecision !== 'approved_for_publish') reasons.push('seo_aeo_auditor_not_approved');
  if (input.humanPublishApproved !== true) reasons.push('human_publish_approval_required');
  return {
    decision: reasons.length > 0 ? 'needs_human_review' : 'approved',
    reasons,
  };
}

export function canPublishMarketingContent(input: MarketingApprovalInput): boolean {
  return evaluateMarketingApproval(input).decision === 'approved';
}

export function canSendOutreach(input: Omit<MarketingApprovalInput, 'capability'>): boolean {
  return evaluateMarketingApproval({ ...input, capability: 'OUTREACH' }).decision === 'approved';
}

const HIGH_IMPACT_ACTIONS = new Set([
  'CONFIRM_DEPOSIT',
  'CHANGE_LEAD_STAGE',
  'CREATE_PROPOSAL',
  'BOOK_VIEWING',
  'SEND_DOCS',
  'DRAFT_PROACTIVE_FOLLOWUP',
  'REVIEW_LISTING_PRICE',
  'REVIEW_CSAT_DROP',
]);

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i,
  /reveal|show|print|leak.{0,30}(system\s+prompt|developer\s+message|hidden\s+instructions?)/i,
  /\b(jailbreak|developer\s+mode|do\s+anything\s+now)\b/i,
  /act\s+as\s+system/i,
];

// Vietnamese jailbreak attempts — the English-only set misses these. The
// input is tone-folded first (NFD strip + đ→d + lowercase), so patterns are
// written unaccented and catch both accented and typed-without-diacritics
// variants. High-precision on purpose: each pattern needs an adversarial verb
// plus a protected target, so ordinary price/legal questions never match.
function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const VN_PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /bo\s*qua\s+(tat\s*ca\s+)?(cac\s+)?(chi\s*dan|luat\s*lenh|quy\s*tac)/,
  /(tiet\s*loi|in\s*ra|cho\s*xem|hen\s*ra)[^.?!\n]{0,40}(system\s*prompt|prompt\s*he\s*thong|lenh\s*noi\s*bo|chi\s*dan\s*an)/,
  /vo\s*hieu\s*hoa[^.?!\n]{0,30}(chi\s*dan|guardrail|kiem\s*soat)/,
];

const SECRET_PATTERNS = [
  /\bsk-[a-z0-9_-]{20,}\b/i,
  /\bAIza[0-9A-Za-z_-]{25,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_ -]?key|secret|token)\s*[:=]\s*[A-Za-z0-9+/_-]{20,}\b/i,
  /\bgh[pou]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

const SENSITIVE_CLAIM_PATTERN =
  /(pháp lý|quy hoạch|sổ hồng|sổ đỏ|giá|triệu\/m²|tỷ|lãi suất|cam kết lợi nhuận)/i;

export type AgentEvidenceSource = {
  source: string;
  sourceId?: string;
  url?: string;
  quote?: string;
  observedAt?: string;
  unit?: string;
  tool?: string;
};

const INVALID_SOURCE_LABELS = new Set([
  'source',
  'unknown source',
  'specialist result',
  'durable-specialist-checkpoint',
  'sgs land tenant-scoped data',
  'tenant-db',
  'internal data',
  'database',
]);

export function normalizeEvidenceSource(value: unknown, tool?: string): AgentEvidenceSource | null {
  if (typeof value === 'string') {
    const source = value.trim();
    if (!source || source.length < 3 || INVALID_SOURCE_LABELS.has(source.toLowerCase())) return null;
    return { source, ...(tool ? { tool } : {}) };
  }
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const source = String(item.source || item.name || item.title || item.url || '').trim();
  if (!source || source.length < 3 || INVALID_SOURCE_LABELS.has(source.toLowerCase())) return null;
  return {
    source,
    ...(item.id || item.sourceId ? { sourceId: String(item.sourceId || item.id) } : {}),
    ...(item.url ? { url: String(item.url) } : {}),
    ...(item.quote ? { quote: String(item.quote).slice(0, 500) } : {}),
    ...(item.observedAt || item.fetchedAt || item.updatedAt
      ? { observedAt: String(item.observedAt || item.fetchedAt || item.updatedAt) }
      : {}),
    ...(item.unit ? { unit: String(item.unit) } : {}),
    ...(tool || item.tool ? { tool: String(item.tool || tool) } : {}),
  };
}

export function hasUsableEvidenceSources(sources: unknown): boolean {
  return Array.isArray(sources) && sources.some(source => normalizeEvidenceSource(source));
}

export function inspectAgentInput(message: string): GuardrailReport {
  const normalized = String(message || '').slice(0, 4000);
  const folded = foldVietnamese(normalized);
  const promptInjection =
    PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(normalized)) ||
    VN_PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(folded));
  if (promptInjection) {
    return {
      safe: false,
      blocked: true,
      escalate: true,
      flags: ['PROMPT_INJECTION'],
      requiresVerification: false,
      approvalRequired: false,
      reason: 'Phát hiện yêu cầu can thiệp hoặc tiết lộ chỉ dẫn nội bộ.',
    };
  }
  return {
    safe: true,
    blocked: false,
    escalate: false,
    flags: [],
    requiresVerification: false,
    approvalRequired: false,
  };
}

export function inspectToolRequest(toolName: string): GuardrailReport {
  // Tools the supervisor may execute autonomously. NOTE: this set is wider
  // than toolPermissions 'read' tier by design — task_* / landing_* create
  // drafts only; irreversible actions (publish, outreach, deposit) still go
  // through evaluateMarketingApproval / HIGH_IMPACT approval.
  const autonomousSafeTools = new Set([
    'search_listings',
    'get_listing_detail',
    'get_market_stats',
    'get_valuation',
    'get_valuation_methodology',
    'compare_price_vs_market',
    'check_legal_status',
    'check_planning',
    'legal_qa',
    'get_price_index',
    'get_longthanh_market',
    'analyze_investment',
    'get_project_info',
    'compare_projects',
    'search_projects',
    'suggest_properties',
    'get_project_listings',
    'search_listings_dynamic',
    'get_project_dynamic',
    'get_platform_knowledge',
    // Task tools doc/ghi chu - an toan cho agent tu chay
    'task_list',
    'task_comment',
    'landing_quota',
    'landing_builder',
     'landing_design_agent',
  ]);
  if (!autonomousSafeTools.has(toolName)) {
    return {
      safe: false,
      blocked: true,
      escalate: false,
      flags: ['HIGH_IMPACT_ACTION'],
      requiresVerification: false,
      approvalRequired: true,
      reason: `Tool ${toolName} không được supervisor tự động thực thi.`,
    };
  }
  return {
    safe: true,
    blocked: false,
    escalate: false,
    flags: [],
    requiresVerification: false,
    approvalRequired: false,
  };
}

export function inspectAgentOutput(output: {
  content?: string;
  suggestedAction?: string | null;
  sources?: unknown[];
  artifact?: unknown;
  longForm?: boolean;
}): GuardrailReport {
  let content = String(output.content || '').trim();
  const flags: GuardrailFlag[] = [];

  if (!content) {
    return {
      safe: false,
      blocked: true,
      escalate: true,
      flags: ['EMPTY_OUTPUT'],
      requiresVerification: false,
      approvalRequired: false,
      reason: 'Model không trả về nội dung hợp lệ.',
    };
  }
  if (SECRET_PATTERNS.some(pattern => pattern.test(content))) {
    return {
      safe: false,
      blocked: true,
      escalate: true,
      flags: ['SECRET_EXPOSURE'],
      requiresVerification: false,
      approvalRequired: false,
      reason: 'Output có dấu hiệu chứa credential hoặc secret.',
    };
  }

  // A specialist may return internal markup, but it must never leak through
  // the final customer-facing execution result.
  const beforeMarkupCleanup = content;
  content = content
    .replace(/<\/?(?:SPECIALIST_RESULT|CONTEXT|INVENTORY DATA|VISITOR_PROFILE)[^>]*>/gi, '')
    .replace(/^\s*\[(?:SPECIALIST_RESULT|CONTEXT|INVENTORY DATA|VISITOR_PROFILE)[^\]]*\]\s*:?\s*$/gim, '')
    .trim();
  if (content !== beforeMarkupCleanup) flags.push('TECHNICAL_MARKUP');

  // Models sometimes repeat the same paragraph when combining specialist
  // evidence. Keep the first occurrence while preserving intentional bullets.
  const paragraphs = content.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const uniqueParagraphs = paragraphs.filter((paragraph, index) =>
    paragraphs.findIndex(candidate => candidate.toLowerCase() === paragraph.toLowerCase()) === index,
  );
  if (uniqueParagraphs.length < paragraphs.length) {
    content = uniqueParagraphs.join('\n\n');
    flags.push('DUPLICATE_CONTENT');
  }

  let requiresVerification = false;
  const hasExplicitSources = hasUsableEvidenceSources(output.sources);
  if (SENSITIVE_CLAIM_PATTERN.test(content) && !hasExplicitSources) {
    flags.push('UNSUPPORTED_SENSITIVE_CLAIM');
    requiresVerification = true;
    content += '\n\nThông tin giá/pháp lý chỉ mang tính tham khảo và cần được xác minh từ nguồn chính thức.';
  }
  // Customer replies should be focused even when a provider ignores the
  // requested token budget. Long-form answers get a bounded larger budget;
  // durable specialist artifacts remain separate. Truncate at a readable
  // boundary so the customer does not receive half a sentence or bullet.
  const maxCustomerReplyLength = output.longForm ? 6000 : output.artifact ? 2600 : 2200;
  if (content.length > maxCustomerReplyLength) {
    flags.push('OUTPUT_TRUNCATED');
    const limit = maxCustomerReplyLength - 3;
    const candidate = content.slice(0, limit).trimEnd();
    const boundaryCandidates = [
      candidate.lastIndexOf('\n\n'),
      candidate.lastIndexOf('\n- '),
      candidate.lastIndexOf('\n• '),
      candidate.lastIndexOf('. '),
      candidate.lastIndexOf('。'),
    ].filter(index => index >= Math.floor(limit * 0.6));
    const boundary = boundaryCandidates.length > 0 ? Math.max(...boundaryCandidates) : -1;
    content = (boundary >= 0 ? candidate.slice(0, boundary + (candidate[boundary] === '。' ? 1 : 0)) : candidate).trimEnd() + '...';
  }

  const approvalRequired = HIGH_IMPACT_ACTIONS.has(String(output.suggestedAction || ''));
  if (approvalRequired) flags.push('HIGH_IMPACT_ACTION');
  return {
    safe: true,
    blocked: false,
    escalate: flags.includes('UNSUPPORTED_SENSITIVE_CLAIM'),
    flags,
    requiresVerification,
    approvalRequired,
    sanitizedContent: content,
  };
}

export function blockedAgentResponse(reason?: string): string {
  return `Mình chưa thể xử lý yêu cầu này tự động. ${reason || 'Vui lòng chờ chuyên viên SGS Land hỗ trợ.'}`;
}