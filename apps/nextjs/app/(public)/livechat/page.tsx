// @ts-nocheck
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import LiveChatPanel from "@/components/public/LiveChatPanel";
import { getLang, langAlternates } from "@/lib/lang";
import { normalizeMetaDescription } from "@/lib/seo/meta-utils";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const canonical = `https://sgsland.vn${en ? "/en/livechat" : "/livechat"}`;
  const title = en ? "24/7 Real Estate AI Live Chat | SGS LAND" : "Live Chat AI Bất Động Sản 24/7 | SGS LAND";
  const description = normalizeMetaDescription(
    en
      ? "Chat with SGS LAND AI about property prices, legal checks, projects, mortgage rates and next steps before contacting a consultant."
      : "Chat với AI SGS LAND về giá BĐS, pháp lý, dự án, lãi suất vay và bước tiếp theo trước khi kết nối chuyên viên tư vấn.",
    en ? " Available 24/7 with references and clear verification boundaries." : " Hỗ trợ 24/7 với nguồn tham khảo và giới hạn xác minh rõ ràng.",
  );
  return {
    title: { absolute: title },
    description,
    alternates: { canonical, ...langAlternates("/livechat") },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: [{ url: "https://sgsland.vn/og-image.jpg", width: 1200, height: 630, alt: "SGS LAND AI Live Chat" }],
    },
  };
}
export const dynamic = "force-dynamic";

type LiveChatSearchParams = {
  title?: string | string[];
  desc?: string | string[];
  source?: string | string[];
  prompt?: string | string[];
  prefill?: string | string[];
};

function firstParam(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function LiveChatPage({
  searchParams,
}: {
  searchParams: Promise<LiveChatSearchParams>;
}) {
  const params = await searchParams;
  const title = firstParam(params.title, "AI Chat BĐS 24/7");
  const description = firstParam(
    params.desc,
    "Hỏi bất kỳ điều gì về thị trường BĐS — giá, pháp lý, dự án, lãi suất ngân hàng",
  );
  const source = firstParam(params.source, "WEB");
  const prompt = firstParam(params.prompt, firstParam(params.prefill, ""));
  const en = (await getLang()) === "en";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ background: "var(--primary-subtle)" }}>
          <MessageCircle className="w-7 h-7" style={{ color: "var(--primary-600)" }} aria-hidden />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 text-left" aria-label={en ? "Live Chat facts" : "Thông tin Live Chat"}>
        {[
          { value: "24/7", label: en ? "Available" : "Hoạt động" },
          { value: "3 giây", label: en ? "Valuation estimate" : "Ước tính định giá" },
          { value: "45.000+", label: en ? "Reference listings" : "Sản phẩm tham khảo" },
        ].map((fact) => (
          <div key={fact.value} className="rounded-xl p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <strong className="block text-base" style={{ color: "var(--primary-600)" }}>{fact.value}</strong>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{fact.label}</span>
          </div>
        ))}
      </div>

      <LiveChatPanel source={source} title={title} description={description} initialMessage={prompt} />

      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Hotline hỗ trợ: <a href="tel:0379281445" className="font-semibold" style={{ color: "var(--primary-600)" }}>0379 281 445</a>
      </p>
    </div>
  );
}
