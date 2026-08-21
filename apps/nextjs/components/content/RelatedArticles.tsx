// @ts-nocheck
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { Article } from "@/data/articles";
import type { Category } from "@/data/categories";
interface RelatedArticlesProps {
  articles: Article[];
  categories: Category[];
  lang?: "vi" | "en";
  className?: string;
}
export function RelatedArticles({ articles, categories, lang = "vi", className = "" }: RelatedArticlesProps) {
  if (!articles.length) return null;
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  return (
    <section className={className} aria-label="Bài viết liên quan">
      <h2
        className="text-xl font-bold mb-5 pb-3"
        style={{
          color: "var(--text-primary)",
          borderBottom: "2px solid var(--primary-600)",
          display: "inline-block",
        }}
      >
        Bài viết liên quan
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {articles.map((article) => {
          const cat = catMap[article.category];
          return (
            <Link
              key={article.slug}
              href={`${lang === "en" ? "/en/news" : "/tin-tuc"}/${article.slug}`}
              className="group block p-4 rounded-xl transition-transform hover:scale-[1.01]"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
              }}
            >
              {cat && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-block"
                  style={{ background: `${cat.color}18`, color: cat.color }}
                >
                  {cat.name}
                </span>
              )}
              <h3
                className="text-sm font-semibold leading-snug mb-2 group-hover:text-sgs-primary transition-colors line-clamp-3"
                style={{ color: "var(--text-primary)" }}
              >
                {article.title}
              </h3>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden />
                  {article.readTime} phút
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}