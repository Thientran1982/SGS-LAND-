import { describe, expect, it } from 'vitest';
import {
  MARKETING_GROWTH_CAPABILITIES,
  getMarketingGrowthCapability,
  marketingGrowthApprovalRequired,
  evaluateMarketingSignals,
  validateMarketingGrowthOutput,
} from '../ai/marketingGrowthAgents';
import {
  canPublishMarketingContent,
  canSendOutreach,
  evaluateMarketingApproval,
} from '../ai/agentGuardrails';

describe('Marketing/Growth capability contracts', () => {
  it('registers exactly the 13 capabilities from the operating prompt', () => {
    expect(MARKETING_GROWTH_CAPABILITIES).toHaveLength(13);
    expect(getMarketingGrowthCapability('CONTENT_RADAR')?.role).toBe('content_radar');
    expect(getMarketingGrowthCapability('seo_aeo_auditor')?.capabilityKey).toBe('SEO_AEO_AUDITOR');
  });

  it('requires approval for public content and outreach, but not radar', () => {
    expect(marketingGrowthApprovalRequired('PROJECT_PAGE')).toBe(true);
    expect(marketingGrowthApprovalRequired('OUTREACH')).toBe(true);
    expect(marketingGrowthApprovalRequired('CONTENT_RADAR')).toBe(false);
  });

  it('keeps publish blocked until both reviews and a human approval exist', () => {
    expect(canPublishMarketingContent({
      capability: 'PROJECT_PAGE',
      complianceDecision: 'approved',
      seoDecision: 'approved_for_publish',
      humanPublishApproved: false,
    })).toBe(false);
    expect(evaluateMarketingApproval({
      capability: 'PROJECT_PAGE',
      complianceDecision: 'approved',
      seoDecision: 'approved_for_publish',
      humanPublishApproved: true,
    }).decision).toBe('approved');
  });

  it('keeps outreach blocked without consent and broker approval', () => {
    expect(canSendOutreach({ consentValid: true, brokerApproved: false })).toBe(false);
    expect(canSendOutreach({ consentValid: true, brokerApproved: true })).toBe(true);
    expect(evaluateMarketingApproval({
      capability: 'OUTREACH',
      consentValid: false,
      brokerApproved: true,
    }).reasons).toContain('missing_or_expired_consent');
  });

  it('enforces provenance in the shared output contract and fixed signal thresholds', () => {
    expect(validateMarketingGrowthOutput({
      capability: 'CONTENT_RADAR',
      schemaVersion: '1.0',
      status: 'draft',
      data: {},
      evidence: [],
      confidence: 0.9,
      uncertainty: null,
      requiresHumanApproval: false,
    }, 'CONTENT_RADAR').reasons).toContain('missing_provenance');
    expect(evaluateMarketingSignals({
      priceChangePct: 10,
      valuationErrorPct: 15.1,
      inventoryDays: 30,
      leadAgeDays: 21,
      unansweredHours: 48,
    })).toEqual([
      'PRICE_CHANGE_AT_LEAST_10_PERCENT',
      'VALUATION_ERROR_ABOVE_15_PERCENT',
      'INVENTORY_30_DAYS',
      'LEAD_INACTIVE_21_DAYS',
      'UNANSWERED_48_HOURS',
    ]);
  });
});