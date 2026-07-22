// @ts-nocheck
import type { Metadata } from "next";
import CookieSettingsClient from "@/components/CookieSettingsClient";
export const metadata: Metadata = { title: "Cookie Settings", alternates: { canonical: "https://sgsland.vn/cookie-settings" } };
export const dynamic = "force-dynamic";
export default function CookieSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24" style={{ color: "var(--text-primary)" }}>
      <h1 className="text-3xl font-bold mb-8">Cai Dat Cookie</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        SGS LAND su dung cookie de cai thien trai nghiem nguoi dung. Ban co the tuy chinh cac loai cookie duoc
        su dung tai day. Thay doi se duoc ap dung ngay va luu lai cho lan truy cap sau.
      </p>
      <CookieSettingsClient />
    </div>
  );
}
