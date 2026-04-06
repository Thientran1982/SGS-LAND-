/**
 * AML (Anti-Money Laundering) Validation Middleware
 *
 * Performs risk assessment for high-value real estate transactions.
 * Thresholds (VND):
 *   - >= 5 billion VND  → requires AML check
 *   - >= 20 billion VND → high-risk, requires manual review
 *
 * AML status values: PENDING | CLEAR | FLAGGED | BLOCKED
 * Risk score: 0–100 (higher = riskier)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Thresholds in VND
const AML_CHECK_THRESHOLD_VND = 5_000_000_000;   // 5 billion
const AML_HIGH_RISK_THRESHOLD_VND = 20_000_000_000; // 20 billion

// Threshold for USD (approximate equivalent)
const AML_CHECK_THRESHOLD_USD = 200_000;
const AML_HIGH_RISK_THRESHOLD_USD = 800_000;

export interface AmlCheckResult {
  required: boolean;      // Was AML check triggered?
  status: 'PENDING' | 'CLEAR' | 'FLAGGED' | 'BLOCKED';
  riskScore: number;      // 0–100
  reasons: string[];      // Human-readable risk factors
}

/**
 * Compute an AML risk assessment for a given transaction.
 * This is a rule-based check; production systems should call an external AML provider.
 */
export function assessAmlRisk(params: {
  finalPrice: number;
  currency: 'VND' | 'USD';
  leadName?: string;
  leadSource?: string;
  leadAmlStatus?: string;   // existing AML status on the lead
  leadAmlRiskScore?: number;
}): AmlCheckResult {
  const { finalPrice, currency, leadSource, leadAmlStatus, leadAmlRiskScore } = params;

  const checkThreshold = currency === 'USD' ? AML_CHECK_THRESHOLD_USD : AML_CHECK_THRESHOLD_VND;
  const highRiskThreshold = currency === 'USD' ? AML_HIGH_RISK_THRESHOLD_USD : AML_HIGH_RISK_THRESHOLD_VND;

  // Below threshold: no AML check required
  if (finalPrice < checkThreshold) {
    return { required: false, status: 'CLEAR', riskScore: 0, reasons: [] };
  }

  const reasons: string[] = [];
  let riskScore = 0;

  // Price-based risk scoring
  if (finalPrice >= highRiskThreshold) {
    riskScore += 40;
    reasons.push(`Giá trị giao dịch rất cao (≥ ${currency === 'USD' ? '$800k' : '20 tỷ VND'})`);
  } else {
    riskScore += 15;
    reasons.push(`Giao dịch giá trị cao (≥ ${currency === 'USD' ? '$200k' : '5 tỷ VND'})`);
  }

  // Lead source risk factors
  const highRiskSources = ['Zalo', 'Facebook', 'Website'];
  if (leadSource && highRiskSources.includes(leadSource)) {
    riskScore += 10;
    reasons.push(`Nguồn lead từ kênh online chưa xác minh danh tính (${leadSource})`);
  }

  // Existing lead AML status
  if (leadAmlStatus === 'FLAGGED') {
    riskScore += 30;
    reasons.push('Lead đã bị gắn cờ AML trước đó');
  } else if (leadAmlStatus === 'BLOCKED') {
    riskScore = 100;
    reasons.push('Lead đã bị chặn do vi phạm AML');
  }

  // Carry over previous risk score
  if (leadAmlRiskScore && leadAmlRiskScore > 50) {
    riskScore += 20;
    reasons.push(`Điểm rủi ro tích lũy cao (${leadAmlRiskScore}/100)`);
  }

  riskScore = Math.min(riskScore, 100);

  let status: AmlCheckResult['status'];
  if (leadAmlStatus === 'BLOCKED') {
    status = 'BLOCKED';
  } else if (riskScore >= 70) {
    status = 'FLAGGED';
  } else {
    status = 'PENDING'; // Requires manual review before clearance
  }

  return { required: true, status, riskScore, reasons };
}

/**
 * Express middleware: validate AML for proposal creation.
 * Blocks BLOCKED leads; flags high-risk ones and attaches amlCheck to req.
 * Call this before the route handler that creates/approves proposals.
 */
export function amlProposalCheck(req: Request, res: Response, next: NextFunction): void {
  const { finalPrice, currency = 'VND', leadAmlStatus, leadAmlRiskScore } = req.body;

  if (!finalPrice) {
    next();
    return;
  }

  const result = assessAmlRisk({
    finalPrice: Number(finalPrice),
    currency,
    leadAmlStatus,
    leadAmlRiskScore: leadAmlRiskScore ? Number(leadAmlRiskScore) : undefined,
  });

  if (result.status === 'BLOCKED') {
    logger.warn(`[AML] Blocked proposal for lead (amlStatus=BLOCKED), price=${finalPrice} ${currency}`);
    res.status(403).json({
      error: 'AML_BLOCKED',
      message: 'Giao dịch bị từ chối: lead đã bị chặn do vi phạm AML.',
      aml: result,
    });
    return;
  }

  // Attach result for route handler to store/log
  (req as any).amlCheck = result;

  if (result.required) {
    logger.info(`[AML] Check triggered: score=${result.riskScore}, status=${result.status}, price=${finalPrice} ${currency}`);
  }

  next();
}

/**
 * Validate that a proposal has been AML-cleared before it can be APPROVED.
 * Use as middleware on PUT /proposals/:id/status { status: 'APPROVED' }.
 */
export function requireAmlClearance(req: Request, res: Response, next: NextFunction): void {
  const { status } = req.body;

  if (status !== 'APPROVED') {
    next();
    return;
  }

  // ADMIN and TEAM_LEAD are trusted approvers — they bypass AML clearance check.
  const userRole = (req as any).user?.role;
  if (userRole === 'ADMIN' || userRole === 'TEAM_LEAD') {
    next();
    return;
  }

  // The route handler should attach the proposal to req after fetching it.
  // We check req.proposal if set; otherwise pass (route will re-validate).
  const proposal = (req as any).proposalForAml;
  if (!proposal) {
    next();
    return;
  }

  const price = proposal.finalPrice || 0;
  const currency = proposal.currency || 'VND';
  const checkThreshold = currency === 'USD' ? AML_CHECK_THRESHOLD_USD : AML_CHECK_THRESHOLD_VND;

  if (price >= checkThreshold && !proposal.amlVerified) {
    logger.warn(`[AML] Approval blocked: proposal ${proposal.id} requires AML clearance (price=${price} ${currency})`);
    res.status(403).json({
      error: 'AML_CLEARANCE_REQUIRED',
      message: 'Đề xuất giá trị cao cần được duyệt AML trước khi phê duyệt.',
      proposalId: proposal.id,
      finalPrice: price,
      currency,
    });
    return;
  }

  next();
}
