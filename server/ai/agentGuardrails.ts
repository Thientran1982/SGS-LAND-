export type GuardrailFlag =
  | 'PROMPT_INJECTION'
  | 'SECRET_EXPOSURE'
  | 'EMPTY_OUTPUT'
  | 'UNSUPPORTED_SENSITIVE_CLAIM'
  | 'HIGH_IMPACT_ACTION'
  | 'OUTPUT_TRUNCATED';

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

  let requiresVerification = false;
  const hasExplicitSources = Array.isArray(output.sources) && output.sources.length > 0;
  if (SENSITIVE_CLAIM_PATTERN.test(content) && !hasExplicitSources && !SOURCE_PATTERN.test(content)) {
    flags.push('UNSUPPORTED_SENSITIVE_CLAIM');
    requiresVerification = true;
    content += '\n\nThông tin giá/pháp lý chỉ mang tính tham khảo và cần được xác minh từ nguồn chính thức.';
  }
  if (content.length > 4000) {
    flags.push('OUTPUT_TRUNCATED');
    content = content.slice(0, 3997) + '...';
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