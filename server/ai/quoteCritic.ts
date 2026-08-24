import { gateAgentOutput, type AgentOutputEnvelope } from './agentOperatingContracts';

export type QuoteDraft = {
  greeting?: string;
  price?: number | string;
  currency?: string;
  source?: string;
  nextStep?: string;
  content?: string;
};

export type QuoteCritique = {
  score: number;
  passed: boolean;
  issues: string[];
  checklist: Record<string, boolean>;
  confidence: number;
  canAct: boolean;
};

export function critiqueQuoteDraft(draft: QuoteDraft, minimumScore = 60): AgentOutputEnvelope<QuoteCritique> {
  const checklist = {
    hasContent: Boolean(String(draft.content || '').trim()),
    hasPrice: Number.isFinite(Number(draft.price)) && Number(draft.price) > 0,
    hasSource: Boolean(String(draft.source || '').trim()),
    hasNextStep: Boolean(String(draft.nextStep || '').trim()),
    hasCurrency: Boolean(String(draft.currency || '').trim()),
    avoidsGuarantee: !/\b(chắc chắn|cam kết lợi nhuận|bảo đảm lời|guaranteed)\b/i.test(String(draft.content || '')),
  };
  const weights = { hasContent: 25, hasPrice: 20, hasSource: 20, hasNextStep: 15, hasCurrency: 10, avoidsGuarantee: 10 };
  const score = Object.entries(checklist).reduce((sum, [key, pass]) => sum + (pass ? weights[key as keyof typeof weights] : 0), 0);
  const issues = Object.entries(checklist).filter(([, pass]) => !pass).map(([key]) => key);
  const critique = { score, passed: score >= minimumScore, issues, checklist, confidence: score / 100, canAct: score >= minimumScore };
  return gateAgentOutput(critique, score / 100, {
    minimum: minimumScore / 100,
    evidence: [{ source: 'quote-critic-checklist' }],
    uncertainty: score < minimumScore ? 'quote_draft_requires_revision' : undefined,
  });
}