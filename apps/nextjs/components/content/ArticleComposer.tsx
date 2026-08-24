"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "@/data/categories";
import FormSelect from "@/components/ui/FormSelect";

/** Roles allowed to create articles (mirrors CAN_UPLOAD in knowledgeRoutes.ts). */
const CAN_POST = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];
const CAN_MANAGE = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"];

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

export default function ArticleComposer({ articleId }: { articleId?: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [meCheckError, setMeCheckError] = useState(false);
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
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdSlug, setCreatedSlug] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error(`auth check failed: ${r.status}`);
        return r.json();
      })
      // /api/auth/me responds { user: {...} }, not the flat user object --
      // unwrap it here, otherwise this always looks logged-out and the
      // composer never renders even for a valid admin session.
      .then((d: { user?: Me } | null) => {
        const u = d?.user;
        if (u && u.role) {
          setMe(u);
          setAuthor(u.name || "");
        }
      })
      .catch(() => setMeCheckError(true))
      .finally(() => setChecked(true));

    fetch("/api/csrf-token", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { csrfToken?: string } | null) => {
        if (d && d.csrfToken) setCsrf(d.csrfToken);
      })
      .catch(() => {});

    if (articleId) {
      fetch(`/api/knowledge/articles/${encodeURIComponent(articleId)}`, {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (r) => {
          if (!r.ok) throw new Error("Không thể tải bài viết.");
          return r.json();
        })
        .then((article) => {
          setTitle(article.title || "");
          setSlug(article.slug || "");
          setCategory(article.category || CATEGORIES[0]?.slug || "phan-tich-thi-truong");
          setAuthor(article.author || "");
          setCoverImage(article.coverImage || article.image || "");
          setExcerpt(article.excerpt || "");
          setContent(article.content || "");
          setTags(Array.isArray(article.tags) ? article.tags.join(", ") : "");
          setFeatured(article.featured === true);
          setStatus(String(article.status || "DRAFT").toUpperCase());
          setImages(Array.isArray(article.images) ? article.images : []);
          setVideos(Array.isArray(article.videos) ? article.videos : []);
        })
        .catch((e) => setError(e?.message || "Không thể tải bài viết."))
        .finally(() => setChecked(true));
    }
  }, [articleId]);

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
      const res = await fetch(
        articleId
          ? `/api/knowledge/articles/${encodeURIComponent(articleId)}`
          : "/api/knowledge/articles",
        {
        method: articleId ? "PUT" : "POST",
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
          images: images.length ? images : undefined,
          videos: videos.length ? videos : undefined,
          excerpt: excerpt.trim() || undefined,
          content,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          featured,
          status,
        }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError((body && (body.error as string)) || (articleId ? "Không thể lưu bài viết." : "Không đăng được bài. Vui lòng thử lại."));
        return;
      }
      const saved = await res.json();
      setCreatedSlug(saved?.slug || finalSlug);
    } catch {
      setError(articleId ? "Không thể lưu bài viết. Vui lòng thử lại." : "Không đăng được bài. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(fileList: FileList | null, kind: "image" | "video") {
    if (!fileList || fileList.length === 0) return;
    setUploadError("");
    const setUploading = kind === "image" ? setUploadingImage : setUploadingVideo;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(fileList).forEach((f) => fd.append("files", f, f.name));
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        headers: { ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((body && body.error) || "Tải lên thất bại. Vui lòng thử lại.");
      }
      const uploaded: { url: string }[] = (body && body.files) || [];
      const urls = uploaded.map((f) => f.url).filter(Boolean);
      if (kind === "image") {
        setImages((prev) => {
          const next = [...prev, ...urls];
          if (!coverImage.trim() && next[0]) setCoverImage(next[0]);
          return next;
        });
      } else {
        setVideos((prev) => [...prev, ...urls]);
      }
      if (body && Array.isArray(body.warnings) && body.warnings.length) {
        setUploadError(body.warnings.join(" "));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tải lên thất bại. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
    if (coverImage === url) setCoverImage("");
  }

  function removeVideo(url: string) {
    setVideos((prev) => prev.filter((u) => u !== url));
  }

  if (!checked) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Đang tải...
      </p>
    );
  }

  if (meCheckError) {
    return (
      <div
        className="py-12 px-6 rounded-2xl text-center"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <p className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Không thể kiểm tra phiên đăng nhập. Vui lòng tải lại trang.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-block px-6 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: "var(--primary-600)" }}
        >
          Tải lại
        </button>
      </div>
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

  if (articleId && !CAN_MANAGE.includes(me.role)) {
    return (
      <div className="py-12 px-6 rounded-2xl text-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Tài khoản của bạn không có quyền chỉnh sửa tin tức.</p>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{me.email} · {me.role}</p>
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
          {articleId ? "Cập nhật bài viết thành công." : "Đăng bài thành công."}
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
          <FormSelect
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))}
          />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Hình ảnh
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={uploadingImage}
            onChange={(e) => {
              uploadFiles(e.target.files, "image");
              e.target.value = "";
            }}
            className="w-full text-sm"
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {uploadingImage ? "Đang tải ảnh lên..." : "JPG, PNG, WEBP, GIF - tối đa 10MB/ảnh."}
          </p>
          {images.length ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((url) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg"
                    style={{ border: "1px solid var(--border-default)" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs leading-none flex items-center justify-center"
                    style={{ background: "#dc2626" }}
                    aria-label="Xoá ảnh"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            Video
          </label>
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
            multiple
            disabled={uploadingVideo}
            onChange={(e) => {
              uploadFiles(e.target.files, "video");
              e.target.value = "";
            }}
            className="w-full text-sm"
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {uploadingVideo ? "Đang tải video lên..." : "MP4, WEBM, MOV, AVI - tối đa 100MB/video."}
          </p>
          {videos.length ? (
            <ul className="mt-2 space-y-1">
              {videos.map((url) => (
                <li
                  key={url}
                  className="flex items-center justify-between gap-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="truncate">{url.split("/").pop()}</span>
                  <button type="button" onClick={() => removeVideo(url)} style={{ color: "#dc2626" }}>
                    Xoá
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {uploadError ? (
        <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
          {uploadError}
        </p>
      ) : null}

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
          <FormSelect
            value={status}
            onChange={setStatus}
            options={[
              { value: "PUBLISHED", label: "Xuất bản ngay" },
              { value: "DRAFT", label: "Lưu nháp" },
            ]}
          />
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
          {saving ? (articleId ? "Đang lưu..." : "Đang đăng...") : (articleId ? "Lưu thay đổi" : "Đăng bài")}
        </button>
        <Link href="/news" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Quay lại Tin tức
        </Link>
      </div>
    </form>
  );
}
