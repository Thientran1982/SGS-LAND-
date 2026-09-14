/**
 * Intent classification for the live chat engine (P2-2 slice 1).
 * Pure, dependency-free module — extracted from liveChatEngine.ts so the
 * routing brain can evolve without touching the 3k-line runtime. Behavior is
 * pinned by server/test/liveChatIntent.test.ts and
 * server/test/landingBuilderChat.test.ts through the liveChatEngine re-export.
 */

export function normalizeIntentText(message: string): string {
    return String(message || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function isLongFormRequest(message: string): boolean {
    const normalized = normalizeIntentText(message);
    return [
        'chi tiet',
        'phan tich',
        'suy luan',
        'toan dien',
        'tung buoc',
        'so sanh',
        'uu nhuoc diem',
        'danh gia ky',
        'giai thich ky',
        'tra loi dai',
        'noi dung dai',
        'long form',
        'detailed',
        'deep analysis',
        'step by step',
        'compare',
        'audit',
    ].some(marker => normalized.includes(marker));
}

export function hasLandingTargetText(normalized: string): boolean {
    return /\b(?:landing|ladning|lading|landng)(?:\s+(?:page|builder))?\b/.test(normalized)
        || /\b(?:page|trang\s+(?:landing|ladning|lading|landng|dich|gioi thieu))\b/.test(normalized);
}

/**
 * A landing brief commonly contains project and price vocabulary. Those
 * details describe the page and must not win intent classification over an
 * explicit request to create the page.
 */
export function isLandingBuilderRequest(message: string): boolean {
    const normalized = normalizeIntentText(message);
    const hasLandingTarget = hasLandingTargetText(normalized);
    // Include both direct commands ("dùng/tạo landing") and natural
    // intention phrases ("muốn dùng/tạo landing"). The target is still
    // mandatory so a generic "muốn hỏi về dự án" cannot enter the builder.
    const hasCreateAction = /\b(?:dung|su dung|tao|xay|lam|thiet ke|build|create|generate|make|design|craft|launch)\b/.test(normalized)
        || /\b(?:muon|can|want|need|would like)\s+(?:co|a|an|the|mot)\b/.test(normalized);
    return hasLandingTarget && hasCreateAction;
}

export type LiveChatIntentCandidate = {
    intent: string;
    suggestedTool: string;
    query: string;
};

const INTENT_MAP: Array<{ keywords: Array<string | RegExp>; intent: string; suggestedTool: string }> = [
    { keywords: [/gi[aá][^.?!]{0,30}bao\s*nhi[êe]u/i, /bao\s*nhi[êe]u[^.?!]{0,30}gi[aá]/i, 'định giá', 'valuation', 'trị giá', 'bao nhiêu tiền'], intent: 'VALUATION', suggestedTool: 'get_valuation' },
    { keywords: ['tìm', 'search', 'căn hộ', 'nhà', 'đất', 'còn hàng'], intent: 'SEARCH', suggestedTool: 'search_listings' },
    { keywords: ['pháp lý', 'sổ', 'hồng', 'đỏ', 'vi bằng', 'hđmb'], intent: 'LEGAL', suggestedTool: 'legal_qa' },
    { keywords: ['quy hoạch', 'planning', 'xây dựng'], intent: 'PLANNING', suggestedTool: 'check_planning' },
    { keywords: ['vay', 'lãi suất', 'tín dụng', 'ngân hàng'], intent: 'FINANCE', suggestedTool: 'get_platform_knowledge' },
    { keywords: ['dự án', 'project', 'aqua city', 'vinhomes', 'izumi'], intent: 'PROJECT', suggestedTool: 'get_project_info' },
    { keywords: ['long thành', 'sân bay', 'airport'], intent: 'LONGTHANH', suggestedTool: 'get_longthanh_market' },
    { keywords: ['đầu tư', 'cho thuê', 'yield', 'roi', 'lợi nhuận'], intent: 'INVESTMENT', suggestedTool: 'analyze_investment' },
    { keywords: ['landing', 'trang landing', 'landing page'], intent: 'LANDING', suggestedTool: 'landing_builder' },
    { keywords: ['chấm điểm', 'lead', 'tiềm năng', 'score lead'], intent: 'LEAD_SCORING', suggestedTool: 'score_lead' },
];

function classifyFromIntentMap(message: string): { intent: string; suggestedTool: string } {
    const lower = message.toLowerCase();
    for (const { keywords, intent, suggestedTool } of INTENT_MAP) {
        if (keywords.some(keyword => typeof keyword === 'string' ? lower.includes(keyword) : keyword.test(message))) {
            return { intent, suggestedTool };
        }
    }
    return { intent: 'GENERAL', suggestedTool: 'get_platform_knowledge' };
}

export function classifyLiveChatIntent(message: string): { intent: string; suggestedTool: string } {
    const msg = String(message || '').trim();
    if (isLandingBuilderRequest(msg)) {
        return { intent: 'LANDING', suggestedTool: 'landing_builder' };
    }
    return classifyFromIntentMap(msg);
}

/**
 * Return at most three independent workstreams for a compound question.
 * The original message remains the primary query so a clause such as
 * "pháp lý của Aqua City" does not lose its project context.
 */
export function classifyLiveChatIntents(message: string): LiveChatIntentCandidate[] {
    const msg = String(message || '').trim();
    if (!msg) return [];
    if (isLandingBuilderRequest(msg)) {
        return [{ intent: 'LANDING', suggestedTool: 'landing_builder', query: msg }];
    }

    const clauses = msg
        .split(/(?:[?;]|\n+|\s+(?:và|and|ngoài ra|đồng thời|also)\s+)/i)
        .map(clause => clause.trim())
        .filter(Boolean);
    const candidates = [
        { ...classifyLiveChatIntent(msg), query: msg },
        ...clauses.map(query => ({ ...classifyFromIntentMap(query), query })),
    ];
    const usable = candidates.filter(candidate => candidate.intent !== 'GENERAL');
    const unique = new Map<string, LiveChatIntentCandidate>();
    for (const candidate of usable.length > 0 ? usable : candidates) {
        if (!unique.has(candidate.intent)) unique.set(candidate.intent, candidate);
    }
    return Array.from(unique.values()).slice(0, 3);
}
