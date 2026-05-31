import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const articles = [
  {
    title: 'Báo cáo giá bất động sản Q2/2026: TP.HCM tăng 8% so với cùng kỳ',
    slug: 'bao-cao-gia-bds-q2-2026-tphcm',
    excerpt: 'Khảo sát 12.000 giao dịch thực tế trong Q2/2026 cho thấy giá căn hộ tại TP.HCM tăng trung bình 8,3% so với cùng kỳ năm 2025, dẫn đầu là khu vực Thành phố Thủ Đức và Quận 7.',
    content: `<h2>Tổng quan thị trường Q2/2026</h2><p>Theo dữ liệu SGS LAND tổng hợp từ 12.000 giao dịch thực tế trong quý 2/2026, giá căn hộ tại TP.HCM tiếp tục xu hướng tăng ổn định với mức tăng trung bình 8,3% so với cùng kỳ năm 2025.</p><h3>Biến động giá theo quận</h3><ul><li><strong>Thành phố Thủ Đức:</strong> Tăng 12,5% - dẫn đầu toàn thành phố nhờ hạ tầng hoàn thiện và nhiều dự án lớn ra mắt</li><li><strong>Quận 7:</strong> Tăng 9,8% - Phú Mỹ Hưng tiếp tục giữ giá cao, khu ven sông phục hồi mạnh</li><li><strong>Quận 9 (cũ):</strong> Tăng 11,2% - hưởng lợi từ tầu điện số 1 chính thức vận hành</li><li><strong>Quận Bình Chánh:</strong> Tăng 7,1% - căn hộ trung cấp phân khúc 2-3 tỷ hấp thụ tốt</li></ul><h3>Chỉ số thanh khoản</h3><p>Tỷ lệ hấp thụ sản phẩm mới trong Q2/2026 đạt 78%, tăng từ mức 65% của Q2/2025. Điều này phản ánh niềm tin của người mua vào thị trường đang hồi phục mạnh.</p><h3>Dự báo Q3/2026</h3><p>Các chuyên gia SGS LAND dự báo mức tăng giá sẽ duy trì ở 6-9% trong Q3/2026, với điểm nóng là các dự án ven sông và gần đại lộ Võ Văn Kiệt mở rộng.</p>`,
    category: 'Phân tích thị trường',
    tags: ['phân tích thị trường', 'giá bất động sản', 'TP.HCM', '2026'],
    author: 'Ban Phân tích SGS LAND',
    cover_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop',
    view_count: 1850,
    published_at: '2026-04-15T08:00:00Z',
  },
  {
    title: 'Chỉ số giá căn hộ 5 quận trung tâm TP.HCM - Phân tích tháng 5/2026',
    slug: 'chi-so-gia-can-ho-5-quan-trung-tam-tphcm-2026',
    excerpt: 'Phân tích chi tiết chỉ số giá căn hộ tại 5 quận trung tâm (Q1, Q3, Q4, Q5, Q10) tháng 5/2026: biến động, thanh khoản và xu hướng đầu tư.',
    content: `<h2>Tổng quan 5 quận trung tâm TP.HCM</h2><p>Tháng 5/2026, thị trường căn hộ tại 5 quận trung tâm TP.HCM ghi nhận sự phân hóa rõ rệt. Quận 1 vẫn giữ vị trí dẫn đầu về mức giá, trong khi các quận vùng ven nói ghi nhận tác động thanh khoản tốt hơn.</p><h3>Bảng chỉ số giá theo quận</h3><ul><li><strong>Quận 1:</strong> 85-150 triệu/m² - Tăng 5,2% YoY. Vị trí trung tâm, pháp lý chủ quyền rõ ràng.</li><li><strong>Quận 3:</strong> 65-95 triệu/m² - Tăng 7,8% YoY. Nhu cầu đầu tư cho thuê tăng mạnh sau dịch.</li><li><strong>Quận 4:</strong> 45-70 triệu/m² - Tăng 9,4% YoY. Hưởng lợi từ nút giao cầu Khánh Hội mới.</li><li><strong>Quận 5:</strong> 55-80 triệu/m² - Tăng 6,1% YoY. Khu chợ An Đông tạo động lực riêng.</li><li><strong>Quận 10:</strong> 50-75 triệu/m² - Tăng 8,3% YoY. Gần đại học tạo cầu thuê ổn định.</li></ul><h3>Nhận định chuyên gia SGS LAND</h3><p>Việc Fed giữ lãi suất ở mức thấp và Ngân hàng Nhà nước Việt Nam hạ lãi suất điều hành về 4%/năm là yếu tố thúc đẩy thanh khoản tốt trong nửa cuối năm 2026.</p>`,
    category: 'Phân tích thị trường',
    tags: ['chỉ số giá', 'căn hộ', 'quận trung tâm', 'phân tích'],
    author: 'Ban Phân tích SGS LAND',
    cover_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop',
    view_count: 2340,
    published_at: '2026-05-10T08:00:00Z',
  },
  {
    title: 'So sánh suất đầu tư bất động sản: TP.HCM vs Đồng Nai vs Bình Dương năm 2026',
    slug: 'so-sanh-suat-dau-tu-bds-tphcm-dong-nai-binh-duong-2026',
    excerpt: 'Phân tích ROI và suất đầu tư bất động sản giữa ba thị trường lớn: TP.HCM, Đồng Nai, Bình Dương - đâu là lựa chọn tối ưu trong năm 2026?',
    content: `<h2>Căn cứ so sánh suất đầu tư</h2><p>SGS LAND thực hiện khảo sát 3.200 giao dịch tại 3 tỉnh thành trong 6 tháng đầu 2026 để đưa ra chỉ số ROI (lợi nhuận trên vốn) khi đầu tư bất động sản mỗi khu vực.</p><h3>Kết quả so sánh</h3><ul><li><strong>TP.HCM:</strong> ROI trung bình 8,5%/năm. Tăng giá 6-12%. An toàn pháp lý cao. Vốn ban đầu lớn (từ 3 tỷ đồng).</li><li><strong>Đồng Nai:</strong> ROI trung bình 11,2%/năm. Tăng giá 15-20%. Giá vừa phải (từ 1,5 tỷ). Trọng điểm: Long Thành, Nhơn Trạch. Rủi ro pháp lý cần kiểm tra kỹ.</li><li><strong>Bình Dương:</strong> ROI trung bình 9,8%/năm. Tăng giá 12-18%. Bản đồ công nghiệp thúc đẩy nhà ở. Trọng điểm: Thuận An, Dĩ An, Bình Dương.</li></ul><h3>Khuyến nghị chiến lược</h3><p>Với vốn trên 5 tỷ đồng: TP.HCM đảm bảo an toàn và thanh khoản. Với vốn 1,5-3 tỷ đồng: Đồng Nai và Bình Dương cho lợi tức cao hơn nhưng cần khảo sát kỹ pháp lý. Nhận tư vấn cụ thể theo ngân sách tại SGS LAND.</p>`,
    category: 'Phân tích thị trường',
    tags: ['so sánh', 'ROI', 'suất đầu tư', 'Đồng Nai', 'Bình Dương'],
    author: 'Ban Phân tích SGS LAND',
    cover_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop',
    view_count: 3120,
    published_at: '2026-05-20T08:00:00Z',
  },
];

const migration: Migration = {
  async up(client: PoolClient) {
    for (const article of articles) {
      await client.query(
        `INSERT INTO articles
          (tenant_id, title, slug, content, excerpt, category, tags, author,
           cover_image, status, view_count, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'PUBLISHED', $10, $11)
         ON CONFLICT (tenant_id, slug) DO NOTHING`,
        [
          TENANT_ID,
          article.title,
          article.slug,
          article.content,
          article.excerpt,
          article.category,
          JSON.stringify(article.tags),
          article.author,
          article.cover_image,
          article.view_count,
          article.published_at,
        ]
      );
    }
  },

  async down(client: PoolClient) {
    const slugs = articles.map((a) => a.slug);
    await client.query(
      `DELETE FROM articles WHERE tenant_id = $1 AND slug = ANY($2::text[])`,
      [TENANT_ID, slugs]
    );
  },
};

export default migration;
