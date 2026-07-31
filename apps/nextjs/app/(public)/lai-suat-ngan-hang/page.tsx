// @ts-nocheck
import type { Metadata } from "next";
import { BankRatesPage } from "@/components/public/BankRatesPage";

export const metadata: Metadata = {
  title: "Lãi Suất Ngân Hàng 2026 | Vay Mua BĐS",
  description:
    "Tổng hợp lãi suất vay mua nhà tốt nhất 2026 từ Vietcombank, BIDV, VietinBank, Techcombank, VPBank, MB. Tính toán khoản vay thông minh cùng SGS LAND.",
  keywords: ["lãi suất vay mua nhà 2026", "lãi suất ngân hàng bất động sản", "vay mua nhà tốt nhất"],
  alternates: { canonical: "https://sgsland.vn/lai-suat-ngan-hang", languages: { "vi-VN": "https://sgsland.vn/lai-suat-ngan-hang", "en-US": "https://sgsland.vn/en/lai-suat-ngan-hang", "x-default": "https://sgsland.vn/lai-suat-ngan-hang" } },
};

// ISR — bank rates change weekly
export const dynamic = "force-dynamic";

export default async function BankRatesRoute() {
  let bankRates: unknown[] = [];

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/bank-rates`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) bankRates = await res.json();
  } catch {}

  return <BankRatesPage bankRates={bankRates} />;
}
