// @ts-nocheck
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/data/categories";
interface CategoryFilterProps {
  categories: Category[];
  className?: string;
}
export function CategoryFilter({ categories, className = "" }: CategoryFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params?.get("category") ?? "all";
  function select(slug: string) {
    const url = slug === "all" ? "/news" : `/news?category=${slug}`;
    router.push(url, { scroll: false });
  }
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Lọc theo chuyên mục">
      <button
        onClick={() => select("all")}
        className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
        style={{
          background: active === "all" ? "var(--primary-600)" : "var(--bg-elevated)",
          color: active === "all" ? "#fff" : "var(--text-secondary)",
          border: "1px solid var(--border-default)",
        }}
        aria-pressed={active === "all"}
      >
        Tất cả
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => select(cat.slug)}
          className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
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