import type { Metadata } from "next";
import UserGuideView from "@/components/public/UserGuideView";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "User Guide" : "Hướng Dẫn Sử Dụng",
    description: en
      ? "Full user guide for the SGS LAND platform: quick start, dashboard, leads and CRM pipeline, AI valuation, inventory, omnichannel inbox, contracts, sequences, reports, tasks, knowledge base and settings."
      : "Hướng dẫn sử dụng đầy đủ nền tảng SGS LAND: bắt đầu nhanh, dashboard, quản lý lead & CRM, định giá AI, kho hàng, hộp thư đa kênh, hợp đồng, chiến dịch tự động, báo cáo, công việc, tri thức và cài đặt.",
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
  return <UserGuideView />;
}
