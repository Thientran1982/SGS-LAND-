import { PoolClient } from 'pg';
import { Migration } from './runner';

// Updates seeded articles to add inline real images inside the HTML content
// and gallery images array. Safe to re-run (uses slug-based WHERE clause).

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const updates: Array<{ slug: string; content: string; images: string[] }> = [
  {
    slug: 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang',
    images: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Tổng quan thị trường TP.HCM năm 2025</h2>
<p>Sau hai năm điều chỉnh sâu, thị trường bất động sản TP.HCM đang cho thấy những dấu hiệu phục hồi rõ nét. Lãi suất cho vay mua nhà đã giảm về mức 7–8%/năm, thanh khoản cải thiện và nguồn cung mới được cấp phép trở lại tại nhiều dự án lớn.</p>

<img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80&fit=crop" alt="Thị trường bất động sản TP.HCM nhìn từ trên cao" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Toàn cảnh khu đô thị hiện đại tại TP.HCM năm 2025</em></p>

<h3>Phân khúc dẫn dắt thị trường</h3>
<ul>
  <li><strong>Căn hộ trung cấp (2–4 tỷ đồng):</strong> Giao dịch tăng 35% so với cùng kỳ, dẫn đầu tại các khu vực Bình Dương, Nhà Bè, Bình Chánh.</li>
  <li><strong>Nhà phố liền kề:</strong> Đất nền khu vực vành đai 3 được quan tâm trở lại sau khi thông tin quy hoạch được công bố chính thức.</li>
  <li><strong>Căn hộ cao cấp:</strong> Tập trung tại Thủ Thiêm và khu trung tâm Quận 1, giá từ 8.000–15.000 USD/m² vẫn được hấp thụ tốt bởi khách hàng trong nước lẫn người nước ngoài.</li>
</ul>

<img src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop" alt="Khu căn hộ cao cấp TP.HCM" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Khu căn hộ cao cấp với thiết kế hiện đại tại khu Thủ Thiêm</em></p>

<h3>Nhận định của chuyên gia</h3>
<p>Ông Nguyễn Văn Đính – Chủ tịch Hội Môi giới Bất động sản Việt Nam – nhận định: <em>"Năm 2025 là năm của sự ổn định và củng cố niềm tin. Các dự án có pháp lý sạch, chủ đầu tư uy tín và vị trí kết nối hạ tầng tốt sẽ được thị trường chào đón mạnh mẽ."</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Bất động sản TP.HCM đang bước vào chu kỳ phục hồi bền vững — không phải sốt ảo mà là tăng trưởng thực chất."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Ông Nguyễn Văn Đính, Chủ tịch HoREA</footer></blockquote>

<h3>Khuyến nghị cho nhà đầu tư</h3>
<p>Với xu thế hiện tại, các chuyên gia khuyến nghị nhà đầu tư nên ưu tiên các dự án gần tuyến metro số 1 và số 2, các khu vực đang được đầu tư hạ tầng như Thành phố Thủ Đức và khu Nam TP.HCM.</p>

<img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80&fit=crop" alt="Căn hộ chung cư hiện đại" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Căn hộ chung cư hiện đại tại các tuyến metro TP.HCM</em></p>
    `.trim(),
  },
  {
    slug: 'ha-noi-day-manh-ha-tang-vanh-dai-co-hoi-dau-tu',
    images: [
      'https://images.unsplash.com/photo-1583419529070-28d7c9cb3dae?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Vành đai 4 - Đòn bẩy phát triển đô thị Hà Nội</h2>
<p>Dự án đường Vành đai 4 – Vùng Thủ đô với tổng chiều dài 112,8 km đang được thi công với tốc độ thần tốc. Dự kiến hoàn thành vào năm 2026, tuyến đường này sẽ kết nối trực tiếp Hà Nội với Bắc Ninh, Hưng Yên và nhiều tỉnh thành lân cận.</p>

<img src="https://images.unsplash.com/photo-1583419529070-28d7c9cb3dae?w=900&q=80&fit=crop" alt="Quy hoạch đô thị Hà Nội" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Hạ tầng đô thị Hà Nội đang được đầu tư mạnh mẽ</em></p>

<h3>Các khu vực hưởng lợi trực tiếp</h3>
<ul>
  <li><strong>Hoài Đức – Đan Phượng:</strong> Giá đất tăng 20–30% kể từ khi khởi công Vành đai 4. Nhiều dự án khu đô thị mới đang triển khai hàng nghìn sản phẩm ra thị trường.</li>
  <li><strong>Mê Linh – Đông Anh:</strong> Hưởng lợi từ cả Vành đai 4 và cầu Tứ Liên, khu vực này đang thu hút nhiều nhà đầu tư dài hạn.</li>
  <li><strong>Thường Tín – Thanh Trì:</strong> Phía Nam Hà Nội cũng được hưởng lợi với hạ tầng giao thông ngày càng hoàn thiện.</li>
</ul>

<h3>Cầu vượt sông Hồng – Thay đổi cục diện thị trường</h3>
<p>Thành phố Hà Nội có kế hoạch xây dựng thêm 10 cầu qua sông Hồng trong giai đoạn 2025–2035. Đây là yếu tố then chốt giúp các khu vực Long Biên, Gia Lâm và Đông Anh kết nối trực tiếp với trung tâm, gia tăng đáng kể giá trị bất động sản.</p>

<img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&fit=crop" alt="Cầu vượt sông hiện đại" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Các cây cầu mới kết nối hai bờ sông Hồng mở ra cơ hội lớn cho bất động sản</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Vành đai 4 sẽ tạo ra một làn sóng đầu tư bất động sản mới quanh Hà Nội, tương tự những gì Vành đai 2 đã làm 15 năm trước."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Chuyên gia bất động sản Savills Việt Nam</footer></blockquote>

<h3>Lời khuyên từ chuyên gia SGS LAND</h3>
<p>Để tối ưu hóa lợi nhuận đầu tư, nhà đầu tư nên xem xét các dự án nằm trong bán kính 2–3 km so với các nút giao Vành đai 4, đặc biệt là những dự án đã được phê duyệt quy hoạch chi tiết 1/500.</p>

<img src="https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop" alt="Khu đô thị mới ven đô" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Khu đô thị mới với đầy đủ tiện ích ven đô Hà Nội</em></p>
    `.trim(),
  },
  {
    slug: 'can-ho-hang-sang-viet-nam-phan-khuc-khong-giam-gia',
    images: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Làn sóng căn hộ hạng sang lan tỏa cả nước</h2>
<p>Theo báo cáo quý I/2025 của CBRE Việt Nam, giá căn hộ hạng sang tại TP.HCM đạt trung bình 12.500 USD/m², tăng 18% so với năm 2024. Tại Hà Nội, mức giá trung bình cũng đạt 9.800 USD/m², tăng 15%.</p>

<img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&q=80&fit=crop" alt="Căn hộ hạng sang nội thất cao cấp" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Nội thất cao cấp đặc trưng của phân khúc luxury tại Việt Nam</em></p>

<h3>Vì sao phân khúc này vẫn tăng giá?</h3>
<ul>
  <li><strong>Nguồn cung khan hiếm:</strong> Quỹ đất lõi đô thị ngày càng cạn kiệt, số lượng dự án hạng sang mới cực kỳ hạn chế.</li>
  <li><strong>Nhu cầu thực tế cao:</strong> Tầng lớp trung lưu và thượng lưu Việt Nam tăng nhanh, với hơn 700.000 người có thu nhập trên 100.000 USD/năm (McKinsey, 2024).</li>
  <li><strong>Hút khách nước ngoài:</strong> Người nước ngoài làm việc tại Việt Nam và Việt kiều là nhóm khách hàng quan trọng, đặc biệt tại TP.HCM.</li>
</ul>

<img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&fit=crop" alt="Biệt thự và căn hộ cao cấp" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Biệt thự phong cách hiện đại – phân khúc được giới nhà giàu Việt ưa chuộng</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Căn hộ hạng sang tại Việt Nam đang thu hút sự chú ý của nhà đầu tư quốc tế vì mức giá vẫn còn thấp hơn đáng kể so với Singapore hay Bangkok."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Báo cáo CBRE Việt Nam Q1/2025</footer></blockquote>

<h3>Những dự án hạng sang tiêu biểu năm 2025</h3>
<p>Một số dự án đang tạo sóng trên thị trường: The River Thủ Thiêm (TP.HCM), Masteri West Heights (Hà Nội), Empire City (TP.HCM) và Starlake Tây Hồ Tây (Hà Nội). Mỗi dự án đều có giá bán từ 150 triệu đến trên 500 triệu đồng/m².</p>

<img src="https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80&fit=crop" alt="View hồ bơi căn hộ luxury" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Tiện ích đẳng cấp 5 sao trong các dự án luxury Việt Nam</em></p>

<h3>Triển vọng năm 2025–2026</h3>
<p>Các chuyên gia dự báo phân khúc này sẽ tiếp tục tăng trưởng 10–15% mỗi năm trong giai đoạn 2025–2026, đặc biệt khi Luật Kinh doanh Bất động sản 2023 cho phép người nước ngoài mua căn hộ dễ dàng hơn.</p>
    `.trim(),
  },
  {
    slug: 'da-nang-2025-diem-sang-dau-tu-bat-dong-san-nghi-duong',
    images: [
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Đà Nẵng – Thành phố đáng sống và đáng đầu tư</h2>
<p>Đà Nẵng liên tục được vinh danh trong các bảng xếp hạng điểm đến du lịch hàng đầu châu Á. Năm 2024, thành phố đón hơn 9 triệu lượt khách, trong đó 3,5 triệu khách quốc tế – một kỷ lục mới. Điều này tạo nền tảng vững chắc cho thị trường bất động sản nghỉ dưỡng phát triển bền vững.</p>

<img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=900&q=80&fit=crop" alt="Bãi biển Đà Nẵng" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Bãi biển Mỹ Khê – điểm đến hàng đầu của du khách đến Đà Nẵng</em></p>

<h3>Các phân khúc nổi bật</h3>
<ul>
  <li><strong>Condotel ven biển:</strong> Tỷ suất lợi nhuận cam kết 8–10%/năm từ các chủ đầu tư lớn, thu hút nhà đầu tư tìm kiếm dòng tiền thụ động.</li>
  <li><strong>Biệt thự nghỉ dưỡng:</strong> Khu vực Bà Nà Hills, Hội An (Quảng Nam) và Non Nước đang là tâm điểm với mức giá 5–30 tỷ đồng/căn.</li>
  <li><strong>Shophouse thương mại:</strong> Dọc theo các trục đường ven biển Võ Nguyên Giáp và Trường Sa, shophouse đang được nhiều nhà đầu tư lựa chọn để kinh doanh dịch vụ du lịch.</li>
</ul>

<img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80&fit=crop" alt="Resort và khách sạn 5 sao Đà Nẵng" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Resort 5 sao ven biển – xu hướng đầu tư sinh lời cao tại Đà Nẵng</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Đà Nẵng là điểm đến hiếm hoi kết hợp được cả ba yếu tố: bãi biển đẹp, hạ tầng hiện đại và giá bất động sản còn hợp lý."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Báo cáo JLL Vietnam Resort Market 2025</footer></blockquote>

<h3>Hạ tầng đột phá 2025</h3>
<p>Sân bay quốc tế Đà Nẵng đang được mở rộng lên công suất 30 triệu hành khách/năm (dự kiến hoàn thành 2026). Cùng với đó, tuyến cao tốc Đà Nẵng – Quảng Ngãi mở rộng và cao tốc Hòa Liên – Túy Loan sẽ kết nối thông suốt toàn vùng.</p>

<img src="https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=900&q=80&fit=crop" alt="Biệt thự nghỉ dưỡng ven biển" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Biệt thự nghỉ dưỡng sang trọng nhìn ra biển – phân khúc tăng trưởng mạnh nhất tại Đà Nẵng</em></p>

<h3>Lưu ý pháp lý quan trọng</h3>
<p>Nhà đầu tư nên cẩn trọng kiểm tra sổ đỏ/giấy phép xây dựng, đặc biệt với các dự án condotel vốn có nhiều vướng mắc pháp lý trong quá khứ. SGS LAND sẵn sàng hỗ trợ tư vấn pháp lý miễn phí cho quý khách hàng.</p>
    `.trim(),
  },
  {
    slug: 'luat-nha-o-2023-chinh-sach-ho-tro-2025-co-hoi-mua-nha-lan-dau',
    images: [
      'https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Hành lang pháp lý mới – Cú hích cho người mua nhà</h2>
<p>Luật Nhà ở 2023 (có hiệu lực từ 1/8/2024) và các Nghị định hướng dẫn đã tạo ra hành lang pháp lý rõ ràng hơn, đặc biệt ưu tiên phát triển nhà ở xã hội và hỗ trợ người thu nhập thấp, trung bình mua nhà lần đầu.</p>

<img src="https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=900&q=80&fit=crop" alt="Khu nhà ở xã hội hiện đại" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Khu nhà ở xã hội hiện đại với đầy đủ tiện ích cho người thu nhập trung bình</em></p>

<h3>Các chính sách hỗ trợ nổi bật</h3>
<ul>
  <li><strong>Gói tín dụng 120.000 tỷ đồng:</strong> Lãi suất ưu đãi 7%/năm cho người mua nhà ở xã hội và nhà ở công nhân, thời hạn vay tối đa 25 năm.</li>
  <li><strong>Miễn thuế thu nhập cá nhân:</strong> Người mua nhà lần đầu được miễn thuế TNCN đối với lãi tiết kiệm dùng để mua nhà ở xã hội.</li>
  <li><strong>Tăng quỹ đất nhà ở xã hội:</strong> Yêu cầu các dự án thương mại dành 20% diện tích đất cho nhà ở xã hội, tăng nguồn cung đáng kể.</li>
  <li><strong>Mở rộng đối tượng vay:</strong> Người độc thân dưới 35 tuổi, cặp vợ chồng mới kết hôn đều được vay ưu đãi không cần tài sản đảm bảo với khoản vay dưới 500 triệu đồng.</li>
</ul>

<img src="https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900&q=80&fit=crop" alt="Gia đình trẻ mua nhà lần đầu" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Những gia đình trẻ đang tận dụng các chính sách hỗ trợ mua nhà lần đầu năm 2025</em></p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Đây là cơ hội vàng cho những người trẻ có thu nhập ổn định muốn hiện thực hóa giấc mơ an cư trong năm 2025."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— Bộ trưởng Bộ Xây dựng Nguyễn Thanh Nghị</footer></blockquote>

<h3>Điều kiện để được hưởng ưu đãi</h3>
<p>Người mua cần đáp ứng: (1) Chưa có nhà ở hoặc nhà ở có diện tích dưới 10m²/người; (2) Thu nhập không quá 11 triệu đồng/tháng (cá nhân) hoặc 22 triệu đồng/tháng (hộ gia đình); (3) Đăng ký hộ khẩu tại địa phương hoặc có giấy xác nhận đang làm việc.</p>

<img src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80&fit=crop" alt="Hợp đồng mua nhà và tư vấn pháp lý" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Tư vấn hồ sơ vay ưu đãi – bước quan trọng để hiện thực hóa giấc mơ sở hữu nhà</em></p>

<h3>Hành động ngay hôm nay</h3>
<p>Với nhu cầu cao và nguồn cung vẫn còn hạn chế, các chuyên gia khuyến cáo người có nhu cầu nên đăng ký sớm và chuẩn bị hồ sơ đầy đủ. Đội ngũ tư vấn SGS LAND sẵn sàng hỗ trợ bạn hoàn thiện thủ tục và tìm kiếm dự án phù hợp.</p>
    `.trim(),
  },
  {
    slug: 'bat-dong-san-xanh-net-zero-xu-huong-tat-yeu',
    images: [
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80&fit=crop',
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80&fit=crop',
    ],
    content: `
<h2>Bất động sản xanh – Không còn là lựa chọn xa xỉ</h2>
<p>Chỉ vài năm trước, "nhà xanh" hay "tòa nhà xanh" còn là khái niệm xa lạ với đa số người Việt. Nhưng đến năm 2025, hơn 40% người mua nhà trong khảo sát của JLL Việt Nam cho biết tiêu chí bền vững là yếu tố quan trọng trong quyết định mua. Đây là sự chuyển dịch ngoạn mục chỉ trong 3 năm.</p>

<img src="https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&q=80&fit=crop" alt="Kiến trúc xanh bền vững" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:450px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Kiến trúc xanh tích hợp thiên nhiên vào từng chi tiết thiết kế</em></p>

<h3>Các tiêu chuẩn xanh phổ biến tại Việt Nam</h3>
<ul>
  <li><strong>LEED (Mỹ):</strong> Tiêu chuẩn quốc tế phổ biến nhất, hiện có 180+ công trình đạt chứng nhận tại Việt Nam.</li>
  <li><strong>LOTUS (Việt Nam):</strong> Tiêu chuẩn của Hội đồng Công trình Xanh Việt Nam (VGBC), phù hợp với điều kiện khí hậu và quy định địa phương.</li>
  <li><strong>Green Mark (Singapore):</strong> Phổ biến trong các dự án văn phòng và khu công nghiệp có vốn đầu tư từ Singapore.</li>
</ul>

<img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&q=80&fit=crop" alt="Văn phòng xanh năng lượng mặt trời" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Văn phòng xanh tích hợp tấm pin năng lượng mặt trời – mô hình ngày càng phổ biến tại Việt Nam</em></p>

<h3>Lợi ích kinh tế đã được chứng minh</h3>
<p>Theo nghiên cứu của World Green Building Council, các tòa nhà xanh tiết kiệm 20–30% năng lượng và 30–50% nước so với công trình thông thường. Đặc biệt, giá thuê văn phòng xanh tại TP.HCM cao hơn 15–20% so với tòa nhà thông thường cùng vị trí.</p>

<blockquote style="border-left:4px solid #4f46e5;padding:16px 24px;background:#f5f3ff;border-radius:0 12px 12px 0;margin:24px 0;"><p style="margin:0;font-style:italic;color:#4f46e5;font-size:18px;font-weight:600;">"Công trình xanh không phải là chi phí thêm – đó là khoản đầu tư tốt nhất trong thập kỷ tới khi giá năng lượng và nước ngày càng tăng."</p><footer style="margin-top:8px;font-size:13px;color:#6b7280;">— World Green Building Council Report 2025</footer></blockquote>

<h3>Chính phủ vào cuộc mạnh mẽ</h3>
<p>Chiến lược quốc gia về tăng trưởng xanh giai đoạn 2021–2030 yêu cầu 25% công trình xây dựng mới phải đạt tiêu chuẩn xanh vào năm 2030. Nhà nước cũng có các ưu đãi thuế và hỗ trợ lãi suất cho dự án đạt chứng nhận xanh.</p>

<img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80&fit=crop" alt="Công trình xây dựng xanh" style="width:100%;border-radius:16px;margin:24px 0;object-fit:cover;max-height:400px;" />
<p style="text-align:center;font-size:13px;color:#6b7280;margin-top:-16px;margin-bottom:24px;"><em>Xây dựng xanh – tiêu chuẩn bắt buộc của các dự án lớn trong tương lai gần</em></p>

<h3>Cơ hội đầu tư</h3>
<p>Các dự án như Ecopark (Hưng Yên), Vinhomes Ocean Park, The Metropole Thủ Thiêm hay Masterise Grand View là những ví dụ điển hình về việc tích hợp tiêu chí xanh vào thiết kế và vận hành, và tất cả đều ghi nhận tỷ lệ hấp thụ rất cao.</p>
    `.trim(),
  },
];

const migration: Migration = {
  description: 'Enrich seeded articles with real inline images and richer HTML content',

  async up(client: PoolClient) {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='images') THEN
          ALTER TABLE articles ADD COLUMN images JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='articles' AND column_name='featured') THEN
          ALTER TABLE articles ADD COLUMN featured BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);

    for (const update of updates) {
      await client.query(
        `UPDATE articles
         SET content = $1, images = $2::jsonb, updated_at = NOW()
         WHERE tenant_id = $3 AND slug = $4`,
        [update.content, JSON.stringify(update.images), TENANT_ID, update.slug]
      );
    }

    await client.query(
      `UPDATE articles SET featured = true
       WHERE tenant_id = $1 AND slug = $2`,
      [TENANT_ID, 'thi-truong-bat-dong-san-tphcm-2025-co-hoi-vang']
    );
  },

  async down(client: PoolClient) {
    for (const update of updates) {
      await client.query(
        `UPDATE articles SET images = '[]'::jsonb, featured = false, updated_at = NOW()
         WHERE tenant_id = $1 AND slug = $2`,
        [TENANT_ID, update.slug]
      );
    }
  },
};

export default migration;
