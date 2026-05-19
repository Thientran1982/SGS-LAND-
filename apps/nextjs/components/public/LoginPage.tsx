"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });

      if (res.ok) {
        router.push(redirect);
      } else {
        const data = await res.json();
        setError(data.message ?? "Email hoặc mật khẩu không đúng");
        setStatus("error");
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-app)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 12l10 5 10-5" /><path d="M2 17l10 5 10-5" />
            </svg>
            <span className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>SGS <span style={{ color: "var(--primary-600)" }}>LAND</span></span>
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Đăng nhập</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Hệ thống quản lý BĐS AI</p>
        </div>

        {/* Form card */}
        <div className="p-8 rounded-3xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-lg)" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
                style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-10 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: "var(--bg-elevated)", border: "1.5px solid var(--border-default)", color: "var(--text-primary)" }}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-center py-2 px-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-danger)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={status === "loading"}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: "var(--primary-600)" }}>
              {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Đăng nhập"}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
            Chưa có tài khoản?{" "}
            <a href="mailto:info@sgsland.vn" className="font-medium hover:opacity-80" style={{ color: "var(--primary-600)" }}>
              Liên hệ SGS LAND
            </a>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/" className="hover:opacity-80">← Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
