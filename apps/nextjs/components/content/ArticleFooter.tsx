// @ts-nocheck
import Link from "next/link";
import type { Article } from "@/data/articles";
import type { Author } from "@/data/authors";
import type { Category } from "@/data/categories";
import { AuthorCard } from "./AuthorCard";
import { RelatedArticles } from "./RelatedArticles";
import { ExternalLink } from "lucide-react";
const SOURCE_TYPE_LABELS: Record<string, string> = {
  legal: "Văn bản pháp luật",
  official: "Cơ quan nhà nước",
  research: "Nghiên cứu / Báo cáo",
  news: "Báo chí",
};
const SOURCE_TYPE_COLORS: Record<string, string> = {
  legal: "#065F46",
  official: "#1E40AF",
  research: "#7C3AED",
  news: "#92400E",
};
interface ArticleFooterProps {
  article: Article;
  author: Author;
  relatedArticles: Article[];
  categories: Category[];
  lang?: "vi" | "en";
  className?: string;
}
export function ArticleFooter({
  article,
  author,
  relatedArticles,
  categories,
  lang = "vi",
  className = "",
}: ArticleFooterProps) {
  return (
    <footer className={`mt-12 space-y-10 ${className}`}>
      {/* Sources section */}
      {article.sources.length > 0 && (
        <section aria-label="Nguồn tham khảo">
          <h2
            className="text-lg font-bold mb-4"
            style={{ color: "var(--text-primary)", borderLeft: "3px solid var(--primary-600)", paddingLeft: "0.75rem" }}
          >
            Nguồn tham khảo
          </h2>
          <ol className="space-y-2.5">
            {article.sources.map((src, i) => {
              const color = SOURCE_TYPE_COLORS[src.type] ?? "var(--primary-600)";
              return (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-xs font-mono mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }}>
                    [{i + 1}]
                  </span>
                  <div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline inline-flex items-center gap-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {src.name}
                      <ExternalLink className="w-3 h-3 opacity-60" aria-hidden />
                    </a>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}14`, color }}>
                      {SOURCE_TYPE_LABELS[src.type] ?? src.type}
                    </span>
                    <span className="ml-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      ({src.publishedYear})
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {/* Fact-check notice for legal articles */}
      {article.isLegal && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs"
          style={{
            background: "rgba(5,150,105,0.06)",
            border: "1px solid rgba(5,150,105,0.2)",
            color: "var(--sgs-verified)",
          }}
          role="note"
        >
          <span className="text-base" aria-hidden>✓</span>
          Thông tin pháp lý trong bài được kiểm tra{" "}
          {new Date(article.updatedAt).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })} theo Luật Đất Đai 2024.
        </div>
      )}
      {/* Author bio full */}
      <section aria-label={`Về tác giả ${author.name}`}>
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)", borderLeft: "3px solid var(--primary-600)", paddingLeft: "0.75rem" }}>
          Về tác giả
        </h2>
        <AuthorCard author={author} variant="full" />
      </section>
      {/* Editorial policy */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>📋</span>
        <span>
          Nội dung tuân theo{" "}
          <Link href="/chinh-sach-bien-tap" className="hover:underline font-medium" style={{ color: "var(--primary-600)" }}>
            Chính sách biên tập SGS Land
          </Link>
          . Bài viết được fact-check và cập nhật định kỳ.
        </span>
      </div>
      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <RelatedArticles articles={relatedArticles} categories={categories} lang={lang} />
      )}
      {/* CTA */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl"
        style={{ background: "var(--primary-subtle)", border: "1px solid var(--border-default)" }}
      >
        <div>
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Cần tư vấn BĐS miễn phí?
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Đội ngũ 15.000+ môi giới SGS Land sẵn sàng hỗ trợ bạn 24/7.
          </p>
        </div>
        <Link
          href="/contact"
          className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm shrink-0 transition-opacity hover:opacity-90"
          style={{ background: "var(--primary-600)" }}
        >
          Liên hệ ngay →
        </Link>
      </div>
    </footer>
  );
}
