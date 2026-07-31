import type { Metadata } from "next";
import ConsignmentView from "@/components/public/ConsignmentView";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Property Consignment" : "Ký Gửi Bất Động Sản",
    description: en
      ? "Consign your property with SGS LAND: free registration, no upfront cost, AI valuation, legal review and a fee only on a successful transaction. Commission 1–2% on sales, one month's rent on leases."
      : "Ký gửi BĐS tại SGS LAND: đăng ký miễn phí, không phí ban đầu, định giá AI, thẩm định pháp lý, hoa hồng chỉ thu khi giao dịch thành công. Mua bán 1–2%, cho thuê 1 tháng tiền thuê.",
    alternates: {
      canonical: "https://sgsland.vn/ky-gui-bat-dong-san",
      languages: {
        "vi-VN": "https://sgsland.vn/ky-gui-bat-dong-san",
        "en-US": "https://sgsland.vn/en/ky-gui-bat-dong-san",
        "x-default": "https://sgsland.vn/ky-gui-bat-dong-san",
      },
    },
  };
}

export const dynamic = "force-dynamic";

export default function ConsignmentPage() {
  return <ConsignmentView />;
}
