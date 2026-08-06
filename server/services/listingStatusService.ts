/**
 * listingStatusService.ts - the single owner of listing status transitions.
 *
 * Before this, two routes could change `listings.status`:
 *   PUT   /api/listings/:id         -> recorded the sold price for calibration
 *   PATCH /api/listings/:id/status  -> generated the commission ledger entry
 * so the business outcome of "mark this listing SOLD" depended on which UI
 * control the user happened to press. Neither path validated the transition,
 * so SOLD could silently go back to AVAILABLE.
 *
 * This module owns both concerns:
 *   1. checkStatusTransition() - the state machine.
 *   2. runStatusSideEffects()  - commission ledger + price calibration, run
 *      exactly once per real transition, from whichever route triggered it.
 */
import { logger } from '../middleware/logger';
import { priceCalibrationService } from './priceCalibrationService';
import { getRegionalBasePrice, mapListingTypeToPropertyType } from '../valuationEngine';

export const LISTING_STATUSES = [
  'BOOKING', 'OPENING', 'AVAILABLE', 'HOLD', 'SOLD', 'RENTED', 'INACTIVE', 'BEST_MARKET',
] as const;

/** Marketable states a listing can move between freely. */
const OPEN_STATES = ['AVAILABLE', 'BOOKING', 'OPENING', 'HOLD', 'BEST_MARKET'];

/**
 * Allowed transitions. SOLD is deliberately terminal: undoing a completed
 * sale is an exception that must be made by an elevated role so it lands in
 * the audit log as such. RENTED reopens naturally when a lease ends.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: [...OPEN_STATES, 'SOLD', 'RENTED', 'INACTIVE'],
  BOOKING: [...OPEN_STATES, 'SOLD', 'RENTED', 'INACTIVE'],
  OPENING: [...OPEN_STATES, 'SOLD', 'RENTED', 'INACTIVE'],
  HOLD: [...OPEN_STATES, 'SOLD', 'RENTED', 'INACTIVE'],
  BEST_MARKET: [...OPEN_STATES, 'SOLD', 'RENTED', 'INACTIVE'],
  RENTED: ['AVAILABLE', 'BEST_MARKET', 'INACTIVE'],
  INACTIVE: ['AVAILABLE', 'BOOKING', 'OPENING', 'BEST_MARKET'],
  SOLD: ['INACTIVE'],
};

/** Roles allowed to reverse a terminal state (recorded as a reversal). */
const REVERSAL_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const MSG_INVALID_FROM_TO = 'Kh\u00F4ng th\u1EC3 chuy\u1EC3n tr\u1EA1ng th\u00E1i t\u1EEB ';
const MSG_TO = ' sang ';
const MSG_ADMIN_ONLY = ' (ch\u1EC9 ADMIN m\u1EDBi \u0111\u01B0\u1EE3c m\u1EDF l\u1EA1i tin \u0111\u00E3 b\u00E1n)';

export interface TransitionCheck {
  ok: boolean;
  /** True when an elevated role is overriding a terminal state. */
  reversal: boolean;
  error?: string;
}

export function isValidListingStatus(value: unknown): boolean {
  return typeof value === 'string' && (LISTING_STATUSES as readonly string[]).includes(value);
}

export function checkStatusTransition(
  from: string | null | undefined,
  to: string,
  role: string,
): TransitionCheck {
  if (!isValidListingStatus(to)) {
    return { ok: false, reversal: false, error: `Invalid status: ${to}` };
  }
  const current = from && isValidListingStatus(from) ? String(from) : null;
  // Unknown/legacy current value: let it move anywhere valid rather than
  // trapping the row forever.
  if (!current) return { ok: true, reversal: false };
  if (current === to) return { ok: true, reversal: false };
  if ((ALLOWED_TRANSITIONS[current] || []).includes(to)) {
    return { ok: true, reversal: false };
  }
  if (REVERSAL_ROLES.includes(role)) {
    return { ok: true, reversal: true };
  }
  return {
    ok: false,
    reversal: false,
    error: MSG_INVALID_FROM_TO + current + MSG_TO + to + (current === 'SOLD' ? MSG_ADMIN_ONLY : ''),
  };
}

/** Normalise a free-text location into the calibration engine's key format. */
function normalizeLocationKey(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * A sold transaction is the most accurate price signal we ever get, so it is
 * fed back into the self-learning calibration engine.
 */
async function recordSoldPrice(tenantId: string, listing: any): Promise<void> {
  const price = Number(listing?.price);
  const area = Number(listing?.area);
  const location = listing?.location ? String(listing.location) : '';
  if (!Number.isFinite(price) || !Number.isFinite(area) || price <= 0 || area <= 0 || !location) return;
  const pricePerM2 = Math.round(price / area);
  if (pricePerM2 <= 1_000_000) return;
  // `listing.propertyType` never existed on the entity - the old call always
  // fell through to 'townhouse_center', which silently poisoned every
  // calibration sample. The real column is `type`.
  const propertyType = mapListingTypeToPropertyType(String(listing?.type || ''));
  const regional = getRegionalBasePrice(location, propertyType);
  await priceCalibrationService.recordTransaction({
    locationKey: normalizeLocationKey(location),
    locationDisplay: location,
    pricePerM2,
    propertyType,
    confidence: regional.confidence,
    // UUID, not an integer - parseInt() on it produced NaN and every insert
    // was rejected by Postgres.
    listingId: String(listing.id),
    tenantId,
  });
}

export interface StatusSideEffectInput {
  tenantId: string;
  actorUserId: string;
  listing: any;
  oldStatus?: string | null;
  newStatus: string;
}

/**
 * Run everything that must happen when a listing really changes status.
 * Best-effort by design: a failure here must never fail the HTTP request that
 * already committed the status change.
 */
export async function runStatusSideEffects(input: StatusSideEffectInput): Promise<void> {
  const { tenantId, actorUserId, listing, oldStatus, newStatus } = input;
  if (newStatus !== 'SOLD' || oldStatus === 'SOLD') return;

  try {
    const { generateLedgerOnSold } = await import('./commissionHook');
    await generateLedgerOnSold({
      tenantId,
      listing: {
        id: String(listing.id),
        price: listing.price,
        project_id: listing.project_id ?? null,
        projectId: listing.projectId ?? null,
        assigned_to: listing.assigned_to ?? null,
        assignedTo: listing.assignedTo ?? null,
      },
      actorUserId,
    });
  } catch (err: any) {
    logger.warn('[listingStatus] commission hook failed: ' + (err?.message || err));
  }

  try {
    await recordSoldPrice(tenantId, listing);
  } catch (err: any) {
    logger.warn('[listingStatus] price calibration failed: ' + (err?.message || err));
  }
}
