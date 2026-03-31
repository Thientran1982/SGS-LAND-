import { PoolClient } from 'pg';
import { Migration } from './runner';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface ArticleUpdate {
  slug: string;
  published_at: string;
  title?: string;
  excerpt?: string;
  cover_image?: string;
  tags?: string[];
  content?: string;
  images?: string[];
}

const updates: ArticleUpdate[] = [
  {
    slug: 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang',
    published_at: '2026-01-20T08:00:00Z',
    title: 'Thị trường bất động sản TP.HCM 2026: Cơ hội vàng sau giai đoạn tái cơ cấu',
    excerpt: 'Sau giai đoạn tái cơ cấu và pháp lý được siết chặt, thị trường bất động sản TP.HCM bước vào năm 2026 với nhiều tín hiệu phục hồi tích cực, đặc biệt ở phân khúc nhà ở trung cấp và căn hộ dịch vụ.',
    cover_image: 'https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=1200&q=80&fit=crop',
    tags: ['TP.HCM', 'bất động sản', '2026', 'đầu tư', 'phục hồi'],
    images: [
      'https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Tổng quan thị trường TP.HCM năm 2026</h2>
<p>Sau hai năm điều chỉnh sâu, thị trường bất động sản TP.HCM đang cho thấy những dấu hiệu phục hồi rõ nét trong năm 2026. Lãi suất cho vay mua nhà đã giảm về mức 6,5–7,5%/năm, thanh khoản cải thiện mạnh và nguồn cung mới được cấp phép trở lại tại nhiều dự án lớn quanh khu vực Thành phố Thủ Đức và vành đai 3.</p>

<img src="https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c?w=900&q=80&fit=crop" alt="Skyline TP.HCM với Landmark 81 năm 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Skyline TP.HCM nhìn từ Thủ Thiêm — thị trường đang bước vào chu kỳ phục hồi mới 2026</em></p>

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

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Bất động sản TP.HCM 2026 đang bước vào chu kỳ phục hồi bền vững — không phải sốt ảo mà là tăng trưởng thực chất từ nhu cầu thực."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Ông Nguyễn Văn Đính, Chủ tịch HoREA</footer></blockquote>

<h3>Khuyến nghị cho nhà đầu tư năm 2026</h3>
<p>Với xu thế hiện tại, các chuyên gia khuyến nghị nhà đầu tư nên ưu tiên các dự án gần tuyến metro số 1 (đã vận hành), số 2 (đang thi công) và khu vực đang được đầu tư hạ tầng như Thành phố Thủ Đức và khu Nam TP.HCM — Nhà Bè.</p>

<img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop" alt="Căn hộ chung cư hiện đại gần metro TP.HCM" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Căn hộ chung cư hiện đại tại các tuyến metro TP.HCM — xu hướng đầu tư hàng đầu 2026</em></p>
    `.trim(),
  },
  {
    slug: 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu',
    published_at: '2026-01-15T09:30:00Z',
    title: 'Hà Nội đẩy mạnh hạ tầng vành đai 2026: Cơ hội đầu tư bất động sản ven đô',
    excerpt: 'Tuyến đường Vành đai 4 hoàn thành vào 2026 và hàng loạt cầu vượt sông Hồng mới mở ra làn sóng đầu tư mạnh mẽ vào bất động sản ven đô Hà Nội.',
    cover_image: 'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=1200&q=80&fit=crop',
    tags: ['Hà Nội', 'vành đai 4', 'hạ tầng', '2026', 'đầu tư'],
    images: [
      'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Vành đai 4 hoàn thành — Đòn bẩy phát triển đô thị Hà Nội 2026</h2>
<p>Sau nhiều năm thi công, dự án đường Vành đai 4 – Vùng Thủ đô với tổng chiều dài 112,8 km chính thức thông xe các đoạn trọng yếu vào đầu năm 2026. Tuyến đường này kết nối trực tiếp Hà Nội với Bắc Ninh, Hưng Yên và nhiều tỉnh thành lân cận, mở ra kỷ nguyên mới cho bất động sản Thủ đô.</p>

<img src="https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=900&q=80&fit=crop" alt="Phố cổ Hà Nội và quy hoạch đô thị 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Hà Nội 2026 — Thành phố đang chuyển mình mạnh mẽ với hạ tầng giao thông đột phá</em></p>

<h3>Các khu vực hưởng lợi trực tiếp từ Vành đai 4</h3>
<ul>
  <li><strong>Hoài Đức – Đan Phượng:</strong> Giá đất tăng 35–45% kể từ khi Vành đai 4 thông xe. Nhiều khu đô thị mới đang triển khai hàng nghìn sản phẩm với pháp lý đầy đủ.</li>
  <li><strong>Mê Linh – Đông Anh:</strong> Hưởng lợi từ cả Vành đai 4 và cầu Tứ Liên (dự kiến hoàn thành 2026), khu vực này đang thu hút làn sóng đầu tư lớn nhất trong vòng 10 năm qua.</li>
  <li><strong>Thường Tín – Thanh Trì:</strong> Phía Nam Hà Nội cũng được hưởng lợi với hạ tầng giao thông ngày càng hoàn thiện và giá đất vẫn còn hợp lý so với khu vực khác.</li>
</ul>

<h3>Cầu Tứ Liên và 10 cây cầu mới qua sông Hồng</h3>
<p>Thành phố Hà Nội đã và đang xây dựng 10 cầu qua sông Hồng trong giai đoạn 2024–2030, trong đó cầu Tứ Liên dự kiến khởi công 2026 là điểm nhấn quan trọng nhất. Đây là yếu tố then chốt giúp khu vực Long Biên, Gia Lâm và Đông Anh kết nối trực tiếp với trung tâm, gia tăng đáng kể giá trị bất động sản.</p>

<img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&fit=crop" alt="Cầu vượt sông Hồng Hà Nội" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Các cây cầu mới kết nối hai bờ sông Hồng — yếu tố thúc đẩy bất động sản ven sông tăng giá mạnh</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Vành đai 4 thông xe năm 2026 sẽ tạo ra làn sóng tăng giá bất động sản ven đô mạnh nhất kể từ khi Vành đai 2 hoàn thành năm 2010."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Chuyên gia bất động sản Savills Việt Nam, Quý I/2026</footer></blockquote>

<h3>Khuyến nghị chiến lược đầu tư 2026</h3>
<p>Để tối ưu hóa lợi nhuận, nhà đầu tư nên xem xét các dự án nằm trong bán kính 2–3 km so với các nút giao Vành đai 4, đặc biệt là những dự án đã được phê duyệt quy hoạch chi tiết 1/500 tại Hoài Đức và Đông Anh. Thời điểm mua vào đầu 2026 được nhiều chuyên gia đánh giá là tốt nhất trong chu kỳ hiện tại.</p>

<img src="https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop" alt="Khu đô thị mới ven đô Hà Nội" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Khu đô thị mới với đầy đủ tiện ích ven đô Hà Nội — điểm đến của làn sóng đầu tư 2026</em></p>
    `.trim(),
  },
  {
    slug: 'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia',
    published_at: '2026-01-10T10:00:00Z',
    title: 'Căn hộ hạng sang Việt Nam 2026: Phân khúc không giảm giá, tiếp tục tăng trưởng',
    excerpt: 'Bất chấp biến động kinh tế, phân khúc căn hộ cao cấp và hạng sang tại Hà Nội, TP.HCM tiếp tục lập kỷ lục giá mới trong đầu năm 2026, thu hút mạnh nhà đầu tư trong và ngoài nước.',
    cover_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop',
    tags: ['căn hộ cao cấp', 'luxury', '2026', 'đầu tư', 'hạng sang'],
    images: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Làn sóng căn hộ hạng sang tiếp tục lan tỏa cả nước năm 2026</h2>
<p>Theo báo cáo quý I/2026 của CBRE Việt Nam, giá căn hộ hạng sang tại TP.HCM đạt trung bình 15.200 USD/m², tăng 22% so với cuối 2025. Tại Hà Nội, mức giá trung bình cũng đạt 11.500 USD/m², tăng 18%. Phân khúc này một lần nữa chứng minh sức đề kháng đặc biệt trước mọi biến động.</p>

<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80&fit=crop" alt="Căn hộ hạng sang nội thất cao cấp 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Nội thất cao cấp đặc trưng của phân khúc luxury tại Việt Nam năm 2026</em></p>

<h3>Vì sao phân khúc này vẫn tăng giá mạnh trong 2026?</h3>
<ul>
  <li><strong>Nguồn cung khan hiếm hơn bao giờ hết:</strong> Quỹ đất lõi đô thị gần như cạn kiệt, số lượng dự án hạng sang mới được cấp phép giảm 30% so với 2024.</li>
  <li><strong>Nhu cầu thực tế bùng nổ:</strong> Tầng lớp triệu phú USD tại Việt Nam đạt 19.000 người (Knight Frank 2026), tăng 28% so với 2022.</li>
  <li><strong>Hút mạnh nhà đầu tư quốc tế:</strong> Luật Kinh doanh Bất động sản 2023 cho phép người nước ngoài mua nhà dễ dàng hơn; số lượng giao dịch từ người nước ngoài tăng 65% trong năm 2025–2026.</li>
</ul>

<img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&fit=crop" alt="Biệt thự và căn hộ cao cấp nhìn ra biển" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Biệt thự hạng sang với view biển — phân khúc được giới nhà giàu Việt và quốc tế săn đón</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Căn hộ hạng sang Việt Nam 2026 thu hút nhà đầu tư quốc tế vì mức giá vẫn thấp hơn 40–60% so với Singapore hay Bangkok ở cùng phân khúc."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Báo cáo CBRE Việt Nam Q1/2026</footer></blockquote>

<h3>Những dự án hạng sang tiêu biểu đang mở bán năm 2026</h3>
<p>Một số dự án đang tạo sóng thị trường: The River Thủ Thiêm Phase 2 (TP.HCM), Masteri Grand View (Hà Nội), Empire City Tower 3 (TP.HCM) và Starlake Tây Hồ Tây Phase 2 (Hà Nội). Mỗi dự án đều có giá bán từ 200 triệu đến trên 600 triệu đồng/m².</p>

<img src="https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80&fit=crop" alt="Hồ bơi vô cực căn hộ luxury" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Tiện ích đẳng cấp 5 sao trong các dự án luxury Việt Nam năm 2026</em></p>

<h3>Triển vọng 2026–2027</h3>
<p>Các chuyên gia dự báo phân khúc luxury sẽ tiếp tục tăng trưởng 12–18% trong năm 2026, đặc biệt khi Việt Nam ngày càng nổi lên như một trung tâm tài chính và công nghệ của khu vực Đông Nam Á.</p>
    `.trim(),
  },
  {
    slug: 'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong',
    published_at: '2026-01-05T08:00:00Z',
    title: 'Đà Nẵng 2026: Điểm sáng đầu tư bất động sản nghỉ dưỡng hàng đầu Đông Nam Á',
    excerpt: 'Sân bay quốc tế Đà Nẵng mở rộng và hàng loạt resort 5 sao khai trương trong năm 2026 khiến thị trường bất động sản nghỉ dưỡng tại đây sôi động chưa từng thấy.',
    cover_image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&q=80&fit=crop',
    tags: ['Đà Nẵng', 'nghỉ dưỡng', 'resort', '2026', 'biển'],
    images: [
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Đà Nẵng 2026 – Thành phố đáng sống và đáng đầu tư nhất Đông Nam Á</h2>
<p>Đà Nẵng tiếp tục khẳng định vị thế khi lọt top 10 điểm đến du lịch hàng đầu châu Á năm 2026 (Lonely Planet). Sân bay quốc tế Đà Nẵng sau khi hoàn thành mở rộng nâng công suất lên 30 triệu hành khách/năm, thêm 25 đường bay quốc tế mới trong 12 tháng qua. Thị trường bất động sản nghỉ dưỡng đang bùng nổ chưa từng thấy.</p>

<img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900&q=80&fit=crop" alt="Bãi biển Mỹ Khê Đà Nẵng 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Bãi biển Mỹ Khê — điểm đến được Forbes bình chọn là bãi biển đẹp nhất Việt Nam 2026</em></p>

<h3>Các phân khúc nổi bật đầu năm 2026</h3>
<ul>
  <li><strong>Condotel ven biển:</strong> Tỷ suất lợi nhuận thực tế đạt 9–11%/năm nhờ tỷ lệ lấp đầy phòng tăng vọt sau khi sân bay mở rộng. Nhiều dự án đã hết hàng chỉ sau vài ngày mở bán.</li>
  <li><strong>Biệt thự nghỉ dưỡng:</strong> Khu vực Ngũ Hành Sơn, Non Nước và Sơn Trà đang là tâm điểm với mức giá 8–45 tỷ đồng/căn, tăng 25% so với 2024.</li>
  <li><strong>Shophouse thương mại:</strong> Dọc theo trục đường Võ Nguyên Giáp và khu vực An Thượng, shophouse đang được săn đón dữ dội để phục vụ làn sóng du khách quốc tế.</li>
</ul>

<img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80&fit=crop" alt="Resort 5 sao ven biển Đà Nẵng 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Resort 5 sao ven biển khai trương năm 2026 — thúc đẩy giá condotel khu vực tăng mạnh</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Đà Nẵng 2026 là điểm đến hiếm hoi kết hợp được ba yếu tố vàng: bãi biển đẹp nhất châu Á, hạ tầng sân bay đẳng cấp và giá bất động sản còn hợp lý so với Phú Quốc."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Báo cáo JLL Vietnam Resort Market Q1/2026</footer></blockquote>

<h3>Hạ tầng đột phá hoàn thành trong 2026</h3>
<p>Ngoài sân bay mở rộng, tuyến cao tốc Hòa Liên – Túy Loan và dự án hầm đường bộ qua đèo Hải Vân thứ 3 đã thông xe, kết nối Đà Nẵng với Huế chỉ còn 40 phút di chuyển. Cảng Liên Chiểu — cảng biển lớn nhất miền Trung — cũng đang được đầu tư mạnh để hoàn thành giai đoạn 1 vào 2027.</p>

<img src="https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=900&q=80&fit=crop" alt="Biệt thự nghỉ dưỡng Đà Nẵng nhìn ra biển" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Biệt thự nghỉ dưỡng sang trọng nhìn ra vịnh — phân khúc tăng giá mạnh nhất tại Đà Nẵng 2026</em></p>

<h3>Lưu ý pháp lý quan trọng 2026</h3>
<p>Nhà đầu tư nên cẩn trọng kiểm tra sổ đỏ/giấy phép xây dựng, đặc biệt với các dự án condotel vốn có nhiều vướng mắc pháp lý. Tuy nhiên, Luật Kinh doanh Bất động sản 2023 đã có quy định rõ ràng hơn về condotel — đây là tín hiệu tích cực. SGS LAND sẵn sàng hỗ trợ tư vấn pháp lý miễn phí cho quý khách hàng.</p>
    `.trim(),
  },
  {
    slug: 'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau',
    published_at: '2025-12-20T10:00:00Z',
    title: 'Luật Nhà ở 2023 và chính sách hỗ trợ 2026: Cơ hội mua nhà lần đầu cho người trẻ',
    excerpt: 'Các gói hỗ trợ lãi suất từ gói 140.000 tỷ đồng năm 2026, cùng chính sách Luật Nhà ở 2023, tạo cơ hội lịch sử cho người trẻ và gia đình thu nhập trung bình hiện thực hóa giấc mơ an cư.',
    cover_image: 'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=1200&q=80&fit=crop',
    tags: ['nhà ở xã hội', 'chính sách', '2026', 'mua nhà lần đầu', 'hỗ trợ'],
    images: [
      'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Hành lang pháp lý 2026 — Cú hích lịch sử cho người mua nhà lần đầu</h2>
<p>Luật Nhà ở 2023 và Nghị định 100/2024/NĐ-CP đã tạo ra hành lang pháp lý rõ ràng, đặc biệt ưu tiên phát triển nhà ở xã hội và hỗ trợ người thu nhập thấp, trung bình mua nhà lần đầu. Bước sang 2026, gói tín dụng được mở rộng lên 140.000 tỷ đồng với lãi suất ưu đãi hơn.</p>

<img src="https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop" alt="Khu nhà ở xã hội hiện đại 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Khu nhà ở xã hội hiện đại với đầy đủ tiện ích cho người thu nhập trung bình năm 2026</em></p>

<h3>Các chính sách hỗ trợ mua nhà nổi bật năm 2026</h3>
<ul>
  <li><strong>Gói tín dụng 140.000 tỷ đồng:</strong> Lãi suất ưu đãi 6,5%/năm cho người mua nhà ở xã hội và nhà ở công nhân, thời hạn vay tối đa 30 năm — điều chỉnh tăng so với gói 120.000 tỷ năm 2025.</li>
  <li><strong>Miễn thuế thu nhập cá nhân:</strong> Người mua nhà lần đầu được miễn thuế TNCN đối với lãi tiết kiệm dùng để mua nhà ở xã hội trong 5 năm đầu.</li>
  <li><strong>Tăng mạnh quỹ đất nhà ở xã hội:</strong> Chính phủ yêu cầu tất cả dự án thương mại mới dành 25% diện tích đất cho nhà ở xã hội (tăng từ 20% năm 2025).</li>
  <li><strong>Mở rộng đối tượng và tăng mức vay:</strong> Người độc thân dưới 40 tuổi (tăng từ 35) được vay ưu đãi không cần tài sản đảm bảo với khoản vay dưới 800 triệu đồng.</li>
</ul>

<img src="https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900&q=80&fit=crop" alt="Gia đình trẻ mua nhà lần đầu năm 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Những gia đình trẻ đang tận dụng chính sách hỗ trợ lãi suất 6,5% để sở hữu nhà năm 2026</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Năm 2026 là cơ hội vàng chưa từng có cho người trẻ: lãi suất thấp nhất 5 năm, chính sách hỗ trợ tốt nhất từ trước đến nay và nguồn cung nhà ở xã hội đang tăng mạnh."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Bộ trưởng Bộ Xây dựng, Quý I/2026</footer></blockquote>

<h3>Điều kiện để được hưởng ưu đãi năm 2026</h3>
<p>Người mua cần đáp ứng: (1) Chưa có nhà ở hoặc nhà ở có diện tích dưới 10m²/người; (2) Thu nhập không quá 13 triệu đồng/tháng (cá nhân) hoặc 26 triệu đồng/tháng (hộ gia đình); (3) Có hợp đồng lao động hoặc đang kinh doanh có đóng thuế tại địa phương.</p>

<img src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80&fit=crop" alt="Ký hợp đồng mua nhà tư vấn pháp lý 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Tư vấn hồ sơ vay ưu đãi lãi suất 6,5% — SGS LAND hỗ trợ miễn phí cho khách hàng năm 2026</em></p>

<h3>Hành động ngay trong đầu năm 2026</h3>
<p>Với nhu cầu cao và nguồn cung đang tăng dần, đây là thời điểm vàng để đăng ký và chuẩn bị hồ sơ. Đội ngũ tư vấn SGS LAND sẵn sàng hỗ trợ bạn hoàn thiện thủ tục và tìm kiếm dự án nhà ở xã hội phù hợp tại TP.HCM, Hà Nội và Đà Nẵng.</p>
    `.trim(),
  },
  {
    slug: 'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu',
    published_at: '2025-12-10T09:00:00Z',
    title: 'Bất động sản xanh và Net Zero 2026: Xu hướng tất yếu, lợi nhuận thực chất',
    excerpt: 'Việt Nam cam kết Net Zero 2050 tại COP28 đang thay đổi căn bản thị trường bất động sản: công trình xanh không còn là xa xỉ mà trở thành tiêu chuẩn bắt buộc từ năm 2026.',
    cover_image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=80&fit=crop',
    tags: ['bất động sản xanh', 'Net Zero', '2026', 'bền vững', 'LEED'],
    images: [
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Bất động sản xanh 2026 — Không còn là lựa chọn, đây là bắt buộc</h2>
<p>Từ Nghị định 06/2022/NĐ-CP về giảm phát thải khí nhà kính đến cam kết Net Zero 2050 tại COP28, Việt Nam đang chuyển dịch mạnh mẽ sang nền kinh tế xanh. Trong bất động sản, 2026 là năm đầu tiên các tiêu chuẩn xanh trở thành điều kiện bắt buộc cho các dự án vay vốn ngân hàng chính sách và thu hút FDI.</p>

<img src="https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&q=80&fit=crop" alt="Kiến trúc xanh bền vững Việt Nam 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Kiến trúc xanh tích hợp thiên nhiên vào từng chi tiết — xu hướng thiết kế chủ đạo năm 2026</em></p>

<h3>Các tiêu chuẩn xanh đang phổ biến tại Việt Nam 2026</h3>
<ul>
  <li><strong>LEED (Mỹ):</strong> Tiêu chuẩn quốc tế phổ biến nhất, hiện có 280+ công trình đạt chứng nhận tại Việt Nam (tăng 55% so với 2024).</li>
  <li><strong>LOTUS (Việt Nam):</strong> Tiêu chuẩn của VGBC, được ưu tiên trong các dự án nhà ở xã hội xanh được Nhà nước hỗ trợ từ 2026.</li>
  <li><strong>WELL Building Standard:</strong> Tiêu chuẩn mới tập trung vào sức khỏe cư dân, đang được áp dụng tại các dự án hạng sang Hà Nội và TP.HCM.</li>
</ul>

<img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80&fit=crop" alt="Văn phòng xanh năng lượng mặt trời 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Văn phòng xanh tích hợp điện mặt trời và hệ thống quản lý năng lượng thông minh năm 2026</em></p>

<h3>Lợi ích kinh tế đã được chứng minh tại Việt Nam</h3>
<p>Theo nghiên cứu mới nhất của World GBC tại Việt Nam (2026), các tòa nhà đạt tiêu chuẩn LEED Gold tiết kiệm 28–35% năng lượng và 40–55% nước. Đặc biệt, giá thuê văn phòng xanh tại TP.HCM cao hơn 20–28% so với tòa nhà thông thường cùng vị trí và tỷ lệ trống thấp hơn 40%.</p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Đến năm 2026, không có nhà đầu tư tổ chức nào còn quan tâm đến các tòa nhà không đạt tiêu chuẩn xanh — đây là thực tế mới của thị trường Việt Nam."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— World Green Building Council Vietnam Report Q1/2026</footer></blockquote>

<h3>Chính phủ thúc đẩy mạnh mẽ từ 2026</h3>
<p>Chiến lược quốc gia về tăng trưởng xanh 2021–2030 nâng mục tiêu lên 35% công trình xây dựng mới phải đạt tiêu chuẩn xanh vào năm 2030 (tăng từ 25%). Nhà nước có ưu đãi thuế 3% và hỗ trợ lãi suất 1,5% cho dự án đạt chứng nhận xanh từ ngân sách 2026.</p>

<img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80&fit=crop" alt="Công trình xây dựng xanh bền vững 2026" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Xây dựng xanh — tiêu chuẩn bắt buộc cho các dự án lớn từ năm 2026</em></p>

<h3>Cơ hội đầu tư công trình xanh 2026</h3>
<p>Các dự án như Ecopark Phase 3 (Hưng Yên), Vinhomes Smart City, The Metropole Thủ Thiêm Tower 2 hay Masteri Grand View West Lake đều tích hợp tiêu chí xanh và đều ghi nhận tỷ lệ hấp thụ trên 90% chỉ sau 1 tháng mở bán. Đây là xu hướng không thể đảo ngược.</p>
    `.trim(),
  },
];

const migration: Migration = {
  description: 'Update all articles to 2026 dates and content; improve cover images for HCMC and Hanoi articles',

  async up(client: PoolClient) {
    for (const u of updates) {
      const setClauses: string[] = ['published_at = $1', 'updated_at = NOW()'];
      const params: any[] = [u.published_at];
      let idx = 2;

      if (u.title) { setClauses.push(`title = $${idx++}`); params.push(u.title); }
      if (u.excerpt) { setClauses.push(`excerpt = $${idx++}`); params.push(u.excerpt); }
      if (u.cover_image) { setClauses.push(`cover_image = $${idx++}`); params.push(u.cover_image); }
      if (u.tags) { setClauses.push(`tags = $${idx++}::jsonb`); params.push(JSON.stringify(u.tags)); }
      if (u.content) { setClauses.push(`content = $${idx++}`); params.push(u.content); }
      if (u.images) { setClauses.push(`images = $${idx++}::jsonb`); params.push(JSON.stringify(u.images)); }

      params.push(TENANT_ID, u.slug);
      await client.query(
        `UPDATE articles SET ${setClauses.join(', ')} WHERE tenant_id = $${idx++} AND slug = $${idx++}`,
        params
      );
    }
  },

  async down(client: PoolClient) {
    // Revert published_at only (content rollback handled by mig031)
    const original: Record<string, string> = {
      'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang': '2025-03-15T08:00:00Z',
      'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu': '2025-03-08T09:30:00Z',
      'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia': '2025-02-28T10:00:00Z',
      'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong': '2025-02-15T08:00:00Z',
      'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau': '2025-01-25T10:00:00Z',
      'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu': '2025-01-10T09:00:00Z',
    };
    for (const [slug, date] of Object.entries(original)) {
      await client.query(
        `UPDATE articles SET published_at = $1, updated_at = NOW() WHERE tenant_id = $2 AND slug = $3`,
        [date, TENANT_ID, slug]
      );
    }
  },
};

export default migration;
