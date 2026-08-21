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
  titleFull: "Aqua City Novaland — Thông Tin Dự Án | Đồng Nai",
  titleShort: "Aqua City Novaland",
  eyebrow: "Novaland Group • Đồng Nai • Thông tin tham khảo",
  desc: "Thông tin tham khảo về Aqua City Novaland tại Đồng Nai: vị trí, sản phẩm, phân khu, giá, pháp lý và tiến độ. Dữ liệu giao dịch cần được xác minh theo từng sản phẩm bằng hồ sơ hiện hành.",
  keywords: "Aqua City Novaland, Aqua City giá bao nhiêu, Aqua City 2026, đô thị sinh thái Đồng Nai, sân bay Long Thành bất động sản",
  heroImageAlt: "Toàn cảnh Aqua City Novaland tại Đồng Nai — thông tin vị trí và khu đô thị",
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
    { num: "1.000 ha", lbl: "Quy mô tham khảo" },
    { num: "Cần xác minh", lbl: "Số phân khu" },
    { num: "Theo sản phẩm", lbl: "Tổng sản phẩm" },
    { num: "Theo tuyến", lbl: "Khoảng cách TP.HCM" },
    { num: "Theo hồ sơ", lbl: "Cây xanh & mặt nước" },
    { num: "Theo hồ sơ", lbl: "Cảnh quan tự nhiên" },
  ],
  heroH1: "Aqua City Novaland",
  heroSub: "Aqua City Novaland — Biên Hòa, Đồng Nai",
  heroMeta: "Chủ đầu tư được ghi nhận: Novaland | Giá, pháp lý và tiến độ cần xác minh",
  overviewParas: [
    "Aqua City Novaland được giới thiệu là khu đô thị tại Long Hưng, Biên Hòa, Đồng Nai do Novaland phát triển. Trang này cung cấp thông tin tham khảo để người mua bắt đầu thẩm định entity, vị trí, sản phẩm và hồ sơ dự án.",
    "Các số liệu về quy mô, số phân khu, tổng sản phẩm, tiện ích và vốn đầu tư có thể khác nhau theo tài liệu và thời điểm công bố. Chỉ sử dụng số liệu khi có nguồn, ngày xác minh và phạm vi áp dụng rõ ràng.",
    "Kết nối, khoảng cách và thời gian di chuyển cần được đo theo đúng phân khu, tuyến đường và thời điểm. Hạ tầng dự kiến không phải là bảo đảm về giá, thanh khoản hay lợi nhuận.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Aqua City (Khu đô thị sinh thái Aqua City)" },
    { k: "Chủ đầu tư", v: "Tập đoàn Novaland Group (mã CK: NVL – HOSE)" },
    { k: "Vị trí", v: "Xã Long Hưng, TP. Biên Hòa, Tỉnh Đồng Nai" },
    { k: "Tọa độ GPS", v: "10.9282°N, 106.7992°E" },
    { k: "Quy mô", v: "1.000 ha (tham khảo)" },
    { k: "Số phân khu", v: "Cần đối chiếu hồ sơ dự án hiện hành" },
    { k: "Tổng sản phẩm", v: "Cần đối chiếu hồ sơ dự án hiện hành" },
    { k: "Cây xanh & mặt nước", v: "Cần đối chiếu quy hoạch được công bố" },
    { k: "Hạ tầng kết nối", v: "Đối chiếu bản đồ, tuyến đường và tiến độ thực tế" },
    { k: "Nhà phố", v: "Từ 6 tỷ (giá tham khảo)" },
    { k: "Biệt thự", v: "Từ 8,5 tỷ (giá tham khảo)" },
    { k: "Shophouse", v: "Từ 10 tỷ (giá tham khảo)" },
    { k: "Tư cách phân phối", v: "Yêu cầu xác nhận bằng văn bản trước giao dịch" },
  ],
  locationIntro:
    "Aqua City được giới thiệu tại Long Hưng, Biên Hòa, Đồng Nai. Khoảng cách, thời gian di chuyển, ranh dự án và đặc điểm cảnh quan cần được đối chiếu bằng bản đồ và hồ sơ hiện hành; trang không coi các thông tin quảng bá là bằng chứng độc lập.",
  googleMapsEmbedSrc:
    "https://www.google.com/maps?q=Aqua+City+Novaland+Nhon+Trach+Dong+Nai&output=embed",
  faq: [
    {
      q: "Aqua City là dự án gì?",
      a: "Aqua City Novaland được giới thiệu là khu đô thị tại Long Hưng, Biên Hòa, Đồng Nai do Novaland phát triển. Quy mô, số phân khu, số sản phẩm và tỷ lệ cây xanh cần được đối chiếu với hồ sơ quy hoạch hoặc tài liệu chính thức có ngày cập nhật.",
    },
    {
      q: "Aqua City ở đâu? Địa chỉ cụ thể?",
      a: "Aqua City được giới thiệu tại Long Hưng, Biên Hòa, Đồng Nai. Khoảng cách đến TP.HCM, sân bay hoặc các nút giao phải được đo theo đúng phân khu, tuyến đường và thời điểm; không nên dùng khoảng cách quảng bá thay cho bản đồ và dữ liệu thực tế.",
    },
    {
      q: "Chủ đầu tư Aqua City là ai?",
      a: "Trang hiện ghi Novaland là chủ đầu tư/pháp nhân phát triển Aqua City. Người mua cần đối chiếu tên pháp nhân trong quyết định, hợp đồng và hồ sơ dự án hiện hành; các mô tả về quy mô tập đoàn hoặc số dự án không được xem là chứng cứ pháp lý của sản phẩm.",
    },
    {
      q: "Aqua City có bao nhiêu phân khu và sản phẩm?",
      a: "Aqua City có nhiều tên phân khu và loại sản phẩm được nhắc đến trong tài liệu thị trường. Danh sách, quy mô, tình trạng bàn giao và tiện ích của từng phân khu cần được kiểm tra bằng hồ sơ hiện hành trước khi dùng để so sánh hoặc giao dịch.",
    },
    {
      q: "Pháp lý Aqua City 2026 như thế nào — đã có sổ đỏ chưa?",
      a: "Tình trạng giấy chứng nhận Aqua City có thể khác nhau theo phân khu và sản phẩm. Người mua cần kiểm tra hồ sơ gốc, quy hoạch, thế chấp, nghĩa vụ tài chính, điều kiện cấp giấy và xác nhận bằng văn bản trước khi giao dịch.",
    },
    {
      q: "Giá bán Aqua City 2026 bao nhiêu?",
      a: "Bảng giá tham khảo Aqua City: nhà phố từ 6 tỷ, biệt thự từ 8,5 tỷ và shophouse từ 10 tỷ. Đây là mức giá khởi điểm tham khảo do SGS Land cung cấp, có thể thay đổi theo phân khu, diện tích, pháp lý, điều kiện thanh toán và thời điểm; cần xác nhận bảng giá của đúng sản phẩm trước khi quyết định.",
    },
    {
      q: "Aqua City đã có cư dân sinh sống chưa?",
      a: "Tình trạng cư dân và mức độ vận hành có thể khác nhau theo phân khu. Người mua nên khảo sát thực địa, kiểm tra tỷ lệ bàn giao và hỏi nguồn cư dân hoặc ban quản lý có thể xác minh thay vì suy luận cho toàn dự án.",
    },
    {
      q: "Từ Aqua City đến TP.HCM mất bao lâu?",
      a: "Thời gian từ Aqua City đến TP.HCM phụ thuộc điểm xuất phát, phân khu, tuyến đường, tình trạng giao thông và thời điểm. Hãy kiểm tra bản đồ và thời gian di chuyển thực tế; hạ tầng dự kiến không phải cam kết về thời gian.",
    },
    {
      q: "Aqua City có những tiện ích gì nổi bật?",
      a: "Tiện ích cần được phân loại theo đã vận hành, đang xây dựng và mới nằm trong quy hoạch. Người mua nên kiểm tra danh mục, chủ thể vận hành, thời điểm mở cửa và khả năng tiếp cận của đúng phân khu thay vì chỉ dựa vào danh sách quảng bá.",
    },
    {
      q: "Sân bay Long Thành có ảnh hưởng gì đến Aqua City?",
      a: "Sân bay Long Thành có thể ảnh hưởng đến kết nối khu vực, nhưng thời điểm vận hành, khoảng cách thực tế và tác động lên giá cần được xác minh từ nguồn cơ quan quản lý và dữ liệu giao dịch. Không thể suy ra mức tăng giá cụ thể chỉ từ việc dự án nằm gần sân bay.",
    },
    {
      q: "Có nên mua Aqua City để đầu tư không? Rủi ro là gì?",
      a: "Không có khuyến nghị mua chung cho mọi người. Trước khi cân nhắc Aqua City, cần kiểm tra pháp lý của đúng sản phẩm, giá giao dịch có ngày, tiến độ, thanh khoản, chi phí vay và điều khoản hợp đồng; không nên dựa vào dự báo tăng giá hoặc một tỷ lệ điều chỉnh chưa có nguồn.",
    },
    {
      q: "Cách liên hệ tư vấn Aqua City qua SGS Land?",
      a: "SGS Land cung cấp kênh liên hệ để người dùng yêu cầu thông tin Aqua City. Tư cách phân phối, bảng giá, pháp lý và chính sách phải được xác nhận bằng tài liệu hiện hành; người mua không nên xem nội dung tư vấn là bảo đảm giao dịch hoặc thay thế thẩm định độc lập.",
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
  schemaAmenities: [
    "Tiện ích theo hồ sơ phân khu",
    "Hạ tầng cảnh quan theo tiến độ thực tế",
    "Dịch vụ vận hành cần xác minh",
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
    gold: "var(--sgs-accent)",
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
  titleFull: "Masteri Cosmo Central – Giá & Mặt Bằng Căn Hộ The Global City 2026 | SGS Land",
  titleShort: "Masteri Cosmo Central",
  eyebrow: "Masterise Homes • Foster + Partners • The Global City 117,4ha",
  desc: "Masteri Cosmo Central ở đâu? Căn hộ tại The Global City 117,4ha, TP Thủ Đức – 6 tòa tháp 19-29 tầng do Foster + Partners thiết kế. Loại căn 1PN-4PN, giá từ 6,429 tỷ, lãi suất 0%. ☎ Xem bảng giá & mặt bằng miễn phí từ SGS Land!",
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

const VINHOMES_GRAND_PARK: LandingProject = {
  slug: "vinhomes-grand-park",
  titleFull: "Vinhomes Grand Park TP Thủ Đức 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "Vinhomes Grand Park",
  eyebrow: "Đại đô thị công viên lớn nhất TP.HCM",
  desc: "Vinhomes Grand Park là đại đô thị 271ha của Vingroup tại TP Thủ Đức, quy mô 44.000 sản phẩm, sổ hồng lâu dài, công viên trung tâm 36ha. Cập nhật giá bán, pháp lý 2026.",
  keywords: "Vinhomes Grand Park, Vinhomes Grand Park Thủ Đức, Vinhomes Grand Park Quận 9, giá Vinhomes Grand Park 2026, căn hộ Vinhomes Grand Park, The Beverly, The Origami, The Manhattan Vinhomes Grand Park, mua bán Vinhomes Grand Park",
  heroImageAlt: "Đại đô thị Vinhomes Grand Park với công viên trung tâm 36ha tại phường Long Bình, TP Thủ Đức",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.8419, lng: 106.8347 },
  stats: [
    { num: "271ha", lbl: "Tổng diện tích" },
    { num: "36ha", lbl: "Công viên trung tâm" },
    { num: "8", lbl: "Phân khu chính" },
    { num: "~44.000", lbl: "Căn hộ & sản phẩm thấp tầng" },
    { num: "71", lbl: "Toà căn hộ (25-30 tầng)" },
    { num: "100%", lbl: "Sổ hồng lâu dài" },
  ],
  heroH1: "Vinhomes Grand Park – Đại Đô Thị Công Viên Lớn Nhất TP.HCM",
  heroSub: "Cập nhật mặt bằng phân khu (The Beverly, Glory Heights, The Origami, The Manhattan...), giá bán thứ cấp và tình trạng pháp lý mới nhất 2026 từ SGS Land.",
  heroMeta: "CĐT Vingroup | 271ha | Phường Tăng Nhơn Phú & Long Bình, TP.HCM (Quận 9 cũ)",
  overviewParas: [
    "Vinhomes Grand Park là đại đô thị quy mô 271ha do Tập đoàn Vingroup phát triển, tọa lạc trên đường Nguyễn Xiển, hiện thuộc địa bàn hai phường Tăng Nhơn Phú và Long Bình, TP.HCM (khu vực Quận 9 cũ, TP Thủ Đức trước đợt sáp nhập hành chính 1/7/2025). Dự án khởi công từ năm 2017, mật độ xây dựng khoảng 25%, và là một trong những khu đô thị có quy mô công viên cây xanh lớn nhất khu vực với công viên trung tâm rộng 36ha.",
    "Vinhomes Grand Park được quy hoạch thành 8 phân khu chính gồm The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan và The Manhattan Glory, với tổng cộng 71 toà căn hộ cao 25-30 tầng cùng các sản phẩm thấp tầng (nhà phố, biệt thự). Tổng quy mô sản phẩm toàn dự án theo công bố khoảng 44.000 căn. Phân khu The Rainbow bàn giao sớm nhất từ tháng 6/2020, các phân khu còn lại lần lượt hoàn thiện và bàn giao qua các năm tiếp theo tính đến 2024.",
    "Toàn bộ các phân khu đã bàn giao của Vinhomes Grand Park được cấp sổ hồng sở hữu lâu dài cho người mua trong nước (người nước ngoài sở hữu tối đa 50 năm theo quy định). Về hạ tầng, dự án kết nối thuận tiện tới trung tâm tài chính Thủ Thiêm (khoảng 25 phút), trung tâm TP.HCM (khoảng 30 phút) và sân bay Tân Sơn Nhất (khoảng 55 phút), đồng thời nằm gần tuyến Metro số 1 (Bến Thành - Suối Tiên) và Vành đai 3.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Vinhomes Grand Park" },
    { k: "Chủ đầu tư", v: "Tập đoàn Vingroup (thương hiệu Vinhomes)" },
    { k: "Vị trí", v: "Đường Nguyễn Xiển, phường Tăng Nhơn Phú và Long Bình, TP.HCM (Quận 9 cũ, TP Thủ Đức)" },
    { k: "Toạ độ GPS", v: "10.8419° N, 106.8347° E (tham khảo)" },
    { k: "Quy mô", v: "271ha, mật độ xây dựng ~25%, công viên trung tâm 36ha" },
    { k: "Số phân khu", v: "8 phân khu: The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan, The Manhattan Glory" },
    { k: "Tổng sản phẩm", v: "~44.000 căn hộ và sản phẩm thấp tầng, 71 toà cao 25-30 tầng" },
    { k: "Tình trạng pháp lý", v: "Sổ hồng sở hữu lâu dài (các phân khu đã bàn giao); người nước ngoài sở hữu tối đa 50 năm" },
    { k: "Hạ tầng kết nối", v: "Gần Vành đai 3, tuyến Metro số 1 (Bến Thành - Suối Tiên); cách trung tâm Thủ Thiêm ~25 phút, sân bay Tân Sơn Nhất ~55 phút" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "Vinhomes Grand Park nằm trên đường Nguyễn Xiển, hiện thuộc hai phường Tăng Nhơn Phú và Long Bình, TP.HCM (địa bàn Quận 9 cũ, TP Thủ Đức trước sáp nhập hành chính 1/7/2025). Vị trí này kết nối thuận tiện với Vành đai 3, cao tốc TP.HCM - Long Thành - Dầu Giây và tuyến Metro số 1 (Bến Thành - Suối Tiên), cách trung tâm tài chính Thủ Thiêm khoảng 25 phút và trung tâm TP.HCM khoảng 30 phút di chuyển.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Vinhomes+Grand+Park+Nguyen+Xien+TP+Thu+Duc&output=embed",
  faq: [
    {
      q: "Vinhomes Grand Park là dự án gì, ở đâu?",
      a: "Vinhomes Grand Park là đại đô thị quy mô 271ha do Vingroup phát triển trên đường Nguyễn Xiển, hiện thuộc phường Tăng Nhơn Phú và Long Bình, TP.HCM (Quận 9 cũ). Đây là một trong những khu đô thị có công viên cây xanh lớn nhất TP.HCM với công viên trung tâm rộng 36ha, khởi công từ năm 2017.",
    },
    {
      q: "Vinhomes Grand Park có bao nhiêu phân khu và căn hộ?",
      a: "Dự án gồm 8 phân khu: The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan và The Manhattan Glory, với 71 toà căn hộ cao 25-30 tầng. Tổng quy mô sản phẩm toàn dự án theo công bố khoảng 44.000 căn hộ và sản phẩm thấp tầng.",
    },
    {
      q: "Vinhomes Grand Park đã có sổ hồng chưa?",
      a: "Các phân khu đã bàn giao của Vinhomes Grand Park được cấp sổ hồng sở hữu lâu dài cho người mua trong nước; người nước ngoài được sở hữu tối đa 50 năm theo quy định pháp luật hiện hành. Phân khu The Rainbow bàn giao sớm nhất từ tháng 6/2020 và đã có cư dân ổn định nhiều năm.",
    },
    {
      q: "Giá căn hộ Vinhomes Grand Park hiện nay (2026) khoảng bao nhiêu?",
      a: "Giá tham khảo trên thị trường hiện nay dao động khoảng 45-60 triệu đồng/m² cho phân khúc phổ thông và có thể lên đến 65-70 triệu đồng/m² cho phân khu cao cấp hơn (view công viên, tầng cao), tương đương từ khoảng 2,2-2,6 tỷ đồng/căn cho các loại hình nhỏ. Đây là mức giá tham khảo tổng hợp từ thị trường thứ cấp, biến động theo phân khu, tầng và view cụ thể – vui lòng liên hệ SGS Land để được báo giá cập nhật chính xác nhất.",
    },
    {
      q: "Vinhomes Grand Park đã có cư dân sinh sống chưa?",
      a: "Có. Vinhomes Grand Park đã bàn giao và có cư dân sinh sống ổn định từ nhiều năm, bắt đầu từ phân khu The Rainbow (tháng 6/2020), các phân khu tiếp theo lần lượt hoàn thiện qua các năm đến 2024. Dự án hiện có đầy đủ tiện ích vận hành như trường học Vinschool, bệnh viện Vinmec, trung tâm thương mại Vincom Mega Mall.",
    },
    {
      q: "Vinhomes Grand Park cách trung tâm TP.HCM bao xa?",
      a: "Theo công bố của chủ đầu tư, Vinhomes Grand Park cách trung tâm tài chính Thủ Thiêm khoảng 25 phút di chuyển, cách trung tâm TP.HCM khoảng 30 phút và cách sân bay quốc tế Tân Sơn Nhất khoảng 55 phút, nhờ kết nối với Vành đai 3 và tuyến Metro số 1 (Bến Thành - Suối Tiên) đi qua khu vực lân cận.",
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
  schemaName: "Vinhomes Grand Park",
  schemaDev: "Vingroup (Vinhomes)",
  schemaLocality: "Phường Tăng Nhơn Phú & Long Bình",
  schemaRegion: "TP.HCM",
  schemaAreaHa: 271,
  schemaPriceLow: 2200000000,
  schemaPriceHigh: 7000000000,
  schemaTotalUnits: 44000,
  schemaAmenities: [
    "Công viên trung tâm 36ha, hồ điều hoà cảnh quan",
    "Vincom Mega Mall (lớn nhất miền Nam)",
    "Vinschool liên cấp mầm non - phổ thông",
    "Bệnh viện Vinmec",
    "Hệ thống xe buýt điện Vinbus nội khu",
    "Khu tập luyện golf",
    "Hồ bơi, công viên nước, khu vui chơi trẻ em",
    "An ninh 24/7, quản lý vận hành Vinhomes",
  ],
};
const THE_GLOBAL_CITY: LandingProject = {
  slug: "the-global-city",
  titleFull: "The Global City TP Thủ Đức 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "The Global City",
  eyebrow: "Siêu đô thị trung tâm mới",
  desc: "The Global City là khu đô thị phức hợp 117,4ha của Masterise Homes tại phường Bình Trưng, TP Thủ Đức, cách trung tâm Quận 1 khoảng 7-9km. Cập nhật giá bán, pháp lý, tiến độ 2026.",
  keywords: "The Global City, Masterise Homes, The Global City Thủ Đức, The Global City An Phú, giá bán The Global City 2026, pháp lý The Global City, phường Bình Trưng, căn hộ Thủ Đức",
  heroImageAlt: "Phối cảnh tổng thể khu đô thị The Global City Masterise Homes tại phường Bình Trưng, TP Thủ Đức",
  heroGradient: "linear-gradient(rgba(6,48,31,.72),rgba(6,48,31,.55))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.7945, lng: 106.7478 },
  stats: [
    { num: "117,4ha", lbl: "Tổng diện tích" },
    { num: "~10.000+", lbl: "Căn hộ & thấp tầng (tham khảo)" },
    { num: "5", lbl: "Phân khu chức năng" },
    { num: "70%", lbl: "Khối lượng hoàn thành (đầu 2026)" },
    { num: "7-9km", lbl: "Tới trung tâm Quận 1" },
    { num: "110-142tr/m²", lbl: "Giá sơ cấp căn hộ (tham khảo)" },
  ],
  heroH1: "The Global City – Khu đô thị phức hợp trung tâm mới của Masterise Homes tại TP Thủ Đức",
  heroSub: "Dự án quy mô 117,4ha trên trục Đỗ Xuân Hợp – Song Hành – Liên Phường, phường Bình Trưng, TP Thủ Đức, do Masterise Homes phát triển, thiết kế quy hoạch bởi Foster + Partners.",
  heroMeta: "CĐT Masterise Homes | 117,4ha | Phường Bình Trưng, TP Thủ Đức (khu An Phú cũ)",
  overviewParas: [
    "The Global City là khu đô thị phức hợp (mixed-use) quy mô 117,4ha do Masterise Homes làm chủ đầu tư, tọa lạc trên trục đường Đỗ Xuân Hợp – Song Hành – Liên Phường, hiện thuộc phường Bình Trưng, TP Thủ Đức, TP.HCM (trước sáp nhập hành chính 1/7/2025, khu vực này thuộc phường An Phú, Quận 2 cũ). Dự án khởi công tháng 3/2021, do đơn vị quy hoạch kiến trúc Foster + Partners (Anh) và tư vấn cảnh quan WATG thực hiện.",
    "Theo quy hoạch, The Global City gồm khoảng 5 phân khu chức năng chính: khu thấp tầng SOHO (nhà phố thương mại, đã bàn giao và cấp sổ hồng), khu công viên trung tâm City Park (khoảng 13ha, vận hành từ tháng 3/2024), khu villas/mansion cao cấp (Villa SOLA), cùng các cụm tháp căn hộ cao tầng đang triển khai như Masteri Grand View, Lumiere Midtown, Masteri Park Place, Masteri Cosmo Central. Theo một số nguồn tổng hợp, quy mô sản phẩm toàn dự án vào khoảng 10.000 căn hộ cùng hơn 1.000 sản phẩm thấp tầng (biệt thự, nhà phố, shophouse); mật độ xây dựng khoảng 28%.",
    "Tính đến đầu năm 2026, dự án đã hoàn thành khoảng 70% khối lượng tổng thể theo ghi nhận từ các đơn vị phân phối: toàn bộ khu SOHO (hơn 400 căn nhà phố thương mại) đã bàn giao và cấp sổ hồng, tòa Masteri Grand View đang trong giai đoạn hoàn thiện để bàn giao cuối 2026, các tòa Lumiere Midtown, Masteri Park Place, Masteri Cosmo Central đang trong giai đoạn thi công phần thô/móng. Hạ tầng nội khu (khoảng 30 tuyến đường, điện ngầm, cấp thoát nước, cảnh quan) đã cơ bản hoàn thiện.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "The Global City" },
    { k: "Chủ đầu tư", v: "Masterise Homes (thành viên Masterise Group)" },
    { k: "Vị trí", v: "Đường Đỗ Xuân Hợp – Song Hành – Liên Phường, phường Bình Trưng, TP Thủ Đức, TP.HCM (khu An Phú cũ, Quận 2 trước đây)" },
    { k: "Toạ độ GPS", v: "10.7945° N, 106.7478° E (khu vực trung tâm dự án, tham khảo)" },
    { k: "Quy mô", v: "117,4ha (khoảng 1.174.220 m²)" },
    { k: "Số phân khu/sản phẩm", v: "5 phân khu chức năng: SOHO, City Park, khu tháp căn hộ cao tầng, khu villas/mansion (Villa SOLA), khu thương mại - dịch vụ" },
    { k: "Tổng sản phẩm", v: "Theo một số nguồn tổng hợp: khoảng 10.000 căn hộ và hơn 1.000 sản phẩm thấp tầng (biệt thự, nhà phố, shophouse) – số liệu tham khảo, chưa có công bố chính thức thống nhất" },
    { k: "Hạ tầng kết nối", v: "Nút giao An Phú (cách ~1km), cao tốc TP.HCM – Long Thành – Dầu Giây, Xa Lộ Hà Nội, hầm Thủ Thiêm, gần ga Rạch Chiếc – tuyến Metro số 1 Bến Thành – Suối Tiên (đã vận hành từ cuối 2024)" },
    { k: "Tổng vốn đầu tư", v: "Chưa công bố chính thức bởi chủ đầu tư" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "The Global City nằm trên trục Đỗ Xuân Hợp – Song Hành – Liên Phường, hiện thuộc phường Bình Trưng, TP Thủ Đức (địa bàn An Phú, Quận 2 cũ trước sáp nhập hành chính 1/7/2025), tiếp giáp sông Rạch Chiếc, gần khu đô thị Sala, Saigon Sports City và Thảo Điền. Từ dự án di chuyển tới trung tâm Quận 1 khoảng 7-9km qua Mai Chí Thọ và hầm Thủ Thiêm, đồng thời tiếp cận thuận tiện cao tốc TP.HCM – Long Thành – Dầu Giây, Xa Lộ Hà Nội và ga Rạch Chiếc thuộc tuyến Metro số 1 (Bến Thành – Suối Tiên).",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=The+Global+City+%C4%90%E1%BB%97+Xu%C3%A2n+H%E1%BB%A3p+Ph%C6%B0%E1%BB%9Dng+B%C3%ACnh+Tr%C6%B0ng+TP+Th%E1%BB%A7+%C4%90%E1%BB%A9c&output=embed",
  faq: [
    {
      q: "The Global City là dự án gì, ở đâu?",
      a: "The Global City là khu đô thị phức hợp quy mô 117,4ha do Masterise Homes phát triển, nằm trên trục Đỗ Xuân Hợp – Song Hành – Liên Phường, hiện thuộc phường Bình Trưng, TP Thủ Đức, TP.HCM (địa bàn An Phú, Quận 2 cũ trước sáp nhập 1/7/2025). Dự án khởi công tháng 3/2021 với quy hoạch kiến trúc do Foster + Partners thực hiện.",
    },
    {
      q: "The Global City có quy mô và bao nhiêu phân khu?",
      a: "Dự án có tổng diện tích 117,4ha, chia thành khoảng 5 phân khu chức năng gồm khu thấp tầng SOHO, công viên trung tâm City Park (~13ha), khu villas/mansion cao cấp và các cụm tháp căn hộ cao tầng như Masteri Grand View, Lumiere Midtown, Masteri Park Place, Masteri Cosmo Central. Theo một số nguồn tổng hợp, tổng số sản phẩm toàn dự án vào khoảng 10.000 căn hộ và hơn 1.000 sản phẩm thấp tầng, tuy nhiên con số này có thể thay đổi theo từng giai đoạn mở bán.",
    },
    {
      q: "Pháp lý The Global City hiện nay như thế nào, đã có sổ hồng chưa?",
      a: "Khu thấp tầng SOHO của The Global City đã được bàn giao và cấp sổ hồng cho các sản phẩm hoàn thành. Người Việt Nam sở hữu vĩnh viễn, người nước ngoài sở hữu tối đa 50 năm theo quy định pháp luật hiện hành (Luật Nhà ở 2023, Luật Đất đai 2024, Luật Kinh doanh bất động sản 2023). Các phân khu căn hộ cao tầng đang thi công sẽ được cấp sổ theo tiến độ bàn giao thực tế từng đợt.",
    },
    {
      q: "Giá bán The Global City hiện nay khoảng bao nhiêu?",
      a: "Giá sơ cấp căn hộ tham khảo theo bảng giá chủ đầu tư/đại lý cập nhật khoảng 110-142 triệu đồng/m² (2026), tùy vị trí và phân khu. Trên thị trường thứ cấp, giá tham khảo theo loại hình: căn 1 phòng ngủ khoảng 6,19-7,4 tỷ đồng, 2 phòng ngủ khoảng 7,89-9,89 tỷ đồng, 3 phòng ngủ khoảng 11,14-17,38 tỷ đồng; một số ghi nhận cho thấy giá thứ cấp đã điều chỉnh giảm so với 1 năm trước. Đây là mức giá tham khảo tổng hợp từ thị trường, không phải giá niêm yết chính thức, khách hàng nên liên hệ SGS Land để được báo giá cập nhật theo từng thời điểm.",
    },
    {
      q: "Tiến độ bàn giao và dân cư hiện tại của The Global City ra sao?",
      a: "Tính đến đầu năm 2026, dự án đã hoàn thành khoảng 70% khối lượng tổng thể: khu SOHO đã bàn giao và đi vào hoạt động (khoảng 80% mặt bằng thương mại đã kinh doanh), công viên City Park vận hành từ tháng 3/2024. Tòa căn hộ Masteri Grand View đang hoàn thiện, dự kiến bàn giao cuối năm 2026; các tòa còn lại (Lumiere Midtown, Masteri Park Place, Masteri Cosmo Central) đang trong giai đoạn thi công phần thô, dự kiến bàn giao các năm tiếp theo.",
    },
    {
      q: "The Global City cách trung tâm TP.HCM (Quận 1) bao xa?",
      a: "The Global City cách trung tâm Quận 1 khoảng 7-9km, di chuyển qua trục Mai Chí Thọ và hầm Thủ Thiêm mất khoảng 15-20 phút bằng ô tô/xe máy tùy thời điểm. Dự án cũng nằm gần nút giao An Phú, cao tốc TP.HCM – Long Thành – Dầu Giây và ga Rạch Chiếc thuộc tuyến Metro số 1 (Bến Thành – Suối Tiên).",
    },
    {
      q: "Vì sao nên tìm hiểu The Global City qua SGS Land?",
      a: "SGS Land là đơn vị tư vấn bất động sản có kinh nghiệm cập nhật giá bán, chính sách bán hàng và pháp lý thực tế tại The Global City theo từng thời điểm, giúp khách hàng đối chiếu thông tin từ chủ đầu tư và thị trường thứ cấp trước khi quyết định giao dịch. Liên hệ hotline 0971 132 378 để được tư vấn chi tiết và cập nhật bảng giá mới nhất.",
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
  schemaName: "The Global City",
  schemaDev: "Masterise Homes",
  schemaLocality: "Phường Bình Trưng, TP.HCM",
  schemaRegion: "TP.HCM",
  schemaAreaHa: 117.4,
  schemaPriceLow: 6190000000,
  schemaPriceHigh: 17380000000,
  schemaTotalUnits: 10000,
  schemaAmenities: [
    "Công viên trung tâm City Park (~13ha)",
    "Nhạc nước ngoài trời quy mô lớn",
    "Trung tâm thương mại khối đế và phố thương mại SOHO",
    "The Global Golf Academy & Club (~92ha, sân tập/sân golf tiêu chuẩn)",
    "Hệ thống trường học liên cấp quốc tế",
    "Quảng trường sự kiện, khu vui chơi giải trí (Daddy Cool)",
    "Đường dạo ven kênh, mảng xanh cảnh quan",
    "Hệ thống hạ tầng nội khu, điện ngầm, an ninh smart city",
  ],
};
const IZUMI_CITY: LandingProject = {
  slug: "izumi-city",
  titleFull: "Izumi City Biên Hòa Đồng Nai 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "Izumi City Biên Hòa",
  eyebrow: "Khu đô thị ven sông chuẩn Nhật Bản – Nam Long Group",
  desc: "Izumi City Biên Hòa: KĐT 170ha của Nam Long & Hankyu Hanshin (Nhật), 9 phân khu, ~13.500 sản phẩm, sổ hồng lâu dài, cách TP.HCM 20 phút. Giá bán, pháp lý 2026.",
  keywords: "Izumi City, Izumi City Biên Hòa, Izumi City Nam Long, bất động sản Đồng Nai, nhà đất Biên Hòa, khu đô thị Biên Hòa, dự án Nam Long Đồng Nai, mua bán nhà phố Izumi City, biệt thự Izumi City, giá Izumi City 2026, Long Hưng Biên Hòa, đất nền Đồng Nai",
  heroImageAlt: "Phối cảnh khu đô thị Izumi City ven sông Đồng Nai, phường Long Hưng, TP. Biên Hòa",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.9264, lng: 106.8931 },
  stats: [
    { num: "170 ha", lbl: "Tổng quy mô dự án" },
    { num: "9", lbl: "Phân khu quy hoạch" },
    { num: "~13.500", lbl: "Sản phẩm toàn dự án" },
    { num: "5,5 km", lbl: "Mặt tiền sông Đồng Nai" },
    { num: "~25.000", lbl: "Dân số quy hoạch (người)" },
    { num: "~20 phút", lbl: "Tới TP.HCM / sân bay Long Thành (theo CĐT)" },
  ],
  heroH1: "Izumi City Biên Hòa – Khu Đô Thị Ven Sông Chuẩn Nhật Bản Của Nam Long",
  heroSub: "Cập nhật giá bán, mặt bằng phân khu, pháp lý sổ hồng và tiến độ bàn giao mới nhất 2026 từ SGS LAND; các thông tin cần được đối chiếu theo sản phẩm và tài liệu hiện hành.",
  heroMeta: "170ha · 9 phân khu · ~13.500 sản phẩm · Phường Long Hưng, TP. Biên Hòa, Đồng Nai",
  overviewParas: [
    "Izumi City là khu đô thị phức hợp quy mô 170ha do Tập đoàn Nam Long làm chủ đầu tư chính, liên doanh cùng Hankyu Hanshin Properties Corp (Nhật Bản) thông qua Công ty TNHH Thành Phố Waterfront Đồng Nai (Nam Long góp 65,1%, Hankyu Hanshin góp 34,9%), tọa lạc tại giao lộ đường Hương Lộ 2 và Nam Cao, phường Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai. Dự án được công bố hợp tác từ năm 2021 với tổng vốn đầu tư khoảng 18.600 tỷ đồng và khởi công xây dựng ngay sau đó.",
    "Theo quy hoạch, Izumi City chia thành 9 phân khu với khoảng 13.500 sản phẩm gồm nhà phố, shophouse, biệt thự song lập, biệt thự đơn lập và dòng biệt thự ven sông cao cấp (Izumi Riverside, Izumi Canaria), phục vụ quy mô dân số dự kiến khoảng 25.000 người. Dự án dành khoảng 21ha cho mảng xanh, 9ha thương mại, 7ha giáo dục, 6ha mặt nước và sở hữu 5,5km mặt tiền sông Đồng Nai, cùng trục thương mại – dịch vụ dài khoảng 2,3km chạy dọc dự án.",
    "Về pháp lý, các sản phẩm nhà liền thổ tại các giai đoạn đã hoàn thiện hạ tầng được công bố cấp sổ hồng/sổ đỏ sở hữu lâu dài theo từng nền. Giai đoạn 1A1, 1A2 đã bàn giao nhà từ tháng 10/2023 và cư dân đã vào ở, trong khi phân khu Izumi Canaria (thuộc Izumi Riverside) đang trong giai đoạn mở bán, nhận giữ chỗ năm 2025–2026. Dự án kết nối trực tiếp cao tốc TP.HCM – Long Thành – Dầu Giây, Quốc lộ 51, Vành đai 3 và theo công bố của chủ đầu tư chỉ cách trung tâm TP.HCM cũng như sân bay quốc tế Long Thành khoảng 20 phút di chuyển.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Izumi City (Khu đô thị Izumi City / Waterfront City)" },
    { k: "Chủ đầu tư", v: "Tập đoàn Nam Long, liên doanh Hankyu Hanshin Properties Corp (Nhật Bản) qua Công ty TNHH Thành Phố Waterfront Đồng Nai" },
    { k: "Vị trí", v: "Giao lộ Hương Lộ 2 – Nam Cao, phường Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai" },
    { k: "Toạ độ GPS", v: "10.9264° N, 106.8931° E (tham khảo, khu vực phường Long Hưng)" },
    { k: "Quy mô", v: "170 ha (21ha cây xanh, 9ha thương mại, 7ha giáo dục, 6ha mặt nước, 5,5km mặt sông Đồng Nai)" },
    { k: "Số phân khu / sản phẩm", v: "9 phân khu, khoảng 13.500 sản phẩm (nhà phố, shophouse, biệt thự song lập/đơn lập, biệt thự ven sông)" },
    { k: "Tổng sản phẩm", v: "~13.500 căn, quy hoạch dân số khoảng 25.000 người" },
    { k: "Hạ tầng kết nối", v: "Cao tốc TP.HCM – Long Thành – Dầu Giây, Quốc lộ 51, Vành đai 3, cách sân bay Long Thành và trung tâm TP.HCM ~20 phút di chuyển (công bố CĐT)" },
    { k: "Tổng vốn đầu tư", v: "Khoảng 18.600 tỷ đồng (công bố hợp tác Nam Long – Hankyu Hanshin 2021)" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "Izumi City nằm tại phường Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai – khu vực ven sông Đồng Nai tiếp giáp nhiều tuyến giao thông huyết mạch như cao tốc TP.HCM – Long Thành – Dầu Giây, Quốc lộ 51 và Vành đai 3, tạo lợi thế kết nối nhanh về trung tâm TP.HCM, khu vực Nhơn Trạch và sân bay quốc tế Long Thành đang được xây dựng. Vị trí ven sông cũng cho phép cư dân di chuyển đường thủy bằng tàu cao tốc về khu vực Bạch Đằng, Quận 1.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Izumi+City+Nam+Long+Long+Hung+Bien+Hoa+Dong+Nai&output=embed",
  faq: [
    {
      q: "Izumi City là dự án gì?",
      a: "Izumi City là khu đô thị phức hợp ven sông quy mô 170ha tại phường Long Hưng, TP. Biên Hòa, Đồng Nai, do Tập đoàn Nam Long làm chủ đầu tư chính, liên doanh cùng Hankyu Hanshin Properties Corp (Nhật Bản). Dự án gồm nhà phố, shophouse, biệt thự và các tiện ích nội khu tích hợp giáo dục, thương mại, y tế và mảng xanh ven sông.",
    },
    {
      q: "Izumi City có quy mô và bao nhiêu phân khu?",
      a: "Izumi City được quy hoạch thành 9 phân khu với khoảng 13.500 sản phẩm trên tổng diện tích 170ha, trong đó có 21ha cây xanh, 9ha thương mại, 7ha giáo dục, 6ha mặt nước và 5,5km mặt tiền sông Đồng Nai, phục vụ dân số dự kiến khoảng 25.000 người.",
    },
    {
      q: "Pháp lý Izumi City hiện nay ra sao, đã có sổ hồng chưa?",
      a: "Theo công bố của chủ đầu tư và các đại lý phân phối, các sản phẩm nhà liền thổ thuộc các giai đoạn đã hoàn thiện hạ tầng của Izumi City được cấp sổ hồng/sổ đỏ sở hữu lâu dài riêng từng nền. Tuy nhiên tình trạng pháp lý có thể khác nhau theo từng phân khu và giai đoạn, khách hàng nên yêu cầu kiểm tra hồ sơ pháp lý cụ thể của từng căn/nền trước khi giao dịch.",
    },
    {
      q: "Giá bán Izumi City hiện nay (2026) khoảng bao nhiêu?",
      a: "Giá tham khảo (biến động theo nguồn, thời điểm và vị trí lô) cho nhà phố khoảng 6,4–9 tỷ đồng/căn, biệt thự song lập khoảng 12–14,3 tỷ đồng, biệt thự đơn lập từ 16 tỷ đồng, và biệt thự ven sông thuộc phân khu Izumi Riverside/Canaria từ 20 tỷ đến trên 45 tỷ đồng tùy vị trí. Đây là mức giá tham khảo tổng hợp từ thị trường, không phải bảng giá chính thức của chủ đầu tư – vui lòng liên hệ SGS Land để được báo giá và chính sách bán hàng cập nhật theo từng đợt mở bán.",
    },
    {
      q: "Izumi City đã bàn giao nhà và có dân ở chưa?",
      a: "Có, các giai đoạn 1A1 và 1A2 của Izumi City đã bàn giao nhà từ tháng 10/2023 và hiện đã có cư dân sinh sống. Các phân khu mới hơn như Izumi Canaria (thuộc Izumi Riverside) đang trong giai đoạn mở bán, nhận giữ chỗ và xây dựng năm 2025–2026.",
    },
    {
      q: "Izumi City cách trung tâm TP.HCM và sân bay Long Thành bao xa?",
      a: "Theo công bố của chủ đầu tư, Izumi City cách trung tâm TP.HCM và sân bay quốc tế Long Thành khoảng 20 phút di chuyển nhờ kết nối trực tiếp với cao tốc TP.HCM – Long Thành – Dầu Giây và Quốc lộ 51; thời gian thực tế có thể thay đổi tùy điều kiện giao thông và tiến độ hoàn thiện hạ tầng khu vực.",
    },
    {
      q: "Ai là chủ đầu tư Izumi City?",
      a: "Chủ đầu tư chính là Tập đoàn Nam Long, hợp tác cùng Hankyu Hanshin Properties Corp đến từ Nhật Bản thông qua pháp nhân dự án là Công ty TNHH Thành Phố Waterfront Đồng Nai, với tỷ lệ góp vốn Nam Long 65,1% và Hankyu Hanshin 34,9% theo công bố hợp tác năm 2021.",
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
  schemaName: "Izumi City",
  schemaDev: "Nam Long Group (liên doanh Hankyu Hanshin Properties Corp – Nhật Bản)",
  schemaLocality: "Phường Long Hưng",
  schemaRegion: "Tỉnh Đồng Nai",
  schemaAreaHa: 170,
  schemaPriceLow: 6400000000,
  schemaPriceHigh: 45000000000,
  schemaTotalUnits: 13500,
  schemaAmenities: [
    "Trục thương mại – shophouse ven sông dài 2,3km",
    "Công viên cây xanh & đường dạo bộ ven sông Đồng Nai",
    "Trường học liên cấp trong nội khu",
    "Trung tâm thương mại, khu mua sắm",
    "Bến du thuyền / bến tàu ven sông",
    "Hồ bơi, sân thể thao đa năng (tennis, gym)",
    "Cơ sở y tế, phòng khám đạt chuẩn",
    "Không gian văn hoá, quảng trường cộng đồng",
  ],
};
const VINHOMES_CENTRAL_PARK: LandingProject = {
  slug: "vinhomes-central-park",
  titleFull: "Vinhomes Central Park Bình Thạnh 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "Vinhomes Central Park",
  eyebrow: "Khu đô thị ven sông cạnh Landmark 81",
  desc: "Vinhomes Central Park là khu đô thị phức hợp ven sông Sài Gòn tại Bình Thạnh, cạnh tòa Landmark 81, đã bàn giao và cấp sổ hồng toàn bộ. Cập nhật giá thứ cấp, pháp lý 2026.",
  keywords: "Vinhomes Central Park, Vinhomes Central Park Bình Thạnh, căn hộ Vinhomes Central Park, Landmark 81, giá Vinhomes Central Park 2026, bán căn hộ Vinhomes Central Park, cho thuê Vinhomes Central Park, Nguyễn Hữu Cảnh",
  heroImageAlt: "Khu đô thị Vinhomes Central Park ven sông Sài Gòn cạnh tòa Landmark 81, Bình Thạnh, TP.HCM",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.7947, lng: 106.7218 },
  stats: [
    { num: "~43,9ha", lbl: "Tổng diện tích" },
    { num: "14ha", lbl: "Công viên trung tâm" },
    { num: "10+", lbl: "Phân khu (Park 1-8, Landmark...)" },
    { num: "10.000+", lbl: "Căn hộ đã bàn giao" },
    { num: "100%", lbl: "Đã cấp sổ hồng" },
    { num: "~3km", lbl: "Tới trung tâm Quận 1" },
  ],
  heroH1: "Vinhomes Central Park – Khu Đô Thị Ven Sông Sài Gòn Cạnh Landmark 81",
  heroSub: "Dự án đã hoàn thiện, bàn giao và cấp sổ hồng toàn bộ từ nhiều năm nay – cập nhật giá thứ cấp, tình trạng pháp lý và chính sách cho thuê mới nhất từ SGS Land.",
  heroMeta: "CĐT Vingroup/Vinhomes | ~43,9ha | Đường Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM",
  overviewParas: [
    "Vinhomes Central Park là khu đô thị phức hợp ven sông Sài Gòn quy mô khoảng 43,9ha do Tập đoàn Vingroup phát triển, tọa lạc tại số 208 Nguyễn Hữu Cảnh, phường Bình Thạnh (khu vực còn gọi theo tên cũ là phường 22, sau đó là Thạnh Mỹ Tây), Bình Thạnh, TP.HCM. Dự án được khởi công từ năm 2015, bàn giao các phân khu đầu tiên từ năm 2017-2018 và hiện đã hoàn thiện toàn bộ, là một trong những khu đô thị cao cấp ổn định và có dân cư đông đúc lâu năm nhất khu trung tâm TP.HCM.",
    "Dự án gồm khoảng 10 phân khu chính mang tên Park 1 đến Park 8, Landmark Plus và cụm căn hộ hạng sang The Landmark tại chân tòa Landmark 81 (tòa nhà cao nhất Việt Nam, 461m, 81 tầng, do Vinhomes phát triển đồng bộ trong quần thể). Tổng số căn hộ toàn dự án theo các nguồn tổng hợp vào khoảng 10.000-12.000 căn, cùng khối đế thương mại Vincom Center Landmark 81 và nhiều tiện ích nội khu. Vì đã bàn giao và có dân cư ổn định từ lâu, thị trường Vinhomes Central Park hiện chủ yếu là giao dịch thứ cấp (mua bán lại, cho thuê) thay vì mở bán sơ cấp từ chủ đầu tư.",
    "Toàn bộ các phân khu đã hoàn thiện của Vinhomes Central Park đã được cấp Giấy chứng nhận quyền sở hữu (sổ hồng) cho cư dân, đây là một trong những điểm khác biệt lớn so với các dự án đang xây dựng vì người mua có thể sang tên, thế chấp ngân hàng ngay. Dự án nằm sát trung tâm Quận 1 (khoảng 3km qua cầu Sài Gòn hoặc đường Nguyễn Hữu Cảnh - Điện Biên Phủ), thuận tiện di chuyển vào khu trung tâm hành chính - tài chính thành phố.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Vinhomes Central Park" },
    { k: "Chủ đầu tư", v: "Tập đoàn Vingroup (thương hiệu Vinhomes)" },
    { k: "Vị trí", v: "208 Nguyễn Hữu Cảnh, phường Bình Thạnh, TP.HCM (ven sông Sài Gòn, cạnh tòa Landmark 81)" },
    { k: "Toạ độ GPS", v: "10.7947° N, 106.7218° E (tham khảo)" },
    { k: "Quy mô", v: "~43,9ha, trong đó 14ha công viên trung tâm ven sông" },
    { k: "Số phân khu", v: "~10 phân khu: Park 1-8, Landmark Plus, The Landmark (căn hộ hạng sang chân tòa Landmark 81)" },
    { k: "Tổng sản phẩm", v: "Theo các nguồn tổng hợp: khoảng 10.000-12.000 căn hộ (số liệu tham khảo, dự án đã bàn giao toàn bộ)" },
    { k: "Tình trạng pháp lý", v: "Đã cấp sổ hồng toàn bộ các phân khu đã bàn giao" },
    { k: "Hạ tầng kết nối", v: "Cầu Sài Gòn, đường Nguyễn Hữu Cảnh - Điện Biên Phủ, cách trung tâm Quận 1 khoảng 3km" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "Vinhomes Central Park nằm ven sông Sài Gòn trên đường Nguyễn Hữu Cảnh, Bình Thạnh, ngay cạnh tòa Landmark 81 – công trình cao nhất Việt Nam. Vị trí này chỉ cách trung tâm Quận 1 khoảng 3km, kết nối trực tiếp qua cầu Sài Gòn và trục Điện Biên Phủ - Nguyễn Hữu Cảnh, thuận tiện di chuyển tới khu trung tâm tài chính - thương mại và Thảo Điền, Quận 2 cũ.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Vinhomes+Central+Park+Nguyen+Huu+Canh+Binh+Thanh+TP+HCM&output=embed",
  faq: [
    {
      q: "Vinhomes Central Park là dự án gì, ở đâu?",
      a: "Vinhomes Central Park là khu đô thị phức hợp ven sông Sài Gòn quy mô ~43,9ha do Vingroup phát triển, tọa lạc tại 208 Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM, ngay cạnh tòa Landmark 81. Dự án đã hoàn thiện và bàn giao toàn bộ từ nhiều năm nay, hiện là khu dân cư cao cấp ổn định gần trung tâm Quận 1.",
    },
    {
      q: "Vinhomes Central Park có bao nhiêu phân khu và căn hộ?",
      a: "Dự án gồm khoảng 10 phân khu chính: Park 1 đến Park 8, Landmark Plus và The Landmark (căn hộ hạng sang tại chân tòa Landmark 81). Theo các nguồn tổng hợp, tổng số căn hộ toàn dự án vào khoảng 10.000-12.000 căn – đây là số liệu tham khảo vì dự án đã bàn giao từ lâu và không còn công bố chính thức mới từ chủ đầu tư.",
    },
    {
      q: "Vinhomes Central Park đã có sổ hồng chưa?",
      a: "Có. Toàn bộ các phân khu đã bàn giao của Vinhomes Central Park đã được cấp sổ hồng (Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà) cho cư dân, cho phép mua bán, sang tên và thế chấp ngân hàng bình thường như một tài sản đã hoàn thiện pháp lý.",
    },
    {
      q: "Giá căn hộ Vinhomes Central Park hiện nay (2026) khoảng bao nhiêu?",
      a: "Vì dự án đã bàn giao và không còn mở bán sơ cấp, giá hiện tại chủ yếu là giá thứ cấp trên thị trường, biến động theo phân khu, tầng, view (view sông/view công viên/view nội khu) và tình trạng nội thất. Đây là mức giá tham khảo thay đổi liên tục theo thị trường, không phải bảng giá chính thức – khách hàng nên liên hệ SGS Land để được cập nhật mức giá giao dịch thực tế theo từng căn cụ thể trước khi quyết định.",
    },
    {
      q: "Vinhomes Central Park có đông dân cư sinh sống không?",
      a: "Có, đây là một trong những khu đô thị có mật độ dân cư ổn định và đông đúc nhất trong các dự án Vinhomes tại trung tâm TP.HCM, đã đi vào hoạt động ổn định từ năm 2017-2018 với đầy đủ trường học (Vinschool), bệnh viện (Vinmec Central Park), trung tâm thương mại (Vincom Center Landmark 81) và các dịch vụ nội khu.",
    },
    {
      q: "Vinhomes Central Park cách trung tâm Quận 1 bao xa?",
      a: "Vinhomes Central Park cách trung tâm Quận 1 khoảng 3km, di chuyển qua cầu Sài Gòn hoặc trục đường Nguyễn Hữu Cảnh - Điện Biên Phủ chỉ mất khoảng 10-15 phút bằng ô tô tùy thời điểm trong ngày.",
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
  schemaName: "Vinhomes Central Park",
  schemaDev: "Vingroup (Vinhomes)",
  schemaLocality: "Phường Bình Thạnh",
  schemaRegion: "TP.HCM",
  schemaAreaHa: 43.9,
  schemaTotalUnits: 10000,
  schemaAmenities: [
    "Công viên trung tâm ven sông 14ha",
    "Vincom Center Landmark 81",
    "Vinschool (mầm non - phổ thông)",
    "Bệnh viện Vinmec Central Park",
    "Bến du thuyền, đường dạo ven sông Sài Gòn",
    "Hồ bơi, phòng gym, khu vui chơi trẻ em nội khu",
    "An ninh 24/7, hệ thống camera giám sát toàn khu",
  ],
};

const MASTERI_PARK_PLACE: LandingProject = {
  slug: "masteri-park-place",
  titleFull: "Masteri Park Place The Global City 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "Masteri Park Place",
  eyebrow: "Phân khu căn hộ cao tầng tại The Global City",
  desc: "Masteri Park Place là cụm căn hộ cao tầng của Masterise Homes thuộc khu đô thị The Global City, phường Bình Trưng, TP Thủ Đức. Cập nhật giá bán, tiến độ, pháp lý 2026.",
  keywords: "Masteri Park Place, Masteri Park Place The Global City, căn hộ Masteri Park Place, giá Masteri Park Place 2026, Masterise Homes, The Global City Thủ Đức, mua bán Masteri Park Place",
  heroImageAlt: "Cụm tháp căn hộ Masteri Park Place trong khu đô thị The Global City, phường Bình Trưng, TP Thủ Đức",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.7958, lng: 106.7469 },
  stats: [
    { num: "Masterise Homes", lbl: "Chủ đầu tư" },
    { num: "117,4ha", lbl: "Thuộc KĐT The Global City" },
    { num: "Nhiều toà", lbl: "Cụm căn hộ cao tầng" },
    { num: "2021", lbl: "Khởi công The Global City" },
    { num: "~8km", lbl: "Tới trung tâm Quận 1" },
  ],
  heroH1: "Masteri Park Place – Căn Hộ Cao Tầng Trong Lòng The Global City",
  heroSub: "Phân khu căn hộ thuộc khu đô thị phức hợp The Global City của Masterise Homes, phường Bình Trưng, TP Thủ Đức – cập nhật giá bán, tiến độ và pháp lý mới nhất từ SGS Land.",
  heroMeta: "CĐT Masterise Homes | Thuộc KĐT The Global City | Phường Bình Trưng, TP Thủ Đức",
  overviewParas: [
    "Masteri Park Place là một trong các cụm tháp căn hộ cao tầng nằm trong quần thể khu đô thị phức hợp The Global City (117,4ha) do Masterise Homes phát triển tại phường Bình Trưng, TP Thủ Đức, TP.HCM (khu vực An Phú, Quận 2 cũ trước sáp nhập hành chính 1/7/2025). Đây là dòng sản phẩm căn hộ nằm trong hệ sinh thái các phân khu cao tầng của The Global City, bên cạnh Masteri Grand View, Lumiere Midtown và Masteri Cosmo Central.",
    "Vì thuộc quần thể The Global City, Masteri Park Place được thừa hưởng toàn bộ hạ tầng và tiện ích chung của khu đô thị: công viên trung tâm City Park (~13ha), khối đế thương mại SOHO, quảng trường sự kiện, cùng vị trí kết nối thuận tiện tới cao tốc TP.HCM - Long Thành - Dầu Giây, Xa Lộ Hà Nội và ga Rạch Chiếc thuộc tuyến Metro số 1 Bến Thành - Suối Tiên.",
    "Tiến độ và tình trạng pháp lý của Masteri Park Place gắn liền với tiến độ triển khai chung của The Global City theo từng giai đoạn xây dựng; khách mua nên đối chiếu thông tin bàn giao, sổ hồng và bảng giá cập nhật theo đợt mở bán cụ thể, vì đây là dự án đang trong quá trình triển khai chứ chưa hoàn thiện toàn bộ như các khu đô thị đã đi vào hoạt động ổn định.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Masteri Park Place" },
    { k: "Chủ đầu tư", v: "Masterise Homes (thành viên Masterise Group)" },
    { k: "Vị trí", v: "Thuộc khu đô thị The Global City, phường Bình Trưng, TP Thủ Đức, TP.HCM" },
    { k: "Toạ độ GPS", v: "10.7958° N, 106.7469° E (tham khảo, khu vực The Global City)" },
    { k: "Loại hình", v: "Cụm tháp căn hộ cao tầng thuộc quần thể The Global City (117,4ha)" },
    { k: "Các phân khu liên quan", v: "Masteri Grand View, Lumiere Midtown, Masteri Cosmo Central (cùng hệ Masterise trong The Global City)" },
    { k: "Hạ tầng kết nối", v: "Nút giao An Phú, cao tốc TP.HCM - Long Thành - Dầu Giây, Xa Lộ Hà Nội, ga Rạch Chiếc (Metro số 1)" },
    { k: "Tình trạng pháp lý", v: "Theo tiến độ triển khai từng giai đoạn của The Global City – cần xác minh cụ thể theo đợt bàn giao" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "Masteri Park Place nằm trong khu đô thị The Global City trên trục Đỗ Xuân Hợp - Song Hành - Liên Phường, phường Bình Trưng, TP Thủ Đức, cách trung tâm Quận 1 khoảng 7-9km qua trục Mai Chí Thọ và hầm Thủ Thiêm. Vị trí này gần nút giao An Phú, cao tốc TP.HCM - Long Thành - Dầu Giây và ga Rạch Chiếc thuộc tuyến Metro số 1.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Masteri+Park+Place+The+Global+City+Phuong+Binh+Trung+TP+Thu+Duc&output=embed",
  faq: [
    {
      q: "Masteri Park Place là dự án gì?",
      a: "Masteri Park Place là một cụm tháp căn hộ cao tầng do Masterise Homes phát triển, nằm trong quần thể khu đô thị phức hợp The Global City (117,4ha) tại phường Bình Trưng, TP Thủ Đức, TP.HCM, bên cạnh các phân khu Masteri Grand View, Lumiere Midtown và Masteri Cosmo Central.",
    },
    {
      q: "Masteri Park Place có quan hệ như thế nào với The Global City?",
      a: "Masteri Park Place là một trong các phân khu căn hộ cao tầng thành phần thuộc tổng thể dự án The Global City do Masterise Homes làm chủ đầu tư. Cư dân Masteri Park Place được sử dụng chung hạ tầng và tiện ích của toàn khu đô thị như công viên City Park, khối đế thương mại SOHO và các tiện ích công cộng khác.",
    },
    {
      q: "Pháp lý và tiến độ Masteri Park Place hiện nay ra sao?",
      a: "Tình trạng pháp lý và tiến độ xây dựng của Masteri Park Place gắn với tiến độ triển khai theo từng giai đoạn của The Global City. Do dự án đang trong quá trình xây dựng, khách hàng cần đối chiếu thông tin bàn giao và cấp sổ hồng cụ thể theo đợt mở bán tại thời điểm giao dịch – liên hệ SGS Land để được cập nhật hồ sơ pháp lý chính xác nhất.",
    },
    {
      q: "Giá căn hộ Masteri Park Place hiện nay khoảng bao nhiêu?",
      a: "Giá bán Masteri Park Place biến động theo giai đoạn mở bán, vị trí tầng và view căn hộ, tương tự mặt bằng giá chung của các phân khu căn hộ cao tầng khác trong The Global City. Đây là thông tin cần cập nhật trực tiếp theo từng thời điểm – vui lòng liên hệ SGS Land (0971 132 378) để nhận báo giá và chính sách bán hàng mới nhất.",
    },
    {
      q: "Masteri Park Place cách trung tâm TP.HCM bao xa?",
      a: "Từ Masteri Park Place tới trung tâm Quận 1 khoảng 7-9km, di chuyển qua trục Mai Chí Thọ và hầm Thủ Thiêm mất khoảng 15-20 phút bằng ô tô tùy thời điểm, đồng thời tiếp cận thuận tiện cao tốc TP.HCM - Long Thành - Dầu Giây và ga Rạch Chiếc thuộc tuyến Metro số 1 (Bến Thành - Suối Tiên).",
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
  schemaName: "Masteri Park Place",
  schemaDev: "Masterise Homes",
  schemaLocality: "Phường Bình Trưng",
  schemaRegion: "TP.HCM",
  schemaAmenities: [
    "Công viên trung tâm City Park (~13ha, dùng chung The Global City)",
    "Khối đế thương mại SOHO",
    "Hồ bơi, phòng gym nội khu",
    "An ninh 24/7, quản lý vận hành chuyên nghiệp",
    "Kết nối tuyến Metro số 1 qua ga Rạch Chiếc",
    "Quảng trường sự kiện, không gian sinh hoạt cộng đồng",
  ],
};

const DIAMOND_SKY_VAN_PHUC_CITY: LandingProject = {
  slug: "diamond-sky-van-phuc-city",
  titleFull: "Diamond Sky Vạn Phúc City 2026 – Giá, Mặt Bằng, Pháp Lý | SGS LAND",
  titleShort: "Diamond Sky Vạn Phúc City",
  eyebrow: "Căn hộ cao tầng hạng sang ven sông Sài Gòn",
  desc: "Diamond Sky là phân khu căn hộ cao tầng thuộc khu đô thị Vạn Phúc City, TP Thủ Đức, do Tập đoàn Vạn Phúc phát triển, quy mô 198ha, 3 mặt sông. Giá bán, pháp lý cập nhật 2026.",
  keywords: "Diamond Sky, Diamond Sky Van Phuc City, Vạn Phúc City, Vạn Phúc City Thủ Đức, giá Diamond Sky 2026, căn hộ Vạn Phúc City, Tập đoàn Vạn Phúc, Hiệp Bình Phước",
  heroImageAlt: "Tháp căn hộ Diamond Sky trong khu đô thị Vạn Phúc City ven sông Sài Gòn, TP Thủ Đức",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.8386, lng: 106.7134 },
  stats: [
    { num: "198ha", lbl: "Quy mô KĐT Vạn Phúc City" },
    { num: "3 mặt sông", lbl: "Bao quanh bởi sông Sài Gòn" },
    { num: "Tập đoàn Vạn Phúc", lbl: "Chủ đầu tư" },
    { num: "9,6 tỷ+", lbl: "Giá thứ cấp tham khảo (2026)" },
    { num: "~12km", lbl: "Tới trung tâm Quận 1" },
  ],
  heroH1: "Diamond Sky – Căn Hộ Cao Tầng Ven Sông Trong Lòng Vạn Phúc City",
  heroSub: "Phân khu căn hộ cao tầng thuộc khu đô thị Vạn Phúc City (198ha, 3 mặt giáp sông Sài Gòn) tại Hiệp Bình Phước, TP Thủ Đức – cập nhật bảng giá, pháp lý 2026 từ SGS Land.",
  heroMeta: "CĐT Tập đoàn Vạn Phúc | KĐT Vạn Phúc City 198ha | Hiệp Bình Phước, TP Thủ Đức, TP.HCM",
  overviewParas: [
    "Diamond Sky là phân khu căn hộ cao tầng nằm trong khu đô thị Vạn Phúc City, một khu đô thị khép kín quy mô khoảng 198ha do Tập đoàn Vạn Phúc làm chủ đầu tư, tọa lạc tại phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM. Điểm đặc trưng của Vạn Phúc City là vị trí bán đảo được bao quanh bởi 3 mặt sông Sài Gòn, tạo cảnh quan ven sông cho phần lớn các phân khu trong dự án.",
    "Bên cạnh Diamond Sky, khu đô thị Vạn Phúc City còn có nhiều phân khu thấp tầng (biệt thự, nhà phố, shophouse) đã hình thành và có dân cư sinh sống ổn định từ nhiều năm nay, cùng các tiện ích nội khu như trường học, bệnh viện, trung tâm thương mại, quảng trường Vạn Phúc, Nhà hát Hoàn Vũ. Diamond Sky là một trong các dự án căn hộ cao tầng được phát triển ở giai đoạn sau của khu đô thị.",
    "Về kết nối giao thông, Vạn Phúc City nằm gần Quốc lộ 13, cầu Bình Lợi và trục đường Phạm Văn Đồng, cách trung tâm Quận 1 khoảng 12km. Tình trạng pháp lý và tiến độ bàn giao cụ thể của Diamond Sky cần được xác minh theo từng giai đoạn/toà tháp tại thời điểm giao dịch, do đây là phân khu căn hộ cao tầng triển khai sau các phân khu thấp tầng của dự án.",
  ],
  entityTable: [
    { k: "Tên dự án", v: "Diamond Sky (thuộc khu đô thị Vạn Phúc City)" },
    { k: "Chủ đầu tư", v: "Tập đoàn Vạn Phúc" },
    { k: "Vị trí", v: "Khu đô thị Vạn Phúc City, phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM" },
    { k: "Toạ độ GPS", v: "10.8386° N, 106.7134° E (tham khảo, khu vực Vạn Phúc City)" },
    { k: "Quy mô KĐT", v: "~198ha, 3 mặt giáp sông Sài Gòn" },
    { k: "Loại hình", v: "Căn hộ cao tầng (Diamond Sky), ngoài ra KĐT có biệt thự, nhà phố, shophouse đã bàn giao" },
    { k: "Hạ tầng kết nối", v: "Quốc lộ 13, cầu Bình Lợi, trục Phạm Văn Đồng, cách trung tâm Quận 1 khoảng 12km" },
    { k: "Tình trạng pháp lý", v: "Cần xác minh cụ thể theo từng toà/giai đoạn tại thời điểm giao dịch" },
    { k: "Kênh tư vấn", v: "0971 132 378 (SGS LAND – cung cấp thông tin tham khảo)" },
  ],
  locationIntro: "Diamond Sky nằm trong khu đô thị Vạn Phúc City tại phường Hiệp Bình Phước, TP Thủ Đức – khu vực bán đảo được bao quanh bởi 3 mặt sông Sài Gòn. Từ đây di chuyển ra trung tâm Quận 1 khoảng 12km qua Quốc lộ 13, cầu Bình Lợi và trục đường Phạm Văn Đồng.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Van+Phuc+City+Diamond+Sky+Hiep+Binh+Phuoc+TP+Thu+Duc&output=embed",
  faq: [
    {
      q: "Diamond Sky là dự án gì?",
      a: "Diamond Sky là phân khu căn hộ cao tầng nằm trong khu đô thị Vạn Phúc City (~198ha, 3 mặt giáp sông Sài Gòn) do Tập đoàn Vạn Phúc phát triển tại phường Hiệp Bình Phước, TP Thủ Đức, TP.HCM.",
    },
    {
      q: "Vạn Phúc City có gì đặc biệt về vị trí?",
      a: "Vạn Phúc City là một trong số ít khu đô thị tại TP.HCM có vị trí bán đảo được bao quanh bởi 3 mặt sông Sài Gòn, tạo lợi thế cảnh quan ven sông cho phần lớn các phân khu. Nhiều khu thấp tầng (biệt thự, nhà phố, shophouse) trong dự án đã hình thành và có dân cư ổn định từ nhiều năm.",
    },
    {
      q: "Pháp lý Diamond Sky hiện nay như thế nào?",
      a: "Vì Diamond Sky là phân khu căn hộ cao tầng triển khai ở giai đoạn sau của Vạn Phúc City, tình trạng pháp lý (sổ hồng) và tiến độ bàn giao cần được xác minh cụ thể theo từng toà và thời điểm giao dịch. Khách hàng nên yêu cầu SGS Land kiểm tra hồ sơ pháp lý chi tiết trước khi quyết định.",
    },
    {
      q: "Giá căn hộ Diamond Sky hiện nay khoảng bao nhiêu?",
      a: "Theo ghi nhận thị trường, giá thứ cấp căn hộ Diamond Sky tham khảo khoảng từ 9,6 tỷ đồng trở lên tùy diện tích, tầng và view, đây là mức giá tham khảo tổng hợp từ thị trường, không phải bảng giá chính thức. Vui lòng liên hệ SGS Land (0971 132 378) để được báo giá cập nhật theo từng căn cụ thể.",
    },
    {
      q: "Vạn Phúc City / Diamond Sky cách trung tâm TP.HCM bao xa?",
      a: "Khu đô thị Vạn Phúc City cách trung tâm Quận 1 khoảng 12km, kết nối qua Quốc lộ 13, cầu Bình Lợi và trục đường Phạm Văn Đồng, thời gian di chuyển trung bình khoảng 20-30 phút tùy tình trạng giao thông.",
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
  schemaName: "Diamond Sky - Van Phuc City",
  schemaDev: "Tập đoàn Vạn Phúc",
  schemaLocality: "Phường Hiệp Bình Phước",
  schemaRegion: "TP.HCM",
  schemaAreaHa: 198,
  schemaPriceLow: 9600000000,
  schemaAmenities: [
    "Cảnh quan 3 mặt sông Sài Gòn",
    "Quảng trường trung tâm Vạn Phúc",
    "Nhà hát Hoàn Vũ (Vạn Phúc Amphitheater)",
    "Trường học liên cấp trong nội khu",
    "Trung tâm thương mại, khu shophouse",
    "Công viên cây xanh, đường dạo ven sông",
  ],
};

const THU_THIEM: LandingProject = {
  slug: "thu-thiem",
  titleFull: "Khu Đô Thị Mới Thủ Thiêm 2026 – Quy Hoạch, Dự Án, Giá Đất | SGS LAND",
  titleShort: "Khu Đô Thị Thủ Thiêm",
  eyebrow: "Trung tâm tài chính - thương mại mới của TP.HCM",
  desc: "Thủ Thiêm là khu đô thị mới 657ha bên bờ Đông sông Sài Gòn, đối diện Quận 1, quy hoạch thành trung tâm tài chính - thương mại TP.HCM. Cập nhật hạ tầng, dự án, giá đất 2026.",
  keywords: "Thủ Thiêm, khu đô thị mới Thủ Thiêm, bất động sản Thủ Đức, quy hoạch Thủ Thiêm 2026, giá đất Thủ Thiêm, dự án Thủ Thiêm, Empire City, Sarimi, cầu Thủ Thiêm",
  heroImageAlt: "Toàn cảnh khu đô thị mới Thủ Thiêm bên bờ sông Sài Gòn, đối diện Quận 1, TP.HCM",
  heroGradient: "linear-gradient(rgba(6,20,32,.75),rgba(6,20,32,.5))",
  theme: { primary: "#0B1D26", deep: "#061420", soft: "#EFE6D8", gold: "#C6923D", goldSoft: "#E7C98A", cream: "#F5F1E6" },
  geo: { lat: 10.7772, lng: 106.7219 },
  stats: [
    { num: "657ha", lbl: "Tổng diện tích quy hoạch" },
    { num: "8", lbl: "Khu chức năng chính" },
    { num: "5", lbl: "Cầu/hầm kết nối Quận 1" },
    { num: "1996", lbl: "Năm phê duyệt quy hoạch đầu tiên" },
    { num: "Đối diện Q1", lbl: "Qua sông Sài Gòn" },
  ],
  heroH1: "Khu Đô Thị Mới Thủ Thiêm – Trung Tâm Tài Chính Tương Lai Của TP.HCM",
  heroSub: "Tổng hợp quy hoạch, hạ tầng, các dự án bất động sản nổi bật và mặt bằng giá tại khu đô thị mới Thủ Thiêm – cập nhật từ SGS Land.",
  heroMeta: "Quy hoạch 657ha | Đối diện Quận 1 qua sông Sài Gòn | TP.HCM",
  overviewParas: [
    "Khu đô thị mới Thủ Thiêm là khu đô thị quy hoạch quy mô khoảng 657ha nằm bên bờ Đông sông Sài Gòn, đối diện trực tiếp Quận 1 qua sông, thuộc địa bàn TP.HCM (trước đây thuộc TP Thủ Đức, khu vực An Khánh - Thủ Thiêm cũ). Đồ án quy hoạch Thủ Thiêm được phê duyệt lần đầu từ năm 1996 với định hướng trở thành trung tâm tài chính, thương mại, dịch vụ mới của TP.HCM, bổ sung cho khu trung tâm hiện hữu Quận 1.",
    "Khu đô thị được chia thành 8 khu chức năng chính gồm khu lõi trung tâm tài chính, khu dân cư phía Bắc, khu dân cư phía Đông, khu châu thổ phía Nam, khu đa chức năng, quảng trường trung tâm và công viên bờ sông. Nhiều dự án bất động sản cao cấp đã và đang triển khai tại đây như Empire City, Sarimi, The River Thủ Thiêm, Metropole Thủ Thiêm, Eco Smart City, Grand Marina Saigon, cùng các công trình hạ tầng biểu tượng như cầu Thủ Thiêm 1-2, hầm vượt sông Sài Gòn, cầu đi bộ Thủ Thiêm nối Quận 1.",
    "Hạ tầng kết nối Thủ Thiêm với trung tâm Quận 1 gồm hầm Thủ Thiêm (vượt sông Sài Gòn), cầu Thủ Thiêm 1, cầu Thủ Thiêm 2 (Ba Son) và cầu đi bộ Thủ Thiêm đang triển khai, giúp khu vực này ngày càng gắn kết chặt với khu trung tâm hiện hữu. Giá đất và bất động sản tại Thủ Thiêm biến động lớn theo từng vị trí, dự án cụ thể và tiến độ hạ tầng – khách hàng quan tâm nên tham khảo trực tiếp từng dự án thành phần thay vì áp dụng một mặt bằng giá chung cho toàn khu vực.",
  ],
  entityTable: [
    { k: "Tên khu vực", v: "Khu đô thị mới Thủ Thiêm" },
    { k: "Chủ đầu tư", v: "Nhiều chủ đầu tư triển khai từng dự án thành phần (Empire City, Đại Quang Minh, CII, SonKim Land...)" },
    { k: "Vị trí", v: "Bờ Đông sông Sài Gòn, đối diện Quận 1, TP.HCM" },
    { k: "Toạ độ GPS", v: "10.7772° N, 106.7219° E (tham khảo, khu vực trung tâm)" },
    { k: "Quy mô quy hoạch", v: "657ha, chia thành 8 khu chức năng chính" },
    { k: "Các dự án tiêu biểu", v: "Empire City, Sarimi, The River Thủ Thiêm, Metropole Thủ Thiêm, Eco Smart City, Grand Marina Saigon" },
    { k: "Hạ tầng kết nối", v: "Hầm Thủ Thiêm, cầu Thủ Thiêm 1, cầu Thủ Thiêm 2 (Ba Son), cầu đi bộ Thủ Thiêm (đang triển khai)" },
    { k: "Năm quy hoạch", v: "Phê duyệt lần đầu 1996, nhiều lần điều chỉnh quy hoạch sau đó" },
    { k: "Hotline tư vấn", v: "0971 132 378 (SGS Land – đại lý ủy quyền chính thức)" },
  ],
  locationIntro: "Khu đô thị mới Thủ Thiêm nằm bên bờ Đông sông Sài Gòn, đối diện trực tiếp Quận 1 – trung tâm hiện hữu của TP.HCM. Khu vực kết nối với Quận 1 qua hầm Thủ Thiêm, cầu Thủ Thiêm 1, cầu Thủ Thiêm 2 (Ba Son) và cầu đi bộ Thủ Thiêm, đồng thời giáp ranh các khu dân cư hiện hữu An Phú, An Khánh, Bình Trưng thuộc TP Thủ Đức cũ.",
  googleMapsEmbedSrc: "https://www.google.com/maps?q=Khu+do+thi+moi+Thu+Thiem+TP+HCM&output=embed",
  faq: [
    {
      q: "Khu đô thị mới Thủ Thiêm là gì?",
      a: "Thủ Thiêm là khu đô thị mới quy mô khoảng 657ha nằm bên bờ Đông sông Sài Gòn, đối diện Quận 1, được quy hoạch từ năm 1996 để trở thành trung tâm tài chính, thương mại, dịch vụ mới của TP.HCM, bổ sung cho khu trung tâm hiện hữu.",
    },
    {
      q: "Thủ Thiêm có những dự án bất động sản nổi bật nào?",
      a: "Một số dự án tiêu biểu đã và đang triển khai tại Thủ Thiêm gồm Empire City, Sarimi, The River Thủ Thiêm, Metropole Thủ Thiêm, Eco Smart City và Grand Marina Saigon – mỗi dự án do một chủ đầu tư khác nhau phát triển với tiến độ, pháp lý và mức giá riêng biệt.",
    },
    {
      q: "Thủ Thiêm kết nối với Quận 1 bằng cách nào?",
      a: "Thủ Thiêm kết nối với trung tâm Quận 1 qua hầm Thủ Thiêm (vượt sông Sài Gòn), cầu Thủ Thiêm 1, cầu Thủ Thiêm 2 (Ba Son) đã đưa vào sử dụng, cùng cầu đi bộ Thủ Thiêm đang trong quá trình triển khai để tăng cường kết nối đi bộ trực tiếp giữa hai bờ.",
    },
    {
      q: "Giá đất/bất động sản tại Thủ Thiêm hiện nay ra sao?",
      a: "Giá đất và bất động sản tại Thủ Thiêm biến động rất lớn tùy vị trí cụ thể, từng dự án thành phần và tiến độ hạ tầng xung quanh – khu vực gần lõi trung tâm tài chính và ven sông thường có giá cao hơn đáng kể so với các khu dân cư lân cận. Đây là thông tin cần tham khảo trực tiếp theo từng dự án cụ thể, không có một mặt bằng giá chung cho toàn khu vực – liên hệ SGS Land để được tư vấn theo nhu cầu.",
    },
    {
      q: "Pháp lý các dự án tại Thủ Thiêm có đồng nhất không?",
      a: "Không. Vì mỗi dự án tại Thủ Thiêm do một chủ đầu tư khác nhau triển khai theo tiến độ riêng, tình trạng pháp lý (sổ hồng, giấy phép xây dựng, nghĩa vụ tài chính đất đai) cần được kiểm tra cụ thể theo từng dự án và từng căn/lô tại thời điểm giao dịch.",
    },
    {
      q: "Vì sao nên tìm hiểu bất động sản Thủ Thiêm qua SGS Land?",
      a: "SGS Land cập nhật thông tin quy hoạch, hạ tầng và các dự án thành phần tại Thủ Thiêm theo thời gian thực, giúp khách hàng có cái nhìn tổng quan và đối chiếu giữa các lựa chọn trước khi quyết định. Liên hệ hotline 0971 132 378 để được tư vấn chi tiết theo từng dự án cụ thể.",
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
  schemaName: "Khu đô thị mới Thủ Thiêm",
  schemaDev: "Nhiều chủ đầu tư (khu đô thị quy hoạch tổng thể)",
  schemaLocality: "Thủ Thiêm",
  schemaRegion: "TP.HCM",
  schemaAreaHa: 657,
  schemaAmenities: [
    "Quảng trường trung tâm và công viên bờ sông",
    "Cầu đi bộ Thủ Thiêm nối Quận 1 (đang triển khai)",
    "Nhà hát Giao hưởng - Nhạc - Vũ kịch (quy hoạch)",
    "Hệ thống công viên cây xanh dọc sông Sài Gòn",
    "Khu phức hợp thương mại - tài chính - dịch vụ",
    "Kết nối hầm Thủ Thiêm, cầu Thủ Thiêm 1 và 2",
  ],
};


// ─────────────────────────────────────────────
// Export map
// ─────────────────────────────────────────────
export const LANDING_PROJECTS: Record<string, LandingProject> = {
  "aqua-city": AQUA_CITY,
  "legacy-66": LEGACY_66,
  "masteri-cosmo-central": MASTERI_COSMO,
  // vinhomes-hoc-mon: canonical page is at /du-an/vinhomes-hoc-mon (dedicated page)
  "vinhomes-grand-park": VINHOMES_GRAND_PARK,
  "the-global-city": THE_GLOBAL_CITY,
  "izumi-city": IZUMI_CITY,
  "vinhomes-central-park": VINHOMES_CENTRAL_PARK,
  "masteri-park-place": MASTERI_PARK_PLACE,
  "diamond-sky-van-phuc-city": DIAMOND_SKY_VAN_PHUC_CITY,
  "thu-thiem": THU_THIEM,
};

export const LANDING_SLUGS = Object.keys(LANDING_PROJECTS);
