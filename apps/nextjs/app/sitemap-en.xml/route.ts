// @ts-nocheck
import { sitemapVi } from "../sitemap";

const BASE = "https://sgsland.vn";

export const dynamic = "force-dynamic";

/** Ban tieng Anh cua sitemap: moi URL /x -> /en/x, kem hreflang vi/en/x-default. */
export async function GET() {
  const entries = sitemapVi().map((e: any) => {
    const path = String(e.url).replace(BASE, "") || "/";
    const enUrl = path === "/" ? BASE + "/en" : BASE + "/en" + path;
    return { viUrl: BASE + path, enUrl, lastModified: e.lastModified, changeFrequency: e.changeFrequency, priority: e.priority };
  });

  const iso = (d: any) => (d instanceof Date ? d : new Date(d)).toISOString();

  const body = entries
    .map(
      (e) =>
        "  <url>\n" +
        "    <loc>" + e.enUrl + "</loc>\n" +
        "    <lastmod>" + iso(e.lastModified) + "</lastmod>\n" +
        "    <changefreq>" + e.changeFrequency + "</changefreq>\n" +
        "    <priority>" + e.priority + "</priority>\n" +
        '    <xhtml:link rel="alternate" hreflang="vi-VN" href="' + e.viUrl + '"/>\n' +
        '    <xhtml:link rel="alternate" hreflang="en-US" href="' + e.enUrl + '"/>\n' +
        '    <xhtml:link rel="alternate" hreflang="x-default" href="' + e.viUrl + '"/>\n' +
        "  </url>"
    )
    .join("\n");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    body +
    "\n</urlset>";

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
