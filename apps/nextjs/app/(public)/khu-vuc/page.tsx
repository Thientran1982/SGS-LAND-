import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getBreadcrumbSchema } from "@/lib/schema";
import { AREA_PRICES } from "@/data/areas";

const PAGE_URL = `${SITE_URL}/khu-vuc`;

const AREA_DETAIL_SLUGS = new Set([
  "bat-dong-san-quan-7",
  "bat-dong-san-long-an",
  "bat-dong-san-dong-nai",
  "bat-dong-san-binh-thanh",
]);

function areaHref(slug: string) {
  return AREA_DETAIL_SLUGS.has(slug) ? `/khu-vuc/${slug}` : `/${slug}`;
}

export const metadata: Metadata = {
  title: "Bất Động Sản Theo Khu Vực TP.HCM & Vùng Ven",
  description:
    "Khám phá bất động sản theo khu vực: Thủ Đức, Quận 7, Bình Thạnh, Phú Nhuận, Bình Chánh, Cần Giờ, Hóc Môn, Đồng Nai, Long Thành, Bình Dương, Long An. Giá tham khảo và dự án nổi bật từng khu vực.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Bất Động Sản Theo Khu Vực",
    description:
      "Bản đồ giá và dự án nổi bật theo từng khu vực TP.HCM và vùng ven.",
    url: PAGE_URL,
    type: "website",
  },
};

export default function KhuVucPage() {
  const breadcrumb = getBreadcrumbSchema([{ name: "Khu vực", url: PAGE_URL }]);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bất động sản theo khu vực - SGS LAND",
    itemListElement: AREA_PRICES.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Bất động sản ${a.area}`,
      url: `${SITE_URL}${areaHref(a.slug)}`,
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <nav className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        <Link href="/">Trang chủ</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>Khu vực</span>
      </nav>

      <header className="text-center mb-12">
        <p
          className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--primary-600)" }}
        >
          BẢN ĐỒ KHU VỰC · GIÁ THAM KHẢO
        </p>
        <h1
          className="text-4xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Bất động sản theo khu vực
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Tổng hợp giá tham khảo và thông tin khu vực của {AREA_PRICES.length} địa bàn
          tại TP.HCM và vùng ven. Nhấn vào từng card để xem vị trí, sản phẩm,
          dữ liệu tham chiếu và checklist cần xác minh.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {AREA_PRICES.map((a) => (
          <Link
            key={a.slug}
            href={areaHref(a.slug)}
            className="block p-6 rounded-2xl border hover:shadow-md transition"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2
                className="text-xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {a.area}
              </h2>
              {typeof a.yoyChangePct === "number" && (
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--primary-600)" }}
                >
                  +{a.yoyChangePct}% so với cùng kỳ
                </span>
              )}
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Giá tham khảo bình quân:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {a.avgPricePerSqm} triệu/m²
              </strong>
            </p>
            {a.priceRange && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Khoảng giá tham khảo: {a.priceRange} triệu/m²
              </p>
            )}
            {a.topProject && (
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Điểm tham chiếu: {a.topProject}
              </p>
            )}
            <p className="text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
              Dữ liệu tham khảo · {a.quarter ?? "chưa xác định"}
            </p>
          </Link>
        ))}
      </div>

      <div className="text-center mt-14">
        <Link
          href="/bao-cao-thi-truong"
          className="inline-block px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: "var(--primary-600)" }}
        >
          Xem báo cáo thị trường chi tiết
        </Link>
      </div>
    </div>
  );
}
