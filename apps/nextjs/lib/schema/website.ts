// @ts-nocheck
import { SITE_URL, SITE_NAME, WEBSITE_ID, ORG_ID } from "./constants";

export interface WebsiteSchema {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  name: string;
  alternateName: string[];
  url: string;
  inLanguage: string[];
  description: string;
  potentialAction: {
    "@type": "SearchAction";
    target: {
      "@type": "EntryPoint";
      urlTemplate: string;
    };
    "query-input": string;
  };
  publisher: { "@id": string };
}

export function getWebsiteSchema(): WebsiteSchema {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: ["SGSID", "SGS Land Corp", "SGS Land Enterprise"],
    url: SITE_URL,
    inLanguage: ["vi", "en"],
    description:
      "Nền tảng mua bán và quản lý bất động sản hàng đầu Việt Nam — định giá AI ±5%, CRM đa kênh, 45.000+ sản phẩm cập nhật realtime.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/marketplace?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: { "@id": ORG_ID },
  };
}
