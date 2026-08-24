import type { Metadata } from "next";
import ArticleComposer from "@/components/content/ArticleComposer";

export const metadata: Metadata = {
  title: "Chỉnh sửa tin tức | SGS LAND",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
        Chỉnh sửa tin tức
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Chỉ quản trị viên và trưởng nhóm được phép chỉnh sửa bài viết trong tenant của mình.
      </p>
      <ArticleComposer articleId={id} />
    </div>
  );
}