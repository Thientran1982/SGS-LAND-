
const TRANSLATABLE_PREFIXES = ['ai.', 'inbox.', 'livechat.', 'common.', 'auth.'];
const I18N_KEY_RE = /^[a-z_]+\.[a-z_.]+$/;

/**
 * Translate raw i18n keys that were persisted to the database before server-side
 * translation was in place (e.g. "ai.msg_system_busy" stored literally).
 * Only applies when the entire content exactly matches a known namespace key pattern.
 */
export function resolveContent(content: string, t: (k: string) => string): string {
    if (!content) return content;
    if (TRANSLATABLE_PREFIXES.some(p => content.startsWith(p)) && I18N_KEY_RE.test(content)) {
        const translated = t(content);
        if (translated !== content) return translated;
    }
    return content;
}
