import { SITE_URL, SITE_NAME } from "./constants";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  const allItems = [
    { name: SITE_NAME, url: SITE_URL },
    ...items,
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Pre-built breadcrumbs for main sections
export const BREADCRUMBS = {
  marketplace: [{ name: "Sàn giao dịch BĐS", url: `${SITE_URL}/marketplace` }],
  duAn: [{ name: "Dự án bất động sản", url: `${SITE_URL}/du-an` }],
  aiValuation: [{ name: "Định giá AI", url: `${SITE_URL}/ai-valuation` }],
  crmPlatform: [{ name: "CRM Platform", url: `${SITE_URL}/crm-platform` }],
  aboutUs: [{ name: "Giới thiệu SGS LAND", url: `${SITE_URL}/about-us` }],
  marketData: [{ name: "Dữ liệu thị trường", url: `${SITE_URL}/market-data` }],
};

export function getProjectBreadcrumbSchema(projectName: string, projectSlug: string) {
  return getBreadcrumbSchema([
    { name: "Dự án bất động sản", url: `${SITE_URL}/du-an` },
    { name: projectName, url: `${SITE_URL}/du-an/${projectSlug}` },
  ]);
}
