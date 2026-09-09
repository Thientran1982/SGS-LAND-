import { describe, expect, it } from 'vitest';
import { isSocialCapabilityReady } from '../../services/api/socialPublicationApi';

describe('social publication capability gating', () => {
  it('keeps an unverified Zalo broadcast capability unavailable', () => {
    expect(isSocialCapabilityReady({
      status: 'NOT_READY',
      canPublish: false,
    })).toBe(false);
  });

  it('only enables a platform after status and publish permission are both ready', () => {
    expect(isSocialCapabilityReady({ status: 'READY', canPublish: true })).toBe(true);
    expect(isSocialCapabilityReady({ status: 'READY', canPublish: false })).toBe(false);
  });
});