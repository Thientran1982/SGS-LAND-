// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Thủ Đức 2026 | The Global City, Thủ Thiêm",
  description: "BDS Thu Duc 2026: Masteri Cosmo The Global City tu 6,4 ty, Empire City Thu Thiem, can ho Thu Thiem gia bao nhieu. Quy hoach Thu Duc 2026, du an moi nhat. SGS LAND - dai ly F1 Masterise Homes.",
  keywords: "bat dong san Thu Duc, The Global City Masterise, Thu Thiem 2026, can ho Thu Thiem gia bao nhieu, Empire City tien do, Masteri Cosmo Thu Duc, so sanh du an Thu Thiem",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-thu-duc", languages: { "vi-VN": "https://sgsland.vn/bat-dong-san-thu-duc", "en-US": "https://sgsland.vn/en/bat-dong-san-thu-duc", "x-default": "https://sgsland.vn/bat-dong-san-thu-duc" } },
  openGraph: {
    title: "BDS Thu Duc 2026 | The Global City | Thu Thiem",
    description: "Thi truong BDS Thu Duc 2026: The Global City, Thu Thiem, can ho tu 6,4 ty. Cap nhat quy hoach, tien do.",
    url: "https://sgsland.vn/bat-dong-san-thu-duc",
    type: "website",
  },
};
export const dynamic = "force-dynamic";

export default function BDSThuDucPage() {
  return (
    <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-thu-duc"]} />
  );
}
