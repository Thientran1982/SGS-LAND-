import { PoolClient } from 'pg';

export const description = '060: Create ai_agents and ai_agent_memories tables; seed ARIA persona analyst agent';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

export async function up(client: PoolClient): Promise<void> {
  // ── ai_agents: named AI agents with upgradeable skills ────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_agents (
      id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name               VARCHAR(100) NOT NULL,
      display_name       VARCHAR(255) NOT NULL,
      role               VARCHAR(100) NOT NULL,
      description        TEXT,
      system_instruction TEXT NOT NULL,
      skills             JSONB NOT NULL DEFAULT '[]'::jsonb,
      model              VARCHAR(100),
      active             BOOLEAN NOT NULL DEFAULT true,
      metadata           JSONB DEFAULT '{}'::jsonb,
      created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, name)
    );
  `);

  // ── ai_agent_memories: per-lead analysis history ──────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_agent_memories (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      agent_id    UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
      lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      summary     TEXT NOT NULL,
      signals     JSONB DEFAULT '{}'::jsonb,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_memories_lead
      ON ai_agent_memories(tenant_id, lead_id, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_memories_agent
      ON ai_agent_memories(agent_id, created_at DESC);
  `);

  // ── Enable RLS ─────────────────────────────────────────────────────────────
  for (const tbl of ['ai_agents', 'ai_agent_memories']) {
    await client.query(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = '${tbl}'
            AND policyname = '${tbl}_tenant_isolation'
        ) THEN
          CREATE POLICY ${tbl}_tenant_isolation ON ${tbl}
            USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
  }

  // ── Seed: ARIA — Chuyên gia Phân tích Chân dung Khách hàng ───────────────
  const systemInstruction = `Bạn là ARIA — Chuyên gia Phân tích Chân dung Khách hàng Bất động sản hàng đầu Việt Nam.
Hồ sơ: 15+ năm kinh nghiệm thực chiến tư vấn BĐS, am hiểu tâm lý người mua Việt Nam, thành thạo phân tích hành vi và dự đoán quyết định mua.
Sứ mệnh: Cung cấp phân tích chân dung khách hàng chính xác, sắc bén và có tính hành động cao để giúp đội sale chốt deal hiệu quả hơn.
Nguyên tắc:
- Chỉ kết luận từ dữ liệu thực tế trong hồ sơ. Không suy diễn vô căn cứ.
- Ưu tiên insight actionable hơn nhận xét chung chung.
- Tham chiếu lịch sử phân tích trước nếu có để cung cấp đánh giá tiến triển.
- Văn phong: Chuyên nghiệp, súc tích, như báo cáo của chuyên gia tư vấn cao cấp.
Định dạng đầu ra: Văn xuôi đánh số 1-4, KHÔNG dùng markdown, KHÔNG dùng ký tự **, #, -, •.`;

  const skills = JSON.stringify([
    {
      id: 'persona_typing',
      name: 'Phân loại chân dung',
      description: 'Xác định loại khách hàng, mức độ nghiêm túc và khả năng ra quyết định',
      prompt_fragment: 'Phân loại: mua ở thực / đầu tư / lướt sóng / tìm hiểu. Đánh giá mức độ nghiêm túc và khả năng ra quyết định dựa trên dữ liệu thực.',
    },
    {
      id: 'core_need_detection',
      name: 'Phát hiện nhu cầu cốt lõi',
      description: 'Tìm động lực mua thực sự và áp lực ẩn',
      prompt_fragment: 'Xác định động lực mua thực sự (có thể khác điều họ nói). Tìm áp lực ẩn: deadline gia đình, áp lực tài chính, kỳ vọng sinh lời.',
    },
    {
      id: 'risk_assessment',
      name: 'Đánh giá rủi ro deal',
      description: 'Phát hiện rào cản, lo ngại và nguy cơ mất deal',
      prompt_fragment: 'Đánh giá: tâm trạng hiện tại, rào cản tài chính/pháp lý/gia đình, dấu hiệu do dự hoặc so sánh đa dự án.',
    },
    {
      id: 'closing_strategy',
      name: 'Chiến lược chốt deal',
      description: 'Đề xuất hành động cụ thể trong 24-48h',
      prompt_fragment: 'Đề xuất 1-2 bước cụ thể nhất cho sale thực hiện trong 24-48h để đẩy deal tiến lên. Hành động phải khả thi, đo đếm được.',
    },
    {
      id: 'memory_continuity',
      name: 'Tiếp nối lịch sử phân tích',
      description: 'Tham chiếu các lần phân tích trước để theo dõi tiến triển',
      prompt_fragment: 'Nếu có lịch sử phân tích trước, so sánh với hiện tại: tâm trạng khách đã thay đổi thế nào, deal tiến triển hay thoái lui?',
    },
  ]);

  await client.query(`
    INSERT INTO ai_agents (tenant_id, name, display_name, role, description, system_instruction, skills, model, active)
    VALUES (
      $1,
      'ARIA',
      'ARIA — Chuyên gia Phân tích Chân dung Khách hàng',
      'persona_analyst',
      'Agent AI chuyên phân tích chân dung tâm lý, hành vi mua và chiến lược chốt deal cho từng khách hàng BĐS.',
      $2,
      $3::jsonb,
      NULL,
      true
    )
    ON CONFLICT (tenant_id, name) DO UPDATE SET
      display_name       = EXCLUDED.display_name,
      description        = EXCLUDED.description,
      system_instruction = EXCLUDED.system_instruction,
      skills             = EXCLUDED.skills,
      updated_at         = CURRENT_TIMESTAMP;
  `, [DEFAULT_TENANT, systemInstruction, skills]);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS ai_agent_memories CASCADE;`);
  await client.query(`DROP TABLE IF EXISTS ai_agents CASCADE;`);
}

export default { up, down, description };
