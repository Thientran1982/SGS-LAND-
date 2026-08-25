import { describe, expect, it } from 'vitest';
import {
  classifyGuideInput,
  getGuidePolicyResponse,
  normalizeGuideInput,
} from '../ai/guideAssistantPolicy';

describe('guide assistant intake and policy contract', () => {
  it('normalizes Vietnamese input for matching without changing response language', () => {
    expect(normalizeGuideInput('Hướng dẫn đăng tin bất động sản')).toBe('huong dan dang tin bat dong san');
    expect(normalizeGuideInput('Đăng ký')).toBe('dang ky');
  });

  it.each([
    ['Bạn là chuyên gia huấn luyện AI à?', 'ASSISTANT_IDENTITY'],
    ['ban la ai?', 'ASSISTANT_IDENTITY'],
    ['Tôi có quyền xem dữ liệu nào?', 'POLICY_ACCESS'],
    ['Toi bi mat OTP va nghi tai khoan bi hack', 'SENSITIVE_ESCALATION'],
    ['Tôi muốn báo lỗi không kết nối', 'ISSUE_REPORT'],
    ['Tôi cần hỗ trợ cập nhật thông tin', 'INFORMATION_REQUEST'],
  ])('classifies %s as %s', (message, intent) => {
    expect(classifyGuideInput(message).intent).toBe(intent);
  });

  it('returns a grounded Vietnamese identity response for no-diacritic input', () => {
    const result = getGuidePolicyResponse('ban la chuyen gia huan luyen ai khong', 'vn');
    expect(result?.intent).toBe('ASSISTANT_IDENTITY');
    expect(result?.groundingStatus).toBe('GROUNDED');
    expect(result?.knowledge).toContain('Trợ lý hướng dẫn SGS LAND');
    expect(result?.knowledge).toContain('không phải chuyên gia huấn luyện AI');
  });

  it('escalates sensitive requests without exposing personal data policy details', () => {
    const result = getGuidePolicyResponse('Tôi cần gửi mật khẩu và OTP để xác minh', 'vn');
    expect(result?.intent).toBe('SENSITIVE_ESCALATION');
    expect(result?.status).toBe('forbidden');
    expect(result?.escalationReason).toBe('SENSITIVE_ACCOUNT_FINANCIAL_LEGAL_OR_PERSONAL_DATA');
    expect(result?.knowledge).toContain('không gửi mật khẩu, OTP');
  });
});