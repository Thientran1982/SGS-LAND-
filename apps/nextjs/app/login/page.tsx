import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/public/LoginPage";

export const metadata: Metadata = {
  title: "Đăng Nhập | SGS LAND",
  description: "Đăng nhập vào hệ thống CRM & quản lý BĐS SGS LAND",
  robots: { index: false, follow: false },
};

export const revalidate = false;

export default function LoginRoute() {
  return (
    // Suspense required because LoginPage uses useSearchParams()
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg-app)" }} />}>
      <LoginPage />
    </Suspense>
  );
}
