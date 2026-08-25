"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const CAN_POST = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];
const CAN_MANAGE = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD"];
type Item = { id: string; name: string; slug: string; status: string };

export default function PublicProjectAdminBar() {
  const [role, setRole] = useState(""); const [items, setItems] = useState<Item[]>([]);
  const [csrf, setCsrf] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.role) setRole(d.user.role); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!CAN_MANAGE.includes(role)) return;
    Promise.all([fetch("/api/public-project-content", { credentials: "include" }), fetch("/api/csrf-token", { credentials: "include" })])
      .then(async ([a, c]) => { const data = await a.json(); const token = await c.json(); setItems(data.data || []); setCsrf(token.csrfToken || ""); }).catch(() => {});
  }, [role]);
  if (!CAN_POST.includes(role)) return null;
  async function remove(item: Item) {
    if (!confirm(`Xóa nội dung “${item.name}”?`)) return;
    const r = await fetch(`/api/public-project-content/${item.id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": csrf } });
    if (r.ok) { setItems(x => x.filter(i => i.id !== item.id)); setMessage("Đã xóa nội dung."); } else setMessage("Không thể xóa nội dung.");
  }
  return <div className="mb-6 rounded-xl border px-4 py-3" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Bạn đang đăng nhập với quyền biên tập dự án giới thiệu.</span>
      <Link href="/du-an/dang-tin" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--primary-600)" }}>Đăng dự án mới</Link>
    </div>
    {CAN_MANAGE.includes(role) && items.length > 0 && <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
      {items.map(i => <div key={i.id} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{i.name}</span><span className="text-xs opacity-60">{i.status}</span><Link className="font-semibold" href={`/du-an/dang-tin/sua/${i.id}`}>Sửa</Link><button className="font-semibold text-red-600" onClick={() => remove(i)}>Xóa</button></div>)}
    </div>}
    {message && <p className="mt-2 text-xs">{message}</p>}
  </div>;
}