export type ListingTransaction = 'SALE' | 'RENT' | string;
export type ListingTerminalStatus = 'SOLD' | 'RENTED';

/**
 * A project listing must never be counted as an independent inventory item.
 * The code fallback is retained for older rows created before project_id was
 * populated.
 */
export function isProjectInventoryListing(
  listing: { projectId?: string | null; projectCode?: string | null },
  knownProjectCodes: Iterable<string> = [],
): boolean {
  if (listing.projectId) return true;
  const code = String(listing.projectCode || '').trim().toUpperCase();
  if (!code) return false;
  return Array.from(knownProjectCodes).some(candidate => String(candidate).trim().toUpperCase() === code);
}

export function terminalStatusForTransaction(transaction: ListingTransaction): ListingTerminalStatus {
  return String(transaction).toUpperCase() === 'RENT' ? 'RENTED' : 'SOLD';
}

export function compatibleStatusAfterTransactionChange(
  transaction: ListingTransaction,
  status: string | null | undefined,
): string {
  const terminal = terminalStatusForTransaction(transaction);
  if (status === 'SOLD' || status === 'RENTED') {
    return status === terminal ? status : 'AVAILABLE';
  }
  return status || 'AVAILABLE';
}

export function canManageProjectAccess(role: string | null | undefined): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(String(role || '').toUpperCase());
}

export function canManageListingAccess(role: string | null | undefined): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(String(role || '').toUpperCase());
}

export function belongsToTenant(resourceTenantId: string | null | undefined, requestTenantId: string | null | undefined): boolean {
  return Boolean(resourceTenantId && requestTenantId && resourceTenantId === requestTenantId);
}