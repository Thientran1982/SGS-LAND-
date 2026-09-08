import type { PoolClient } from 'pg';
import type { Migration } from './runner';
import { LANDING_DESIGN_SYSTEM } from '../ai/landingDesignAgent';

const SKILL_KEY = 'landing-design';
const ROLE = 'landing_design_agent';

const migration: Migration = {
  description: 'Seed the Landing Design Agent and reusable landing-design skill for every tenant.',

  async up(client: PoolClient): Promise<void> {
    const skills = [
      {
        id: 'design_system',
        name: 'Design system',
        description: 'Tạo palette semantic, typography và surface tokens nhất quán.',
      },
      {
        id: 'conversion_hierarchy',
        name: 'Conversion hierarchy',
        description: 'Sắp xếp hero, section và CTA theo mức độ ưu tiên đã xác minh.',
      },
      {
        id: 'responsive_accessibility',
        name: 'Responsive và accessibility',
        description: 'Đảm bảo gallery, contrast, alt text và focus state hoạt động trên mobile.',
      },
    ];

    await client.query(
      `INSERT INTO agent_skills
        (tenant_id, skill_key, title, description, category, author_name, prompt_template, version, visibility, published)
       SELECT t.id, $1, 'Landing Design', $2, 'design', 'SGS LAND',
              $3, 1, 'TENANT', TRUE
         FROM tenants t
       ON CONFLICT (tenant_id, skill_key) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         prompt_template = EXCLUDED.prompt_template,
         version = EXCLUDED.version,
         published = TRUE,
         updated_at = NOW();`,
      [
        SKILL_KEY,
        'Thiết kế structured landing page từ brief, brochure và ảnh đã xác minh; không bịa dữ kiện và không tự publish.',
        LANDING_DESIGN_SYSTEM,
      ],
    );

    await client.query(
      `INSERT INTO ai_agents
        (tenant_id, name, display_name, role, description, system_instruction, skills, model, active, metadata, knowledge_filter)
       SELECT t.id, 'LANDING_DESIGN_AGENT', 'Landing Design Agent', $1, $2, $3, $4::jsonb,
              'gemini-2.5-flash', TRUE,
              jsonb_build_object('seeded_by', 'migration_185', 'runtime_capability', TRUE, 'skill_key', $5::text),
              jsonb_build_object('domains', '["product"]'::jsonb)
         FROM tenants t
       ON CONFLICT (tenant_id, role) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description,
         system_instruction = EXCLUDED.system_instruction,
         skills = EXCLUDED.skills,
         knowledge_filter = EXCLUDED.knowledge_filter,
         active = TRUE,
         updated_at = NOW();`,
      [
        ROLE,
        'Tạo design system và bố cục responsive cho landing bất động sản để Agent Minh sử dụng.',
        LANDING_DESIGN_SYSTEM,
        JSON.stringify(skills),
        SKILL_KEY,
      ],
    );
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DELETE FROM agent_skills WHERE skill_key = $1`, [SKILL_KEY]);
    await client.query(
      `DELETE FROM ai_agents WHERE role = $1 AND metadata->>'seeded_by' = 'migration_185'`,
      [ROLE],
    );
  },
};

export default migration;