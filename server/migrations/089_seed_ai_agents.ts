import { PoolClient } from 'pg';

const SEED_AGENTS: Array<{
  role: string;
  name: string;
  display_name: string;
  description: string;
  skills: any[];
}> = [
  {
    role: 'router',
    name: 'ROUTER',
    display_name: 'Bộ định tuyến ý định',
    description: 'Phân loại 11 loại ý định khách hàng và trích xuất thực thể (ngân sách, khu vực, loại BĐS).',
    skills: [
      { id: 'intent_classification', name: 'Phân loại ý định', description: 'Nhận biết 11 ý định: SEARCH_INVENTORY, CALCULATE_LOAN, EXPLAIN_LEGAL...' },
      { id: 'entity_extraction', name: 'Trích xuất thực thể', description: 'Tách ngân sách, khu vực, diện tích, loại BĐS từ tin nhắn' },
      { id: 'language_detection', name: 'Phát hiện ngôn ngữ', description: 'Tự động chuyển vi/en theo lead' },
    ],
  },
  {
    role: 'inventory_specialist',
    name: 'INVENTORY_AGENT',
    display_name: 'Chuyên gia kho hàng',
    description: 'Tra cứu kho, xếp hạng Top 3 BĐS phù hợp, phân tích ưu/nhược điểm từng căn.',
    skills: [
      { id: 'inventory_search', name: 'Tìm kiếm kho', description: 'Filter động theo budget/area/type' },
      { id: 'ranking', name: 'Xếp hạng Top-K', description: 'Score listing theo preference của lead' },
      { id: 'pros_cons', name: 'Phân tích ưu nhược', description: 'Đánh giá khách quan từng listing' },
    ],
  },
  {
    role: 'finance_specialist',
    name: 'FINANCE_AGENT',
    display_name: 'Chuyên gia tài chính',
    description: 'Tính kịch bản vay, lãi suất hàng tháng, đánh giá DTI/LTV, lấy lãi suất NH thực tế.',
    skills: [
      { id: 'loan_calculator', name: 'Tính khoản vay', description: 'Amortization schedule cho vay BĐS' },
      { id: 'bank_rates_lookup', name: 'Lãi suất ngân hàng', description: 'Real-time qua Google Search Grounding' },
      { id: 'affordability', name: 'Đánh giá khả năng', description: 'DTI/LTV theo thu nhập khách' },
    ],
  },
  {
    role: 'legal_specialist',
    name: 'LEGAL_AGENT',
    display_name: 'Chuyên gia pháp lý',
    description: 'Tư vấn Sổ hồng, HĐMB, Vi bằng, Luật Đất đai 2024, tranh chấp BĐS.',
    skills: [
      { id: 'land_law_2024', name: 'Luật Đất đai 2024', description: 'Cập nhật điều khoản mới nhất' },
      { id: 'document_explanation', name: 'Giải thích pháp lý', description: 'Sổ hồng/Sổ đỏ/HĐMB/Vi bằng' },
      { id: 'risk_warning', name: 'Cảnh báo rủi ro', description: 'Phát hiện giao dịch bất thường' },
    ],
  },
  {
    role: 'sales_specialist',
    name: 'SALES_AGENT',
    display_name: 'Chuyên gia bán hàng',
    description: 'Đặt lịch xem nhà, tour dự án, cung cấp thông tin liên hệ Sales.',
    skills: [
      { id: 'booking_drafting', name: 'Soạn lịch hẹn', description: 'Đề xuất khung giờ phù hợp' },
      { id: 'tour_planning', name: 'Lập lịch tour', description: 'Multi-listing tour optimization' },
      { id: 'sales_handoff', name: 'Bàn giao Sales', description: 'Tóm tắt cho Sale chuẩn bị gặp khách' },
    ],
  },
  {
    role: 'marketing_specialist',
    name: 'MARKETING_AGENT',
    display_name: 'Chuyên gia marketing',
    description: 'Cung cấp khuyến mãi, chiết khấu, chiến dịch đang chạy.',
    skills: [
      { id: 'campaign_lookup', name: 'Tra cứu campaign', description: 'Active promotions theo dự án' },
      { id: 'discount_calc', name: 'Tính chiết khấu', description: 'Áp dụng combo voucher/early-bird' },
    ],
  },
  {
    role: 'contract_specialist',
    name: 'CONTRACT_AGENT',
    display_name: 'Chuyên gia hợp đồng',
    description: 'Giải thích HĐ Đặt cọc/Mua bán/Thuê, quy trình giao dịch.',
    skills: [
      { id: 'contract_types', name: 'Loại hợp đồng', description: 'Cọc/MBB/Thuê/Phân phối' },
      { id: 'transaction_flow', name: 'Quy trình giao dịch', description: '7 bước từ đặt cọc đến sang tên' },
      { id: 'clause_review', name: 'Soát điều khoản', description: 'Phát hiện điều khoản bất lợi' },
    ],
  },
  {
    role: 'writer',
    name: 'WRITER',
    display_name: 'Người viết phản hồi',
    description: 'Tổng hợp output từ specialist agents, trả lời khách hàng theo Persona thương hiệu.',
    skills: [
      { id: 'brand_voice', name: 'Giọng thương hiệu', description: 'Match tone tenant (formal/casual)' },
      { id: 'response_synthesis', name: 'Tổng hợp phản hồi', description: 'Hợp nhất context từ nhiều agent' },
      { id: 'memory_digest', name: 'Tóm tắt lịch sử', description: 'Compress >12 tin nhắn cũ' },
    ],
  },
];

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_agents_tenant_role
      ON ai_agents (tenant_id, role);
  `);

  await client.query(`
    UPDATE ai_agents
       SET model = 'gemini-2.5-flash',
           updated_at = NOW()
     WHERE model IS NULL OR TRIM(model) = '';
  `);

  for (const agent of SEED_AGENTS) {
    await client.query(
      `
      INSERT INTO ai_agents (
        tenant_id, name, display_name, role, description,
        system_instruction, skills, model, active, metadata, created_at, updated_at
      )
      SELECT
        t.id,
        $1, $2, $3, $4,
        '',
        $5::jsonb,
        'gemini-2.5-flash',
        TRUE,
        jsonb_build_object('seeded_by', 'migration_089', 'seeded_at', NOW()::text),
        NOW(), NOW()
      FROM tenants t
      ON CONFLICT (tenant_id, role) DO NOTHING;
      `,
      [agent.name, agent.display_name, agent.role, agent.description, JSON.stringify(agent.skills)]
    );
  }
};

const down = async (client: PoolClient): Promise<void> => {
  const roles = SEED_AGENTS.map(a => a.role);
  await client.query(
    `DELETE FROM ai_agents
      WHERE role = ANY($1::text[])
        AND metadata->>'seeded_by' = 'migration_089';`,
    [roles]
  );
  await client.query(`DROP INDEX IF EXISTS uniq_ai_agents_tenant_role;`);
};

export default {
  up,
  down,
  description: 'Seed 8 missing AI agents per tenant + backfill model column',
};
