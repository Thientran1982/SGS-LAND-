import { gateAgentOutput, type AgentOutputEnvelope } from './agentOperatingContracts';

export type BuyerSignal = {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED';
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  priority: number;
  reasons: string[];
};

export function detectBuyerSignals(message: string): AgentOutputEnvelope<BuyerSignal> {
  const text = String(message || '').trim();
  const critical = /(khẩn|gấp|ngay hôm nay|hết hạn|đang chờ|urgent|asap|immediately)/i.test(text);
  const high = /(khiếu nại|bức xúc|lừa đảo|sai|không hài lòng|complaint|refund)/i.test(text);
  const negative = /(không|chưa|tệ|thất vọng|lo lắng|khó chịu|hủy)/i.test(text);
  const positive = /(cảm ơn|tốt|thích|quan tâm|hài lòng|đồng ý)/i.test(text);
  const urgency = critical ? 'CRITICAL' : high ? 'HIGH' : 'NORMAL';
  const sentiment = negative && positive ? 'MIXED' : negative ? 'NEGATIVE' : positive ? 'POSITIVE' : 'NEUTRAL';
  const signal: BuyerSignal = {
    sentiment,
    urgency,
    priority: critical ? 100 : high ? 75 : 40,
    reasons: [
      ...(critical ? ['urgent_language'] : []),
      ...(high ? ['risk_or_complaint_language'] : []),
      ...(negative ? ['negative_sentiment_markers'] : []),
      ...(positive ? ['positive_sentiment_markers'] : []),
    ],
  };
  return gateAgentOutput(signal, text ? 0.86 : 0, {
    minimum: 0.7,
    evidence: text ? [{ source: 'buyer-message', quote: text.slice(0, 500) }] : [],
    uncertainty: 'empty_buyer_message',
  });
}