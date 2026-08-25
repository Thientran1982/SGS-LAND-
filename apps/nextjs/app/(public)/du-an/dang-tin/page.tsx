import type { Metadata } from "next";
import PublicProjectComposer from "@/components/content/PublicProjectComposer";
export const metadata: Metadata = { title: "Đăng dự án mới | SGS LAND", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function CreatePublicProjectPage() { return <main className="mx-auto max-w-3xl px-4 py-10"><h1 className="mb-2 text-3xl font-bold">Đăng dự án mới</h1><p className="mb-8 text-sm opacity-70">Tạo nội dung giới thiệu dự án trên website public. Dữ liệu này tách biệt với danh mục dự án CRM.</p><PublicProjectComposer /></main>; }