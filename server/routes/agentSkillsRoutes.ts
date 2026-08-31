/**
 * agentSkillsRoutes.ts — P2 #9: Skills catalog cho moi gioi.
 * 13 role prompts (marketingGrowthAgents) duoc seed thanh skills goc.
 * GET /api/admin/agent-skills          — danh sach skills cua tenant
 * POST /api/admin/agent-skills         — tao skill moi tu prompt
 * PATCH /api/admin/agent-skills/:id    — publish/unpublish + visibility
 * POST /api/admin/agent-skills/:id/install — cai skill cho chinh minh (tang counter)
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';

export const agentSkillsRouter = Router();

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

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
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
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
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
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
    res.status(201).json({ skill: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] create failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Tao skill that bai' });
  }
});

agentSkillsRouter.patch('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const { published, visibility } = req.body || {};
    const r = await pool.query(
      "UPDATE agent_skills SET published = COALESCE($2, published), visibility = COALESCE($3, visibility), published_at = CASE WHEN $2::boolean THEN NOW() ELSE published_at END, updated_at = NOW() WHERE id = $1 AND (tenant_id = $4 OR visibility = 'PUBLIC') RETURNING id, skill_key, title, published, visibility",
      [req.params.id, typeof published === 'boolean' ? published : null, visibility ?? null, tenantId],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Skill khong ton tai' });
    res.json({ skill: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] patch failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Cap nhat that bai' });
  }
});

agentSkillsRouter.post('/:id/install', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      "UPDATE agent_skills SET install_count = install_count + 1, updated_at = NOW() WHERE id = $1 RETURNING id, skill_key, install_count",
      [req.params.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Skill khong ton tai' });
    res.json({ installed: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Skills] install failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Cai skill that bai' });
  }
});

