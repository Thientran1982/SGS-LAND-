/**
 * Decode the handful of HTML entities that leak into listing titles when content
 * is scraped or pasted from web pages (e.g. `Kim Cương&quot;`). Pure string
 * replacement - never renders HTML.
 */
const NAMED: Record<string, string> = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
};

export const decodeHtmlEntities = (value: unknown): string => {
    const s = String(value ?? '');
    if (!s.includes('&')) return s;
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === '#') {
            const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
        }
        return NAMED[code.toLowerCase()] ?? match;
    });
};
