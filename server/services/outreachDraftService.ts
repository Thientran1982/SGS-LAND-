export type OutreachQualificationStatus = 'QUALIFIED' | 'NURTURE' | 'NEEDS_INFO';
export type OutreachChannel = 'ZALO' | 'EMAIL' | 'CALL_SCRIPT';

export interface OutreachDraftInput {
  leadId: string;
  leadName?: string | null;
  brokerAssigned?: string | null;
  qualification: {
    status: OutreachQualificationStatus;
    score?: number | null;
    buyingSignals?: string[];
    missingData?: string[];
    nextBestAction?: string | null;
  };
  projectContext?: {
    name?: string | null;
    facts?: string[];
    location?: string | null;
    url?: string | null;
  };
  interactionHistory?: Array<{
    direction?: string | null;
    channel?: string | null;
    content?: string | null;
    timestamp?: string | Date | null;
  }>;
  consent: {
    valid: boolean;
    channels?: readonly OutreachChannel[];
    source?: string | null;
    capturedAt?: string | Date | null;
  };
  requestedChannels?: OutreachChannel[];
}

export interface OutreachDraftVariant {
  id: string;
  approach: 'VALUE_FIRST' | 'CLARIFY_NEED';
  channel: OutreachChannel;
  subject?: string;
  message: string;
  groundedIn: string[];
}

export interface OutreachDraftResult {
  status: 'DRAFT' | 'BLOCKED';
  leadId: string;
  brokerAssigned: string | null;
  qualificationStatus: OutreachQualificationStatus;
  draftVariants: OutreachDraftVariant[];
  requiresBrokerApproval: true;
  providerCalled: false;
  blockedReasons: string[];
}

const DEFAULT_CHANNELS: OutreachChannel[] = ['EMAIL', 'CALL_SCRIPT'];

function clean(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value: unknown, maxItems = 8, maxItemLength = 180): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => clean(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function uniqueChannels(value: unknown): OutreachChannel[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((channel): channel is OutreachChannel =>
    channel === 'ZALO' || channel === 'EMAIL' || channel === 'CALL_SCRIPT',
  ))];
}

function displayName(value: unknown): string {
  return clean(value, 100) || 'anh/chị';
}

function projectLabel(input: OutreachDraftInput): string {
  return clean(input.projectContext?.name, 160) || 'dự án anh/chị đang quan tâm';
}

function firstFact(input: OutreachDraftInput): string {
  return cleanList(input.projectContext?.facts, 1, 180)[0] || '';
}

function buildValueFirstMessage(input: OutreachDraftInput, channel: OutreachChannel): string {
  const name = displayName(input.leadName);
  const project = projectLabel(input);
  const fact = firstFact(input);
  const factSentence = fact ? ` Em có thể gửi thêm thông tin đã xác minh về ${fact.toLowerCase()}.` : '';
  const closing = input.brokerAssigned
    ? ` Broker phụ trách sẽ tiếp tục hỗ trợ anh/chị sau khi duyệt nội dung.`
    : ' Một broker sẽ tiếp tục hỗ trợ anh/chị sau khi duyệt nội dung.';

  if (channel === 'CALL_SCRIPT') {
    return `Mở đầu cuộc gọi với ${name}: xác nhận anh/chị vẫn quan tâm ${project}, ` +
      `nhắc lại nhu cầu đã trao đổi và hỏi thời điểm thuận tiện để tư vấn tiếp.${factSentence}${closing}`;
  }
  if (channel === 'ZALO') {
    return `Chào ${name}, em gửi anh/chị thông tin tiếp theo về ${project} theo nhu cầu mình đã trao đổi.${factSentence} ` +
      `Anh/chị muốn em ưu tiên gửi thông tin tổng quan hay sắp xếp broker tư vấn thêm?`;
  }
  return `Chào ${name}, em gửi anh/chị thông tin tiếp theo về ${project} theo nhu cầu mình đã trao đổi.${factSentence} ` +
    `Anh/chị muốn em ưu tiên nhận thông tin tổng quan hay sắp xếp broker tư vấn thêm?`;
}

function buildClarifyNeedMessage(input: OutreachDraftInput, channel: OutreachChannel): string {
  const name = displayName(input.leadName);
  const project = projectLabel(input);
  const missing = cleanList(input.qualification.missingData, 2, 100);
  const question = missing.length
    ? `Để tư vấn đúng hơn, anh/chị có thể chia sẻ thêm ${missing.join(' và ')} không?`
    : 'Anh/chị đang ưu tiên nhu cầu nào để broker chuẩn bị thông tin phù hợp?';

  if (channel === 'CALL_SCRIPT') {
    return `Kịch bản gọi cho ${name}: hỏi lại nhu cầu hiện tại liên quan đến ${project}. ${question} ` +
      'Không nêu giá, pháp lý hoặc cam kết nếu chưa có dữ liệu đã xác minh.';
  }
  return `Chào ${name}, để broker tư vấn đúng về ${project}, ${question} ` +
    'Em sẽ chỉ gửi thông tin đã được xác minh và không tự đưa ra cam kết.';
}

function buildVariant(
  input: OutreachDraftInput,
  approach: OutreachDraftVariant['approach'],
  channel: OutreachChannel,
): OutreachDraftVariant {
  const project = projectLabel(input);
  const groundedIn = [
    'lead_qualification',
    ...(input.projectContext?.name ? ['project_context'] : []),
    ...(input.interactionHistory?.length ? ['interaction_history'] : []),
  ];
  return {
    id: `${approach.toLowerCase()}-${channel.toLowerCase()}`,
    approach,
    channel,
    ...(channel === 'EMAIL' ? { subject: `Thông tin tiếp theo về ${project}` } : {}),
    message: approach === 'VALUE_FIRST'
      ? buildValueFirstMessage(input, channel)
      : buildClarifyNeedMessage(input, channel),
    groundedIn,
  };
}

/**
 * Week 8 contract: create drafts only. This function has no provider imports
 * and deliberately returns providerCalled=false so it cannot send anything.
 */
export function createOutreachDraft(input: OutreachDraftInput): OutreachDraftResult {
  const status = input.qualification?.status;
  const blockedReasons: string[] = [];
  if (!input.leadId?.trim()) blockedReasons.push('lead_id_required');
  if (!['QUALIFIED', 'NURTURE', 'NEEDS_INFO'].includes(status)) blockedReasons.push('qualification_required');
  if (status === 'NEEDS_INFO') blockedReasons.push('qualification_needs_more_information');
  if (input.consent?.valid !== true) blockedReasons.push('missing_or_expired_consent');

  const consentChannels = uniqueChannels(input.consent?.channels);
  const requested = uniqueChannels(input.requestedChannels);
  const channels = (requested.length ? requested : (consentChannels.length ? consentChannels : DEFAULT_CHANNELS))
    .filter(channel => !consentChannels.length || consentChannels.includes(channel));
  if (!channels.length) blockedReasons.push('no_consented_outreach_channel');

  if (blockedReasons.length > 0) {
    return {
      status: 'BLOCKED',
      leadId: clean(input.leadId, 120),
      brokerAssigned: clean(input.brokerAssigned, 120) || null,
      qualificationStatus: status || 'NEEDS_INFO',
      draftVariants: [],
      requiresBrokerApproval: true,
      providerCalled: false,
      blockedReasons: [...new Set(blockedReasons)],
    };
  }

  const primaryApproach: OutreachDraftVariant['approach'] =
    status === 'QUALIFIED' ? 'VALUE_FIRST' : 'CLARIFY_NEED';
  const secondaryApproach: OutreachDraftVariant['approach'] =
    primaryApproach === 'VALUE_FIRST' ? 'CLARIFY_NEED' : 'VALUE_FIRST';
  const selectedChannels = channels.slice(0, 2);
  const draftVariants = selectedChannels.map((channel, index) =>
    buildVariant(input, index === 0 ? primaryApproach : secondaryApproach, channel),
  );

  return {
    status: 'DRAFT',
    leadId: clean(input.leadId, 120),
    brokerAssigned: clean(input.brokerAssigned, 120) || null,
    qualificationStatus: status,
    draftVariants,
    requiresBrokerApproval: true,
    providerCalled: false,
    blockedReasons: [],
  };
}