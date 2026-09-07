type LandingSpecialistOutput = {
  status?: unknown;
  slug?: unknown;
} | null | undefined;

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