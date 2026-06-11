// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400; // 24h cache

const SGS_LAND_SCHEMA = {
  "@context": "https://schema.org",
  "@type": ["Organization", "RealEstateAgent", "LocalBusiness"],
  "@id": "https://sgsland.vn/#organization",
  name: "SGS LAND",
  legalName: "Công ty TNHH Tư Vấn Bất Động Sản SGS",
  alternateName: ["SGS Land", "SGS BĐS", "SGSLAND"],
  taxID: "0312960439",
  foundingDate: "2015",
  url: "https://sgsland.vn",
  logo: "https://sgsland.vn/logo.png",
  image: "https://sgsland.vn/og-image.jpg",
  description:
    "SGS LAND là nền tảng proptech hàng đầu TP.HCM cung cấp AI định giá ±5%, sàn giao dịch BĐS, CRM đa kênh và dữ liệu thị trường bất động sản thời gian thực.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "60 Nguyễn Đình Chiểu",
    addressLocality: "Phường Đa Kao, Quận 1",
    addressRegion: "TP.HCM",
    postalCode: "700000",
    addressCountry: "VN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 10.7879,
    longitude: 106.6972,
  },
  telephone: "+84971132378",
  email: "info@sgsland.vn",
  sameAs: [
    "https://vi.wikipedia.org/wiki/SGS_Land",
    "https://www.wikidata.org/wiki/Q130519839",
    "https://www.facebook.com/sgsland.vn",
    "https://www.linkedin.com/company/sgs-land",
    "https://www.youtube.com/@sgsland",
    "https://zalo.me/sgsland",
  ],
  areaServed: [
    { "@type": "City", name: "TP.HCM", sameAs: "https://www.wikidata.org/wiki/Q1854" },
    { "@type": "City", name: "Biên Hòa", sameAs: "https://www.wikidata.org/wiki/Q1848352" },
    { "@type": "City", name: "Bình Dương" },
  ],
  serviceType: [
    "AI Real Estate Valuation",
    "Real Estate Marketplace",
    "CRM Platform for Agents",
    "Real Estate Market Data",
    "Investment Consulting",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "VND",
    description: "Tư vấn bất động sản miễn phí, định giá AI miễn phí",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "247",
    bestRating: "5",
  },
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "TP.HCM",
      addressCountry: "VN",
    },
  },
  numberOfEmployees: { "@type": "QuantitativeValue", value: 50 },
  memberOf: [
    {
      "@type": "Organization",
      name: "Hiệp hội Bất động sản TP.HCM (HoREA)",
      url: "https://horea.org.vn",
    },
  ],
  partnerOf: [
    { "@type": "Organization", name: "Vinhomes", url: "https://vinhomes.vn" },
    { "@type": "Organization", name: "Novaland", url: "https://novaland.com.vn" },
    { "@type": "Organization", name: "Nam Long Group", url: "https://namlonggroup.com" },
    { "@type": "Organization", name: "Masterise Homes", url: "https://masterisehomes.com" },
  ],
};

export async function GET() {
  return NextResponse.json(SGS_LAND_SCHEMA, {
    headers: {
      "Content-Type": "application/ld+json",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type": "schema.org/Organization",
    },
  });
}
