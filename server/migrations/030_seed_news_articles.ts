import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const articles = [
  {
    title: 'Thị trường bất động sản TP.HCM 2025: Cơ hội vàng sau giai đoạn tái cơ cấu',
    slug: 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang',
    excerpt:
      'Sau giai đoạn tái cơ cấu và pháp lý được siết chặt, thị trường bất động sản TP.HCM bước vào năm 2025 với nhiều tín hiệu phục hồi tích cực, đặc biệt ở phân khúc nhà ở trung cấp và căn hộ dịch vụ.',
    content: `
<h2>Tổng quan thị trường TP.HCM năm 2025</h2>
<p>Sau hai năm điều chỉnh sâu, thị trường bất động sản TP.HCM đang cho thấy những dấu hiệu phục hồi rõ nét. Lãi suất cho vay mua nhà đã giảm về mức 7–8%/năm, thanh khoản cải thiện và nguồn cung mới được cấp phép trở lại tại nhiều dự án lớn.</p>
<h3>Phân khúc dẫn dắt thị trường</h3>
<ul>
  <li><strong>Căn hộ trung cấp (2–4 tỷ đồng):</strong> Giao dịch tăng 35% so với cùng kỳ, dẫn đầu tại các khu vực Bình Dương, Nhà Bè, Bình Chánh.</li>
  <li><strong>Nhà phố liền kề:</strong> Đất nền khu vực vành đai 3 được quan tâm trở lại sau khi thông tin quy hoạch được công bố chính thức.</li>
  <li><strong>Căn hộ cao cấp:</strong> Tập trung tại Thủ Thiêm và khu trung tâm Quận 1, giá từ 8.000–15.000 USD/m² vẫn được hấp thụ tốt bởi khách hàng trong nước lẫn người nước ngoài.</li>
</ul>
<h3>Nhận định của chuyên gia</h3>
<p>Ông Nguyễn Văn Đính – Chủ tịch Hội Môi giới Bất động sản Việt Nam – nhận định: <em>"Năm 2025 là năm của sự ổn định và củng cố niềm tin. Các dự án có pháp lý sạch, chủ đầu tư uy tín và vị trí kết nối hạ tầng tốt sẽ được thị trường chào đón mạnh mẽ."</em></p>
<h3>Khuyến nghị cho nhà đầu tư</h3>
<p>Với xu thế hiện tại, các chuyên gia khuyến nghị nhà đầu tư nên ưu tiên các dự án gần tuyến metro số 1 và số 2, các khu vực đang được đầu tư hạ tầng như Thành phố Thủ Đức và khu Nam TP.HCM.</p>
    `.trim(),
    category: 'Thị trường',
    tags: ['TP.HCM', 'bất động sản', '2025', 'đầu tư', 'phục hồi'],
    author: 'Ban Biên Tập SGS LAND',
    cover_image: 'https://images.unsplash.com/photo-1583417267826-aebc4d1537ab?w=1200&q=80&fit=crop',
    published_at: '2025-03-15T08:00:00Z',
    view_count: 1842,
  },
  {
    title: 'Hà Nội đẩy mạnh hạ tầng vành đai: Cơ hội đầu tư bất động sản khu Tây và Nam',
    slug: 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu',
    excerpt:
      'Tuyến đường Vành đai 4 và hàng loạt cầu vượt sông Hồng đang được đẩy nhanh tiến độ, mở ra làn sóng đầu tư mạnh mẽ vào bất động sản ven đô Hà Nội trong năm 2025.',
    content: `
<h2>Vành đai 4 - Đòn bẩy phát triển đô thị Hà Nội</h2>
<p>Dự án đường Vành đai 4 – Vùng Thủ đô với tổng chiều dài 112,8 km đang được thi công với tốc độ thần tốc. Dự kiến hoàn thành vào năm 2026, tuyến đường này sẽ kết nối trực tiếp Hà Nội với Bắc Ninh, Hưng Yên và nhiều tỉnh thành lân cận.</p>
<h3>Các khu vực hưởng lợi trực tiếp</h3>
<ul>
  <li><strong>Hoài Đức – Đan Phượng:</strong> Giá đất tăng 20–30% kể từ khi khởi công Vành đai 4. Nhiều dự án khu đô thị mới đang triển khai hàng nghìn sản phẩm ra thị trường.</li>
  <li><strong>Mê Linh – Đông Anh:</strong> Hưởng lợi từ cả Vành đai 4 và cầu Tứ Liên, khu vực này đang thu hút nhiều nhà đầu tư dài hạn.</li>
  <li><strong>Thường Tín – Thanh Trì:</strong> Phía Nam Hà Nội cũng được hưởng lợi với hạ tầng giao thông ngày càng hoàn thiện.</li>
</ul>
<h3>Cầu vượt sông Hồng – Thay đổi cục diện thị trường</h3>
<p>Thành phố Hà Nội có kế hoạch xây dựng thêm 10 cầu qua sông Hồng trong giai đoạn 2025–2035. Đây là yếu tố then chốt giúp các khu vực Long Biên, Gia Lâm và Đông Anh kết nối trực tiếp với trung tâm, gia tăng đáng kể giá trị bất động sản.</p>
<h3>Lời khuyên từ chuyên gia SGS LAND</h3>
<p>Để tối ưu hóa lợi nhuận đầu tư, nhà đầu tư nên xem xét các dự án nằm trong bán kính 2–3 km so với các nút giao Vành đai 4, đặc biệt là những dự án đã được phê duyệt quy hoạch chi tiết 1/500.</p>
    `.trim(),
    category: 'Đầu tư',
    tags: ['Hà Nội', 'Vành đai 4', 'hạ tầng', 'đầu tư', 'đất nền'],
    author: 'Phòng Nghiên cứu SGS LAND',
    cover_image: 'https://images.unsplash.com/photo-1583419529070-28d7c9cb3dae?w=1200&q=80&fit=crop',
    published_at: '2025-03-08T09:30:00Z',
    view_count: 2305,
  },
  {
    title: 'Căn hộ hạng sang tại Việt Nam: Phân khúc duy nhất không có dấu hiệu giảm giá',
    slug: 'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia',
    excerpt:
      'Trong khi phần lớn phân khúc bất động sản đang điều chỉnh, căn hộ hạng sang tại TP.HCM và Hà Nội tiếp tục tăng giá mạnh, thu hút cả nhà đầu tư trong nước lẫn người nước ngoài.',
    content: `
<h2>Làn sóng căn hộ hạng sang lan tỏa cả nước</h2>
<p>Theo báo cáo quý I/2025 của CBRE Việt Nam, giá căn hộ hạng sang tại TP.HCM đạt trung bình 12.500 USD/m², tăng 18% so với năm 2024. Tại Hà Nội, mức giá trung bình cũng đạt 9.800 USD/m², tăng 15%.</p>
<h3>Vì sao phân khúc này vẫn tăng giá?</h3>
<ul>
  <li><strong>Nguồn cung khan hiếm:</strong> Quỹ đất lõi đô thị ngày càng cạn kiệt, số lượng dự án hạng sang mới cực kỳ hạn chế.</li>
  <li><strong>Nhu cầu thực tế cao:</strong> Tầng lớp trung lưu và thượng lưu Việt Nam tăng nhanh, với hơn 700.000 người có thu nhập trên 100.000 USD/năm (McKinsey, 2024).</li>
  <li><strong>Hút khách nước ngoài:</strong> Người nước ngoài làm việc tại Việt Nam và Việt kiều là nhóm khách hàng quan trọng, đặc biệt tại TP.HCM.</li>
</ul>
<h3>Những dự án hạng sang tiêu biểu năm 2025</h3>
<p>Một số dự án đang tạo sóng trên thị trường: The River Thủ Thiêm (TP.HCM), Masteri West Heights (Hà Nội), Empire City (TP.HCM) và Starlake Tây Hồ Tây (Hà Nội). Mỗi dự án đều có giá bán từ 150 triệu đến trên 500 triệu đồng/m².</p>
<h3>Triển vọng năm 2025–2026</h3>
<p>Các chuyên gia dự báo phân khúc này sẽ tiếp tục tăng trưởng 10–15% mỗi năm trong giai đoạn 2025–2026, đặc biệt khi Luật Kinh doanh Bất động sản 2023 cho phép người nước ngoài mua căn hộ dễ dàng hơn.</p>
    `.trim(),
    category: 'Phân khúc cao cấp',
    tags: ['căn hộ hạng sang', 'luxury', 'đầu tư', 'TP.HCM', 'Hà Nội'],
    author: 'Nguyễn Minh Hoàng – Chuyên gia Phân tích',
    cover_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop',
    published_at: '2025-02-28T10:00:00Z',
    view_count: 3187,
  },
  {
    title: 'Đà Nẵng 2025: Điểm sáng đầu tư bất động sản nghỉ dưỡng hàng đầu Đông Nam Á',
    slug: 'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong',
    excerpt:
      'Với hạ tầng du lịch hoàn thiện, sân bay quốc tế mở rộng và hàng loạt khu nghỉ dưỡng 5 sao, Đà Nẵng đang khẳng định vị thế là trung tâm bất động sản nghỉ dưỡng hàng đầu khu vực.',
    content: `
<h2>Đà Nẵng – Thành phố đáng sống và đáng đầu tư</h2>
<p>Đà Nẵng liên tục được vinh danh trong các bảng xếp hạng điểm đến du lịch hàng đầu châu Á. Năm 2024, thành phố đón hơn 9 triệu lượt khách, trong đó 3,5 triệu khách quốc tế – một kỷ lục mới. Điều này tạo nền tảng vững chắc cho thị trường bất động sản nghỉ dưỡng phát triển bền vững.</p>
<h3>Các phân khúc nổi bật</h3>
<ul>
  <li><strong>Condotel ven biển:</strong> Tỷ suất lợi nhuận cam kết 8–10%/năm từ các chủ đầu tư lớn, thu hút nhà đầu tư tìm kiếm dòng tiền thụ động.</li>
  <li><strong>Biệt thự nghỉ dưỡng:</strong> Khu vực Bà Nà Hills, Hội An (Quảng Nam) và Non Nước đang là tâm điểm với mức giá 5–30 tỷ đồng/căn.</li>
  <li><strong>Shophouse thương mại:</strong> Dọc theo các trục đường ven biển Võ Nguyên Giáp và Trường Sa, shophouse đang được nhiều nhà đầu tư lựa chọn để kinh doanh dịch vụ du lịch.</li>
</ul>
<h3>Hạ tầng đột phá 2025</h3>
<p>Sân bay quốc tế Đà Nẵng đang được mở rộng lên công suất 30 triệu hành khách/năm (dự kiến hoàn thành 2026). Cùng với đó, tuyến cao tốc Đà Nẵng – Quảng Ngãi mở rộng và cao tốc Hòa Liên – Túy Loan sẽ kết nối thông suốt toàn vùng.</p>
<h3>Lưu ý pháp lý quan trọng</h3>
<p>Nhà đầu tư nên cẩn trọng kiểm tra sổ đỏ/giấy phép xây dựng, đặc biệt với các dự án condotel vốn có nhiều vướng mắc pháp lý trong quá khứ. SGS LAND sẵn sàng hỗ trợ tư vấn pháp lý miễn phí cho quý khách hàng.</p>
    `.trim(),
    category: 'Đầu tư',
    tags: ['Đà Nẵng', 'nghỉ dưỡng', 'condotel', 'du lịch', 'đầu tư'],
    author: 'Trần Thị Lan – Chuyên gia Bất động sản nghỉ dưỡng',
    cover_image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&q=80&fit=crop',
    published_at: '2025-02-14T08:00:00Z',
    view_count: 2714,
  },
  {
    title: 'Luật Nhà ở 2023 và chính sách hỗ trợ 2025: Cơ hội lớn cho người mua nhà lần đầu',
    slug: 'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau',
    excerpt:
      'Nhiều chính sách ưu đãi về thuế, lãi suất và quỹ đất nhà ở xã hội được ban hành trong năm 2025 đang mở ra cơ hội hiếm có cho người mua nhà lần đầu tại Việt Nam.',
    content: `
<h2>Hành lang pháp lý mới – Cú hích cho người mua nhà</h2>
<p>Luật Nhà ở 2023 (có hiệu lực từ 1/8/2024) và các Nghị định hướng dẫn đã tạo ra hành lang pháp lý rõ ràng hơn, đặc biệt ưu tiên phát triển nhà ở xã hội và hỗ trợ người thu nhập thấp, trung bình mua nhà lần đầu.</p>
<h3>Các chính sách hỗ trợ nổi bật</h3>
<ul>
  <li><strong>Gói tín dụng 120.000 tỷ đồng:</strong> Lãi suất ưu đãi 7%/năm cho người mua nhà ở xã hội và nhà ở công nhân, thời hạn vay tối đa 25 năm.</li>
  <li><strong>Miễn thuế thu nhập cá nhân:</strong> Người mua nhà lần đầu được miễn thuế TNCN đối với lãi tiết kiệm dùng để mua nhà ở xã hội.</li>
  <li><strong>Tăng quỹ đất nhà ở xã hội:</strong> Yêu cầu các dự án thương mại dành 20% diện tích đất cho nhà ở xã hội, tăng nguồn cung đáng kể.</li>
  <li><strong>Mở rộng đối tượng vay:</strong> Người độc thân dưới 35 tuổi, cặp vợ chồng mới kết hôn đều được vay ưu đãi không cần tài sản đảm bảo với khoản vay dưới 500 triệu đồng.</li>
</ul>
<h3>Điều kiện để được hưởng ưu đãi</h3>
<p>Người mua cần đáp ứng: (1) Chưa có nhà ở hoặc nhà ở có diện tích dưới 10m²/người; (2) Thu nhập không quá 11 triệu đồng/tháng (cá nhân) hoặc 22 triệu đồng/tháng (hộ gia đình); (3) Đăng ký hộ khẩu tại địa phương hoặc có giấy xác nhận đang làm việc.</p>
<h3>Hành động ngay hôm nay</h3>
<p>Với nhu cầu cao và nguồn cung vẫn còn hạn chế, các chuyên gia khuyến cáo người có nhu cầu nên đăng ký sớm và chuẩn bị hồ sơ đầy đủ. Đội ngũ tư vấn SGS LAND sẵn sàng hỗ trợ bạn hoàn thiện thủ tục và tìm kiếm dự án phù hợp.</p>
    `.trim(),
    category: 'Chính sách',
    tags: ['nhà ở xã hội', 'chính sách', 'Luật Nhà ở', 'mua nhà lần đầu', 'lãi suất'],
    author: 'Lê Hoàng Nam – Chuyên gia Pháp lý',
    cover_image: 'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=1200&q=80&fit=crop',
    published_at: '2025-01-20T09:00:00Z',
    view_count: 4521,
  },
  {
    title: 'Bất động sản xanh – Net Zero: Xu hướng tất yếu định hình thị trường thập kỷ tới',
    slug: 'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu',
    excerpt:
      'Khi nhận thức về môi trường tăng cao và các tiêu chuẩn ESG trở thành điều kiện bắt buộc với doanh nghiệp niêm yết, bất động sản xanh đang chuyển từ xu hướng thành nhu cầu cốt lõi.',
    content: `
<h2>Bất động sản xanh – Không còn là lựa chọn xa xỉ</h2>
<p>Chỉ vài năm trước, "nhà xanh" hay "tòa nhà xanh" còn là khái niệm xa lạ với đa số người Việt. Nhưng đến năm 2025, hơn 40% người mua nhà trong khảo sát của JLL Việt Nam cho biết tiêu chí bền vững là yếu tố quan trọng trong quyết định mua. Đây là sự chuyển dịch ngoạn mục chỉ trong 3 năm.</p>
<h3>Các tiêu chuẩn xanh phổ biến tại Việt Nam</h3>
<ul>
  <li><strong>LEED (Mỹ):</strong> Tiêu chuẩn quốc tế phổ biến nhất, hiện có 180+ công trình đạt chứng nhận tại Việt Nam.</li>
  <li><strong>LOTUS (Việt Nam):</strong> Tiêu chuẩn của Hội đồng Công trình Xanh Việt Nam (VGBC), phù hợp với điều kiện khí hậu và quy định địa phương.</li>
  <li><strong>Green Mark (Singapore):</strong> Phổ biến trong các dự án văn phòng và khu công nghiệp có vốn đầu tư từ Singapore.</li>
</ul>
<h3>Lợi ích kinh tế đã được chứng minh</h3>
<p>Theo nghiên cứu của World Green Building Council, các tòa nhà xanh tiết kiệm 20–30% năng lượng và 30–50% nước so với công trình thông thường. Đặc biệt, giá thuê văn phòng xanh tại TP.HCM cao hơn 15–20% so với tòa nhà thông thường cùng vị trí.</p>
<h3>Chính phủ vào cuộc mạnh mẽ</h3>
<p>Chiến lược quốc gia về tăng trưởng xanh giai đoạn 2021–2030 yêu cầu 25% công trình xây dựng mới phải đạt tiêu chuẩn xanh vào năm 2030. Nhà nước cũng có các ưu đãi thuế và hỗ trợ lãi suất cho dự án đạt chứng nhận xanh.</p>
<h3>Cơ hội đầu tư</h3>
<p>Các dự án như Ecopark (Hưng Yên), Vinhomes Ocean Park, The Metropole Thủ Thiêm hay Masterise Grand View là những ví dụ điển hình về việc tích hợp tiêu chí xanh vào thiết kế và vận hành, và tất cả đều ghi nhận tỷ lệ hấp thụ rất cao.</p>
    `.trim(),
    category: 'Xu hướng',
    tags: ['bất động sản xanh', 'ESG', 'Net Zero', 'công trình xanh', 'LEED', 'LOTUS'],
    author: 'Phạm Thúy Hà – Chuyên gia Phát triển Bền vững',
    cover_image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80&fit=crop',
    published_at: '2025-01-05T08:00:00Z',
    view_count: 1963,
  },
];

const migration: Migration = {
  description: 'Seed 6 initial news articles for the SGS LAND news section',

  async up(client: PoolClient) {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='tags') THEN
          ALTER TABLE articles ADD COLUMN tags JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='author') THEN
          ALTER TABLE articles ADD COLUMN author VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='cover_image') THEN
          ALTER TABLE articles ADD COLUMN cover_image TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='view_count') THEN
          ALTER TABLE articles ADD COLUMN view_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'articles_tenant_id_slug_key'
        ) THEN
          ALTER TABLE articles ADD CONSTRAINT articles_tenant_id_slug_key UNIQUE (tenant_id, slug);
        END IF;
      END $$;
    `);

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
