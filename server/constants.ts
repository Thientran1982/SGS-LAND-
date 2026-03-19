export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// --- Valuation engine defaults (can be overridden per request) ---
export const DEFAULT_VACANCY_RATE = 0.08;   // 8% vacancy
export const DEFAULT_OPEX_RATE = 0.20;      // 20% of gross income as operating expenses
export const DEFAULT_CAP_RATE = 0.05;       // 5% fallback cap rate (guard against zero/undefined)
export const DEFAULT_LOAN_RATE = 0.10;      // 10% annual loan interest rate
export const DEFAULT_COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.02');

// --- Session ---
export const SESSION_DURATION_HOURS = 24;
export const SESSION_TIMEOUT_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;
