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
]);

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/i,
  /reveal|show|print|leak.{0,30}(system\s+prompt|developer\s+message|hidden\s+instructions?)/i,
  /\b(jailbreak|developer\s+mode|do\s+anything\s+now)\b/i,
  /act\s+as\s+system/i,
];

const SECRET_PATTERNS = [
  /\bsk-[a-z0-9_-]{20,}\b/i,
  /\bAIza[0-9A-Za-z_-]{25,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_ -]?key|secret|token)\s*[:=]\s*[A-Za-z0-9+/_-]{20,}\b/i,
];

const SENSITIVE_CLAIM_PATTERN =
  /(pháp lý|quy hoạch|sổ hồng|sổ đỏ|giá|triệu\/m²|tỷ|lãi suất|cam kết lợi nhuận)/i;
const SOURCE_PATTERN =
  /(nguồn|source|theo dữ liệu|benchmark|luật|nghị định|sgs-avm|cần xác minh|tham khảo)/i;

export function inspectAgentInput(message: string): GuardrailReport {
  const normalized = String(message || '').slice(0, 4000);
  const promptInjection = PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(normalized));
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
  const readOnlyTools = new Set([
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
  ]);
  if (!readOnlyTools.has(toolName)) {
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
  const hasExplicitSources = Array.isArray(output.sources) && output.sources.length > 0;
  if (SENSITIVE_CLAIM_PATTERN.test(content) && !hasExplicitSources && !SOURCE_PATTERN.test(content)) {
    flags.push('UNSUPPORTED_SENSITIVE_CLAIM');
    requiresVerification = true;
    content += '\n\nThông tin giá/pháp lý chỉ mang tính tham khảo và cần được xác minh từ nguồn chính thức.';
  }
  // Customer replies should be focused even when a provider ignores the
  // requested token budget. Durable specialist artifacts remain separate.
  const maxCustomerReplyLength = output.artifact ? 2600 : 2200;
  if (content.length > maxCustomerReplyLength) {
    flags.push('OUTPUT_TRUNCATED');
    content = content.slice(0, maxCustomerReplyLength - 3).trimEnd() + '...';
  }

  const approvalRequired = HIGH_IMPACT_ACTIONS.has(String(output.suggestedAction || ''));
  if (approvalRequired) flags.push('HIGH_IMPACT_ACTION');
  return {
    safe: true,
    blocked: false,
    escalate: false,
    flags,
    requiresVerification,
    approvalRequired,
    sanitizedContent: content,
  };
}

export function blockedAgentResponse(reason?: string): string {
  return `Mình chưa thể xử lý yêu cầu này tự động. ${reason || 'Vui lòng chờ chuyên viên SGS Land hỗ trợ.'}`;
}