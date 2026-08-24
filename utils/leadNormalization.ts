/**
 * Normalize lead contact and tag values before duplicate checks or persistence.
 * Keep the display value untouched while the user is typing; apply on blur/save.
 */
export const normalizeVNPhone = (raw: string): string => {
    let phone = String(raw ?? '').replace(/\D/g, '');

    if (phone.startsWith('84') && phone.length === 11) {
        phone = `0${phone.slice(2)}`;
    } else if (!phone.startsWith('0') && phone.length === 9) {
        phone = `0${phone}`;
    }

    return phone;
};

export const normalizeLeadEmail = (raw: string): string =>
    String(raw ?? '').trim().toLowerCase();

export const normalizeLeadTags = (raw: string | string[] | undefined): string[] => {
    const values = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,\n;]+/);
    const seen = new Set<string>();

    return values
        .map(tag => String(tag).trim())
        .filter(Boolean)
        .filter(tag => {
            const key = tag.toLocaleLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

export const formatLeadTagsInput = (raw: string): string =>
    normalizeLeadTags(raw).join(', ');