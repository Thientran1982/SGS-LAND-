// Shared experts (agents) data for SGS LAND.
// Extracted from chuyen-gia/page.tsx so profile pages and the listing
// page share a single source of truth. Do NOT invent people here.

export type Expert = {
  slug: string;
  name: string;
  title: string;
  titleEn: string;
  exp: string;
  spec: string;
  specEn: string;
  desc: string;
  descEn: string;
};

export const EXPERTS: Expert[] = [
  {
    "slug": "tran-minh-thien",
    "name": "Trần Minh Thiện",
    "title": "CEO & Founder — Chuyên gia phân phối sơ cấp",
    "titleEn": "CEO & Founder — Primary distribution specialist",
    "exp": "10+ năm",
    "spec": "Vinhomes, Novaland, Aqua City",
    "specEn": "Vinhomes, Novaland, Aqua City",
    "desc": "Đại lý F1 ủy quyền Novaland (2017), Vinhomes (2019), Masterise Homes (2021). Chuyên phân tích đầu tư dài hạn và tư vấn BĐS hạng sang TP.HCM."
    ,"descEn": "Authorised tier-1 agent for Novaland (2017), Vinhomes (2019) and Masterise Homes (2021). Specialises in long-term investment analysis and luxury property advice in Ho Chi Minh City."
  },
  {
    "slug": "nguyen-hoang-nam",
    "name": "Nguyễn Hoàng Nam",
    "title": "CTO — Chuyên gia định giá AI (AVM)",
    "titleEn": "CTO — AI valuation (AVM) specialist",
    "exp": "10+ năm",
    "spec": "Định giá AI, PropTech, CRM",
    "specEn": "AI valuation, PropTech, CRM",
    "desc": "Kiến trúc sư hệ thống AVM định giá BĐS với sai số ±5% trên 45.000+ giao dịch thực. Chuyên phân tích thị trường dữ liệu lớn."
    ,"descEn": "Architect of the AVM valuation engine, accurate to ±5% across 45,000+ real transactions. Specialises in big-data market analysis."
  },
  {
    "slug": "le-thi-hoa",
    "name": "Lê Thị Hoa",
    "title": "COO — Chuyên gia pháp lý & vận hành",
    "titleEn": "COO — Legal & operations specialist",
    "exp": "15+ năm",
    "spec": "Pháp lý BĐS, Môi giới Bộ Xây Dựng",
    "specEn": "Property law, Ministry of Construction brokerage",
    "desc": "Chứng chỉ môi giới BĐS Bộ Xây Dựng. Thiết kế quy trình kiểm tra pháp lý 2 lớp (AI + chuyên viên). Quản lý mạng lưới 15.000+ môi giới toàn quốc."
    ,"descEn": "Licensed real estate broker (Ministry of Construction). Designed the two-layer legal due-diligence process (AI + specialist review) and runs the nationwide network of 15,000+ brokers."
  },
  {
    "slug": "nguyen-thi-lan",
    "name": "Nguyễn Thị Lan",
    "title": "Trưởng Phòng Tư Vấn — BĐS Đông Nam Bộ",
    "titleEn": "Head of Advisory — South-East region",
    "exp": "8+ năm",
    "spec": "Aqua City, Izumi City, Đồng Nai",
    "specEn": "Aqua City, Izumi City, Dong Nai",
    "desc": "Chuyên sâu thị trường BĐS Đồng Nai, Long An, Bình Dương. Tư vấn đầu tư khu công nghiệp và dự án sinh thái ven đô."
    ,"descEn": "Deep expertise in the Dong Nai, Long An and Binh Duong markets. Advises on industrial-park investment and suburban eco-township projects."
  },
  {
    "slug": "pham-van-duc",
    "name": "Phạm Văn Đức",
    "title": "Senior Tư Vấn — BĐS Cao Cấp TP.HCM",
    "titleEn": "Senior Consultant — HCMC luxury property",
    "exp": "7+ năm",
    "spec": "Thủ Đức, Bình Thạnh, Quận 1",
    "specEn": "Thu Duc, Binh Thanh, District 1",
    "desc": "Chuyên phân phối căn hộ cao cấp Thủ Đức: The Global City, Vinhomes Grand Park, Masteri Thảo Điền. Hỗ trợ vay ngân hàng và ký hợp đồng điện tử."
    ,"descEn": "Distributes high-end Thu Duc apartments: The Global City, Vinhomes Grand Park and Masteri Thao Dien. Supports mortgage applications and e-signed contracts."
  },
  {
    "slug": "tran-thi-thu",
    "name": "Trần Thị Thu",
    "title": "Senior Tư Vấn — BĐS Ven Biển & Nghỉ Dưỡng",
    "titleEn": "Senior Consultant — Coastal & resort property",
    "exp": "6+ năm",
    "spec": "Vinhomes Cần Giờ, NovaWorld Phan Thiết",
    "specEn": "Vinhomes Can Gio, NovaWorld Phan Thiet",
    "desc": "Chuyên tư vấn BĐS nghỉ dưỡng ven biển: yield cho thuê, pháp lý sổ hồng resort, tiềm năng tăng giá 5-10 năm."
    ,"descEn": "Advises on coastal resort property: rental yields, resort title status and five-to-ten-year capital growth potential."
  }
];

export function getExpertBySlug(slug: string): Expert | undefined {
  return EXPERTS.find((e) => e.slug === slug);
}

export function getExpertSlugs(): string[] {
  return EXPERTS.map((e) => e.slug);
}
