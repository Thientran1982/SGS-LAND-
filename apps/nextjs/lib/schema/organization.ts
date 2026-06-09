import { SITE_URL, SITE_NAME, ORG_ID, LOGO_ID } from "./constants";

export interface GeoCoordinates {
  "@type": "GeoCoordinates";
  latitude: number;
  longitude: number;
}

export interface PostalAddress {
  "@type": "PostalAddress";
  streetAddress?: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
}

export interface ContactPoint {
  "@type": "ContactPoint";
  telephone: string;
  contactType: string;
  areaServed?: string;
  availableLanguage?: string[];
  email?: string;
  url?: string;
}

export interface AggregateRating {
  "@type": "AggregateRating";
  ratingValue: string;
  reviewCount: string;
  bestRating: string;
  worstRating: string;
}

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization" | "RealEstateAgent" | "LocalBusiness";
  "@id": string;
  name: string;
  alternateName?: string[];
  legalName?: string;
  taxID?: string;
  description: string;
  url: string;
  logo: { "@type": "ImageObject"; url: string; width: number; height: number; alt: string };
  image: { "@type": "ImageObject"; url: string; width: number; height: number; alt: string };
  foundingDate?: string;
  areaServed?: string[];
  address: PostalAddress;
  geo?: GeoCoordinates;
  contactPoint: ContactPoint | ContactPoint[];
  sameAs: string[];
  inLanguage?: string[];
  knowsAbout?: string[];
  slogan?: string;
  numberOfEmployees?: { "@type": "QuantitativeValue"; value: number };
  award?: string[];
  founder?: { "@type": "Person"; name: string; jobTitle: string; sameAs?: string };
  employee?: { "@type": "Person"; name: string; jobTitle: string }[];
  aggregateRating?: AggregateRating;
  hasMap?: string;
  openingHoursSpecification?: {
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string[];
    opens: string;
    closes: string;
  };
  priceRange?: string;
  currenciesAccepted?: string;
  partnerOf?: { "@type": string; name: string; url?: string; sameAs?: string }[];
  additionalType?: string[];
  memberOf?: { "@type": string; name: string; url?: string; sameAs?: string }[];
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    alternateName: ["SGSID", "SGS Co.,Ltd", "SGS Land Enterprise", "SGS LAND Vietnam"],
    legalName: "Công ty TNHH SGS Land",
    taxID: "0312960439",
    description:
      "SGS LAND là nền tảng quản lý và phân phối bất động sản AI hàng đầu Việt Nam, thành lập năm 2024. Đại lý phân phối ủy quyền cấp 1 của Vinhomes, Novaland và Masterise Homes. Tích hợp AI định giá sai số ±5%, CRM đa kênh và kho hàng realtime với hơn 45.000 sản phẩm, 15.000+ môi giới.",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
      alt: "SGS LAND - Nền tảng bất động sản AI Việt Nam",
    },
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/og-image.jpg`,
      width: 1200,
      height: 630,
      alt: "SGS LAND - Hệ điều hành bất động sản thế hệ mới",
    },
    foundingDate: "2015",
    areaServed: [
      "TP. Hồ Chí Minh",
      "Đồng Nai",
      "Bình Dương",
      "Long An",
      "Bà Rịa - Vũng Tàu",
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "123 Nguyễn Văn Linh, Phường Tân Phong",
      addressLocality: "Quận 7",
      addressRegion: "TP. Hồ Chí Minh",
      postalCode: "70000",
      addressCountry: "VN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 10.7269,
      longitude: 106.7181,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: "+84971132378",
        email: "info@sgsland.vn",
        availableLanguage: ["Vietnamese", "English"],
        areaServed: "VN",
        url: `${SITE_URL}/contact`,
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: "+84971132378",
        availableLanguage: ["Vietnamese"],
        areaServed: "VN",
      },
    ],
    sameAs: [
      "https://www.facebook.com/sgslandvn",
      "https://www.linkedin.com/company/sgsland",
      "https://twitter.com/SGSLand",
      "https://www.youtube.com/@sgsland",
      "https://zalo.me/sgsland",
      "https://www.tiktok.com/@sgsland.vn",
      "https://www.instagram.com/sgsland.vn",
      "https://maps.app.goo.gl/sgsland",
      "https://www.crunchbase.com/organization/sgs-land",
      "https://vi.wikipedia.org/wiki/SGS_Land",
      "https://www.wikidata.org/wiki/Q130519839",
    ],
    inLanguage: ["vi", "en"],
    knowsAbout: [
      "Bất động sản TP.HCM",
      "Định giá AI bất động sản",
      "CRM bất động sản",
      "Aqua City Novaland",
      "The Global City Masterise",
      "Izumi City Nam Long",
      "Vinhomes Grand Park",
      "Vinhomes Cần Giờ",
      "Diamond Sky Vạn Phúc",
      "Masteri Cosmo",
      "Legacy 66",
      "Pháp lý nhà đất",
      "Đầu tư bất động sản 2026",
      "Vinhomes Hóc Môn",
    ],
    slogan: "Hệ Điều Hành Bất Động Sản Thế Hệ Mới",
    numberOfEmployees: {
      "@type": "QuantitativeValue",
      value: 15000,
    },
    award: [
      "Top 10 Proptech Việt Nam 2025",
      "Đại lý phân phối ủy quyền Vinhomes cấp 1 2024-2026",
      "Đại lý phân phối ủy quyền Novaland cấp 1 2024-2026",
      "Đại lý phân phối ủy quyền Masterise Homes 2024-2026",
    ],
    founder: {
      "@type": "Person",
      name: "Trần Minh Thiện",
      jobTitle: "Founder & CEO",
      sameAs: "https://www.linkedin.com/in/tran-minh-thien-sgsland",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "247",
      bestRating: "5",
      worstRating: "1",
    },
    hasMap: "https://maps.app.goo.gl/sgsland-hcm",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "08:00",
      closes: "21:00",
    },
    priceRange: "Tư vấn miễn phí",
    currenciesAccepted: "VND",
    partnerOf: [
      { "@type": "Organization", name: "Vinhomes", url: "https://vinhomes.vn", sameAs: "https://www.wikidata.org/wiki/Q17021968" },
      { "@type": "Organization", name: "Novaland", url: "https://novaland.com.vn", sameAs: "https://www.wikidata.org/wiki/Q17021970" },
      { "@type": "Organization", name: "Nam Long Group", url: "https://namlonggroup.com", sameAs: "https://www.wikidata.org/wiki/Q107439987" },
      { "@type": "Organization", name: "Masterise Homes", url: "https://masterisehomes.com" },
    ],
    additionalType: [
      "https://www.wikidata.org/wiki/Q1424372",
      "https://schema.org/ProfessionalService",
      "https://schema.org/RealEstateAgent",
    ],
  };
}
