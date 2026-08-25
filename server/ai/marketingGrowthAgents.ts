/**
 * Marketing/Growth capability contracts.
 *
 * These are capability definitions, not a second agent runtime. Existing
 * Router/Writer/Marketing/Lead/Valuation/SEO/Compliance infrastructure can
 * execute them through the same durable event and governance pipeline.
 */

export type MarketingGrowthCapability = {
  capabilityKey: string;
  displayName: string;
  role: string;
  promptKey: string;
  mode: 'background' | 'on_demand' | 'realtime' | 'gate';
  cadence: 'daily' | 'weekly' | 'on_demand' | 'realtime' | 'per_publish';
  inputSchema: string;
  outputSchema: string;
  ownerIntent: string;
  ragDomains: string[];
  requiresHumanApproval: boolean;
  prohibitedActions: string[];
};

export type MarketingGrowthEvidence = {
  source: string;
  observedAt: string;
  verificationStatus: 'verified' | 'unverified' | 'needs_review' | 'stale';
};

export type MarketingGrowthOutputEnvelope<T = unknown> = {
  capability: string;
  schemaVersion: '1.0';
  status: 'draft' | 'needs_human_review' | 'approved' | 'rejected';
  data: T;
  evidence: MarketingGrowthEvidence[];
  confidence: number;
  uncertainty: string | null;
  requiresHumanApproval: boolean;
};

const commonProhibitions = ['invent:source_data', 'bypass:tenant_scope'];

export const MARKETING_GROWTH_CAPABILITIES: readonly MarketingGrowthCapability[] = [
  {
    capabilityKey: 'CONTENT_RADAR',
    displayName: 'Content Radar',
    role: 'content_radar',
    promptKey: 'CONTENT_RADAR_SYSTEM',
    mode: 'background',
    cadence: 'daily',
    inputSchema: 'search_trends, faq_gaps, project_freshness, unanswered_chat_questions',
    outputSchema: 'date, priorities[{topic,type,reason,urgency,target_project_or_area}]',
    ownerIntent: 'Ưu tiên chủ đề nội dung',
    ragDomains: ['market', 'product'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'publish:content'],
  },
  {
    capabilityKey: 'REVENUE_SIGNAL',
    displayName: 'Revenue Signal',
    role: 'revenue_signal',
    promptKey: 'REVENUE_SIGNAL_SYSTEM',
    mode: 'background',
    cadence: 'daily',
    inputSchema: 'crm_leads, marketplace_views, inventory_status',
    outputSchema: 'period, alerts[{project,signal_type,severity,data_points}]',
    ownerIntent: 'Phát hiện tín hiệu doanh thu',
    ragDomains: ['market', 'product'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'conclude:root_cause', 'change:pricing'],
  },
  {
    capabilityKey: 'COMPETITIVE_INTELLIGENCE',
    displayName: 'Competitive Intelligence',
    role: 'competitive_intelligence',
    promptKey: 'COMPETITIVE_INTELLIGENCE_SYSTEM',
    mode: 'background',
    cadence: 'weekly',
    inputSchema: 'public_competitor_pages, tracked_sgs_projects',
    outputSchema: 'week, findings[{competitor,topic,summary,relevance_to_project,confidence}]',
    ownerIntent: 'Theo dõi thông tin cạnh tranh công khai',
    ragDomains: ['market', 'product'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'access:login_required_content', 'copy:competitor_text', 'publish:competitor_claim'],
  },
  {
    capabilityKey: 'PROJECT_PAGE',
    displayName: 'Project Page',
    role: 'project_page',
    promptKey: 'PROJECT_PAGE_SYSTEM',
    mode: 'on_demand',
    cadence: 'on_demand',
    inputSchema: 'developer_facts, project_facts, content_priority, brand_voice, legal_disclaimers',
    outputSchema: 'project,draft_sections,flags,status=draft_ready_for_review',
    ownerIntent: 'Tạo bản nháp trang dự án',
    ragDomains: ['product', 'legal', 'market'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'publish:content', 'invent:price_or_legal_status'],
  },
  {
    capabilityKey: 'PRICING_INVENTORY_SYNC',
    displayName: 'Pricing/Inventory Sync',
    role: 'pricing_inventory_sync',
    promptKey: 'PRICING_INVENTORY_SYNC_SYSTEM',
    mode: 'background',
    cadence: 'daily',
    inputSchema: 'crm_price_inventory, public_project_price_snapshot',
    outputSchema: 'project,changes[{segment,old_price,new_price,change_pct,requires_review}],updated_at',
    ownerIntent: 'Đồng bộ giá và tồn kho',
    ragDomains: ['product', 'market'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'overwrite:source_crm', 'publish:large_price_change'],
  },
  {
    capabilityKey: 'REPURPOSING',
    displayName: 'Repurposing',
    role: 'repurposing',
    promptKey: 'REPURPOSING_SYSTEM',
    mode: 'on_demand',
    cadence: 'on_demand',
    inputSchema: 'approved_project_page, brand_voice',
    outputSchema: 'source_project,social_posts,video_script,broker_message_templates',
    ownerIntent: 'Chuyển đổi nội dung đã duyệt',
    ragDomains: ['product', 'market'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'change:approved_price_or_legal_claim', 'publish:unapproved_source'],
  },
  {
    capabilityKey: 'LEAD_QUALIFICATION',
    displayName: 'Lead Qualification',
    role: 'lead_qualification',
    promptKey: 'LEAD_QUALIFICATION_SYSTEM',
    mode: 'realtime',
    cadence: 'realtime',
    inputSchema: 'live_chat_conversation, lead_memory',
    outputSchema: 'conversation_id,project_interest,budget_range,purpose,priority,key_questions_asked,assigned_broker_suggestion',
    ownerIntent: 'Phân loại và làm giàu lead',
    ragDomains: ['product'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'send:outreach', 'guarantee:price_or_legal'],
  },
  {
    capabilityKey: 'OUTREACH',
    displayName: 'Outreach',
    role: 'outreach',
    promptKey: 'OUTREACH_SYSTEM',
    mode: 'realtime',
    cadence: 'realtime',
    inputSchema: 'qualified_lead, project_brain, interaction_history, consent',
    outputSchema: 'lead_id,broker_assigned,draft_variants[],requires_broker_approval=true',
    ownerIntent: 'Soạn bản nháp tiếp cận lead',
    ragDomains: ['product', 'market'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'send:message_without_broker_approval', 'invent:price'],
  },
  {
    capabilityKey: 'BROKER_ENABLEMENT',
    displayName: 'Broker Enablement',
    role: 'broker_enablement',
    promptKey: 'BROKER_ENABLEMENT_SYSTEM',
    mode: 'on_demand',
    cadence: 'on_demand',
    inputSchema: 'broker_question, revenue_alert, company_brain',
    outputSchema: 'query_type,response,escalate_to_human,escalation_reason',
    ownerIntent: 'Hỗ trợ nghiệp vụ môi giới',
    ragDomains: ['product', 'legal', 'market'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'invent:commission_policy', 'resolve:legal_dispute'],
  },
  {
    capabilityKey: 'VALUATION_QA',
    displayName: 'AI Valuation QA',
    role: 'valuation_qa',
    promptKey: 'VALUATION_QA_SYSTEM',
    mode: 'background',
    cadence: 'weekly',
    inputSchema: 'ai_valuation_logs, verified_transactions',
    outputSchema: 'week,overall_error_rate,flagged_areas[],requires_human_review',
    ownerIntent: 'Giám sát sai số định giá AI',
    ragDomains: ['market'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'change:valuation_model', 'invent:transaction'],
  },
  {
    capabilityKey: 'MARKETING_ANALYST',
    displayName: 'Marketing Analyst',
    role: 'marketing_analyst',
    promptKey: 'MARKETING_ANALYST_SYSTEM',
    mode: 'background',
    cadence: 'weekly',
    inputSchema: 'weekly_agent_outputs, traffic, conversion, crm_metrics',
    outputSchema: 'week,top_observations[],recommended_investigations[],recommended_actions_for_human[]',
    ownerIntent: 'Phân tích hiệu suất marketing',
    ragDomains: ['market', 'product'],
    requiresHumanApproval: false,
    prohibitedActions: [...commonProhibitions, 'execute:recommended_action', 'claim:unobserved_cause'],
  },
  {
    capabilityKey: 'COMPLIANCE_GUARDIAN',
    displayName: 'Compliance/Legal Guardian',
    role: 'compliance_guardian',
    promptKey: 'COMPLIANCE_GUARDIAN_SYSTEM',
    mode: 'gate',
    cadence: 'per_publish',
    inputSchema: 'draft_content,legal_disclaimers,publication_context',
    outputSchema: 'content_id,decision,violations[],reviewed_at',
    ownerIntent: 'Chặn nội dung public không tuân thủ',
    ragDomains: ['legal', 'product'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'approve:missing_disclaimer', 'publish:content'],
  },
  {
    capabilityKey: 'SEO_AEO_AUDITOR',
    displayName: 'SEO/AEO Auditor',
    role: 'seo_aeo_auditor',
    promptKey: 'SEO_AEO_AUDITOR_SYSTEM',
    mode: 'gate',
    cadence: 'per_publish',
    inputSchema: 'compliance_approved_draft,brand_voice,existing_project_structure',
    outputSchema: 'content_id,decision,technical_issues[],reviewed_at',
    ownerIntent: 'Kiểm tra SEO/AEO trước publish',
    ragDomains: ['product', 'market'],
    requiresHumanApproval: true,
    prohibitedActions: [...commonProhibitions, 'publish:content', 'invent:structured_data'],
  },
];

export const MARKETING_GROWTH_ROLE_CARDS = MARKETING_GROWTH_CAPABILITIES.map(capability => ({
  agentKey: capability.capabilityKey,
  title: capability.displayName,
  mission: capability.ownerIntent,
  permissions: [`read:${capability.role}_inputs`, 'write:structured_output'],
  prohibitedActions: capability.prohibitedActions,
  kpis: ['groundedness', 'schema_validity', 'escalation_quality'],
  escalationRules: capability.requiresHumanApproval ? ['approval_required', 'missing_evidence'] : ['missing_evidence'],
  rollout: 'SHADOW' as const,
}));

export function getMarketingGrowthCapability(key: string): MarketingGrowthCapability | undefined {
  return MARKETING_GROWTH_CAPABILITIES.find(capability =>
    capability.capabilityKey === key || capability.role === key || capability.promptKey === key,
  );
}

export function isMarketingGrowthCapability(key: string): boolean {
  return Boolean(getMarketingGrowthCapability(key));
}

export function marketingGrowthApprovalRequired(key: string): boolean {
  return getMarketingGrowthCapability(key)?.requiresHumanApproval ?? false;
}

export function validateMarketingGrowthOutput(
  output: Partial<MarketingGrowthOutputEnvelope>,
  capabilityKey: string,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const capability = getMarketingGrowthCapability(capabilityKey);
  if (!capability) reasons.push('unknown_capability');
  if (output.capability !== capabilityKey) reasons.push('capability_mismatch');
  if (output.schemaVersion !== '1.0') reasons.push('unsupported_schema_version');
  if (!['draft', 'needs_human_review', 'approved', 'rejected'].includes(String(output.status))) {
    reasons.push('invalid_status');
  }
  if (!Array.isArray(output.evidence) || output.evidence.length === 0) reasons.push('missing_provenance');
  if (!Number.isFinite(Number(output.confidence)) || Number(output.confidence) < 0 || Number(output.confidence) > 1) {
    reasons.push('invalid_confidence');
  }
  if (output.requiresHumanApproval !== capability?.requiresHumanApproval) reasons.push('approval_policy_mismatch');
  if (!output.uncertainty && output.status === 'needs_human_review') reasons.push('missing_uncertainty');
  return { valid: reasons.length === 0, reasons };
}

export type MarketingSignalInput = {
  priceChangePct?: number;
  valuationErrorPct?: number;
  inventoryDays?: number;
  leadAgeDays?: number;
  unansweredHours?: number;
};

export function evaluateMarketingSignals(input: MarketingSignalInput) {
  const alerts: string[] = [];
  if (Math.abs(input.priceChangePct || 0) >= 10) alerts.push('PRICE_CHANGE_AT_LEAST_10_PERCENT');
  if ((input.valuationErrorPct || 0) > 15) alerts.push('VALUATION_ERROR_ABOVE_15_PERCENT');
  if ((input.inventoryDays || 0) >= 30) alerts.push('INVENTORY_30_DAYS');
  if ((input.leadAgeDays || 0) >= 21) alerts.push('LEAD_INACTIVE_21_DAYS');
  if ((input.unansweredHours || 0) >= 48) alerts.push('UNANSWERED_48_HOURS');
  return alerts;
}