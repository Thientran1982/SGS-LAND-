import type { IntentResult } from '../../types';
import { AGENT_PROFILES, AgentDefinition, DEFAULT_AGENT } from './profiles';

export interface RoutingResult {
  agent: AgentDefinition;
  confidence: number;
  reason: string;
}

const KEYWORD_AGENT_MAP: { keywords: RegExp; agentId: string }[] = [
  { keywords: /pháp lý|sổ đỏ|sổ hồng|tranh chấp|sang tên|hợp đồng|công chứng/i, agentId: 'legal' },
  { keywords: /định giá|thẩm định|giá trị|đầu tư|sinh lời|lợi nhuận|yield|roi/i,  agentId: 'analyst' },
  { keywords: /vay|lãi suất|ngân hàng|tín dụng|eml|trả góp/i,                       agentId: 'finance' },
  { keywords: /dự án|vinhomes|akari|masteri|global city|verandah|tiện ích|phân khu/i, agentId: 'project' },
];

export function routeToAgent(intent: IntentResult, message: string): RoutingResult {
  // 1. Match intent.primary to agent expertise[]
  const expertiseMatch = AGENT_PROFILES.find(a => a.expertise.includes(intent.primary));
  if (expertiseMatch && intent.primary !== 'unknown' && intent.confidence >= 0.7) {
    return {
      agent: expertiseMatch,
      confidence: intent.confidence,
      reason: `Intent "${intent.primary}" matched expertise của ${expertiseMatch.name}`,
    };
  }

  // 2. Fallback: keyword match on raw message
  for (const { keywords, agentId } of KEYWORD_AGENT_MAP) {
    if (keywords.test(message)) {
      const agent = AGENT_PROFILES.find(a => a.id === agentId) ?? DEFAULT_AGENT;
      return {
        agent,
        confidence: 0.6,
        reason: `Keyword match trong tin nhắn → chuyển sang ${agent.name}`,
      };
    }
  }

  // 3. Default: broker
  return {
    agent: DEFAULT_AGENT,
    confidence: 0.5,
    reason: 'Không xác định intent rõ ràng — dùng chuyên viên tư vấn mặc định',
  };
}
