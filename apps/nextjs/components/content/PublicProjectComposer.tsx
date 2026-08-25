"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const roles = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];
const input = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
export default function PublicProjectComposer({ id }: { id?: string }) {
  const [me, setMe] = useState<any>(null); const [csrf, setCsrf] = useState("");
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [status, setStatus] = useState("DRAFT");
  const [fields, setFields] = useState({ developer: "", location: "", scale: "", type: "", price: "", description: "", amenities: "", highlights: "", faq: "", seoTitle: "", seoDescription: "", images: "", videos: "" });
  const [error, setError] = useState(""); const [saved, setSaved] = useState("");
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  useEffect(() => {
    Promise.all([fetch("/api/auth/me", { credentials: "include" }), fetch("/api/csrf-token", { credentials: "include" })]).then(async ([a, c]) => {
      const u = (await a.json()).user; setMe(u); setCsrf((await c.json()).csrfToken || "");
      if (id) { const r = await fetch(`/api/public-project-content/${id}`, { credentials: "include" }); const x = await r.json(); if (r.ok) { setName(x.name); setSlug(x.slug); setStatus(x.status); setFields(v => ({ ...v, ...(x.content || {}) })); } }
    }).catch(() => setError("Không thể kiểm tra phiên đăng nhập."));
  }, [id]);
  if (!me) return <p className="py-10 text-sm">Đang kiểm tra quyền…</p>;
  if (!roles.includes(me.role)) return <p className="py-10 text-sm text-red-600">Bạn không có quyền biên tập nội dung này.</p>;
  const set = (key: keyof typeof fields, value: string) => setFields(v => ({ ...v, [key]: value }));
  async function uploadFiles(fileList: FileList | null, kind: "image" | "video") {
    if (!fileList?.length) return;
    setError(""); setUploading(kind);
    try {
      const body = new FormData();
      Array.from(fileList).forEach(file => body.append("files", file, file.name));
      const response = await fetch("/api/upload", { method: "POST", credentials: "include", headers: { ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Tải media thất bại.");
      const urls = (data.files || []).map((file: { url?: string }) => file.url).filter(Boolean);
      set(kind === "image" ? "images" : "videos", `${fields[kind === "image" ? "images" : "videos"]}${fields[kind === "image" ? "images" : "videos"] ? "\n" : ""}${urls.join("\n")}`);
      if (data.warnings?.length) setError(data.warnings.join(" "));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Tải media thất bại.");
    } finally { setUploading(null); }
  }
  function removeMedia(kind: "images" | "videos", url: string) {
    set(kind, fields[kind].split(/\r?\n/).filter(item => item && item !== url).join("\n"));
  }
  async function save() {
    setError(""); setSaved("");
    const payload = { name, slug, status, content: fields };
    const r = await fetch(id ? `/api/public-project-content/${id}` : "/api/public-project-content", { method: id ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({})); if (!r.ok) return setError(data.error || "Không thể lưu.");
    setSaved(status === "PUBLISHED" ? "Đã xuất bản dự án." : "Đã lưu bản nháp.");
    if (!id && data.id) window.history.replaceState({}, "", `/du-an/dang-tin/sua/${data.id}`);
  }
  const labels: Record<string, string> = { developer: "Chủ đầu tư", location: "Vị trí", scale: "Quy mô", type: "Loại hình", price: "Giá tham khảo", description: "Mô tả", amenities: "Tiện ích (mỗi dòng một mục)", highlights: "Điểm nổi bật (mỗi dòng một mục)", faq: "FAQ (JSON hoặc nội dung tự do)", seoTitle: "SEO title", seoDescription: "SEO description" };
  const media = (kind: "images" | "videos") => fields[kind].split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><label>Tên dự án<input className={input} value={name} onChange={e => setName(e.target.value)} /></label><label>Slug<input className={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="aqua-city" /></label></div>
    <StatusDropdown value={status} onChange={setStatus} />
    {Object.entries(labels).map(([key, label]) => <label key={key}>{label}<textarea className={`${input} min-h-20`} value={fields[key as keyof typeof fields]} onChange={e => set(key as keyof typeof fields, e.target.value)} /></label>)}
    <MediaUploader kind="images" label="Ảnh dự án" accept="image/jpeg,image/png,image/webp,image/gif" uploading={uploading === "image"} urls={media("images")} onUpload={files => uploadFiles(files, "image")} onRemove={url => removeMedia("images", url)} />
    <MediaUploader kind="videos" label="Video dự án" accept="video/mp4,video/webm,video/quicktime,video/ogg" uploading={uploading === "video"} urls={media("videos")} onUpload={files => uploadFiles(files, "video")} onRemove={url => removeMedia("videos", url)} />
    {error && <p className="text-sm text-red-600">{error}</p>}{saved && <p className="text-sm text-green-700">{saved}</p>}
    <div className="flex gap-3"><button onClick={save} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--primary-600)" }}>Lưu nội dung</button><Link href="/du-an" className="rounded-xl border px-5 py-2.5 text-sm">Hủy</Link></div>
  </div>;
}

function StatusDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [{ value: "DRAFT", label: "Bản nháp" }, { value: "PUBLISHED", label: "Xuất bản" }];
  const selected = options.find(option => option.value === value) || options[0];
  return <div className="relative sm:max-w-xs"><span className="text-sm font-medium">Trạng thái</span><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${input} flex items-center justify-between bg-[var(--bg-app)] text-left`}><span>{selected.label}</span><span className="text-xs opacity-60">{open ? "▲" : "▼"}</span></button>{open && <div className="absolute z-30 mt-1 w-full rounded-lg border p-1 shadow-lg" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>{options.map(option => <button key={option.value} type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--ui-surface-subtle)]" onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}</div>;
}

function MediaUploader({ kind, label, accept, uploading, urls, onUpload, onRemove }: { kind: "images" | "videos"; label: string; accept: string; uploading: boolean; urls: string[]; onUpload: (files: FileList | null) => void; onRemove: (url: string) => void }) {
  return <section className="rounded-xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--ui-surface-subtle)" }}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{label}</h2><p className="mt-1 text-xs opacity-65">{kind === "images" ? "Ảnh đầu tiên sẽ dùng làm ảnh đại diện trên card." : "Video sẽ hiển thị trong trang chi tiết dự án."}</p></div><label className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: "var(--primary-600)" }}>{uploading ? "Đang tải…" : `Chọn ${kind === "images" ? "ảnh" : "video"}`}<input className="hidden" type="file" accept={accept} multiple disabled={uploading} onChange={event => { onUpload(event.target.files); event.currentTarget.value = ""; }} /></label></div>{urls.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{urls.map(url => <div key={url} className="flex gap-2 rounded-lg border p-2" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>{kind === "images" ? <img src={url} alt="" className="h-16 w-20 rounded object-cover" /> : <video src={url} className="h-16 w-20 rounded object-cover" muted preload="metadata" />}<span className="min-w-0 flex-1 truncate self-center text-xs">{url.split("/").pop()}</span><button type="button" onClick={() => onRemove(url)} className="self-center text-xs font-semibold text-red-600">Xóa</button></div>)}</div>}</section>;
}