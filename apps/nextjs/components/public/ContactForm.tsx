// @ts-nocheck
"use client";
import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";
import { TopicSelect } from "./TopicSelect";
type FormState = { name: string; email: string; phone: string; subject: string; message: string };
const SUBJECT_OPTIONS = [
  { value: "Tư vấn mua BĐS", label: "Tư vấn mua BĐS" },
  { value: "Ký gửi BĐS", label: "Ký gửi BĐS" },
  { value: "Giải pháp CRM doanh nghiệp", label: "Giải pháp CRM doanh nghiệp" },
  { value: "Định giá BĐS", label: "Định giá BĐS" },
  { value: "Hỗ trợ kỹ thuật", label: "Hỗ trợ kỹ thuật" },
  { value: "Khác", label: "Khác" },
];

async function getCsrfToken(): Promise<string> {
  const fromCookie = () => {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const existing = fromCookie();
  if (existing) return existing;
  try {
    const r = await fetch("/api/csrf-token", { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    return j?.csrfToken || fromCookie();
  } catch {
    return fromCookie();
  }
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/public/contact", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };
  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <CheckCircle className="w-16 h-16 mb-4" style={{ color: "var(--color-success)" }} />
        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Gửi thành công!</h3>
        <p style={{ color: "var(--text-secondary)" }}>Đội ngũ SGS LAND sẽ phản hồi trong vòng 2 giờ làm việc.</p>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: "name", label: "Họ tên *", type: "text", placeholder: "Nguyễn Văn A", required: true },
          { name: "phone", label: "Số điện thoại *", type: "tel", placeholder: "0379 281 445", required: true },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              required={f.required}
              value={form[f.name as keyof FormState]}
              onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
        <input
          type="email"
          required
          placeholder="email@example.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
          style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Chủ đề</label>
        <TopicSelect
            value={form.subject}
            onChange={(v) => setForm((p) => ({ ...p, subject: v }))}
            placeholder="Chọn chủ đề..."
            options={SUBJECT_OPTIONS}
          />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nội dung *</label>
        <textarea
          required
          rows={4}
          placeholder="Mô tả nhu cầu của bạn..."
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 resize-none"
          style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        style={{ background: "var(--primary-600)" }}
      >
        {status === "loading" ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {status === "loading" ? "Đang gửi..." : "Gửi tin nhắn"}
      </button>
      {status === "error" && (
        <p className="text-sm text-center" style={{ color: "var(--color-danger)" }}>
          Có lỗi xảy ra. Vui lòng gọi trực tiếp 0379 281 445.
        </p>
      )}
    </form>
  );
}