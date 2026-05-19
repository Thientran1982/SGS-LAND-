import type { Metadata } from "next";
import { Suspense } from "react";
import type { Listing } from "@/types";
import { MarketplacePage } from "@/components/public/MarketplacePage";

export const metadata: Metadata = {
  title: "Tìm kiếm Bất Động Sản | Marketplace SGS LAND",
  description:
    "Tìm kiếm 45.000+ bất động sản tại TP.HCM, Đồng Nai, Bình Dương. Lọc theo khu vực, loại, giá, số phòng ngủ. Pháp lý rõ ràng, giá thực, cập nhật liên tục.",
  alternates: { canonical: "https://sgsland.vn/marketplace" },
  openGraph: {
    title: "Tìm kiếm Bất Động Sản | SGS LAND Marketplace",
    description: "45.000+ BĐS TP.HCM, Đồng Nai, Bình Dương — pháp lý rõ ràng, giá thực",
    url: "https://sgsland.vn/marketplace",
  },
};

interface SearchParams {
  q?: string;
  type?: string;
  area?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  page?: string;
  transaction?: string;
}

// SSR — always fetch fresh data, critical for search/SEO
export const dynamic = "force-dynamic";

export default async function MarketplaceRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Fetch first-page results SSR for SEO / initial hydration
  let initialListings: Listing[] = [];
  let totalCount = 0;
  let totalPages = 1;

  try {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/public/listings`
    );
    if (sp.q)           url.searchParams.set("q", sp.q);
    if (sp.type)        url.searchParams.set("type", sp.type);
    if (sp.area)        url.searchParams.set("area", sp.area);
    if (sp.minPrice)    url.searchParams.set("minPrice", sp.minPrice);
    if (sp.maxPrice)    url.searchParams.set("maxPrice", sp.maxPrice);
    if (sp.bedrooms)    url.searchParams.set("bedrooms", sp.bedrooms);
    if (sp.transaction) url.searchParams.set("transaction", sp.transaction);
    url.searchParams.set("page", sp.page ?? "1");
    url.searchParams.set("limit", "20");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      initialListings = data.data ?? [];
      totalCount = data.total ?? 0;
      totalPages = data.totalPages ?? 1;
    }
  } catch {}

  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>Đang tải...</div>}>
      <MarketplacePage
        initialListings={initialListings}
        totalCount={totalCount}
        totalPages={totalPages}
        searchParams={sp}
      />
    </Suspense>
  );
}
