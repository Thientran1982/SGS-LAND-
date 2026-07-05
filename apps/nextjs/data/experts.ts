// Shared experts (agents) data for SGS LAND.
// Extracted from chuyen-gia/page.tsx so profile pages and the listing
// page share a single source of truth. Do NOT invent people here.

export type Expert = {
  slug: string;
  name: string;
  title: string;
  exp: string;
  spec: string;
  desc: string;
};

export const EXPERTS: Expert[] = [
  {
    "slug": "tran-minh-thien",
    "name": "Trần Minh Thiện",
    "title": "CEO & Founder — Chuyên gia phân phối sơ cấp",
    "exp": "10+ năm",
    "spec": "Vinhomes, Novaland, Aqua City",
    "desc": "Đại lý F1 ủy quyền Novaland (2017), Vinhomes (2019), Masterise Homes (2021). Chuyên phân tích đầu tư dài hạn và tư vấn BĐS hạng sang TP.HCM."
  },
  {
    "slug": "nguyen-hoang-nam",
    "name": "Nguyễn Hoàng Nam",
    "title": "CTO — Chuyên gia định giá AI (AVM)",
    "exp": "10+ năm",
    "spec": "Định giá AI, PropTech, CRM",
    "desc": "Kiến trúc sư hệ thống AVM định giá BĐS với sai số ±5% trên 45.000+ giao dịch thực. Chuyên phân tích thị trường dữ liệu lớn."
  },
  {
    "slug": "le-thi-hoa",
    "name": "Lê Thị Hoa",
    "title": "COO — Chuyên gia pháp lý & vận hành",
    "exp": "15+ năm",
    "spec": "Pháp lý BĐS, Môi giới Bộ Xây Dựng",
    "desc": "Chứng chỉ môi giới BĐS Bộ Xây Dựng. Thiết kế quy trình kiểm tra pháp lý 2 lớp (AI + chuyên viên). Quản lý mạng lưới 15.000+ môi giới toàn quốc."
  },
  {
    "slug": "nguyen-thi-lan",
    "name": "Nguyễn Thị Lan",
    "title": "Trưởng Phòng Tư Vấn — BĐS Đông Nam Bộ",
    "exp": "8+ năm",
    "spec": "Aqua City, Izumi City, Đồng Nai",
    "desc": "Chuyên sâu thị trường BĐS Đồng Nai, Long An, Bình Dương. Tư vấn đầu tư khu công nghiệp và dự án sinh thái ven đô."
  },
  {
    "slug": "pham-van-duc",
    "name": "Phạm Văn Đức",
    "title": "Senior Tư Vấn — BĐS Cao Cấp TP.HCM",
    "exp": "7+ năm",
    "spec": "Thủ Đức, Bình Thạnh, Quận 1",
    "desc": "Chuyên phân phối căn hộ cao cấp Thủ Đức: The Global City, Vinhomes Grand Park, Masteri Thảo Điền. Hỗ trợ vay ngân hàng và ký hợp đồng điện tử."
  },
  {
    "slug": "tran-thi-thu",
    "name": "Trần Thị Thu",
    "title": "Senior Tư Vấn — BĐS Ven Biển & Nghỉ Dưỡng",
    "exp": "6+ năm",
    "spec": "Vinhomes Cần Giờ, NovaWorld Phan Thiết",
    "desc": "Chuyên tư vấn BĐS nghỉ dưỡng ven biển: yield cho thuê, pháp lý sổ hồng resort, tiềm năng tăng giá 5-10 năm."
  }
];

export function getExpertBySlug(slug: string): Expert | undefined {
  return EXPERTS.find((e) => e.slug === slug);
}

export function getExpertSlugs(): string[] {
  return EXPERTS.map((e) => e.slug);
}
