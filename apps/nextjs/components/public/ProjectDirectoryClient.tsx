"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
import PublicProjectAdminBar from "@/components/content/PublicProjectAdminBar";
import { useEffect } from "react";

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
const CARD_EN: Record<string, string> = {
  "aqua-city": "Reference overview of Aqua City Novaland in Dong Nai, including location, product types, reference pricing and verification notes.",
  "the-global-city": "Reference overview of The Global City mixed-use township by Masterise Homes in Thu Duc City.",
  "izumi-city": "Reference overview of Izumi City by Nam Long and Hankyu Hanshin in Bien Hoa, Dong Nai.",
  "vinhomes-grand-park": "Reference overview of Vinhomes Grand Park township, its phases, amenities, pricing and legal status.",
  "vinhomes-central-park": "Reference overview of Vinhomes Central Park, a completed riverside township near Landmark 81.",
  "diamond-sky-van-phuc-city": "Reference overview of Diamond Sky apartments within Van Phuc City in Thu Duc City.",
};

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
  const lang = useLang();
  const badge = project.badge.toLowerCase();
    const badgeLabel = badge.includes("đang mở") ? tt(lang, "ĐANG MỞ BÁN", "NOW SELLING")
    : badge.includes("sắp") ? tt(lang, "SẮP MỞ BÁN", "COMING SOON")
    : badge.includes("bàn giao") ? tt(lang, "ĐANG BÀN GIAO", "HANDOVER IN PROGRESS")
    : badge.includes("cao cấp") ? tt(lang, "CAO CẤP", "PREMIUM")
    : project.badge;
  return (
    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
      {project.hot && (
        <span className="rounded-full bg-[#b42318] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">{tt(lang, "ƯU TIÊN", "PRIORITY")}</span>
      )}
      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--ui-brand)] shadow-sm backdrop-blur-sm">
         {badgeLabel}
      </span>
    </div>
  );
}

function ProjectCard({ project }: { project: DirectoryProject }) {
  const lang = useLang();
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
        <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--text-tertiary)" }}>{project.dev} · {lang === "en" && project.typeGroup === "Căn hộ" ? "Apartment" : project.typeGroup}</p>
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-1">{project.loc}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
          <div>
             <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Giá tham khảo", "Reference price")}</p>
            <p className="mt-0.5 line-clamp-1 text-sm font-bold" style={{ color: "var(--sgs-accent-text)" }}>{project.price}</p>
          </div>
          <ArrowRight className="mb-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: "var(--sgs-accent-text)" }} />
        </div>
      </div>
    </Link>
  );
}

function FeaturedProject({ project }: { project: DirectoryProject }) {
  const lang = useLang();
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
           <span className="rounded-full bg-[var(--sgs-accent)] px-3 py-1.5 text-[11px] font-bold tracking-[.08em] text-[var(--ui-on-accent)]">{tt(lang, "DỰ ÁN NỔI BẬT", "FEATURED PROJECT")}</span>
           {project.hot && <span className="rounded-full bg-[#b42318] px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-white shadow-sm">{tt(lang, "ƯU TIÊN", "PRIORITY")}</span>}
          <span className="rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ui-brand)] shadow-sm backdrop-blur-sm">{project.badge}</span>
        </div>
        <div className="absolute bottom-5 left-5 right-5 text-white">
           <p className="mb-1 text-xs font-medium uppercase tracking-[.16em] text-white/75">{tt(lang, "Lựa chọn ưu tiên", "Priority pick")}</p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">{project.name}</h2>
        </div>
      </div>
      <div className="flex flex-col justify-center p-6 md:p-8">
         <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{ color: "var(--sgs-accent-text)" }}>{tt(lang, "Thông tin dự án", "Project information")}</p>
         <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{lang === "en" ? (CARD_EN[project.slug] || project.description) : project.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-y py-4" style={{ borderColor: "var(--border-default)" }}>
           <div><p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Quy mô", "Scale")}</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{project.scale}</p></div>
           <div><p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{tt(lang, "Giá tham khảo", "Reference price")}</p><p className="mt-1 text-sm font-bold" style={{ color: "var(--sgs-accent-text)" }}>{project.price}</p></div>
        </div>
         <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ui-brand)" }}>{tt(lang, "Xem thông tin dự án", "View project details")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></p>
      </div>
    </Link>
  );
}

function FilterDropdown({ label, value, onChange, options, open, onToggle, onClose }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; open: boolean; onToggle: () => void; onClose: () => void }) {
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0]?.label;
  return (
    <div className="relative min-w-0 flex-1">
      <span className="text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <button type="button" aria-expanded={open} onClick={onToggle} className="mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm outline-none transition focus:ring-2" style={{ borderColor: open ? "var(--ui-brand)" : "var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }}>
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-tertiary)" }} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-[var(--ui-shadow-md)]" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }} role="listbox">
          {options.map((option) => (
            <button key={option.value || "all"} type="button" role="option" aria-selected={value === option.value} onClick={() => { onChange(option.value); onClose(); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-[var(--ui-surface-hover)]" style={{ color: value === option.value ? "var(--ui-brand)" : "var(--text-primary)" }}>
              <span>{option.label}</span>
              {value === option.value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectDirectoryClient({ projects }: { projects: DirectoryProject[] }) {
  const lang = useLang();
  const [allProjects, setAllProjects] = useState(projects);
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"province" | "price" | "type" | null>(null);
  useEffect(() => {
    fetch("/api/public-project-content/published", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((payload) => {
        const published = Array.isArray(payload?.data) ? payload.data : [];
        if (!published.length) return;
        const cms = published.map((row: any): DirectoryProject => {
          const c = row.content || {};
          const lines = (value: any) => String(value || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
          return {
            slug: row.slug, name: row.name, dev: c.developer || "Đang cập nhật", loc: c.location || "Đang cập nhật",
            province: c.province || c.location || "Khác", scale: c.scale || "Đang cập nhật", price: c.price || "Liên hệ",
            type: c.type || "Dự án", typeGroup: c.type || "Dự án", badge: "Đang cập nhật", hot: false,
            img: lines(c.images)[0] || `/images/projects/${row.slug}.jpg`, description: c.description || "",
          };
        });
        const bySlug = new Map([...projects, ...cms].map((p) => [p.slug, p]));
        setAllProjects([...bySlug.values()]);
      }).catch(() => {});
  }, [projects]);

  const provinces = useMemo(() => [...new Set(allProjects.map((project) => project.province))].sort((a, b) => a.localeCompare(b, "vi")), [allProjects]);
  const filtered = useMemo(() => allProjects.filter((project) => matchesProject(project, query, province, type, price)), [allProjects, query, province, type, price]);
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
       <PublicProjectAdminBar />
       <header className="mb-7 max-w-3xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "var(--sgs-accent-text)" }}>{tt(lang, "Danh mục dự án", "Project directory")}</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl" style={{ color: "var(--text-primary)" }}>{tt(lang, "Dự Án Bất Động Sản", "Real Estate Projects")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Khám phá các khu đô thị, căn hộ và sản phẩm nổi bật tại TP.HCM, Đồng Nai và các khu vực lân cận.", "Explore featured townships, apartments and property products in Ho Chi Minh City, Dong Nai and nearby areas.")}</p>
      </header>

        <section className="mb-8 rounded-2xl border p-3 shadow-[var(--ui-shadow-sm)] sm:p-4" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }} aria-label={tt(lang, "Tìm kiếm và bộ lọc dự án", "Project search and filters")}>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5" style={{ color: "var(--text-tertiary)" }} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(INITIAL_VISIBLE); }} placeholder={tt(lang, "Tìm theo tên dự án, chủ đầu tư hoặc khu vực...", "Search by project, developer or area...")} className="h-12 w-full rounded-xl border bg-transparent pl-11 pr-10 text-sm outline-none transition focus:ring-2" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", backgroundColor: "var(--bg-input)" }} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={tt(lang, "Xóa tìm kiếm", "Clear search")} className="absolute right-3 top-3 rounded-full p-1" style={{ color: "var(--text-tertiary)" }}><X className="h-4 w-4" /></button>}
          </div>
          <button type="button" aria-expanded={filtersOpen} aria-controls="project-filters" onClick={() => { setFiltersOpen((open) => !open); setOpenDropdown(null); }} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:-translate-y-0.5 sm:px-4" style={{ borderColor: filtersOpen || hasFilters ? "var(--ui-brand)" : "var(--border-default)", color: filtersOpen || hasFilters ? "var(--ui-brand)" : "var(--text-secondary)", background: filtersOpen || hasFilters ? "var(--ui-surface-subtle)" : "var(--bg-input)" }}>
            <SlidersHorizontal className="h-4 w-4" />
             <span className="hidden sm:inline">{tt(lang, "Bộ lọc", "Filters")}</span>
            {hasFilters && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ui-brand)] px-1 text-[11px] text-[var(--ui-on-brand)]">{[province, price, type].filter(Boolean).length}</span>}
          </button>
        </div>
        {filtersOpen && <div id="project-filters" className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end" style={{ borderColor: "var(--border-default)" }}>
           <FilterDropdown label={tt(lang, "Khu vực", "Area")} value={province} onChange={(value) => { setProvince(value); setVisibleCount(INITIAL_VISIBLE); }} open={openDropdown === "province"} onToggle={() => setOpenDropdown(openDropdown === "province" ? null : "province")} onClose={() => setOpenDropdown(null)} options={[{ value: "", label: tt(lang, "Tất cả khu vực", "All areas") }, ...provinces.map((item) => ({ value: item, label: item }))]} />
           <FilterDropdown label={tt(lang, "Mức giá", "Price range")} value={price} onChange={(value) => { setPrice(value); setVisibleCount(INITIAL_VISIBLE); }} open={openDropdown === "price"} onToggle={() => setOpenDropdown(openDropdown === "price" ? null : "price")} onClose={() => setOpenDropdown(null)} options={[{ value: "", label: tt(lang, "Tất cả mức giá", "All prices") }, { value: "under-10", label: tt(lang, "Dưới 10 tỷ", "Under VND 10B") }, { value: "10-20", label: tt(lang, "10 – 20 tỷ", "VND 10–20B") }, { value: "over-20", label: tt(lang, "Trên 20 tỷ", "Over VND 20B") }, { value: "sqm", label: tt(lang, "Theo triệu/m²", "By million/m²") }, { value: "contact", label: tt(lang, "Liên hệ", "Contact") }]} />
              <FilterDropdown label={tt(lang, "Loại hình", "Property type")} value={type} onChange={(value) => { setType(value); setVisibleCount(INITIAL_VISIBLE); }} open={openDropdown === "type"} onToggle={() => setOpenDropdown(openDropdown === "type" ? null : "type")} onClose={() => setOpenDropdown(null)} options={[{ value: "", label: tt(lang, "Tất cả loại hình", "All property types") }, ...[...new Set(allProjects.map((project) => project.typeGroup))].sort((a, b) => a.localeCompare(b, "vi")).map((item) => ({ value: item, label: item }))]} />
        </div>}
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
           <p style={{ color: "var(--text-secondary)" }}><strong style={{ color: "var(--text-primary)" }}>{filtered.length}</strong> {tt(lang, "kết quả phù hợp", "matching results")}</p>
           {hasFilters && <button type="button" onClick={clearFilters} className="font-semibold hover:underline" style={{ color: "var(--sgs-accent-text)" }}>{tt(lang, "Xóa bộ lọc", "Clear filters")}</button>}
        </div>
      </section>

       {featured && <section className="mb-9" aria-label={tt(lang, "Dự án nổi bật", "Featured project")}><FeaturedProject project={featured} /></section>}

      {shownRegular.length > 0 ? (
           <section aria-label={tt(lang, "Danh sách dự án", "Project list")}>
             <div className="mb-4 flex items-end justify-between gap-3">
             <div><p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: "var(--sgs-accent-text)" }}>{tt(lang, "Khám phá thêm", "Explore more")}</p><h2 className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Tất cả dự án", "All projects")}</h2></div>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{shownRegular.length} / {regular.length}</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{shownRegular.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
           {canLoadMore && <div className="mt-8 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE)} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: "var(--ui-border-strong)", color: "var(--ui-brand)", background: "var(--bg-elevated)" }}>{tt(lang, "Xem thêm dự án", "Load more projects")} <ArrowRight className="h-4 w-4" /></button></div>}
        </section>
      ) : (
        <div className="rounded-2xl border px-6 py-14 text-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
           <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{tt(lang, "Chưa tìm thấy dự án phù hợp", "No matching projects found")}</p>
           <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{tt(lang, "Thử đổi từ khóa hoặc xóa bớt bộ lọc để xem thêm lựa chọn.", "Try another keyword or clear some filters to see more options.")}</p>
           <button type="button" onClick={clearFilters} className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--ui-brand)", color: "var(--ui-on-brand)" }}>{tt(lang, "Xóa bộ lọc", "Clear filters")}</button>
        </div>
      )}
    </div>
  );
}