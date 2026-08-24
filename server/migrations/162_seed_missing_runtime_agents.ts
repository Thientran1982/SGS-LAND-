import { PoolClient } from 'pg';
import { DEFAULT_FOLLOWUP_SYSTEM, DEFAULT_VALUATION_SYSTEM, DEFAULT_VALUATION_SEARCH_SYSTEM, DEFAULT_VALUATION_RENTAL_SYSTEM, DEFAULT_LEAD_ANALYST_SYSTEM } from '../ai/defaultPrompts';

type RuntimeAgent = {
  name: string;
  displayName: string;
  role: string;
  description: string;
  instruction: string;
  skills: Array<{ id: string; name: string; description: string }>;
  domains: string[];
};

const AGENTS: RuntimeAgent[] = [
  {
    name: 'LEAD_ANALYST',
    displayName: 'Lead Analyst — Phân tích khách hàng',
    role: 'lead_analyst',
    description: 'Phân tích nhu cầu, tín hiệu và bước chăm sóc tiếp theo của lead.',
    instruction: DEFAULT_LEAD_ANALYST_SYSTEM,
    skills: [
      { id: 'lead_profile', name: 'Hồ sơ nhu cầu', description: 'Tóm tắt ngân sách, khu vực và ưu tiên của lead.' },
      { id: 'lead_signals', name: 'Tín hiệu hành vi', description: 'Nhận diện mức độ quan tâm, trở ngại và thời điểm mua.' },
      { id: 'next_action', name: 'Bước tiếp theo', description: 'Đề xuất hành động chăm sóc có thể đo lường.' },
    ],
    domains: ['product'],
  },
  {
    name: 'FOLLOWUP_AGENT',
    displayName: 'Follow Up — Chăm sóc khách hàng',
    role: 'followup_agent',
    description: 'Soạn và điều phối follow-up theo consent, lịch D1/D3/D5/D7 và phản hồi của khách.',
    instruction: DEFAULT_FOLLOWUP_SYSTEM,
    skills: [
      { id: 'scheduled_followup', name: 'Follow-up theo lịch', description: 'Soạn nội dung D1/D3/D5/D7 theo trạng thái lead.' },
      { id: 'engagement_handling', name: 'Xử lý tương tác', description: 'Dừng chuỗi khi khách phản hồi hoặc từ chối.' },
      { id: 'consent_safety', name: 'Bảo vệ consent', description: 'Không gửi khi thiếu consent hoặc gặp trạng thái không chắc chắn.' },
    ],
    domains: ['product'],
  },
  {
    name: 'VALUATION_EXTRACT',
    displayName: 'Valuation Extract — Trích xuất giá',
    role: 'valuation_extract',
    description: 'Trích xuất và kiểm tra đơn vị, nguồn và chất lượng dữ liệu giá.',
    instruction: DEFAULT_VALUATION_SYSTEM,
    skills: [
      { id: 'price_extraction', name: 'Trích xuất giá', description: 'Chuẩn hóa giá theo căn, m² và loại bất động sản.' },
      { id: 'unit_check', name: 'Kiểm tra đơn vị', description: 'Phân biệt giá đất, giá sàn, giá thuê và tỷ/căn.' },
    ],
    domains: ['market'],
  },
  {
    name: 'VALUATION_SEARCH',
    displayName: 'Valuation Sale — Giá bán tham chiếu',
    role: 'valuation_search',
    description: 'Tìm và đánh giá dữ liệu giao dịch/rao bán để làm giá bán tham chiếu.',
    instruction: DEFAULT_VALUATION_SEARCH_SYSTEM,
    skills: [
      { id: 'sale_market_search', name: 'Tìm giá bán', description: 'Ưu tiên dữ liệu giao dịch và ghi rõ loại nguồn.' },
      { id: 'project_price_priority', name: 'Ưu tiên giá dự án', description: 'Tách giá dự án cụ thể khỏi giá khu vực.' },
    ],
    domains: ['market'],
  },
  {
    name: 'VALUATION_RENTAL',
    displayName: 'Valuation Rental — Giá thuê & yield',
    role: 'valuation_rental',
    description: 'Phân tích giá thuê thực tế, dòng tiền và tỷ suất cho thuê.',
    instruction: DEFAULT_VALUATION_RENTAL_SYSTEM,
    skills: [
      { id: 'rental_search', name: 'Tìm giá thuê', description: 'Đối chiếu giá thuê theo loại tài sản và khu vực.' },
      { id: 'yield_calculation', name: 'Tính rental yield', description: 'Tính gross/net yield từ dữ liệu đã xác minh.' },
    ],
    domains: ['market'],
  },
];

export async function up(client: PoolClient): Promise<void> {
  for (const agent of AGENTS) {
    await client.query(
      `INSERT INTO ai_agents
        (tenant_id, name, display_name, role, description, system_instruction, skills, model, active, metadata, knowledge_filter)
       SELECT t.id, $1, $2, $3, $4, $5, $6::jsonb, 'gemini-2.5-flash', TRUE,
              jsonb_build_object('seeded_by', 'migration_162', 'runtime_capability', TRUE),
              jsonb_build_object('domains', $7::jsonb)
         FROM tenants t
       ON CONFLICT (tenant_id, role) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description,
         system_instruction = CASE WHEN ai_agents.system_instruction IS NULL OR trim(ai_agents.system_instruction) = '' THEN EXCLUDED.system_instruction ELSE ai_agents.system_instruction END,
         skills = CASE WHEN ai_agents.skills IS NULL OR jsonb_array_length(ai_agents.skills) = 0 THEN EXCLUDED.skills ELSE ai_agents.skills END,
         knowledge_filter = CASE WHEN ai_agents.knowledge_filter IS NULL OR ai_agents.knowledge_filter = '{}'::jsonb THEN EXCLUDED.knowledge_filter ELSE ai_agents.knowledge_filter END,
         active = TRUE,
         updated_at = NOW();`,
      [agent.name, agent.displayName, agent.role, agent.description, agent.instruction, JSON.stringify(agent.skills), JSON.stringify(agent.domains)],
    );
  }

  await client.query(
    `INSERT INTO prompt_templates (tenant_id, name, content, description, category, active_version, versions, variables)
     SELECT t.id, 'FOLLOWUP_SYSTEM', $1, 'Prompt chăm sóc follow-up theo consent và lịch tương tác.', 'specialist', 1, '[]'::jsonb, '[]'::jsonb
       FROM tenants t
     ON CONFLICT (tenant_id, name) DO UPDATE SET
       description = EXCLUDED.description,
       updated_at = NOW()
     WHERE prompt_templates.content IS NULL OR trim(prompt_templates.content) = '';`,
    [DEFAULT_FOLLOWUP_SYSTEM],
  );
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM ai_agents
      WHERE role = ANY($1::text[])
        AND metadata->>'seeded_by' = 'migration_162';`,
    [AGENTS.map(agent => agent.role)],
  );
  await client.query(`DELETE FROM prompt_templates WHERE name = 'FOLLOWUP_SYSTEM' AND content = $1`, [DEFAULT_FOLLOWUP_SYSTEM]);
}

export default {
  up,
  down,
  description: 'Seed missing runtime agents for all governance capabilities and Follow Up prompt',
};