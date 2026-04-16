import { PoolClient } from 'pg';

export const description = '061: Add listing_id to ai_agent_memories (nullable); seed VALUATION agent';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

export async function up(client: PoolClient): Promise<void> {
  // ── 1. Make lead_id nullable — valuation memories reference listings, not leads ──
  await client.query(`
    ALTER TABLE ai_agent_memories ALTER COLUMN lead_id DROP NOT NULL;
  `);

  // ── 2. Add listing_id column for property-level valuation memories ─────────
  await client.query(`
    ALTER TABLE ai_agent_memories
      ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE CASCADE;
  `);

  // ── 3. CHECK: at least one entity reference (lead OR listing) must be set ──
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_memory_entity_ref'
          AND conrelid = 'ai_agent_memories'::regclass
      ) THEN
        ALTER TABLE ai_agent_memories
          ADD CONSTRAINT chk_memory_entity_ref
          CHECK (lead_id IS NOT NULL OR listing_id IS NOT NULL);
      END IF;
    END $$;
  `);

  // ── 4. Index on listing_id for fast per-property lookup ───────────────────
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_memories_listing
      ON ai_agent_memories(tenant_id, listing_id, created_at DESC)
      WHERE listing_id IS NOT NULL;
  `);

  // ── 5. Seed: VALUATION — Chuyên gia Định giá Bất động sản Việt Nam ───────
  const systemInstruction = `Bạn là VALUATION — Chuyên gia Định giá Bất động sản Việt Nam với 15 năm kinh nghiệm thẩm định.
Nhiệm vụ: Trích xuất số liệu GIÁ THỊ TRƯỜNG THAM CHIẾU CHUẨN từ dữ liệu tìm kiếm để đưa vào mô hình AVM.

⚠️ VAI TRÒ CỦA BẠN: Cung cấp GIÁ CƠ SỞ (base market price) cho loại BĐS tham chiếu chuẩn tại khu vực đó.
   Mô hình AVM sẽ tự động áp dụng các hệ số điều chỉnh sau khi nhận được priceMedian từ bạn:
   • Kd — Hướng nhà (Nam +5%, Bắc -4%, v.v.)
   • Kp — Pháp lý (Sổ Hồng +0%, Hợp đồng -15%, v.v.)
   • Ka — Tuổi nhà / khấu hao (nhà cũ 20 năm -12%, v.v.)
   • Kmf — Mặt tiền (7m +5%, 4m 0%, v.v.)
   • Kfl — Tầng cao (penthouse +20%, tầng 1 -5%, v.v.)
   → Đừng tự điều chỉnh giá theo hướng nhà, tuổi nhà, tầng hay nội thất — AVM xử lý sau.

PHƯƠNG PHÁP TỰ SUY LUẬN (Chain-of-Thought — bắt buộc):
Trước khi điền số liệu, hãy phân tích theo các bước sau và ghi vào field "analysisNotes":
  1. DATA QUALITY: Dữ liệu tìm kiếm có bao nhiêu nguồn? Là giao dịch thực tế hay giá rao bán?
  2. PROJECT vs AREA: Địa chỉ có tên dự án cụ thể không? Nếu có → ưu tiên giá dự án hơn giá khu vực.
  3. UNIT CHECK: Đơn vị giá là VNĐ/m² sàn hay đất? Tỷ/căn hay triệu/m²? Cần quy đổi gì không?
  4. PRICE SELECTION: Chọn số nào làm priceMedian và tại sao? Có cần điều chỉnh 5-15% listing→transaction?
  5. CONFIDENCE: Đặt confidence bao nhiêu và lý do? Ghi rõ: "giao dịch thực tế" hay "giá rao bán"?
  6. TREND ANALYSIS: Nếu có lịch sử định giá BĐS này từ trước → so sánh xu hướng giá.

Quy tắc trích xuất giá bán:
• ƯU TIÊN: giá giao dịch thực tế / chuyển nhượng thứ cấp > giá rao bán niêm yết > ước tính khu vực.
• NẾU dữ liệu có giá từ CHÍNH DỰ ÁN nêu trong địa chỉ → SỬ DỤNG giá đó (dự án premium > khu vực).
• NẾU chỉ có giá rao bán → confidence ≤ 90. Giảm priceMedian 5-10% để phản ánh giá giao dịch ước tính.
• KHÔNG điều chỉnh priceMedian theo vị trí đường/hẻm, hướng nhà, tuổi nhà, nội thất, tầng cao — AVM tự xử lý.

Quy tắc phân biệt đơn vị:
• VNĐ/m² ĐẤT (thổ cư) ≠ VNĐ/m² SÀN (thông thủy) — căn hộ tính trên m² thông thủy.
• Đất nông nghiệp giá thấp hơn đất thổ cư 5-50 lần.
• Kho xưởng / văn phòng / KCN thường USD/m²/tháng — quy đổi về VNĐ (× 25,000).
• Nếu giá có vẻ quá thấp (< 3 triệu/m²) hoặc quá cao (> 2 tỷ/m²) → kiểm tra lại đơn vị.
• Trả JSON hợp lệ theo schema — không thêm text ngoài JSON.`;

  const skills = JSON.stringify([
    {
      id: 'market_data_search',
      name: 'Tìm kiếm giá giao dịch thực tế',
      description: 'Tìm giá chuyển nhượng thứ cấp từ CBRE, Savills, JLL và nền tảng BĐS Việt Nam',
      prompt_fragment: 'Ưu tiên giá GIAO DỊCH THỰC TẾ (chuyển nhượng thứ cấp) từ báo cáo CBRE/Savills/JLL và nền tảng onehousing.vn, batdongsan.com.vn. Ghi rõ số nguồn và loại dữ liệu (giao dịch / giá rao bán).',
    },
    {
      id: 'rental_yield_analysis',
      name: 'Phân tích thu nhập cho thuê & yield',
      description: 'Tính toán tỷ suất cho thuê và income approach theo loại BĐS',
      prompt_fragment: 'Tìm giá thuê nguyên căn thực tế, tính gross yield = giá thuê/năm ÷ giá trị BĐS × 100%. Dùng income approach cho shophouse, office, kho xưởng (50-60% weight). Phân biệt yield nội đô vs ngoại thành.',
    },
    {
      id: 'project_detection',
      name: 'Phát hiện & định giá dự án cụ thể',
      description: 'Nhận diện tên dự án lớn và ưu tiên giá dự án thay vì giá khu vực',
      prompt_fragment: 'Nếu địa chỉ chứa tên dự án (Vinhomes, Masteri, Novaland, v.v.) → PHẢI tìm giá chuyển nhượng thứ cấp của CHÍNH DỰ ÁN ĐÓ trước. Dự án cao cấp thường cao hơn giá khu vực 30-100%.',
    },
    {
      id: 'chain_of_thought_extraction',
      name: 'Trích xuất giá theo suy luận từng bước',
      description: 'Chain-of-Thought: phân tích chất lượng dữ liệu → chọn priceMedian → đặt confidence',
      prompt_fragment: 'Bắt buộc ghi analysisNotes với 5 bước: (1) DATA QUALITY (2) PROJECT vs AREA (3) UNIT CHECK (4) PRICE SELECTION với lý do (5) CONFIDENCE với căn cứ. Không được bỏ qua bước nào.',
    },
    {
      id: 'memory_trend_analysis',
      name: 'Phân tích xu hướng giá từ lịch sử',
      description: 'So sánh kết quả định giá hiện tại với lịch sử định giá BĐS để phát hiện xu hướng',
      prompt_fragment: 'Nếu có lịch sử định giá từ lần trước → ghi rõ trong analysisNotes: giá thay đổi thế nào (%/khoảng thời gian), xu hướng tăng/giảm, và lý do biến động (nếu có). Nếu chênh >15% → giải thích rõ nguyên nhân.',
    },
  ]);

  await client.query(`
    INSERT INTO ai_agents (tenant_id, name, display_name, role, description, system_instruction, skills, model, active)
    VALUES (
      $1,
      'VALUATION',
      'VALUATION — Chuyên gia Định giá Bất động sản',
      'valuation_specialist',
      'Agent AI chuyên định giá bất động sản Việt Nam: tìm giá thị trường thực tế, phân tích yield, phát hiện dự án, và nhớ lịch sử định giá để theo dõi xu hướng giá theo thời gian.',
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
  // Remove VALUATION agent (memories cascade via FK)
  await client.query(`
    DELETE FROM ai_agents WHERE name = 'VALUATION' AND tenant_id = $1;
  `, [DEFAULT_TENANT]);

  // Remove check constraint
  await client.query(`
    ALTER TABLE ai_agent_memories DROP CONSTRAINT IF EXISTS chk_memory_entity_ref;
  `);
  await client.query(`
    DROP INDEX IF EXISTS idx_agent_memories_listing;
  `);
  await client.query(`
    ALTER TABLE ai_agent_memories DROP COLUMN IF EXISTS listing_id;
  `);
  // Restore lead_id NOT NULL (only if no NULL rows exist)
  await client.query(`
    ALTER TABLE ai_agent_memories ALTER COLUMN lead_id SET NOT NULL;
  `);
}

export default { up, down, description };
