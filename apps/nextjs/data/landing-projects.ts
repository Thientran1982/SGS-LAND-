/**
 * Landing project data — static seed for the 4 GEO-optimised project landing pages.
 * All content is in Vietnamese (UI requirement). Code comments in English.
 */

export interface LandingFAQ {
  q: string;
  a: string;
}

export interface LandingStat {
  num: string;
  lbl: string;
}

export interface LandingEntityRow {
  k: string;
  v: string;
}

export interface LandingTheme {
  primary: string;
  deep: string;
  soft: string;
  gold: string;
  goldSoft: string;
  cream: string;
}

export interface LandingProject {
  slug: string;
  titleFull: string;
  titleShort: string;
  eyebrow: string;
  desc: string;
  keywords: string;
  heroImageAlt: string;
  /** CSS gradient applied over the hero image, e.g. "linear-gradient(rgba(6,48,31,.7),rgba(6,48,31,.55))" */
  heroGradient: string;
  theme: LandingTheme;
  geo: { lat: number; lng: number };
  stats: LandingStat[];
  heroH1: string;
  heroSub: string;
  heroMeta: string;
  overviewParas: string[];
  entityTable: LandingEntityRow[];
  locationIntro: string;
  googleMapsEmbedSrc: string;
  faq: LandingFAQ[];
  navLinks: { href: string; label: string }[];
  // Schema helpers
  schemaName: string;
  schemaDev: string;
  schemaLocality: string;
  schemaRegion: string;
  schemaAreaHa?: number;
  schemaPriceLow?: number;
  schemaPriceHigh?: number;
  schemaTotalUnits?: number;
  schemaAmenities: string[];
}

// ─────────────────────────────────────────────
// AQUA CITY
// ─────────────────────────────────────────────
const AQUA_CITY: LandingProject = {
  slug: "aqua-city",
  titleFull: "Aqua City Novaland — Khu Đô Thị Sinh Thái Đảo 1.000Ha | Đồng Nai 2026",
  titleShort: "Aqua City Novaland",
  eyebrow: "Novaland Group • Đồng Nai • Hành Lang Sân Bay Long Thành",
  desc: "Toàn bộ thông tin Aqua City Novaland 2026: 1.000ha sinh thái đảo tại Nhơn Trạch – Đồng Nai, 44 phân khu, hơn 44.000 sản phẩm, giá thứ cấp từ 2,5 tỷ. Bảng giá, pháp lý, vị trí, tiện ích và đánh giá khách quan từ SGS Land.",
  keywords: "Aqua City Novaland, Aqua City giá bao nhiêu, Aqua City 2026, đô thị sinh thái Đồng Nai, sân bay Long Thành bất động sản",
  heroImageAlt: "Toàn cảnh Aqua City Novaland — khu đô thị sinh thái đảo 1.000ha tại Nhơn Trạch, Đồng Nai, 3 mặt sông tự nhiên",
  heroGradient: "linear-gradient(rgba(6,48,31,.72),rgba(6,48,31,.55))",
  theme: {
    primary: "#0a4c3e",
    deep: "#06301f",
    soft: "#e8f0ec",
    gold: "#d4a843",
    goldSoft: "#f7e8be",
    cream: "#f5f1e8",
  },
  geo: { lat: 10.9282, lng: 106.7992 },
  stats: [
    { num: "1.000ha", lbl: "Tổng diện tích" },
    { num: "44", lbl: "Phân khu" },
    { num: "~44.000", lbl: "Sản phẩm" },
    { num: "40km", lbl: "Từ TP.HCM" },
    { num: "30%", lbl: "Cây xanh & mặt nước" },
    { num: "3 mặt sông", lbl: "Cảnh quan tự nhiên" },
  ],
  heroH1: "Aqua City Novaland",
  heroSub: "Khu Đô Thị Sinh Thái Đảo 1.000Ha — Biên Hòa, Đồng Nai",
  heroMeta: "CĐT Novaland (NVL) | 44 Phân Khu | Hành Lang Sân Bay Long Thành | 40km TP.HCM",
  overviewParas: [
    "Aqua City (tên đầy đủ: Khu đô thị sinh thái Aqua City) là đại đô thị sinh thái nghỉ dưỡng quy mô 1.000 ha do Tập đoàn Novaland Group (NVL – HOSE) phát triển tại xã Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai. Đây là đô thị sinh thái đảo đầu tiên tại Việt Nam với 3 mặt giáp sông Đồng Nai và 30% diện tích dành cho cây xanh, mặt nước.",
    "Dự án được quy hoạch thành 44 phân khu chức năng với hơn 44.000 sản phẩm nhà ở và thương mại, gồm nhà phố liền kề, shophouse, biệt thự song lập, biệt thự đơn lập, condotel và căn hộ dịch vụ. Tổng vốn đầu tư ước tính lên đến 50.000 tỷ đồng, tương đương quy mô một dự án tầm cỡ quốc tế.",
    "Về hạ tầng kết nối: Aqua City nằm trên trục cao tốc TP.HCM – Long Thành – Dầu Giây, cách trung tâm TP.HCM 40km và cách Sân bay Long Thành (dự kiến khai thác năm 2026) chỉ 15km. Khi hạ tầng vùng hoàn thiện, đây là một trong những vị trí chiến lược nhất trong hành lang kinh tế Đông Nam Bộ.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Aqua City (Khu đô thị sinh thái Aqua City)" },
    { k: "Chủ đầu tư", v: "Tập đoàn Novaland Group (mã CK: NVL – HOSE)" },
    { k: "Vị trí", v: "Xã Long Hưng, TP. Biên Hòa, Tỉnh Đồng Nai" },
    { k: "Tọa độ GPS", v: "10.9282°N, 106.7992°E" },
    { k: "Quy mô", v: "1.000 ha (đô thị sinh thái đảo, 3 mặt sông)" },
    { k: "Số phân khu", v: "44 phân khu chức năng" },
    { k: "Tổng sản phẩm", v: "Hơn 44.000 (nhà phố, shophouse, biệt thự, condotel, căn hộ)" },
    { k: "Cây xanh & mặt nước", v: "30% diện tích — cam kết từ quy hoạch 1/500" },
    { k: "Hạ tầng kết nối", v: "Cao tốc TP.HCM – Long Thành – Dầu Giây; cách Q1 40km, cách sân bay Long Thành 15km" },
    { k: "Tổng vốn đầu tư", v: "Ước tính ~50.000 tỷ VNĐ" },
    { k: "Hotline tư vấn", v: "0971 132 378 (SGS Land — đại lý ủy quyền chính thức)" },
  ],
  locationIntro:
    "Aqua City tọa lạc tại xã Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai — nằm trong hành lang kinh tế Đông Bắc, cách TP.HCM 40km và cách Sân bay Long Thành 15km theo cao tốc TP.HCM – Long Thành – Dầu Giây. Với 3 mặt giáp sông Đồng Nai, đây là một trong số ít đại đô thị tại Việt Nam có cảnh quan sinh thái không thể tái tạo.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps?q=Aqua+City+Novaland+Nhon+Trach+Dong+Nai&output=embed",
  faq: [
    {
      q: "Aqua City là dự án gì?",
      a: "Aqua City (tên đầy đủ: Khu đô thị sinh thái Aqua City) là đại đô thị sinh thái nghỉ dưỡng quy mô 1.000 ha do Tập đoàn Novaland Group (NVL – HOSE) phát triển tại xã Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai. Dự án gồm 44 phân khu chức năng với hơn 44.000 sản phẩm nhà ở và thương mại, định vị là đô thị sinh thái đảo đầu tiên tại Việt Nam với 30% diện tích dành cho cây xanh và mặt nước.",
    },
    {
      q: "Aqua City ở đâu? Địa chỉ cụ thể?",
      a: "Aqua City tọa lạc tại xã Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai, cách trung tâm TP.HCM khoảng 40 km theo hướng Đông Bắc, di chuyển qua cao tốc TP.HCM – Long Thành – Dầu Giây. Dự án cách Sân bay Long Thành khoảng 15 km và cách cầu Long Thành 5 km. Tọa độ GPS: 10.9282°N, 106.7992°E.",
    },
    {
      q: "Chủ đầu tư Aqua City là ai?",
      a: "Chủ đầu tư Aqua City là Tập đoàn Novaland Group (mã chứng khoán: NVL – HOSE), một trong ba tập đoàn bất động sản quy mô lớn nhất Việt Nam. Novaland thành lập năm 1992, đã phát triển hơn 50 dự án tại TP.HCM và các tỉnh lân cận. Tổng vốn đầu tư tích lũy của Novaland vượt 200.000 tỷ đồng.",
    },
    {
      q: "Aqua City có bao nhiêu phân khu và sản phẩm?",
      a: "Aqua City được quy hoạch gồm 44 phân khu chức năng với tổng hơn 44.000 sản phẩm nhà ở và thương mại. Các phân khu tiêu biểu: Aqua Village (nhà phố biệt lập, đã có cư dân sinh sống từ 2023), The Phoenix South, The Grand Quay (view trực diện sông Đồng Nai), Nova Highland và khu khách sạn – nghỉ dưỡng 5 sao NovaWorld.",
    },
    {
      q: "Pháp lý Aqua City 2026 như thế nào — đã có sổ đỏ chưa?",
      a: "Tính đến tháng 4/2026, một số phân khu tại Aqua City đã được cấp Giấy chứng nhận quyền sử dụng đất (sổ đỏ), đặc biệt là phân khu Aqua Village. Các phân khu còn lại đang tiếp tục hoàn thiện pháp lý theo lộ trình phối hợp giữa Novaland và UBND tỉnh Đồng Nai. Người mua cần xác minh tình trạng pháp lý từng căn cụ thể trước khi giao dịch.",
    },
    {
      q: "Giá bán Aqua City 2026 bao nhiêu?",
      a: "Giá thứ cấp tham khảo Aqua City tháng 4/2026: nhà phố dân cư (85–120m² đất) 7–12 tỷ đồng (~65–110 triệu/m²); shophouse thương mại (90–130m²) 10–18 tỷ; biệt thự song lập (150–220m²) 15–25 tỷ; biệt thự đơn lập (200–450m²) 25–45 tỷ; condotel 50 năm (45–90m² GFA) 2,5–5 tỷ. Đây là giá thứ cấp, không phải giá mở bán chính thức. Liên hệ 0971 132 378 để cập nhật.",
    },
    {
      q: "Aqua City đã có cư dân sinh sống chưa?",
      a: "Có. Phân khu Aqua Village tại Aqua City đã có cư dân thực tế sinh sống từ năm 2023, xác nhận tính khả thi của mô hình đô thị sinh thái đảo. Đây là điểm khác biệt so với nhiều dự án đại đô thị cùng giai đoạn vẫn còn đang triển khai hạ tầng.",
    },
    {
      q: "Từ Aqua City đến TP.HCM mất bao lâu?",
      a: "Aqua City cách trung tâm TP.HCM khoảng 40 km và mất 45–60 phút di chuyển bằng ô tô qua cao tốc TP.HCM – Long Thành – Dầu Giây. Khi các tuyến kết nối nội khu và vành đai 3 hoàn thiện, thời gian dự kiến rút xuống 35–45 phút.",
    },
    {
      q: "Aqua City có những tiện ích gì nổi bật?",
      a: "Aqua City tích hợp hơn 100 tiện ích nội khu: sân golf 18 lỗ, bến du thuyền, khách sạn 5 sao NovaWorld, trung tâm thương mại, trường học liên cấp quốc tế, bệnh viện đa khoa, công viên sinh thái 4 mùa, khu vui chơi giải trí ven sông và 30% diện tích cây xanh mặt nước trải dài 3 mặt sông.",
    },
    {
      q: "Sân bay Long Thành có ảnh hưởng gì đến Aqua City?",
      a: "Sân bay Long Thành giai đoạn 1 (công suất 25 triệu hành khách/năm) dự kiến khai thác năm 2026, nằm cách Aqua City khoảng 15 km. Kinh nghiệm quốc tế cho thấy bất động sản trong bán kính 20–30 km từ sân bay quốc tế lớn tăng giá trung bình 15–30% trong 3–5 năm xung quanh thời điểm khai thác — hiệu ứng 'airport economy' đã được ghi nhận tại Changi (Singapore) và Incheon (Hàn Quốc).",
    },
    {
      q: "Có nên mua Aqua City để đầu tư không? Rủi ro là gì?",
      a: "Aqua City phù hợp với nhà đầu tư dài hạn 5–10 năm, khẩu vị rủi ro trung bình. Điểm mạnh: giá thứ cấp đã điều chỉnh 25–40% so với đỉnh 2021–2022; vị trí hưởng lợi từ sân bay Long Thành và hành lang Đông Nam Bộ. Rủi ro: (1) pháp lý chưa hoàn thiện toàn khu — chỉ mua căn đã có sổ đỏ; (2) thanh khoản thứ cấp còn hạn chế — không dùng đòn bẩy vay quá 50% giá trị tài sản.",
    },
    {
      q: "Cách liên hệ tư vấn Aqua City qua SGS Land?",
      a: "Liên hệ SGS Land để được tư vấn miễn phí về Aqua City: Hotline 0971 132 378 (trực 24/7), website sgsland.vn, hoặc để lại thông tin trong form tư vấn tại trang này. SGS Land là đại lý phân phối ủy quyền chính thức của Novaland, đảm bảo thông tin pháp lý xác thực và báo giá cập nhật nhất.",
    },
  ],
  navLinks: [
    { href: "#tong-quan", label: "Tổng quan" },
    { href: "#vi-tri", label: "Vị trí" },
    { href: "#tien-ich", label: "Tiện ích" },
    { href: "#bang-gia", label: "Bảng giá" },
    { href: "#faq", label: "FAQ" },
    { href: "#lien-he", label: "Liên hệ" },
  ],
  schemaName: "Aqua City Novaland",
  schemaDev: "Novaland Group",
  schemaLocality: "Xã Long Hưng, TP. Biên Hòa",
  schemaRegion: "Tỉnh Đồng Nai",
  schemaAreaHa: 1000,
  schemaPriceLow: 2_500_000_000,
  schemaPriceHigh: 45_000_000_000,
  schemaTotalUnits: 44000,
  schemaAmenities: [
    "Sân golf 18 lỗ",
    "Bến du thuyền",
    "Khách sạn 5 sao NovaWorld",
    "Trung tâm thương mại",
    "Trường học liên cấp quốc tế",
    "Bệnh viện đa khoa",
    "Công viên sinh thái 4 mùa",
    "Khu nghỉ dưỡng ven sông",
    "30% diện tích cây xanh mặt nước",
  ],
};

// ─────────────────────────────────────────────
// LEGACY 66
// ─────────────────────────────────────────────
const LEGACY_66: LandingProject = {
  slug: "legacy-66",
  titleFull: "Legacy 66 — Căn Hộ Cao Cấp 66 Tân Thành Chợ Lớn TP.HCM | Savills | Q2/2027",
  titleShort: "Legacy 66",
  eyebrow: "Tân Thành • Savills • DELTA • Phú Hoàng Land",
  desc: "Legacy 66 tại 66 Tân Thành, Phường Chợ Lớn TP.HCM: 348 căn hộ 1–3PN (45–95m²), sở hữu lâu dài, quản lý Savills chuẩn quốc tế, bàn giao Q2/2027. Bảng giá, chính sách thanh toán và tư vấn miễn phí từ SGS Land.",
  keywords: "Legacy 66, Legacy 66 Tân Thành, căn hộ Chợ Lớn, Legacy 66 giá bao nhiêu, căn hộ Savills TP.HCM",
  heroImageAlt: "Legacy 66 — căn hộ cao cấp tại 66 Tân Thành, Phường Chợ Lớn, TP.HCM, quản lý bởi Savills",
  heroGradient: "linear-gradient(rgba(10,31,22,.72),rgba(10,31,22,.55))",
  theme: {
    primary: "#0E2A1E",
    deep: "#0A1F16",
    soft: "#E6EFE9",
    gold: "#C9A84C",
    goldSoft: "#F4E9C9",
    cream: "#F5F1E8",
  },
  geo: { lat: 10.754, lng: 106.6626 },
  stats: [
    { num: "3.956,60m²", lbl: "Tổng diện tích" },
    { num: "348 căn", lbl: "Tổng số căn hộ" },
    { num: "19 tầng", lbl: "Tầng căn hộ" },
    { num: "36", lbl: "Tiện ích nội khu" },
    { num: "Q2/2027", lbl: "Bàn giao" },
    { num: "Lâu dài", lbl: "Sở hữu" },
  ],
  heroH1: "Legacy 66",
  heroSub: "Saigon Luxury Living — Căn Hộ Cao Cấp 66 Tân Thành, Chợ Lớn",
  heroMeta: "CĐT Tân Thành | Quản lý Savills | Bàn giao Quý II/2027 | Sở hữu lâu dài",
  overviewParas: [
    "Legacy 66 là dự án bất động sản cao cấp tọa lạc tại địa chỉ 66 Tân Thành, Phường Chợ Lớn, Thành phố Hồ Chí Minh. Dự án do Công ty TNHH Đầu tư Thương mại Tân Thành làm chủ đầu tư, tổng thầu thi công là Tập đoàn Xây dựng DELTA, đơn vị quản lý vận hành là Savills (thành lập 1855, có mặt tại Việt Nam từ 1995), và đơn vị kinh doanh tiếp thị là Phú Hoàng Land.",
    "Legacy 66 có tổng diện tích đất 3.956,60 m². Cơ cấu công trình gồm 2 tầng hầm, 2 tầng thương mại dịch vụ, 1 tầng để xe hơi trên cao và 19 tầng căn hộ, tích hợp 36 tiện ích nội khu. Tổng số căn hộ và shophouse là 348 đơn vị với 4 loại căn từ 1PN đến 3PN, diện tích 45–95 m².",
    "Thời gian bàn giao dự kiến là Quý II/2027. Căn hộ được cấp sổ hồng sở hữu lâu dài — pháp lý ưu việt nhất cho cả người mua ở thực và nhà đầu tư dài hạn tại trung tâm Chợ Lớn (Quận 5 cũ), TP.HCM.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Legacy 66 (Căn hộ Legacy 66 / Legacy Saigon Luxury Living)" },
    { k: "Địa chỉ", v: "66 Tân Thành, Phường Chợ Lớn, Thành phố Hồ Chí Minh" },
    { k: "Chủ đầu tư", v: "Công ty TNHH Đầu tư Thương mại Tân Thành" },
    { k: "Tổng thầu xây dựng", v: "Công ty TNHH Tập đoàn Xây dựng DELTA" },
    { k: "Quản lý vận hành", v: "Savills (thành lập 1855 — quản lý BĐS hàng đầu thế giới)" },
    { k: "Kinh doanh tiếp thị", v: "Phú Hoàng Land" },
    { k: "Tổng diện tích đất", v: "3.956,60 m²" },
    { k: "Quy mô xây dựng", v: "2 tầng hầm + 2 tầng TM + 1 tầng để xe trên cao + 19 tầng căn hộ" },
    { k: "Tổng số căn", v: "348 căn (căn hộ + shophouse)" },
    { k: "Loại căn hộ", v: "1PN (45–53m²) | 2PN (64–74m²) | 2PN+1 (71–79m²) | 3PN (85–95m²)" },
    { k: "Tiện ích nội khu", v: "36 tiện ích cao cấp" },
    { k: "Bàn giao", v: "Quý II/2027" },
    { k: "Hình thức sở hữu", v: "Lâu dài — sổ hồng" },
  ],
  locationIntro:
    "Legacy 66 tọa lạc tại số 66 Tân Thành, Phường Chợ Lớn, TP.HCM — vị trí tứ giác vàng với 4 mặt giáp đường: Bắc giáp Nguyễn Chí Thanh, Nam giáp Tân Thành, Đông giáp Phó Cơ Điều, Tây giáp Đỗ Ngọc Thạnh. Khu vực Chợ Lớn là trung tâm thương mại sầm uất nhất Sài Gòn với mật độ dân cư cao và hạ tầng tiện ích đầy đủ.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps?q=66+T%C3%A2n+Th%C3%A0nh,+Qu%E1%BA%ADn+5,+H%E1%BB%93+Ch%C3%AD+Minh&output=embed",
  faq: [
    {
      q: "Legacy 66 ở đâu?",
      a: "Legacy 66 tọa lạc tại số 66 Tân Thành, Phường Chợ Lớn, Thành phố Hồ Chí Minh. Khu đất có 4 mặt giáp đường: phía Bắc giáp đường Nguyễn Chí Thanh, phía Nam giáp Tân Thành, phía Đông giáp Phó Cơ Điều và phía Tây giáp Đỗ Ngọc Thạnh.",
    },
    {
      q: "Diện tích Legacy 66 là bao nhiêu?",
      a: "Tổng diện tích khu đất của Legacy 66 là 3.956,60 m². Dự án quy hoạch 2 tầng hầm, 2 tầng thương mại, 1 tầng để xe hơi trên cao và 19 tầng căn hộ, tích hợp 36 tiện ích nội khu.",
    },
    {
      q: "Legacy 66 có bao nhiêu căn hộ?",
      a: "Legacy 66 cung cấp tổng cộng 348 căn, gồm căn hộ ở và shophouse thương mại dịch vụ. Cơ cấu căn hộ đa dạng từ 1 phòng ngủ, 2 phòng ngủ, 2 phòng ngủ + 1 đến 3 phòng ngủ.",
    },
    {
      q: "Giá căn hộ Legacy 66 bao nhiêu?",
      a: "Bảng giá chính thức của Legacy 66 đang được chủ đầu tư Tân Thành và đơn vị kinh doanh Phú Hoàng Land cập nhật. Vui lòng để lại số điện thoại để nhận bảng giá, chính sách thanh toán và phương án vay ngân hàng sớm nhất.",
    },
    {
      q: "Legacy 66 bàn giao khi nào?",
      a: "Theo kế hoạch của chủ đầu tư, Legacy 66 dự kiến bàn giao vào Quý II năm 2027. Tổng thầu thi công là Công ty TNHH Tập đoàn Xây dựng DELTA, đảm bảo tiến độ và chất lượng công trình.",
    },
    {
      q: "Chủ đầu tư Legacy 66 là ai?",
      a: "Chủ đầu tư Legacy 66 là Công ty TNHH Đầu tư Thương mại Tân Thành. Tổng thầu xây dựng là Tập đoàn DELTA, đơn vị quản lý vận hành là Savills, và đơn vị kinh doanh tiếp thị là Phú Hoàng Land.",
    },
    {
      q: "Đơn vị quản lý Legacy 66 là ai?",
      a: "Legacy 66 được quản lý vận hành bởi Savills — tập đoàn quản lý bất động sản hàng đầu thế giới, thành lập năm 1855 và có mặt tại Việt Nam từ năm 1995, đảm bảo chuẩn dịch vụ quốc tế cho cư dân.",
    },
    {
      q: "Legacy 66 có những loại căn hộ nào?",
      a: "Legacy 66 có 4 loại căn: 1 phòng ngủ (45–53m²), 2 phòng ngủ (64–74m²), 2 phòng ngủ + 1 (71–79m²) và 3 phòng ngủ (85–95m²). Ngoài ra còn có shophouse thương mại dịch vụ ở khối đế.",
    },
    {
      q: "Hình thức sở hữu Legacy 66 là gì?",
      a: "Căn hộ Legacy 66 được cấp sổ hồng sở hữu lâu dài (freehold). Đây là pháp lý ưu việt cho cả người mua ở thực và nhà đầu tư dài hạn tại khu vực Chợ Lớn, Quận 5 cũ, TP.HCM.",
    },
    {
      q: "Legacy 66 có tiện ích gì nổi bật?",
      a: "Legacy 66 sở hữu 36 tiện ích nội khu cao cấp gồm hồ bơi, gym, sky lounge, công viên cảnh quan, khu vui chơi trẻ em, co-working, sân yoga, an ninh 24/7. Khối đế 2 tầng thương mại và 1 tầng để xe hơi trên cao tạo nên không gian sống tích hợp đầy đủ.",
    },
  ],
  navLinks: [
    { href: "#tong-quan", label: "Tổng quan" },
    { href: "#vi-tri", label: "Vị trí" },
    { href: "#quy-mo", label: "Quy mô" },
    { href: "#can-ho", label: "Căn hộ" },
    { href: "#faq", label: "FAQ" },
    { href: "#lien-he", label: "Liên hệ" },
  ],
  schemaName: "Legacy 66",
  schemaDev: "Công ty TNHH Đầu tư Thương mại Tân Thành",
  schemaLocality: "66 Tân Thành, Phường Chợ Lớn",
  schemaRegion: "Thành phố Hồ Chí Minh",
  schemaTotalUnits: 348,
  schemaPriceLow: 2_000_000_000,
  schemaPriceHigh: 10_000_000_000,
  schemaAmenities: [
    "36 tiện ích nội khu",
    "2 tầng thương mại dịch vụ",
    "Tầng để xe trên cao",
    "Quản lý vận hành Savills",
    "Sở hữu lâu dài",
  ],
};

// ─────────────────────────────────────────────
// MASTERI COSMO CENTRAL
// ─────────────────────────────────────────────
const MASTERI_COSMO: LandingProject = {
  slug: "masteri-cosmo-central",
  titleFull: "Masteri Cosmo Central — The Global City | Foster + Partners | TP. Thủ Đức 2026",
  titleShort: "Masteri Cosmo Central",
  eyebrow: "Masterise Homes • Foster + Partners • The Global City 117,4ha",
  desc: "Masteri Cosmo Central tại The Global City 117,4ha: 6 tòa tháp 19–29 tầng thiết kế bởi Foster + Partners, giá từ 6,429 tỷ, lãi suất 0%, view kênh đào nhạc nước lớn nhất Đông Nam Á. Tư vấn miễn phí từ SGS Land.",
  keywords: "Masteri Cosmo Central, The Global City, Foster Partners căn hộ, Masterise Homes TP Thủ Đức, căn hộ kênh đào nhạc nước",
  heroImageAlt: "Masteri Cosmo Central — phân khu căn hộ cao cấp tại The Global City 117,4ha, TP. Thủ Đức, thiết kế bởi Foster + Partners",
  heroGradient: "linear-gradient(135deg,rgba(17,28,51,.82),rgba(17,28,51,.50))",
  theme: {
    primary: "#1a2744",
    deep: "#111c33",
    soft: "#eef1f8",
    gold: "#c9a96e",
    goldSoft: "#f5eed8",
    cream: "#f8f6f2",
  },
  geo: { lat: 10.7892, lng: 106.7633 },
  stats: [
    { num: "6", lbl: "Tòa Tháp" },
    { num: "19–29", lbl: "Tầng" },
    { num: "117,4ha", lbl: "Đại Đô Thị" },
    { num: "F+P", lbl: "Foster + Partners" },
    { num: "0%", lbl: "Lãi Suất Hỗ Trợ" },
  ],
  heroH1: "Masteri Cosmo Central",
  heroSub: "Downtown Đẳng Cấp Quốc Tế — Tại Trái Tim The Global City",
  heroMeta: "Đỗ Xuân Hợp, Phường Bình Trưng, TP. Thủ Đức, TP.HCM | Hotline: 0971 132 378",
  overviewParas: [
    "Masteri Cosmo Central là phân khu căn hộ cao cấp thuộc bộ sưu tập Masteri Collection do Masterise Homes — chủ đầu tư hàng đầu Đông Nam Á — phát triển. Dự án tọa lạc tại đường Đỗ Xuân Hợp, phường Bình Trưng, TP. Thủ Đức, ngay lõi trung tâm của đại đô thị The Global City rộng 117,4 ha.",
    "Điểm đặc biệt nhất của Masteri Cosmo Central là Foster + Partners — hãng kiến trúc huyền thoại người Anh, tác giả của Apple Park (Mỹ) và The Gherkin (London) — chịu trách nhiệm thiết kế toàn bộ quy hoạch tổng thể. Đây là bảo chứng về chất lượng quốc tế hiếm có tại thị trường bất động sản Việt Nam. Masterise Homes đạt giải Asia Pacific Enterprise Awards 2025: Corporate Excellence Award và Inspirational Brand Award.",
    "Dự án gồm 6 tòa tháp cao 19–29 tầng, 100% căn hộ có ban công rộng, bố cục hình chữ L & I tối ưu ánh sáng tự nhiên và thông gió hoàn toàn. Tầm nhìn trực diện ra kênh đào nhạc nước lớn nhất Đông Nam Á hoặc City Park. Giá từ 6,429 tỷ đồng với chính sách hỗ trợ lãi suất 0%.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Masteri Cosmo Central (Masteri Collection)" },
    { k: "Đại đô thị", v: "The Global City — 117,4 ha" },
    { k: "Chủ đầu tư", v: "Masterise Homes (Masterise Group)" },
    { k: "Kiến trúc sư", v: "Foster + Partners (Anh Quốc) — tác giả Apple Park, The Gherkin" },
    { k: "Địa chỉ", v: "Đường Đỗ Xuân Hợp, Phường Bình Trưng, TP. Thủ Đức, TP.HCM" },
    { k: "Quy mô", v: "6 tòa tháp, cao 19–29 tầng; 3 tầng khối đế; 2 tầng hầm" },
    { k: "Loại hình", v: "1PN (47–57m²), 1PN+, 2PN, 2PN+, 3PN, 4PN (~119m²), Penthouse, Duplex" },
    { k: "Giá từ", v: "6,429 tỷ đồng" },
    { k: "Lãi suất hỗ trợ", v: "0% từ ngày giải ngân đến 6 tháng sau bàn giao (không vượt 28/03/2029)" },
    { k: "Thanh toán", v: "30% ký HĐMB, ngân hàng giải ngân 70% còn lại" },
    { k: "Giải thưởng CĐT", v: "Asia Pacific Enterprise Awards 2025 — Corporate Excellence & Inspirational Brand" },
  ],
  locationIntro:
    "Masteri Cosmo Central sở hữu vị trí hiếm có tại trái tim The Global City — 4 mặt tiền, giao thoa trục kết nối Liên Phường và kênh đào nhạc nước, cách Quận 1 chỉ 15 phút. Metro số 1 Bến Thành – Suối Tiên kết nối Thảo Điền và Thủ Thiêm trong 5–10 phút.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3918.6!2d106.7633!3d10.7892!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDQ3JzIxLjEiTiAxMDbCsDQ1JzQ3LjkiRQ!5e0!3m2!1svi!2svn!4v1",
  faq: [
    {
      q: "Masteri Cosmo Central là dự án gì?",
      a: "Masteri Cosmo Central là phân khu căn hộ cao cấp thuộc bộ sưu tập Masteri Collection, tọa lạc tại lõi trung tâm đại đô thị The Global City 117,4ha, đường Đỗ Xuân Hợp, phường Bình Trưng, TP. Thủ Đức. Dự án gồm 6 tòa tháp cao 19–29 tầng, thiết kế bởi hãng kiến trúc huyền thoại Foster + Partners (Anh Quốc), đang mở bán theo mô hình All-in-One: Sống – Làm việc – Giải trí. Giá từ 6,429 tỷ.",
    },
    {
      q: "Masteri Cosmo Central ở đâu, địa chỉ cụ thể?",
      a: "Masteri Cosmo Central tọa lạc tại đường Đỗ Xuân Hợp, phường Bình Trưng, TP. Thủ Đức, TP. Hồ Chí Minh — ngay lõi trung tâm của đại đô thị The Global City. Dự án sở hữu 4 mặt tiền hiếm có, tầm nhìn trực diện ra kênh đào nhạc nước lớn nhất Đông Nam Á. Cách Trung tâm Quận 1 khoảng 15 phút di chuyển.",
    },
    {
      q: "Masteri Cosmo Central có bao nhiêu loại căn hộ và diện tích?",
      a: "Masteri Cosmo Central cung cấp đầy đủ loại hình: 1PN (47–57m²), 1PN+, 2PN, 2PN+, 3PN, 4PN (đến ~119m²), Penthouse, Duplex và Penthouse Duplex. 100% căn hộ có ban công rộng mở, tối ưu ánh sáng tự nhiên và view kênh đào nhạc nước hoặc City Park.",
    },
    {
      q: "Chính sách thanh toán Masteri Cosmo Central 2026 như thế nào?",
      a: "Thanh toán 30% khi ký HĐMB, ngân hàng giải ngân 70% còn lại. Hỗ trợ lãi suất 0% từ ngày giải ngân đầu tiên đến hết 6 tháng tính từ ngày đủ điều kiện bàn giao (không vượt quá 28/03/2029). Ngoài ra có ưu đãi cư dân Masterise Homes: chiết khấu 2% cho khách hàng thân thiết.",
    },
    {
      q: "The Global City là gì và quy mô như thế nào?",
      a: "The Global City là đại đô thị quốc tế rộng 117,4ha do Masterise Homes phát triển, thiết kế tổng thể bởi Foster + Partners. Tọa lạc tại TP. Thủ Đức (Quận 2 cũ), TP.HCM, bao gồm: Trung tâm thương mại Lotte Mall 123.000m², kênh đào nhạc nước lớn nhất Đông Nam Á, bệnh viện tiêu chuẩn quốc tế, trường học liên cấp quốc tế, phố thương mại SOHO và nhiều phân khu căn hộ cao cấp.",
    },
    {
      q: "Foster + Partners là ai?",
      a: "Foster + Partners là hãng kiến trúc huyền thoại người Anh, được sáng lập bởi Sir Norman Foster — người đã thiết kế Apple Park (Mỹ), The Gherkin (London) và nhiều công trình biểu tượng toàn cầu. Việc Foster + Partners thiết kế quy hoạch tổng thể The Global City là bảo chứng cho chất lượng quốc tế và giá trị dài hạn của toàn khu đô thị.",
    },
    {
      q: "Masteri Cosmo Central có gần metro không?",
      a: "Có. Masteri Cosmo Central kết nối thuận tiện với tuyến metro số 1 Bến Thành – Suối Tiên. Từ dự án, cư dân có thể di chuyển đến Thảo Điền, Thủ Thiêm trong 5–10 phút và đến Trung tâm Tài chính Quốc tế Thủ Thiêm và Quận 1 trong khoảng 15 phút.",
    },
    {
      q: "Tiện ích nổi bật của Masteri Cosmo Central là gì?",
      a: "Masteri Cosmo Central sở hữu hệ thống tiện ích All-in-One đẳng cấp: hồ bơi vô cực ngoài trời view kênh đào; sảnh đón chuẩn 5 sao tại từng tòa; Gym, Yoga & Thái cực quyền cao cấp; sân Pickleball; Coworking Space & Executive Lounge; khu vui chơi trẻ em sáng tạo; phố SOHO nội khu; kết nối trực tiếp TTTM Lotte Mall 123.000m².",
    },
    {
      q: "Kênh đào nhạc nước tại The Global City lớn đến mức nào?",
      a: "Kênh đào nhạc nước tại The Global City được mệnh danh là lớn nhất Đông Nam Á, là điểm nhấn cảnh quan biểu tượng của toàn đại đô thị. Masteri Cosmo Central tọa lạc ngay sát kênh đào, mang đến tầm nhìn panorama triệu đô từ các căn hộ — lợi thế cảnh quan hiếm có không dự án nào trong khu vực có được.",
    },
    {
      q: "Tại sao nên sở hữu Masteri Cosmo Central?",
      a: "5 lý do hàng đầu: (1) Vị trí lõi Downtown hiếm có tại The Global City — 4 mặt tiền, view kênh đào nhạc nước ĐNA; (2) Thiết kế bởi Foster + Partners — top 5 kiến trúc sư thế giới; (3) Mô hình All-in-One: Sống – Làm việc – Giải trí trong cùng bán kính; (4) Thương hiệu Masterise Homes — bảo chứng thanh khoản & uy tín quốc tế (APEA 2025); (5) Đón đầu điểm rơi hạ tầng Khu Đông với metro, Lotte Mall và đường Liên Phường hoàn thiện.",
    },
  ],
  navLinks: [
    { href: "#tong-quan", label: "Tổng quan" },
    { href: "#vi-tri", label: "Vị trí" },
    { href: "#mat-bang", label: "Căn hộ" },
    { href: "#tien-ich", label: "Tiện ích" },
    { href: "#faq", label: "FAQ" },
    { href: "#lien-he", label: "Liên hệ" },
  ],
  schemaName: "Masteri Cosmo Central",
  schemaDev: "Masterise Homes",
  schemaLocality: "Phường Bình Trưng, TP. Thủ Đức",
  schemaRegion: "Thành phố Hồ Chí Minh",
  schemaPriceLow: 6_429_000_000,
  schemaPriceHigh: 50_000_000_000,
  schemaAmenities: [
    "Hồ bơi vô cực ngoài trời view kênh đào",
    "Sảnh đón chuẩn khách sạn 5 sao",
    "Phòng Gym & Yoga cao cấp",
    "Sân Pickleball",
    "Coworking Space & Executive Lounge",
    "Phố thương mại SOHO nội khu",
    "Kênh đào nhạc nước lớn nhất Đông Nam Á",
    "TTTM Lotte Mall 123.000m²",
    "Bảo vệ 24/7 hệ thống AI",
  ],
};

// ─────────────────────────────────────────────
// VINHOMES HÓC MÔN
// ─────────────────────────────────────────────
const VINHOMES_HOC_MON: LandingProject = {
  slug: "vinhomes-hoc-mon",
  titleFull: "Vinhomes Hóc Môn — Siêu Đô Thị 1.080ha | Vinhomes Vingroup | TP.HCM 2026",
  titleShort: "Vinhomes Hóc Môn",
  eyebrow: "Vinhomes JSC • Tập đoàn Vingroup • Hóc Môn TP.HCM",
  desc: "Vinhomes Hóc Môn: siêu đô thị 1.080ha lớn nhất lịch sử Vinhomes tại Hóc Môn, TP.HCM, do Vinhomes (Vingroup) phát triển. Dự kiến mở bán 2026. Đăng ký nhận thông tin ưu tiên và tư vấn miễn phí từ SGS Land.",
  keywords: "Vinhomes Hóc Môn, Vinhomes Hoc Mon 2026, siêu đô thị Hóc Môn, Vinhomes 1080ha, bất động sản Hóc Môn TP.HCM",
  heroImageAlt: "Vinhomes Hóc Môn — siêu đô thị tích hợp 1.080ha tại huyện Hóc Môn, TP.HCM, phát triển bởi Vinhomes Vingroup",
  heroGradient: "linear-gradient(135deg,rgba(0,61,43,.72),rgba(0,107,63,.82))",
  theme: {
    primary: "#006B3F",
    deep: "#004D2C",
    soft: "#E6F0EB",
    gold: "#C9A84C",
    goldSoft: "#F4E9C9",
    cream: "#F5F0E8",
  },
  geo: { lat: 10.889, lng: 106.598 },
  stats: [
    { num: "1.080ha", lbl: "Tổng diện tích" },
    { num: "6 phân khu", lbl: "Chức năng" },
    { num: "~150.000", lbl: "Cư dân" },
    { num: "20km", lbl: "Từ Quận 1" },
    { num: "Metro #2", lbl: "Kết nối tương lai" },
  ],
  heroH1: "Vinhomes Hóc Môn",
  heroSub: "Siêu Đô Thị Thông Minh 1.080Ha — Cửa Ngõ Tây Bắc TP.HCM",
  heroMeta: "CĐT Vinhomes JSC (Vingroup) | Hóc Môn, TP.HCM | Mở bán 2026 | Hotline: 0971 132 378",
  overviewParas: [
    "Vinhomes Hóc Môn là siêu khu đô thị tích hợp quy mô 1.080 hecta do Vinhomes JSC (thành viên Tập đoàn Vingroup) phát triển tại huyện Hóc Môn, TP.HCM. Đây là dự án lớn nhất trong lịch sử Vinhomes — lớn hơn Vinhomes Grand Park (271ha) khoảng 4 lần, lớn hơn Vinhomes Ocean Park (420ha) khoảng 2,6 lần.",
    "Dự án được định hướng trở thành siêu đô thị thông minh lớn nhất phía Tây Bắc TP.HCM với đầy đủ hệ sinh thái Vingroup khép kín: trường học Vinschool liên cấp, bệnh viện Vinmec, trung tâm thương mại Vincom, trạm sạc xe điện VinFast, công viên 4 mùa và hồ điều hòa. Dự kiến đón ~150.000 cư dân.",
    "Vị trí chiến lược trên trục Quốc lộ 22 — cửa ngõ Tây Bắc TP.HCM kết nối Tây Ninh, Long An và Bình Dương. Cách trung tâm Quận 1 khoảng 20 km và sân bay Tân Sơn Nhất 15 km. Hưởng lợi trực tiếp từ Vành đai 3 TP.HCM và tuyến Metro số 2 (Bến Thành – Tham Lương – Hóc Môn) theo quy hoạch.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Vinhomes Hóc Môn (Siêu Đô Thị Hóc Môn)" },
    { k: "Chủ đầu tư", v: "Công ty Cổ phần Vinhomes (Vinhomes JSC) — Tập đoàn Vingroup" },
    { k: "Địa chỉ", v: "Huyện Hóc Môn, Thành phố Hồ Chí Minh" },
    { k: "Quy mô", v: "1.080 hecta — lớn nhất lịch sử Vinhomes" },
    { k: "Dân cư dự kiến", v: "~150.000 cư dân" },
    { k: "Loại hình sản phẩm", v: "Liền kề (5x10, 5x12, 5x14, 5x15m) • Song lập (8x18, 8x20, 9x18, 9x20m) • Đơn lập (12x18, 12x20m) • Shophouse • Chung cư smart" },
    { k: "Phân khu", v: "6 phân khu chức năng" },
    { k: "Hệ sinh thái", v: "Vinschool, Vinmec, Vincom, VinFast, công viên 4 mùa, hồ điều hòa" },
    { k: "Kết nối", v: "QL22; Vành đai 3; Metro số 2 (Bến Thành – Tham Lương – Hóc Môn)" },
    { k: "Mở bán", v: "Dự kiến các phân khu đầu tiên từ năm 2026" },
    { k: "Bàn giao", v: "Cuốn chiếu 2028–2031 theo từng phân khu" },
    { k: "Sở hữu", v: "Sổ hồng lâu dài (nhà phố, biệt thự, shophouse, căn hộ)" },
  ],
  locationIntro:
    "Vinhomes Hóc Môn tọa lạc tại huyện Hóc Môn, TP.HCM — trên trục Quốc lộ 22 kết nối Tây Ninh, Long An và Bình Dương. Cách trung tâm Quận 1 khoảng 20km (30 phút qua QL22 và Trường Chinh). Khi Vành đai 3 và Metro số 2 hoàn thành, thời gian di chuyển rút ngắn còn 18–22 phút. Hóc Môn nằm trong nhóm 5 huyện được định hướng lên quận giai đoạn 2025–2030.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps?q=Hoc+Mon+Ho+Chi+Minh+City&output=embed",
  faq: [
    {
      q: "Vinhomes Hóc Môn là dự án gì?",
      a: "Vinhomes Hóc Môn là siêu khu đô thị tích hợp quy mô 1.080 hecta do Vinhomes (Tập đoàn Vingroup) phát triển tại huyện Hóc Môn, TP.HCM. Dự án được định hướng trở thành siêu đô thị thông minh lớn nhất phía Tây Bắc TP.HCM với hệ thống nhà phố, biệt thự, shophouse và chung cư cao tầng cho khoảng 150.000 cư dân.",
    },
    {
      q: "Vinhomes Hóc Môn rộng bao nhiêu hecta?",
      a: "Vinhomes Hóc Môn có quy mô 1.080 hecta, lớn hơn Vinhomes Grand Park (271 ha) khoảng 4 lần và lớn hơn Khu đô thị Phú Mỹ Hưng (433 ha) khoảng 2,5 lần. Đây là dự án lớn nhất trong lịch sử Vinhomes tính đến năm 2026.",
    },
    {
      q: "Dự án Vinhomes Hóc Môn ở đâu chính xác?",
      a: "Vinhomes Hóc Môn tọa lạc tại huyện Hóc Môn, Thành phố Hồ Chí Minh, nằm trên trục Quốc lộ 22 — cửa ngõ Tây Bắc TP.HCM kết nối Tây Ninh, Long An và Bình Dương. Dự án cách trung tâm Quận 1 khoảng 20 km và sân bay Tân Sơn Nhất khoảng 15 km.",
    },
    {
      q: "Chủ đầu tư Vinhomes Hóc Môn là ai?",
      a: "Chủ đầu tư Vinhomes Hóc Môn là Công ty Cổ phần Vinhomes (Vinhomes JSC) – thành viên Tập đoàn Vingroup, doanh nghiệp bất động sản hàng đầu Việt Nam thành lập năm 2008, đã phát triển hơn 30 đại đô thị tại nhiều tỉnh thành.",
    },
    {
      q: "Vinhomes Hóc Môn có những phân khu nào?",
      a: "Vinhomes Hóc Môn dự kiến gồm 6 phân khu chức năng chính: nhà phố thương mại, biệt thự đơn lập – song lập, shophouse mặt tiền, chung cư cao tầng smart apartment, khu tiện ích giáo dục – y tế – thương mại, và khu công viên – hồ điều hòa cảnh quan xanh.",
    },
    {
      q: "Giá bán Vinhomes Hóc Môn 2026 là bao nhiêu?",
      a: "Giá Vinhomes Hóc Môn 2026 — Nhà liền kề thô từ 5,4 tỷđ/căn; Giá CDT hoàn thiện từ 6,2 tỷđ/căn. Loại hình: Liền kề (5x10, 5x12, 5x14, 5x15m), Song lập (8x18, 8x20, 9x18, 9x20m), Đơn lập (12x18, 12x20m). SGS LAND tư vấn miễn phí, cập nhật bảng giá mới nhất.",
    },
    {
      q: "Vinhomes Hóc Môn bàn giao năm nào?",
      a: "Theo lộ trình triển khai, Vinhomes Hóc Môn dự kiến mở bán các phân khu đầu tiên từ năm 2026 và bàn giao cuốn chiếu từ 2028–2031 cho từng giai đoạn. Tiến độ chi tiết sẽ được công bố theo từng phân khu khi mở bán chính thức.",
    },
    {
      q: "Từ Vinhomes Hóc Môn đến trung tâm TP.HCM mất bao lâu?",
      a: "Từ Vinhomes Hóc Môn về trung tâm Quận 1 TP.HCM khoảng 20 km, di chuyển khoảng 30 phút qua Quốc lộ 22 và đường Trường Chinh. Khi tuyến Vành đai 3 và Metro số 2 (Bến Thành – Tham Lương – Hóc Môn) hoàn thành, thời gian di chuyển dự kiến rút ngắn còn 18–22 phút.",
    },
    {
      q: "Vinhomes Hóc Môn có gần Metro không?",
      a: "Vinhomes Hóc Môn nằm trong vùng quy hoạch ga cuối tuyến Metro số 2 TP.HCM (Bến Thành – Tham Lương – Hóc Môn). Đây là lợi thế hạ tầng giao thông công cộng quan trọng giúp cư dân kết nối nhanh với trung tâm TP.HCM trong tương lai.",
    },
    {
      q: "Hóc Môn có lên quận không và ảnh hưởng thế nào tới Vinhomes Hóc Môn?",
      a: "Theo đề án quy hoạch của TP.HCM, Hóc Môn nằm trong nhóm 5 huyện được định hướng lên quận hoặc thành phố trực thuộc giai đoạn 2025–2030. Khi Hóc Môn lên quận, giá trị bất động sản trong khu vực, bao gồm Vinhomes Hóc Môn, được dự báo tăng 20–35% nhờ nâng cấp hạ tầng và quy hoạch đô thị.",
    },
    {
      q: "Vinhomes Hóc Môn có Vinschool và Vinmec không?",
      a: "Có. Vinhomes Hóc Môn được phát triển theo mô hình hệ sinh thái Vingroup khép kín, bao gồm trường học liên cấp Vinschool, bệnh viện Vinmec, trung tâm thương mại Vincom và trạm sạc xe điện VinFast ngay trong nội khu, đảm bảo cư dân không cần ra khỏi dự án để sử dụng dịch vụ thiết yếu.",
    },
    {
      q: "Có nên mua Vinhomes Hóc Môn để đầu tư không?",
      a: "Vinhomes Hóc Môn là lựa chọn đầu tư hấp dẫn nhờ ba yếu tố: quy mô 1.080 ha lớn nhất TP.HCM, hưởng lợi trực tiếp từ Vành đai 3 và Metro số 2, cộng với uy tín Vinhomes — các dự án trước (Grand Park, Ocean Park) đã tăng giá 30–50% sau 3 năm. Tuy nhiên nhà đầu tư cần cân đối dòng tiền và kiểm tra pháp lý từng phân khu trước khi xuống tiền.",
    },
    {
      q: "Vinhomes Hóc Môn lớn hơn Vinhomes Grand Park không?",
      a: "Vinhomes Hóc Môn (1.080 ha) lớn hơn Vinhomes Grand Park (271 ha) khoảng 4 lần về diện tích, lớn hơn Vinhomes Ocean Park (420 ha) khoảng 2,6 lần và lớn hơn Vinhomes Smart City (280 ha) khoảng 3,9 lần. Đây là siêu đô thị quy mô lớn nhất từ trước tới nay của Vinhomes.",
    },
    {
      q: "Chính sách vay mua Vinhomes Hóc Môn như thế nào?",
      a: "Vinhomes Hóc Môn dự kiến áp dụng chính sách thanh toán linh hoạt theo chuẩn Vinhomes: chiết khấu 10–18% khi thanh toán nhanh, thanh toán theo tiến độ 24–36 tháng, hỗ trợ vay ngân hàng đối tác như VPBank, Techcombank với lãi suất 0% trong 18–24 tháng đầu và ân hạn nợ gốc 24 tháng.",
    },
    {
      q: "Vinhomes Hóc Môn có pháp lý đầy đủ chưa?",
      a: "Vinhomes Hóc Môn đang trong quá trình hoàn thiện pháp lý theo từng phân khu. Toàn bộ sản phẩm dự kiến cấp sổ hồng lâu dài cho nhà phố, biệt thự, shophouse, và sổ hồng căn hộ cho chung cư — tiêu chuẩn pháp lý nhất quán mà Vinhomes áp dụng cho mọi dự án đại đô thị.",
    },
  ],
  navLinks: [
    { href: "#tong-quan", label: "Tổng quan" },
    { href: "#vi-tri", label: "Vị trí" },
    { href: "#phan-khu", label: "Phân khu" },
    { href: "#tien-ich", label: "Tiện ích" },
    { href: "#faq", label: "FAQ" },
    { href: "#lien-he", label: "Liên hệ" },
  ],
  schemaName: "Vinhomes Hóc Môn",
  schemaDev: "Vinhomes JSC (Tập đoàn Vingroup)",
  schemaLocality: "Huyện Hóc Môn",
  schemaRegion: "Thành phố Hồ Chí Minh",
  schemaAreaHa: 1080,
  schemaAmenities: [
    "Trường học liên cấp Vinschool",
    "Bệnh viện Vinmec",
    "Trung tâm thương mại Vincom",
    "Công viên 4 mùa & hồ điều hòa",
    "Khu thể thao đa năng",
    "Smart home tích hợp & an ninh AI 24/7",
  ],
};

// ─────────────────────────────────────────────
// Export map
// ─────────────────────────────────────────────
export const LANDING_PROJECTS: Record<string, LandingProject> = {
  "aqua-city": AQUA_CITY,
  "legacy-66": LEGACY_66,
  "masteri-cosmo-central": MASTERI_COSMO,
  "vinhomes-hoc-mon": VINHOMES_HOC_MON,
};

export const LANDING_SLUGS = Object.keys(LANDING_PROJECTS);
