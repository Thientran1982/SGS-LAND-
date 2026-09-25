import type { Metadata } from "next";
import UserGuideView from "@/components/public/UserGuideView";
import { getLang } from "@/lib/lang";
import { normalizeMetaDescription } from "@/lib/seo/meta-utils";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: { absolute: en ? "SGS LAND User Guide | CRM & AI Property Platform" : "Hướng Dẫn Sử Dụng SGS LAND | CRM & AI BĐS" },
    description: normalizeMetaDescription(en
      ? "Full user guide for the SGS LAND platform: quick start, dashboard, leads and CRM pipeline, AI valuation, inventory, omnichannel inbox, contracts, sequences, reports, tasks, knowledge base and settings."
      : "Hướng dẫn sử dụng đầy đủ nền tảng SGS LAND: bắt đầu nhanh, dashboard, quản lý lead & CRM, định giá AI, kho hàng, hộp thư đa kênh, hợp đồng, chiến dịch tự động, báo cáo, công việc, tri thức và cài đặt.",
      en ? " Includes practical steps for teams managing property leads and inventory." : " Có bước thực hành cho đội ngũ quản lý lead, kho hàng và giao dịch BĐS."),
    alternates: {
      canonical: "https://sgsland.vn/huong-dan-su-dung",
      languages: {
        "vi-VN": "https://sgsland.vn/huong-dan-su-dung",
        "en-US": "https://sgsland.vn/en/huong-dan-su-dung",
        "x-default": "https://sgsland.vn/huong-dan-su-dung",
      },
    },
  };
}

export const dynamic = "force-dynamic";

export default function UserGuidePage() {
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-3 gap-3" aria-label="SGS LAND platform facts">
          {[
            { value: "0 đ", label: "phí cho người mua" },
            { value: "2 lớp", label: "kiểm tra pháp lý" },
            { value: "3 giây", label: "định giá AI tham khảo" },
          ].map((fact) => (
            <div key={fact.value} className="rounded-2xl p-4 text-center" style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}>
              <strong className="block text-lg sm:text-xl" style={{ color: "var(--primary-600)" }}>{fact.value}</strong>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{fact.label}</span>
            </div>
          ))}
        </div>
      </div>
      <UserGuideView />
    </>
  );
}
