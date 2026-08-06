"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CAN_POST = ["SUPER_ADMIN", "ADMIN", "TEAM_LEAD", "SALES", "MARKETING"];

/** Small toolbar shown on /news only for signed-in staff who may publish. */
export function NewsAdminBar() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: { role?: string } | null) => {
        if (alive && u && u.role) setRole(String(u.role));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
    </div>
  );
}
