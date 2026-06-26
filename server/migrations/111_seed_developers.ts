import type { Migration } from './runner';

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
  charter_capital: string | null; // BIGINT -> string để tránh mất độ chính xác
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
];
