"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const roles = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];
const input = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
export default function PublicProjectComposer({ id }: { id?: string }) {
  const [me, setMe] = useState<any>(null); const [csrf, setCsrf] = useState("");
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [status, setStatus] = useState("DRAFT");
  const [fields, setFields] = useState({ developer: "", location: "", scale: "", type: "", price: "", description: "", amenities: "", highlights: "", faq: "", seoTitle: "", seoDescription: "", images: "" });
  const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/auth/me", { credentials: "include" }), fetch("/api/csrf-token", { credentials: "include" })]).then(async ([a, c]) => {
      const u = (await a.json()).user; setMe(u); setCsrf((await c.json()).csrfToken || "");
      if (id) { const r = await fetch(`/api/public-project-content/${id}`, { credentials: "include" }); const x = await r.json(); if (r.ok) { setName(x.name); setSlug(x.slug); setStatus(x.status); setFields(v => ({ ...v, ...(x.content || {}) })); } }
    }).catch(() => setError("Không thể kiểm tra phiên đăng nhập."));
  }, [id]);
  if (!me) return <p className="py-10 text-sm">Đang kiểm tra quyền…</p>;
  if (!roles.includes(me.role)) return <p className="py-10 text-sm text-red-600">Bạn không có quyền biên tập nội dung này.</p>;
  const set = (key: keyof typeof fields, value: string) => setFields(v => ({ ...v, [key]: value }));
  async function save() {
    setError(""); setSaved("");
    const payload = { name, slug, status, content: fields };
    const r = await fetch(id ? `/api/public-project-content/${id}` : "/api/public-project-content", { method: id ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({})); if (!r.ok) return setError(data.error || "Không thể lưu.");
    setSaved(status === "PUBLISHED" ? "Đã xuất bản dự án." : "Đã lưu bản nháp.");
    if (!id && data.id) window.history.replaceState({}, "", `/du-an/dang-tin/sua/${data.id}`);
  }
  const labels: Record<string, string> = { developer: "Chủ đầu tư", location: "Vị trí", scale: "Quy mô", type: "Loại hình", price: "Giá tham khảo", description: "Mô tả", amenities: "Tiện ích (mỗi dòng một mục)", highlights: "Điểm nổi bật (mỗi dòng một mục)", faq: "FAQ (JSON hoặc nội dung tự do)", seoTitle: "SEO title", seoDescription: "SEO description", images: "Ảnh (mỗi URL một dòng)" };
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><label>Tên dự án<input className={input} value={name} onChange={e => setName(e.target.value)} /></label><label>Slug<input className={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="aqua-city" /></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label>Trạng thái<select className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Xuất bản</option></select></label></div>
    {Object.entries(labels).map(([key, label]) => <label key={key}>{label}<textarea className={`${input} min-h-20`} value={fields[key as keyof typeof fields]} onChange={e => set(key as keyof typeof fields, e.target.value)} /></label>)}
    {error && <p className="text-sm text-red-600">{error}</p>}{saved && <p className="text-sm text-green-700">{saved}</p>}
    <div className="flex gap-3"><button onClick={save} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--primary-600)" }}>Lưu nội dung</button><Link href="/du-an" className="rounded-xl border px-5 py-2.5 text-sm">Hủy</Link></div>
  </div>;
}