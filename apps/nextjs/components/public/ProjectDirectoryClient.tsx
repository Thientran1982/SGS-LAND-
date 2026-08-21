"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

export interface DirectoryProject {
  slug: string;
  name: string;
  dev: string;
  loc: string;
  province: string;
  scale: string;
  price: string;
  type: string;
  typeGroup: string;
  badge: string;
  hot: boolean;
  img: string;
  description: string;
}

const INITIAL_VISIBLE = 6;
const FEATURED_SLUG = "aqua-city";

function priceMatches(price: string, range: string) {
  if (!range) return true;
  const values = [...price.matchAll(/(\d+(?:[.,]\d+)?)\s*tỷ/gi)]
    .map((match) => Number(match[1].replace(",", ".")));
  if (range === "sqm") return /\/m²|triệu\/m²|triệu\/m2/i.test(price);
  if (range === "contact") return /liên hệ/i.test(price);
  if (!values.length) return false;
  if (range === "under-10") return values.some((value) => value < 10);
  if (range === "10-20") return values.some((value) => value >= 10 && value <= 20);
  return values.some((value) => value > 20);
}

function matchesProject(project: DirectoryProject, query: string, province: string, type: string, price: string) {
  const haystack = `${project.name} ${project.dev} ${project.loc} ${project.type} ${project.typeGroup} ${project.description}`.toLocaleLowerCase("vi");
  return (
    (!query || haystack.includes(query.toLocaleLowerCase("vi").trim())) &&
    (!province || project.province === province) &&
    (!type || project.typeGroup === type) &&
    priceMatches(project.price, price)
  );
}

function StatusBadges({ project }: { project: DirectoryProject }) {
  return (
    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
      {project.hot && (
        <span className="rounded-full bg-[#b42318] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">ƯU TIÊN</span>
      )}
      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--ui-brand)] shadow-sm backdrop-blur-sm">
        {project.badge}
      </span>
    </div>
  );
}

function ProjectCard({ project }: { project: DirectoryProject }) {
  return (
    <Link
      href={`/du-an/${project.slug}`}
      className="group flex min-h-[338px] flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--ui-shadow-md)]"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
    >
      <div className="relative h-44 shrink-0 overflow-hidden">
        <img src={project.img} alt={project.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <StatusBadges project={project} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-1 text-[17px] font-bold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>{project.name}</h2>
        <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--text-tertiary)" }}>{project.dev} · {project.typeGroup}</p>
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-1">{project.loc}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Giá tham khảo</p>
            <p className="mt-0.5 line-clamp-1 text-sm font-bold" style={{ color: "var(--sgs-accent-text)" }}>{project.price}</p>
          </div>
          <ArrowRight className="mb-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: "var(--sgs-accent-text)" }} />
        </div>
      </div>
    </Link>
  );
}

function FeaturedProject({ project }: { project: DirectoryProject }) {
  return (
    <Link
      href={`/du-an/${project.slug}`}
      className="group grid overflow-hidden rounded-3xl border shadow-[var(--ui-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--ui-shadow-md)] md:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)]"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
    >
      <div className="relative min-h-[245px] overflow-hidden md:min-h-[310px]">
        <img src={project.img} alt={project.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute left-5 top-5 flex gap-2">
          <span className="rounded-full bg-[var(--sgs-accent)] px-3 py-1.5 text-[11px] font-bold tracking-[.08em] text-[var(--ui-on-accent)]">DỰ ÁN NỔI BẬT</span>
          {project.hot && <span className="rounded-full bg-[#b42318] px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-sm">ƯU TIÊN</span>}
          <span className="rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ui-brand)] shadow-sm backdrop-blur-sm">{project.badge}</span>
        </div>
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <p className="mb-1 text-xs font-medium uppercase tracking-[.16em] text-white/75">Lựa chọn ưu tiên</p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">{project.name}</h2>
        </div>
      </div>
      <div className="flex flex-col justify-center p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: "var(--sgs-accent-text)" }}>Thông tin dự án</p>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{project.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-y py-4" style={{ borderColor: "var(--border-default)" }}>
          <div><p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Quy mô</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{project.scale}</p></div>
          <div><p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Giá tham khảo</p><p className="mt-1 text-sm font-bold" style={{ color: "var(--sgs-accent-text)" }}>{project.price}</p></div>
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ui-brand)" }}>Xem thông tin dự án <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></p>
      </div>
    </Link>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="relative flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="relative">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-xl border bg-transparent px-3 pr-9 text-sm outline-none transition focus:ring-2" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }}>
          {options.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </span>
    </label>
  );
}

export default function ProjectDirectoryClient({ projects }: { projects: DirectoryProject[] }) {
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const provinces = useMemo(() => [...new Set(projects.map((project) => project.province))].sort((a, b) => a.localeCompare(b, "vi")), [projects]);
  const filtered = useMemo(() => projects.filter((project) => matchesProject(project, query, province, type, price)), [projects, query, province, type, price]);
  const featured = filtered.find((project) => project.slug === FEATURED_SLUG);
  const regular = filtered.filter((project) => project.slug !== FEATURED_SLUG);
  const hasFilters = Boolean(query.trim() || province || type || price);
  const shownRegular = hasFilters ? regular : regular.slice(0, visibleCount);
  const canLoadMore = !hasFilters && visibleCount < regular.length;

  const clearFilters = () => {
    setQuery("");
    setProvince("");
    setType("");
    setPrice("");
    setVisibleCount(INITIAL_VISIBLE);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-7 max-w-3xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "var(--sgs-accent-text)" }}>Danh mục dự án</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl" style={{ color: "var(--text-primary)" }}>Dự Án Bất Động Sản</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: "var(--text-secondary)" }}>Khám phá các khu đô thị, căn hộ và sản phẩm nổi bật tại TP.HCM, Đồng Nai và các khu vực lân cận.</p>
      </header>

      <section className="mb-8 rounded-2xl border p-3 shadow-[var(--ui-shadow-sm)] sm:p-4" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }} aria-label="Tìm kiếm và bộ lọc dự án">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5" style={{ color: "var(--text-tertiary)" }} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(INITIAL_VISIBLE); }} placeholder="Tìm theo tên dự án, chủ đầu tư hoặc khu vực..." className="h-12 w-full rounded-xl border bg-transparent pl-11 pr-10 text-sm outline-none transition focus:ring-2" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Xóa tìm kiếm" className="absolute right-3 top-3 rounded-full p-1" style={{ color: "var(--text-tertiary)" }}><X className="h-4 w-4" /></button>}
        </div>
        <div className="mt-3 flex items-end gap-3 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
          <SlidersHorizontal className="mb-3 hidden h-4 w-4 shrink-0 sm:block" style={{ color: "var(--sgs-accent-text)" }} />
          <FilterSelect label="Khu vực" value={province} onChange={(value) => { setProvince(value); setVisibleCount(INITIAL_VISIBLE); }} options={[{ value: "", label: "Tất cả khu vực" }, ...provinces.map((item) => ({ value: item, label: item }))]} />
          <FilterSelect label="Mức giá" value={price} onChange={(value) => { setPrice(value); setVisibleCount(INITIAL_VISIBLE); }} options={[{ value: "", label: "Tất cả mức giá" }, { value: "under-10", label: "Dưới 10 tỷ" }, { value: "10-20", label: "10 – 20 tỷ" }, { value: "over-20", label: "Trên 20 tỷ" }, { value: "sqm", label: "Theo triệu/m²" }, { value: "contact", label: "Liên hệ" }]} />
          <FilterSelect label="Loại hình" value={type} onChange={(value) => { setType(value); setVisibleCount(INITIAL_VISIBLE); }} options={[{ value: "", label: "Tất cả loại hình" }, ...[...new Set(projects.map((project) => project.typeGroup))].sort((a, b) => a.localeCompare(b, "vi")).map((item) => ({ value: item, label: item }))]} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>{filtered.length}</strong> kết quả phù hợp</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="font-semibold hover:underline" style={{ color: "var(--sgs-accent-text)" }}>Xóa bộ lọc</button>}
        </div>
      </section>

      {featured && <section className="mb-9" aria-label="Dự án nổi bật"><FeaturedProject project={featured} /></section>}

      {shownRegular.length > 0 ? (
        <section aria-label="Danh sách dự án">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: "var(--sgs-accent-text)" }}>Khám phá thêm</p><h2 className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Tất cả dự án</h2></div>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{shownRegular.length} / {regular.length}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{shownRegular.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
          {canLoadMore && <div className="mt-8 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE)} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: "var(--ui-border-strong)", color: "var(--ui-brand)", background: "var(--bg-elevated)" }}>Xem thêm dự án <ArrowRight className="h-4 w-4" /></button></div>}
        </section>
      ) : (
        <div className="rounded-2xl border px-6 py-14 text-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Chưa tìm thấy dự án phù hợp</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Thử đổi từ khóa hoặc xóa bớt bộ lọc để xem thêm lựa chọn.</p>
          <button type="button" onClick={clearFilters} className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--ui-brand)", color: "var(--ui-on-brand)" }}>Xóa bộ lọc</button>
        </div>
      )}
    </div>
  );
}