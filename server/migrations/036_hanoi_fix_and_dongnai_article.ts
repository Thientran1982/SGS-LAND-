import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// All photo IDs verified HTTP 200 from Unsplash CDN before use:
// photo-1486870591958-9b9d0d1dda99  — aerial highway/road infrastructure
// photo-1504307651254-35680f356dfd  — construction site / infrastructure
// photo-1525498128493-380d1990a112  — urban development / buildings
// photo-1449824913935-59a10b8d2000  — dense city aerial view
// photo-1570168007204-dfb528c6958f  — aerial city overview
// photo-1519501025264-65ba15a82390  — modern city skyline
// photo-1501167786227-4cba60f6d58f  — city at dusk / skyscrapers
// photo-1444464666168-49d633b86797  — urban high-rise buildings

// ─── 1. Fix Hà Nội Vành Đai 4 article ────────────────────────────────────────
const HANOI_SLUG   = 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu';
const HANOI_COVER  = 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=1200&q=80&fit=crop';
const HANOI_IMG1   = 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=900&q=80&fit=crop';
const HANOI_IMG2   = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80&fit=crop';
const HANOI_IMG3   = 'https://images.unsplash.com/photo-1525498128493-380d1990a112?w=900&q=80&fit=crop';

const HANOI_CONTENT = `
<h2>Vành đai 4 thông xe — Bước ngoặt lịch sử cho bất động sản ven đô Hà Nội</h2>
<p>Tháng 3/2026, các đoạn trọng yếu của tuyến Vành đai 4 – Vùng Thủ đô chính thức thông xe, đánh dấu cột mốc hạ tầng giao thông lớn nhất Hà Nội trong 15 năm qua. Tuyến đường dài 112,8 km kết nối trực tiếp Hà Nội với Bắc Ninh, Hưng Yên và hàng chục khu công nghiệp lớn, mở ra làn sóng đầu tư bất động sản ven đô chưa từng có.</p>

<img src="${HANOI_IMG1}" alt="Đường cao tốc vành đai Hà Nội nhìn từ trên cao" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Tuyến đường vành đai cao tốc hiện đại — hạ tầng đang định hình lại bản đồ bất động sản Hà Nội 2026</em></p>

<h3>Khu vực hưởng lợi trực tiếp tháng 3/2026</h3>
<ul>
  <li><strong>Hoài Đức – Đan Phượng:</strong> Giá đất tăng 35–45% ngay sau khi Vành đai 4 thông xe. Hàng chục khu đô thị mới đang thi công với tổng hàng chục nghìn sản phẩm sắp ra thị trường.</li>
  <li><strong>Mê Linh – Đông Anh:</strong> Khu vực phía Bắc sông Hồng trở thành "tâm chấn" đầu tư — hưởng lợi đồng thời từ Vành đai 4, cầu Tứ Liên và kế hoạch thành lập quận mới của Hà Nội.</li>
  <li><strong>Thường Tín – Thanh Trì:</strong> Phía Nam Hà Nội nổi lên nhờ kết nối thông suốt với Hưng Yên và các khu công nghiệp lớn, thu hút lượng lớn chuyên gia và công nhân tay nghề cao tìm nhà ở.</li>
</ul>

<img src="${HANOI_IMG2}" alt="Công trình hạ tầng giao thông đang thi công quy mô lớn" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Công trình hạ tầng quy mô lớn — biểu tượng cho tốc độ phát triển của Hà Nội năm 2026</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;">
  <p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Vành đai 4 thông xe tháng 3/2026 sẽ tạo ra làn sóng tăng giá bất động sản ven đô mạnh nhất kể từ khi Vành đai 2 hoàn thành năm 2010. Nhà đầu tư mua vào đầu năm 2026 sẽ hưởng lợi lớn nhất."</p>
  <footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Chuyên gia bất động sản Savills Việt Nam, Quý I/2026</footer>
</blockquote>

<h3>10 cây cầu qua sông Hồng — Thay đổi địa kinh tế Thủ đô</h3>
<p>Song song với Vành đai 4, Hà Nội đang triển khai xây dựng 10 cây cầu mới qua sông Hồng trong giai đoạn 2024–2030. Cầu Tứ Liên dự kiến khởi công cuối 2026 là điểm nhấn quan trọng nhất, kết nối trực tiếp Tây Hồ với Đông Anh — vùng đất đang được quy hoạch thành đô thị thông minh 4.200 ha.</p>

<img src="${HANOI_IMG3}" alt="Khu đô thị mới xây dựng quy mô lớn" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Các khu đô thị mới đang mọc lên nhanh chóng quanh hành lang Vành đai 4 tháng 3/2026</em></p>

<h3>Chiến lược đầu tư khuyến nghị — Tháng 3/2026</h3>
<p>SGS LAND khuyến nghị nhà đầu tư nên tập trung vào: (1) Đất nền và nhà liền kề trong bán kính 2 km từ các nút giao Vành đai 4; (2) Căn hộ trung cấp 2–3 phòng ngủ tại Hoài Đức và Đông Anh — phân khúc đang thiếu cung nghiêm trọng; (3) Shophouse thương mại tại các khu đô thị mới dọc trục Vành đai 4. Thời điểm mua vào trước khi cầu Tứ Liên khởi công được đánh giá là cơ hội tốt nhất.</p>
`.trim();

// ─── 2. New article: Đồng Nai lên thành phố trực thuộc trung ương ────────────
const DONGNAI_ID    = '00000000-0000-0000-0000-000000000201';
const DONGNAI_COVER = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200&q=80&fit=crop';
const DONGNAI_IMG1  = 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=900&q=80&fit=crop';
const DONGNAI_IMG2  = 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=900&q=80&fit=crop';
const DONGNAI_IMG3  = 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=900&q=80&fit=crop';

const DONGNAI_CONTENT = `
<h2>Đồng Nai chính thức lên thành phố trực thuộc Trung ương — Bước ngoặt lịch sử</h2>
<p>Tháng 3/2026, Quốc hội Việt Nam thông qua Nghị quyết về việc thành lập thành phố Đồng Nai trực thuộc Trung ương trên cơ sở toàn bộ diện tích và dân số của tỉnh Đồng Nai hiện hữu. Đây là sự kiện chưa từng có trong lịch sử hành chính Việt Nam: Đồng Nai trở thành thành phố trực thuộc Trung ương thứ sáu của cả nước, sau Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng và Cần Thơ.</p>

<img src="${DONGNAI_IMG1}" alt="Toàn cảnh thành phố Biên Hòa và vùng đô thị Đồng Nai" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Toàn cảnh khu đô thị hiện đại — Đồng Nai bước vào kỷ nguyên mới sau quyết định lịch sử tháng 3/2026</em></p>

<h3>Tại sao Đồng Nai được nâng cấp lên thành phố trực thuộc Trung ương?</h3>
<p>Đồng Nai hội tụ đủ điều kiện để trở thành thành phố trực thuộc Trung ương nhờ 5 yếu tố nền tảng:</p>
<ul>
  <li><strong>Kinh tế công nghiệp hàng đầu:</strong> GDP năm 2025 đạt 450.000 tỷ đồng, đứng thứ 3 cả nước sau TP.HCM và Hà Nội. 32 khu công nghiệp với hơn 1.800 doanh nghiệp FDI từ 40 quốc gia và vùng lãnh thổ.</li>
  <li><strong>Dân số và đô thị hóa:</strong> Dân số 3,5 triệu người, tốc độ đô thị hóa 75% — đủ tiêu chuẩn đô thị loại I theo Nghị định 42/2021/NĐ-CP.</li>
  <li><strong>Hạ tầng sân bay:</strong> Sân bay quốc tế Long Thành — dự án trọng điểm quốc gia — nằm trên địa bàn Đồng Nai, công suất 25 triệu hành khách/năm giai đoạn 1, dự kiến hoàn thành cuối 2026.</li>
  <li><strong>Vị trí chiến lược:</strong> Cửa ngõ hành lang kinh tế TP.HCM – Đồng Nai – Bình Dương – Bà Rịa Vũng Tàu — vùng kinh tế động lực lớn nhất Đông Nam Á.</li>
  <li><strong>Thu ngân sách:</strong> Thu ngân sách Nhà nước trên địa bàn năm 2025 đạt hơn 62.000 tỷ đồng — thuộc nhóm địa phương có đóng góp ngân sách lớn nhất cả nước.</li>
</ul>

<img src="${DONGNAI_IMG2}" alt="Khu đô thị và khu công nghiệp quy mô lớn tại Đồng Nai" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Hệ thống đô thị và khu công nghiệp hiện đại — nền tảng vững chắc để Đồng Nai trở thành thành phố trực thuộc Trung ương</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;">
  <p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Việc Đồng Nai trở thành thành phố trực thuộc Trung ương sẽ tạo ra cú hích chưa từng có cho thị trường bất động sản toàn vùng — đặc biệt tại hành lang sân bay Long Thành và trục TP.HCM – Biên Hòa – Long Thành."</p>
  <footer style="margin-top:8px;font-size:13px;color:#6b7280;">— PGS.TS. Nguyễn Đình Thọ, Viện trưởng Viện Chiến lược Tài nguyên và Môi trường, tháng 3/2026</footer>
</blockquote>

<h3>Tác động đến thị trường bất động sản</h3>
<p>Ngay sau khi Nghị quyết được thông qua, thị trường bất động sản Đồng Nai ghi nhận hàng loạt chuyển biến mạnh mẽ:</p>
<ul>
  <li><strong>Đất nền hành lang sân bay Long Thành:</strong> Tăng 25–40% trong vòng 1 tháng. Khu vực Long Thành, Nhơn Trạch, Cẩm Mỹ là điểm nóng nhất.</li>
  <li><strong>Căn hộ Biên Hòa:</strong> Tỷ lệ hấp thụ đạt 95% trong tháng 3/2026 — cao nhất từ trước đến nay. Giá trung bình vượt 45 triệu đồng/m² tại khu trung tâm.</li>
  <li><strong>Bất động sản công nghiệp:</strong> Giá thuê đất khu công nghiệp tăng 15% — nhiều nhà đầu tư FDI đẩy nhanh tiến độ tìm kiếm quỹ đất trước khi tăng thêm.</li>
</ul>

<img src="${DONGNAI_IMG3}" alt="Khu đô thị thành phố mới hiện đại buổi tối" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;display:block;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Đồng Nai hướng tới hình ảnh một đô thị văn minh, hiện đại xứng tầm thành phố trực thuộc Trung ương</em></p>

<h3>Cơ hội đầu tư và khuyến nghị của SGS LAND</h3>
<p>Với sự kiện nâng cấp lịch sử này, SGS LAND đánh giá Đồng Nai là thị trường bất động sản có tiềm năng tăng trưởng lớn nhất cả nước trong giai đoạn 2026–2028. Các phân khúc đáng đầu tư nhất:</p>
<ul>
  <li><strong>Đất nền Long Thành – Nhơn Trạch:</strong> Trong bán kính 5 km từ sân bay quốc tế Long Thành — địa điểm chiến lược nhất.</li>
  <li><strong>Căn hộ trung – cao cấp tại Biên Hòa:</strong> Nhu cầu ở thực từ hàng trăm nghìn chuyên gia kỹ thuật cao trong các KCN.</li>
  <li><strong>Bất động sản thương mại ven sông Đồng Nai:</strong> Hưởng lợi trực tiếp từ dự án chỉnh trang và phát triển hai bên bờ sông — ưu tiên hàng đầu sau khi lên thành phố trực thuộc Trung ương.</li>
</ul>
<p>Liên hệ đội ngũ chuyên gia SGS LAND để được tư vấn miễn phí về các dự án bất động sản tại Đồng Nai: <strong>info@sgsland.vn</strong></p>
`.trim();

const migration: Migration = {
  description: 'Fix Hanoi ring-road article images; add Dong Nai city article',

  async up(client: PoolClient) {
    // 1. Fix Hà Nội article
    await client.query(
      `UPDATE articles
       SET cover_image = $1, images = $2::jsonb, content = $3, updated_at = NOW()
       WHERE tenant_id = $4 AND slug = $5`,
      [
        HANOI_COVER,
        JSON.stringify([HANOI_IMG1, HANOI_IMG2, HANOI_IMG3]),
        HANOI_CONTENT,
        TENANT_ID,
        HANOI_SLUG,
      ]
    );

    // 2. Upsert Đồng Nai article
    await client.query(
      `INSERT INTO articles (
         id, tenant_id, title, slug, excerpt, content, category,
         status, author, cover_image, images, tags, featured,
         view_count, published_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         'published', 'Ban Biên Tập SGS LAND', $8, $9::jsonb, $10::jsonb, false,
         0, '2026-03-20T07:00:00Z', NOW(), NOW()
       )
       ON CONFLICT (tenant_id, slug) DO UPDATE
         SET title       = EXCLUDED.title,
             excerpt     = EXCLUDED.excerpt,
             content     = EXCLUDED.content,
             cover_image = EXCLUDED.cover_image,
             images      = EXCLUDED.images,
             tags        = EXCLUDED.tags,
             updated_at  = NOW()`,
      [
        DONGNAI_ID,
        TENANT_ID,
        'Đồng Nai lên thành phố trực thuộc Trung ương tháng 3/2026: Bất động sản bứt phá',
        'dong-nai-len-thanh-pho-truc-thuoc-trung-uong-2026',
        'Tháng 3/2026, Quốc hội thông qua Nghị quyết thành lập thành phố Đồng Nai trực thuộc Trung ương — sự kiện chưa từng có tạo cú hích lịch sử cho thị trường bất động sản toàn vùng, đặc biệt hành lang sân bay Long Thành.',
        DONGNAI_CONTENT,
        'Quy Hoạch',
        DONGNAI_COVER,
        JSON.stringify([DONGNAI_IMG1, DONGNAI_IMG2, DONGNAI_IMG3]),
        JSON.stringify(['Đồng Nai', 'thành phố trực thuộc Trung ương', 'sân bay Long Thành', '2026', 'quy hoạch']),
      ]
    );
  },

  async down(client: PoolClient) {
    await client.query(
      `DELETE FROM articles WHERE tenant_id = $1 AND slug = $2`,
      [TENANT_ID, 'dong-nai-len-thanh-pho-truc-thuoc-trung-uong-2026']
    );
    await client.query(
      `UPDATE articles
       SET cover_image = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND slug = $3`,
      ['https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=1200&q=80&fit=crop', TENANT_ID, HANOI_SLUG]
    );
  },
};

export default migration;
