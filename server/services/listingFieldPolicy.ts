/**
 * listingFieldPolicy - single source of truth for WHICH listing fields a
 * request body may write, and WHO may write them.
 *
 * Before this module both POST /api/listings and PUT /api/listings/:id spread
 * the raw req.body straight into listingRepository, so any authenticated user
 * could set isVerified, viewCount, bookingCount or holdExpiresAt
 * by adding one key to the JSON payload (classic mass assignment).
 *
 * Policy:
 *   - SYSTEM fields are never accepted from a request, for anybody. They are
 *     owned by the server (counters, timestamps, ownership, booking hold).
 *   - PRIVILEGED fields are accepted only from the listed roles; for everyone
 *     else they are silently dropped (NOT rejected) so that a normal
 *     full-object PUT coming back from the UI keeps working.
 *   - Everything else must be in the writable content list; unknown keys are
 *     dropped because the repository would ignore them anyway.
 */

export type ListingWriteMode = 'create' | 'update';

/** Content fields any user with write rights may set. */
export const LISTING_WRITABLE_FIELDS: readonly string[] = [
  'code', 'title', 'location', 'price', 'currency', 'area', 'builtArea',
  'bedrooms', 'bathrooms', 'type', 'status', 'transaction', 'attributes',
  'images', 'coordinates', 'contactPhone', 'ownerName', 'ownerPhone',
  'commission', 'commissionUnit', 'totalUnits', 'availableUnits',
  // project linkage - repository accepts both camelCase and snake_case
  'projectCode', 'project_code', 'projectId', 'project_id',
];

/** Fields the server owns. Never writable through the API, by anyone. */
export const LISTING_SYSTEM_FIELDS: readonly string[] = [
  'id', 'tenantId', 'tenant_id',
  'viewCount', 'view_count',
  'bookingCount', 'booking_count',
  'createdBy', 'created_by',
  'createdAt', 'created_at', 'updatedAt', 'updated_at',
  'holdExpiresAt', 'hold_expires_at',
  'assignedTo', 'assigned_to',
  'isFavorite', 'is_favorite',
  'deletedAt', 'deleted_at',
];

/** Fields that need elevated roles. */
export const LISTING_PRIVILEGED_FIELDS: Record<string, readonly string[]> = {
  isVerified: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'],
  authorizedAgents: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'],
};

const WRITABLE_SET = new Set(LISTING_WRITABLE_FIELDS);
const SYSTEM_SET = new Set(LISTING_SYSTEM_FIELDS);

export interface SanitizedListingInput {
  data: Record<string, any>;
  droppedSystem: string[];
  droppedPrivileged: string[];
  droppedUnknown: string[];
}

export function sanitizeListingInput(
  body: unknown,
  mode: ListingWriteMode,
  role: string,
): SanitizedListingInput {
  const out: Record<string, any> = {};
  const droppedSystem: string[] = [];
  const droppedPrivileged: string[] = [];
  const droppedUnknown: string[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { data: out, droppedSystem, droppedPrivileged, droppedUnknown };
  }

  for (const [key, value] of Object.entries(body as Record<string, any>)) {
    if (value === undefined) continue;
    // prototype pollution guard
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      droppedSystem.push(key);
      continue;
    }
    if (SYSTEM_SET.has(key)) { droppedSystem.push(key); continue; }

    const allowedRoles = LISTING_PRIVILEGED_FIELDS[key];
    if (allowedRoles) {
      if (allowedRoles.includes(role)) out[key] = value;
      else droppedPrivileged.push(key);
      continue;
    }

    if (WRITABLE_SET.has(key)) { out[key] = value; continue; }
    droppedUnknown.push(key);
  }

  // On create the caller sets createdBy explicitly; on update nothing extra.
  void mode;
  return { data: out, droppedSystem, droppedPrivileged, droppedUnknown };
}

/** Short human-readable trace for the audit log; empty string when nothing was dropped. */
export function describeDropped(s: SanitizedListingInput): string {
  const parts: string[] = [];
  if (s.droppedSystem.length) parts.push(`system=${s.droppedSystem.join('/')}`);
  if (s.droppedPrivileged.length) parts.push(`privileged=${s.droppedPrivileged.join('/')}`);
  if (s.droppedUnknown.length) parts.push(`unknown=${s.droppedUnknown.join('/')}`);
  return parts.length ? ` | blocked: ${parts.join(', ')}` : '';
}
