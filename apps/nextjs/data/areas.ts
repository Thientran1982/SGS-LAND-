// Area price index (single source of truth for /khu-vuc and /bao-cao-thi-truong).
// Generated from public/data/area-price-index.json. Do NOT edit values by hand;
// update the JSON and regenerate to keep the published Dataset in sync.

export type AreaPrice = {
  slug: string;
  area: string;
  avgPricePerSqm: number;
  yoyChangePct: number | null;
  topProject: string | null;
  priceRange: string | null;
  quarter: string | null;
};

export const AREA_META = {
  quarter: "2024-01/2026-06",
  dateModified: "2026-06-04",
  spatial: "TP. Hồ Chí Minh và vùng ven",
};

export const AREA_PRICES: AreaPrice[] = [
  {
    "slug": "bat-dong-san-thu-duc",
    "area": "TP. Thủ Đức",
    "avgPricePerSqm": 62,
    "yoyChangePct": 8.2,
    "topProject": "Vinhomes Grand Park",
    "priceRange": "45–95",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-quan-7",
    "area": "Quận 7 (Phú Mỹ Hưng)",
    "avgPricePerSqm": 75,
    "yoyChangePct": 6.5,
    "topProject": "Sala",
    "priceRange": "55–120",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-binh-thanh",
    "area": "Bình Thạnh",
    "avgPricePerSqm": 55,
    "yoyChangePct": 7.1,
    "topProject": "Masteri Thảo Điền",
    "priceRange": "40–90",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-phu-nhuan",
    "area": "Phú Nhuận",
    "avgPricePerSqm": 58,
    "yoyChangePct": 5.8,
    "topProject": "Novaland Phú Nhuận",
    "priceRange": "42–80",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-binh-chanh",
    "area": "Bình Chánh",
    "avgPricePerSqm": 32,
    "yoyChangePct": 12.4,
    "topProject": "The Privia",
    "priceRange": "22–48",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-can-gio",
    "area": "Cần Giờ",
    "avgPricePerSqm": 28,
    "yoyChangePct": 18.6,
    "topProject": "Vinhomes Cần Giờ",
    "priceRange": "18–55",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-hoc-mon",
    "area": "Hóc Môn",
    "avgPricePerSqm": 25,
    "yoyChangePct": 22.1,
    "topProject": "Vinhomes Hóc Môn",
    "priceRange": "15–42",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-dong-nai",
    "area": "Biên Hòa, Đồng Nai",
    "avgPricePerSqm": 22,
    "yoyChangePct": 9.3,
    "topProject": "Aqua City",
    "priceRange": "14–38",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-long-thanh",
    "area": "Long Thành, Đồng Nai",
    "avgPricePerSqm": 18,
    "yoyChangePct": 14.7,
    "topProject": "Izumi City",
    "priceRange": "12–32",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-binh-duong",
    "area": "Bình Dương",
    "avgPricePerSqm": 26,
    "yoyChangePct": 8.9,
    "topProject": "Merita Bình Dương",
    "priceRange": "16–40",
    "quarter": "Q2/2026"
  },
  {
    "slug": "bat-dong-san-long-an",
    "area": "Long An",
    "avgPricePerSqm": 14,
    "yoyChangePct": 11.2,
    "topProject": "Waterpoint",
    "priceRange": "9–22",
    "quarter": "Q2/2026"
  }
];

export function getAreaBySlug(slug: string): AreaPrice | undefined {
  return AREA_PRICES.find((a) => a.slug === slug);
}
