"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CAN_POST = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];
const CAN_MANAGE = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"];

/** Small toolbar shown on /news only for signed-in staff who may publish. */
export function NewsAdminBar() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [articles, setArticles] = useState<Array<{ id: string; title: string; status?: string }>>([]);
  const [csrf, setCsrf] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      // /api/auth/me responds { user: {...} }, not the flat user object --
      // unwrap it here, otherwise u.role is always undefined and the bar
      // (and its "Dang tin moi" link) silently never shows for anyone.
      .then((d: { user?: { role?: string } } | null) => {
        const u = d?.user;
        if (alive && u && u.role) setRole(String(u.role));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!role || !CAN_MANAGE.includes(role)) return;
    let alive = true;
    Promise.all([
      fetch("/api/knowledge/articles?page=1&pageSize=20", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/csrf-token", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([articleData, csrfData]) => {
      if (!alive) return;
      setArticles(Array.isArray(articleData?.data) ? articleData.data : []);
      if (csrfData?.csrfToken) setCsrf(csrfData.csrfToken);
    }).catch(() => {});
    return () => { alive = false; };
  }, [role]);

  async function deleteArticle(article: { id: string; title: string }) {
    if (!window.confirm(`Xóa bài “${article.title}”? Hành động này không thể hoàn tác.`)) return;
    setDeleting(article.id);
    setMessage("");
    try {
      const response = await fetch(`/api/knowledge/articles/${encodeURIComponent(article.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Không thể xóa bài viết.");
      }
      setArticles((current) => current.filter((item) => item.id !== article.id));
      setMessage("Đã xóa bài viết.");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Không thể xóa bài viết.");
    } finally {
      setDeleting(null);
    }
  }

  if (!role || !CAN_POST.includes(role)) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 mb-6 px-4 py-3 rounded-xl"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Bạn đang đăng nhập với quyền biên tập nội dung.
      </span>
      <Link
        href="/news/dang-tin"
        className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
        style={{ background: "var(--primary-600)" }}
      >
        Đăng tin mới
      </Link>
      {CAN_MANAGE.includes(role) && articles.length > 0 && (
        <div className="w-full border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Quản lý bài viết</p>
          <div className="space-y-1.5">
            {articles.map((article) => (
              <div key={article.id} className="flex items-center gap-2 text-sm">
                <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>{article.title}</span>
                <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{article.status}</span>
                <Link href={`/news/dang-tin/sua/${article.id}`} className="shrink-0 font-semibold hover:underline" style={{ color: "var(--primary-600)" }}>Sửa</Link>
                <button type="button" onClick={() => deleteArticle(article)} disabled={deleting === article.id} className="shrink-0 font-semibold hover:underline disabled:opacity-50" style={{ color: "#dc2626" }}>
                  {deleting === article.id ? "Đang xóa…" : "Xóa"}
                </button>
              </div>
            ))}
          </div>
          {message && <p className="text-xs mt-2" style={{ color: message.startsWith("Đã") ? "#15803d" : "#dc2626" }}>{message}</p>}
        </div>
      )}
    </div>
  );
}
