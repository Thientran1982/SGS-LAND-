import { PoolClient } from 'pg';

const BASE_AGENTS = [
  ['ROUTER', 'Bộ định tuyến ý định', 'router', 'Phân loại intent và trích xuất thực thể trước khi dispatch.', '[]'],
  ['WRITER', 'Người viết phản hồi', 'writer', 'Tổng hợp evidence specialist và là agent duy nhất phát ngôn với khách.', '[\"legal\",\"finance\",\"market\",\"product\"]'],
  ['INVENTORY_AGENT', 'Chuyên gia kho hàng', 'inventory_specialist', 'Tra cứu và xếp hạng sản phẩm theo nhu cầu khách.', '[\"product\",\"market\"]'],
  ['FINANCE_AGENT', 'Chuyên gia tài chính', 'finance_specialist', 'Tính khoản vay, lãi suất và khả năng tài chính.', '[\"finance\",\"market\"]'],
  ['LEGAL_AGENT', 'Chuyên gia pháp lý', 'legal_specialist', 'Giải thích hồ sơ và cảnh báo rủi ro pháp lý.', '[\"legal\"]'],
  ['SALES_AGENT', 'Chuyên gia bán hàng', 'sales_specialist', 'Soạn lịch hẹn, tour và bàn giao cho sales.', '[\"product\",\"market\"]'],
  ['MARKETING_AGENT', 'Chuyên gia marketing', 'marketing_specialist', 'Tra cứu chiến dịch, ưu đãi và chiết khấu.', '[\"market\",\"product\"]'],
  ['CONTRACT_AGENT', 'Chuyên gia hợp đồng', 'contract_specialist', 'Giải thích loại hợp đồng và quy trình giao dịch.', '[\"legal\"]'],
] as const;

export async function up(client: PoolClient): Promise<void> {
  for (const [name, displayName, role, description, domains] of BASE_AGENTS) {
    await client.query(
      `INSERT INTO ai_agents
        (tenant_id, name, display_name, role, description, system_instruction, skills, model, active, metadata, knowledge_filter)
       SELECT t.id, $1, $2, $3, $4, $5, '[]'::jsonb, 'gemini-2.5-flash', TRUE,
              jsonb_build_object('seeded_by', 'migration_163', 'runtime_capability', TRUE),
              jsonb_build_object('domains', $6::jsonb)
         FROM tenants t
       ON CONFLICT (tenant_id, role) DO NOTHING;`,
      [name, displayName, role, description, description, domains],
    );
  }
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(
    `DELETE FROM ai_agents
      WHERE metadata->>'seeded_by' = 'migration_163'
        AND role = ANY($1::text[])`,
    [BASE_AGENTS.map(agent => agent[2])],
  );
}

export default {
  up,
  down,
  description: 'Reconcile the eight base runtime agents for every tenant',
};