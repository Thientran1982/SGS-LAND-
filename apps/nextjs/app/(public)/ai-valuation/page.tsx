import type { Metadata } from "next";
import { AiValuation } from "@/components/public/AiValuationPage";
import { getLang, langAlternates } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/ai-valuation" : "/ai-valuation"}`;
  return {
    title: en ? "Free AI Property Valuation | SGS LAND" : "Định Giá Bất Động Sản AI Miễn Phí | SGS LAND",
    description: en
      ? "Get a reference property valuation from SGS LAND using address and area data. Results are estimates and should be verified before a transaction."
      : "Nhập địa chỉ và diện tích để nhận mức định giá bất động sản tham khảo từ SGS LAND. Kết quả cần được xác minh trước giao dịch.",
    alternates: { canonical, ...langAlternates("/ai-valuation") },
    openGraph: {
      title: en ? "Free AI Property Valuation | SGS LAND" : "Định Giá Bất Động Sản AI Miễn Phí | SGS LAND",
      description: en
        ? "Reference property valuation from SGS LAND."
        : "Định giá bất động sản tham khảo từ SGS LAND.",
      url: canonical,
    },
  };
}

export const dynamic = "force-dynamic";

export default function AiValuationRoute() {
  return <AiValuation />;
}