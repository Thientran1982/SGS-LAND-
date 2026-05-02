/**
 * Commission engine — pure calculator.
 *
 * Mọi hàm trong file này PURE: không gọi Date.now(), không I/O. `now` luôn
 * được truyền qua tham số để test ổn định.
 *
 * 3 loại policy:
 *  - FLAT      : { ratePct }                                   → gross = price * rate%
 *  - TIERED    : { tiers: [{ minUnitsThisMonth, ratePct }] }   → chọn bậc theo unitsThisMonth
 *  - MILESTONE : { ratePct, milestones: [{ key,label,pct,offsetDays }] }
 *                 → gross = price * rate%, chia nhỏ theo % milestone, dueDate = sale + offset
 */

export type PolicyType = 'FLAT' | 'TIERED' | 'MILESTONE';

export interface FlatConfig {
  ratePct: number; // 0..100
}

export interface TierBand {
  minUnitsThisMonth: number; // inclusive
  ratePct: number;
}
export interface TieredConfig {
  tiers: TierBand[]; // sorted ascending by minUnitsThisMonth
}

export interface MilestoneStep {
  key: string;            // unique within policy
  label: string;          // ví dụ "Đặt cọc"
  pct: number;            // % of total commission paid at this step (sum should ≈ 100)
  offsetDays: number;     // days after sale_date when this slice is due
}
export interface MilestoneConfig {
  ratePct: number;
  milestones: MilestoneStep[];
}

export type PolicyConfig = FlatConfig | TieredConfig | MilestoneConfig;

export interface CommissionPolicy {
  id: string;
  type: PolicyType;
  version: number;
  config: PolicyConfig;
}

export interface ListingForCommission {
  id: string;
  price: number | string | null | undefined;
}

export interface CommissionContext {
  /** Số căn đã SOLD trong tháng của partner/sales (TIERED) — caller tự đếm. */
  unitsThisMonth?: number;
}

export interface MilestoneEntry {
  key: string;
  label: string;
  pct: number;
  amount: number;
  dueDate: string; // ISO
  status: 'PENDING' | 'PAID';
}

export interface CalculatedCommission {
  ratePct: number;
  grossAmount: number;
  milestones: MilestoneEntry[];
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function clampPct(v: number): number {
  if (!isFinite(v) || v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function pickTierRate(cfg: TieredConfig, unitsThisMonth: number): number {
  if (!cfg.tiers || cfg.tiers.length === 0) return 0;
  const sorted = [...cfg.tiers].sort((a, b) => a.minUnitsThisMonth - b.minUnitsThisMonth);
  let rate = sorted[0]?.ratePct ?? 0;
  for (const t of sorted) {
    if (unitsThisMonth >= t.minUnitsThisMonth) rate = t.ratePct;
    else break;
  }
  return clampPct(rate);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString();
}

/**
 * PURE: tính hoa hồng. `now` truyền vào dưới dạng ISO string (sale_date).
 */
export function calculateCommission(
  listing: ListingForCommission,
  policy: CommissionPolicy,
  ctx: CommissionContext,
  saleDateIso: string,
): CalculatedCommission {
  const price = toNumber(listing.price);

  if (policy.type === 'FLAT') {
    const cfg = policy.config as FlatConfig;
    const ratePct = clampPct(toNumber(cfg.ratePct));
    const gross = Math.round((price * ratePct) / 100);
    return { ratePct, grossAmount: gross, milestones: [] };
  }

  if (policy.type === 'TIERED') {
    const cfg = policy.config as TieredConfig;
    const ratePct = pickTierRate(cfg, Math.max(0, Math.floor(toNumber(ctx.unitsThisMonth ?? 0))));
    const gross = Math.round((price * ratePct) / 100);
    return { ratePct, grossAmount: gross, milestones: [] };
  }

  if (policy.type === 'MILESTONE') {
    const cfg = policy.config as MilestoneConfig;
    const ratePct = clampPct(toNumber(cfg.ratePct));
    const gross = Math.round((price * ratePct) / 100);
    const steps = (cfg.milestones || []).filter(s => s && s.key);
    const milestones: MilestoneEntry[] = steps.map(s => {
      const pct = clampPct(toNumber(s.pct));
      return {
        key: String(s.key),
        label: String(s.label || s.key),
        pct,
        amount: Math.round((gross * pct) / 100),
        dueDate: addDays(saleDateIso, toNumber(s.offsetDays)),
        status: 'PENDING',
      };
    });
    return { ratePct, grossAmount: gross, milestones };
  }

  return { ratePct: 0, grossAmount: 0, milestones: [] };
}

/**
 * Validate policy config trước khi insert. Trả về null nếu OK, hoặc message lỗi.
 */
export function validatePolicyConfig(type: PolicyType, config: any): string | null {
  if (!config || typeof config !== 'object') return 'config phải là object';
  if (type === 'FLAT') {
    const r = Number(config.ratePct);
    if (!isFinite(r) || r <= 0 || r > 100) return 'ratePct phải nằm trong (0, 100]';
    return null;
  }
  if (type === 'TIERED') {
    if (!Array.isArray(config.tiers) || config.tiers.length === 0) return 'tiers rỗng';
    for (const t of config.tiers) {
      if (!t || typeof t !== 'object') return 'tier không hợp lệ';
      const m = Number(t.minUnitsThisMonth);
      const r = Number(t.ratePct);
      if (!isFinite(m) || m < 0) return 'minUnitsThisMonth phải >= 0';
      if (!isFinite(r) || r <= 0 || r > 100) return 'tier.ratePct phải trong (0, 100]';
    }
    return null;
  }
  if (type === 'MILESTONE') {
    const r = Number(config.ratePct);
    if (!isFinite(r) || r <= 0 || r > 100) return 'ratePct phải trong (0, 100]';
    if (!Array.isArray(config.milestones) || config.milestones.length === 0) return 'milestones rỗng';
    let sumPct = 0;
    const keys = new Set<string>();
    for (const s of config.milestones) {
      if (!s || typeof s !== 'object') return 'milestone không hợp lệ';
      const key = String(s.key || '').trim();
      if (!key) return 'milestone.key bắt buộc';
      if (keys.has(key)) return `milestone.key trùng: ${key}`;
      keys.add(key);
      const p = Number(s.pct);
      const o = Number(s.offsetDays);
      if (!isFinite(p) || p <= 0 || p > 100) return `milestone.${key}.pct phải trong (0, 100]`;
      if (!isFinite(o) || o < 0) return `milestone.${key}.offsetDays phải >= 0`;
      sumPct += p;
    }
    if (Math.abs(sumPct - 100) > 0.5) return `Tổng pct của milestones phải = 100 (hiện ${sumPct})`;
    return null;
  }
  return 'type không hợp lệ';
}
