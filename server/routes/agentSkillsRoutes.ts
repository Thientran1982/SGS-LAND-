/**
 * agentSkillsRoutes.ts — P2 #9: Skills catalog cho moi gioi.
 * 13 role prompts (marketingGrowthAgents) duoc seed thanh skills goc.
 * GET /api/admin/agent-skills          — danh sach skills cua tenant
 * POST /api/admin/agent-skills         — tao skill moi tu prompt
 * PATCH /api/admin/agent-skills/:id    — publish/unpublish + visibility
 * POST /api/admin/agent-skills/:id/install — ghi nhận cài skill vào catalog
 * POST /api/admin/agent-skills/:id/activate — manager activate skill cho một agent
 * POST /api/admin/agent-skills/:id/deactivate — manager pause skill runtime
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { pool, withRlsBypass, withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';
import { clearPromptCache } from '../ai';

export const agentSkillsRouter = Router();

const MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MARKETING']);

function authenticatedTenant(req: Request, res: Response): string | null {
  const tenantId = String((req as any).user?.tenantId || '').trim();
  if (!tenantId) {
    res.status(403).json({ error: 'Không xác định được tenant của người dùng' });
    return null;
  }
  return tenantId;
}

function requireManager(req: Request, res: Response): string | null {
  const tenantId = authenticatedTenant(req, res);
  if (!tenantId) return null;
  if (!MANAGER_ROLES.has(String((req as any).user?.role || ''))) {
    res.status(403).json({ error: 'Chỉ quản lý mới có thể tạo hoặc quản lý skill' });
    return null;
  }
  return tenantId;
}

const SEED_ROLES: Array<{ key: string; title: string; category: string; desc: string }> = [
  { key: 'content-radar', title: 'Content Radar', category: 'marketing', desc: 'Theo doi noi dung thi truong BĐS va de xuat chu de.' },
  { key: 'revenue-signal', title: 'Revenue Signal', category: 'sales', desc: 'Phat hien tin hieu doanh thu tu du lieu lead.' },
  { key: 'competitive-intelligence', title: 'Competitive Intelligence', category: 'marketing', desc: 'Phan tich doi thu: gia, ton kho, chien dich.' },
  { key: 'project-page', title: 'Project Page', category: 'content', desc: 'Viet va cap nhat trang du an bat dong san.' },
  { key: 'pricing-inventory-sync', title: 'Pricing/Inventory Sync', category: 'ops', desc: 'Dong bo gia va ton kho du an.' },
  { key: 'repurposing', title: 'Repurposing', category: 'content', desc: 'Bien 1 noi dung thanh nhieu dinh dang khac.' },
  { key: 'lead-qualification', title: 'Lead Qualification', category: 'sales', desc: 'Cham diem va phan loai lead tu chat.' },
  { key: 'outreach', title: 'Outreach', category: 'sales', desc: 'Soan email/tin nhang tu van tu dong.' },
  { key: 'broker-enablement', title: 'Broker Enablement', category: 'training', desc: 'Huan luyen moi gioi ve san pham moi.' },
  { key: 'valuation-qa', title: 'AI Valuation QA', category: 'ops', desc: 'Kiem tra chat luong dinh gia AI.' },
  { key: 'marketing-analyst', title: 'Marketing Analyst', category: 'marketing', desc: 'Phan tich hieu qua chi tieu marketing.' },
  { key: 'compliance-guardian', title: 'Compliance/Legal Guardian', category: 'legal', desc: 'Kiem soat noi dung phu hop phap ly BĐS.' },
  { key: 'seo-aeo-auditor', title: 'SEO/AEO Auditor', category: 'marketing', desc: 'Kiem toan SEO va tra loi may tim kiem.' },
];

async function ensureSeedSkills(tenantId: string): Promise<void> {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM agent_skills WHERE tenant_id = $1', [tenantId]);
  if ((r.rows[0]?.n ?? 0) > 0) return;
  for (const s of SEED_ROLES) {
    await pool.query(
      `INSERT INTO agent_skills (tenant_id, skill_key, title, description, category, prompt_template, published, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,'TENANT')
       ON CONFLICT (tenant_id, skill_key) DO NOTHING`,
      [tenantId, s.key, s.title, s.desc, s.category, '-- Skill goc tu role ' + s.key + '. Moi gioi sao chep va bien the.'],
    );
  }
}


agentSkillsRouter.get('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    await ensureSeedSkills(tenantId);
    const r = await pool.query(
      "SELECT id, skill_key, title, description, category, author_name, version, visibility, published, install_count, CASE WHEN rating_count = 0 THEN 0 ELSE ROUND(rating_sum::numeric / rating_count, 1) END AS rating, created_at FROM agent_skills WHERE tenant_id = $1 OR (visibility = 'PUBLIC' AND published = TRUE) ORDER BY published DESC, install_count DESC, created_at DESC",
      [tenantId],
    );
    res.json({ skills: r.rows });
  } catch (err: any) {
    logger.warn('[Skills] list failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc danh sach skills' });
  }
});

agentSkillsRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = requireManager(req, res);
    if (!tenantId) return;
    const { skill_key, title, description, category, prompt_template, visibility } = req.body || {};
    if (!skill_key || !title || !prompt_template) {
      return res.status(400).json({ error: 'skill_key, title, prompt_template la bat buoc' });
    }
    if (!/^[a-z0-9-]{3,64}$/.test(String(skill_key))) {
      return res.status(400).json({ error: 'skill_key chi gom a-z 0-9 va dau gach (3-64)' });
    }
    const r = await pool.query(
      "INSERT INTO agent_skills (tenant_id, skill_key, title, description, category, prompt_template, author_id, author_name, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tenant_id, skill_key) DO UPDATE SET title = EXCLUDED.title, prompt_template = EXCLUDED.prompt_template, description = EXCLUDED.description, version = agent_skills.version + 1, updated_at = NOW() RETURNING id, skill_key, title, version",
      [tenantId, skill_key, title, description || null, category || 'sales', String(prompt_template).slice(0, 20000), user?.id || null, user?.name || 'Admin', visibility || 'PRIVATE'],
    );
    await clearRuntimePromptCache(tenantId);
    res.status(201).json({ skill: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] create failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Tao skill that bai' });
  }
});

agentSkillsRouter.patch('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = requireManager(req, res);
    if (!tenantId) return;
    const { published, visibility, prompt_template } = req.body || {};
    if (
      prompt_template !== undefined
      && (typeof prompt_template !== 'string' || !prompt_template.trim())
    ) {
      return res.status(400).json({ error: 'prompt_template phai la chuoi khong rong' });
    }
    const r = await pool.query(
      `UPDATE agent_skills
          SET prompt_template = COALESCE($2, prompt_template),
              published = COALESCE($3, published),
              visibility = COALESCE($4, visibility),
              version = CASE
                WHEN $2::text IS NOT NULL AND $2::text IS DISTINCT FROM prompt_template
                  THEN version + 1
                ELSE version
              END,
              published_at = CASE WHEN $3::boolean THEN NOW() ELSE published_at END,
              updated_at = NOW()
        WHERE id = $1
          AND tenant_id = $5
      RETURNING id, skill_key, title, prompt_template, version, published, visibility`,
      [
        req.params.id,
        prompt_template !== undefined ? String(prompt_template).slice(0, 20000) : null,
        typeof published === 'boolean' ? published : null,
        visibility ?? null,
        tenantId,
      ],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Skill khong ton tai' });
    await clearRuntimePromptCachesForSkill(String(req.params.id), tenantId);
    res.json({ skill: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] patch failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Cap nhat that bai' });
  }
});

agentSkillsRouter.post('/:id/install', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const r = await pool.query(
      "UPDATE agent_skills SET install_count = install_count + 1, updated_at = NOW() WHERE id = $1 AND (tenant_id = $2 OR (visibility = 'PUBLIC' AND published = TRUE)) RETURNING id, skill_key, install_count",
      [req.params.id, tenantId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Skill khong ton tai' });
    res.json({ installed: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] install failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Cai skill that bai' });
  }
});

agentSkillsRouter.get('/runtime', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const result = await withTenantContext(tenantId, (client) => client.query(
      `SELECT a.id,
              a.name,
              a.display_name,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'binding_id', b.id,
                    'skill_id', s.id,
                    'skill_key', s.skill_key,
                    'title', s.title,
                    'version', s.version,
                    'visibility', s.visibility,
                    'source_tenant_id', s.tenant_id,
                    'activated_at', b.activated_at
                  )
                  ORDER BY b.activated_at ASC, s.skill_key ASC
                ) FILTER (WHERE b.id IS NOT NULL AND s.id IS NOT NULL),
                '[]'::jsonb
              ) AS active_skills
         FROM ai_agents a
         LEFT JOIN agent_skill_bindings b
           ON b.agent_id = a.id
          AND b.tenant_id = $1
          AND b.status = 'ACTIVE'
         LEFT JOIN agent_skills s
           ON s.id = b.skill_id
          AND (
            s.tenant_id = $1
            OR (s.visibility = 'PUBLIC' AND s.published = TRUE)
          )
        WHERE a.tenant_id = $1
          AND a.active = TRUE
        GROUP BY a.id, a.name, a.display_name
        ORDER BY a.name ASC`,
      [tenantId],
    ));
    res.json({ agents: result.rows });
  } catch (err: any) {
    logger.warn('[Skills] runtime list failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc skill dang kich hoat' });
  }
});

async function clearRuntimePromptCache(tenantId: string): Promise<void> {
  try {
    clearPromptCache(tenantId);
  } catch (err) {
    logger.warn('[Skills] prompt cache clear failed: ' + (err as any)?.message);
  }
}

async function clearRuntimePromptCachesForSkill(skillId: string, ownerTenantId: string): Promise<void> {
  const tenantIds = new Set([ownerTenantId]);
  try {
    const activeBindings = await withRlsBypass((client) => client.query(
      `SELECT DISTINCT tenant_id::text AS tenant_id
         FROM agent_skill_bindings
        WHERE skill_id = $1
          AND status = 'ACTIVE'`,
      [skillId],
    ));
    for (const row of activeBindings.rows) {
      if (row.tenant_id) tenantIds.add(String(row.tenant_id));
    }
  } catch (err) {
    logger.warn('[Skills] public skill tenant cache lookup failed: ' + (err as any)?.message);
  }

  await Promise.all([...tenantIds].map((tenantId) => clearRuntimePromptCache(tenantId)));
}

agentSkillsRouter.post('/:id/activate', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = requireManager(req, res);
    if (!tenantId) return;

    const agentId = String(req.body?.agent_id || '').trim();
    if (!agentId) {
      return res.status(400).json({ error: 'agent_id la bat buoc de activate skill' });
    }

    const skill = await pool.query(
      `SELECT id, skill_key, title, version, visibility, published, tenant_id
         FROM agent_skills
        WHERE id = $1
          AND (
            tenant_id = $2
            OR (visibility = 'PUBLIC' AND published = TRUE)
          )
        LIMIT 1`,
      [req.params.id, tenantId],
    );
    if (!skill.rows[0]) return res.status(404).json({ error: 'Skill khong ton tai hoac chua duoc publish' });

    const agent = await pool.query(
      `SELECT id, name, display_name
         FROM ai_agents
        WHERE id = $1
          AND tenant_id = $2
          AND active = TRUE
        LIMIT 1`,
      [agentId, tenantId],
    );
    if (!agent.rows[0]) return res.status(404).json({ error: 'Agent khong ton tai trong tenant hien tai' });

    const binding = await withTenantContext(tenantId, (client) => client.query(
      `INSERT INTO agent_skill_bindings
         (tenant_id, agent_id, skill_id, status, activated_by, activated_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (tenant_id, agent_id, skill_id)
       DO UPDATE SET
         status = 'ACTIVE',
         activated_by = EXCLUDED.activated_by,
         activated_at = NOW(),
         updated_at = NOW()
       RETURNING id, tenant_id, agent_id, skill_id, status, activated_at`,
      [tenantId, agent.rows[0].id, skill.rows[0].id, user?.id || null],
    ));
    await clearRuntimePromptCache(tenantId);
    res.json({ binding: binding.rows[0], agent: agent.rows[0], skill: skill.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] activate failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong the activate skill' });
  }
});

agentSkillsRouter.post('/:id/deactivate', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = requireManager(req, res);
    if (!tenantId) return;
    const agentId = String(req.body?.agent_id || '').trim();
    if (!agentId) {
      return res.status(400).json({ error: 'agent_id la bat buoc de deactivate skill' });
    }

    const result = await withTenantContext(tenantId, (client) => client.query(
      `UPDATE agent_skill_bindings
          SET status = 'PAUSED', updated_at = NOW()
        WHERE tenant_id = $1
          AND agent_id = $2
          AND skill_id = $3
          AND status = 'ACTIVE'
      RETURNING id, tenant_id, agent_id, skill_id, status, updated_at`,
      [tenantId, agentId, req.params.id],
    ));
    if (result.rowCount === 0) return res.status(404).json({ error: 'Skill chua duoc activate cho agent nay' });
    await clearRuntimePromptCache(tenantId);
    res.json({ binding: result.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] deactivate failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong the deactivate skill' });
  }
});

