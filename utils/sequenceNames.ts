/**
 * Returns `base`, or `base (2)`, `base (3)`… so a new campaign never repeats a
 * name that already exists (compared trimmed and case-insensitively, the same
 * way the server's unique index does).
 */
export function uniqueSequenceName(base: string, taken: Array<string | null | undefined>): string {
    const key = (s: string) => s.trim().toLowerCase();
    const used = new Set(taken.filter((s): s is string => typeof s === 'string').map(key));
    const clean = base.trim();
    if (!used.has(key(clean))) return clean;
    for (let i = 2; i < 1000; i++) {
        const candidate = `${clean} (${i})`;
        if (!used.has(key(candidate))) return candidate;
    }
    return `${clean} ${Date.now()}`;
}
