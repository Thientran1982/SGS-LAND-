import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Correct the cover image and inline images for the HCMC featured article
// photo-1583417267826-aebc4d1537ab = confirmed aerial city skyline photo
// photo-1486325212027-8081e485255e = confirmed modern glass building architecture
// photo-1545324418-cc1a3fa10c00 = confirmed apartment building exterior

const HCMC_SLUG = 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang';
const HCMC_COVER = 'https://images.unsplash.com/photo-1583417267826-aebc4d1537ab?w=1200&q=80&fit=crop';
const HCMC_IMAGES = JSON.stringify([
  'https://images.unsplash.com/photo-1583417267826-aebc4d1537ab?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop',
]);

const HCMC_CONTENT = `
<h2>Tổng quan thị trường TP.HCM năm 2026</h2>
<p>Sau hai năm điều chỉnh sâu, thị trường bất động sản TP.HCM đang cho thấy những dấu hiệu phục hồi rõ nét trong năm 2026. Lãi suất cho vay mua nhà đã giảm về mức 6,5–7,5%/năm, thanh khoản cải thiện mạnh và nguồn cung mới được cấp phép trở lại tại nhiều dự án lớn quanh khu vực Thành phố Thủ Đức và vành đai 3.</p>

<img src="https://images.unsplash.com/photo-1583417267826-aebc4d1537ab?w=900&q=80&fit=crop" alt="Skyline TP.HCM nhìn từ Thủ Thiêm 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Toàn cảnh khu đô thị TP.HCM — thị trường đang bước vào chu kỳ phục hồi mạnh năm 2026</em></p>

<h3>Phân khúc dẫn dắt thị trường 2026</h3>
<ul>
  <li><strong>Căn hộ trung cấp (2–4 tỷ đồng):</strong> Giao dịch tăng 45% so với cùng kỳ 2025, dẫn đầu tại các khu vực Bình Dương, Nhà Bè, Bình Chánh.</li>
  <li><strong>Nhà phố liền kề:</strong> Đất nền khu vực vành đai 3 được quan tâm trở lại sau khi thông tin quy hoạch được công bố chính thức và metro số 2 khởi công.</li>
  <li><strong>Căn hộ cao cấp:</strong> Tập trung tại Thủ Thiêm và khu trung tâm Quận 1, giá từ 9.000–18.000 USD/m² vẫn được hấp thụ tốt bởi khách hàng trong nước lẫn người nước ngoài.</li>
</ul>

<img src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop" alt="Khu căn hộ cao cấp TP.HCM 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Các tòa tháp căn hộ cao cấp đang mọc lên tại khu đô thị mới Thủ Thiêm đầu năm 2026</em></p>

<h3>Nhận định của chuyên gia</h3>
<p>Ông Nguyễn Văn Đính – Chủ tịch Hội Môi giới Bất động sản Việt Nam – nhận định: <em>"Năm 2026 là năm của sự bứt phá thực sự. Các dự án có pháp lý sạch, chủ đầu tư uy tín và vị trí kết nối hạ tầng metro tốt sẽ tăng giá mạnh trong nửa đầu năm."</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Bất động sản TP.HCM 2026 đang bước vào chu kỳ phục hồi bền vững — không phải sốt ảo mà là tăng trưởng thực chất từ nhu cầu thực."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Ông Nguyễn Văn Đính, Chủ tịch HoREA, Quý I/2026</footer></blockquote>

<h3>Khuyến nghị cho nhà đầu tư năm 2026</h3>
<p>Với xu thế hiện tại, các chuyên gia khuyến nghị nhà đầu tư nên ưu tiên các dự án gần tuyến metro số 1 (đã vận hành), số 2 (đang thi công) và khu vực đang được đầu tư hạ tầng như Thành phố Thủ Đức và khu Nam TP.HCM — Nhà Bè.</p>

<img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop" alt="Căn hộ chung cư hiện đại gần metro TP.HCM" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Căn hộ chung cư hiện đại tại các tuyến metro TP.HCM — xu hướng đầu tư hàng đầu 2026</em></p>
`.trim();

const migration: Migration = {
  description: 'Fix HCMC featured article cover image to confirmed city skyline photo',

  async up(client: PoolClient) {
    await client.query(
      `UPDATE articles
       SET cover_image = $1, images = $2::jsonb, content = $3, updated_at = NOW()
       WHERE tenant_id = $4 AND slug = $5`,
      [HCMC_COVER, HCMC_IMAGES, HCMC_CONTENT, TENANT_ID, HCMC_SLUG]
    );
  },

  async down(client: PoolClient) {
    await client.query(
      `UPDATE articles SET cover_image = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND slug = $3`,
      ['https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=1200&q=80&fit=crop', TENANT_ID, HCMC_SLUG]
    );
  },
};

export default migration;
