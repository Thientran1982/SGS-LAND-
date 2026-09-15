import type { Metadata } from "next";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, getFAQSchema, SITE_URL } from "@/lib/schema";
import type { FAQItem } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";
import {
  GEO_DEFAULT_EVIDENCE_NOTE,
  GEO_EDITOR_NAME,
  GEO_REVIEW_DATE,
  buildGeoDirectAnswer,
  getGeoEvidenceLinks,
} from "@/lib/seo/geo-provenance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/du-an/vinhomes-hoc-mon";
const PROJECT_NAME = "Vinhomes Hóc Môn";

const VHM_METADATA: Metadata = {
  title: `${PROJECT_NAME} — Thông tin dự án | SGS LAND`,
  description:
    "Thông tin tham khảo về Vinhomes Hóc Môn: vị trí, sản phẩm và các điểm cần xác minh. Giá, pháp lý, tiến độ và tư cách phân phối cần được đối chiếu với hồ sơ hiện hành.",
  keywords: [
    "Vinhomes Hóc Môn",
    "Vinhomes Smart City Hóc Môn",
    "dự án Hóc Môn 2026",
    "BĐS Hóc Môn Vành đai 3",
  ],
  alternates: { canonical: `${SITE_URL}${CANONICAL_PATH}` },
  openGraph: {
    type: "article",
    title: `${PROJECT_NAME} — Thông tin dự án`,
    description:
      "Tổng hợp thông tin tham khảo về Vinhomes Hóc Môn và các nội dung cần kiểm tra trước giao dịch.",
    url: `${SITE_URL}${CANONICAL_PATH}`,
    siteName: "SGS LAND",
    locale: "vi_VN",
    modifiedTime: GEO_REVIEW_DATE,
  },
  twitter: {
    card: "summary_large_image",
    title: `${PROJECT_NAME} — Thông tin tham khảo`,
    description: "Thông tin tham khảo và các điểm cần xác minh trước giao dịch.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `${SITE_URL}${en ? `/en${CANONICAL_PATH}` : CANONICAL_PATH}`;
  return {
    ...VHM_METADATA,
    alternates: { canonical, ...langAlternates(CANONICAL_PATH) },
    openGraph: {
      ...VHM_METADATA.openGraph,
      url: canonical,
      locale: en ? "en_US" : "vi_VN",
    },
  };
}

const FAQ_VHM: FAQItem[] = [
  {
    question: "Vinhomes Hóc Môn là gì?",
    answer:
      "Đây là trang tham khảo entity/dự án Vinhomes Hóc Môn tại khu vực Hóc Môn, TP.HCM. Thông tin về sản phẩm, quy mô, giá, pháp lý và tiến độ cần được đối chiếu với hồ sơ gốc có ngày xác minh.",
  },
  {
    question: "Vinhomes Hóc Môn ở đâu?",
    answer:
      "Trang xác định entity ở khu vực Hóc Môn, TP.HCM. Các mốc khoảng cách, hạ tầng kết nối và ranh giới dự án không được xem là dữ kiện đã xác minh nếu chưa có bản đồ hoặc hồ sơ chính thức kèm ngày cập nhật.",
  },
  {
    question: "Vinhomes Hóc Môn giá bao nhiêu?",
    answer:
      "Hiện trang không phát hành một mức giá đã xác minh. Người mua nên yêu cầu bảng giá, chính sách và điều kiện áp dụng bằng văn bản từ chủ đầu tư hoặc bên có thẩm quyền trước khi đặt chỗ hay giao dịch.",
  },
  {
    question: "Pháp lý Vinhomes Hóc Môn cần kiểm tra gì?",
    answer:
      "Cần kiểm tra pháp nhân dự án, chấp thuận chủ trương, quy hoạch, giấy phép, điều kiện huy động vốn và hồ sơ sản phẩm tương ứng. SGS LAND không coi nội dung tham khảo trên trang là bảo đảm pháp lý.",
  },
  {
    question: "Có nên đặt chỗ Vinhomes Hóc Môn trước không?",
    answer:
      "Không nên đặt chỗ chỉ dựa trên thông tin chưa có nguồn độc lập và ngày xác minh. Hãy kiểm tra điều khoản hoàn tiền, bên nhận tiền, văn bản ủy quyền, chính sách chính thức và tình trạng pháp lý trước khi thanh toán.",
  },
];

const PROJECT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": ["RealEstateProject", "Place"],
  "@id": `${SITE_URL}${CANONICAL_PATH}#project`,
  name: PROJECT_NAME,
  description:
    "Trang tham khảo entity/dự án Vinhomes Hóc Môn tại khu vực Hóc Môn, TP.HCM; các dữ kiện thương mại và pháp lý cần được xác minh theo hồ sơ hiện hành.",
  url: `${SITE_URL}${CANONICAL_PATH}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hóc Môn",
    addressRegion: "TP. Hồ Chí Minh",
    addressCountry: "VN",
  },
  containedInPlace: {
    "@type": "AdministrativeArea",
    name: "TP. Hồ Chí Minh",
  },
  dateModified: GEO_REVIEW_DATE,
};

const ENTITY_FACTS = [
  ["Entity", PROJECT_NAME],
  ["Khu vực", "Hóc Môn, TP. Hồ Chí Minh"],
  ["Sản phẩm", "Cần xác minh theo hồ sơ dự án"],
  ["Giá, pháp lý, tiến độ", "Chưa có nguồn định ngày trên trang"],
];

const CHECK_ITEMS = [
  ["Pháp nhân và chủ đầu tư", "Đối chiếu giấy tờ pháp nhân, quyết định/chấp thuận dự án và văn bản ủy quyền."],
  ["Sản phẩm và bảng giá", "Yêu cầu tài liệu chính thức, ngày hiệu lực, điều kiện áp dụng và chính sách hoàn tiền."],
  ["Hạ tầng và tiến độ", "Kiểm tra hồ sơ quy hoạch, giấy phép, mốc thi công và nguồn công bố của cơ quan có thẩm quyền."],
  ["Tư cách phân phối", "Không mặc định SGS LAND là đại lý/đối tác nếu chưa có văn bản xác minh còn hiệu lực."],
];

export default function VinhomesHocMonPage() {
  const directAnswer = buildGeoDirectAnswer({
    projectName: PROJECT_NAME,
    location: "Hóc Môn, TP. Hồ Chí Minh",
  });
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Dự án", url: `${SITE_URL}/du-an` },
    { name: PROJECT_NAME, url: `${SITE_URL}${CANONICAL_PATH}` },
  ]);
  const faqSchema = getFAQSchema(FAQ_VHM, `${SITE_URL}${CANONICAL_PATH}#faq`);

  return (
    <>
      <SchemaScript schemas={[PROJECT_SCHEMA, faqSchema, breadcrumb]} />
      <main
        className="min-h-screen bg-[var(--bg-surface)] dark:bg-sgs-primary-deep"
        data-geo-reviewed-at={GEO_REVIEW_DATE}
        data-geo-evidence="unavailable"
      >
        <section className="bg-gradient-to-br from-sgs-primary-deep via-sgs-primary-deep to-slate-900 px-4 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sgs-on-dark-muted">
              Thông tin dự án — cần xác minh trước giao dịch
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">{PROJECT_NAME}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Trang tham khảo entity, vị trí khu vực, sản phẩm và các bước kiểm tra. Không dùng nội dung trên trang này thay cho hồ sơ pháp lý, bảng giá hoặc thông báo chính thức.
            </p>
            <div
              className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5"
              aria-labelledby="geo-answer-heading"
            >
              <h2 id="geo-answer-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-200">
                Câu trả lời nhanh
              </h2>
              <p className="mt-2 max-w-4xl text-base leading-7 text-white">{directAnswer}</p>
              <p className="mt-3 text-xs leading-5 text-slate-300">
                Biên tập: {GEO_EDITOR_NAME}; rà soát: {GEO_REVIEW_DATE}. {GEO_DEFAULT_EVIDENCE_NOTE}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {getGeoEvidenceLinks("vinhomes-hoc-mon").map((link) => (
                  <a key={link.href} href={link.href} className="underline underline-offset-2 text-indigo-200">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-bold text-sgs-text dark:text-white">Thông tin entity cần đối chiếu</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ENTITY_FACTS.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-[var(--bg-surface)] p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sgs-text-muted dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-base font-bold text-sgs-primary dark:text-sgs-text-muted">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sgs-bg px-4 py-12 dark:bg-slate-800">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-bold text-sgs-text dark:text-white">Checklist trước khi xem xét giao dịch</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CHECK_ITEMS.map(([title, description]) => (
                <article key={title} className="rounded-xl border border-slate-200 bg-[var(--bg-surface)] p-5 dark:border-slate-700 dark:bg-slate-700">
                  <h3 className="font-bold text-sgs-text dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-sgs-text-muted dark:text-slate-400">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-2xl font-bold text-sgs-text dark:text-white">Câu hỏi thường gặp về {PROJECT_NAME}</h2>
            <div className="space-y-4">
              {FAQ_VHM.map((item) => (
                <article key={item.question} className="rounded-xl border border-slate-100 bg-sgs-bg p-5 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-2 font-bold text-sgs-text dark:text-white">{item.question}</h3>
                  <p className="text-sm leading-relaxed text-sgs-text-muted dark:text-slate-400">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sgs-primary px-4 py-14 text-center text-white">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-black">Cần hỗ trợ kiểm tra thông tin?</h2>
            <p className="mt-4 leading-7 text-indigo-200">
              SGS LAND có thể hỗ trợ tổng hợp câu hỏi và tài liệu cần kiểm tra. Vui lòng xác minh nguồn độc lập trước mọi khoản thanh toán hoặc cam kết.
            </p>
            <a href="https://sgsland.vn/contact" className="mt-7 inline-flex rounded-xl bg-[var(--bg-surface)] px-7 py-3 font-bold text-sgs-primary hover:bg-sgs-champagne">
              Liên hệ SGS LAND
            </a>
          </div>
        </section>
      </main>
    </>
  );
}