import {
  belongsToTenant,
  canManageListingAccess,
  canManageProjectAccess,
  compatibleStatusAfterTransactionChange,
  isProjectInventoryListing,
  terminalStatusForTransaction,
} from '../../utils/projectPolicies';
import { describe, expect, it } from 'vitest';

describe('project inventory and permission regressions', () => {
  describe('project listings stay out of independent inventory', () => {
    it('recognizes an explicitly linked project listing', () => {
      expect(isProjectInventoryListing({ projectId: 'project-1', projectCode: null })).toBe(true);
    });

    it('recognizes legacy project listings by a case-insensitive project code', () => {
      expect(isProjectInventoryListing({ projectId: null, projectCode: ' aqua-city ' }, ['AQUA-CITY'])).toBe(true);
    });

    it('keeps a standalone listing independent when there is no project link', () => {
      expect(isProjectInventoryListing({ projectId: null, projectCode: 'PRIVATE-001' }, ['AQUA-CITY'])).toBe(false);
    });
  });

  describe('cross-tenant isolation', () => {
    it('allows access only when resource and request tenant match', () => {
      expect(belongsToTenant('tenant-a', 'tenant-a')).toBe(true);
      expect(belongsToTenant('tenant-a', 'tenant-b')).toBe(false);
      expect(belongsToTenant('tenant-a', null)).toBe(false);
    });
  });

  describe('terminal status follows transaction type', () => {
    it('uses SOLD for sales and RENTED for rentals', () => {
      expect(terminalStatusForTransaction('SALE')).toBe('SOLD');
      expect(terminalStatusForTransaction('RENT')).toBe('RENTED');
    });

    it('resets an incompatible terminal status when transaction changes', () => {
      expect(compatibleStatusAfterTransactionChange('RENT', 'SOLD')).toBe('AVAILABLE');
      expect(compatibleStatusAfterTransactionChange('SALE', 'RENTED')).toBe('AVAILABLE');
      expect(compatibleStatusAfterTransactionChange('RENT', 'RENTED')).toBe('RENTED');
    });
  });

  describe('project and listing access administration', () => {
    it('limits grant/revoke actions to SUPER_ADMIN and ADMIN', () => {
      for (const role of ['SUPER_ADMIN', 'ADMIN']) {
        expect(canManageProjectAccess(role)).toBe(true);
        expect(canManageListingAccess(role)).toBe(true);
      }
      for (const role of ['TEAM_LEAD', 'SALES', 'VIEWER', 'PARTNER_AGENT']) {
        expect(canManageProjectAccess(role)).toBe(false);
        expect(canManageListingAccess(role)).toBe(false);
      }
    });
  });
});