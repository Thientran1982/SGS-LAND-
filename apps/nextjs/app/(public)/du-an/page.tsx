import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Building2, ArrowRight } from "lucide-react";
import { ALL_PROJECTS } from "@/data/projects";
export const metadata: Metadata = {
  title: "Dự Án Bất Động Sản",
  description: "Khám phá các dự án BĐS lớn nhất TP.HCM, Đồng Nai, Bình Dương, Long An. Aqua City, The Global City, Vinhomes, Masterise Homes và nhiều dự án nổi bật khác.",
  alternates: { canonical: "https://sgsland.vn/du-an", languages: { "vi-VN": "https://sgsland.vn/du-an", "en-US": "https://sgsland.vn/en/du-an", "x-default": "https://sgsland.vn/du-an" } },
};
export const dynamic = "force-dynamic";
const HOT = new Set(["aqua-city","the-global-city","vinhomes-can-gio","vinhomes-hoc-mon","masteri-cosmo-central"]);
const PROJECTS = ALL_PROJECTS.map((p) => ({
  slug: p.slug,
  name: p.name,
  dev: p.developer,
  loc: p.location,
  scale: p.scale,
  price: p.slug === "aqua-city"
    ? "Từ 6 tỷ"
    : p.slug === "diamond-sky-van-phuc-city"
      ? "Từ 9,6 tỷ – Từ 190 triệu/m²"
      : p.priceRange,
  type: p.projectType,
  badge: p.status,
  hot: HOT.has(p.slug),
  img: p.img,
}));
export default function DuAnPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Dự Án Bất Động Sản</h1>
        <p style={{ color: "var(--text-secondary)" }}>{PROJECTS.length} dự án lớn tại TP.HCM, Đồng Nai, Bình Dương, Long An</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PROJECTS.map((p) => (
          <Link key={p.slug} href={`/du-an/${p.slug}`}
            className="p-5 rounded-2xl flex flex-col gap-3 hover:scale-[1.01] transition-transform group"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <div className="relative h-40 -mx-5 -mt-5 mb-1 overflow-hidden rounded-t-2xl"><img src={p.img} alt={p.name} loading="lazy" className="w-full h-full object-cover" /></div>
            <div className="flex items-start justify-between gap-2">
              <div className="p-2.5 rounded-xl" style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex gap-1.5">
                {p.hot && <span className="px-2 py-0.5 rounded-full text-[12px] font-bold" style={{ background: "#ef4444", color: "#fff" }}>HOT</span>}
                <span className="px-2 py-0.5 rounded-full text-[12px] font-medium"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>{p.badge}</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-base mb-1 group-hover:text-sgs-primary transition-colors" style={{ color: "var(--text-primary)" }}>{p.name}</h2>
              <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>{p.dev} · {p.type}</p>
              <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <MapPin className="w-3 h-3 shrink-0" />{p.loc}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
              <div>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Quy mô</p>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.scale}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Giá</p>
                <p className="text-sm font-bold" style={{ color: "var(--primary-600)" }}>{p.price}</p>
              </div>
              <ArrowRight className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}