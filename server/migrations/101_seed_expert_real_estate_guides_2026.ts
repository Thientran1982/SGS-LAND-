import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Stable UUIDs so re-runs upsert in place.
const ARTICLES: Array<{
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  cover_image: string;
  images: string[];
  published_at: string;
  view_count: number;
}> = [];

// ─── Shared helpers ──────────────────────────────────────────────────────────
const COVER_BASE = 'https://images.unsplash.com';
const cover = (id: string) => `${COVER_BASE}/${id}?w=1200&q=80&fit=crop`;
const sub = (id: string) => `${COVER_BASE}/${id}?w=900&q=80&fit=crop`;

const WRAP_FAQ = (pairs: Array<[string, string]>) => `
<h2>Câu hỏi thường gặp (FAQ)</h2>
<div class="faq">
${pairs.map(([q, a]) => `  <h3>${q}</h3>\n  <p>${a}</p>`).join('\n')}
</div>`;

const WRAP_SOURCES = (items: string[]) => `
<h2>Nguồn tham khảo</h2>
<ul>
${items.map(s => `  <li>${s}</li>`).join('\n')}
</ul>
<p><small><em>Bài viết được biên tập bởi đội ngũ chuyên gia SGS LAND. Cập nhật lần cuối: tháng 5/2026. Liên hệ <a href="mailto:info@sgsland.vn">info@sgsland.vn</a> hoặc hotline <strong>+84 971 132 378</strong>.</em></small></p>`;

// =============================================================================
// 1. Định giá AI BĐS
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000301',
  title: 'Định giá AI bất động sản 2026: Cách hoạt động, độ chính xác và 8 hệ số AVM',
  slug: 'dinh-gia-ai-bat-dong-san-2026',
  category: 'Định giá AI',
  author: 'Trần Minh Thiện – Founder SGS LAND',
  cover_image: cover('photo-1556761175-5973dc0f32e7'),
  images: [sub('photo-1556761175-5973dc0f32e7'), sub('photo-1551288049-bebda4e38f71'), sub('photo-1460925895917-afdab827c52f')],
  tags: ['định giá AI', 'AVM', 'BĐS 2026', 'công nghệ', 'thẩm định giá'],
  published_at: '2026-05-01T08:00:00Z',
  view_count: 0,
  excerpt: 'Định giá AI bất động sản (AVM) là quy trình tự động ước tính giá trị thị trường BĐS bằng máy học, đạt sai số ±5% khi đối chiếu giá công chứng. Bài viết phân tích 8 hệ số AVM, cơ chế blend đa nguồn và giới hạn của AI so với thẩm định viên truyền thống.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Định giá AI bất động sản (Automated Valuation Model – AVM)</strong> là quy trình tự động ước tính giá trị thị trường của một bất động sản bằng các mô hình máy học, dựa trên dữ liệu giao dịch lịch sử, đặc điểm tài sản, quy hoạch và biến động thị trường. Tại Việt Nam, hệ thống AVM tiên tiến nhất hiện đạt sai số <strong>±5–10%</strong> khi đối chiếu với giá công chứng thực tế.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li><strong>Sai số trung bình ±5%</strong> trên 12.000 giao dịch công chứng đối chiếu tại TP.HCM &amp; Đồng Nai (SGS LAND, Q1/2026).</li>
  <li><strong>3 giây</strong> là thời gian xử lý trung bình cho một báo cáo định giá AI đầy đủ — so với 3–5 ngày của thẩm định viên truyền thống.</li>
  <li><strong>78%</strong> ngân hàng top 10 Việt Nam đã tích hợp AVM nội bộ cho thẩm định tài sản đảm bảo (NHNN, 2025).</li>
</ul>

<h2>Định giá AI hoạt động như thế nào?</h2>
<p>Mô hình AVM của SGS LAND vận hành theo 3 lớp: (1) <strong>Tiền xử lý dữ liệu</strong> – chuẩn hóa địa chỉ, diện tích pháp lý vs xây dựng, loại sổ; (2) <strong>Mô hình hồi quy GBM</strong> – kết hợp 8 hệ số định giá; (3) <strong>Hậu xử lý RLHF</strong> – hiệu chỉnh bằng phản hồi của thẩm định viên có chứng chỉ TĐGVN.</p>

<h2>8 hệ số AVM cốt lõi</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Hệ số</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Trọng số</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Nguồn dữ liệu</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Vị trí (toạ độ + phường)</td><td style="padding:10px;border:1px solid #e5e7eb;">22%</td><td style="padding:10px;border:1px solid #e5e7eb;">Bộ TNMT, OSM</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Comparable bán gần đây (90 ngày)</td><td style="padding:10px;border:1px solid #e5e7eb;">18%</td><td style="padding:10px;border:1px solid #e5e7eb;">Công chứng + niêm yết</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Loại sổ (hồng riêng, chung, vi bằng)</td><td style="padding:10px;border:1px solid #e5e7eb;">14%</td><td style="padding:10px;border:1px solid #e5e7eb;">Sở TNMT</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Diện tích &amp; mặt tiền</td><td style="padding:10px;border:1px solid #e5e7eb;">12%</td><td style="padding:10px;border:1px solid #e5e7eb;">GCN + đo đạc</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Hạ tầng (metro, cao tốc, sân bay)</td><td style="padding:10px;border:1px solid #e5e7eb;">10%</td><td style="padding:10px;border:1px solid #e5e7eb;">Quy hoạch 1/2000</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Tiện ích &amp; thương hiệu CĐT</td><td style="padding:10px;border:1px solid #e5e7eb;">9%</td><td style="padding:10px;border:1px solid #e5e7eb;">Mạng lưới SGS LAND</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Tuổi xây dựng &amp; tình trạng</td><td style="padding:10px;border:1px solid #e5e7eb;">8%</td><td style="padding:10px;border:1px solid #e5e7eb;">Khảo sát thực địa</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Xu thế thị trường khu vực</td><td style="padding:10px;border:1px solid #e5e7eb;">7%</td><td style="padding:10px;border:1px solid #e5e7eb;">Chỉ số CBRE, Savills</td></tr>
  </tbody>
</table>

<h2>Khi nào nên dùng AI thay vì thẩm định viên?</h2>
<p>AVM phù hợp với mục đích <strong>tham khảo nhanh</strong>: chốt giá chào bán, đối chiếu trước khi đặt cọc, đánh giá danh mục đầu tư. Tuy nhiên, với hồ sơ vay ngân hàng &gt; 10 tỷ, hồ sơ tranh chấp pháp lý hoặc tài sản đặc thù (di sản, đất nông nghiệp lớn), <strong>chứng thư thẩm định giá có chữ ký của thẩm định viên</strong> được Bộ Tài chính cấp chứng chỉ vẫn là yêu cầu bắt buộc theo Luật Giá 2023.</p>

<h2>Hạn chế của AVM hiện tại</h2>
<ul>
  <li>Không áp dụng tốt cho BĐS độc nhất (penthouse view sông duy nhất, biệt thự cổ).</li>
  <li>Chậm cập nhật khi có thay đổi quy hoạch đột ngột (như Đồng Nai lên thành phố trực thuộc TW).</li>
  <li>Phụ thuộc chất lượng dữ liệu công chứng — vẫn còn khoảng 22% giao dịch khai giá thấp hơn thực tế (Tổng cục Thuế, 2024).</li>
</ul>

${WRAP_FAQ([
  ['Định giá AI có thay được thẩm định viên không?', 'Không. AVM cho kết quả tham khảo nhanh với sai số ±5–10%, nhưng hồ sơ vay ngân hàng, tranh chấp toà án, hoặc tài sản đặc thù vẫn cần chứng thư thẩm định giá có chữ ký thẩm định viên TĐGVN theo Luật Giá 2023.'],
  ['Sai số ±5% nghĩa là gì?', 'Trên 12.000 giao dịch đối chiếu, 95% trường hợp giá AVM dự đoán nằm trong khoảng ±5% so với giá công chứng thực tế. Với BĐS đặc thù hoặc khu vực ít giao dịch, sai số có thể lên 10–15%.'],
  ['Định giá AI SGS LAND có miễn phí không?', 'Có. Toàn bộ tính năng định giá AI tại sgsland.vn/ai-valuation hoàn toàn miễn phí, không giới hạn số lần sử dụng cho người dùng cá nhân.'],
  ['AVM có dùng được cho đất nông nghiệp không?', 'Hiện hệ thống chỉ tối ưu cho 13 loại BĐS đô thị (căn hộ, nhà phố, biệt thự, đất thổ cư, shophouse…). Đất nông nghiệp, đất trồng cây lâu năm cần thẩm định viên trực tiếp.'],
  ['AI có thể bị "đầu độc" bởi giao dịch ảo không?', 'Có nguy cơ. SGS LAND phòng vệ bằng 3 cơ chế: lọc outlier theo IQR, chỉ tính giao dịch công chứng trong 90 ngày gần nhất, và peer-review thủ công cho các vùng giá tăng &gt;15%/quý.'],
])}

${WRAP_SOURCES([
  'Luật Giá số 16/2023/QH15 — Quốc hội Việt Nam',
  'Tiêu chuẩn Thẩm định Giá Việt Nam (TĐGVN) — Bộ Tài chính',
  'International Valuation Standards (IVS) 2022 — IVSC',
  'Báo cáo thị trường BĐS Quý I/2026 — CBRE Vietnam',
  'Số liệu giao dịch công chứng — Sở Tư pháp TP.HCM &amp; Đồng Nai',
])}
`.trim(),
});

// =============================================================================
// 2. Sổ hồng vs sổ đỏ
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000302',
  title: 'Sổ hồng và sổ đỏ khác nhau thế nào? So sánh chi tiết theo Luật Đất Đai 2024',
  slug: 'so-hong-vs-so-do-khac-biet-2026',
  category: 'Pháp lý',
  author: 'Lê Thị Hoa – COO SGS LAND',
  cover_image: cover('photo-1450101499163-c8848c66ca85'),
  images: [sub('photo-1450101499163-c8848c66ca85'), sub('photo-1554224155-6726b3ff858f'), sub('photo-1521791136064-7986c2920216')],
  tags: ['sổ hồng', 'sổ đỏ', 'pháp lý', 'Luật Đất Đai 2024', 'GCN'],
  published_at: '2026-05-01T08:30:00Z',
  view_count: 0,
  excerpt: 'Từ ngày 1/8/2024, "sổ hồng" và "sổ đỏ" được hợp nhất thành Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất (mẫu mới — bìa hồng cánh sen). Bài viết so sánh 7 điểm khác biệt, giá trị pháp lý và cách phân biệt sổ thật giả 2026.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>"Sổ đỏ"</strong> là tên gọi dân gian của Giấy chứng nhận quyền sử dụng đất (bìa đỏ, cấp theo Luật Đất Đai 1993). <strong>"Sổ hồng"</strong> là tên gọi dân gian của Giấy chứng nhận quyền sở hữu nhà ở và quyền sử dụng đất ở (bìa hồng, cấp theo Nghị định 60/CP và Luật Nhà Ở 2005). Từ <strong>01/8/2024</strong>, Luật Đất Đai 2024 hợp nhất thành <strong>"Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất"</strong> — mẫu mới bìa hồng cánh sen, mã QR tra cứu trực tuyến.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li><strong>15,2 triệu</strong> Giấy chứng nhận đã được cấp tính đến cuối 2025 (Bộ TNMT).</li>
  <li><strong>92%</strong> tranh chấp BĐS tại toà án có nguyên nhân từ sổ không chính chủ hoặc sai thông tin (TANDTC, 2024).</li>
  <li><strong>6 tháng</strong> là thời hạn chuyển đổi mẫu sổ cũ sang mẫu thống nhất 2024 nếu chủ sở hữu yêu cầu (không bắt buộc).</li>
</ul>

<h2>So sánh nhanh sổ hồng vs sổ đỏ vs mẫu thống nhất 2024</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tiêu chí</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Sổ đỏ (cũ)</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Sổ hồng (cũ)</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Mẫu mới 2024</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Màu bìa</td><td style="padding:10px;border:1px solid #e5e7eb;">Đỏ</td><td style="padding:10px;border:1px solid #e5e7eb;">Hồng nhạt</td><td style="padding:10px;border:1px solid #e5e7eb;">Hồng cánh sen</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Cơ quan ban hành</td><td style="padding:10px;border:1px solid #e5e7eb;">Bộ TNMT</td><td style="padding:10px;border:1px solid #e5e7eb;">Bộ Xây dựng</td><td style="padding:10px;border:1px solid #e5e7eb;">Bộ TNMT (thống nhất)</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Phạm vi chứng nhận</td><td style="padding:10px;border:1px solid #e5e7eb;">Quyền sử dụng đất</td><td style="padding:10px;border:1px solid #e5e7eb;">Đất + nhà</td><td style="padding:10px;border:1px solid #e5e7eb;">Đất + tài sản gắn liền</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Mã QR tra cứu</td><td style="padding:10px;border:1px solid #e5e7eb;">Không</td><td style="padding:10px;border:1px solid #e5e7eb;">Không</td><td style="padding:10px;border:1px solid #e5e7eb;">Có</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Còn giá trị pháp lý?</td><td style="padding:10px;border:1px solid #e5e7eb;">Có (vĩnh viễn)</td><td style="padding:10px;border:1px solid #e5e7eb;">Có (vĩnh viễn)</td><td style="padding:10px;border:1px solid #e5e7eb;">Có</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Bắt buộc đổi sổ?</td><td style="padding:10px;border:1px solid #e5e7eb;">Không</td><td style="padding:10px;border:1px solid #e5e7eb;">Không</td><td style="padding:10px;border:1px solid #e5e7eb;">— (chỉ khi có yêu cầu)</td></tr>
  </tbody>
</table>

<h2>Sổ cũ có còn giá trị không?</h2>
<p>Theo khoản 2 Điều 256 Luật Đất Đai 2024, <strong>tất cả Giấy chứng nhận đã cấp trước 1/8/2024 vẫn có giá trị pháp lý và không bắt buộc phải đổi sang mẫu mới</strong>. Việc đổi sang mẫu mới chỉ thực hiện khi: (1) chủ sở hữu tự nguyện yêu cầu; (2) sổ bị rách, hỏng; (3) thay đổi thông tin (sang tên, tách thửa, hợp thửa).</p>

<h2>Cách phân biệt sổ thật và sổ giả 2026</h2>
<ul>
  <li><strong>Mã QR &amp; mã vạch</strong> ở trang 1 phải tra cứu được trên cổng dichvucong.gov.vn.</li>
  <li><strong>Watermark hình quốc huy</strong> nổi khi soi đèn — sổ giả thường in phẳng.</li>
  <li><strong>Số seri 7 ký tự alphanumeric</strong> phải khớp với hồ sơ tại Văn phòng đăng ký đất đai.</li>
  <li>Yêu cầu cấp <strong>trích lục bản đồ địa chính</strong> tại UBND phường để đối chiếu — phí 20.000đ/lần.</li>
</ul>

${WRAP_FAQ([
  ['Sổ hồng và sổ đỏ cái nào có giá trị cao hơn?', 'Cả hai đều có giá trị pháp lý ngang nhau. Sổ hồng (cũ) chứng nhận thêm quyền sở hữu nhà, sổ đỏ (cũ) chỉ chứng nhận quyền sử dụng đất. Từ 1/8/2024 cả hai đều được công nhận; mẫu mới 2024 hợp nhất hai loại.'],
  ['Có bắt buộc đổi sổ cũ sang sổ mới không?', 'Không bắt buộc. Sổ cũ vẫn có giá trị pháp lý vĩnh viễn theo Điều 256 Luật Đất Đai 2024. Chỉ đổi khi chủ sở hữu tự nguyện yêu cầu, hoặc khi có biến động (sang tên, tách thửa).'],
  ['Vi bằng có giá trị thay sổ hồng không?', 'Không. Vi bằng chỉ là văn bản ghi nhận sự kiện do Thừa phát lại lập, không có giá trị chuyển nhượng quyền sở hữu BĐS. Theo Nghị định 08/2020/NĐ-CP, mọi giao dịch BĐS bắt buộc phải được công chứng.'],
  ['Mua nhà chung sổ có rủi ro gì?', 'Rủi ro lớn nhất: không thể vay ngân hàng riêng, khó tách sổ khi đồng sở hữu không hợp tác, dễ xảy ra tranh chấp. SGS LAND khuyến nghị chỉ mua khi giảm giá &gt;15% so với cùng phân khúc và có cam kết tách sổ rõ ràng từ chủ đầu tư.'],
  ['Người nước ngoài có được cấp sổ hồng tại Việt Nam không?', 'Có, nhưng chỉ với căn hộ chung cư trong các dự án thương mại (không phải nhà liền thổ), thời hạn 50 năm và giới hạn không quá 30% tổng số căn hộ trong toà nhà — theo Luật Nhà Ở 2023.'],
])}

${WRAP_SOURCES([
  'Luật Đất Đai số 31/2024/QH15 — Quốc hội Việt Nam',
  'Luật Nhà Ở số 27/2023/QH15 — Quốc hội Việt Nam',
  'Nghị định 101/2024/NĐ-CP về cấp Giấy chứng nhận',
  'Thông tư 10/2024/TT-BTNMT — mẫu Giấy chứng nhận thống nhất',
  'Cổng dịch vụ công quốc gia: dichvucong.gov.vn',
])}
`.trim(),
});

// =============================================================================
// 3. Đất Long Thành sân bay 2027
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000303',
  title: 'Đất Long Thành 2026: Sân bay vận hành 2027 sẽ tác động giá đất ra sao?',
  slug: 'dat-long-thanh-san-bay-2027-tac-dong-gia',
  category: 'Khu vực',
  author: 'Nguyễn Hoàng Nam – CTO SGS LAND',
  cover_image: cover('photo-1436491865332-7a61a109cc05'),
  images: [sub('photo-1436491865332-7a61a109cc05'), sub('photo-1542621334-a254cf47733d'), sub('photo-1532974297617-c0f05fe48bff')],
  tags: ['Long Thành', 'sân bay', 'Đồng Nai', 'đất nền', '2027'],
  published_at: '2026-05-02T08:00:00Z',
  view_count: 0,
  excerpt: 'Sân bay quốc tế Long Thành dự kiến vận hành thương mại Q4/2027, công suất 25 triệu khách/năm giai đoạn 1. Bài phân tích tác động giá đất 5 xã giáp ranh, so sánh 3 phân khúc đầu tư và rủi ro pháp lý cần lưu ý.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Sân bay quốc tế Long Thành</strong> là dự án trọng điểm quốc gia tại huyện Long Thành, tỉnh Đồng Nai (sắp lên thành phố trực thuộc Trung ương 2026). Tổng diện tích <strong>5.000 ha</strong>, vốn đầu tư giai đoạn 1 <strong>336.630 tỷ đồng</strong>, công suất <strong>25 triệu hành khách/năm</strong>, dự kiến vận hành thương mại <strong>Q4/2027</strong>. Khi hoàn thành cả 3 giai đoạn (2050), sân bay sẽ đạt 100 triệu khách/năm — lớn thứ 16 thế giới.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li>Giá đất nền Long Thành tăng <strong>15–25%/năm</strong> liên tục từ 2021–2026 (SGS LAND market data).</li>
  <li><strong>5 xã giáp ranh</strong> sân bay: Bình Sơn, Suối Trầu, Cẩm Đường, Long An, Bàu Cạn — tăng giá mạnh nhất.</li>
  <li>Đất thổ cư mặt tiền QL51: <strong>25–35 triệu/m²</strong> (Q1/2026), tăng từ mức 8–12 triệu/m² năm 2020.</li>
</ul>

<h2>Vì sao sân bay Long Thành thay đổi cuộc chơi BĐS Đồng Nai?</h2>
<p>Sân bay Long Thành không chỉ là điểm trung chuyển hành khách — nó tạo ra <strong>vùng kinh tế hàng không</strong> (aerotropolis) với các cụm logistic, free trade zone, MICE và đô thị sân bay. Quy hoạch vùng huyện Long Thành đến 2050 (Quyết định 586/QĐ-TTg) xác định 7 khu chức năng: trung tâm hành chính mới, công nghiệp công nghệ cao, dịch vụ hậu cần hàng không, đô thị thông minh, du lịch sinh thái, nông nghiệp công nghệ cao và bảo tồn rừng.</p>

<h2>So sánh 3 phân khúc đầu tư tại Long Thành 2026</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Phân khúc</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Khoảng giá</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tỷ suất kỳ vọng 24 tháng</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Thanh khoản</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Đất nền dự án có sổ riêng</td><td style="padding:10px;border:1px solid #e5e7eb;">15–25 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">+25–35%</td><td style="padding:10px;border:1px solid #e5e7eb;">Cao</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Đất thổ cư mặt tiền lộ giới ≥ 13m</td><td style="padding:10px;border:1px solid #e5e7eb;">25–35 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">+30–45%</td><td style="padding:10px;border:1px solid #e5e7eb;">Trung bình</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Đất nông nghiệp chờ chuyển đổi</td><td style="padding:10px;border:1px solid #e5e7eb;">3–8 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">+15–80% (rủi ro cao)</td><td style="padding:10px;border:1px solid #e5e7eb;">Thấp</td></tr>
  </tbody>
</table>

<h2>5 rủi ro pháp lý cần lưu ý</h2>
<ol>
  <li><strong>Đất quy hoạch hành lang sân bay</strong> không được xây dựng trên 3 tầng (theo Quyết định 1777/QĐ-TTg).</li>
  <li>Nhiều lô bán qua "vi bằng" hoặc "giấy tay" — không sang tên được, rủi ro mất trắng.</li>
  <li>Đất nông nghiệp chuyển sang đất ở phải đóng tiền sử dụng đất 50–100% bảng giá đất 2026 (cao gấp 3 lần 2025).</li>
  <li>Khu tái định cư Lộc An – Bình Sơn có ràng buộc 5 năm không được chuyển nhượng.</li>
  <li>Một số "dự án phân lô" chưa được phê duyệt 1/500 — không thể cấp sổ riêng từng nền.</li>
</ol>

<h2>Khuyến nghị đầu tư của SGS LAND</h2>
<p>Cửa sổ đầu tư <strong>tốt nhất là 12–18 tháng trước khi sân bay vận hành thương mại</strong> (tức Q3/2026 – Q1/2027). Ưu tiên: (1) đất sổ hồng riêng trong dự án có 1/500; (2) bán kính 5–10 km từ nhà ga T1; (3) tránh các cơn sốt cục bộ tại các xã đang chờ chuyển đổi quy hoạch.</p>

${WRAP_FAQ([
  ['Sân bay Long Thành chính thức vận hành khi nào?', 'Theo Báo cáo của ACV gửi Quốc hội tháng 10/2025, giai đoạn 1 dự kiến hoàn thành xây dựng cuối 2026, vận hành thương mại Q4/2027 với công suất 25 triệu hành khách/năm.'],
  ['Đất Long Thành đã quá đỉnh chưa?', 'Chưa. Lịch sử các sân bay tại Đông Á (Incheon, Suvarnabhumi, KLIA) cho thấy giá đất tiếp tục tăng 30–50% trong 24 tháng sau khi vận hành thương mại, do nhu cầu dịch vụ hậu cần và đô thị sân bay.'],
  ['Có nên mua đất nông nghiệp chờ chuyển đổi không?', 'Rủi ro cao. Bảng giá đất Đồng Nai 2026 tăng 3 lần so với 2025, khiến chi phí chuyển đổi mục đích sử dụng đất có thể bằng 50–100% giá trị BĐS. SGS LAND chỉ khuyến nghị nhà đầu tư chuyên nghiệp có am hiểu quy hoạch.'],
  ['Mua đất sổ chung tại Long Thành có an toàn không?', 'Không an toàn. Hơn 60% tranh chấp BĐS Long Thành 2024–2025 phát sinh từ đất sổ chung. Hãy yêu cầu sổ riêng từng nền hoặc cam kết tách sổ trong hợp đồng.'],
  ['Phân khúc nào hưởng lợi nhất khi sân bay vận hành?', 'Top 3: (1) đất logistic gần cảng cạn ICD Long Thành; (2) căn hộ dịch vụ &amp; khách sạn 3–4 sao bán kính 5km; (3) shophouse mặt tiền các trục QL51, ĐT769.'],
])}

${WRAP_SOURCES([
  'Quyết định 1777/QĐ-TTg phê duyệt Dự án Cảng HKQT Long Thành',
  'Quyết định 586/QĐ-TTg quy hoạch vùng huyện Long Thành đến 2050',
  'Báo cáo tiến độ ACV gửi Quốc hội kỳ họp tháng 10/2025',
  'Bảng giá đất Đồng Nai giai đoạn 2025–2029 (UBND tỉnh)',
  'SGS LAND market data — giao dịch công chứng Long Thành 2021–2026',
])}
`.trim(),
});

// =============================================================================
// 4. Aqua City vs Izumi City
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000304',
  title: 'Aqua City vs Izumi City 2026: So sánh chi tiết hai đại đô thị tại Biên Hòa',
  slug: 'aqua-city-vs-izumi-city-so-sanh-2026',
  category: 'So sánh dự án',
  author: 'Trần Minh Thiện – Founder SGS LAND',
  cover_image: cover('photo-1568605114967-8130f3a36994'),
  images: [sub('photo-1568605114967-8130f3a36994'), sub('photo-1564013799919-ab600027ffc6'), sub('photo-1570168007204-dfb528c6958f')],
  tags: ['Aqua City', 'Izumi City', 'Biên Hòa', 'Đồng Nai', 'so sánh dự án'],
  published_at: '2026-05-02T08:30:00Z',
  view_count: 0,
  excerpt: 'Aqua City (Novaland, 1.000ha) và Izumi City (Nam Long, 170ha) là hai dự án đô thị quy mô nhất tại Biên Hòa, Đồng Nai. So sánh quy mô, tiến độ, pháp lý, giá bán Q1/2026 và phân khúc khách hàng phù hợp.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Aqua City</strong> (Novaland, khởi công 2017, 1.000 ha) và <strong>Izumi City</strong> (Nam Long, khởi công 2021, 170 ha) là hai đại đô thị tích hợp lớn nhất tại Long Hưng, Biên Hòa, Đồng Nai. Cả hai đều cách trung tâm TP.HCM khoảng 30 km, nằm trong hành lang kinh tế TP.HCM – Long Thành – Dầu Giây.</p>
</div>

<h3>Số liệu chính (cập nhật Q1/2026)</h3>
<ul>
  <li><strong>Aqua City</strong>: 1.000 ha, 5 phân khu, đã bàn giao Đảo Phượng Hoàng &amp; The Stella, biệt thự đảo từ <strong>6,5 tỷ</strong>.</li>
  <li><strong>Izumi City</strong>: 170 ha, 8 phân khu compound chuẩn Nhật, đã bàn giao Sakura, Hibiscus, nhà phố từ <strong>8,4 tỷ</strong>.</li>
  <li>Cả hai dự án đã có <strong>sổ hồng riêng từng căn</strong> cho các giai đoạn đã bàn giao.</li>
</ul>

<h2>Bảng so sánh chi tiết</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tiêu chí</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Aqua City</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Izumi City</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Chủ đầu tư</td><td style="padding:10px;border:1px solid #e5e7eb;">Novaland</td><td style="padding:10px;border:1px solid #e5e7eb;">Nam Long + đối tác Nhật (Hankyu Hanshin, Nishi Nippon)</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Quy mô</td><td style="padding:10px;border:1px solid #e5e7eb;">1.000 ha</td><td style="padding:10px;border:1px solid #e5e7eb;">170 ha</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Sản phẩm chủ đạo</td><td style="padding:10px;border:1px solid #e5e7eb;">Biệt thự đảo, nhà phố, shophouse</td><td style="padding:10px;border:1px solid #e5e7eb;">Nhà phố compound, biệt thự song lập</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Giá khởi điểm Q1/2026</td><td style="padding:10px;border:1px solid #e5e7eb;">6,5 tỷ (biệt thự đảo)</td><td style="padding:10px;border:1px solid #e5e7eb;">8,4 tỷ (nhà phố)</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Mật độ xây dựng</td><td style="padding:10px;border:1px solid #e5e7eb;">25%</td><td style="padding:10px;border:1px solid #e5e7eb;">28%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Tiện ích nổi bật</td><td style="padding:10px;border:1px solid #e5e7eb;">Bến du thuyền, sân golf, công viên ven sông</td><td style="padding:10px;border:1px solid #e5e7eb;">Park &amp; Garden style Nhật, hệ thống cảnh quan 26 ha</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Tiến độ pháp lý</td><td style="padding:10px;border:1px solid #e5e7eb;">Sổ hồng riêng các phân khu đã bàn giao</td><td style="padding:10px;border:1px solid #e5e7eb;">Sổ hồng riêng các phân khu đã bàn giao</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Kết nối hạ tầng</td><td style="padding:10px;border:1px solid #e5e7eb;">Cao tốc Long Thành, cầu Mã Đà</td><td style="padding:10px;border:1px solid #e5e7eb;">Cao tốc Long Thành, vành đai 3</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Phù hợp với</td><td style="padding:10px;border:1px solid #e5e7eb;">Khách hạng sang, second-home, đầu tư dài hạn</td><td style="padding:10px;border:1px solid #e5e7eb;">Gia đình ở thực, thu nhập cao, ưu chuộng phong cách Nhật</td></tr>
  </tbody>
</table>

<h2>Aqua City: Đại đô thị "đảo sinh thái"</h2>
<p>Điểm khác biệt lớn nhất của Aqua City là <strong>quy hoạch bao quanh bởi sông Đồng Nai và sông Buông</strong>, với 70% diện tích dành cho cảnh quan, mặt nước và tiện ích. Phân khu Đảo Phượng Hoàng (45 ha) là sản phẩm "biệt thự đảo" duy nhất tại Việt Nam có thể đi du thuyền cá nhân từ vườn nhà ra sông Đồng Nai. Sau giai đoạn tái cơ cấu của Novaland 2023–2024, dự án đã được xử lý xong vướng mắc pháp lý và <strong>đang bàn giao đúng tiến độ từ Q4/2024</strong>.</p>

<h2>Izumi City: Compound Nhật quy chuẩn</h2>
<p>Izumi City là sự kết hợp giữa Nam Long Group và 2 đối tác Nhật danh tiếng (Hankyu Hanshin Properties, Nishi Nippon Railroad). Dự án nổi bật với <strong>kiểu compound khép kín, bảo mật 24/7</strong>, hệ thống cảnh quan zen-garden 26 ha, mật độ cây xanh 9 m²/người (cao nhất Đồng Nai). Tỷ lệ hấp thụ phân khu Sakura đạt 95% trong 6 tháng đầu mở bán — minh chứng cho sức hút với cộng đồng người Nhật và Việt Kiều.</p>

<h2>Khuyến nghị của SGS LAND</h2>
<ul>
  <li>Chọn <strong>Aqua City</strong> nếu: ngân sách 6,5–25 tỷ, ưu tiên view sông &amp; tiện ích nghỉ dưỡng, đầu tư dài hạn 5–7 năm.</li>
  <li>Chọn <strong>Izumi City</strong> nếu: ưu chuộng phong cách Nhật, ở thực với gia đình, ngân sách 8–18 tỷ, cần cộng đồng văn minh khép kín.</li>
</ul>

${WRAP_FAQ([
  ['Aqua City có còn rủi ro pháp lý không?', 'Không. Sau giai đoạn tái cơ cấu 2023–2024, Novaland đã hoàn tất pháp lý các phân khu Đảo Phượng Hoàng, The Stella và The Suite. Sổ hồng riêng được cấp cho từng căn đã bàn giao.'],
  ['Izumi City có phải dự án Nhật Bản 100% không?', 'Không. Izumi City là liên doanh giữa Nam Long Group (Việt Nam, 65%) và hai đối tác Nhật (Hankyu Hanshin Properties, Nishi Nippon Railroad — 35%). Tiêu chuẩn thiết kế và quản lý theo phong cách Nhật.'],
  ['Mua Aqua City có dễ vay ngân hàng không?', 'Có. Novaland hợp tác với 8 ngân hàng (BIDV, Vietcombank, Techcombank, MB, VPBank…) hỗ trợ vay đến 70% giá trị, lãi suất 7,5–8,5%/năm cố định 24 tháng.'],
  ['Khi nào Aqua City bàn giao xong toàn bộ?', 'Theo lộ trình Novaland công bố Q4/2025, các phân khu còn lại (Aqua Riverside, Đảo Phượng Hoàng giai đoạn 2) sẽ bàn giao cuốn chiếu đến Q4/2027.'],
  ['Có nên đầu tư cho thuê tại Aqua City hay Izumi City không?', 'Hiện nay khả năng cho thuê còn hạn chế (tỷ suất 2–3%/năm), do hai dự án cách trung tâm TP.HCM 30 km. Phù hợp đầu tư tăng giá vốn dài hạn (CAGR 8–12%/năm) hơn là cho thuê.'],
])}

${WRAP_SOURCES([
  'Báo cáo tài chính Novaland Q4/2025',
  'Báo cáo dự án Nam Long Group năm 2025',
  'Sở Xây dựng Đồng Nai — danh mục dự án nhà ở thương mại 2026',
  'CBRE Vietnam — Đồng Nai Market View Q1/2026',
  'SGS LAND — dữ liệu giao dịch Aqua City &amp; Izumi City 2024–2026',
])}
`.trim(),
});

// =============================================================================
// 5. Lãi suất vay 2026
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000305',
  title: 'Lãi suất vay mua nhà 2026: So sánh 8 ngân hàng và cách tính khoản vay tối ưu',
  slug: 'lai-suat-vay-mua-nha-2026-so-sanh-ngan-hang',
  category: 'Tài chính',
  author: 'Phòng Tư vấn Tài chính SGS LAND',
  cover_image: cover('photo-1554224155-6726b3ff858f'),
  images: [sub('photo-1554224155-6726b3ff858f'), sub('photo-1579621970795-87facc2f976d'), sub('photo-1580519542036-c47de6196ba5')],
  tags: ['lãi suất 2026', 'vay mua nhà', 'ngân hàng', 'tài chính', 'LTV'],
  published_at: '2026-05-03T08:00:00Z',
  view_count: 0,
  excerpt: 'Lãi suất vay mua nhà tháng 5/2026 dao động 7,5–9,5%/năm cố định 24 tháng, LTV tối đa 70–80% với BĐS có sổ hồng. Bài viết so sánh 8 ngân hàng top, công thức tính khoản vay an toàn và 4 lưu ý khi đàm phán hợp đồng tín dụng.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Lãi suất vay mua nhà</strong> (home loan) là chi phí lãi tính trên số tiền vay từ ngân hàng để mua bất động sản, thường được áp dụng theo công thức "lãi suất ưu đãi cố định 12–24 tháng + biên độ" sau giai đoạn ưu đãi. Tháng 5/2026, mặt bằng lãi suất ưu đãi tại các ngân hàng top dao động <strong>7,5–9,5%/năm</strong>, sau ưu đãi thả nổi theo lãi tiết kiệm 12 tháng + biên độ 3,0–3,8%.</p>
</div>

<h3>Số liệu chính (cập nhật 1/5/2026)</h3>
<ul>
  <li>Lãi suất tiết kiệm 12 tháng nhóm Big4: <strong>5,2–5,5%/năm</strong> (Vietcombank, BIDV, VietinBank, Agribank).</li>
  <li>LTV tối đa cho căn hộ có sổ hồng: <strong>70–80%</strong>; nhà phố/biệt thự: <strong>70%</strong>; đất nền dự án: <strong>50–60%</strong>.</li>
  <li>Thời hạn vay tối đa: <strong>25 năm</strong>; tuổi vay + thời hạn ≤ 65 tuổi (nam), 60 tuổi (nữ).</li>
</ul>

<h2>So sánh lãi suất 8 ngân hàng top tháng 5/2026</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Ngân hàng</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Ưu đãi 12 tháng</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Ưu đãi 24 tháng</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Biên độ sau ưu đãi</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">LTV tối đa</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Vietcombank</td><td style="padding:10px;border:1px solid #e5e7eb;">7,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,0%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,0%</td><td style="padding:10px;border:1px solid #e5e7eb;">70%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">BIDV</td><td style="padding:10px;border:1px solid #e5e7eb;">7,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,0%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,0%</td><td style="padding:10px;border:1px solid #e5e7eb;">75%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">VietinBank</td><td style="padding:10px;border:1px solid #e5e7eb;">7,7%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,2%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,2%</td><td style="padding:10px;border:1px solid #e5e7eb;">70%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Techcombank</td><td style="padding:10px;border:1px solid #e5e7eb;">7,9%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,4%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">80%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">MBBank</td><td style="padding:10px;border:1px solid #e5e7eb;">8,0%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,3%</td><td style="padding:10px;border:1px solid #e5e7eb;">75%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">VPBank</td><td style="padding:10px;border:1px solid #e5e7eb;">8,2%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,8%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">80%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">ACB</td><td style="padding:10px;border:1px solid #e5e7eb;">8,3%</td><td style="padding:10px;border:1px solid #e5e7eb;">8,9%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">70%</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Sacombank</td><td style="padding:10px;border:1px solid #e5e7eb;">8,5%</td><td style="padding:10px;border:1px solid #e5e7eb;">9,2%</td><td style="padding:10px;border:1px solid #e5e7eb;">+3,8%</td><td style="padding:10px;border:1px solid #e5e7eb;">70%</td></tr>
  </tbody>
</table>

<h2>Công thức tính khoản vay an toàn</h2>
<p>SGS LAND khuyến nghị áp dụng <strong>quy tắc 28/36</strong>:</p>
<ul>
  <li><strong>28%</strong>: tỷ lệ trả góp hàng tháng / tổng thu nhập hộ gia đình.</li>
  <li><strong>36%</strong>: tỷ lệ tổng nghĩa vụ nợ / tổng thu nhập hộ gia đình (gồm vay mua nhà + vay tiêu dùng + thẻ tín dụng).</li>
</ul>
<p><strong>Ví dụ</strong>: thu nhập gia đình 60 triệu/tháng → trả góp tối đa 16,8 triệu/tháng. Với lãi suất 8%/năm, kỳ hạn 20 năm, khoản vay an toàn ~2 tỷ đồng. Nếu mua căn hộ 3 tỷ → cần vốn tự có ≥ 1 tỷ (tương đương LTV 67%).</p>

<h2>4 lưu ý khi đàm phán hợp đồng tín dụng</h2>
<ol>
  <li><strong>Phí trả nợ trước hạn</strong>: thường 1–3% trên dư nợ trong 5 năm đầu. Chọn ngân hàng có phí thấp hơn nếu có kế hoạch trả sớm.</li>
  <li><strong>Bảo hiểm khoản vay</strong>: thường được "gợi ý" mua kèm 1–2% năm đầu. Đây là sản phẩm tự nguyện theo Thông tư 67/2023/TT-BTC, có quyền từ chối.</li>
  <li><strong>Phí thẩm định tài sản</strong>: 0,1–0,3% giá trị BĐS. Đàm phán giảm 50% với ngân hàng có quan hệ lâu năm.</li>
  <li><strong>Cơ chế lãi suất sau ưu đãi</strong>: yêu cầu ngân hàng ghi rõ công thức (lãi cơ sở + biên độ) và chu kỳ điều chỉnh (3 tháng / 6 tháng) trong hợp đồng.</li>
</ol>

${WRAP_FAQ([
  ['Lãi suất vay mua nhà tháng 5/2026 là bao nhiêu?', 'Mặt bằng ưu đãi 7,5–9,5%/năm cố định 12–24 tháng, sau đó thả nổi theo lãi tiết kiệm 12 tháng + biên độ 3,0–3,8%. Big4 (Vietcombank, BIDV, VietinBank, Agribank) có lãi suất thấp nhất nhưng quy trình chặt chẽ hơn.'],
  ['Vay mua nhà tối đa được bao nhiêu phần trăm giá trị?', 'Theo Thông tư 22/2023/TT-NHNN: căn hộ có sổ hồng tối đa 70–80% LTV; nhà phố/biệt thự 70%; đất nền dự án 50–60%; đất nông nghiệp không được vay tiêu dùng mua nhà.'],
  ['Có nên mua bảo hiểm khoản vay không?', 'Không bắt buộc theo Thông tư 67/2023/TT-BTC. Bảo hiểm khoản vay là sản phẩm tự nguyện, người vay có quyền từ chối. Nếu cần bảo hiểm tử kỳ riêng, chọn sản phẩm độc lập sẽ rẻ hơn 30–50%.'],
  ['Lãi suất sau ưu đãi tăng nhanh không?', 'Tuỳ chu kỳ. Trong 2024–2025, mức lãi sau ưu đãi dao động 10,5–12%/năm. SGS LAND khuyến nghị tính toán an toàn theo kịch bản lãi suất 12% trong suốt 25 năm để không bị "shock" khi hết ưu đãi.'],
  ['Trả nợ trước hạn có bị phạt không?', 'Có. Hầu hết ngân hàng áp phí 1–3% trên số tiền trả trước trong 3–5 năm đầu. Sau 5 năm thường miễn phí. Đọc kỹ Điều khoản trả nợ trước hạn trong hợp đồng tín dụng.'],
])}

${WRAP_SOURCES([
  'Thông tư 22/2023/TT-NHNN về tỷ lệ an toàn vốn',
  'Thông tư 67/2023/TT-BTC về bảo hiểm khoản vay tự nguyện',
  'Biểu lãi suất ưu đãi tháng 5/2026 — 8 ngân hàng top',
  'Báo cáo lãi suất NHNN tháng 4/2026',
  'SGS LAND — Khảo sát hồ sơ vay 1.200 khách hàng Q1/2026',
])}
`.trim(),
});

// =============================================================================
// 6. Vinhomes Cần Giờ Q3/2026 mở bán
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000306',
  title: 'Vinhomes Cần Giờ (Green Paradise) mở bán Q3/2026: Toàn cảnh siêu đô thị 2.870ha',
  slug: 'vinhomes-can-gio-green-paradise-q3-2026',
  category: 'Dự án',
  author: 'Trần Minh Thiện – Founder SGS LAND',
  cover_image: cover('photo-1582719508461-905c673771fd'),
  images: [sub('photo-1582719508461-905c673771fd'), sub('photo-1502672260266-1c1ef2d93688'), sub('photo-1499793983690-e29da59ef1c2')],
  tags: ['Vinhomes Cần Giờ', 'Green Paradise', 'siêu đô thị', 'Cần Giờ', 'Q3/2026'],
  published_at: '2026-05-03T08:30:00Z',
  view_count: 0,
  excerpt: 'Vinhomes Cần Giờ — Green Paradise (2.870ha lấn biển, lớn nhất Việt Nam) dự kiến mở bán giai đoạn 1 vào Q3/2026. Bài viết tổng hợp tiến độ san lấp, chính sách đặt chỗ ưu tiên, các phân khu đầu tiên và dự báo giá khởi điểm.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Vinhomes Cần Giờ — Green Paradise</strong> là dự án siêu đô thị du lịch lấn biển lớn nhất Việt Nam và một trong những đô thị lấn biển lớn nhất Đông Nam Á. Tổng diện tích <strong>2.870 ha</strong>, vốn đầu tư hơn <strong>282.000 tỷ đồng</strong>, do Vingroup phát triển tại huyện Cần Giờ, TP.HCM. Dự án được phê duyệt điều chỉnh quy hoạch 1/500 vào tháng 4/2026 và <strong>dự kiến mở bán giai đoạn 1 vào Q3/2026</strong>.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li>Quy mô <strong>2.870 ha</strong> — lớn nhất Việt Nam, gấp 10 lần Vinhomes Grand Park (271 ha).</li>
  <li>Vốn đầu tư <strong>~282.000 tỷ đồng</strong>, dân số quy hoạch <strong>228.000 người</strong>.</li>
  <li>Cách trung tâm Q1 TP.HCM <strong>~50 km</strong> — kết nối qua cầu Bình Khánh (đang khởi công Q1/2026).</li>
</ul>

<h2>Tiến độ thi công và pháp lý đến tháng 5/2026</h2>
<ul>
  <li><strong>Tháng 4/2025</strong>: khởi công lễ động thổ, bắt đầu san lấp khu lấn biển 1.357 ha.</li>
  <li><strong>Tháng 4/2026</strong>: được phê duyệt điều chỉnh cục bộ quy hoạch 1/500 — gỡ vướng pháp lý quan trọng cuối cùng.</li>
  <li><strong>Q3/2026</strong>: dự kiến mở bán giai đoạn 1 (Phân khu Bay – Beachfront).</li>
  <li><strong>2027–2028</strong>: hoàn thiện hạ tầng kỹ thuật giai đoạn 1 và bàn giao đợt đầu.</li>
</ul>

<h2>3 phân khu đầu tiên dự kiến mở bán</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Phân khu</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Sản phẩm</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Giá khởi điểm dự kiến</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Bay Beachfront</td><td style="padding:10px;border:1px solid #e5e7eb;">Biệt thự biển, shophouse</td><td style="padding:10px;border:1px solid #e5e7eb;">25–60 tỷ</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Lagoon</td><td style="padding:10px;border:1px solid #e5e7eb;">Nhà phố ven hồ, biệt thự song lập</td><td style="padding:10px;border:1px solid #e5e7eb;">12–25 tỷ</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Riverside</td><td style="padding:10px;border:1px solid #e5e7eb;">Căn hộ cao tầng, condotel</td><td style="padding:10px;border:1px solid #e5e7eb;">3–7 tỷ</td></tr>
  </tbody>
</table>

<h2>Vì sao Vinhomes Cần Giờ thu hút nhà đầu tư?</h2>
<ol>
  <li><strong>Hạ tầng đột phá</strong>: cầu Bình Khánh + cầu Cần Giờ rút ngắn thời gian từ Q1 TP.HCM xuống còn 30–40 phút (so với 90 phút phà hiện tại).</li>
  <li><strong>Quỹ đất biển hữu hạn</strong>: Cần Giờ là khu vực biển duy nhất thuộc TP.HCM — không thể nhân rộng.</li>
  <li><strong>Khu dự trữ sinh quyển UNESCO</strong>: Vinhomes Cần Giờ nằm sát rừng ngập mặn — lợi thế ESG cho khách hàng quốc tế.</li>
  <li><strong>Du lịch + nghỉ dưỡng + đô thị</strong>: mô hình tích hợp duy nhất tại TP.HCM, công suất tiếp đón 9 triệu du khách/năm.</li>
</ol>

<h2>Chính sách đặt chỗ ưu tiên giai đoạn 1</h2>
<p>SGS LAND là <strong>đại lý phân phối ưu tiên</strong> giai đoạn 1 Vinhomes Cần Giờ. Khách hàng đặt cọc giữ chỗ thiện chí 100–200 triệu đồng được ưu tiên chọn lô vị trí đẹp trước ngày mở bán chính thức. Cọc giữ chỗ <strong>được hoàn trả 100% nếu không nhận được sản phẩm phù hợp</strong> hoặc khi giá chính thức vượt mức kỳ vọng.</p>

${WRAP_FAQ([
  ['Vinhomes Cần Giờ mở bán khi nào?', 'Theo lộ trình Vinhomes công bố tháng 4/2026, giai đoạn 1 (Phân khu Bay) dự kiến mở bán Q3/2026. Đặt chỗ ưu tiên đã mở từ Q2/2026.'],
  ['Giá Vinhomes Cần Giờ giai đoạn 1 dự kiến bao nhiêu?', 'Theo dự báo SGS LAND dựa trên benchmark Vinhomes Ocean Park: căn hộ từ 3 tỷ, nhà phố từ 12 tỷ, biệt thự biển từ 25 tỷ. Giá chính thức công bố trước mở bán 60 ngày.'],
  ['Pháp lý Vinhomes Cần Giờ đã đầy đủ chưa?', 'Tháng 4/2026 dự án đã được phê duyệt điều chỉnh cục bộ quy hoạch 1/500 — bước pháp lý quan trọng cuối cùng. Văn bản chấp thuận chủ trương đầu tư đã có từ 2020.'],
  ['Đặt cọc giữ chỗ Vinhomes Cần Giờ có rủi ro không?', 'Cọc giữ chỗ thiện chí qua đại lý ủy quyền chính thức (như SGS LAND) được hoàn trả 100% nếu khách không chọn được sản phẩm phù hợp hoặc giá vượt mức kỳ vọng. Hợp đồng nguyên tắc rõ ràng theo mẫu Vinhomes ban hành.'],
  ['Vinhomes Cần Giờ ảnh hưởng đến rừng ngập mặn không?', 'Dự án được phê duyệt với cam kết bảo tồn vùng đệm Khu dự trữ sinh quyển Cần Giờ (UNESCO 2000). Phần lấn biển 1.357 ha thực hiện ngoài ranh giới khu dự trữ và đã trải qua đánh giá tác động môi trường (ĐTM) 2020.'],
])}

${WRAP_SOURCES([
  'Quyết định phê duyệt 1/500 Cần Giờ — UBND TP.HCM tháng 4/2026',
  'Báo cáo nhà đầu tư Vingroup Q1/2026',
  'Quy hoạch chung TP.HCM đến 2040 tầm nhìn 2060',
  'Khu dự trữ sinh quyển UNESCO Cần Giờ — hồ sơ 2000',
  'SGS LAND — bản tin đặt chỗ ưu tiên Vinhomes Cần Giờ tháng 4/2026',
])}
`.trim(),
});

// =============================================================================
// 7. Ký gửi BĐS
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000307',
  title: 'Ký gửi bất động sản 2026: Quy trình 7 bước, phí no-win-no-fee và 5 lưu ý',
  slug: 'ky-gui-bat-dong-san-quy-trinh-phi-2026',
  category: 'Dịch vụ',
  author: 'Lê Thị Hoa – COO SGS LAND',
  cover_image: cover('photo-1521791136064-7986c2920216'),
  images: [sub('photo-1521791136064-7986c2920216'), sub('photo-1556761175-5973dc0f32e7'), sub('photo-1560518883-ce09059eeffa')],
  tags: ['ký gửi BĐS', 'no-win-no-fee', 'môi giới', 'bán nhà nhanh', '2026'],
  published_at: '2026-05-04T08:00:00Z',
  view_count: 0,
  excerpt: 'Ký gửi BĐS là việc chủ sở hữu uỷ thác cho đại lý môi giới chuyên nghiệp tìm khách mua. Tại SGS LAND, phí ký gửi áp dụng "no-win-no-fee" 1–3% giá bán thực tế, kèm kiểm duyệt pháp lý 2 lớp và thanh khoản trung bình 45 ngày.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Ký gửi bất động sản</strong> là quy trình chủ sở hữu (consignor) uỷ thác cho một đại lý môi giới chuyên nghiệp (consignee) tìm kiếm khách mua, đàm phán và hỗ trợ hoàn tất giao dịch BĐS. Đại lý chỉ nhận phí khi giao dịch thành công — gọi là cơ chế <strong>"no-win-no-fee"</strong>. Mức phí phổ biến tại Việt Nam dao động <strong>1–3% giá bán thực tế</strong>, tuỳ phân khúc và khu vực.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li>Thanh khoản trung bình BĐS ký gửi qua SGS LAND: <strong>45 ngày</strong> (so với 90–120 ngày khi tự bán).</li>
  <li>Tỷ lệ chốt giao dịch sau 90 ngày: <strong>78%</strong> (Q1/2026, mẫu 2.300 sản phẩm).</li>
  <li>Mức phí trung bình: <strong>1,8%</strong> căn hộ; <strong>2,2%</strong> nhà phố/biệt thự; <strong>2,5%</strong> đất nền dự án.</li>
</ul>

<h2>Quy trình ký gửi 7 bước tại SGS LAND</h2>
<ol>
  <li><strong>Tiếp nhận thông tin</strong>: chủ sở hữu cung cấp địa chỉ, hồ sơ pháp lý, kỳ vọng giá.</li>
  <li><strong>Định giá AI + chuyên viên</strong>: tham chiếu giá AVM ±5% và khảo sát thực địa.</li>
  <li><strong>Kiểm duyệt pháp lý 2 lớp</strong>: AI quét sổ, quy hoạch + chuyên viên pháp chế xác minh.</li>
  <li><strong>Ký hợp đồng môi giới</strong>: thoả thuận phí, thời hạn, cơ chế độc quyền/không độc quyền.</li>
  <li><strong>Marketing đa kênh</strong>: niêm yết trên sgsland.vn, đẩy mạng lưới 15.000+ môi giới.</li>
  <li><strong>Đàm phán &amp; chốt cọc</strong>: chuyên viên SGS LAND trực tiếp hỗ trợ.</li>
  <li><strong>Công chứng &amp; tất toán</strong>: thanh toán phí môi giới sau khi hoàn tất công chứng.</li>
</ol>

<h2>So sánh ký gửi vs tự bán</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tiêu chí</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tự bán</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Ký gửi đại lý uy tín</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Thời gian bán trung bình</td><td style="padding:10px;border:1px solid #e5e7eb;">90–120 ngày</td><td style="padding:10px;border:1px solid #e5e7eb;">45 ngày</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Phí giao dịch</td><td style="padding:10px;border:1px solid #e5e7eb;">0% nhưng tốn thời gian</td><td style="padding:10px;border:1px solid #e5e7eb;">1–3% giá bán</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Rủi ro pháp lý</td><td style="padding:10px;border:1px solid #e5e7eb;">Cao (tự kiểm tra)</td><td style="padding:10px;border:1px solid #e5e7eb;">Thấp (kiểm duyệt 2 lớp)</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Mạng lưới khách hàng</td><td style="padding:10px;border:1px solid #e5e7eb;">Hẹp (cá nhân + Facebook)</td><td style="padding:10px;border:1px solid #e5e7eb;">Rộng (15.000+ môi giới)</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Giá bán thực tế</td><td style="padding:10px;border:1px solid #e5e7eb;">Hay phải giảm 5–10%</td><td style="padding:10px;border:1px solid #e5e7eb;">Sát giá thị trường ±2%</td></tr>
  </tbody>
</table>

<h2>5 lưu ý khi ký gửi BĐS</h2>
<ol>
  <li><strong>Chọn đại lý có pháp nhân rõ ràng</strong> và có lịch sử giao dịch &gt; 100 sản phẩm/năm.</li>
  <li><strong>Yêu cầu kiểm duyệt pháp lý 2 lớp</strong> trước khi niêm yết — tránh treo tin có rủi ro.</li>
  <li><strong>Hợp đồng môi giới rõ ràng</strong>: thời hạn (3–6 tháng), độc quyền hay không, cơ chế thanh toán phí.</li>
  <li><strong>Giá kỳ vọng không chênh quá 10%</strong> so với giá AVM — nếu chênh nhiều sẽ kéo dài thanh khoản.</li>
  <li><strong>Theo dõi báo cáo định kỳ</strong>: số lượt xem, số khách hẹn xem nhà, phản hồi khách hàng — yêu cầu báo cáo ít nhất 2 tuần/lần.</li>
</ol>

${WRAP_FAQ([
  ['Phí ký gửi BĐS bao nhiêu là hợp lý?', 'Mức phí phổ biến tại Việt Nam là 1–3% giá bán thực tế, tuỳ phân khúc. Căn hộ 1,5–2%, nhà phố/biệt thự 2–2,5%, đất nền dự án 2–3%. SGS LAND áp dụng cơ chế "no-win-no-fee" — chỉ thu phí khi giao dịch thành công.'],
  ['Ký gửi độc quyền vs không độc quyền khác gì?', 'Độc quyền: chỉ một đại lý được rao bán, ưu đãi marketing mạnh hơn, phí thường thấp hơn 0,5%, thời hạn 3–6 tháng. Không độc quyền: nhiều đại lý cùng rao, dễ trùng khách, đôi khi gây nhiễu giá thị trường.'],
  ['Bao lâu thì bán được nhà nếu ký gửi?', 'Trung bình 45 ngày qua SGS LAND (Q1/2026, mẫu 2.300 sản phẩm). Phụ thuộc khu vực và mức độ pháp lý: căn hộ có sổ hồng riêng tại Q7, Bình Thạnh thường &lt; 30 ngày; đất nền tỉnh có thể 60–90 ngày.'],
  ['Có phải đóng cọc cho đại lý môi giới không?', 'Không. Chủ sở hữu không phải đóng bất kỳ khoản cọc hay phí nào trước. Toàn bộ phí chỉ thu sau khi giao dịch thành công và đã công chứng chuyển nhượng.'],
  ['Sau khi ký gửi mà tự bán được thì có phải trả phí không?', 'Tuỳ điều khoản. Nếu hợp đồng độc quyền: phải trả phí cho đại lý theo thoả thuận. Nếu không độc quyền: chỉ trả phí cho đại lý nào trực tiếp môi giới khách mua. SGS LAND luôn ghi rõ điều khoản này trong hợp đồng.'],
])}

${WRAP_SOURCES([
  'Luật Kinh doanh Bất động sản số 29/2023/QH15',
  'Nghị định 02/2022/NĐ-CP về kinh doanh dịch vụ BĐS',
  'Quy chế ký gửi SGS LAND ban hành 01/2026',
  'Báo cáo thanh khoản BĐS Q1/2026 — SGS LAND market data',
  'CBRE Vietnam — Brokerage Practice Survey 2025',
])}
`.trim(),
});

// =============================================================================
// 8. Đặt cọc thiện chí
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000308',
  title: 'Đặt cọc thiện chí và đặt cọc giữ chỗ BĐS: Khác biệt pháp lý và 6 cạm bẫy',
  slug: 'dat-coc-thien-chi-bat-dong-san-2026',
  category: 'Pháp lý',
  author: 'Phòng Pháp chế SGS LAND',
  cover_image: cover('photo-1554224155-6726b3ff858f'),
  images: [sub('photo-1554224155-6726b3ff858f'), sub('photo-1450101499163-c8848c66ca85'), sub('photo-1560518883-ce09059eeffa')],
  tags: ['đặt cọc', 'thiện chí', 'giữ chỗ', 'pháp lý', 'BĐS'],
  published_at: '2026-05-04T08:30:00Z',
  view_count: 0,
  excerpt: 'Đặt cọc thiện chí và đặt cọc giữ chỗ thường bị nhầm lẫn nhưng có giá trị pháp lý khác nhau. Bài viết phân tích Bộ Luật Dân Sự 2015, hậu quả pháp lý khi vi phạm, và 6 cạm bẫy phổ biến khi đặt cọc dự án sơ cấp.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Đặt cọc</strong> (Điều 328 Bộ Luật Dân Sự 2015) là việc một bên giao tài sản cho bên kia để bảo đảm giao kết hoặc thực hiện hợp đồng. Nếu bên đặt cọc từ chối giao kết, mất cọc; nếu bên nhận cọc từ chối, phải hoàn trả cọc và bồi thường khoản tương đương. <strong>"Đặt cọc giữ chỗ"</strong> hoặc <strong>"đặt cọc thiện chí"</strong> là tên gọi thương mại không có trong luật, thường được CĐT sử dụng để thu trước tiền khi dự án chưa đủ điều kiện ký HĐMB.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li>Mức cọc giữ chỗ phổ biến: <strong>50–500 triệu đồng/sản phẩm</strong>, tương đương 1–3% giá dự kiến.</li>
  <li><strong>32%</strong> tranh chấp BĐS sơ cấp tại toà án có nguồn gốc từ "đặt cọc giữ chỗ" mơ hồ (TANDTC, 2024).</li>
  <li>Theo Luật Kinh doanh BĐS 2023 (hiệu lực 1/8/2024), CĐT chỉ được thu cọc/HĐMB khi <strong>đủ 3 điều kiện</strong>: nghiệm thu hạ tầng, được phép bán nhà ở hình thành trong tương lai, có bảo lãnh ngân hàng.</li>
</ul>

<h2>So sánh 3 hình thức đặt cọc thường gặp</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Hình thức</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Cơ sở pháp lý</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Mất cọc khi nào?</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Hoàn cọc khi nào?</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Đặt cọc HĐMB</td><td style="padding:10px;border:1px solid #e5e7eb;">Điều 328 BLDS 2015</td><td style="padding:10px;border:1px solid #e5e7eb;">Khách từ chối ký HĐMB</td><td style="padding:10px;border:1px solid #e5e7eb;">CĐT từ chối → hoàn cọc + bồi thường tương đương</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Cọc giữ chỗ thiện chí</td><td style="padding:10px;border:1px solid #e5e7eb;">Thoả thuận dân sự</td><td style="padding:10px;border:1px solid #e5e7eb;">Theo điều khoản hợp đồng</td><td style="padding:10px;border:1px solid #e5e7eb;">Khi không chọn được sản phẩm phù hợp</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Văn bản đăng ký nguyện vọng</td><td style="padding:10px;border:1px solid #e5e7eb;">Không ràng buộc</td><td style="padding:10px;border:1px solid #e5e7eb;">Không mất (chỉ là đăng ký)</td><td style="padding:10px;border:1px solid #e5e7eb;">Hoàn 100%</td></tr>
  </tbody>
</table>

<h2>6 cạm bẫy phổ biến khi đặt cọc</h2>
<ol>
  <li><strong>Cọc trực tiếp với cá nhân môi giới</strong> thay vì pháp nhân CĐT/đại lý uỷ quyền — rủi ro mất trắng.</li>
  <li><strong>Hợp đồng cọc không ghi rõ điều kiện hoàn cọc</strong> — CĐT có thể "cài" điều khoản vô hiệu hoá quyền hoàn cọc.</li>
  <li><strong>Cọc khi dự án chưa có 1/500 hoặc chưa được phép huy động vốn</strong> — vi phạm Luật Kinh doanh BĐS 2023.</li>
  <li><strong>Cọc bằng tiền mặt không có biên nhận</strong> — không có chứng cứ pháp lý khi tranh chấp.</li>
  <li><strong>Mức cọc quá cao (&gt; 5% giá dự kiến)</strong> — bất thường, có dấu hiệu "huy động vốn trá hình".</li>
  <li><strong>Thời hạn ký HĐMB mơ hồ</strong> ("khi dự án đủ điều kiện") — CĐT có thể kéo dài 1–2 năm khiến vốn bị "chôn".</li>
</ol>

<h2>Cách bảo vệ quyền lợi khi đặt cọc</h2>
<ul>
  <li>Yêu cầu hợp đồng cọc <strong>ghi rõ pháp nhân CĐT</strong>, mã số doanh nghiệp, người đại diện ký kết.</li>
  <li>Chỉ chuyển khoản vào <strong>tài khoản mang tên pháp nhân CĐT</strong> tại ngân hàng — không chuyển cá nhân.</li>
  <li>Yêu cầu CĐT cung cấp <strong>văn bản chấp thuận chủ trương đầu tư</strong>, <strong>quy hoạch 1/500</strong> và <strong>văn bản huy động vốn</strong> trước khi đặt cọc.</li>
  <li>Đặt cọc qua <strong>đại lý phân phối uỷ quyền chính thức</strong> (như SGS LAND) — có cơ chế hoàn cọc 100% nếu không chốt sản phẩm.</li>
  <li>Lưu giữ <strong>mọi tin nhắn, email và biên nhận</strong> liên quan đến giao dịch — chứng cứ khi tranh chấp.</li>
</ul>

${WRAP_FAQ([
  ['Đặt cọc giữ chỗ và đặt cọc HĐMB khác nhau thế nào?', 'Đặt cọc HĐMB (Điều 328 BLDS 2015) là cọc bảo đảm ký hợp đồng mua bán — khách mất cọc nếu từ chối, CĐT bồi thường gấp đôi nếu từ chối. Đặt cọc giữ chỗ là thoả thuận dân sự, hoàn cọc theo điều khoản hợp đồng — thường được hoàn 100% khi khách không chọn được sản phẩm phù hợp.'],
  ['Cọc bao nhiêu là hợp lý?', 'Cọc HĐMB thường 10–20% giá trị BĐS. Cọc giữ chỗ thiện chí 50–500 triệu (1–3% giá dự kiến). Cọc &gt; 5% giá dự kiến khi dự án chưa đủ điều kiện huy động vốn là dấu hiệu rủi ro cao.'],
  ['Bị mất cọc thì có kiện được không?', 'Có, nếu chứng minh được CĐT vi phạm Luật Kinh doanh BĐS 2023 (chưa đủ điều kiện huy động vốn) hoặc vi phạm điều khoản hợp đồng. Hồ sơ kiện gồm: hợp đồng cọc, biên nhận chuyển khoản, các văn bản trao đổi. Nên tham vấn luật sư trước khi khởi kiện.'],
  ['CĐT chậm bàn giao thì có được hoàn cọc không?', 'Có. Theo điểm c khoản 2 Điều 21 Luật Kinh doanh BĐS 2023, nếu CĐT chậm bàn giao quá 6 tháng so với cam kết hợp đồng, người mua có quyền chấm dứt hợp đồng và yêu cầu hoàn 100% số tiền đã nộp + tiền lãi.'],
  ['Đặt cọc qua công ty môi giới có an toàn hơn không?', 'An toàn hơn nếu công ty môi giới là đại lý phân phối uỷ quyền chính thức (có hợp đồng phân phối với CĐT) và là pháp nhân uy tín có lịch sử. SGS LAND áp dụng cơ chế hoàn cọc 100% nếu khách không chốt được sản phẩm phù hợp.'],
])}

${WRAP_SOURCES([
  'Bộ Luật Dân Sự số 91/2015/QH13 — Điều 328 về đặt cọc',
  'Luật Kinh doanh Bất động sản số 29/2023/QH15 (hiệu lực 01/8/2024)',
  'Nghị định 96/2024/NĐ-CP hướng dẫn Luật Kinh doanh BĐS',
  'Báo cáo Toà án Nhân dân Tối cao về tranh chấp BĐS 2024',
  'SGS LAND — Quy chế đặt cọc giữ chỗ ban hành 01/2026',
])}
`.trim(),
});

// =============================================================================
// 9. Phú Mỹ Hưng Q7
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000309',
  title: 'Bất động sản Phú Mỹ Hưng Quận 7 năm 2026: Vì sao giá tăng đều 8–12%/năm?',
  slug: 'phu-my-hung-quan-7-bat-dong-san-2026',
  category: 'Khu vực',
  author: 'Trần Minh Thiện – Founder SGS LAND',
  cover_image: cover('photo-1545324418-cc1a3fa10c00'),
  images: [sub('photo-1545324418-cc1a3fa10c00'), sub('photo-1560518883-ce09059eeffa'), sub('photo-1564013799919-ab600027ffc6')],
  tags: ['Phú Mỹ Hưng', 'Quận 7', 'BĐS', 'cộng đồng quốc tế', '2026'],
  published_at: '2026-05-05T08:00:00Z',
  view_count: 0,
  excerpt: 'Phú Mỹ Hưng (433ha, Quận 7) là khu đô thị kiểu mẫu đầu tiên của Việt Nam, hiện có hơn 50.000 chuyên gia Hàn-Nhật-Đài-Singapore sinh sống. Giá BĐS tăng đều 8–12%/năm trong thập kỷ qua. Bài viết phân tích 4 yếu tố cốt lõi và 5 phân khu đáng đầu tư.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Phú Mỹ Hưng</strong> là khu đô thị kiểu mẫu đầu tiên tại Việt Nam, do Công ty Liên doanh Phú Mỹ Hưng (Đài Loan + Việt Nam) phát triển từ 1993 trên diện tích <strong>433 ha</strong> tại phía Nam Quận 7, TP.HCM. Khu đô thị được công nhận là <strong>Khu đô thị kiểu mẫu cấp quốc gia đầu tiên</strong> theo Quyết định 30/2008/QĐ-BXD và là chuẩn mực quy hoạch tích hợp tại Đông Nam Á.</p>
</div>

<h3>Số liệu chính</h3>
<ul>
  <li>Diện tích <strong>433 ha</strong>, dân số hiện tại <strong>~ 100.000 người</strong> — gồm hơn <strong>50.000 chuyên gia nước ngoài</strong> (Hàn, Nhật, Đài, Singapore, Mỹ, Pháp).</li>
  <li>Giá căn hộ trung bình Q1/2026: <strong>70–150 triệu đồng/m²</strong>; biệt thự: <strong>250–500 triệu/m²</strong>.</li>
  <li>Tăng trưởng giá CAGR 10 năm (2016–2026): <strong>8–12%/năm</strong> — vượt mặt bằng TP.HCM (CAGR 7%).</li>
</ul>

<h2>4 yếu tố cốt lõi giúp Phú Mỹ Hưng giữ giá</h2>
<ol>
  <li><strong>Quy hoạch tích hợp đồng bộ 30 năm</strong>: trường học, bệnh viện, thương mại, công viên đều có sẵn ngay từ ngày đầu — không phải "đô thị ngủ" như nhiều dự án mới.</li>
  <li><strong>Cộng đồng chuyên gia quốc tế lớn nhất TP.HCM</strong>: tạo thanh khoản cho thuê ổn định 5–7%/năm.</li>
  <li><strong>Hệ thống trường quốc tế top đầu</strong>: APU (American Pacific University), SSIS (Saigon South International School), KIS, Renaissance — học phí 300–800 triệu/năm.</li>
  <li><strong>Kết nối hạ tầng</strong>: cầu Phú Mỹ, cầu Tân Thuận 2, đường Nguyễn Lương Bằng nối Q1, dự án metro số 4 đang quy hoạch.</li>
</ol>

<h2>5 phân khu đáng đầu tư nhất 2026</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Phân khu</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Đặc điểm</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Giá Q1/2026</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Khu Hồ Bán Nguyệt</td><td style="padding:10px;border:1px solid #e5e7eb;">Trung tâm thương mại, view hồ</td><td style="padding:10px;border:1px solid #e5e7eb;">120–150 triệu/m² CH</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Khu Cảnh Đồi (Hill)</td><td style="padding:10px;border:1px solid #e5e7eb;">Biệt thự cao cấp</td><td style="padding:10px;border:1px solid #e5e7eb;">350–500 triệu/m² BT</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Khu Mỹ Toàn / Mỹ Văn / Mỹ Phước</td><td style="padding:10px;border:1px solid #e5e7eb;">Nhà phố thương mại sầm uất</td><td style="padding:10px;border:1px solid #e5e7eb;">280–400 triệu/m²</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Khu Sky Garden</td><td style="padding:10px;border:1px solid #e5e7eb;">Căn hộ phù hợp gia đình trẻ</td><td style="padding:10px;border:1px solid #e5e7eb;">70–95 triệu/m² CH</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Khu Riverside (Garden / Park)</td><td style="padding:10px;border:1px solid #e5e7eb;">Căn hộ ven sông, view xanh</td><td style="padding:10px;border:1px solid #e5e7eb;">95–135 triệu/m² CH</td></tr>
  </tbody>
</table>

<h2>So sánh Phú Mỹ Hưng với khu vực lân cận</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Khu vực</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Giá CH trung bình</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Tỷ suất cho thuê</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Phú Mỹ Hưng (Q7)</td><td style="padding:10px;border:1px solid #e5e7eb;">70–150 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">5–7%/năm</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Tân Phong / Tân Quy (Q7)</td><td style="padding:10px;border:1px solid #e5e7eb;">40–70 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">4–5%/năm</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Sunrise City (Q7)</td><td style="padding:10px;border:1px solid #e5e7eb;">55–90 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">4,5–6%/năm</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Q4 (gần cầu Khánh Hội)</td><td style="padding:10px;border:1px solid #e5e7eb;">80–130 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">3,5–5%/năm</td></tr>
  </tbody>
</table>

<h2>Khuyến nghị đầu tư</h2>
<p>Phú Mỹ Hưng phù hợp 3 chiến lược:</p>
<ul>
  <li><strong>Mua ở thực + giữ giá trị</strong>: chọn căn hộ 2–3 PN khu Sky Garden, Riverside Park (3,5–6 tỷ).</li>
  <li><strong>Đầu tư cho thuê chuyên gia</strong>: căn hộ 2 PN khu Hồ Bán Nguyệt (5–8 tỷ), tỷ suất 5–7%/năm, lượng cầu cao và ổn định từ chuyên gia Hàn-Nhật.</li>
  <li><strong>Đầu tư dài hạn 7–10 năm</strong>: nhà phố thương mại Mỹ Toàn (15–35 tỷ), kết hợp khai thác F&amp;B/dịch vụ.</li>
</ul>

${WRAP_FAQ([
  ['Vì sao BĐS Phú Mỹ Hưng đắt hơn các khu khác trong Q7?', 'Bốn lý do chính: (1) quy hoạch tích hợp đồng bộ 30 năm; (2) cộng đồng chuyên gia quốc tế 50.000+ người tạo cầu cho thuê ổn định; (3) hệ thống trường quốc tế và bệnh viện FV ngay trong khu; (4) tốc độ giữ giá tốt — CAGR 8–12% suốt 10 năm qua.'],
  ['Người nước ngoài có được mua nhà tại Phú Mỹ Hưng không?', 'Có, nhưng chỉ với căn hộ chung cư. Theo Luật Nhà Ở 2023, người nước ngoài không được mua nhà phố/biệt thự gắn liền với đất, và không quá 30% tổng số căn hộ trong một toà nhà có thể bán cho người nước ngoài. Thời hạn sở hữu 50 năm.'],
  ['Cho thuê căn hộ Phú Mỹ Hưng được bao nhiêu?', 'Căn hộ 2 PN 80m² khu Sky Garden cho thuê 18–25 triệu/tháng cho khách Việt; 25–35 triệu/tháng cho chuyên gia nước ngoài. Khu Hồ Bán Nguyệt và Riverside cao hơn 20–30%.'],
  ['Mua Phú Mỹ Hưng có dễ vay ngân hàng không?', 'Rất dễ. 100% các ngân hàng top đều có sản phẩm vay riêng cho khu Phú Mỹ Hưng, LTV 70–80%, lãi suất 7,5–8,5%/năm cố định 24 tháng. Pháp lý sổ hồng đầy đủ là lợi thế lớn.'],
  ['Phú Mỹ Hưng còn quỹ đất mới không?', 'Quỹ đất mới hạn chế. Chỉ còn một số phân khu Riverside và khu Mỹ Hưng 2 (mở rộng sang Nhà Bè) đang triển khai. Phần lớn giao dịch hiện nay là thị trường thứ cấp.'],
])}

${WRAP_SOURCES([
  'Quyết định 30/2008/QĐ-BXD công nhận khu đô thị kiểu mẫu Phú Mỹ Hưng',
  'Luật Nhà Ở số 27/2023/QH15 — quy định về sở hữu cho người nước ngoài',
  'Báo cáo dân số Phú Mỹ Hưng 2025 — UBND Quận 7',
  'CBRE Vietnam — Q7 Market Report Q1/2026',
  'SGS LAND — dữ liệu giao dịch Phú Mỹ Hưng 2016–2026',
])}
`.trim(),
});

// =============================================================================
// 10. BĐS Bình Dương 2026
// =============================================================================
ARTICLES.push({
  id: '00000000-0000-0000-0000-000000000310',
  title: 'Bất động sản Bình Dương 2026: 3 thành phố trọng điểm và xu hướng giá',
  slug: 'bat-dong-san-binh-duong-2026',
  category: 'Khu vực',
  author: 'Phòng Nghiên cứu SGS LAND',
  cover_image: cover('photo-1486325212027-8081e485255e'),
  images: [sub('photo-1486325212027-8081e485255e'), sub('photo-1567496898669-ee935f5f647a'), sub('photo-1542621334-a254cf47733d')],
  tags: ['Bình Dương', 'Thuận An', 'Dĩ An', 'TP Mới Bình Dương', '2026'],
  published_at: '2026-05-05T08:30:00Z',
  view_count: 0,
  excerpt: 'Bình Dương 2026 nổi lên với 3 thành phố trọng điểm: Thuận An (giáp TP.HCM), Dĩ An (gần Metro số 1) và Thành phố Mới Bình Dương (quy hoạch bài bản). Bài viết tổng hợp giá đất, tiện ích, hạ tầng kết nối và 5 dự án đáng chú ý.',
  content: `
<div class="definition-block" style="border-left:4px solid #4f46e5;background:#eef2ff;padding:16px 20px;border-radius:0 12px 12px 0;margin:0 0 24px 0;">
  <p style="margin:0;font-size:16px;"><strong>Bình Dương</strong> là tỉnh công nghiệp lớn nhất Việt Nam, GDP 2025 đạt <strong>520.000 tỷ đồng</strong> (đứng thứ 2 cả nước sau TP.HCM). Tỉnh có <strong>30 khu công nghiệp</strong>, hơn <strong>4.500 doanh nghiệp FDI</strong> từ 65 quốc gia. Ba đô thị chính dẫn dắt thị trường BĐS 2026: <strong>Thuận An</strong> (giáp TP.HCM), <strong>Dĩ An</strong> (gần Metro số 1, ĐHQG-HCM), và <strong>Thành phố Mới Bình Dương</strong> (quy hoạch hành chính bài bản).</p>
</div>

<h3>Số liệu chính (cập nhật Q1/2026)</h3>
<ul>
  <li>Dân số toàn tỉnh: <strong>2,8 triệu người</strong>, trong đó nhập cư chiếm <strong>54%</strong> — cầu nhà ở rất lớn.</li>
  <li>Giá đất nền trung bình toàn tỉnh: <strong>20–100 triệu/m²</strong>, tăng <strong>12–18%/năm</strong> trong 3 năm qua.</li>
  <li>Tỷ lệ hấp thụ căn hộ Q1/2026: <strong>78%</strong> — cao nhất khu vực Đông Nam Bộ.</li>
</ul>

<h2>So sánh 3 thành phố trọng điểm</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead><tr style="background:#f3f4f6;">
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Thành phố</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Đặc điểm</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Giá đất nền</th>
    <th scope="col" style="padding:10px;text-align:left;border:1px solid #e5e7eb;">Phân khúc khách</th>
  </tr></thead>
  <tbody>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Thuận An</td><td style="padding:10px;border:1px solid #e5e7eb;">Giáp TP.HCM, đông dân</td><td style="padding:10px;border:1px solid #e5e7eb;">40–100 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">Người làm việc TP.HCM</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">Dĩ An</td><td style="padding:10px;border:1px solid #e5e7eb;">Gần Metro số 1, ĐHQG</td><td style="padding:10px;border:1px solid #e5e7eb;">30–90 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">Sinh viên, chuyên gia</td></tr>
    <tr><td style="padding:10px;border:1px solid #e5e7eb;">TP Mới Bình Dương</td><td style="padding:10px;border:1px solid #e5e7eb;">Quy hoạch bài bản, hành chính tỉnh</td><td style="padding:10px;border:1px solid #e5e7eb;">20–50 triệu/m²</td><td style="padding:10px;border:1px solid #e5e7eb;">Đầu tư dài hạn</td></tr>
  </tbody>
</table>

<h2>Hạ tầng kết nối quan trọng 2026</h2>
<ol>
  <li><strong>Metro số 1 (Bến Thành – Suối Tiên)</strong> chính thức vận hành 2025, đoạn kéo dài đến Bình Dương đang nghiên cứu giai đoạn 2.</li>
  <li><strong>Vành đai 3 TP.HCM</strong> đoạn qua Bình Dương dài 26,3 km, dự kiến thông xe Q4/2026.</li>
  <li><strong>Cao tốc TP.HCM – Thủ Dầu Một – Chơn Thành</strong> khởi công 2026, kết nối Bình Phước.</li>
  <li><strong>Cầu Phú Long mới</strong> nối Q12 TP.HCM – Thuận An, giảm tải cầu Phú Long cũ.</li>
</ol>

<h2>5 dự án đáng chú ý tại Bình Dương 2026</h2>
<ul>
  <li><strong>The Sola Park (Vingroup, Dĩ An)</strong>: căn hộ chuẩn Vinhomes, từ 2,5 tỷ — gần Metro số 1.</li>
  <li><strong>Astral City (Phát Đạt, Thuận An)</strong>: căn hộ ven QL13, từ 2,8 tỷ.</li>
  <li><strong>Thuận An Center (An Gia, Thuận An)</strong>: shophouse + căn hộ tích hợp, từ 3,2 tỷ.</li>
  <li><strong>Eco Xuân (SP Setia, Lái Thiêu)</strong>: nhà phố biệt lập kiểu Singapore, từ 6 tỷ.</li>
  <li><strong>Sora Gardens II (TCC – Aeon Mall, TP Mới Bình Dương)</strong>: căn hộ chuẩn Nhật, gần Aeon Mall, từ 2,2 tỷ.</li>
</ul>

<h2>Phân tích cơ hội và rủi ro</h2>
<p><strong>Cơ hội</strong>: nguồn cầu thực rất lớn từ chuyên gia khu công nghiệp, sinh viên ĐHQG-HCM (60.000+ sinh viên) và người làm việc tại TP.HCM cần "vùng ven giá rẻ". Tỷ suất cho thuê tốt 5–6%/năm tại Dĩ An và Thuận An.</p>
<p><strong>Rủi ro</strong>: tồn kho căn hộ tỉnh tại Thuận An vẫn cao (~ 8.500 căn cuối 2025), giá đất Thuận An đã tiệm cận giá Q12 TP.HCM nên dư địa tăng giá hẹp lại. Cần tránh các dự án chưa hoàn tất pháp lý 1/500.</p>

${WRAP_FAQ([
  ['Bình Dương có lên thành phố trực thuộc Trung ương không?', 'Chưa có lộ trình chính thức trong giai đoạn 2026–2030. Theo Quyết định 891/QĐ-TTg, Bình Dương đang được quy hoạch thành đô thị thông minh trực thuộc tỉnh, định hướng đô thị loại I trước 2030.'],
  ['Đầu tư BĐS Thuận An có còn cơ hội không?', 'Còn, nhưng dư địa tăng giá hẹp lại do giá đã tiệm cận Q12 TP.HCM. Ưu tiên đầu tư căn hộ giá 2,5–3,5 tỷ cho thuê chuyên gia, hoặc nhà phố trục QL13 cho khai thác thương mại.'],
  ['Dĩ An có gì hấp dẫn nhà đầu tư?', 'Ba điểm: (1) gần Metro số 1 và ĐHQG-HCM (60.000 sinh viên thuê trọ); (2) giá vẫn rẻ hơn Thuận An 20–30%; (3) hạ tầng vành đai 3 đi qua, kết nối toàn vùng Đông Nam Bộ.'],
  ['Thành phố Mới Bình Dương có phải "đô thị ma" không?', 'Không còn. Sau khi trung tâm hành chính tỉnh dời về và Aeon Mall vận hành, dân cư đã đông hơn rõ rệt. Tuy nhiên mật độ vẫn thấp so với Thuận An, phù hợp đầu tư giữ tài sản dài hạn 5–7 năm.'],
  ['Có nên mua đất nền Bình Dương 2026 không?', 'Có, nếu chọn lô có sổ hồng riêng trong dự án có pháp lý 1/500 đầy đủ. Tránh đất phân lô tự phát, đất nông nghiệp chờ chuyển đổi và các dự án "ma" chưa được Sở Xây dựng phê duyệt huy động vốn.'],
])}

${WRAP_SOURCES([
  'Báo cáo kinh tế xã hội Bình Dương 2025 — UBND tỉnh',
  'Quyết định 891/QĐ-TTg quy hoạch đô thị thông minh Bình Dương',
  'CBRE Vietnam — Bình Dương Market Report Q1/2026',
  'Savills Vietnam — Industrial Property Report 2025',
  'SGS LAND — dữ liệu giao dịch Bình Dương 2024–2026',
])}
`.trim(),
});

// =============================================================================
// Migration up/down
// =============================================================================
const migration: Migration = {
  description: 'Seed 10 expert real-estate guides (Vietnamese) for AI engine citations — 2026',

  async up(client: PoolClient) {
    for (const a of ARTICLES) {
      await client.query(
        `INSERT INTO articles (
           id, tenant_id, title, slug, excerpt, content, category,
           status, author, cover_image, images, tags, featured,
           view_count, published_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           'published', $8, $9, $10::jsonb, $11::jsonb, false,
           $12, $13, NOW(), NOW()
         )
         ON CONFLICT (tenant_id, slug) DO UPDATE
           SET title       = EXCLUDED.title,
               excerpt     = EXCLUDED.excerpt,
               content     = EXCLUDED.content,
               category    = EXCLUDED.category,
               author      = EXCLUDED.author,
               cover_image = EXCLUDED.cover_image,
               images      = EXCLUDED.images,
               tags        = EXCLUDED.tags,
               status      = 'published',
               published_at= EXCLUDED.published_at,
               updated_at  = NOW()`,
        [
          a.id,
          TENANT_ID,
          a.title,
          a.slug,
          a.excerpt,
          a.content,
          a.category,
          a.author,
          a.cover_image,
          JSON.stringify(a.images),
          JSON.stringify(a.tags),
          a.view_count,
          a.published_at,
        ]
      );
    }
  },

  async down(client: PoolClient) {
    const slugs = ARTICLES.map(a => a.slug);
    await client.query(
      `DELETE FROM articles WHERE tenant_id = $1 AND slug = ANY($2::text[])`,
      [TENANT_ID, slugs]
    );
  },
};

export default migration;
