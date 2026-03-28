/**
 * Utility to detect and handle Gemini API quota / rate-limit errors gracefully.
 * Returns structured, user-friendly Vietnamese messages instead of raw API errors.
 */

export interface AiErrorResult {
  isQuotaError: boolean;
  isAuthError: boolean;
  userMessage: string;
  httpStatus: number;
}

export function parseAiError(error: unknown): AiErrorResult {
  const msg = error instanceof Error ? error.message : String(error);

  const isQuota =
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate') ||
    msg.includes('429');

  const isAuth =
    msg.includes('API key not valid') ||
    msg.includes('INVALID_ARGUMENT') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('401');

  if (isQuota) {
    return {
      isQuotaError: true,
      isAuthError: false,
      userMessage:
        'Hệ thống AI đang bận do lượng truy cập cao. Vui lòng thử lại sau ít phút.',
      httpStatus: 429,
    };
  }

  if (isAuth) {
    return {
      isQuotaError: false,
      isAuthError: true,
      userMessage:
        'Cấu hình AI chưa hợp lệ. Vui lòng kiểm tra lại API key trong phần cài đặt hệ thống.',
      httpStatus: 503,
    };
  }

  return {
    isQuotaError: false,
    isAuthError: false,
    userMessage: 'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
    httpStatus: 503,
  };
}

/** Send a standardised AI error JSON response */
export function sendAiError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  error: unknown,
  context: string
): void {
  const parsed = parseAiError(error);
  console.error(`[AI Error][${context}]`, error);
  res.status(parsed.httpStatus).json({
    error: parsed.userMessage,
    code: parsed.isQuotaError
      ? 'AI_QUOTA_EXCEEDED'
      : parsed.isAuthError
      ? 'AI_AUTH_ERROR'
      : 'AI_UNAVAILABLE',
  });
}
