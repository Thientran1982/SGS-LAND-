// @ts-nocheck
import type { Metadata } from "next";
import { Suspense } from "react";
import type { Listing } from "@/types";
import { MarketplacePage } from "@/components/public/MarketplacePage";
import { getLang } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const en = lang === "en";
  const url = en ? "https://sgsland.vn/en/marketplace" : "https://sgsland.vn/bat-dong-san";
  return {
    title: en
      ? "Property Search | SGS LAND Marketplace"
      : "Tìm kiếm Bất Động Sản | Marketplace SGS LAND",
    description: en
      ? "Search 45,000+ properties across Ho Chi Minh City, Dong Nai and Binh Duong. Filter by area, type, price and bedrooms. Verified legal status, real prices, updated continuously."
      : "Tìm kiếm 45.000+ bất động sản tại TP.HCM, Đồng Nai, Bình Dương. Lọc theo khu vực, loại, giá, số phòng ngủ. Pháp lý rõ ràng, giá thực, cập nhật liên tục.",
    alternates: {
      canonical: url,
      languages: {
        "vi-VN": "https://sgsland.vn/bat-dong-san",
        "en-US": "https://sgsland.vn/en/marketplace",
        "x-default": "https://sgsland.vn/bat-dong-san",
      },
    },
    openGraph: {
      title: en ? "Property Search | SGS LAND Marketplace" : "Tìm kiếm Bất Động Sản | SGS LAND Marketplace",
      description: en
        ? "45,000+ properties in HCMC, Dong Nai, Binh Duong — verified legal status, real prices"
        : "45.000+ BĐS TP.HCM, Đồng Nai, Bình Dương — pháp lý rõ ràng, giá thực",
      url,
    },
  };
}

interface SearchParams {
  q?: string;
  type?: string;
  area?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  page?: string;
  transaction?: string;
  legalStatus?: string;
  direction?: string;
  sort?: string;
}

// SSR — always fetch fresh data, critical for search/SEO
export const dynamic = "force-dynamic";

export default async function MarketplaceRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Fetch results and facets in parallel. Both are needed for the initial
  // page, but serial requests made every filter navigation feel stuck.
  let initialListings: Listing[] = [];
  let totalCount = 0;
  let totalPages = 1;
  const apiBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const listingsUrl = new URL(`${apiBase}/api/public/listings`);
  const toVnd = (v?: string): string => {
    const n = parseFloat(String(v));
    return Number.isFinite(n) && n > 0 ? String(Math.round(n * 1_000_000_000)) : "";
  };
  const priceMin = toVnd(sp.minPrice);
  const priceMax = toVnd(sp.maxPrice);
  if (sp.q) listingsUrl.searchParams.set("search", sp.q);
  if (sp.type) listingsUrl.searchParams.set("type", sp.type);
  if (sp.area) listingsUrl.searchParams.set("location", sp.area);
  if (priceMin) listingsUrl.searchParams.set("priceMin", priceMin);
  if (priceMax) listingsUrl.searchParams.set("priceMax", priceMax);
  if (sp.bedrooms) listingsUrl.searchParams.set("bedroomsMin", sp.bedrooms);
  if (sp.transaction) listingsUrl.searchParams.set("transaction", sp.transaction);
  if (sp.legalStatus) listingsUrl.searchParams.set("legalStatus", sp.legalStatus);
  if (sp.direction) listingsUrl.searchParams.set("direction", sp.direction);
  if (sp.sort) listingsUrl.searchParams.set("sort", sp.sort);
  listingsUrl.searchParams.set("page", sp.page ?? "1");
  listingsUrl.searchParams.set("pageSize", "20");

  const listingsRequest = fetch(listingsUrl.toString(), { cache: "no-store" });
  const facetsRequest = fetch(`${apiBase}/api/public/listings/facets`, { cache: "no-store" });
  const [listingsResult, facetsResult] = await Promise.allSettled([listingsRequest, facetsRequest]);

  if (listingsResult.status === "fulfilled" && listingsResult.value.ok) {
    try {
      const data = await listingsResult.value.json();
      initialListings = data.data ?? [];
      totalCount = data.total ?? 0;
      totalPages = data.totalPages ?? 1;
    } catch {}
  }

  // Facets thuc: khu vuc noi bat, loai hinh/phap ly/huong DISTINCT that,
  // benchmark gia/m2 - dung cho Hero search + pill dong + insight line.
  // KHONG fake khi API loi - facets = null, cac khoi lien quan se an di.
  let facets: {
    topAreas: { name: string; count: number }[];
    types: { value: string; count: number }[];
    legalStatus: { value: string; count: number }[];
    direction: { value: string; count: number }[];
    priceBenchmarks: Record<string, { avgPricePerM2: number; sampleSize: number }>;
  } | null = null;
  if (facetsResult.status === "fulfilled" && facetsResult.value.ok) {
    try {
      facets = await facetsResult.value.json();
    } catch {}
  }

  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>Đang tải...</div>}>
      <>
        <h1 className="sr-only">Tìm kiếm bất động sản tại Việt Nam</h1>
        <MarketplacePage
          initialListings={initialListings}
          totalCount={totalCount}
          totalPages={totalPages}
          searchParams={sp}
          facets={facets}
          locations={facets?.topAreas?.map((area) => area.name) ?? []}
        />
      </>
    </Suspense>
  );
}
