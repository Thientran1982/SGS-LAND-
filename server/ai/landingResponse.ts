type LandingSpecialistOutput = {
  primary?: LandingSpecialistOutput;
  status?: unknown;
  slug?: unknown;
  projectName?: unknown;
  viewUrl?: unknown;
  editUrl?: unknown;
  paywall?: {
    message?: unknown;
    upgradeUrl?: unknown;
  };
} | null | undefined;

/**
 * Landing creation is a structured operation, not a conversational answer.
 * Build the acknowledgement from the tool result so a slow/unavailable text
 * provider cannot turn a successfully-created draft into a chat failure.
 */
export function buildLandingBuilderResponse(
  specialistOutput: LandingSpecialistOutput,
  language: 'vi' | 'en' = 'vi',
): string {
  const output = specialistOutput?.primary && typeof specialistOutput.primary === 'object'
    ? specialistOutput.primary as LandingSpecialistOutput
    : specialistOutput;
  const status = String(output?.status || '').toUpperCase();

  if (status === 'CREATED' && output?.slug) {
    const projectName = String(output.projectName || '').trim();
    const viewUrl = String(output.viewUrl || `/landing/${encodeURIComponent(String(output.slug))}`).trim();
    const editUrl = String(output.editUrl || '').trim();
    if (language === 'en') {
      return [
        `Your landing page${projectName ? ` for ${projectName}` : ''} is ready.`,
        `View: ${viewUrl}`,
        editUrl ? `Edit draft: ${editUrl}` : '',
      ].filter(Boolean).join('\n');
    }
    return [
      `Đã tạo xong trang landing${projectName ? ` cho ${projectName}` : ''}.`,
      `Xem trang: ${viewUrl}`,
      editUrl ? `Chỉnh sửa bản nháp: ${editUrl}` : '',
    ].filter(Boolean).join('\n');
  }

  if (status === 'PAYWALL') {
    const message = String(output?.paywall?.message || '').trim();
    const upgradeUrl = String(output?.paywall?.upgradeUrl || '').trim();
    return [
      message || (language === 'en'
        ? 'Your free landing-page quota has been used.'
        : 'Bạn đã dùng hết lượt tạo landing miễn phí.'),
      upgradeUrl ? `${language === 'en' ? 'Upgrade' : 'Nâng cấp'}: ${upgradeUrl}` : '',
    ].filter(Boolean).join('\n');
  }

  return language === 'en'
    ? 'I could not create the landing page automatically. Please try again shortly.'
    : 'Mình chưa thể tạo trang landing tự động lúc này. Vui lòng thử lại sau ít phút.';
}

/**
 * Keep the public landing URL in the answer after the synthesis step.
 *
 * The synthesis model may summarize a successful landing_builder result
 * without copying its URL. This small, pure boundary makes that user-facing
 * contract easy to test without invoking a provider or a database.
 */
export function ensureLandingResponseLink(
  response: string,
  intent: string,
  specialistOutput: LandingSpecialistOutput,
): string {
  const slug = specialistOutput?.slug;
  if (
    intent !== 'LANDING' ||
    specialistOutput?.status !== 'CREATED' ||
    !slug
  ) {
    return response;
  }

  const landingPath = `/landing/${encodeURIComponent(String(slug))}`;
  if (response.includes(landingPath)) return response;
  return `${response.trim()}\n\nXem trang landing: ${landingPath}`;
}