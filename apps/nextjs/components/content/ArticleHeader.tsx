// @ts-nocheck
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, BookOpen, RefreshCw } from "lucide-react";
import type { Article } from "@/data/articles";
import type { Author } from "@/data/authors";
import type { Category } from "@/data/categories";
import { AuthorCard } from "./AuthorCard";
import { LegalDisclaimer } from "./LegalDisclaimer";

interface ArticleHeaderProps {
  article: Article;
  author: Author;
  category: Category | undefined;
  className?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ArticleHeader({ article, author, category, className = "" }: ArticleHeaderProps) {
  const categoryColor = category?.color ?? "var(--primary-600)";

  return (
    <header className={`mb-8 ${className}`}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex items-center flex-wrap gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <li><Link href="/" className="hover:underline">Trang chủ</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/news" className="hover:underline">Kiến thức & Tin tức</Link></li>
          {category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/news?category=${category.slug}`} className="hover:underline">
                  {category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li className="truncate max-w-[200px]" aria-current="page" style={{ color: "var(--text-secondary)" }}>
            {article.title}
          </li>
        </ol>
      </nav>

      {/* Category badge */}
      {category && (
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: `${categoryColor}18`, color: categoryColor }}
        >
          {category.name}
        </span>
      )}

      {/* H1 */}
      <h1
        className="text-3xl sm:text-4xl font-extrabold leading-tight mb-5"
        style={{ color: "var(--text-primary)" }}
      >
        {article.title}
      </h1>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-3 mb-5 text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" aria-hidden />
          Đăng {formatDate(article.publishedAt)}
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden />
          Cập nhật {formatDate(article.updatedAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          {article.readTime} phút đọc
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" aria-hidden />
          {article.wordCount.toLocaleString("vi-VN")} từ
        </span>
      </div>

      {/* Author inline */}
      <AuthorCard author={author} variant="inline" className="mb-5" />

      {/* Expert review badge for legal articles */}
      {article.isLegal && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-5"
          style={{
            background: "rgba(5,150,105,0.07)",
            border: "1px solid rgba(5,150,105,0.2)",
            color: "var(--sgs-verified)",
          }}
        >
          <span className="text-base" aria-hidden>✓</span>
          Đã xem xét bởi chuyên gia pháp lý — Cập nhật theo Luật Đất Đai 2024, hiệu lực 01/08/2024
        </div>
      )}

      {/* Legal disclaimer for legal articles */}
      {article.isLegal && <LegalDisclaimer className="mb-6" />}

      {/* Cover image */}
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden">
        <Image
          src={article.coverImage}
          alt={article.title}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
        />
        <div
          className="absolute inset-0 flex items-end p-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)" }}
        >
          <p className="text-white text-xs opacity-80">
            {article.title} — Ảnh minh họa
          </p>
        </div>
      </div>
    </header>
  );
}
