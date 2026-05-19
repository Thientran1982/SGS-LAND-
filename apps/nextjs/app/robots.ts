import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/leads", "/contracts", "/inbox", "/api/", "/login"],
      },
    ],
    sitemap: "https://sgsland.vn/sitemap.xml",
    host: "https://sgsland.vn",
  };
}
