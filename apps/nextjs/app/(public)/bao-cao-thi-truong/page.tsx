import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getBreadcrumbSchema } from "@/lib/schema";
import { AREA_PRICES, AREA_META } from "@/data/areas";

const PAGE_URL = `${SITE_URL}/bao-cao-thi-truong`;

export const metadata: Metadata = {
  title: "Báo Cáo Thị Trường Bất Động Sản TP.HCM & Vùng Ven | SGS LAND",
  description:
    "Báo cáo chỉ số giá bất động sản theo khu vực TP.HCM và vùng ven: giá trung bình/m², biến động YoY, khoảng giá và dự án nổi bật từng khu vực. Cập nhật định kỳ bởi SGS LAND.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Báo Cáo Thị Trường Bất Động Sản | SGS LAND",
    description:
      "Chỉ số giá BĐS theo khu vực TP.HCM và vùng ven, biến động YoY và dự án nổi bật.",
    url: PAGE_URL,
    type: "website",
  },
};

export default function MarketReportPage() {
  const sorted = [...AREA_PRICES].sort(
    (a, b) => b.avgPricePerSqm - a.avgPricePerSqm
  );

  const breadcrumb = getBreadcrumbSchema([
    { name: "Báo cáo thị trường", url: PAGE_URL },
  ]);

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Chỉ số giá BĐS theo khu vực TP.HCM và vùng ven - SGS LAND",
    description:
      "Chỉ số giá bất động sản trung bình theo quận/huyện tại TP.HCM và vùng ven, kèm biến động YoY và dự án nổi bật.",
    url: PAGE_URL,
    creator: { "@type": "Organization", name: "SGS Land Co.ltd.", url: SITE_URL },
    temporalCoverage: AREA_META.quarter || undefined,
    dateModified: AREA_META.dateModified || undefined,
    spatialCoverage: AREA_META.spatial || undefined,
    variableMeasured: "Giá BĐS (triệu VNĐ/m²)",
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/data/area-price-index.json`,
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />

      <nav className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        <Link href="/">Trang chủ</Link>
        {" / "}
        <span style={{ color: "var(--text-primary)" }}>Báo cáo thị trường</span>
      </nav>

      <header className="mb-10">
        <p
          className="text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--primary-600)" }}
        >
          Báo cáo thị trường
        </p>
        <h1
          className="text-4xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Chỉ số giá bất động sản theo khu vực
        </h1>
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          Giá trung bình mỗi m², biến động so với cùng kỳ (YoY) và dự án nổi bật
          của {AREA_PRICES.length} khu vực trọng điểm tại TP.HCM và vùng ven.
          {AREA_META.quarter ? ` Kỳ dữ liệu: ${AREA_META.quarter}.` : ""}
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-elevated)" }}>
              <th className="text-left p-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                Khu vực
              </th>
              <th className="text-right p-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                Giá TB (triệu/m²)
              </th>
              <th className="text-right p-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                Biến động YoY
              </th>
              <th className="text-left p-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                Dự án nổi bật
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="p-4">
                  <Link href={`/${a.slug}`} style={{ color: "var(--primary-600)", fontWeight: 600 }}>
                    {a.area}
                  </Link>
                </td>
                <td className="p-4 text-right" style={{ color: "var(--text-primary)" }}>
                  {a.avgPricePerSqm}
                </td>
                <td className="p-4 text-right" style={{ color: "var(--text-secondary)" }}>
                  {typeof a.yoyChangePct === "number" ? `+${a.yoyChangePct}%` : "-"}
                </td>
                <td className="p-4" style={{ color: "var(--text-secondary)" }}>
                  {a.topProject || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
        Nguồn: SGS LAND - mô hình định giá AVM tổng hợp từ giao dịch công chứng và
        dữ liệu niêm yết. Số liệu mang tính tham khảo, không phải tư vấn đầu tư.
      </p>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/khu-vuc"
          className="px-6 py-3 rounded-xl font-semibold text-white"
          style={{ background: "var(--primary-600)" }}
        >
          Xem theo khu vực
        </Link>
        <Link
          href="/lai-suat-ngan-hang"
          className="px-6 py-3 rounded-xl font-semibold border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Lãi suất & chỉ số vay
        </Link>
      </div>
    </div>
  );
}
