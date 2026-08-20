// @ts-nocheck
import type { MetadataRoute } from "next";
const BASE = "https://sgsland.vn";
export function sitemapVi(): MetadataRoute.Sitemap {
  // A lastmod that is always "today" carries no information and is discounted
// by Google and by AI crawlers. Use a stable content date and bump it when
// the URL set / page content below actually changes.
const now = new Date("2026-08-21T00:00:00Z");
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,                            lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/marketplace`,                 lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE}/ai-valuation`,                lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/crm-platform`,                lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/du-an`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/news`,                        lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE}/about-us`,                    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/chuyen-gia`,                  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`,                     lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/careers`,                     lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${BASE}/help-center`,                 lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    // Local landing pages
    { url: `${BASE}/bat-dong-san-dong-nai`,       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-long-thanh`,     lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-nhon-trach`,     lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-thu-duc`,        lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-binh-duong`,     lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-quan-7`,         lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-phu-nhuan`,      lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-binh-chanh`,     lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-can-gio`,        lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-binh-thanh`,     lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bat-dong-san-long-an`,        lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    // Legal
    { url: `${BASE}/privacy-policy`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/terms-of-service`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];

  const projectSlugs = [
    "aqua-city", "the-global-city", "izumi-city", "vinhomes-can-gio",
    "vinhomes-grand-park", "vinhomes-central-park", "masterise-homes",
    "lumiere", "waterpoint", "the-privia", "van-phuc-city", "sala",
    "thu-thiem", "manhattan", "son-kim-land",
    // New 2026 GEO Tier S projects
    "vinhomes-hoc-mon", "masteri-cosmo-central",
  ];
  const projectRoutes: MetadataRoute.Sitemap = projectSlugs.map((slug) => ({
    url: `${BASE}/du-an/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const miniSites: MetadataRoute.Sitemap = [
    { url: `${BASE}/p/mcc`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];
  // FAQ content pages (high GEO value)
  const faqRoutes: MetadataRoute.Sitemap = [
  ];
  const devSlugs = ["vinhomes", "novaland", "masterise-homes", "nam-long", "van-phuc-group", "son-kim-land", "dai-quang-minh"];
  const devRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/chu-dau-tu`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 },
    ...devSlugs.map((s) => ({ url: `${BASE}/chu-dau-tu/${s}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
  return [...staticRoutes, ...projectRoutes, ...miniSites, ...faqRoutes, ...devRoutes];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapVi();
}