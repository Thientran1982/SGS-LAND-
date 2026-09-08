const LANDING_URL_PATTERN =
  /(?:https?:\/\/[^\s<]+)?\/(?:landing\/|landing-ai\/chinh-sua\/)[^\s<]+/g;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]}]+$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLandingLink(rawUrl: string): string {
  const trailingMatch = rawUrl.match(TRAILING_PUNCTUATION_PATTERN);
  const trailing = trailingMatch?.[0] || "";
  const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

  return (
    `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
    `data-chat-landing-link="true" ` +
    `style="text-decoration: underline; text-underline-offset: 2px; font-weight: 600;">` +
    `${url}</a>${trailing}`
  );
}

/**
 * Render Minh's plain-text response while keeping generated landing URLs usable.
 * Only landing and draft-landing paths are linkified; arbitrary response HTML
 * remains escaped.
 */
export function renderChatContent(text: string): string {
  const escaped = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  return escaped.replace(LANDING_URL_PATTERN, renderLandingLink);
}