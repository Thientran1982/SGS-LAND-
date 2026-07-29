// @ts-nocheck
import type { Metadata } from "next";
import { getLang, langAlternates } from "@/lib/lang";
import { Suspense } from "react";
import { LoginPage } from "@/components/public/LoginView8";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const en = lang === "en";
  return {
    title: en ? "Sign In | SGS LAND" : "Đăng Nhập | SGS LAND",
    description: en
      ? "Sign in to the SGS LAND CRM & property management platform"
      : "Đăng nhập vào hệ thống CRM & quản lý BĐS SGS LAND",
    robots: { index: false, follow: false },
    alternates: { canonical: en ? "https://sgsland.vn/en/login" : "https://sgsland.vn/login", ...langAlternates("/login") },
  };
}

// LoginPage is "use client" with hooks — must use SSR not the prerender phase
export const dynamic = "force-dynamic";

export default function LoginRoute() {
  return (
    // Suspense required because LoginPage uses useSearchParams()
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg-app)" }} />}>
      <LoginPage />
    </Suspense>
  );
}
