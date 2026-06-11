// @ts-nocheck
import { SITE_URL, ORG_ID } from "./constants";

export interface PersonSchema {
  "@context": "https://schema.org";
  "@type": "Person";
  "@id": string;
  name: string;
  jobTitle: string;
  worksFor: { "@id": string };
  url: string;
  sameAs?: string[];
  knowsAbout?: string[];
  description?: string;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates Person JSON-LD schemas for SGS LAND's founding team.
 *
 * Named leadership is a strong E-E-A-T (Experience, Expertise, Authoritativeness,
 * Trustworthiness) signal — AI engines weight sourced expert attribution
 * significantly (+32% citation probability per KDD 2024 research).
 */
export function getFoundersSchema(): PersonSchema[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${SITE_URL}/#person-${slugifyName("Trần Minh Thiện")}`,
      name: "Trần Minh Thiện",
      jobTitle: "Founder & CEO",
      description:
        "Founder & CEO của SGS LAND — nền tảng bất động sản AI hàng đầu Việt Nam. Chuyên gia công nghệ bất động sản (PropTech) với hơn 10 năm kinh nghiệm tại thị trường TP.HCM.",
      worksFor: { "@id": ORG_ID },
      url: `${SITE_URL}/about-us`,
      sameAs: ["https://www.linkedin.com/company/sgsland"],
      knowsAbout: [
        "Bất động sản TP.HCM",
        "PropTech",
        "AI định giá bất động sản",
        "CRM bất động sản",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${SITE_URL}/#person-${slugifyName("Nguyễn Hoàng Nam")}`,
      name: "Nguyễn Hoàng Nam",
      jobTitle: "Chief Technology Officer",
      description:
        "CTO của SGS LAND, kiến trúc sư hệ thống AI định giá AVM và nền tảng CRM đa kênh cho thị trường bất động sản Việt Nam.",
      worksFor: { "@id": ORG_ID },
      url: `${SITE_URL}/about-us`,
      knowsAbout: [
        "AI & Machine Learning",
        "Automated Valuation Model (AVM)",
        "Real Estate Technology",
        "CRM Systems",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${SITE_URL}/#person-${slugifyName("Lê Thị Hoa")}`,
      name: "Lê Thị Hoa",
      jobTitle: "Chief Operating Officer",
      description:
        "COO của SGS LAND, phụ trách vận hành mạng lưới 15.000+ môi giới, quan hệ đối tác với Vinhomes, Novaland và Masterise Homes.",
      worksFor: { "@id": ORG_ID },
      url: `${SITE_URL}/about-us`,
      knowsAbout: [
        "Quản lý vận hành bất động sản",
        "Phát triển đối tác chiến lược",
        "Quản lý sàn giao dịch BĐS",
      ],
    },
  ];
}
