import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getBreadcrumbSchema } from "@/lib/schema";
import { AREA_PRICES } from "@/data/areas";

const PAGE_URL = `${SITE_URL}/khu-vuc`;

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
      url: `${SITE_URL}/${a.slug}`,
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
          Bản đồ khu vực
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
          Giá tham khảo và dự án nổi bật của {AREA_PRICES.length} khu vực trọng
          điểm tại TP.HCM và vùng ven. Nhấn vào từng khu vực để xem chi tiết.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {AREA_PRICES.map((a) => (
          <Link
            key={a.slug}
            href={`/${a.slug}`}
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
                  +{a.yoyChangePct}% YoY
                </span>
              )}
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Giá trung bình:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {a.avgPricePerSqm} triệu/m²
              </strong>
            </p>
            {a.priceRange && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Khoảng giá: {a.priceRange} triệu/m²
              </p>
            )}
            {a.topProject && (
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Dự án nổi bật: {a.topProject}
              </p>
            )}
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
