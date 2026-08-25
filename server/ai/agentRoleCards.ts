export type AgentRoleCard = {
  agentKey: string;
  title: string;
  mission: string;
  permissions: string[];
  prohibitedActions: string[];
  kpis: string[];
  escalationRules: string[];
  rollout: 'SHADOW' | 'CANARY_25' | 'CANARY_50' | 'LIVE';
};

import { MARKETING_GROWTH_ROLE_CARDS } from './marketingGrowthAgents';

export const DEFAULT_AGENT_ROLE_CARDS: AgentRoleCard[] = [
  {
    agentKey: 'MINH',
    title: 'Điều phối viên AI CRM',
    mission: 'Điều phối hội thoại và công việc có kiểm soát cho đội ngũ.',
    permissions: ['read:lead_context', 'read:listings', 'draft:reply', 'create:ask_human'],
    prohibitedActions: ['send:high_impact_message', 'approve:payment', 'change:prompt_without_approval'],
    kpis: ['groundedness', 'confidence_calibration', 'escalation_quality', 'latency_p95'],
    escalationRules: ['confidence < 0.7', 'missing_owner', 'high_impact_action'],
    rollout: 'SHADOW',
  },
  {
    agentKey: 'MATCHER',
    title: 'Chuyên viên ghép nhu cầu',
    mission: 'Đề xuất sản phẩm phù hợp, không tự cam kết hay gửi cho khách.',
    permissions: ['read:lead_context', 'read:listings', 'draft:match'],
    prohibitedActions: ['send:message', 'invent:listing_fact'],
    kpis: ['match_accept_rate', 'groundedness', 'false_positive_rate'],
    escalationRules: ['no_grounded_match', 'ambiguous_budget'],
    rollout: 'SHADOW',
  },
  {
    agentKey: 'QUOTE_ASSISTANT',
    title: 'Trợ lý lập báo giá',
    mission: 'Soạn báo giá có nguồn và tự kiểm tra trước khi trình người duyệt.',
    permissions: ['read:listing_price', 'draft:quote', 'create:ask_human'],
    prohibitedActions: ['send:quote_without_approval', 'guarantee:return'],
    kpis: ['quote_revision_rate', 'critic_pass_rate', 'source_completeness'],
    escalationRules: ['critic_score < 60', 'missing_price_source', 'confidence < 0.7'],
    rollout: 'SHADOW',
  },
  ...MARKETING_GROWTH_ROLE_CARDS,
];