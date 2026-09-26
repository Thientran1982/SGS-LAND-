import { BaseRepository } from './baseRepository';

/**
 * Lead routing rules.
 *
 * Matching is shared by real lead creation (matchLead) and the admin simulator (simulate) so the
 * simulator always predicts exactly what will happen.
 */

export interface RoutingLeadInput {
  source?: string;
  address?: string;
  tags?: string[];
  preferences?: any;
  score?: any;
}

// Common spellings/abbreviations → canonical accent-free region name.
const REGION_ALIASES: Record<string, string> = {
  'hcm': 'ho chi minh', 'tphcm': 'ho chi minh', 'tp hcm': 'ho chi minh', 'sai gon': 'ho chi minh',
  'saigon': 'ho chi minh', 'sg': 'ho chi minh', 'hcmc': 'ho chi minh',
  'hn': 'ha noi', 'hanoi': 'ha noi',
  'dn': 'da nang', 'danang': 'da nang',
  'bd': 'binh duong', 'dong nai': 'dong nai',
};

/** Lowercase, strip Vietnamese accents, drop "tp."/"thành phố" and punctuation, then apply aliases. */
export function normalizeRegion(value: unknown): string {
  let s = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[.,;:/\\\-_()]/g, ' ')
    .replace(/\b(thanh pho|tp|tinh|quan|q)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (REGION_ALIASES[s]) s = REGION_ALIASES[s];
  // Also expand aliases appearing as whole words inside longer text ("q1 hcm").
  for (const [alias, canonical] of Object.entries(REGION_ALIASES)) {
    s = s.replace(new RegExp(`(^|\\s)${alias}(?=\\s|$)`, 'g'), `$1${canonical}`);
  }
  return s.replace(/\s+/g, ' ').trim();
}

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v])
    .map(x => String(x).trim())
    .filter(Boolean);

const conditionsOf = (rule: any): Record<string, any> => {
  const c = rule?.conditions;
  return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
};

/** Returns null when the rule matches, otherwise the key of the first failing condition. */
export function ruleMismatch(rule: any, lead: RoutingLeadInput): string | null {
  const cond = conditionsOf(rule);
  const sources = asList(cond.source).map(s => s.toLowerCase());
  if (sources.length > 0) {
    if (!lead.source || !sources.includes(String(lead.source).toLowerCase())) return 'source';
  }
  const regions = asList(cond.region).map(normalizeRegion).filter(Boolean);
  if (regions.length > 0) {
    const addr = normalizeRegion(lead.address);
    if (!addr || !regions.some(r => addr.includes(r))) return 'region';
  }
  const tags = asList(cond.tags);
  if (tags.length > 0) {
    const leadTags = (lead.tags || []).map(t => String(t).toLowerCase());
    if (!tags.some(t => leadTags.includes(t.toLowerCase()))) return 'tags';
  }
  const budget = Number(lead.preferences?.budget) || 0;
  const min = Number(cond.budgetMin ?? cond.budget_min) || 0;
  const max = Number(cond.budgetMax ?? cond.budget_max) || 0;
  if (min > 0 && budget < min) return 'budgetMin';
  if (max > 0 && budget > max) return 'budgetMax';
  const temps = asList(cond.temperature);
  if (temps.length > 0) {
    const label = String(lead.score?.label || '');
    if (!temps.includes(label)) return 'temperature';
  }
  return null;
}

export function validateRuleInput(data: any, partial = false): string | null {
  if (!partial || data.name !== undefined) {
    if (!String(data.name ?? '').trim()) return 'Vui lòng nhập tên luật';
    if (String(data.name).length > 255) return 'Tên luật tối đa 255 ký tự';
  }
  if (!partial || data.action !== undefined) {
    const a = data.action || {};
    if (!['ASSIGN_USER', 'ASSIGN_TEAM'].includes(a.type)) return 'Loại mục tiêu không hợp lệ';
    if (!String(a.targetId ?? '').trim()) return 'Vui lòng chọn người hoặc nhóm nhận lead';
  }
  if (data.priority !== undefined && (!Number.isInteger(Number(data.priority)) || Number(data.priority) < 0)) {
    return 'Độ ưu tiên phải là số nguyên từ 0 trở lên';
  }
  if (data.conditions !== undefined && data.conditions !== null) {
    const c = data.conditions;
    if (typeof c !== 'object' || Array.isArray(c)) return 'Điều kiện không hợp lệ';
    const min = Number(c.budgetMin) || 0;
    const max = Number(c.budgetMax) || 0;
    if (min < 0 || max < 0) return 'Ngân sách không được âm';
    if (min > 0 && max > 0 && min > max) return 'Ngân sách tối thiểu phải nhỏ hơn ngân sách tối đa';
  }
  return null;
}

/** Keep only known condition keys, drop empty values. */
export function cleanConditions(c: any): Record<string, any> {
  const src = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const out: Record<string, any> = {};
  for (const key of ['source', 'region', 'tags', 'temperature']) {
    const list = asList(src[key]);
    if (list.length) out[key] = list;
  }
  for (const key of ['budgetMin', 'budgetMax']) {
    const n = Number(src[key]);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

class RoutingRuleRepository extends BaseRepository {
  constructor() {
    super('routing_rules');
  }

  async findAllRules(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM routing_rules ORDER BY priority ASC, created_at DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      // tenant_id is explicit: the column default is the host tenant, which RLS rejects for others.
      const result = await client.query(
        `INSERT INTO routing_rules (tenant_id, name, conditions, action, priority, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          tenantId,
          String(data.name).trim(),
          JSON.stringify(cleanConditions(data.conditions)),
          JSON.stringify(data.action || {}),
          Number(data.priority) || 0,
          data.isActive !== undefined ? !!data.isActive : data.enabled !== undefined ? !!data.enabled : true,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  /** Pick a member of a team according to the rule strategy. */
  private async pickTeamMember(client: any, teamId: string, strategy?: string): Promise<string | null> {
    try {
      if (strategy === 'BEST_AVAILABLE') {
        const r = await client.query(
          `SELECT tm.user_id FROM team_members tm
             LEFT JOIN leads l ON l.assigned_to = tm.user_id AND l.stage NOT IN ('WON','LOST')
            WHERE tm.team_id = $1
            GROUP BY tm.user_id
            ORDER BY COUNT(l.id) ASC, RANDOM()
            LIMIT 1`, [teamId]);
        if (r.rows[0]) return r.rows[0].user_id;
      }
      // Round robin (default): the member whose last assigned lead is oldest goes next.
      const r = await client.query(
        `SELECT tm.user_id FROM team_members tm
           LEFT JOIN leads l ON l.assigned_to = tm.user_id
          WHERE tm.team_id = $1
          GROUP BY tm.user_id
          ORDER BY MAX(l.created_at) ASC NULLS FIRST, RANDOM()
          LIMIT 1`, [teamId]);
      if (r.rows[0]) return r.rows[0].user_id;
    } catch {
      // fall through to random pick
    }
    const r = await client.query(`SELECT user_id FROM team_members WHERE team_id = $1 ORDER BY RANDOM() LIMIT 1`, [teamId]);
    return r.rows[0]?.user_id ?? null;
  }

  async matchLead(tenantId: string, lead: RoutingLeadInput): Promise<string | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM routing_rules WHERE is_active = true ORDER BY priority ASC, created_at DESC`
      );
      for (const row of result.rows) {
        const rule = this.rowToEntity<any>(row);
        if (ruleMismatch(rule, lead)) continue;
        const action: any = rule.action || {};
        if (action.type === 'ASSIGN_USER' && action.targetId) return action.targetId;
        if (action.type === 'ASSIGN_TEAM' && action.targetId) {
          const member = await this.pickTeamMember(client, action.targetId, action.strategy);
          if (member) return member;
        }
      }
      return null;
    });
  }

  /** Dry run used by the admin simulator: same matching, no side effects. */
  async simulate(tenantId: string, lead: RoutingLeadInput) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM routing_rules ORDER BY priority ASC, created_at DESC`
      );
      const checked: Array<{ id: string; name: string; active: boolean; failed: string | null }> = [];
      let matched: any = null;
      for (const row of result.rows) {
        const rule = this.rowToEntity<any>(row);
        const active = rule.isActive !== false;
        const failed = active ? ruleMismatch(rule, lead) : 'inactive';
        checked.push({ id: rule.id, name: rule.name, active, failed });
        if (!matched && active && !failed) matched = rule;
      }
      return { matched, checked, normalizedRegion: normalizeRegion(lead.address) };
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(String(data.name).trim());
      }
      if (data.conditions !== undefined) {
        fields.push(`conditions = $${paramIndex++}`);
        values.push(JSON.stringify(cleanConditions(data.conditions)));
      }
      if (data.action !== undefined) {
        fields.push(`action = $${paramIndex++}`);
        values.push(JSON.stringify(data.action));
      }
      if (data.priority !== undefined) {
        fields.push(`priority = $${paramIndex++}`);
        values.push(Number(data.priority) || 0);
      }
      const active = data.isActive !== undefined ? data.isActive : data.enabled;
      if (active !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(!!active);
      }

      if (fields.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE routing_rules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const routingRuleRepository = new RoutingRuleRepository();
