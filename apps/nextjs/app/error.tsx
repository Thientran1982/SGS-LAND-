"use client";
import { useEffect } from "react";
import Link from "next/link";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h2 className="text-2xl font-semibold text-foreground">
        Đã xảy ra lỗi
      </h2>
      <p className="max-w-md text-muted-foreground">
        Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="rounded-lg border px-6 py-3 text-sm font-medium text-foreground"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}