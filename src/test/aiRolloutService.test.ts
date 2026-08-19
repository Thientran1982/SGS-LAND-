import { describe, expect, it } from 'vitest';
import { decideRollout, deterministicBucket } from '../../server/services/aiRolloutService';

describe('AI rollout policy', () => {
  it('assigns a stable cohort', () => {
    expect(deterministicBucket('rollout:tenant-a:user-1')).toBe(deterministicBucket('rollout:tenant-a:user-1'));
  });

  it('always selects baseline when kill switch is active', () => {
    expect(decideRollout({
      rollout: { id: 'r1', status: 'ACTIVE', canaryPercent: 100, shadowEnabled: false },
      subject: 'user-1',
      killSwitch: true,
    }).mode).toBe('baseline');
  });

  it('keeps shadow output isolated from user traffic', () => {
    expect(decideRollout({
      rollout: { id: 'r1', status: 'SHADOW', canaryPercent: 0, shadowEnabled: true },
      subject: 'user-1',
    }).mode).toBe('shadow');
  });

  it('routes a full active rollout to candidate', () => {
    expect(decideRollout({
      rollout: { id: 'r1', status: 'ACTIVE', canaryPercent: 100, shadowEnabled: false },
      subject: 'user-1',
    }).mode).toBe('candidate');
  });
});