import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getBreadcrumbSchema, getFAQSchema } from "@/lib/schema";
import { AREA_PRICES, AREA_META } from "@/data/areas";

const PAGE_URL = `${SITE_URL}/bao-cao-thi-truong`;
const AREA_BASE = "/khu-vuc";

const FAQ_ITEMS = [
  {
    question: "Báo cáo thị trường này đo lường điều gì?",
    answer:
      "Báo cáo tổng hợp giá tham khảo bình quân theo m², khoảng giá tham khảo và biến động so với cùng kỳ của 11 khu vực tại TP.HCM và vùng ven. Đây là dữ liệu tham chiếu theo khu vực, không phải bảng giá của một dự án hay cam kết giao dịch.",
  },
  {
    question: "Kỳ dữ liệu và thời điểm cập nhật là khi nào?",
    answer:
      `Bộ dữ liệu hiện ghi nhận kỳ ${AREA_META.quarter} và được cập nhật ngày ${AREA_META.dateModified}. Người đọc nên kiểm tra lại dữ liệu mới nhất, giá thực tế và hồ sơ gốc trước khi ra quyết định.`,
  },
  {
    question: "Giá tham khảo trong báo cáo có phải giá bán chính thức không?",
    answer:
      "Không. Giá tham khảo được dùng để so sánh giữa các khu vực; giá thực tế còn phụ thuộc vào loại hình, vị trí, diện tích, pháp lý, chất lượng tài sản, phương thức thanh toán và thời điểm. Báo cáo không thay thế bảng giá chính thức hoặc tư vấn đầu tư.",
  },
  {
    question: "Làm thế nào để đọc biến động so với cùng kỳ?",
    answer:
      "Phần trăm dương cho thấy chỉ số tham khảo hiện tại cao hơn mốc so sánh trong bộ dữ liệu; nó không đồng nghĩa mọi sản phẩm trong khu vực đều tăng cùng mức và không dự báo chắc chắn giá tương lai.",
  },
];

export const metadata: Metadata = {
  title: "Báo cáo thị trường bất động sản TP.HCM 2026 | SGS LAND",
  description:
    "Báo cáo giá bất động sản theo khu vực TP.HCM và vùng ven: giá tham khảo bình quân, khoảng giá, biến động cùng kỳ, kỳ dữ liệu, phương pháp và giới hạn sử dụng.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Báo cáo thị trường bất động sản TP.HCM và vùng ven",
    description:
      "So sánh chỉ số giá tham khảo theo 11 khu vực, kèm kỳ dữ liệu, phương pháp và caveat xác minh.",
    url: PAGE_URL,
    type: "article",
  },
};

function areaHref(slug: string) {
  return `${AREA_BASE}/${slug}`;
}

export default function MarketReportPage() {
  const sorted = [...AREA_PRICES].sort((a, b) => b.avgPricePerSqm - a.avgPricePerSqm);
  const highest = sorted[0];
  const fastestGrowth = [...AREA_PRICES]
    .filter((area) => typeof area.yoyChangePct === "number")
    .sort((a, b) => (b.yoyChangePct ?? 0) - (a.yoyChangePct ?? 0))[0];

  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Báo cáo thị trường", url: PAGE_URL },
  ]);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bảng chỉ số giá bất động sản theo khu vực",
    numberOfItems: sorted.length,
    itemListElement: sorted.map((area, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: area.area,
      url: `${SITE_URL}${areaHref(area.slug)}`,
    })),
  };
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Chỉ số giá bất động sản theo khu vực TP.HCM và vùng ven",
    description:
      "Giá tham khảo bình quân, khoảng giá và biến động so với cùng kỳ theo khu vực.",
    url: PAGE_URL,
    creator: { "@type": "Organization", name: "SGS LAND", url: SITE_URL },
    publisher: { "@type": "Organization", name: "SGS LAND", url: SITE_URL },
    temporalCoverage: AREA_META.quarter,
    dateModified: AREA_META.dateModified,
    spatialCoverage: { "@type": "Place", name: AREA_META.spatial },
    variableMeasured: "Giá bất động sản tham khảo (triệu VNĐ/m²)",
    measurementTechnique:
      "Tổng hợp chỉ số tham khảo theo dữ liệu hiện có của SGS LAND; cần đối chiếu với nguồn và sản phẩm cụ thể.",
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/data/area-price-index.json`,
    },
  };
  const faqSchema = getFAQSchema(FAQ_ITEMS, PAGE_URL);

  return (
    <main className="bg-[var(--bg-page)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

        <nav className="mb-8 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href="/" className="hover:underline">Trang chủ</Link>
          <span className="mx-2">/</span>
          <span style={{ color: "var(--text-primary)" }}>Báo cáo thị trường</span>
        </nav>

        <header className="max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>
            Báo cáo dữ liệu · {AREA_META.dateModified}
          </p>
          <h1 className="text-4xl font-bold tracking-[-.04em] sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            Báo cáo thị trường bất động sản TP.HCM và vùng ven
          </h1>
          <p className="mt-5 text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            Giá tham khảo bình quân, khoảng giá và biến động so với cùng kỳ của {AREA_PRICES.length} khu vực.
            Kỳ dữ liệu: {AREA_META.quarter}. Đây là báo cáo tham khảo theo khu vực, không phải bảng giá chính thức.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>Tóm tắt nhanh</p>
          <h2 className="mt-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Báo cáo cho thấy gì?</h2>
          <p className="mt-3 max-w-4xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            Trong bộ dữ liệu hiện tại, {highest.area} có giá tham khảo bình quân cao nhất ở mức {highest.avgPricePerSqm} triệu/m².
            {fastestGrowth && ` ${fastestGrowth.area} có mức biến động tham khảo cao nhất, +${fastestGrowth.yoyChangePct}% so với cùng kỳ.`}
            Các con số này chỉ giúp định hướng so sánh; cần kiểm tra loại tài sản, vị trí và hồ sơ cụ thể trước khi sử dụng.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl p-4" style={{ background: "var(--ui-surface-subtle)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--primary-600)" }}>{AREA_PRICES.length}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>khu vực tham chiếu</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--ui-surface-subtle)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--primary-600)" }}>{highest.avgPricePerSqm} triệu/m²</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>mức bình quân cao nhất trong bảng</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--ui-surface-subtle)" }}>
              <p className="text-2xl font-bold" style={{ color: "var(--primary-600)" }}>{AREA_META.quarter}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>kỳ dữ liệu</p>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="bang-chi-so">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>01 · So sánh khu vực</p>
            <h2 id="bang-chi-so" className="mt-2 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Bảng chỉ số giá tham khảo</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Nhấn vào tên khu vực để xem vị trí, loại hình, khoảng giá và checklist xác minh riêng.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">So sánh giá bất động sản tham khảo theo khu vực</caption>
              <thead>
                <tr style={{ background: "var(--ui-surface-subtle)" }}>
                  {["Khu vực", "Giá tham khảo bình quân", "Biến động so với cùng kỳ", "Khoảng giá tham khảo", "Điểm tham chiếu", "Kỳ dữ liệu"].map((heading) => (
                    <th key={heading} className="p-4 text-left font-semibold" style={{ color: "var(--text-primary)" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((area) => (
                  <tr key={area.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-4"><Link href={areaHref(area.slug)} className="font-semibold hover:underline" style={{ color: "var(--primary-600)" }}>{area.area}</Link></td>
                    <td className="p-4 font-semibold" style={{ color: "var(--text-primary)" }}>{area.avgPricePerSqm} triệu/m²</td>
                    <td className="p-4" style={{ color: "var(--text-secondary)" }}>{typeof area.yoyChangePct === "number" ? `+${area.yoyChangePct}%` : "Chưa có dữ liệu"}</td>
                    <td className="p-4" style={{ color: "var(--text-secondary)" }}>{area.priceRange ? `${area.priceRange} triệu/m²` : "Chưa xác định"}</td>
                    <td className="p-4" style={{ color: "var(--text-secondary)" }}>{area.topProject || "Chưa có"}</td>
                    <td className="p-4" style={{ color: "var(--text-tertiary)" }}>{area.quarter || AREA_META.quarter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>
            Nguồn hiển thị: bộ dữ liệu khu vực của SGS LAND. Các nhãn “tham khảo” và “điểm tham chiếu” không phải bảng giá, hồ sơ pháp lý hoặc cam kết thanh khoản.
          </p>
        </section>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>02 · Phương pháp</p>
            <h2 className="mt-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Cách đọc và sử dụng dữ liệu</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              <li><strong style={{ color: "var(--text-primary)" }}>Giá bình quân:</strong> dùng để so sánh cấp khu vực, không đại diện cho mọi sản phẩm.</li>
              <li><strong style={{ color: "var(--text-primary)" }}>Khoảng giá:</strong> là phạm vi tham khảo trong bộ dữ liệu, cần đối chiếu theo loại hình và pháp lý.</li>
              <li><strong style={{ color: "var(--text-primary)" }}>Biến động cùng kỳ:</strong> là chỉ báo của bộ dữ liệu, không phải dự báo giá tương lai.</li>
            </ol>
          </section>
          <section className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>03 · Giới hạn</p>
            <h2 className="mt-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Điều cần xác minh trước giao dịch</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              <li>Giá chào bán, giá giao dịch và chi phí sở hữu của đúng tài sản.</li>
              <li>Quy hoạch, pháp lý, thế chấp, điều kiện chuyển nhượng và tiến độ.</li>
              <li>Ranh khu vực, thời gian di chuyển và tình trạng hạ tầng tại thời điểm xem.</li>
            </ul>
          </section>
        </div>

        <section className="mt-12" aria-labelledby="faq">
          <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--primary-600)" }}>04 · Câu hỏi thường gặp</p>
          <h2 id="faq" className="mt-2 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Giải đáp về báo cáo thị trường</h2>
          <div className="mt-5 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="rounded-2xl border px-5 py-4" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                <summary className="cursor-pointer font-semibold" style={{ color: "var(--text-primary)" }}>{item.question}</summary>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap gap-3">
          <Link href="/khu-vuc" className="rounded-xl px-6 py-3 font-semibold text-white" style={{ background: "var(--primary-600)" }}>Xem toàn bộ khu vực</Link>
          <Link href="/ai-valuation" className="rounded-xl border px-6 py-3 font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Định giá tham khảo</Link>
          <Link href="/lai-suat-ngan-hang" className="rounded-xl border px-6 py-3 font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Lãi suất & chỉ số vay</Link>
        </footer>
      </div>
    </main>
  );
}