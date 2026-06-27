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
    website: 'https://khanhdien.com.vn',
    charter_capital: '3490000000000',
    projects_delivered: 25,
    land_bank_ha: '700.00',
    awards: ['Top 10 Chủ đầu tư BĐS uy tín TP.HCM', 'Dự án nhà ở được khách hàng tin tưởng nhất'],
    summary:
      'Khang Điền (mã KDH) là chủ đầu tư bất động sản nhà ở uy tín tại TP.HCM, thành lập năm 2001, chuyên phát triển nhà phố, biệt thự và căn hộ tại khu Đông và khu Nam TP.HCM với tiêu chí pháp lý minh bạch và chất lượng xây dựng cao.',
    description:
      'Khang Điền tập trung vào phân khúc nhà phố thương mại và biệt thự tại TP.HCM. Các dự án tiêu biểu gồm Verosa Park (Quận 9), Lovera Vista (Bình Chánh), IvyCity (TP. Thủ Đức). Công ty nổi tiếng với cam kết pháp lý sổ đỏ rõ ràng và tiến độ xây dựng đúng hẹn.',
    faq: [
      { q: 'Khang Điền có những dự án nào tại TP.HCM?', a: 'Khang Điền là chủ đầu tư Verosa Park (Quận 9), Lovera Vista (Bình Chánh), IvyCity (TP. Thủ Đức) và nhiều dự án nhà phố, biệt thự khác.' },
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
      'Masterise Homes hướng đến phân khúc luxury và ultra-luxury với chuẩn thiết kế quốc tế. Dự án tiêu biểu tại TP.HCM: Masteri Waterfront (Quận 9), Masteri Centre Point, Grand Marina Saigon (hợp tác Marriott). Tại Hà Nội: Masteri West Heights, Masteri Waterfront Hà Nội.',
    faq: [
      { q: 'Masterise Homes có những dự án nào tại TP.HCM?', a: 'Masterise Homes phát triển Grand Marina Saigon (Quận 1), Masteri Centre Point (TP. Thủ Đức), Masteri Waterfront tại TP.HCM.' },
      { q: 'Masterise Homes thuộc tập đoàn nào?', a: 'Masterise Homes là thương hiệu BĐS thuộc Masterise Group, công ty con của Tập đoàn Thành Công (TC Group).' },
      { q: 'Masterise Homes hướng đến phân khúc nào?', a: 'Masterise Homes chuyên phân khúc luxury và ultra-luxury, căn hộ hạng sang và biệt thự cao cấp theo chuẩn quốc tế.' },
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
