export type GuideIntent =
  | 'ASSISTANT_IDENTITY'
  | 'PLATFORM_GUIDE'
  | 'POLICY_ACCESS'
  | 'SENSITIVE_ESCALATION'
  | 'INFORMATION_REQUEST'
  | 'ISSUE_REPORT';

export interface GuideIntentResult {
  intent: GuideIntent;
  normalizedQuery: string;
  escalationReason?: string;
}

export interface GuidePolicyResponse {
  intent: GuideIntent;
  knowledge: string;
  source: string;
  groundingStatus: 'GROUNDED' | 'INSUFFICIENT_DATA';
  escalationReason?: string;
  status: 'ok' | 'empty' | 'forbidden';
}

export function normalizeGuideInput(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyGuideInput(message: string): GuideIntentResult {
  const normalizedQuery = normalizeGuideInput(message);

  if (/(la ai|ban la ai|tro ly la ai|vai tro cua ban|gioi thieu ban|chuyen gia huan luyen ai|huan luyen ai|ai coach|ai trainer)/i.test(normalizedQuery)) {
    return { intent: 'ASSISTANT_IDENTITY', normalizedQuery };
  }

  if (/(mat khau|otp|ma xac thuc|token|api key|bi hack|bi xam nhap|lo tai khoan|lua dao|lu a dao|tranh chap|khieu nai|thanh toan|chuyen khoan|the ngan hang|du lieu ca nhan|thong tin ca nhan|xoa du lieu|bao mat tai khoan)/i.test(normalizedQuery)) {
    return {
      intent: 'SENSITIVE_ESCALATION',
      normalizedQuery,
      escalationReason: 'SENSITIVE_ACCOUNT_FINANCIAL_LEGAL_OR_PERSONAL_DATA',
    };
  }

  if (/(quyen|vai tro|phan quyen|duoc phep|khong duoc phep|chinh sach|dieu khoan|privacy|bao mat|compliance|consent|dong y|luu tru du lieu|du lieu cua toi|ai duoc xem)/i.test(normalizedQuery)) {
    return { intent: 'POLICY_ACCESS', normalizedQuery };
  }

  if (/(bao loi|loi|khong hoat dong|khong ket noi|bi treo|bi sai|bug|error|incident|su co|phan hoi|gop y|feedback|bao cao su co|lien he nhan vien)/i.test(normalizedQuery)) {
    return { intent: 'ISSUE_REPORT', normalizedQuery };
  }

  if (/(toi muon|toi can|hay|vui long|yeu cau|dang ky|gui|cung cap|nhan thong tin|cap nhat thong tin|bo sung thong tin|lien he|ho tro)/i.test(normalizedQuery)) {
    return { intent: 'INFORMATION_REQUEST', normalizedQuery };
  }

  return { intent: 'PLATFORM_GUIDE', normalizedQuery };
}

export function getGuidePolicyResponse(
  message: string,
  language: 'vn' | 'en',
): GuidePolicyResponse | null {
  const classification = classifyGuideInput(message);
  const vn = language === 'vn';

  if (classification.intent === 'ASSISTANT_IDENTITY') {
    return {
      intent: classification.intent,
      knowledge: vn
        ? 'Mình là Trợ lý hướng dẫn SGS LAND. Mình hỗ trợ giải thích quy trình đã được xác minh và cung cấp tóm tắt dữ liệu trong phạm vi quyền của tài khoản. Mình không phải chuyên gia huấn luyện AI và không tự suy đoán thông tin về bạn.'
        : 'I am the SGS LAND Guide Assistant. I explain verified workflows and provide limited summaries within your account permissions. I am not an AI training consultant and I do not infer personal information about you.',
      source: 'SGS Land Platform Guide',
      groundingStatus: 'GROUNDED',
      status: 'ok',
    };
  }

  if (classification.intent === 'SENSITIVE_ESCALATION') {
    return {
      intent: classification.intent,
      knowledge: vn
        ? 'Vấn đề này có thể liên quan đến tài khoản, thanh toán, pháp lý hoặc dữ liệu cá nhân. Vui lòng dừng thao tác, không gửi mật khẩu, OTP, token hay thông tin thẻ vào cuộc trò chuyện, và chuyển cho nhân viên SGS LAND xác minh.'
        : 'This may involve an account, payment, legal matter or personal data. Stop the action, do not share passwords, OTPs, tokens or card details in chat, and ask an SGS LAND employee to verify it.',
      source: 'SGS Land Safety and Privacy Policy',
      groundingStatus: 'GROUNDED',
      escalationReason: classification.escalationReason,
      status: 'forbidden',
    };
  }

  if (classification.intent === 'POLICY_ACCESS') {
    return {
      intent: classification.intent,
      knowledge: vn
        ? 'Quyền xem và thao tác trên SGS LAND phụ thuộc vào vai trò, tenant và quyền được cấp cho tài khoản. Trợ lý chỉ cung cấp dữ liệu tổng hợp đã được giới hạn theo quyền; không mở toàn bộ CRM, dữ liệu cá nhân hoặc dữ liệu tenant khác. Nếu bạn cần thay đổi quyền, hãy liên hệ quản trị viên của doanh nghiệp.'
        : 'Viewing and action permissions in SGS LAND depend on your role, tenant and assigned account permissions. The assistant only provides aggregate data limited by those permissions; it does not expose the full CRM, personal data or another tenant’s data. Contact your organization administrator to change access.',
      source: 'SGS Land Access Control Policy',
      groundingStatus: 'GROUNDED',
      status: 'ok',
    };
  }

  if (classification.intent === 'ISSUE_REPORT') {
    return {
      intent: classification.intent,
      knowledge: vn
        ? 'Mình đã ghi nhận đây là yêu cầu phản hồi hoặc báo sự cố, nhưng không tự kết luận nguyên nhân hay trạng thái xử lý. Vui lòng cung cấp tên màn hình, thao tác vừa thực hiện và thông báo lỗi không chứa dữ liệu bí mật; nếu liên quan tài khoản hoặc thanh toán, hãy chuyển trực tiếp cho nhân viên.'
        : 'I recognize this as feedback or an issue report, but I will not infer the cause or resolution status. Provide the screen name, last action and a non-sensitive error message; for account or payment matters, contact an employee directly.',
      source: 'SGS Land Support Intake Policy',
      groundingStatus: 'GROUNDED',
      status: 'ok',
    };
  }

  if (classification.intent === 'INFORMATION_REQUEST') {
    return {
      intent: classification.intent,
      knowledge: vn
        ? 'Mình có thể tiếp nhận yêu cầu và hướng dẫn bước tiếp theo, nhưng không tự tạo, sửa, xóa, gửi hoặc phê duyệt dữ liệu. Bạn hãy nêu rõ mục tiêu, màn hình liên quan và thông tin cần hỗ trợ; không gửi mật khẩu, OTP, token hoặc dữ liệu cá nhân không cần thiết.'
        : 'I can receive your request and explain the next step, but I cannot create, edit, delete, send or approve data. State your goal, relevant screen and needed help; do not share passwords, OTPs, tokens or unnecessary personal data.',
      source: 'SGS Land Guide Assistant Policy',
      groundingStatus: 'GROUNDED',
      status: 'ok',
    };
  }

  return null;
}