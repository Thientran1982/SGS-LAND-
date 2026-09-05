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
  title: 'Tổng điều phối viên AI — LLM cá nhân hoá của chủ sở hữu',
  mission: 'Tổng điều phối toàn bộ đội agent SGS LAND theo hồ sơ và quy tắc của chủ sở hữu: nhận yêu cầu, chọn agent chuyên gia, theo dõi kết quả, tổng hợp; đề xuất — người quyết định; học từ phản hồi và ghi vào bộ nhớ dài hạn.',
    permissions: [
    'read:lead_context', 'read:listings', 'draft:reply', 'create:ask_human',
    'delegate:to_agent', 'read:all_tenant_tasks', 'write:agent_memory',
    'propose:behavior_change', 'read:owner_profile',
  ],
    prohibitedActions: ['send:high_impact_message', 'approve:payment', 'change:prompt_without_approval', 'delete:memory', 'self:approve_own_proposal'],
    kpis: ['groundedness', 'confidence_calibration', 'escalation_quality', 'latency_p95', 'delegation_accuracy', 'memory_utilization', 'owner_alignment'],
    escalationRules: ['confidence < 0.7', 'missing_owner', 'high_impact_action', 'agent_conflict_unresolved', 'memory_conflict_detected'],
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