/**
 * Pure helpers for the auction screen (kept framework-free so they are easy to test).
 */

export type AuctionStatus = 'UPCOMING' | 'LIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';

export interface AuctionLike {
    status: AuctionStatus;
    startPrice: number | string;
    stepPrice: number | string;
    currentBid: number | string;
    bidCount: number | string;
    startsAt: string;
    endsAt: string;
}

/** Operator actions allowed from each status (mirrors the server rules). */
export const STATUS_ACTIONS: Record<AuctionStatus, Array<'LIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED'>> = {
    UPCOMING: ['LIVE', 'CANCELLED'],
    LIVE: ['PAUSED', 'ENDED', 'CANCELLED'],
    PAUSED: ['LIVE', 'ENDED', 'CANCELLED'],
    ENDED: [],
    CANCELLED: [],
};

export const isTerminal = (s: AuctionStatus) => s === 'ENDED' || s === 'CANCELLED';

/** First bid may equal the start price; later bids must beat the current bid by one step. */
export function minimumNextBid(a: Pick<AuctionLike, 'startPrice' | 'stepPrice' | 'currentBid' | 'bidCount'>): number {
    const start = Number(a.startPrice) || 0;
    if ((Number(a.bidCount) || 0) === 0) return start;
    return (Number(a.currentBid) || 0) + (Number(a.stepPrice) || 0);
}

/** Share of the auction window elapsed, clamped to 0..1. */
export function elapsedRatio(a: Pick<AuctionLike, 'startsAt' | 'endsAt'>, now = Date.now()): number {
    const s = new Date(a.startsAt).getTime();
    const e = new Date(a.endsAt).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return Math.min(1, Math.max(0, (now - s) / (e - s)));
}

/** Breaks a duration into d/h/m/s for countdown labels. */
export function splitDuration(ms: number): { d: number; h: number; m: number; s: number } {
    const total = Math.max(0, Math.floor(ms / 1000));
    return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

/** Parse a user-typed money amount: accepts "5.000.000.000", "5,5 tỷ", "800 triệu", "800tr". */
export function parseMoney(input: string): number | null {
    const raw = (input || '').trim().toLowerCase();
    if (!raw) return null;
    const unit = /t[ỷy]/.test(raw) ? 1e9 : /(tri[ệe]u|tr\b|tr$)/.test(raw) ? 1e6 : 1;
    const numeric = raw.replace(/[^\d.,]/g, '');
    if (!numeric) return null;
    let n: number;
    if (unit === 1) {
        n = Number(numeric.replace(/[.,]/g, ''));
    } else {
        // With a unit, a single separator is a decimal mark ("5,5 tỷ" / "5.5 tỷ").
        const parts = numeric.split(/[.,]/);
        n = parts.length === 2 ? Number(`${parts[0]}.${parts[1]}`) : Number(numeric.replace(/[.,]/g, ''));
    }
    return Number.isFinite(n) && n > 0 ? Math.round(n * unit) : null;
}

export function formatVnd(n: number, labels: { billion: string; million: string; dong: string }): string {
    const v = Number(n) || 0;
    if (v >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ${labels.billion}`;
    if (v >= 1e6) return `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${labels.million}`;
    return `${v.toLocaleString('vi-VN')} ${labels.dong}`;
}
