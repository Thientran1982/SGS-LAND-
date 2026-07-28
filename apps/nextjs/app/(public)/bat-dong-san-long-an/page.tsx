// @ts-nocheck
import { LocalLandingPageTemplate } from "@/components/public/LocalLandingPageTemplate";
import { GEO_PAGES } from "@/data/geo-pages";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bất Động Sản Long An | Đất Nền Long An Giá Tốt",
  description: "Tìm BĐS Long An: đất nền, nhà phố, Waterpoint Nam Long. Giá tốt, pháp lý rõ ràng, giáp TP.HCM, tiềm năng đầu tư cao nhờ hạ tầng kết nối đang hoàn thiện.",
  alternates: { canonical: "https://sgsland.vn/bat-dong-san-long-an" },
};
export const dynamic = "force-dynamic";

export default function BDSLongAnPage() {
  return (
    <LocalLandingPageTemplate {...GEO_PAGES["bat-dong-san-long-an"]} />
  );
}
