/**
 * P5.1 — Bang quyen tool theo role: MINH lam thay user chi trong pham vi user duoc cap.
 * Tier: read < staff < manager < admin. Role cao nhat cua user >= tier cua tool thi duoc dung.
 * Tool khong nam trong bang: mac dinh 'manager' (an toan mac dinh).
 */
export type ToolTier = 'read' | 'staff' | 'manager' | 'admin';

const TOOL_TIER: Record<string, ToolTier> = {
  get_valuation: 'read',
  search_listings: 'read',
  search_projects: 'read',
  get_listing_detail: 'read',
  get_project_info: 'read',
  get_project_listings: 'read',
  get_project_dynamic: 'read',
  get_longthanh_market: 'read',
  get_market_stats: 'read',
  get_price_index: 'read',
  get_valuation_methodology: 'read',
  get_platform_knowledge: 'read',
  get_guide_data_summary: 'read',
  compare_projects: 'read',
  compare_price_vs_market: 'read',
  legal_qa: 'read',
  check_planning: 'read',
  handle_live_chat: 'read',
  analyze_chat_session: 'read',
  get_cache_status: 'read',
  get_broker_stats: 'read',
  analyze_investment: 'staff',
  score_lead: 'staff',
  suggest_properties: 'staff',
  check_duplicate: 'staff',
  check_legal_status: 'staff',
  capture_lead: 'staff',
  book_viewing_appointment: 'staff',
  route_lead: 'staff',
  task_list: 'staff',
  task_comment: 'staff',
  landing_quota: 'staff',
  task_create: 'manager',
  task_update_status: 'manager',
  task_assign: 'manager',
  landing_builder: 'manager',
  escalate_to_human: 'manager',
  refresh_knowledge_base: 'admin',
};

const TIER_RANK: Record<ToolTier, number> = { read: 0, staff: 1, manager: 2, admin: 3 };

const ROLE_MAX_TIER: Record<string, ToolTier> = {
  SUPER_ADMIN: 'admin',
  ADMIN: 'manager',
  MANAGER: 'manager',
  TEAM_LEAD: 'manager',
  MARKETING: 'staff',
  SALES: 'staff',
};

export function canUseTool(role: string | undefined, toolName: string): boolean {
  const toolTier = TOOL_TIER[toolName] ?? 'manager';
  const roleTier = role ? ROLE_MAX_TIER[role] : undefined;
  if (!roleTier) return toolTier === 'read';
  return TIER_RANK[roleTier] >= TIER_RANK[toolTier];
}

export function requiredTier(toolName: string): ToolTier {
  return TOOL_TIER[toolName] ?? 'manager';
}
