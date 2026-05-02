/**
 * Hook auto-sinh commission ledger entry khi listing chuyển → SOLD.
 *
 * - Idempotent: dùng INSERT ... ON CONFLICT (listing_id) DO NOTHING.
 * - Pure-engine: tính toán tách rời ở `commissionEngine.calculateCommission`.
 * - Best-effort: lỗi ở đây KHÔNG fail request status update.
 */

import { commissionPolicyRepository, commissionLedgerRepository } from '../repositories/commissionRepository';
import { calculateCommission, type PolicyType, type PolicyConfig } from './commissionEngine';
import { withRlsBypass } from '../db';

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
  /** User vừa thực hiện chuyển SOLD — fallback cho sales_user_id. */
  actorUserId: string;
}

export interface SoldHookResult {
  created: boolean;
  reason?: string;
  ledgerId?: string;
}

/**
 * Resolve partner_tenant_id từ listing_access (nếu có entry ACTIVE).
 * Nếu listing không gán partner nào → NULL (sale nội bộ của tenant chủ).
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

export async function generateLedgerOnSold(input: SoldHookInput): Promise<SoldHookResult> {
  const projectId = (input.listing.project_id ?? input.listing.projectId) as string | null;
  if (!projectId) return { created: false, reason: 'no-project' };

  const saleDateIso = new Date().toISOString();

  // Lấy policy ACTIVE tại sale_date
  const policy = await commissionPolicyRepository.findActiveAt(input.tenantId, projectId, saleDateIso);
  if (!policy) return { created: false, reason: 'no-active-policy' };

  const partnerTenantId = await resolvePartnerTenantId(input.listing.id);

  // TIERED: cần đếm số căn đã SOLD trong tháng cho partner này
  let unitsThisMonth = 0;
  if (policy.type === 'TIERED') {
    unitsThisMonth = await commissionLedgerRepository.countMonthlyUnitsForPartner(
      input.tenantId, partnerTenantId, saleDateIso, projectId,
    );
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
