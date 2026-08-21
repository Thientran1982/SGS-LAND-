"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { LandingProject } from "@/data/landing-projects";

interface ProjectDetail {
  name: string;
  developer?: string;
  location?: string;
  description?: string;
  total_units?: number;
  status?: string;
  handover_year?: string;
  price_range?: { min: number; max: number; unit: string } | string;
  legal_status?: string;
  property_types?: string[];
  investment_score?: number;
  images?: string[];
}

interface ProjectConfig {
  heroDescription?: string;
  details?: { label: string; value: string }[];
  amenities?: { title: string; items: string[] }[];
  faqs?: { q: string; a: string }[];
  relatedProjects?: { name: string; slug: string }[];
}

interface Props {
  project: ProjectDetail;
  slug: string;
  config?: ProjectConfig | null;
  landingProject?: LandingProject | null;
}

const surface = {
  background: "var(--bg-elevated)",
  borderColor: "var(--border-default)",
};

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: "var(--sgs-accent-text)" }}>{eyebrow}</p>
      <h2 className="text-2xl font-bold tracking-[-.035em] sm:text-3xl" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {intro && <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{intro}</p>}
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "accent" | "neutral" | "warning" }) {
  const colors = {
    accent: { background: "var(--sgs-accent-soft)", color: "var(--sgs-accent-text)" },
    neutral: { background: "var(--ui-surface-subtle)", color: "var(--text-secondary)" },
    warning: { background: "#fff4e5", color: "#9a5b00" },
  };
  return <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold" style={colors[tone]}>{children}</span>;
}

function RichProjectDetail({ project, config, landing }: { project: ProjectDetail; config?: ProjectConfig | null; landing: LandingProject }) {
  const image = project.images?.[0] || `/images/projects/${landing.slug}.jpg`;
  const priceRows = (config?.details || [])
    .filter((row) => /giá|mức giá|price/i.test(row.label))
    .map((row) => ({ k: row.label, v: row.value }));
  if (priceRows.length === 0) {
    const fallbackPrice = landing.entityTable.find((row) => /giá|price/i.test(row.k));
    if (fallbackPrice) priceRows.push({ k: fallbackPrice.k, v: fallbackPrice.v });
  }
  const lastUpdated = "21/08/2026";

  return (
    <main className="bg-[var(--bg-page)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/" className="hover:underline">Trang chủ</Link><span>/</span>
          <Link href="/du-an" className="hover:underline">Dự án</Link><span>/</span>
          <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
        </nav>

        <section className="overflow-hidden rounded-3xl border shadow-[var(--ui-shadow-sm)]" style={surface}>
          <div className="grid lg:grid-cols-[1.02fr_.98fr]">
            <div className="relative min-h-[310px] overflow-hidden sm:min-h-[390px]">
              <img src={image} alt={landing.heroImageAlt} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#062f25]/90 via-[#062f25]/15 to-transparent" />
              <div className="absolute bottom-6 left-5 right-5 text-white sm:bottom-8 sm:left-8">
                <div className="mb-3 flex flex-wrap gap-2"><Tag tone="accent">Thông tin tham khảo</Tag><Tag>Cập nhật {lastUpdated}</Tag></div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/75">Dự án bất động sản</p>
                <p className="mt-2 text-2xl font-bold tracking-[-.04em] sm:text-4xl">{landing.titleShort}</p>
              </div>
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: "var(--sgs-accent-text)" }}>{landing.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-.045em] sm:text-4xl" style={{ color: "var(--text-primary)" }}>Thông tin dự án {landing.titleShort}</h1>
              <p className="mt-4 flex items-start gap-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}><MapPin className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{landing.heroMeta}</p>
              <p className="answer-box mt-5 rounded-2xl border-l-4 px-4 py-4 text-sm leading-6" role="note" style={{ borderColor: "var(--sgs-accent)", background: "var(--ui-surface-subtle)", color: "var(--text-secondary)" }}>
                {landing.desc} Trang này tổng hợp thông tin tham khảo về vị trí, sản phẩm, giá và hồ sơ; giá, pháp lý, tiến độ và tiện ích cần được xác minh theo đúng sản phẩm trước giao dịch.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="tel:+84971132378" className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> Liên hệ hỏi thông tin</a>
                <Link href="#bang-gia" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--ui-border-strong)", color: "var(--ui-brand)" }}>Xem giá tham khảo <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label={`Mục lục trang ${landing.titleShort}`} className="sticky top-0 z-20 -mx-4 mt-6 overflow-x-auto border-y px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border" style={{ background: "color-mix(in srgb, var(--bg-page) 92%, transparent)", borderColor: "var(--border-default)" }}>
          <div className="flex min-w-max gap-5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {landing.navLinks.map((link) => <a key={link.href} href={link.href} className="transition hover:text-[var(--ui-brand)]">{link.label}</a>)}
          </div>
        </nav>

        <section id="tong-quan" className="scroll-mt-20 py-12 sm:py-16">
          <SectionHeading eyebrow="01 · Tổng quan" title={`${landing.titleShort} là dự án gì?`} intro="Câu trả lời ngắn gọn cho người đang tìm hiểu entity, vị trí và mức độ xác minh thông tin." />
          <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
            <div className="space-y-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
              {landing.overviewParas.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <aside className="rounded-2xl border p-5" style={{ ...surface, background: "var(--ui-surface-subtle)" }}>
              <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Điểm cần xác minh</h3></div>
              <ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                {["Pháp lý của đúng phân khu và sản phẩm", "Bảng giá, chính sách và tình trạng quỹ hàng có ngày cập nhật", "Tiến độ bàn giao, tiện ích đã vận hành và chi phí sở hữu"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{item}</li>)}
              </ul>
            </aside>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {landing.stats.map((stat) => <div key={stat.lbl} className="rounded-2xl border p-4" style={surface}><p className="text-lg font-bold" style={{ color: "var(--sgs-accent-text)" }}>{stat.num}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>{stat.lbl}</p></div>)}
          </div>
        </section>

        <section id="thong-tin" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="02 · Entity" title="Thông tin nhận diện dự án" intro={`Bảng tóm tắt giúp người đọc và hệ thống trả lời AI hiểu cùng một entity ${landing.titleShort}, không trộn với sản phẩm riêng lẻ.`} />
          <div className="overflow-x-auto rounded-2xl border" style={surface}>
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <tbody>{landing.entityTable.filter((row) => !/hotline|đại lý ủy quyền/i.test(`${row.k} ${row.v}`)).map((row, index) => <tr key={row.k} style={{ background: index % 2 ? "var(--ui-surface-subtle)" : "transparent" }}><th scope="row" className="w-[30%] px-5 py-4 text-left font-medium" style={{ color: "var(--text-tertiary)" }}>{row.k}</th><td className="px-5 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{row.v}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>Cập nhật nội dung: {lastUpdated}. Dữ liệu có chữ “tham khảo” hoặc “cần đối chiếu” không phải bảng giá, hồ sơ pháp lý hay cam kết giao dịch.</p>
        </section>

        <section id="vi-tri" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="03 · Vị trí" title={`${landing.titleShort} ở đâu?`} intro={landing.locationIntro} />
          <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-2xl border p-6" style={{ ...surface, background: "var(--ui-surface-subtle)" }}>
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Địa điểm tham khảo</h3></div>
              <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>Long Hưng, TP. Biên Hòa, tỉnh Đồng Nai. Tọa độ tham khảo: 10.9282°N, 106.7992°E. Ranh dự án và thời gian di chuyển cần đối chiếu theo phân khu, tuyến đường và thời điểm.</p>
              <div className="mt-5 flex flex-wrap gap-2"><Tag>Đồng Nai</Tag><Tag>Long Hưng</Tag><Tag>Đối chiếu bản đồ thực tế</Tag></div>
            </div>
            <div className="overflow-hidden rounded-2xl border" style={surface}><iframe title={`Bản đồ vị trí ${landing.titleShort}`} src={landing.googleMapsEmbedSrc} className="h-[300px] w-full border-0 sm:h-[360px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><p className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Bản đồ chỉ mang tính tham khảo vị trí, không thay thế hồ sơ ranh giới dự án.</p></div>
          </div>
        </section>

        <section id="bang-gia" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="04 · Sản phẩm & giá" title={`Giá ${landing.titleShort} theo loại hình`} intro="Mức tham khảo hiện có trong dữ liệu SGS LAND; giá thực tế thay đổi theo phân khu, diện tích, pháp lý, thanh toán và thời điểm." />
          <div className="grid gap-4 md:grid-cols-3">
            {priceRows.map((row) => <div key={row.k} className="rounded-2xl border p-5" style={surface}><p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{row.k}</p><p className="mt-3 text-2xl font-bold tracking-[-.03em]" style={{ color: "var(--sgs-accent-text)" }}>{row.v.replace(" (giá tham khảo)", "")}</p><p className="mt-3 text-xs leading-5" style={{ color: "var(--text-tertiary)" }}>Giá tham khảo · cần xác nhận theo sản phẩm</p></div>)}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border p-5" style={{ ...surface, background: "var(--ui-surface-subtle)" }}><FileSearch className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sgs-accent-text)" }} /><p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>SGS LAND không phát hành bảng giá chính thức từ các mức trên. Hãy yêu cầu bảng giá, chính sách thanh toán và tình trạng sản phẩm có ngày cập nhật trước khi đặt cọc.</p></div>
        </section>

        <section id="tien-ich" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="05 · Tiện ích & kết nối" title="Tiện ích cần đọc theo trạng thái" intro="Không gộp tiện ích quảng bá với tiện ích đã vận hành; mỗi hạng mục cần được kiểm tra tại đúng phân khu." />
          <div className="grid gap-5 md:grid-cols-2">{(config?.amenities || []).map((group) => <div key={group.title} className="rounded-2xl border p-6" style={surface}><div className="flex items-center gap-2"><Sparkles className="h-5 w-5" style={{ color: "var(--sgs-accent-text)" }} /><h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{group.title}</h3></div><ul className="mt-4 space-y-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{group.items.map((item) => <li key={item} className="flex gap-2"><ArrowRight className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--sgs-accent-text)" }} />{item}</li>)}</ul></div>)}</div>
        </section>

        <section id="tham-dinh" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="06 · Khung thẩm định" title="Cần kiểm tra gì trước khi quyết định?" intro="Một checklist trung lập giúp người mua tự kiểm tra thay vì dựa vào một kết luận mua hoặc đầu tư chung." />
          <div className="grid gap-4 sm:grid-cols-3">
            {[["01", "Hồ sơ pháp lý", "Đối chiếu quy hoạch, hợp đồng, thế chấp, nghĩa vụ tài chính và điều kiện cấp giấy của đúng sản phẩm.", FileSearch], ["02", "Giá & dòng tiền", "So sánh giá có ngày, chi phí sở hữu, khả năng vay, thanh khoản và dữ liệu cho thuê nếu có.", ClipboardCheck], ["03", "Thực địa & tiến độ", "Khảo sát phân khu, tiện ích đã vận hành, tỷ lệ bàn giao và thông báo mới nhất của chủ thể liên quan.", Building2]].map(([number, title, text, Icon]) => <div key={String(number)} className="rounded-2xl border p-5" style={surface}><span className="text-xs font-bold" style={{ color: "var(--sgs-accent-text)" }}>{number}</span><Icon className="mt-4 h-5 w-5" style={{ color: "var(--ui-brand)" }} /><h3 className="mt-3 font-bold" style={{ color: "var(--text-primary)" }}>{String(title)}</h3><p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{String(text)}</p></div>)}
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t py-12 sm:py-16" style={{ borderColor: "var(--border-default)" }}>
          <SectionHeading eyebrow="07 · FAQ" title={`Câu hỏi thường gặp về ${landing.titleShort}`} intro="Các câu trả lời được viết để trả lời trực tiếp, nhưng không thay thế hồ sơ gốc hoặc tư vấn chuyên môn độc lập." />
          <div className="space-y-3">{landing.faq.map((item) => <details key={item.q} className="group rounded-2xl border px-5 py-4" style={surface}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold" style={{ color: "var(--text-primary)" }}>{item.q}<ArrowRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" style={{ color: "var(--sgs-accent-text)" }} /></summary><p className="mt-3 max-w-4xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{item.a}</p></details>)}</div>
        </section>

        <section id="lien-he" className="scroll-mt-20 rounded-3xl p-6 sm:p-9" style={{ background: "var(--ui-brand)", color: "var(--ui-on-brand)" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] opacity-75">Bước tiếp theo</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Cần kiểm tra {landing.titleShort} theo sản phẩm cụ thể?</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">Gửi nhu cầu để nhận thông tin tham khảo. Giá, pháp lý, tiến độ và tư cách phân phối vẫn cần được xác nhận bằng tài liệu hiện hành.</p></div><a href="tel:+84971132378" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold" style={{ color: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> 0971 132 378</a></div>
        </section>

        {config?.relatedProjects && config.relatedProjects.length > 0 && <section className="py-12"><SectionHeading eyebrow="Đọc thêm" title="Dự án và khu vực liên quan" /><div className="flex flex-wrap gap-3">{config.relatedProjects.map((related) => <Link key={related.slug} href={`/du-an/${related.slug}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" style={surface}><Building2 className="h-4 w-4" style={{ color: "var(--sgs-accent-text)" }} />{related.name}<ArrowRight className="h-4 w-4" /></Link>)}</div></section>}
      </div>
    </main>
  );
}

export function ProjectDetailPage({ project, slug, config, landingProject }: Props) {
  if (["aqua-city", "the-global-city", "izumi-city"].includes(slug) && landingProject) {
    return <RichProjectDetail project={project} config={config} landing={landingProject} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}><Link href="/">Trang chủ</Link><span>/</span><Link href="/du-an">Dự án</Link><span>/</span><span style={{ color: "var(--text-primary)" }}>{project.name}</span></nav>
      <header className="mb-10"><div className="mb-3 flex flex-wrap gap-2">{project.status && <Tag tone="accent">{project.status}</Tag>}{project.legal_status && <Tag>{project.legal_status}</Tag>}</div><h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>{project.name}</h1>{project.location && <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><MapPin className="h-4 w-4" />{project.location}{project.developer && ` · ${project.developer}`}</p>}<p className="answer-box mt-5 max-w-3xl text-base leading-7" role="note" style={{ color: "var(--text-secondary)" }}>{project.description || config?.heroDescription}</p></header>
      {config?.details && <section className="mb-12"><SectionHeading eyebrow="Thông tin dự án" title="Thông tin chi tiết" /><div className="grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2" style={{ ...surface, background: "var(--border-default)" }}>{config.details.map((detail) => <div key={detail.label} className="flex justify-between gap-4 p-4" style={{ background: "var(--bg-elevated)" }}><span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{detail.label}</span><strong className="text-right text-sm" style={{ color: "var(--text-primary)" }}>{detail.value}</strong></div>)}</div></section>}
      {config?.faqs && <section id="faq" className="mb-12"><SectionHeading eyebrow="FAQ" title="Câu hỏi thường gặp" /><div className="space-y-3">{config.faqs.map((faq) => <details key={faq.q} className="rounded-2xl border px-5 py-4" style={surface}><summary className="cursor-pointer text-sm font-bold" style={{ color: "var(--text-primary)" }}>{faq.q}</summary><p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{faq.a}</p></details>)}</div></section>}
      <div className="rounded-2xl p-6" style={{ background: "var(--ui-surface-subtle)" }}><h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Tìm hiểu thêm về {project.name}</h2><a href="tel:+84971132378" className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: "var(--ui-brand)" }}><Phone className="h-4 w-4" /> Liên hệ SGS LAND</a></div>
    </main>
  );
}