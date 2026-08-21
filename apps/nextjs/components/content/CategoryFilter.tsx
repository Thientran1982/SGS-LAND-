// @ts-nocheck
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/data/categories";
interface CategoryFilterProps {
  categories: Category[];
  lang?: "vi" | "en";
  className?: string;
}
export function CategoryFilter({ categories, lang = "vi", className = "" }: CategoryFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params?.get("category") ?? "all";
  function select(slug: string) {
    const base = lang === "en" ? "/en/news" : "/tin-tuc";
    const url = slug === "all" ? base : `${base}?category=${slug}`;
    router.push(url, { scroll: false });
  }
  return (
    <div className={`flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible sm:pb-0 ${className}`} role="group" aria-label={lang === "en" ? "Filter by category" : "Lọc theo chuyên mục"}>
      <button
        onClick={() => select("all")}
        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
        style={{
          background: active === "all" ? "var(--primary-600)" : "var(--bg-elevated)",
          color: active === "all" ? "#fff" : "var(--text-secondary)",
          border: "1px solid var(--border-default)",
        }}
        aria-pressed={active === "all"}
      >
        {lang === "en" ? "All" : "Tất cả"}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => select(cat.slug)}
          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
          style={{
            background: active === cat.slug ? cat.color : "var(--bg-elevated)",
            color: active === cat.slug ? "#fff" : "var(--text-secondary)",
            border: `1px solid ${active === cat.slug ? cat.color : "var(--border-default)"}`,
          }}
          aria-pressed={active === cat.slug}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}