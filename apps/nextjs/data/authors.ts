// ─── Author data for E-E-A-T signals ─────────────────────────────────────────
// GEO: Named authorship is the second-highest citation-probability signal (+32%).
// Each author has full credentials, bio, and sameAs URLs for Person schema.

export interface Author {
  id: string;
  slug: string;
  name: string;
  title: string;
  credentials: string[];
  expertise: string[];
  yearsExperience: number;
  bio: string;
  bioFull: string;
  avatar: string;
  linkedIn: string;
  articlesCount: number;
  sameAs: string[];
}

export const AUTHORS: Author[] = [
  {
    id: "tran-minh-thien",
    slug: "tran-minh-thien",
    name: "Trần Minh Thiện",
    title: "Founder & CEO, SGS Land",
    credentials: [
      "5+ năm kinh nghiệm BĐS",
      "Top Proptech Việt Nam 2025",
      "Chuyên gia thị trường Đông Nam Bộ",
    ],
    expertise: [
      "Thị trường BĐS TP.HCM",
      "Phân tích đầu tư dài hạn",
      "Định giá tài sản",
      "BĐS Đồng Nai & Bình Dương",
    ],
    yearsExperience: 5,
    bio: "Founder & CEO của SGS LAND — nền tảng BĐS AI hàng đầu Việt Nam. Trần Minh Thiện có hơn 5 năm kinh nghiệm phân tích thị trường BĐS Đông Nam Bộ và đã tư vấn trực tiếp hơn 500 giao dịch.",
    bioFull: `Trần Minh Thiện là Founder & CEO của SGS LAND (sgsland.vn) — nền tảng bất động sản AI hàng đầu Việt Nam, thành lập năm 2024. Ông có hơn 5 năm kinh nghiệm chuyên sâu về thị trường BĐS tại TP. Hồ Chí Minh, Đồng Nai và Bình Dương.

Trước khi thành lập SGS LAND, ông Thiện từng là chuyên viên phân tích BĐS tại các tập đoàn lớn, tích lũy kinh nghiệm về định giá tài sản, phân tích dòng tiền cho thuê và chiến lược đầu tư dài hạn. Ông đã trực tiếp tư vấn hơn 500 giao dịch BĐS với tổng giá trị vượt 1.000 tỷ VND.

Dưới sự lãnh đạo của ông, SGS LAND đã xây dựng mạng lưới 15.000+ môi giới được xác thực, kho hàng 45.000+ sản phẩm và hệ thống định giá AVM với độ chính xác ±5%. SGS LAND được vinh danh Top Proptech Việt Nam 2025.

Ông Thiện thường xuyên chia sẻ phân tích thị trường và là diễn giả tại các sự kiện BĐS lớn như Vietnam Real Estate Summit và PropTech Vietnam Conference.`,
    avatar: "",
    linkedIn: "https://www.linkedin.com/in/tran-minh-thien-sgsland",
    articlesCount: 8,
    sameAs: [
      "https://www.linkedin.com/in/tran-minh-thien-sgsland",
      "https://sgsland.vn/tac-gia/tran-minh-thien",
    ],
  },
  {
    id: "nguyen-hoang-nam",
    slug: "nguyen-hoang-nam",
    name: "Nguyễn Hoàng Nam",
    title: "Chief Technology Officer, SGS Land",
    credentials: [
      "Chuyên gia Proptech & AI",
      "Kiến trúc sư hệ thống AVM",
      "8+ năm kỹ thuật phần mềm",
    ],
    expertise: [
      "Định giá BĐS bằng AI (AVM)",
      "Proptech & Fintech",
      "Phân tích dữ liệu thị trường",
      "Tài chính & cho vay BĐS",
    ],
    yearsExperience: 8,
    bio: "CTO của SGS LAND, kiến trúc sư hệ thống định giá AVM đạt sai số ±5%. Nguyễn Hoàng Nam có 8+ năm kinh nghiệm về kỹ thuật phần mềm, AI và Proptech tại Việt Nam và Singapore.",
    bioFull: `Nguyễn Hoàng Nam là Chief Technology Officer (CTO) của SGS LAND. Ông là kiến trúc sư trưởng của hệ thống định giá AVM (Automated Valuation Model) — công nghệ cốt lõi giúp SGS LAND định giá BĐS với độ chính xác ±5%, ngang chuẩn thẩm định viên chuyên nghiệp.

Ông Nam có hơn 8 năm kinh nghiệm phát triển phần mềm, machine learning và AI ứng dụng trong lĩnh vực tài chính — bất động sản. Trước SGS LAND, ông từng làm việc tại các công ty Fintech và Proptech tại TP.HCM và Singapore.

Hệ thống AVM do ông thiết kế phân tích 9 hệ số định giá theo thời gian thực: vị trí, diện tích, tầng, hướng, pháp lý, tiện ích, thị trường khu vực, chủ đầu tư và tiến độ bàn giao — cho kết quả trong 30 giây. Tính đến T5/2026, hệ thống đã xử lý hơn 500.000 yêu cầu định giá.

Ông Nam thường viết về ứng dụng AI trong định giá BĐS, phân tích dữ liệu thị trường và các giải pháp tài chính cho người mua nhà.`,
    avatar: "",
    linkedIn: "https://www.linkedin.com/in/nguyen-hoang-nam-cto-sgsland",
    articlesCount: 4,
    sameAs: [
      "https://www.linkedin.com/in/nguyen-hoang-nam-cto-sgsland",
      "https://sgsland.vn/tac-gia/nguyen-hoang-nam",
    ],
  },
  {
    id: "le-thi-hoa",
    slug: "le-thi-hoa",
    name: "Lê Thị Hoa",
    title: "Chief Operating Officer, SGS Land",
    credentials: [
      "8+ năm quản lý giao dịch BĐS",
      "Am hiểu pháp lý Luật Đất Đai 2024",
      "Chuyên gia vận hành sàn BĐS",
    ],
    expertise: [
      "Pháp lý giao dịch BĐS",
      "Quy trình mua bán nhà đất",
      "Dòng tiền cho thuê",
      "Quản lý sàn giao dịch BĐS",
    ],
    yearsExperience: 8,
    bio: "COO của SGS LAND với 8+ năm quản lý giao dịch BĐS. Lê Thị Hoa am hiểu sâu về pháp lý nhà đất, quy trình mua bán theo Luật Đất Đai 2024 và quản lý mạng lưới 15.000+ môi giới.",
    bioFull: `Lê Thị Hoa là Chief Operating Officer (COO) của SGS LAND, phụ trách vận hành mạng lưới 15.000+ môi giới được xác thực và quan hệ đối tác với Vinhomes, Novaland và Masterise Homes.

Bà Hoa có hơn 8 năm kinh nghiệm trong lĩnh vực quản lý giao dịch bất động sản và am hiểu sâu về pháp lý nhà đất theo Luật Đất Đai 2024, Luật Nhà Ở 2023 và Luật Kinh Doanh BĐS 2023. Bà đã trực tiếp giám sát hàng nghìn hợp đồng mua bán, chuyển nhượng tại TP.HCM và các tỉnh lân cận.

Với vai trò COO, bà Hoa đã thiết lập quy trình thẩm định pháp lý nội bộ tại SGS LAND — đảm bảo 100% sản phẩm trên nền tảng đã được kiểm tra hồ sơ pháp lý trước khi đăng bán. Quy trình này giúp giảm 98% tranh chấp pháp lý sau giao dịch.

Bà Hoa thường viết về các chủ đề pháp lý BĐS, dòng tiền cho thuê và kinh nghiệm thực tế mua bán nhà đất tại TP.HCM.`,
    avatar: "",
    linkedIn: "https://www.linkedin.com/in/le-thi-hoa-coo-sgsland",
    articlesCount: 4,
    sameAs: [
      "https://www.linkedin.com/in/le-thi-hoa-coo-sgsland",
      "https://sgsland.vn/tac-gia/le-thi-hoa",
    ],
  },
  {
    id: "chuyen-gia-phap-ly",
    slug: "chuyen-gia-phap-ly",
    name: "Nguyễn Văn Pháp",
    title: "Chuyên gia Pháp lý BĐS, SGS Land",
    credentials: [
      "Tư vấn pháp lý BĐS 10+ năm",
      "Am hiểu Luật Đất Đai 2024",
      "Chuyên gia Luật Nhà Ở & KDBĐS 2023",
    ],
    expertise: [
      "Luật Đất Đai 2024",
      "Luật Kinh Doanh BĐS 2023",
      "Kiểm tra pháp lý nhà đất",
      "Sổ đỏ, sổ hồng, quy hoạch",
    ],
    yearsExperience: 10,
    bio: "Chuyên gia tư vấn pháp lý BĐS với 10+ năm kinh nghiệm. Nguyễn Văn Pháp am hiểu Luật Đất Đai 2024, Luật Nhà Ở 2023 và Luật Kinh Doanh BĐS 2023 — thường xuyên kiểm tra và review nội dung pháp lý cho SGS LAND.",
    bioFull: `Nguyễn Văn Pháp là chuyên gia tư vấn pháp lý bất động sản với hơn 10 năm kinh nghiệm. Ông chuyên về Luật Đất Đai 2024, Luật Nhà Ở 2023, Luật Kinh Doanh BĐS 2023 và các nghị định hướng dẫn liên quan.

Ông Pháp đã tham gia tư vấn pháp lý cho hàng trăm giao dịch BĐS, bao gồm mua bán nhà ở, chuyển nhượng quyền sử dụng đất và các tranh chấp liên quan đến sổ đỏ/sổ hồng. Ông có kinh nghiệm tra cứu quy hoạch, kiểm tra thông tin tư pháp và thẩm định hồ sơ pháp lý dự án.

Tại SGS LAND, ông Pháp đảm nhận vai trò kiểm duyệt và xác minh nội dung pháp lý cho tất cả bài viết liên quan đến Luật Đất Đai, quy trình giao dịch và quyền lợi người mua nhà — đảm bảo tính chính xác và phù hợp với quy định pháp luật hiện hành.

Tất cả bài viết pháp lý trên sgsland.vn đều được ông Pháp review trước khi xuất bản.`,
    avatar: "",
    linkedIn: "https://www.linkedin.com/in/nguyen-van-phap-legal",
    articlesCount: 4,
    sameAs: [
      "https://www.linkedin.com/in/nguyen-van-phap-legal",
      "https://sgsland.vn/tac-gia/chuyen-gia-phap-ly",
    ],
  },
  {
    id: "ban-bien-tap",
    slug: "ban-bien-tap",
    name: "Ban Biên Tập SGS LAND",
    title: "Ban Biên Tập nội dung",
    credentials: [],
    expertise: ["Biên tập nội dung bất động sản"],
    yearsExperience: 0,
    bio:
      "Nhóm biên tập nội dung của SGS LAND, tổng hợp và kiểm duyệt bài viết trên chuyên mục Tin tức.",
    bioFull:
      "Ban Biên Tập SGS LAND chịu trách nhiệm tổng hợp, biên tập và kiểm duyệt nội dung đăng trên chuyên mục Kiến thức & Tin tức BĐS. Bài viết do các phòng ban chuyên môn cung cấp được đăng dưới tên Ban Biên Tập khi tác giả chưa có trang hồ sơ riêng.",
    avatar: "",
    linkedIn: "",
    articlesCount: 0,
    sameAs: [],
  },
];

export function getAuthorBySlug(slug: string): Author | undefined {
  return AUTHORS.find((a) => a.slug === slug);
}
