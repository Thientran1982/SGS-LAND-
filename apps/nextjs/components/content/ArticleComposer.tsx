"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/data/categories";

/** Roles allowed to create articles (mirrors CAN_UPLOAD in knowledgeRoutes.ts). */
const CAN_POST = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];

type Me = { id: string; name: string; email: string; role: string };

function slugify(input: string) {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[d\u0111]/gi, (m) => (m === m.toLowerCase() ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
};

export default function ArticleComposer() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [csrf, setCsrf] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]?.slug ?? "phan-tich-thi-truong");
  const [author, setAuthor] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState("PUBLISHED");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdSlug, setCreatedSlug] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: Me | null) => {
        if (u && u.role) {
          setMe(u);
          setAuthor(u.name || "");
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));

    fetch("/api/csrf-token", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { csrfToken?: string } | null) => {
        if (d && d.csrfToken) setCsrf(d.csrfToken);
      })
      .catch(() => {});
  }, []);

  const finalSlug = useMemo(() => slug.trim() || slugify(title), [slug, title]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge/articles", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          slug: finalSlug,
          category,
          author: author.trim() || undefined,
          coverImage: coverImage.trim() || undefined,
          excerpt: excerpt.trim() || undefined,
          content,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          featured,
          status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError((body && (body.error as string)) || "Không đăng được bài. Vui lòng thử lại.");
        return;
      }
      const created = await res.json();
      setCreatedSlug(created?.slug || finalSlug);
    } catch {
      setError("Không đăng được bài. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (!checked) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Đang tải...
      </p>
    );
  }

  if (!me) {
    return (
      <div
        className="py-12 px-6 rounded-2xl text-center"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <p className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Bạn cần đăng nhập để đăng tin.
        </p>
        <Link
          href="/login?redirect=/news/dang-tin"
          className="inline-block px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--primary-600)" }}
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (!CAN_POST.includes(me.role)) {
    return (
      <div
        className="py-12 px-6 rounded-2xl text-center"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Tài khoản của bạn không có quyền đăng tin.
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          {me.email} &middot; {me.role}
        </p>
      </div>
    );
  }

  if (createdSlug) {
    return (
      <div
        className="py-12 px-6 rounded-2xl text-center"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <p className="font-bold text-lg mb-4" style={{ color: "var(--text-primary)" }}>
          Đăng bài thành công.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/news/${createdSlug}`}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: "var(--primary-600)" }}
          >
            Xem bài viết
          </Link>
          <Link
            href="/news"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          >
            Quay lại Tin tức
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
          Tiêu đề *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Đường dẫn (slug)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Để trống để tự tạo từ tiêu đề"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            /news/{finalSlug || "..."}
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Danh mục
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Tác giả hiển thị
          </label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Ảnh bìa (URL)
          </label>
          <input
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://..."
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
          Mô tả ngắn
        </label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
          Nội dung (HTML)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder="<h2>...</h2><p>...</p>"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Thẻ (cách nhau bởi dấu phẩy)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          >
            <option value="PUBLISHED">Xuất bản ngay</option>
            <option value="DRAFT">Lưu nháp</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        Đặt làm bài nổi bật
      </label>

      {error && (
        <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--primary-600)" }}
        >
          {saving ? "Đang đăng..." : "Đăng bài"}
        </button>
        <Link href="/news" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Quay lại Tin tức
        </Link>
      </div>
    </form>
  );
}
