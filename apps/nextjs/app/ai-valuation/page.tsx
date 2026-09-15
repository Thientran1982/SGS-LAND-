import type { Metadata } from "next";
import { AiValuation } from "@/components/public/AiValuationPage";
import { getLang, langAlternates } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/ai-valuation" : "/ai-valuation"}`;
  return {
    title: "Định Giá Bất Động Sản AI Miễn Phí | Sai Số ±5% — SGS LAND",
    description:
      "Công cụ định giá bất động sản AI miễn phí của SGS LAND: nhập địa chỉ và diện tích, nhận giá thị trường ước tính trong 30 giây với sai số ±5% theo chuẩn TĐGVN/IVS. Đối chiếu trên 45.000+ giao dịch lịch sử tại TP.HCM, Đồng Nai, Bình Dương.",
    alternates: { canonical, ...langAlternates("/ai-valuation") },
    openGraph: {
      title: "Định Giá Bất Động Sản AI Miễn Phí | SGS LAND",
      description:
        "Nhập địa chỉ + diện tích, nhận giá thị trường ước tính ±5% trong 30 giây theo chuẩn TĐGVN/IVS.",
      url: canonical,
    },
  };
}

export const dynamic = "force-dynamic";

export default function AiValuationRoute() {
  return <AiValuation />;
}
