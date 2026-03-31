import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// All articles updated to March 2026 dates and titles to reflect latest news

const dateFixes: Array<{ slug: string; published_at: string; title: string; excerpt: string }> = [
  {
    slug: 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang',
    published_at: '2026-03-18T08:00:00Z',
    title: 'Thị trường bất động sản TP.HCM tháng 3/2026: Phục hồi mạnh mẽ sau tái cơ cấu',
    excerpt: 'Thị trường bất động sản TP.HCM trong tháng 3/2026 ghi nhận nhiều chuyển biến tích cực: giao dịch tăng 45%, lãi suất hạ về 6,5% và hàng loạt dự án mới được cấp phép tại Thủ Đức.',
  },
  {
    slug: 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu',
    published_at: '2026-03-12T09:30:00Z',
    title: 'Hà Nội tháng 3/2026: Vành đai 4 thông xe, bất động sản ven đô bùng nổ',
    excerpt: 'Tuyến Vành đai 4 thông xe các đoạn trọng yếu đầu tháng 3/2026 đã châm ngòi làn sóng đầu tư bất động sản ven đô mạnh nhất kể từ năm 2010. Hoài Đức, Đông Anh, Mê Linh ghi nhận giá tăng 30–45%.',
  },
  {
    slug: 'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia',
    published_at: '2026-03-08T10:00:00Z',
    title: 'Quý I/2026: Căn hộ hạng sang Việt Nam lập kỷ lục giá mới, không hề hạ nhiệt',
    excerpt: 'Báo cáo CBRE tháng 3/2026 xác nhận: căn hộ hạng sang TP.HCM đạt 15.200 USD/m², Hà Nội đạt 11.500 USD/m² — cả hai đều là kỷ lục lịch sử. Nguồn cung mới hạn chế khiến xu hướng tăng giá không có dấu hiệu dừng lại.',
  },
  {
    slug: 'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong',
    published_at: '2026-03-05T08:00:00Z',
    title: 'Đà Nẵng tháng 3/2026: Sân bay mở rộng xong, bất động sản nghỉ dưỡng tăng nóng',
    excerpt: 'Ngay sau khi sân bay quốc tế Đà Nẵng hoàn thành mở rộng đầu tháng 3/2026, condotel và biệt thự ven biển ghi nhận làn sóng mua vào mạnh mẽ. Tỷ suất sinh lời thực tế đã đạt 10–11%/năm.',
  },
  {
    slug: 'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau',
    published_at: '2026-03-01T10:00:00Z',
    title: 'Tháng 3/2026: Gói tín dụng 140.000 tỷ đồng mở rộng — Cơ hội vàng mua nhà lần đầu',
    excerpt: 'Từ tháng 3/2026, gói tín dụng nhà ở xã hội được nâng lên 140.000 tỷ đồng với lãi suất 6,5%/năm và thời hạn vay 30 năm. Đây là cơ hội hiếm có nhất từ trước đến nay cho người trẻ mua nhà lần đầu.',
  },
  {
    slug: 'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu',
    published_at: '2026-02-25T09:00:00Z',
    title: 'Quý I/2026: Bất động sản xanh và Net Zero chính thức trở thành tiêu chuẩn bắt buộc',
    excerpt: 'Kể từ tháng 3/2026, tất cả dự án bất động sản quy mô lớn vay vốn ngân hàng chính sách và thu hút FDI bắt buộc phải đạt tiêu chuẩn công trình xanh. Đây là bước ngoặt lớn cho thị trường.',
  },
];

const migration: Migration = {
  description: 'Update all article dates and titles to March 2026',

  async up(client: PoolClient) {
    for (const fix of dateFixes) {
      await client.query(
        `UPDATE articles
         SET published_at = $1, title = $2, excerpt = $3, updated_at = NOW()
         WHERE tenant_id = $4 AND slug = $5`,
        [fix.published_at, fix.title, fix.excerpt, TENANT_ID, fix.slug]
      );
    }
  },

  async down(client: PoolClient) {
    // Restore previous titles/dates from migration 032
    const prev: Array<{ slug: string; published_at: string; title: string; excerpt: string }> = [
      {
        slug: 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang',
        published_at: '2026-01-20T08:00:00Z',
        title: 'Thị trường bất động sản TP.HCM 2026: Cơ hội vàng sau giai đoạn tái cơ cấu',
        excerpt: 'Sau giai đoạn tái cơ cấu và pháp lý được siết chặt, thị trường bất động sản TP.HCM bước vào năm 2026 với nhiều tín hiệu phục hồi tích cực, đặc biệt ở phân khúc nhà ở trung cấp và căn hộ dịch vụ.',
      },
      {
        slug: 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu',
        published_at: '2026-01-15T09:30:00Z',
        title: 'Hà Nội đẩy mạnh hạ tầng vành đai 2026: Cơ hội đầu tư bất động sản ven đô',
        excerpt: 'Tuyến đường Vành đai 4 hoàn thành vào 2026 và hàng loạt cầu vượt sông Hồng mới mở ra làn sóng đầu tư mạnh mẽ vào bất động sản ven đô Hà Nội.',
      },
      {
        slug: 'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia',
        published_at: '2026-01-10T10:00:00Z',
        title: 'Căn hộ hạng sang Việt Nam 2026: Phân khúc không giảm giá, tiếp tục tăng trưởng',
        excerpt: 'Bất chấp biến động kinh tế, phân khúc căn hộ cao cấp và hạng sang tại Hà Nội, TP.HCM tiếp tục lập kỷ lục giá mới trong đầu năm 2026.',
      },
      {
        slug: 'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong',
        published_at: '2026-01-05T08:00:00Z',
        title: 'Đà Nẵng 2026: Điểm sáng đầu tư bất động sản nghỉ dưỡng hàng đầu Đông Nam Á',
        excerpt: 'Sân bay quốc tế Đà Nẵng mở rộng và hàng loạt resort 5 sao khai trương trong năm 2026 khiến thị trường bất động sản nghỉ dưỡng tại đây sôi động chưa từng thấy.',
      },
      {
        slug: 'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau',
        published_at: '2025-12-20T10:00:00Z',
        title: 'Luật Nhà ở 2023 và chính sách hỗ trợ 2026: Cơ hội mua nhà lần đầu cho người trẻ',
        excerpt: 'Các gói hỗ trợ lãi suất từ gói 140.000 tỷ đồng năm 2026, cùng chính sách Luật Nhà ở 2023, tạo cơ hội lịch sử cho người trẻ và gia đình thu nhập trung bình.',
      },
      {
        slug: 'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu',
        published_at: '2025-12-10T09:00:00Z',
        title: 'Bất động sản xanh và Net Zero 2026: Xu hướng tất yếu, lợi nhuận thực chất',
        excerpt: 'Việt Nam cam kết Net Zero 2050 tại COP28 đang thay đổi căn bản thị trường bất động sản: công trình xanh không còn là xa xỉ mà trở thành tiêu chuẩn bắt buộc từ năm 2026.',
      },
    ];
    for (const p of prev) {
      await client.query(
        `UPDATE articles SET published_at = $1, title = $2, excerpt = $3, updated_at = NOW()
         WHERE tenant_id = $4 AND slug = $5`,
        [p.published_at, p.title, p.excerpt, TENANT_ID, p.slug]
      );
    }
  },
};

export default migration;
