// @ts-nocheck
"use client";
import Link from "next/link";
import Image from "next/image";
import type { Author } from "@/data/authors";
interface AuthorCardProps {
  author: Author;
  variant?: "inline" | "full";
  className?: string;
}
function Initials({ name, className = "" }: { name: string; className?: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0][0];
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white select-none ${className}`}
      style={{ background: "var(--primary-600)" }}
      aria-label={name}
    >
      {initials.toUpperCase()}
    </div>
  );
}
export function AuthorCard({ author, variant = "inline", className = "" }: AuthorCardProps) {
  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Link href={`/tac-gia/${author.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
          {author.avatar ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <Image src={author.avatar} alt={author.name} fill className="object-cover" />
            </div>
          ) : (
            <Initials name={author.name} className="w-10 h-10 text-xs" />
          )}
        </Link>
        <div className="min-w-0">
          <Link
            href={`/tac-gia/${author.slug}`}
            className="text-sm font-semibold hover:underline leading-tight block"
            style={{ color: "var(--text-primary)" }}
          >
            {author.name}
          </Link>
          <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {author.title}
          </p>
        </div>
        {author.credentials.slice(0, 1).map((cred) => (
          <span
            key={cred}
            className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
            style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}
          >
            {cred}
          </span>
        ))}
      </div>
    );
  }
  // variant === "full"
  return (
    <div
      className={`p-6 rounded-2xl ${className}`}
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      itemScope
      itemType="https://schema.org/Person"
    >
      <div className="flex items-start gap-4 mb-4">
        <Link href={`/tac-gia/${author.slug}`} className="shrink-0">
          {author.avatar ? (
            <div className="relative w-16 h-16 rounded-full overflow-hidden">
              <Image src={author.avatar} alt={author.name} fill className="object-cover" />
            </div>
          ) : (
            <Initials name={author.name} className="w-16 h-16 text-xl" />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/tac-gia/${author.slug}`}
            className="text-lg font-bold hover:underline block"
            style={{ color: "var(--text-primary)" }}
            itemProp="name"
          >
            {author.name}
          </Link>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }} itemProp="jobTitle">
            {author.title}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">            {author.credentials.map((cred) => (
              <span
                key={cred}
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}
              >
                {cred}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }} itemProp="description">
        {author.bio}
      </p>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>{author.articlesCount} bài viết</span>
        <a
          href={author.linkedIn}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-medium hover:underline"
          style={{ color: "var(--primary-600)" }}
          itemProp="sameAs"
        >
          LinkedIn ↗
        </a>
      </div>
    </div>
  );
}