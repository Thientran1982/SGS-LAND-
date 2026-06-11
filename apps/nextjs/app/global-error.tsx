// @ts-nocheck
"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-5xl font-bold">500</h1>
        <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
        <p className="max-w-md text-sm text-sgs-text-muted">
          Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-sgs-primary px-6 py-3 text-sm font-medium text-white hover:bg-sgs-primary"
        >
          Thử lại
        </button>
      </body>
    </html>
  );
}
