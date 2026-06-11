// @ts-nocheck
/**
 * SGS LAND Author/Person Schema - GEO Tier S
 * E-E-A-T: Experience, Expertise, Authoritativeness, Trustworthiness
 */

import { SITE_URL, ORG_ID } from "./constants";

export interface PersonSchemaFull {
  "@context": "https://schema.org";
  "@type": "Person";
  "@id": string;
  name: string;
  jobTitle: string;
  description: string;
  url: string;
  image?: { "@type": "ImageObject"; url: string; };
  sameAs?: string[];
  worksFor: { "@id": string };
  knowsAbout?: string[];
  hasCredential?: {
    "@type": "EducationalOccupationalCredential";
    credentialCategory: string;
    name: string;
  }[];
  alumniOf?: { "@type": "Organization"; name: string };
}

// Founder / CEO
export function getFounderSchema(): PersonSchemaFull {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#founder-tran-minh-thien`,
    name: "Trần Minh Thiện",
    jobTitle: "Founder & CEO tại SGS LAND",
    description: "Trần Minh Thiện là nhà sáng lập và CEO của SGS LAND - nền tảng PropTech bất động sản AI hàng đầu Việt Nam. Hơn 10 năm kinh nghiệm trong lĩnh vực bất động sản, công nghệ và tài chính.",
    url: `${SITE_URL}/about-us`,
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/team/tran-minh-thien.jpg`,
    },
    sameAs: [
      "https://www.linkedin.com/in/tran-minh-thien-sgsland",
      "https://twitter.com/traminh_sgsland",
    ],
    worksFor: { "@id": ORG_ID },
    knowsAbout: [
      "Bất động sản TP.HCM",
      "PropTech Việt Nam",
      "AI định giá bất động sản",
      "CRM môi giới",
      "Đầu tư bất động sản",
    ],
    hasCredential: [
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Chứng chỉ môi giới bất động sản",
        name: "Chứng chỉ hành nghề môi giới BĐS - Bộ Xây dựng Việt Nam",
      },
    ],
  };
}

// Lead Expert - BĐS
export function getExpertSchema(params: {
  name: string;
  slug: string;
  title: string;
  description: string;
  expertise: string[];
  linkedinUrl?: string;
}): PersonSchemaFull {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/tac-gia/${params.slug}#person`,
    name: params.name,
    jobTitle: params.title,
    description: params.description,
    url: `${SITE_URL}/tac-gia/${params.slug}`,
    worksFor: { "@id": ORG_ID },
    knowsAbout: params.expertise,
    sameAs: params.linkedinUrl ? [params.linkedinUrl] : [],
  };
}

// Article author schema for news/blog pages
export function getArticleAuthorSchema(authorName: string, authorSlug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/tac-gia/${authorSlug}#person`,
    name: authorName,
    url: `${SITE_URL}/tac-gia/${authorSlug}`,
    worksFor: { "@id": ORG_ID },
    description: `Chuyên gia bất động sản tại SGS LAND với nhiều năm kinh nghiệm tư vấn mua bán, đầu tư BĐS tại TP.HCM và các tỉnh lân cận.`,
  };
}

// ProfilePage for expert pages
export function getProfilePageSchema(params: {
  name: string;
  slug: string;
  title: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${SITE_URL}/tac-gia/${params.slug}`,
    dateCreated: "2024-01-01",
    dateModified: new Date().toISOString().split("T")[0],
    mainEntity: {
      "@type": "Person",
      "@id": `${SITE_URL}/tac-gia/${params.slug}#person`,
      name: params.name,
      jobTitle: params.title,
      description: params.description,
      worksFor: { "@id": ORG_ID },
    },
  };
}
