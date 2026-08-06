import type { Metadata } from "next";
import ArticleComposer from "@/components/content/ArticleComposer";

export const metadata: Metadata = {
  title: "Đăng tin mới | SGS LAND",
  robots: { index: false, follow: false },
};

// The composer reads the session cookie at runtime.
export const dynamic = "force-dynamic";

export default function CreateArticlePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:py-12">
      <h1
        className="text-2xl sm:text-3xl font-extrabold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        Đăng tin mới
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Bài viết được lưu vào cơ sở dữ liệu và hiển thị ngay trên chuyên mục Kiến thức & Tin tức BĐS.
      </p>
      <ArticleComposer />
    </div>
  );
}
