// Chu dau tu (developers) — du lieu tinh, dung cho /chu-dau-tu va /chu-dau-tu/[slug]
export interface Developer {
  slug: string;
  name: string;
  short: string;
  viDesc: string;
  enDesc: string;
  areas: string[];
  partnerSince?: number;
  projects: { slug: string; name: string }[];
}

export const DEVELOPERS: Developer[] = [
  {
    slug: "vinhomes",
    name: "Vinhomes",
    short: "Vingroup",
    viDesc:
      "Vinhomes là thương hiệu bất động sản nhà ở của Vingroup, phát triển các đại đô thị tích hợp quy mô lớn với hệ tiện ích nội khu đồng bộ (Vinschool, Vinmec, Vincom). SGS LAND là đại lý phân phối uỷ quyền của Vinhomes.",
    enDesc:
      "Vinhomes is Vingroup's residential real estate brand, developing large integrated townships with a full in-house amenity ecosystem (Vinschool, Vinmec, Vincom). SGS LAND is an authorised distribution agent for Vinhomes.",
    areas: ["TP.HCM", "Đồng Nai", "Cần Giờ", "Hóc Môn"],
    partnerSince: 2024,
    projects: [
      { slug: "vinhomes-grand-park", name: "Vinhomes Grand Park" },
      { slug: "vinhomes-central-park", name: "Vinhomes Central Park" },
      { slug: "vinhomes-can-gio", name: "Vinhomes Cần Giờ" },
      { slug: "vinhomes-hoc-mon", name: "Vinhomes Hóc Môn" },
    ],
  },
  {
    slug: "novaland",
    name: "Novaland",
    short: "Novaland Group",
    viDesc:
      "Novaland phát triển các khu đô thị sinh thái và bất động sản nghỉ dưỡng quy mô lớn tại TP.HCM, Đồng Nai và các tỉnh phía Nam. SGS LAND là đại lý F1 uỷ quyền của Novaland.",
    enDesc:
      "Novaland develops large eco-townships and resort real estate across Ho Chi Minh City, Dong Nai and the southern provinces. SGS LAND is an authorised tier-1 agent for Novaland.",
    areas: ["Đồng Nai", "TP.HCM"],
    partnerSince: 2024,
    projects: [
      { slug: "aqua-city", name: "Aqua City" },
      { slug: "manhattan", name: "The Grand Manhattan" },
    ],
  },
  {
    slug: "masterise-homes",
    name: "Masterise Homes",
    short: "Masterise Group",
    viDesc:
      "Masterise Homes tập trung vào phân khúc căn hộ hàng hiệu và bất động sản cao cấp tại các vị trí trung tâm. SGS LAND là đại lý phân phối uỷ quyền của Masterise Homes.",
    enDesc:
      "Masterise Homes focuses on branded residences and high-end property in central locations. SGS LAND is an authorised distribution agent for Masterise Homes.",
    areas: ["TP.HCM", "Thủ Đức"],
    partnerSince: 2024,
    projects: [
      { slug: "the-global-city", name: "The Global City" },
      { slug: "masteri-cosmo-central", name: "Masteri Cosmo Central" },
      { slug: "masterise-homes", name: "Grand Marina · Masteri" },
      { slug: "lumiere", name: "Lumière" },
    ],
  },
  {
    slug: "nam-long",
    name: "Nam Long Group",
    short: "Nam Long",
    viDesc:
      "Nam Long Group phát triển các khu đô thị tích hợp theo chuẩn Nhật Bản với sản phẩm vừa túi tiền và trung cấp. SGS LAND là đại lý phân phối uỷ quyền của Nam Long.",
    enDesc:
      "Nam Long Group builds Japanese-standard integrated townships with affordable and mid-tier products. SGS LAND is an authorised distribution agent for Nam Long.",
    areas: ["Đồng Nai", "Long An", "TP.HCM"],
    partnerSince: 2024,
    projects: [
      { slug: "izumi-city", name: "Izumi City" },
      { slug: "waterpoint", name: "Waterpoint" },
      { slug: "the-privia", name: "The Privia" },
    ],
  },
  {
    slug: "van-phuc-group",
    name: "Tập đoàn Vạn Phúc",
    short: "Van Phuc Group",
    viDesc:
      "Tập đoàn Vạn Phúc phát triển khu đô thị Vạn Phúc City ven sông Sài Gòn tại TP Thủ Đức cùng các dòng sản phẩm nhà phố, biệt thự và căn hộ hạng sang.",
    enDesc:
      "Van Phuc Group develops the riverside Van Phuc City township in Thu Duc, together with townhouse, villa and luxury apartment lines.",
    areas: ["Thủ Đức", "TP.HCM"],
    projects: [{ slug: "van-phuc-city", name: "Vạn Phúc City" }],
  },
  {
    slug: "son-kim-land",
    name: "Sơn Kim Land",
    short: "SonKim Land",
    viDesc:
      "Sơn Kim Land phát triển bất động sản cao cấp tại các vị trí trung tâm TP.HCM, chú trọng thiết kế và trải nghiệm sống.",
    enDesc:
      "SonKim Land develops high-end property in central Ho Chi Minh City with a strong focus on design and living experience.",
    areas: ["TP.HCM", "Thủ Đức"],
    partnerSince: 2025,
    projects: [{ slug: "son-kim-land", name: "Sơn Kim Land" }],
  },
  {
    slug: "dai-quang-minh",
    name: "Đại Quang Minh",
    short: "Dai Quang Minh",
    viDesc:
      "Đại Quang Minh là chủ đầu tư khu đô thị Sala tại Thủ Thiêm, TP Thủ Đức — một trong những khu đô thị trung tâm mới của TP.HCM.",
    enDesc:
      "Dai Quang Minh is the developer of the Sala urban area in Thu Thiem, Thu Duc — part of Ho Chi Minh City's new central district.",
    areas: ["Thủ Thiêm", "Thủ Đức"],
    projects: [
      { slug: "sala", name: "Khu đô thị Sala" },
      { slug: "thu-thiem", name: "Khu đô thị Thủ Thiêm" },
    ],
  },
];

export const getDeveloper = (slug: string) => DEVELOPERS.find((d) => d.slug === slug);
