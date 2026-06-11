export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 – Không tìm thấy trang | SGS Land",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="text-2xl font-semibold text-foreground">
        Không tìm thấy trang
      </h2>
      <p className="max-w-md text-muted-foreground">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
