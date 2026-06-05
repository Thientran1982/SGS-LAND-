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
  availableLanguage: string | string[];
  url?: string;
}

export interface AggregateRating {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
}

export interface QuantitativeValue {
  "@type": "QuantitativeValue";
  value: number;
}

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": string[];
  "@id": string;
  name: string;
  alternateName: string[];
  legalName: string;
  url: string;
  logo: {
    "@type": "ImageObject";
    "@id": string;
    url: string;
    width: number;
    height: number;
    caption: string;
  };
  image: { "@type": "ImageObject"; url: string };
  description: string;
  foundingDate: string;
  address: PostalAddress;
  geo: GeoCoordinates;
  contactPoint: ContactPoint;
  sameAs: string[];
  aggregateRating: AggregateRating;
  numberOfEmployees: QuantitativeValue;
  areaServed: string[];
  knowsAbout: string[];
  telephone: string;
  email: string;
}

export function getOrganizationSchema(): OrganizationSchema {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "RealEstateAgent", "LocalBusiness"],
    "@id": ORG_ID,
    name: SITE_NAME,
    alternateName: ["SGS Land Corp", "SGSID", "SGS Land Enterprise"],
    legalName: "Công ty Cổ phần SGS Land",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      "@id": LOGO_ID,
      url: `${SITE_URL}/icon-512.png`,
      width: 512,
      height: 512,
      caption: `${SITE_NAME} Logo`,
    },
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/og-image.jpg`,
    },
    description:
      "SGS LAND là nền tảng bất động sản AI hàng đầu Việt Nam — đại lý phân phối uỷ quyền cấp 1 của Vinhomes, Novaland, Masterise Homes. Hệ thống định giá AVM sai số ±5%, CRM đa kênh, 45.000+ sản phẩm, 15.000+ môi giới xác thực.",
    foundingDate: "2024",
    address: {
      "@type": "PostalAddress",
      streetAddress: "123 Nguyễn Văn Linh, Phường Tân Phong",
      addressLocality: "Hồ Chí Minh",
      addressRegion: "TP. Hồ Chí Minh",
      postalCode: "70000",
      addressCountry: "VN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 10.77692,
      longitude: 106.700981,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+84-971-132-378",
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: ["Vietnamese", "English"],
      url: `${SITE_URL}/contact`,
    },
    sameAs: [
      "https://www.linkedin.com/company/sgsland",
      "https://www.facebook.com/sgslandvn",
      "https://www.youtube.com/@sgsland",
      "https://zalo.me/sgsland",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 127,
      bestRating: 5,
      worstRating: 1,
    },
    numberOfEmployees: {
      "@type": "QuantitativeValue",
      value: 15000,
    },
    areaServed: ["TP. Hồ Chí Minh", "Đồng Nai", "Bình Dương", "Long An", "Bà Rịa - Vũng Tàu"],
    knowsAbout: [
      "Bất động sản TP.HCM",
      "Định giá AI",
      "CRM bất động sản",
      "Aqua City Novaland",
      "The Global City Masterise",
      "Izumi City Nam Long",
      "Vinhomes Grand Park",
      "Vinhomes Cần Giờ",
    ],
    telephone: "+84971132378",
    email: "info@sgsland.vn",
  };
}
