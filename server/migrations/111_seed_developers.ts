import type { PoolClient } from 'pg';

/**
 * Migration 111 — Seed dữ liệu mẫu Chủ đầu tư (developers) cho tất cả tenant.
 *
 * GĐ 2&3 (GEO/AEO): Nội dung "answer-first", citable cho AI engines.
 * - Lặp qua mọi tenant, chỉ seed nếu slug chưa tồn tại (ON CONFLICT DO NOTHING trên (tenant_id, slug)).
 * - Tuân thủ RLS: insert bằng owner connection (migration runner), không phụ thuộc current_setting.
 * - down(): chỉ xóa chính các slug đã seed ở đây, không đụng dữ liệu user tự tạo.
 */

interface SeedDeveloper {
  slug: string;
  name: string;
  legal_name: string | null;
  brand: string | null;
  stock_code: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  charter_capital: string | null;
  projects_delivered: number | null;
  land_bank_ha: string | null;
  awards: string[];
  summary: string;
  description: string;
  faq: { q: string; a: string }[];
}

const SEED_DEVELOPERS: SeedDeveloper[] = [
  {
    slug: 'novaland',
    name: 'Novaland',
    legal_name: 'Công ty Cổ phần Tập đoàn Đầu tư Địa ốc No Va',
    brand: 'Novaland Group',
    stock_code: 'NVL',
    founded_year: 1992,
    headquarters: '65 Nguyễn Du, Phường Bến Nghé, Quận 1, TP.HCM',
    website: 'https://www.novaland.com.vn',
    charter_capital: '19500000000000',
    projects_delivered: 50,
    land_bank_ha: '10600.00',
    awards: ['Top 10 Chủ đầu tư BĐS uy tín', 'Thương hiệu Quốc gia'],
    summary:
      'Novaland (mã NVL) là một trong những chủ đầu tư bất động sản lớn nhất Việt Nam, thành lập năm 1992, trụ sở tại TP.HCM, chuyên phát triển khu đô thị, bất động sản nhà ở và nghỉ dưỡng tại TP.HCM, Đồng Nai và các tỉnh phía Nam.',
    description:
      'Novaland tập trung vào các dòng sản phẩm khu đô thị tích hợp, căn hộ cao cấp và bất động sản nghỉ dưỡng. Các dự án trọng điểm gồm Aqua City (Đồng Nai), NovaWorld Phan Thiết và NovaWorld Hồ Tràm, hướng đến mô hình đô thị sinh thái — du lịch — nghỉ dưỡng quy mô lớn.',
    faq: [
      { q: 'Novaland là chủ đầu tư của những dự án nào?', a: 'Novaland là chủ đầu tư của Aqua City (Đồng Nai), NovaWorld Phan Thiết, NovaWorld Hồ Tràm và nhiều khu đô thị, căn hộ cao cấp tại TP.HCM.' },
      { q: 'Mã cổ phiếu của Novaland là gì?', a: 'Novaland niêm yết trên HOSE với mã chứng khoán NVL.' },
      { q: 'Novaland thành lập năm nào?', a: 'Novaland được thành lập năm 1992, trụ sở chính tại Quận 1, TP.HCM.' },
      { q: 'Aqua City do ai làm chủ đầu tư?', a: 'Aqua City là khu đô thị sinh thái do Novaland làm chủ đầu tư, tọa lạc tại Biên Hòa, Đồng Nai.' },
      { q: 'Novaland có uy tín không?', a: 'Novaland là một trong những chủ đầu tư BĐS lớn nhất Việt Nam, nhiều năm thuộc Top 10 chủ đầu tư uy tín và đạt Thương hiệu Quốc gia.' },
    ],
  },
  {
    slug: 'vinhomes',
    name: 'Vinhomes',
    legal_name: 'Công ty Cổ phần Vinhomes',
    brand: 'Vinhomes',
    stock_code: 'VHM',
    founded_year: 2008,
    headquarters: 'Số 7 đường Bưởi, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội',
    website: 'https://vinhomes.vn',
    charter_capital: '43543705190000',
    projects_delivered: 30,
    land_bank_ha: '16800.00',
    awards: ['Top 1 Chủ đầu tư BĐS Việt Nam', 'Thương hiệu Quốc gia'],
    summary:
      'Vinhomes (mã VHM) là thương hiệu bất động sản nhà ở thuộc Tập đoàn Vingroup, chủ đầu tư các đại đô thị (mega city) như Vinhomes Grand Park tại TP.HCM, phát triển căn hộ, nhà phố và biệt thự tích hợp tiện ích đồng bộ.',
    description:
      'Vinhomes phát triển mô hình đại đô thị toàn diện với hệ tiện ích nội khu khép kín. Tại TP.HCM, dự án tiêu biểu là Vinhomes Grand Park (TP. Thủ Đức), bên cạnh các đại đô thị Vinhomes Ocean Park và Vinhomes Smart City ở phía Bắc.',
    faq: [
      { q: 'Vinhomes là chủ đầu tư của dự án nào tại TP.HCM?', a: 'Tại TP.HCM, Vinhomes là chủ đầu tư đại đô thị Vinhomes Grand Park ở TP. Thủ Đức.' },
      { q: 'Mã cổ phiếu của Vinhomes là gì?', a: 'Vinhomes niêm yết trên HOSE với mã chứng khoán VHM.' },
      { q: 'Vinhomes thuộc tập đoàn nào?', a: 'Vinhomes là thương hiệu bất động sản nhà ở thuộc Tập đoàn Vingroup.' },
      { q: 'Vinhomes thành lập năm nào?', a: 'Công ty Cổ phần Vinhomes được thành lập năm 2008.' },
      { q: 'Vinhomes Grand Park nằm ở đâu?', a: 'Vinhomes Grand Park là đại đô thị do Vinhomes làm chủ đầu tư, tọa lạc tại TP. Thủ Đức, TP.HCM.' },
    ],
  },
  {
    slug: 'khang-dien',
    name: 'Khang Điền',
    legal_name: 'Công ty Cổ phần Đầu tư và Kinh doanh Nhà Khang Điền',
    brand: 'Khang Điền House',
    stock_code: 'KDH',
    founded_year: 2001,
    headquarters: '978 Đường 3/2, Phường 15, Quận 11, TP.HCM',
    website: 'https://khangdien.com.vn',
    charter_capital: '3490000000000',
    projects_delivered: 25,
    land_bank_ha: '700.00',
    awards: ['Top 10 Chủ đầu tư BĐS uy tín TP.HCM', 'Dự án nhà ở được khách hàng tin tưởng nhất'],
    summary:
      'Khang Điền (mã KDH) là chủ đầu tư bất động sản nhà ở uy tín tại TP.HCM, thành lập năm 2001, chuyên phát triển nhà phố, biệt thự và căn hộ tại khu Đông và khu Nam TP.HCM với tiêu chí pháp lý minh bạch và chất lượng xây dựng cao.',
    description:
      'Khang Điền tập trung vào phân khúc nhà phố thương mại và biệt thự tại TP.HCM. Các dự án tiêu biểu gồm Verosa Park (TP. Thủ Đức), Lovera Vista (Bình Chánh), IvyCity (TP. Thủ Đức). Công ty nổi tiếng với cam kết pháp lý sổ đỏ rõ ràng và tiến độ xây dựng đúng hẹn.',
    faq: [
      { q: 'Khang Điền có những dự án nào tại TP.HCM?', a: 'Khang Điền là chủ đầu tư Verosa Park (TP. Thủ Đức), Lovera Vista (Bình Chánh), IvyCity (TP. Thủ Đức) và nhiều dự án nhà phố, biệt thự khác.' },
      { q: 'Mã cổ phiếu Khang Điền là gì?', a: 'Khang Điền niêm yết trên HOSE với mã KDH.' },
      { q: 'Khang Điền có uy tín không?', a: 'Khang Điền được đánh giá cao về pháp lý minh bạch và chất lượng xây dựng, nhiều năm liền thuộc Top 10 chủ đầu tư uy tín tại TP.HCM.' },
      { q: 'Khang Điền tập trung vào phân khúc nào?', a: 'Khang Điền chuyên phát triển nhà phố thương mại, biệt thự và căn hộ trung cao cấp tại khu Đông và khu Nam TP.HCM.' },
    ],
  },
  {
    slug: 'hung-thinh',
    name: 'Hưng Thịnh',
    legal_name: 'Tập đoàn Hưng Thịnh',
    brand: 'Hưng Thịnh Corp',
    stock_code: null,
    founded_year: 2000,
    headquarters: '99 Trần Ngọc Diện, Phường Thảo Điền, TP. Thủ Đức, TP.HCM',
    website: 'https://hungthinh.com',
    charter_capital: '10000000000000',
    projects_delivered: 60,
    land_bank_ha: '5000.00',
    awards: ['Top 5 Chủ đầu tư BĐS lớn nhất Việt Nam', 'Thương hiệu BĐS uy tín'],
    summary:
      'Hưng Thịnh Corp là tập đoàn bất động sản tư nhân lớn tại Việt Nam, thành lập năm 2000, hoạt động đa lĩnh vực gồm đầu tư — xây dựng — phân phối BĐS, với danh mục hơn 60 dự án trải dài từ TP.HCM đến Bình Định, Khánh Hòa, Bình Thuận.',
    description:
      'Hưng Thịnh phát triển đa dạng phân khúc từ căn hộ bình dân đến cao cấp, nhà phố, biệt thự và bất động sản nghỉ dưỡng. Các dự án tiêu biểu: Q7 Saigon Riverside Complex, Moonlight Boulevard (Bình Tân), Grand Mercure Hội An Resort.',
    faq: [
      { q: 'Hưng Thịnh là chủ đầu tư của những dự án nào?', a: 'Hưng Thịnh là chủ đầu tư Q7 Saigon Riverside, Moonlight Boulevard, Lavita Garden, và nhiều dự án căn hộ, nghỉ dưỡng khác trên cả nước.' },
      { q: 'Hưng Thịnh Corp thành lập năm nào?', a: 'Tập đoàn Hưng Thịnh thành lập năm 2000, trụ sở tại TP. Thủ Đức, TP.HCM.' },
      { q: 'Hưng Thịnh có phải công ty niêm yết không?', a: 'Hưng Thịnh Corp hiện chưa niêm yết trên sàn chứng khoán, là tập đoàn tư nhân lớn.' },
      { q: 'Hưng Thịnh phát triển loại BĐS nào?', a: 'Hưng Thịnh phát triển đa dạng: căn hộ, nhà phố, biệt thự và bất động sản nghỉ dưỡng tại TP.HCM và các tỉnh ven biển.' },
    ],
  },
  {
    slug: 'an-gia',
    name: 'An Gia',
    legal_name: 'Công ty Cổ phần Đầu tư và Phát triển Bất động sản An Gia',
    brand: 'An Gia Real Estate',
    stock_code: 'AGG',
    founded_year: 2005,
    headquarters: '8 Hoàng Diệu 2, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM',
    website: 'https://angia.com.vn',
    charter_capital: '1750000000000',
    projects_delivered: 15,
    land_bank_ha: '200.00',
    awards: ['Doanh nghiệp BĐS uy tín', 'Top chủ đầu tư căn hộ vừa túi tiền TP.HCM'],
    summary:
      'An Gia (mã AGG) là chủ đầu tư bất động sản tại TP.HCM, tập trung phân khúc căn hộ vừa và cao cấp tại khu Đông và khu Tây thành phố, nổi bật với các dự án như The Standard (Bình Dương), Westgate (Bình Chánh) và Sky89 (Quận 7).',
    description:
      'An Gia chú trọng vào phân khúc căn hộ trung cấp phù hợp người trẻ và gia đình trẻ. Điểm mạnh là vị trí dự án kết nối hạ tầng tốt, thiết kế tối ưu công năng và giá trị bàn giao thực chất. Đối tác chiến lược gồm các quỹ đầu tư Nhật Bản (Creed Group).',
    faq: [
      { q: 'An Gia có những dự án nào?', a: 'An Gia là chủ đầu tư The Standard (Bình Dương), Westgate (Bình Chánh), Sky89 (Quận 7), Akari City (Bình Tân).' },
      { q: 'Mã cổ phiếu An Gia là gì?', a: 'An Gia niêm yết trên HoSE với mã AGG.' },
      { q: 'An Gia hướng đến đối tượng khách hàng nào?', a: 'An Gia tập trung căn hộ trung cấp phù hợp người trẻ, gia đình trẻ tại TP.HCM và vùng ven.' },
    ],
  },
  {
    slug: 'phat-dat',
    name: 'Phát Đạt',
    legal_name: 'Công ty Cổ phần Phát triển Bất động sản Phát Đạt',
    brand: 'Phát Đạt Real Estate',
    stock_code: 'PDR',
    founded_year: 2004,
    headquarters: '1A Lê Duẩn, Phường Bến Nghé, Quận 1, TP.HCM',
    website: 'https://phatdat.com.vn',
    charter_capital: '4240000000000',
    projects_delivered: 20,
    land_bank_ha: '1200.00',
    awards: ['Top 10 Chủ đầu tư BĐS uy tín Việt Nam'],
    summary:
      'Phát Đạt (mã PDR) là chủ đầu tư bất động sản có trụ sở tại TP.HCM, thành lập năm 2004, phát triển các dự án căn hộ cao cấp, khu đô thị và bất động sản nghỉ dưỡng tại TP.HCM, Bình Định và các tỉnh ven biển miền Trung.',
    description:
      'Phát Đạt tập trung phát triển căn hộ cao cấp nội đô và các khu đô thị mới tại địa phương có tốc độ tăng trưởng cao. Các dự án tiêu biểu: The EverRich Infinity (Quận 5), Astral City (Bình Dương), Khu đô thị Nhơn Hội (Bình Định).',
    faq: [
      { q: 'Phát Đạt có những dự án nào nổi bật?', a: 'Phát Đạt là chủ đầu tư The EverRich Infinity (Quận 5), Astral City (Bình Dương), khu đô thị Nhơn Hội New City (Bình Định).' },
      { q: 'Mã cổ phiếu Phát Đạt là gì?', a: 'Phát Đạt niêm yết trên HoSE với mã PDR.' },
      { q: 'Phát Đạt thành lập năm nào?', a: 'Công ty Cổ phần Phát triển BĐS Phát Đạt thành lập năm 2004 tại TP.HCM.' },
    ],
  },
  {
    slug: 'sun-group',
    name: 'Sun Group',
    legal_name: 'Tập đoàn Mặt Trời',
    brand: 'Sun Group',
    stock_code: null,
    founded_year: 2007,
    headquarters: '76 Nguyễn Trọng Tuyển, Phường 15, Quận Phú Nhuận, TP.HCM',
    website: 'https://sungroup.com.vn',
    charter_capital: '15000000000000',
    projects_delivered: 40,
    land_bank_ha: '8000.00',
    awards: ['Top 5 Tập đoàn BĐS nghỉ dưỡng lớn nhất Việt Nam', 'Thương hiệu BĐS nghỉ dưỡng số 1'],
    summary:
      'Sun Group là tập đoàn đầu tư hạ tầng và bất động sản nghỉ dưỡng hàng đầu Việt Nam, nổi tiếng với các tổ hợp vui chơi — giải trí — nghỉ dưỡng đẳng cấp tại Đà Nẵng, Phú Quốc, Sa Pa, Hạ Long và TP.HCM.',
    description:
      'Sun Group phát triển hệ sinh thái du lịch — nghỉ dưỡng — giải trí tích hợp quy mô lớn. Các dự án tiêu biểu: Sun World Ba Na Hills (Đà Nẵng), Sun World Phú Quốc, InterContinental Danang Sun Peninsula Resort, Premier Village Phu Quoc Resort.',
    faq: [
      { q: 'Sun Group có những dự án nào nổi tiếng?', a: 'Sun Group nổi tiếng với Sun World Ba Na Hills (Đà Nẵng), Sun World Phú Quốc, Premier Village Phu Quoc và các khu nghỉ dưỡng cao cấp trên cả nước.' },
      { q: 'Sun Group có niêm yết trên sàn chứng khoán không?', a: 'Sun Group hiện chưa niêm yết, là tập đoàn tư nhân chuyên BĐS nghỉ dưỡng và hạ tầng du lịch.' },
      { q: 'Sun Group chuyên phát triển loại BĐS nào?', a: 'Sun Group chuyên bất động sản nghỉ dưỡng cao cấp, khu vui chơi giải trí và hạ tầng du lịch tại các địa điểm trọng điểm Việt Nam.' },
    ],
  },
  {
    slug: 'masterise-homes',
    name: 'Masterise Homes',
    legal_name: 'Công ty TNHH Masterise Homes',
    brand: 'Masterise Homes',
    stock_code: null,
    founded_year: 2018,
    headquarters: '19 Tố Hữu, Nam Từ Liêm, Hà Nội',
    website: 'https://masterisehomes.com',
    charter_capital: null,
    projects_delivered: 10,
    land_bank_ha: '500.00',
    awards: ['Thương hiệu BĐS cao cấp mới nổi bật nhất', 'Dự án căn hộ hạng sang tốt nhất Đông Nam Á'],
    summary:
      'Masterise Homes là thương hiệu bất động sản cao cấp thuộc Masterise Group (Tập đoàn Thành Công), chuyên phát triển căn hộ hạng sang và biệt thự cao cấp tại TP.HCM và Hà Nội theo chuẩn quốc tế, hợp tác với thương hiệu Marriott.',
    description:
      'Masterise Homes hướng đến phân khúc luxury và ultra-luxury với chuẩn thiết kế quốc tế. Dự án tiêu biểu tại TP.HCM: Masteri Waterfront (TP. Thủ Đức), Masteri Centre Point, Grand Marina Saigon (hợp tác Marriott). Tại Hà Nội: Masteri West Heights, Masteri Waterfront Hà Nội.',
    faq: [
      { q: 'Masterise Homes có những dự án nào tại TP.HCM?', a: 'Masterise Homes phát triển Grand Marina Saigon (Quận 1), Masteri Centre Point (TP. Thủ Đức), Masteri Waterfront tại TP.HCM.' },
      { q: 'Masterise Homes thuộc tập đoàn nào?', a: 'Masterise Homes là thương hiệu BĐS thuộc Masterise Group, công ty con của Tập đoàn Thành Công (TC Group).' },
      { q: 'Masterise Homes hướng đến phân khúc nào?', a: 'Masterise Homes chuyên phân khúc luxury và ultra-luxury, căn hộ hạng sang và biệt thự cao cấp theo chuẩn quốc tế.' },
    ],
  },
  {
    slug: 'nam-long',
    name: 'Nam Long',
    legal_name: 'Cong ty Co phan Dau tu Nam Long',
    brand: 'Nam Long Group',
    stock_code: 'NLG',
    founded_year: 1992,
    headquarters: '6 Nguyen Khac Vien, Phuong Tan Phu, Quan 7, TP.HCM',
    website: 'https://namlonggroup.com',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Top thuong hieu BDS uy tin', 'Nha phat trien khu do thi tich hop'],
    summary:
      'Nam Long (ma NLG) la chu dau tu bat dong san niem yet tren HOSE, chuyen phat trien khu do thi tich hop va nha o vua tui tien tai TP.HCM, Long An, Dong Nai va Can Tho voi cac thuong hieu Ehome, Flora, Valora, Akari City, Mizuki Park va Waterpoint.',
    description:
      'Nam Long Group thanh lap nam 1992, la mot trong nhung chu dau tu lau doi tai phia Nam, hop tac cung cac doi tac Nhat Ban nhu Hankyu Hanshin va Nishi Nippon Railroad. Cac dong san pham gom nha o vua tui tien Ehome, can ho Flora, nha pho/biet thu Valora va cac khu do thi tich hop Akari City (Binh Tan), Mizuki Park (Nha Be) va Waterpoint (Long An).',
    faq: [
      { q: 'Nam Long la chu dau tu cua nhung du an nao?', a: 'Nam Long phat trien Akari City, Mizuki Park, Waterpoint, cung cac dong san pham Ehome, Flora va Valora tai TP.HCM va cac tinh phia Nam.' },
      { q: 'Ma co phieu cua Nam Long la gi?', a: 'Nam Long niem yet tren HOSE voi ma chung khoan NLG.' },
      { q: 'Nam Long thanh lap nam nao?', a: 'Nam Long duoc thanh lap nam 1992, tru so chinh tai Quan 7, TP.HCM.' },
      { q: 'Nam Long co uy tin khong?', a: 'Nam Long la chu dau tu lau nam, hop tac cung nhieu doi tac Nhat Ban va tap trung phan khuc nha o vua tui tien.' },
    ],
  },
  {
    slug: 'van-phuc-city',
    name: 'Van Phuc Group',
    legal_name: 'Cong ty Co phan Dau tu Van Phuc',
    brand: 'Van Phuc City',
    stock_code: null,
    founded_year: null,
    headquarters: 'Khu do thi Van Phuc, Phuong Hiep Binh Phuoc, TP.Thu Duc, TP.HCM',
    website: 'https://vanphuccity.com',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: '198.00',
    awards: ['Khu do thi ven song lon nhat Thu Duc'],
    summary:
      'Van Phuc Group la chu dau tu Khu do thi Van Phuc City rong khoang 198ha ven song Sai Gon tai TP.Thu Duc, TP.HCM, phat trien nha pho, biet thu, shophouse va can ho hang sang Diamond Sky Van Phuc City.',
    description:
      'Van Phuc City la khu do thi ven song quy mo lon tai cua ngo phia Dong TP.HCM, huong toi mo hinh song - mua sam - giai tri hoan chinh voi cong vien, ho canh quan, pho di bo va cac tien ich noi khu. Cac dong san pham gom nha pho thuong mai, biet thu ven song va thap can ho cao cap Diamond Sky.',
    faq: [
      { q: 'Van Phuc City rong bao nhieu?', a: 'Khu do thi Van Phuc City co quy mo khoang 198ha ven song Sai Gon tai TP.Thu Duc, TP.HCM.' },
      { q: 'Van Phuc City do ai lam chu dau tu?', a: 'Khu do thi Van Phuc City do Van Phuc Group phat trien.' },
      { q: 'Van Phuc City co nhung san pham nao?', a: 'Van Phuc City co nha pho, biet thu, shophouse va can ho hang sang Diamond Sky Van Phuc City.' },
      { q: 'Van Phuc City nam o dau?', a: 'Van Phuc City nam tai Phuong Hiep Binh Phuoc, TP.Thu Duc, ven song Sai Gon.' },
    ],
  },
  {
    slug: 'keppel-land',
    name: 'Keppel Land',
    legal_name: 'Keppel Land Limited',
    brand: 'Keppel',
    stock_code: null,
    founded_year: null,
    headquarters: 'Singapore',
    website: 'https://www.keppel.com',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Nha phat trien BDS quoc te'],
    summary:
      'Keppel Land la chi nhanh bat dong san cua tap doan Keppel (Singapore), dau tu nhieu du an van phong, khu do thi va nha o tai Viet Nam nhu Estella, Palm City, Celesta va cac toa van phong hang A tai TP.HCM.',
    description:
      'Keppel Land la mot trong nhung nha phat trien bat dong san nuoc ngoai hoat dong lau nam tai Viet Nam, tap trung vao phan khuc cao cap va van phong hang A. Cac du an tieu bieu tai TP.HCM gom The Estella, Estella Heights, Palm City va Celesta, thuong hop tac cung cac doi tac trong nuoc.',
    faq: [
      { q: 'Keppel Land la chu dau tu nuoc nao?', a: 'Keppel Land thuoc tap doan Keppel co tru so tai Singapore.' },
      { q: 'Keppel Land co du an nao tai Viet Nam?', a: 'Keppel Land phat trien Estella, Estella Heights, Palm City, Celesta va nhieu toa van phong hang A tai TP.HCM.' },
      { q: 'Keppel Land tap trung phan khuc nao?', a: 'Keppel Land tap trung phan khuc can ho cao cap va van phong hang A.' },
    ],
  },
  {
    slug: 'vinacapital-land',
    name: 'VinaCapital',
    legal_name: 'VinaCapital Group',
    brand: 'VinaCapital',
    stock_code: null,
    founded_year: 2003,
    headquarters: 'TP.HCM',
    website: 'https://vinacapital.com',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Tap doan quan ly dau tu', 'Nha phat trien BDS nghi duong'],
    summary:
      'VinaCapital la tap doan quan ly dau tu tai Viet Nam, dau tu va phat trien nhieu du an bat dong san nha o, van phong va nghi duong nhu Ocean Dunes, cac khu resort ven bien va cac du an do thi thong qua cac quy dau tu.',
    description:
      'VinaCapital thanh lap nam 2003, la mot trong nhung tap doan quan ly tai san lon tai Viet Nam voi danh muc trai rong tren nhieu linh vuc gom bat dong san. Mang bat dong san tap trung vao cac du an nha o, van phong va nghi duong ven bien, hop tac cung nhieu doi tac phat trien trong va ngoai nuoc.',
    faq: [
      { q: 'VinaCapital la cong ty gi?', a: 'VinaCapital la tap doan quan ly dau tu tai Viet Nam, co mang phat trien bat dong san nha o va nghi duong.' },
      { q: 'VinaCapital thanh lap nam nao?', a: 'VinaCapital duoc thanh lap nam 2003.' },
      { q: 'VinaCapital dau tu vao linh vuc bat dong san nhu the nao?', a: 'VinaCapital dau tu qua cac quy va phat trien du an nha o, van phong va nghi duong ven bien.' },
    ],
  },
  {
    slug: 'bim-land',
    name: 'BIM Land',
    legal_name: 'Cong ty Co phan BIM Land',
    brand: 'BIM Group',
    stock_code: null,
    founded_year: null,
    headquarters: 'Ha Noi',
    website: 'https://bimland.com',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Nha phat trien BDS nghi duong hang dau'],
    summary:
      'BIM Land la thanh vien bat dong san cua BIM Group, phat trien cac quan the do thi va nghi duong quy mo lon tai Ha Long, Phu Quoc, Ninh Thuan va Vinh Phuc voi cac thuong hieu InterContinental, Regent, Citadines va Thanh Xuan Valley.',
    description:
      'BIM Land la nha phat trien bat dong san nghi duong va do thi thuoc BIM Group, tap trung tai cac diem den du lich trong diem. Cac quan the tieu bieu gom Halong Marina (Ha Long), Phu Quoc Marina va Park Hyatt Phu Quoc (Phu Quoc), thuong van hanh boi cac thuong hieu khach san quoc te.',
    faq: [
      { q: 'BIM Land thuoc tap doan nao?', a: 'BIM Land la thanh vien bat dong san cua BIM Group.' },
      { q: 'BIM Land phat trien du an o dau?', a: 'BIM Land phat trien du an tai Ha Long, Phu Quoc, Ninh Thuan va nhieu diem den du lich.' },
      { q: 'BIM Land tap trung phan khuc nao?', a: 'BIM Land tap trung bat dong san nghi duong va do thi ven bien.' },
    ],
  },
  {
    slug: 'mik-land',
    name: 'MIK Group',
    legal_name: 'Cong ty Co phan Tap doan MIK Group Viet Nam',
    brand: 'MIK Group',
    stock_code: null,
    founded_year: null,
    headquarters: 'Ha Noi',
    website: 'https://mikgroup.vn',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Nha phat trien BDS cao cap'],
    summary:
      'MIK Group la chu dau tu bat dong san phat trien nhieu du an can ho va biet thu cao cap tai Ha Noi va TP.HCM nhu The Matrix One, Imperia, Park Kiara, The Sonata va Riviera Point (hop tac Keppel Land).',
    description:
      'MIK Group la nha phat trien bat dong san hoat dong tai ca hai mien, tap trung phan khuc can ho trung va cao cap. Cac du an tieu bieu gom chuoi Imperia, The Matrix One va Park Kiara tai Ha Noi, cung cac du an tai khu Nam Sai Gon nhu Riviera Point va The Sonata.',
    faq: [
      { q: 'MIK Group co du an nao?', a: 'MIK Group phat trien The Matrix One, chuoi Imperia, Park Kiara, The Sonata va Riviera Point.' },
      { q: 'MIK Group tap trung phan khuc nao?', a: 'MIK Group tap trung phan khuc can ho trung va cao cap tai Ha Noi va TP.HCM.' },
      { q: 'MIK Group hoat dong o dau?', a: 'MIK Group phat trien du an tai ca Ha Noi va TP.HCM.' },
    ],
  },
  {
    slug: 'sunshine-group',
    name: 'Sunshine Group',
    legal_name: 'Cong ty Co phan Tap doan Sunshine',
    brand: 'Sunshine Group',
    stock_code: null,
    founded_year: 2016,
    headquarters: 'Ha Noi',
    website: 'https://sunshinegroup.vn',
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Nha phat trien BDS cong nghe'],
    summary:
      'Sunshine Group la chu dau tu bat dong san cao cap ung dung cong nghe, phat trien cac du an can ho va do thi tai Ha Noi va TP.HCM nhu Sunshine City, Sunshine Center, Sunshine Diamond River va Sunshine Empire.',
    description:
      'Sunshine Group thanh lap nam 2016, dinh vi o phan khuc bat dong san cao cap va sieu sang ket hop ung dung cong nghe trong ban hang va van hanh. Cac du an tieu bieu gom Sunshine City, Sunshine Center, Sunshine Riverside (Ha Noi) va Sunshine Diamond River (Quan 7, TP.HCM).',
    faq: [
      { q: 'Sunshine Group thanh lap nam nao?', a: 'Sunshine Group duoc thanh lap nam 2016.' },
      { q: 'Sunshine Group co du an nao?', a: 'Sunshine Group phat trien Sunshine City, Sunshine Center, Sunshine Diamond River va nhieu du an cao cap khac.' },
      { q: 'Sunshine Group tap trung phan khuc nao?', a: 'Sunshine Group tap trung phan khuc can ho cao cap va sieu sang ung dung cong nghe.' },
    ],
  },
  {
    slug: 'tran-duc-land',
    name: 'Tran Duc Land',
    legal_name: 'Cong ty Co phan Tran Duc Corporation',
    brand: 'Tran Duc Group',
    stock_code: null,
    founded_year: null,
    headquarters: 'TP.Thu Duc, TP.HCM',
    website: null,
    charter_capital: null,
    projects_delivered: null,
    land_bank_ha: null,
    awards: ['Nha phat trien BDS va khu cong nghiep'],
    summary:
      'Tran Duc Land la thanh vien bat dong san cua Tran Duc Group, phat trien cac du an nha o, khu do thi va ha tang khu cong nghiep tai TP.Thu Duc, Binh Duong va cac tinh phia Nam.',
    description:
      'Tran Duc Group hoat dong da nganh gom xay dung, bat dong san va ha tang khu cong nghiep. Mang bat dong san Tran Duc Land phat trien cac du an nha o va khu do thi tai khu vuc phia Dong TP.HCM va cac tinh lan can, huong toi khach hang o thuc va nha dau tu.',
    faq: [
      { q: 'Tran Duc Land thuoc tap doan nao?', a: 'Tran Duc Land la thanh vien bat dong san cua Tran Duc Group.' },
      { q: 'Tran Duc Land phat trien du an gi?', a: 'Tran Duc Land phat trien nha o, khu do thi va ha tang khu cong nghiep tai TP.Thu Duc va cac tinh phia Nam.' },
      { q: 'Tran Duc Land hoat dong o dau?', a: 'Tran Duc Land tap trung tai TP.Thu Duc, Binh Duong va khu vuc phia Nam.' },
    ],
  },
];

const SEED_SLUGS = SEED_DEVELOPERS.map((d) => d.slug);

export default {
  description: 'Seed dữ liệu 8 chủ đầu tư BĐS lớn tại Việt Nam (GEO/AEO citable content)',

  async up(client: PoolClient): Promise<void> {
    const { rows: tenants } = await client.query<{ id: string }>('SELECT id FROM tenants');

    let inserted = 0;
    for (const tenant of tenants) {
      for (const dev of SEED_DEVELOPERS) {
        const res = await client.query(
          `INSERT INTO developers (
            tenant_id, slug, name, legal_name, brand, stock_code,
            founded_year, headquarters, website, charter_capital,
            projects_delivered, land_bank_ha, awards, summary, description, faq
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          ON CONFLICT (tenant_id, slug) DO NOTHING`,
          [
            tenant.id,
            dev.slug,
            dev.name,
            dev.legal_name,
            dev.brand,
            dev.stock_code,
            dev.founded_year,
            dev.headquarters,
            dev.website,
            dev.charter_capital,
            dev.projects_delivered,
            dev.land_bank_ha,
            JSON.stringify(dev.awards),
            dev.summary,
            dev.description,
            JSON.stringify(dev.faq),
          ]
        );
        inserted += res.rowCount ?? 0;
      }
    }

    console.log(`  Seeded ${inserted} developer rows across ${tenants.length} tenants.`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(
      `DELETE FROM developers WHERE slug = ANY($1::text[])`,
      [SEED_SLUGS]
    );
  },
};
