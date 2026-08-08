// @ts-nocheck
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/public/LoginView8";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Đặt Lại Mật Khẩu | SGS LAND",
    description: "Đặt lại mật khẩu tài khoản SGS LAND",
    robots: { index: false, follow: false },
  };
}

// Renders the same LoginPage as /login — its client-side logic reads the
// token straight out of window.location.pathname (see handleHashTokens in
// LoginView8.tsx), so no server-side param handling is needed here.
// force-dynamic because LoginPage uses client hooks (useSearchParams).
export const dynamic = "force-dynamic";

export default function ResetPasswordRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--bg-app)" }} />}>
      <LoginPage />
    </Suspense>
  );
}
