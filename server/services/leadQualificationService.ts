export type LeadQualificationStatus = 'QUALIFIED' | 'NURTURE' | 'NEEDS_INFO';

export type LeadQualificationMessage = {
  role?: string;
  content?: string;
  ts?: string | number;
};

export type LeadScoreInput = {
  budget?: number;
  timeline?: string;
  area?: string;
  source?: string;
  interactions?: number;
  hasPhone?: boolean;
  hasEmail?: boolean;
  viewedListings?: number;
  askedLegal?: boolean;
  askedValuation?: boolean;
  bookedViewing?: boolean;
  isReturning?: boolean;
  justSoldProperty?: boolean;
};

export type LeadScoreResult = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  priority: string;
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  topFactors: Array<{ factor: string; points: number; max: number }>;
};

export type LeadQualificationResult = LeadScoreResult & {
  status: LeadQualificationStatus;
  buyingSignals: string[];
  missingData: string[];
  nextBestAction: {
    channel: 'Zalo' | 'Call' | 'Email' | 'Gặp mặt';
    action: string;
    reason: string;
  };
  captured: {
    budget: number | null;
    timeline: string | null;
    area: string | null;
    hasPhone: boolean;
    hasEmail: boolean;
  };
};

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 1200) : '';
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseBudget(text: string): number | undefined {
  const normalized = normalize(text).replace(/\s+/g, ' ');
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ty|ti|trieu|tr|tyr|ty dong|tỷ|tỷ)/i);
  if (!match) return undefined;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) return undefined;
  if (/trieu|tr\b/.test(match[2])) return Math.round(amount * 1_000_000);
  return Math.round(amount * 1_000_000_000);
}

function parseTimeline(text: string): string | undefined {
  const normalized = normalize(text);
  if (/(gap|ngay|hom nay|tuan nay|urgent|kh[aâ]n)/i.test(normalized)) return 'URGENT';
  if (/(1 thang|1m|mot thang)/i.test(normalized)) return '1M';
  if (/(3 thang|3m|quy nay)/i.test(normalized)) return '3M';
  if (/(6 thang|6m)/i.test(normalized)) return '6M';
  if (/(12 thang|1 nam|12m|nam sau)/i.test(normalized)) return '12M';
  if (/(tham khao|chua biet|dang xem|exploring)/i.test(normalized)) return 'EXPLORING';
  return undefined;
}

function parseArea(text: string): string | undefined {
  const knownAreas = [
    'Thủ Thiêm', 'Thủ Đức', 'Quận 1', 'Quận 7', 'Bình Dương',
    'Đồng Nai', 'Long Thành', 'Long An', 'Hà Nội', 'TP.HCM',
  ];
  const found = knownAreas.find(area => normalize(text).includes(normalize(area)));
  return found;
}

function hasPhone(text: string): boolean {
  return /(?:^|\D)(?:0|\+84)\d[\d .-]{8,12}\d(?:\D|$)/.test(text);
}

function hasEmail(text: string): boolean {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
}

export function scoreLeadDeterministically(input: LeadScoreInput): LeadScoreResult {
  const {
    budget = 0, timeline = 'EXPLORING', area = '', source = 'UNKNOWN',
    interactions = 0, hasPhone: phone = false, hasEmail: email = false,
    viewedListings = 0, askedLegal = false, askedValuation = false,
    bookedViewing = false, isReturning = false, justSoldProperty = false,
  } = input;

  const b = Number(budget);
  const budgetPts = b >= 10e9 ? 25 : b >= 5e9 ? 20 : b >= 2e9 ? 15 : b > 0 ? 8 : 5;
  const timelinePts = ({ URGENT: 20, '1M': 20, '3M': 16, '6M': 12, '12M': 8, EXPLORING: 3 } as Record<string, number>)[timeline] ?? 5;
  const normalizedArea = normalize(area);
  const areaPts = normalizedArea.includes('quan 1') || normalizedArea.includes('thu thiem') || normalizedArea.includes('sala')
    ? 20
    : normalizedArea.includes('thu duc') || normalizedArea.includes('quan 7') || normalizedArea.includes('long thanh')
      ? 15
      : normalizedArea.includes('binh duong') || normalizedArea.includes('dong nai')
        ? 10
        : area ? 8 : 5;

  let engagementPts = 0;
  if (viewedListings >= 5) engagementPts += 6;
  else if (viewedListings >= 2) engagementPts += 3;
  if (askedLegal) engagementPts += 4;
  if (askedValuation) engagementPts += 3;
  if (interactions >= 10) engagementPts += 2;
  engagementPts = Math.min(15, engagementPts);

  const sourcePts = ({ REFERRAL: 10, WEBSITE: 8, ZALO: 6, FACEBOOK: 4 } as Record<string, number>)[String(source).toUpperCase()] ?? 3;
  let score = budgetPts + timelinePts + areaPts + engagementPts + sourcePts;
  if (askedLegal && askedValuation) score += 5;
  if (bookedViewing) score += 5;
  if (justSoldProperty) score += 5;
  if (isReturning) score += 3;
  if (phone) score += 2;
  score = Math.min(100, score);

  const grade = score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';
  const priority = grade === 'A' ? 'HOT — xử lý trong 2h'
    : grade === 'B' ? 'WARM — xử lý trong 24h'
      : grade === 'C' ? 'COOL — xử lý trong 48h' : 'COLD — nurture 2 tuần/lần';
  const churnRisk = score >= 70 && interactions < 3 ? 'HIGH' : score < 40 ? 'LOW' : 'MEDIUM';
  const topFactors = [
    { factor: 'Ngân sách', points: budgetPts, max: 25 },
    { factor: 'Timeline', points: timelinePts, max: 20 },
    { factor: 'Khu vực', points: areaPts, max: 20 },
    { factor: 'Tương tác', points: engagementPts, max: 15 },
    { factor: 'Nguồn', points: sourcePts, max: 10 },
  ].sort((a, b) => b.points - a.points).slice(0, 3);
  return { score, grade, priority, churnRisk, topFactors };
}

export function qualifyLeadConversation(params: {
  messages: LeadQualificationMessage[];
  source?: string;
  context?: Partial<LeadScoreInput>;
}): LeadQualificationResult {
  const messages = params.messages.filter(message => textOf(message.content)).slice(-20);
  const customerMessages = messages.filter(message => !['assistant', 'agent', 'system'].includes(String(message.role || '').toLowerCase()));
  const text = customerMessages.map(message => textOf(message.content)).join('\n').slice(-10_000);
  const context = params.context || {};
  const budget = context.budget ?? parseBudget(text);
  const timeline = context.timeline ?? parseTimeline(text);
  const area = context.area ?? parseArea(text);
  const phone = Boolean(context.hasPhone || hasPhone(text));
  const email = Boolean(context.hasEmail || hasEmail(text));
  const normalized = normalize(text);
  const askedLegal = Boolean(context.askedLegal || /(phap ly|so hong|giay to|quy hoach)/.test(normalized));
  const askedValuation = Boolean(context.askedValuation || /(dinh gia|gia thi truong|gia bao nhieu|m2)/.test(normalized));
  const bookedViewing = Boolean(context.bookedViewing || /(xem nha|di xem|dat lich|hen xem)/.test(normalized));
  const viewedListings = Number(context.viewedListings || 0);
  const score = scoreLeadDeterministically({
    ...context,
    budget,
    timeline,
    area,
    source: params.source || context.source || 'AI_CHAT',
    interactions: customerMessages.length,
    hasPhone: phone,
    hasEmail: email,
    askedLegal,
    askedValuation,
    bookedViewing,
    viewedListings,
  });
  const missingData = [
    budget === undefined ? 'budget' : null,
    timeline === undefined ? 'timeline' : null,
    area === undefined ? 'area' : null,
    !phone && !email ? 'contact' : null,
  ].filter((item): item is string => Boolean(item));
  const status: LeadQualificationStatus = score.score >= 70
    ? 'QUALIFIED'
    : missingData.length >= 3 || score.score < 40 ? 'NEEDS_INFO' : 'NURTURE';
  const nextBestAction = score.score >= 70
    ? { channel: phone ? 'Call' as const : 'Zalo' as const, action: 'Chuyển hồ sơ cho môi giới phụ trách và xác nhận nhu cầu cụ thể.', reason: 'Lead có tín hiệu mua và mức độ ưu tiên cao.' }
    : missingData.length > 0
      ? { channel: 'Zalo' as const, action: `Hỏi bổ sung: ${missingData.join(', ')}.`, reason: 'Chưa đủ dữ liệu để định tuyến chính xác.' }
      : { channel: 'Zalo' as const, action: 'Gửi thông tin phù hợp và theo dõi phản hồi trong chu kỳ nurture.', reason: 'Lead chưa sẵn sàng cho cuộc gọi ngay.' };

  const buyingSignals = [
    budget !== undefined ? 'Đã nêu ngân sách' : null,
    timeline && timeline !== 'EXPLORING' ? `Có timeline ${timeline}` : null,
    bookedViewing ? 'Đã thể hiện ý định xem nhà' : null,
    askedLegal ? 'Quan tâm pháp lý' : null,
    askedValuation ? 'Quan tâm định giá' : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 5);
  return {
    ...score,
    status,
    buyingSignals,
    missingData,
    nextBestAction,
    captured: { budget: budget ?? null, timeline: timeline ?? null, area: area ?? null, hasPhone: phone, hasEmail: email },
  };
}