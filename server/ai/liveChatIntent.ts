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
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
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

export type LiveChatClarification = {
    reason:
        | 'GREETING'
        | 'UNDERSPECIFIED_PRICE_REQUEST'
        | 'UNDERSPECIFIED_PROPERTY_TYPE'
        | 'UNDERSPECIFIED_PROJECT_OR_LOCATION'
        | 'UNDERSPECIFIED_SEARCH_CRITERIA'
        | 'UNDERSPECIFIED_FINANCE_CONTEXT'
        | 'UNDERSPECIFIED_INTENT';
    response: string;
    missingData: string[];
};

export type LiveChatConversationContext = {
    routingMessage: string;
    contextUsed: boolean;
    previousUserMessage?: string;
};

/**
 * Resolve short follow-up questions against the most recent user turn.
 * The current message remains the authoritative question; the previous turn
 * is only a routing hint for classifier/specialist selection.
 */
export function resolveLiveChatFollowUp(
    message: string,
    history: Array<{ role?: string; content?: unknown }> = [],
): LiveChatConversationContext {
    const current = String(message || '').trim();
    const normalized = normalizeIntentText(current);
    const isShort = normalized.length > 0 && normalized.length <= 120;
    const isTopicOnly = /^(?:gia|price|phap ly|phap luat|quy hoach|tien do|tien ich|mo ban|lai suat|vay|mua|thue|xem|tim)\b/.test(normalized)
        && normalized.split(/\s+/).length <= 5;
    const isFollowUp = isShort && (
        /\b(?:may gio|khi nao|bao gio|luc nao|thoi gian|con|the con|vay con|the thi|cua no|no|nay|do|kia|vay|the)\b/.test(normalized)
        || /^(?:va|v[aậ]y|the|còn|con|vay|thế|bao giờ|khi nào|mấy giờ)\b/.test(current.toLowerCase())
        || isTopicOnly
    );
    if (!isFollowUp) return { routingMessage: current, contextUsed: false };

    const previousUserMessage = [...history]
        .reverse()
        .map(item => ({
            role: String(item?.role || '').toLowerCase(),
            content: typeof item?.content === 'string' ? item.content.trim() : '',
        }))
        .find(item => item.role === 'user' && item.content && item.content !== current)?.content;
    if (!previousUserMessage) return { routingMessage: current, contextUsed: false };

    return {
        routingMessage: `Ngữ cảnh tin nhắn trước của khách: ${previousUserMessage.slice(0, 600)}\nCâu hỏi mới nhất của khách: ${current.slice(0, 300)}`,
        contextUsed: true,
        previousUserMessage,
    };
}

/**
 * Short or underspecified requests are not actionable enough to justify
 * retrieval or an LLM routing pass. Keep this deterministic and conservative:
 * a named project/location is only enough to continue when the requested topic
 * is explicit; a bare entity still needs an intent from the customer.
 */
export function getLiveChatClarification(
    message: string,
    language: 'vi' | 'en' = 'vi',
    previousUserMessage?: string,
): LiveChatClarification | null {
    const currentNormalized = normalizeIntentText(message)
        .replace(/[?!.,;:()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const currentWords = currentNormalized.split(/\s+/).filter(Boolean);
    const isExactTopicFollowUp = /^(?:gia|price|bao gia|gia ban|phap ly|phap luat|quy hoach|tien do|tien ich|mo ban|lai suat|vay|mua|thue|xem|tim)$/.test(currentNormalized);
    const previousNormalized = normalizeIntentText(previousUserMessage || '')
        .replace(/[?!.,;:()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const hasContextualTopic = Boolean(previousNormalized)
        && currentWords.length <= 5
        && /^(?:gia|price|phap ly|phap luat|quy hoach|tien do|tien ich|mo ban|lai suat|vay|mua|thue|xem|tim)\b/.test(currentNormalized);
    const normalized = hasContextualTopic
        ? `${previousNormalized} ${currentNormalized}`
        : currentNormalized;

    const isGreeting = /^(?:xin chao|chao|hello|hi|alo|hey|good morning|good afternoon|good evening)(?: minh| ban| anh chi| em)?$/.test(currentNormalized);
    if (isGreeting) {
        return {
            reason: 'GREETING',
            response: language === 'en'
                ? 'Hello. Would you like to check a project, find a property, or ask about price/legal status?'
                : 'Chào anh/chị. Minh có thể hỗ trợ tra dự án, tìm sản phẩm, kiểm tra giá hoặc pháp lý. Anh/chị muốn bắt đầu từ nội dung nào ạ?',
            missingData: [],
        };
    }

    const hasPriceSignal = /\b(?:bao gia|bang gia|gia ban|xin gia|cho hoi gia|gia bao nhieu|bao nhieu tien|bao nhieu|dinh gia|tri gia|valuation|gia(?!\s+tri\b)|price)\b/.test(normalized);
    const hasLegalSignal = /\b(?:phap ly|phap luat|so hong|so do|vi bang|hdmb|hop dong)\b/.test(normalized);
    const hasPlanningSignal = /\b(?:quy hoach|xay dung|lo gioi)\b/.test(normalized);
    const hasProjectSignal = /\b(?:du an|project|tien do|tien ich|mo ban|chinh sach)\b/.test(normalized);
    const hasSearchSignal = /\b(?:tim|search|can tim|con hang|mua|thue|xem)\b/.test(normalized);
    const hasFinanceSignal = /\b(?:vay|lai suat|tin dung|ngan hang)\b/.test(normalized);
    const hasInvestmentSignal = /\b(?:dau tu|cho thue|yield|roi|loi nhuan)\b/.test(normalized);
    const hasBudgetSignal = /\b\d+(?:[.,]\d+)?\s*(?:ty|trieu|nghin|m|billion|million)\b/.test(normalized);
    const hasTopicSignal = hasPriceSignal || hasLegalSignal || hasPlanningSignal || hasProjectSignal
        || hasSearchSignal || hasFinanceSignal || hasInvestmentSignal;

    const residual = normalized
        .replace(/\b(?:bao gia|bang gia|gia ban|xin gia|cho hoi gia|gia bao nhieu|bao nhieu tien|bao nhieu|dinh gia|tri gia|valuation|gia(?!\s+tri\b)|price|phap ly|phap luat|so hong|so do|vi bang|hdmb|hop dong|quy hoach|xay dung|lo gioi|du an|project|tien do|tien ich|mo ban|chinh sach|tim|search|can tim|con hang|mua|thue|xem|vay|lai suat|tin dung|ngan hang|dau tu|cho thue|yield|roi|loi nhuan)\b/g, ' ')
        .replace(/\b(?:cho|hoi|xin|vui long|giup|toi|em|anh|chi|minh|muon|can ho|nha pho|nha lien ke|biet thu|dat nen|apartment|condo|penthouse|studio|townhouse|shophouse|villa|land|can|the|duoc|nhe|a|oi|san pham|bat dong san|bds|nha|dat|nay|do|kia)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const hasExplicitPropertyType = /\b(?:can ho|apartment|condo|penthouse|studio|nha pho|nha lien ke|townhouse|shophouse|biet thu|villa|lo dat|dat nen|dat thoi|land|dat)\b/.test(normalized)
        || /\b(?:\d+\s*(?:phong ngu|pn)|phong ngu)\b/.test(normalized);
    const hasSpecificSubject = Boolean(residual)
        && !/^(?:bao nhieu|nao|gi|sao|the nao|khong|khong a)$/.test(residual);

    // A named project can contain several product families. Never let the
    // valuation tool or the writer silently default this to APARTMENT.
    if (hasPriceSignal && hasSpecificSubject && !hasExplicitPropertyType) {
        const subject = extractPriceSubject(hasContextualTopic && isExactTopicFollowUp
            ? (previousUserMessage || message)
            : message);
        return {
            reason: 'UNDERSPECIFIED_PROPERTY_TYPE',
            response: language === 'en'
                ? `Are you asking about ${subject || 'this project'} for an apartment, townhouse, or villa? If it is an apartment, please also share the bedroom count or area if you have it.`
                : `Anh/chị đang hỏi giá ${subject ? `dự án ${subject}` : 'dự án này'} cho căn hộ, nhà phố hay biệt thự ạ? Nếu là căn hộ, anh/chị cho Minh thêm số phòng ngủ hoặc diện tích nếu có nhé.`,
            missingData: ['property_type'],
        };
    }

    if (hasPriceSignal && !hasSpecificSubject) {
        return {
            reason: 'UNDERSPECIFIED_PRICE_REQUEST',
            response: language === 'en'
                ? 'Which project or property would you like a price for? Please share the project or location first.'
                : 'Anh/chị muốn hỏi giá dự án hoặc sản phẩm nào? Vui lòng cho Minh tên dự án hoặc khu vực trước nhé.',
            missingData: ['project_or_location'],
        };
    }

    if ((hasLegalSignal || hasPlanningSignal || hasProjectSignal) && !hasSpecificSubject) {
        const topic = hasLegalSignal ? (language === 'en' ? 'legal status' : 'pháp lý')
            : hasPlanningSignal ? (language === 'en' ? 'planning' : 'quy hoạch')
                : (language === 'en' ? 'project information' : 'thông tin dự án');
        return {
            reason: 'UNDERSPECIFIED_PROJECT_OR_LOCATION',
            response: language === 'en'
                ? `Which project or location would you like to ask about ${topic}?`
                : `Anh/chị muốn hỏi ${topic} của dự án hoặc khu vực nào ạ?`,
            missingData: ['project_or_location'],
        };
    }

    if (hasSearchSignal && !hasSpecificSubject) {
        return {
            reason: 'UNDERSPECIFIED_SEARCH_CRITERIA',
            response: language === 'en'
                ? 'Which area should Minh search in? If you know it, please also share your budget.'
                : 'Anh/chị muốn tìm bất động sản ở khu vực nào ạ? Nếu có, cho Minh thêm ngân sách để lọc đúng hơn nhé.',
            missingData: ['location_or_budget'],
        };
    }

    if (hasFinanceSignal && !hasSpecificSubject) {
        return {
            reason: 'UNDERSPECIFIED_FINANCE_CONTEXT',
            response: language === 'en'
                ? 'Are you asking about a mortgage, interest rate, or financing for a specific property?'
                : 'Anh/chị muốn hỏi vay mua nhà, lãi suất hay phương án tài chính cho sản phẩm nào ạ?',
            missingData: ['finance_context'],
        };
    }

    if (hasInvestmentSignal && !hasSpecificSubject) {
        return {
            reason: 'UNDERSPECIFIED_PROJECT_OR_LOCATION',
            response: language === 'en'
                ? 'Which property or project would you like to evaluate for investment?'
                : 'Anh/chị muốn đánh giá đầu tư cho sản phẩm hoặc dự án nào ạ?',
            missingData: ['project_or_location'],
        };
    }

    if (hasBudgetSignal && currentWords.length <= 5) {
        return {
            reason: 'UNDERSPECIFIED_SEARCH_CRITERIA',
            response: language === 'en'
                ? `With a budget of ${String(message).trim()}, which area and property type should Minh search for?`
                : `Với ngân sách ${String(message).trim()}, anh/chị muốn tìm loại bất động sản nào và ở khu vực nào ạ?`,
            missingData: ['property_type', 'project_or_location'],
        };
    }

    // Very short bare entities ("Aqua City", "Masteri", "Long Thành") should
    // not be sent to a provider to guess the user's intent.
    const isShortMessage = currentWords.length <= 4 && currentNormalized.length <= 48;
    if (isShortMessage && !hasTopicSignal && currentWords.length > 0) {
        return {
            reason: 'UNDERSPECIFIED_INTENT',
            response: language === 'en'
                ? `What would you like to know about "${String(message).trim()}" — price, legal status, project details, or available properties?`
                : `Anh/chị muốn biết "${String(message).trim()}" về giá, pháp lý, thông tin dự án hay sản phẩm đang có ạ?`,
            missingData: ['intent'],
        };
    }

    return null;
}

function extractPriceSubject(message: string): string {
    return String(message || '')
        .replace(/(?:báo\s+giá|bảng\s+giá|giá\s+bán|xin\s+giá|cho\s+hỏi\s+giá|giá\s+bao\s+nhiêu|bao\s+nhiêu\s+tiền|giá|price)/giu, ' ')
        .replace(/\b(?:cho|hỏi|xin|vui lòng|giúp|tôi|em|anh|chị|minh|muốn|cần|thế|được|nhé|ạ|ơi|dự án|sản phẩm|bất động sản|bđs)\b/giu, ' ')
        .replace(/\b(?:căn hộ|apartment|condo|penthouse|studio|nhà phố|nhà liền kề|townhouse|shophouse|biệt thự|villa|đất nền|đất thổ cư|land)\b/giu, ' ')
        .replace(/[?!.,;:()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
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
    { keywords: [/gi[aá][^.?!]{0,30}bao\s*nhi[êe]u/i, /bao\s*nhi[êe]u[^.?!]{0,30}gi[aá]/i, /b[aá]o\s*gi[aá]/i, /b[aả]ng\s*gi[aá]/i, /gi[aá]\s*b[aá]n/i, 'định giá', 'valuation', 'trị giá', 'bao nhiêu tiền'], intent: 'VALUATION', suggestedTool: 'get_valuation' },
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
    // Keep short named-project price questions on the fast live-chat path.
    // Without this guard, "giá Masteri" falls through to GENERAL, invokes the
    // legacy router/provider chain, and can spend minutes before asking the
    // missing product-type question.
    const normalized = normalizeIntentText(msg);
    const hasPriceWord = /\b(?:gia(?!\s+tri\b)|price)\b/.test(normalized);
    const hasSearchIntent = /\b(?:tim|search|can tim|con hang|mua|thue)\b/.test(normalized);
    if (hasPriceWord && !hasSearchIntent) {
        return { intent: 'VALUATION', suggestedTool: 'get_valuation' };
    }
    const mapped = classifyFromIntentMap(msg);
    if (mapped.intent !== 'GENERAL') return mapped;
    // Public live-chat chooses between the fast engine and the legacy
    // pipeline before handle_live_chat runs. Keep deterministic short-input
    // clarifications on the fast path so they never pay for an LLM router.
    if (getLiveChatClarification(msg)) {
        return { intent: 'CLARIFY', suggestedTool: 'clarify' };
    }
    return mapped;
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
