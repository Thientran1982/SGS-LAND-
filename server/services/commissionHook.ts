/**
 * Commission lifecycle hooks — fired on listing status transitions.
 *
 * Forward hook  (→ SOLD):     generateLedgerOnSold
 *   - Auto-generates a commission_ledger entry via the commission engine.
 *   - Idempotent: INSERT … ON CONFLICT (listing_id) DO NOTHING.
 *
 * Reverse hook  (SOLD →  *):  voidLedgerOnReverted
 *   - Cancels the ledger entry when a listing is un-SOLD.
 *   - Only voids PENDING / DUE entries; never touches PAID (already disbursed).
 *
 * Both hooks are best-effort: errors do NOT fail the status-update request.
 */
import { commissionPolicyRepository, commissionLedgerRepository } from '../repositories/commissionRepository';
import { calculateCommission, type PolicyType, type PolicyConfig } from './commissionEngine';
import { withRlsBypass } from '../db';

// ── Forward hook types ───────────────────────────────────────────────────────

export interface SoldHookInput {
  tenantId: string;
  listing: {
    id: string;
    price: number | string | null | undefined;
    project_id?: string | null;
    projectId?: string | null;
    assigned_to?: string | null;
    assignedTo?: string | null;
  };
  /** User who performed the SOLD transition — fallback for sales_user_id. */
  actorUserId: string;
}

export interface SoldHookResult {
  created: boolean;
  reason?: string;
  ledgerId?: string;
}

// ── Reverse hook types ───────────────────────────────────────────────────────

export interface RevertedHookInput {
  tenantId: string;
  listingId: string;
  /** User who performed the status reversal. */
  actorUserId: string;
  /** Previous status (always 'SOLD' for this hook). */
  fromStatus: string;
  /** New status the listing is being moved to. */
  toStatus: string;
}

export interface RevertedHookResult {
  voided: boolean;
  ledgerId?: string;
  reason?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve partner_tenant_id from listing_access (ACTIVE entry only).
 * Returns NULL for internal sales (no partner involved).
 */
async function resolvePartnerTenantId(listingId: string): Promise<string | null> {
  try {
    const { rows } = await withRlsBypass((c) =>
      c.query(
        `SELECT partner_tenant_id
           FROM listing_access
          WHERE listing_id = $1 AND status = 'ACTIVE'
          ORDER BY granted_at ASC NULLS LAST
          LIMIT 1`,
        [listingId],
      ),
    );
    return rows[0]?.partner_tenant_id ?? null;
  } catch {
    return null;
  }
}

// ── Forward hook: SOLD ───────────────────────────────────────────────────────

export async function generateLedgerOnSold(input: SoldHookInput): Promise<SoldHookResult> {
  const projectId = (input.listing.project_id ?? input.listing.projectId) as string | null;
  if (!projectId) return { created: false, reason: 'no-project' };

  const saleDateIso = new Date().toISOString();

  const policy = await commissionPolicyRepository.findActiveAt(input.tenantId, projectId, saleDateIso);
  if (!policy) return { created: false, reason: 'no-active-policy' };

  const partnerTenantId = await resolvePartnerTenantId(input.listing.id);

  // TIERED: count units already SOLD this month for the same partner (current sale = N+1).
  let unitsThisMonth = 0;
  if (policy.type === 'TIERED') {
    const prior = await commissionLedgerRepository.countMonthlyUnitsForPartner(
      input.tenantId, partnerTenantId, saleDateIso, projectId,
    );
    unitsThisMonth = prior + 1;
  }

  const calc = calculateCommission(
    { id: input.listing.id, price: input.listing.price ?? 0 },
    { id: policy.id, type: policy.type as PolicyType, version: policy.version, config: policy.config as PolicyConfig },
    { unitsThisMonth },
    saleDateIso,
  );

  const salesUserId = (input.listing.assigned_to ?? input.listing.assignedTo ?? input.actorUserId) || null;
  const salePrice = Number(input.listing.price ?? 0) || 0;

  const { row, created } = await commissionLedgerRepository.upsertOnSale(input.tenantId, {
    projectId,
    listingId: input.listing.id,
    policyId: policy.id,
    policyVersion: policy.version,
    policyType: policy.type as PolicyType,
    saleDate: saleDateIso,
    salesUserId,
    partnerTenantId,
    salePrice,
    grossAmount: calc.grossAmount,
    ratePct: calc.ratePct,
    milestones: calc.milestones,
  });

  return { created, ledgerId: row?.id, reason: created ? undefined : 'already-exists' };
}

// ── Reverse hook: SOLD → any other status ────────────────────────────────────

/**
 * Void the commission ledger entry for a listing that was un-SOLD.
 *
 * Metrics impact when called:
 *  - Doanh thu hoa hồng    → ledger entry set to CANCELLED (no longer counted as revenue)
 *  - Giá trị pipeline       → real-time query, auto-updates on next Dashboard load
 *  - Tốc độ bán hàng        → real-time query (WHERE status = 'SOLD'), auto-updates
 *  - Hiệu suất pipeline     → real-time query, auto-updates
 *  - Nhịp đập thị trường    → real-time query (WHERE status = 'AVAILABLE'), auto-updates
 *  - Bảng xếp hạng          → real-time query, auto-updates
 *  - Tỷ lệ tự động hoá AI   → real-time query, auto-updates
 *  - Nhật ký hoạt động      → audit_log already records the status change event
 */
export async function voidLedgerOnReverted(input: RevertedHookInput): Promise<RevertedHookResult> {
  try {
    const result = await commissionLedgerRepository.voidOnReverted(input.tenantId, input.listingId);
    if (result.voided) {
      console.info(
        `[commission hook] Ledger voided — listing ${input.listingId} reverted ` +
        `${input.fromStatus} → ${input.toStatus} by ${input.actorUserId}. ` +
        `ledgerId=${result.ledgerId}`,
      );
    }
    return result;
  } catch (e) {
    console.error('[commission hook reversal] failed:', e);
    return { voided: false, reason: 'error' };
  }
}
