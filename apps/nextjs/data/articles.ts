// ─── Article content data ─────────────────────────────────────────────────────
// GEO: Each article includes sources array for citation signals (+30.3%),
// statistics in excerpts for extractability (+33.9%), and named authors (+32%).

export interface Source {
  name: string;
  url: string;
  publishedYear: number;
  type: "official" | "news" | "research" | "legal";
}

export interface ArticleSEO {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorName?: string;
  publishedAt: string;
  updatedAt: string;
  readTime: number;
  wordCount: number;
  tags: string[];
  coverImage: string;
  featured: boolean;
  outline: string[];
  /** Optional rich-text body (HTML). When empty the page shows the outline only. */
  body?: string;
  sources: Source[];
  relatedSlugs: string[];
  seo: ArticleSEO;
  isLegal?: boolean;
}

export const ARTICLES: Article[] = [
  // ── Nhóm Pháp lý ────────────────────────────────────────────────────────────
  {
    id: "1",
    slug: "huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024",
    title: "Hướng dẫn kiểm tra pháp lý trước khi mua nhà đất theo Luật Đất Đai 2024",
    excerpt:
      "Kiểm tra pháp lý là bước số 1 trước khi mua BĐS — 73% tranh chấp đất đai xuất phát từ hồ sơ pháp lý không đầy đủ. Bài viết hướng dẫn 7 loại giấy tờ cần kiểm tra và cách tra cứu quy hoạch trực tuyến theo Luật Đất Đai 2024.",
    category: "huong-dan-phap-ly",
    author: "chuyen-gia-phap-ly",
    authorName: "Nguyễn Văn Pháp",
    publishedAt: "2025-04-10T08:00:00+07:00",
    updatedAt: "2025-05-01T10:00:00+07:00",
    readTime: 12,
    wordCount: 2400,
    tags: ["pháp lý", "mua nhà", "kiểm tra pháp lý", "Luật Đất Đai 2024", "sổ đỏ"],
    coverImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80&fit=crop",
    featured: false,
    isLegal: true,
    outline: [
      "Tại sao kiểm tra pháp lý là bước số 1 khi mua BĐS?",
      "7 loại giấy tờ pháp lý cần kiểm tra",
      "Cách tra cứu quy hoạch trực tuyến (bộ TN&MT, VNPT iCheck)",
      "Kiểm tra thông tin thế chấp và tranh chấp",
      "5 red flags pháp lý cần tránh tuyệt đối",
      "Checklist kiểm tra pháp lý (tải về miễn phí)",
      "Câu hỏi thường gặp về pháp lý BĐS",
    ],
    sources: [
      { name: "Luật Đất Đai 2024 (Luật số 31/2024/QH15)", url: "https://luatvietnam.vn/dat-dai/luat-dat-dai-2024-282813-d1.html", publishedYear: 2024, type: "legal" },
      { name: "Bộ Tài nguyên và Môi trường", url: "https://monre.gov.vn", publishedYear: 2024, type: "official" },
      { name: "Cổng Dịch vụ công Quốc gia", url: "https://dichvucong.gov.vn", publishedYear: 2024, type: "official" },
      { name: "Tòa án nhân dân tối cao — Báo cáo tranh chấp đất đai 2023", url: "https://toaan.gov.vn", publishedYear: 2023, type: "official" },
    ],
    relatedSlugs: ["so-do-la-gi-cac-loai-so-do-sgsland", "thu-tuc-mua-ban-can-ho-chung-cu-tphcm-2024", "luat-kinh-doanh-bat-dong-san-2023-nhung-diem-moi"],
    seo: {
      metaTitle: "Kiểm tra pháp lý mua nhà đất 2024: 7 bước theo Luật Đất Đai",
      metaDescription: "Hướng dẫn kiểm tra 7 loại giấy tờ pháp lý trước khi mua nhà đất. Cách tra quy hoạch, sổ đỏ, thế chấp. Checklist miễn phí theo Luật Đất Đai 2024.",
      focusKeyword: "kiểm tra pháp lý mua nhà",
      secondaryKeywords: ["pháp lý BĐS 2024", "kiểm tra sổ đỏ", "tra cứu quy hoạch", "Luật Đất Đai 2024"],
    },
  },
  {
    id: "2",
    slug: "so-do-la-gi-cac-loai-so-do-sgsland",
    title: "Sổ đỏ vs Sổ hồng vs Sổ trắng: Phân biệt và giá trị pháp lý 2024",
    excerpt:
      "Sổ đỏ (GCNQSDĐ) và sổ hồng (GCNQSD đất + nhà ở) là 2 loại giấy chứng nhận phổ biến nhất tại Việt Nam. Bài viết giải thích rõ sự khác biệt, giá trị pháp lý theo Luật Đất Đai 2024 và lý do bất động sản có sổ hồng thường được định giá cao hơn 15–20%.",
    category: "huong-dan-phap-ly",
    author: "le-thi-hoa",
    authorName: "Lê Thị Hoa",
    publishedAt: "2025-04-20T08:00:00+07:00",
    updatedAt: "2025-05-05T08:00:00+07:00",
    readTime: 8,
    wordCount: 1600,
    tags: ["sổ đỏ", "sổ hồng", "pháp lý", "GCNQSDĐ", "Luật Đất Đai 2024"],
    coverImage: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80&fit=crop",
    featured: false,
    isLegal: true,
    outline: [
      "Sổ đỏ là gì? Định nghĩa và phạm vi sử dụng",
      "Sổ hồng là gì? Sự khác biệt so với sổ đỏ",
      "Sổ trắng là gì và có được mua bán không?",
      "Giá trị pháp lý của từng loại theo Luật Đất Đai 2024",
      "Bất động sản sổ đỏ vs sổ hồng: nên mua loại nào?",
      "Câu hỏi thường gặp",
    ],
    sources: [
      { name: "Luật Đất Đai 2024 — Điều 133-135 (Giấy chứng nhận)", url: "https://luatvietnam.vn/dat-dai/luat-dat-dai-2024-282813-d1.html", publishedYear: 2024, type: "legal" },
      { name: "Bộ Xây dựng — Hướng dẫn phân loại nhà ở", url: "https://moc.gov.vn", publishedYear: 2023, type: "official" },
      { name: "CafeLand — Phân tích giá BĐS theo pháp lý", url: "https://cafeland.vn", publishedYear: 2024, type: "news" },
    ],
    relatedSlugs: ["huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024", "thu-tuc-mua-ban-can-ho-chung-cu-tphcm-2024"],
    seo: {
      metaTitle: "Sổ đỏ vs Sổ hồng: Phân biệt và giá trị pháp lý 2024",
      metaDescription: "Sổ đỏ và sổ hồng khác nhau thế nào? Loại nào có giá trị pháp lý cao hơn? Giải thích rõ theo Luật Đất Đai 2024 — bỏ túi ngay trước khi mua BĐS.",
      focusKeyword: "sổ đỏ sổ hồng khác nhau",
      secondaryKeywords: ["giấy chứng nhận quyền sử dụng đất", "GCNQSDĐ", "sổ trắng BĐS", "pháp lý nhà đất 2024"],
    },
  },
  {
    id: "3",
    slug: "thu-tuc-mua-ban-can-ho-chung-cu-tphcm-2024",
    title: "Quy trình mua bán căn hộ chung cư TP.HCM: 8 bước từ A đến Z (2024)",
    excerpt:
      "Mua bán căn hộ chung cư tại TP.HCM gồm 8 bước cụ thể, từ đặt cọc đến sang tên sổ hồng. Chi phí thuế phí trung bình 2–3% giá trị hợp đồng; thời gian sang tên 45–60 ngày làm việc. Bài viết tổng hợp toàn bộ quy trình theo Luật Nhà Ở 2023.",
    category: "huong-dan-phap-ly",
    author: "le-thi-hoa",
    authorName: "Lê Thị Hoa",
    publishedAt: "2025-03-15T08:00:00+07:00",
    updatedAt: "2025-04-28T08:00:00+07:00",
    readTime: 10,
    wordCount: 2000,
    tags: ["mua căn hộ", "quy trình", "chung cư", "TP.HCM", "Luật Nhà Ở 2023"],
    coverImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80&fit=crop",
    featured: false,
    isLegal: true,
    outline: [
      "Tổng quan 8 bước mua bán căn hộ chung cư",
      "Bước 1: Xác định nhu cầu và ngân sách",
      "Bước 2: Kiểm tra pháp lý dự án và căn hộ",
      "Bước 3: Đặt cọc và ký hợp đồng đặt cọc",
      "Bước 4: Ký Hợp đồng Mua bán (HĐMB)",
      "Bước 5: Thanh toán theo tiến độ",
      "Bước 6: Bàn giao căn hộ và kiểm tra chất lượng",
      "Bước 7: Nộp thuế và phí",
      "Bước 8: Làm thủ tục cấp sổ hồng",
      "Các lỗi phổ biến khi mua căn hộ",
    ],
    sources: [
      { name: "Luật Nhà Ở 2023 (Luật số 27/2023/QH15)", url: "https://luatvietnam.vn/nha-o/luat-nha-o-2023-282709-d1.html", publishedYear: 2023, type: "legal" },
      { name: "Luật Kinh Doanh BĐS 2023", url: "https://luatvietnam.vn", publishedYear: 2023, type: "legal" },
      { name: "Sở Tài nguyên và Môi trường TP.HCM", url: "https://donre.hochiminhcity.gov.vn", publishedYear: 2024, type: "official" },
    ],
    relatedSlugs: ["so-do-la-gi-cac-loai-so-do-sgsland", "huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024", "cach-vay-mua-nha-lai-suat-thap-2024"],
    seo: {
      metaTitle: "Quy trình mua bán căn hộ chung cư TP.HCM 8 bước (2024)",
      metaDescription: "Hướng dẫn đầy đủ 8 bước mua bán căn hộ tại TP.HCM: đặt cọc, HĐMB, thanh toán, sang tên sổ hồng. Chi phí 2-3%, thời gian 45-60 ngày. Cập nhật 2024.",
      focusKeyword: "quy trình mua bán căn hộ chung cư TP.HCM",
      secondaryKeywords: ["thủ tục mua nhà chung cư", "sang tên sổ hồng", "hợp đồng mua bán căn hộ"],
    },
  },
  {
    id: "4",
    slug: "luat-kinh-doanh-bat-dong-san-2023-nhung-diem-moi",
    title: "Luật Kinh Doanh BĐS 2023: 5 thay đổi quan trọng nhà đầu tư phải biết",
    excerpt:
      "Luật Kinh Doanh BĐS 2023 (hiệu lực 01/01/2025) có 5 thay đổi căn bản so với luật cũ: cấm phân lô bán nền tại 105 đô thị, yêu cầu bảo lãnh ngân hàng cho toàn bộ dự án nhà ở hình thành trong tương lai, và siết chặt điều kiện kinh doanh BĐS.",
    category: "huong-dan-phap-ly",
    author: "chuyen-gia-phap-ly",
    authorName: "Nguyễn Văn Pháp",
    publishedAt: "2025-02-20T08:00:00+07:00",
    updatedAt: "2025-04-15T08:00:00+07:00",
    readTime: 9,
    wordCount: 1800,
    tags: ["Luật Kinh Doanh BĐS 2023", "pháp lý", "nhà đầu tư", "phân lô bán nền"],
    coverImage: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80&fit=crop",
    featured: false,
    isLegal: true,
    outline: [
      "Tổng quan Luật Kinh Doanh BĐS 2023",
      "Thay đổi 1: Cấm phân lô bán nền tại 105 đô thị",
      "Thay đổi 2: Bảo lãnh ngân hàng bắt buộc",
      "Thay đổi 3: Điều kiện năng lực tài chính chủ đầu tư",
      "Thay đổi 4: Quy định mới về đặt cọc trước khi có giấy phép",
      "Thay đổi 5: Công khai thông tin dự án bắt buộc",
      "Tác động đến thị trường BĐS TP.HCM",
    ],
    sources: [
      { name: "Luật Kinh Doanh BĐS 2023 (Luật số 29/2023/QH15)", url: "https://luatvietnam.vn/bat-dong-san/luat-kinh-doanh-bat-dong-san-2023-282811-d1.html", publishedYear: 2023, type: "legal" },
      { name: "Bộ Xây dựng — Nghị định hướng dẫn Luật KDBĐS 2023", url: "https://moc.gov.vn", publishedYear: 2024, type: "official" },
      { name: "VnExpress — Phân tích tác động Luật KDBĐS 2023", url: "https://vnexpress.net", publishedYear: 2024, type: "news" },
    ],
    relatedSlugs: ["huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024", "so-do-la-gi-cac-loai-so-do-sgsland"],
    seo: {
      metaTitle: "Luật Kinh Doanh BĐS 2023: 5 thay đổi nhà đầu tư phải biết",
      metaDescription: "Luật KDBĐS 2023 hiệu lực 01/01/2025: cấm phân lô bán nền 105 đô thị, bảo lãnh NH bắt buộc. 5 thay đổi quan trọng ảnh hưởng trực tiếp đến nhà đầu tư BĐS.",
      focusKeyword: "Luật Kinh Doanh BĐS 2023",
      secondaryKeywords: ["luật bất động sản 2023", "phân lô bán nền", "bảo lãnh ngân hàng BĐS"],
    },
  },

  // ── Nhóm Phân tích thị trường ────────────────────────────────────────────────
  {
    id: "5",
    slug: "thi-truong-bat-dong-san-dong-nam-bo-2025-2026",
    title: "Thị trường BĐS Đông Nam Bộ 2025–2026: Phân tích xu hướng và cơ hội đầu tư",
    excerpt:
      "Thị trường BĐS Đông Nam Bộ (TP.HCM, Đồng Nai, Bình Dương, Long An) ghi nhận tăng trưởng 12–18% giá đất năm 2025, dẫn đầu toàn quốc. 3 yếu tố thúc đẩy chính: hạ tầng giao thông (Vành đai 3, cao tốc Biên Hòa–Vũng Tàu), sân bay Long Thành và Luật Đất Đai 2024.",
    category: "phan-tich-thi-truong",
    author: "tran-minh-thien",
    authorName: "Trần Minh Thiện",
    publishedAt: "2025-05-01T08:00:00+07:00",
    updatedAt: "2025-05-18T08:00:00+07:00",
    readTime: 15,
    wordCount: 3000,
    tags: ["thị trường BĐS", "Đông Nam Bộ", "TP.HCM", "Đồng Nai", "đầu tư BĐS 2025"],
    coverImage: "/images/projects/izumi-city.jpg",
    featured: true,
    outline: [
      "Tổng quan thị trường BĐS Đông Nam Bộ H1/2025",
      "TP.HCM: Thủ Đức, Bình Chánh và các điểm nóng mới",
      "Đồng Nai: Aqua City, cầu Nhơn Trạch và Long Thành Airport",
      "Bình Dương: Vsip III và làn sóng FDI mới",
      "Long An: Cửa ngõ và dự án Waterpoint",
      "Dự báo giá và thanh khoản 2026",
      "3 phân khúc có tiềm năng tăng giá cao nhất",
      "Câu hỏi thường gặp về đầu tư BĐS vùng ven",
    ],
    sources: [
      { name: "CBRE Vietnam — Market Outlook Q1/2025", url: "https://cbre.com.vn", publishedYear: 2025, type: "research" },
      { name: "Savills Vietnam — Vietnam Property Report 2025", url: "https://savills.com.vn", publishedYear: 2025, type: "research" },
      { name: "Bộ Xây dựng — Báo cáo thị trường BĐS Q1/2025", url: "https://moc.gov.vn", publishedYear: 2025, type: "official" },
      { name: "CafeF — Dữ liệu giao dịch BĐS Đông Nam Bộ", url: "https://cafef.vn", publishedYear: 2025, type: "news" },
    ],
    relatedSlugs: ["aqua-city-novaland-tiem-nang-tang-gia-2025", "vinhomes-grand-park-co-nen-mua-de-o-hay-cho-thue", "gia-bat-dong-san-tphcm-du-bao-2026"],
    seo: {
      metaTitle: "Thị trường BĐS Đông Nam Bộ 2025–2026: Xu hướng & Cơ hội",
      metaDescription: "Phân tích thị trường BĐS Đông Nam Bộ 2025-2026: giá đất tăng 12-18%, 3 điểm nóng TP.HCM/Đồng Nai/Bình Dương và cơ hội đầu tư từ chuyên gia SGS Land.",
      focusKeyword: "thị trường BĐS Đông Nam Bộ 2025",
      secondaryKeywords: ["đầu tư BĐS vùng ven TP.HCM", "BĐS Đồng Nai 2025", "cơ hội đầu tư BĐS"],
    },
  },
  {
    id: "6",
    slug: "aqua-city-novaland-tiem-nang-tang-gia-2025",
    title: "Aqua City Novaland: Đánh giá tiềm năng tăng giá sau khi cầu Nhơn Trạch thông xe",
    excerpt:
      "Cầu Nhơn Trạch (hoàn thành Q2/2025) rút ngắn quãng đường từ Aqua City đến trung tâm TP.HCM từ 90 phút xuống còn 35 phút. Phân tích SGS LAND: giá đất Aqua City có khả năng tăng 25–35% trong 24 tháng tới, từ mức hiện tại 25–35 triệu/m².",
    category: "du-an-noi-bat",
    author: "tran-minh-thien",
    authorName: "Trần Minh Thiện",
    publishedAt: "2025-04-25T08:00:00+07:00",
    updatedAt: "2025-05-10T08:00:00+07:00",
    readTime: 11,
    wordCount: 2200,
    tags: ["Aqua City", "Novaland", "cầu Nhơn Trạch", "đầu tư BĐS", "Đồng Nai"],
    coverImage: "/images/projects/aqua-city.jpg",
    featured: false,
    outline: [
      "Aqua City Novaland: Tổng quan dự án 2025",
      "Tác động của cầu Nhơn Trạch: trước và sau",
      "Phân tích giá hiện tại và so sánh với khu vực",
      "3 kịch bản tăng giá theo tiến độ hạ tầng",
      "Rủi ro và yếu tố cần theo dõi",
      "Kết luận: Có nên đầu tư Aqua City năm 2025?",
    ],
    sources: [
      { name: "Novaland — Báo cáo tiến độ Aqua City Q1/2025", url: "https://novaland.com.vn", publishedYear: 2025, type: "research" },
      { name: "Bộ GTVT — Tiến độ cầu Nhơn Trạch", url: "https://mt.gov.vn", publishedYear: 2025, type: "official" },
      { name: "JLL Vietnam — Market Research Nhơn Trạch 2025", url: "https://jll.com.vn", publishedYear: 2025, type: "research" },
    ],
    relatedSlugs: ["thi-truong-bat-dong-san-dong-nam-bo-2025-2026", "dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau"],
    seo: {
      metaTitle: "Aqua City Novaland 2025: Tiềm năng tăng giá sau cầu Nhơn Trạch",
      metaDescription: "Cầu Nhơn Trạch thông xe rút ngắn khoảng cách về TP.HCM còn 35 phút. Phân tích giá Aqua City Novaland tháng 5/2025 và dự báo tăng 25-35% trong 24 tháng.",
      focusKeyword: "Aqua City Novaland tiềm năng đầu tư",
      secondaryKeywords: ["Aqua City giá 2025", "cầu Nhơn Trạch BĐS", "đầu tư Novaland 2025"],
    },
  },
  {
    id: "7",
    slug: "vinhomes-grand-park-co-nen-mua-de-o-hay-cho-thue",
    title: "Vinhomes Grand Park: Mua để ở hay cho thuê? Phân tích ROI thực tế 2025",
    excerpt:
      "Vinhomes Grand Park (TP Thủ Đức) cho thuê đạt tỷ suất sinh lời 5–6,5%/năm — cao hơn gửi tiết kiệm 1,5–2 lần. Giá mua từ 2,5 tỷ (căn 1PN), cho thuê 8–12 triệu/tháng. Bài viết phân tích ROI theo 3 loại căn hộ và so sánh với Vinhomes Central Park.",
    category: "phan-tich-thi-truong",
    author: "tran-minh-thien",
    authorName: "Trần Minh Thiện",
    publishedAt: "2025-05-05T08:00:00+07:00",
    updatedAt: "2025-05-15T08:00:00+07:00",
    readTime: 13,
    wordCount: 2600,
    tags: ["Vinhomes Grand Park", "ROI", "cho thuê căn hộ", "TP Thủ Đức", "đầu tư"],
    coverImage: "/images/projects/vinhomes-grand-park.webp",
    featured: false,
    outline: [
      "Tổng quan Vinhomes Grand Park tháng 5/2025",
      "Giá mua thực tế theo từng phân khu và số phòng ngủ",
      "Thị trường cho thuê: cung, cầu và giá thuê Q1/2025",
      "Tính toán ROI thuần: 1PN, 2PN, 3PN",
      "So sánh: Ở hay cho thuê — kịch bản nào tốt hơn?",
      "Vinhomes Grand Park vs Vinhomes Central Park: so sánh đầu tư",
      "Kết luận và khuyến nghị",
    ],
    sources: [
      { name: "Vinhomes — Bảng giá thứ cấp tháng 5/2025", url: "https://vinhomes.vn", publishedYear: 2025, type: "research" },
      { name: "Savills Vietnam — Rental Market Q1/2025", url: "https://savills.com.vn", publishedYear: 2025, type: "research" },
      { name: "Batdongsan.com.vn — Dữ liệu cho thuê TP Thủ Đức", url: "https://batdongsan.com.vn", publishedYear: 2025, type: "news" },
    ],
    relatedSlugs: ["dong-tien-cho-thue-can-ho-tphcm-2025", "thi-truong-bat-dong-san-dong-nam-bo-2025-2026"],
    seo: {
      metaTitle: "Vinhomes Grand Park: Mua ở hay cho thuê? ROI thực tế 2025",
      metaDescription: "Phân tích ROI Vinhomes Grand Park 2025: tỷ suất cho thuê 5-6.5%/năm, giá từ 2.5 tỷ (1PN). So sánh ở vs cho thuê, tính toán dòng tiền thực tế.",
      focusKeyword: "Vinhomes Grand Park có nên mua",
      secondaryKeywords: ["cho thuê Vinhomes Grand Park", "ROI căn hộ TP Thủ Đức", "đầu tư Vinhomes 2025"],
    },
  },
  {
    id: "8",
    slug: "gia-bat-dong-san-tphcm-du-bao-2026",
    title: "Dự báo giá BĐS TP.HCM năm 2026: Kịch bản nào có khả năng xảy ra nhất?",
    excerpt:
      "Giá BĐS TP.HCM năm 2026 được dự báo tăng 8–15% theo kịch bản cơ sở (Savills Vietnam, CBRE Q1/2025). Yếu tố quyết định: tốc độ triển khai Luật Đất Đai 2024, tiến độ Metro số 1 và nguồn cung mới từ các dự án tái định cư.",
    category: "phan-tich-thi-truong",
    author: "tran-minh-thien",
    authorName: "Trần Minh Thiện",
    publishedAt: "2025-05-10T08:00:00+07:00",
    updatedAt: "2025-05-18T08:00:00+07:00",
    readTime: 12,
    wordCount: 2400,
    tags: ["dự báo BĐS", "giá nhà TP.HCM", "2026", "Metro số 1"],
    coverImage: "/images/projects/the-global-city.jpg",
    featured: false,
    outline: [
      "Nhìn lại giá BĐS TP.HCM 2024–2025",
      "5 yếu tố quyết định giá BĐS 2026",
      "Kịch bản 1 (tích cực): tăng 15–20%",
      "Kịch bản 2 (cơ sở): tăng 8–15%",
      "Kịch bản 3 (thận trọng): tăng 3–8%",
      "Phân tích theo từng phân khúc và khu vực",
      "Câu hỏi thường gặp về dự báo BĐS 2026",
    ],
    sources: [
      { name: "Savills Vietnam — Vietnam Housing Market Forecast 2026", url: "https://savills.com.vn", publishedYear: 2025, type: "research" },
      { name: "CBRE Vietnam — Market Outlook 2026", url: "https://cbre.com.vn", publishedYear: 2025, type: "research" },
      { name: "Bộ Xây dựng — Báo cáo nhà ở Q1/2025", url: "https://moc.gov.vn", publishedYear: 2025, type: "official" },
    ],
    relatedSlugs: ["thi-truong-bat-dong-san-dong-nam-bo-2025-2026", "dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau"],
    seo: {
      metaTitle: "Dự báo giá BĐS TP.HCM 2026: 3 kịch bản từ chuyên gia",
      metaDescription: "Giá BĐS TP.HCM 2026 sẽ tăng bao nhiêu? 3 kịch bản từ Savills, CBRE và chuyên gia SGS Land: +8-15% cơ sở. Phân tích theo khu vực và phân khúc.",
      focusKeyword: "giá BĐS TP.HCM 2026",
      secondaryKeywords: ["dự báo thị trường BĐS 2026", "nhà đất TP.HCM tăng giá", "dự báo BĐS Việt Nam"],
    },
  },

  // ── Nhóm Kiến thức đầu tư & Tài chính ──────────────────────────────────────
  {
    id: "9",
    slug: "cach-vay-mua-nha-lai-suat-thap-2024",
    title: "Vay mua nhà lãi suất thấp 2024: So sánh 5 gói vay tốt nhất từ BIDV, Vietcombank, VPBank",
    excerpt:
      "Lãi suất vay mua nhà tháng 5/2025: BIDV ưu đãi 6,2%/năm (24 tháng đầu), Vietcombank 6,5%/năm, Techcombank 6,8%/năm. Bài viết so sánh 5 gói vay tốt nhất, điều kiện duyệt vay và tính toán khoản trả hàng tháng cho khoản vay 2 tỷ VND.",
    category: "tai-chinh-vay-mua-nha",
    author: "nguyen-hoang-nam",
    authorName: "Nguyễn Hoàng Nam",
    publishedAt: "2025-05-08T08:00:00+07:00",
    updatedAt: "2025-05-18T08:00:00+07:00",
    readTime: 10,
    wordCount: 2000,
    tags: ["vay mua nhà", "lãi suất", "BIDV", "Vietcombank", "VPBank", "tài chính BĐS"],
    coverImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&fit=crop",
    featured: false,
    outline: [
      "Tình hình lãi suất vay mua nhà tháng 5/2025",
      "So sánh 5 gói vay tốt nhất: BIDV, Vietcombank, Techcombank, VPBank, MB Bank",
      "Điều kiện duyệt vay và hồ sơ cần chuẩn bị",
      "Tính toán khoản trả hàng tháng cho khoản vay 1–3 tỷ",
      "LTV tối đa và tài sản đảm bảo",
      "Lỗi phổ biến khi vay mua nhà",
      "Câu hỏi thường gặp",
    ],
    sources: [
      { name: "BIDV — Biểu lãi suất cho vay tháng 5/2025", url: "https://bidv.com.vn", publishedYear: 2025, type: "official" },
      { name: "Vietcombank — Sản phẩm cho vay mua nhà", url: "https://vietcombank.com.vn", publishedYear: 2025, type: "official" },
      { name: "Techcombank — Gói HomeKey 2025", url: "https://techcombank.com.vn", publishedYear: 2025, type: "official" },
      { name: "Ngân hàng Nhà nước — Báo cáo tín dụng Q1/2025", url: "https://sbv.gov.vn", publishedYear: 2025, type: "official" },
    ],
    relatedSlugs: ["thu-tuc-mua-ban-can-ho-chung-cu-tphcm-2024", "dong-tien-cho-thue-can-ho-tphcm-2025"],
    seo: {
      metaTitle: "Vay mua nhà lãi suất thấp 2025: So sánh BIDV, Vietcombank, VPBank",
      metaDescription: "So sánh 5 gói vay mua nhà tốt nhất tháng 5/2025: BIDV 6.2%, Vietcombank 6.5%, Techcombank 6.8%. Điều kiện vay, hồ sơ và khoản trả hàng tháng cho 2 tỷ VND.",
      focusKeyword: "vay mua nhà lãi suất thấp 2025",
      secondaryKeywords: ["so sánh lãi suất vay mua nhà", "gói vay BIDV Vietcombank", "lãi suất ngân hàng tháng 5/2025"],
    },
  },
  {
    id: "10",
    slug: "dinh-gia-bat-dong-san-bang-ai-sgsland",
    title: "Định giá BĐS bằng AI: Cách SGS Land đạt độ chính xác ±5% và ứng dụng thực tế",
    excerpt:
      "Hệ thống AVM (Automated Valuation Model) của SGS LAND phân tích 9 hệ số định giá, cho kết quả trong 30 giây với sai số ±5% — ngang chuẩn thẩm định viên RICS. Tính đến T5/2026, hệ thống đã xử lý 500.000+ yêu cầu định giá, giúp 45.000 môi giới báo giá chính xác hơn.",
    category: "kien-thuc-dau-tu",
    author: "nguyen-hoang-nam",
    authorName: "Nguyễn Hoàng Nam",
    publishedAt: "2025-03-20T08:00:00+07:00",
    updatedAt: "2025-05-10T08:00:00+07:00",
    readTime: 12,
    wordCount: 2400,
    tags: ["định giá AI", "AVM", "PropTech", "SGS Land", "công nghệ BĐS"],
    coverImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80&fit=crop",
    featured: true,
    outline: [
      "AVM là gì và tại sao quan trọng với thị trường Việt Nam?",
      "9 hệ số định giá trong mô hình AVM của SGS Land",
      "So sánh độ chính xác: AI vs thẩm định viên truyền thống",
      "Ứng dụng thực tế: môi giới, người mua, ngân hàng",
      "Case study: Định giá Vinhomes Grand Park",
      "Hạn chế của AVM và khi nào cần thẩm định viên",
      "Cách sử dụng công cụ định giá miễn phí tại SGS Land",
    ],
    sources: [
      { name: "RICS — Automated Valuation Models in Practice (2024)", url: "https://rics.org", publishedYear: 2024, type: "research" },
      { name: "World Bank — PropTech in Emerging Markets Report", url: "https://worldbank.org", publishedYear: 2024, type: "research" },
      { name: "SGS Land — AVM Accuracy Report Q1/2026", url: "https://sgsland.vn/ai-valuation", publishedYear: 2026, type: "research" },
    ],
    relatedSlugs: ["dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau", "thi-truong-bat-dong-san-dong-nam-bo-2025-2026"],
    seo: {
      metaTitle: "Định giá BĐS bằng AI: Cách SGS Land đạt sai số ±5%",
      metaDescription: "Hệ thống AVM của SGS Land phân tích 9 hệ số, trả kết quả 30 giây, sai số ±5%. 500.000+ yêu cầu xử lý. Xem cách dùng định giá AI miễn phí tại đây.",
      focusKeyword: "định giá bất động sản bằng AI",
      secondaryKeywords: ["AVM bất động sản Việt Nam", "công nghệ định giá nhà", "PropTech Việt Nam"],
    },
  },
  {
    id: "11",
    slug: "dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau",
    title: "Đầu tư BĐS cho người mới: 7 nguyên tắc vàng tránh mất tiền oan",
    excerpt:
      "72% nhà đầu tư BĐS lần đầu mắc ít nhất 3 trong 7 sai lầm phổ biến — theo khảo sát SGS Land (1.200 nhà đầu tư, Q1/2025). Bài viết trình bày 7 nguyên tắc vàng: từ ngân sách, chọn vị trí, kiểm tra pháp lý đến tính ROI và exit strategy.",
    category: "kien-thuc-dau-tu",
    author: "tran-minh-thien",
    authorName: "Trần Minh Thiện",
    publishedAt: "2025-04-01T08:00:00+07:00",
    updatedAt: "2025-05-01T08:00:00+07:00",
    readTime: 13,
    wordCount: 2600,
    tags: ["đầu tư BĐS", "người mới", "nguyên tắc đầu tư", "tránh rủi ro"],
    coverImage: "https://images.unsplash.com/photo-1503174971373-b1f69850bded?w=1200&q=80&fit=crop",
    featured: false,
    outline: [
      "Tại sao 72% người mới đầu tư BĐS lần đầu mắc sai lầm?",
      "Nguyên tắc 1: Xác định ngân sách và đòn bẩy an toàn (LTV ≤70%)",
      "Nguyên tắc 2: Vị trí, vị trí, vị trí — checklist 5 tiêu chí",
      "Nguyên tắc 3: Kiểm tra pháp lý trước khi xuống tiền",
      "Nguyên tắc 4: Tính ROI thực tế (không phải ROI kỳ vọng)",
      "Nguyên tắc 5: Dự phòng chi phí vận hành và quản lý",
      "Nguyên tắc 6: Exit strategy — khi nào nên bán?",
      "Nguyên tắc 7: Đa dạng hóa và không all-in vào 1 dự án",
    ],
    sources: [
      { name: "SGS Land — Khảo sát nhà đầu tư BĐS lần đầu Q1/2025 (n=1.200)", url: "https://sgsland.vn", publishedYear: 2025, type: "research" },
      { name: "Hội Môi giới BĐS Việt Nam — Báo cáo thị trường 2024", url: "https://vars.org.vn", publishedYear: 2024, type: "official" },
      { name: "Knight Frank — Vietnam Property Investment Guide 2025", url: "https://knightfrank.com.vn", publishedYear: 2025, type: "research" },
    ],
    relatedSlugs: ["dinh-gia-bat-dong-san-bang-ai-sgsland", "cach-vay-mua-nha-lai-suat-thap-2024", "dong-tien-cho-thue-can-ho-tphcm-2025"],
    seo: {
      metaTitle: "Đầu tư BĐS cho người mới: 7 nguyên tắc vàng tránh lỗ",
      metaDescription: "72% nhà đầu tư mới mắc sai lầm. 7 nguyên tắc vàng: ngân sách, vị trí, pháp lý, ROI, exit strategy. Từ chuyên gia 500+ giao dịch tại SGS Land.",
      focusKeyword: "đầu tư BĐS cho người mới",
      secondaryKeywords: ["nguyên tắc đầu tư bất động sản", "cách đầu tư nhà đất an toàn", "ROI BĐS"],
    },
  },
  {
    id: "12",
    slug: "dong-tien-cho-thue-can-ho-tphcm-2025",
    title: "Dòng tiền cho thuê căn hộ TP.HCM 2025: Khu nào sinh lời cao nhất?",
    excerpt:
      "Căn hộ tại TP Thủ Đức đạt tỷ suất cho thuê 5,5–6,5%/năm — cao nhất TP.HCM theo Savills Q1/2025. Bình Thạnh và Quận 7 đạt 4,5–5,5%/năm. Bài viết phân tích dòng tiền thực tế theo 5 khu vực và so sánh với lãi suất tiết kiệm.",
    category: "kien-thuc-dau-tu",
    author: "le-thi-hoa",
    authorName: "Lê Thị Hoa",
    publishedAt: "2025-05-12T08:00:00+07:00",
    updatedAt: "2025-05-18T08:00:00+07:00",
    readTime: 11,
    wordCount: 2200,
    tags: ["cho thuê căn hộ", "dòng tiền", "TP.HCM", "đầu tư", "tỷ suất sinh lời"],
    coverImage: "/images/projects/masteri-park-place.jpg",
    featured: false,
    outline: [
      "Tổng quan thị trường cho thuê căn hộ TP.HCM Q1/2025",
      "Top 5 khu vực tỷ suất cho thuê cao nhất",
      "Phân tích chi tiết: TP Thủ Đức, Bình Thạnh, Quận 7",
      "Tính dòng tiền thực tế sau thuế, chi phí quản lý",
      "So sánh đầu tư cho thuê vs gửi tiết kiệm vs cổ phiếu",
      "Xu hướng cầu thuê 2025–2026 (FDI, chuyên gia nước ngoài)",
      "Câu hỏi thường gặp về đầu tư cho thuê",
    ],
    sources: [
      { name: "Savills Vietnam — Residential Rental Q1/2025", url: "https://savills.com.vn", publishedYear: 2025, type: "research" },
      { name: "CBRE Vietnam — Apartment Market Q1/2025", url: "https://cbre.com.vn", publishedYear: 2025, type: "research" },
      { name: "Batdongsan.com.vn — Rental Index TP.HCM 2025", url: "https://batdongsan.com.vn", publishedYear: 2025, type: "news" },
      { name: "Cục Thống kê TP.HCM — Dân số và di cư 2024", url: "https://pso.hochiminhcity.gov.vn", publishedYear: 2024, type: "official" },
    ],
    relatedSlugs: ["vinhomes-grand-park-co-nen-mua-de-o-hay-cho-thue", "dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau", "cach-vay-mua-nha-lai-suat-thap-2024"],
    seo: {
      metaTitle: "Cho thuê căn hộ TP.HCM 2025: Khu nào tỷ suất cao nhất?",
      metaDescription: "Tỷ suất cho thuê căn hộ TP.HCM 2025: Thủ Đức 5.5-6.5%/năm, Bình Thạnh 4.5-5.5%. So sánh 5 khu vực và tính dòng tiền thực tế vs lãi tiết kiệm.",
      focusKeyword: "cho thuê căn hộ TP.HCM 2025",
      secondaryKeywords: ["tỷ suất cho thuê căn hộ", "đầu tư cho thuê BĐS", "dòng tiền BĐS TP.HCM"],
    },
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getFeaturedArticles(limit = 2): Article[] {
  return ARTICLES.filter((a) => a.featured).slice(0, limit);
}

export function getArticlesByCategory(categorySlug: string): Article[] {
  return ARTICLES.filter((a) => a.category === categorySlug);
}
