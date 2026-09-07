// @ts-nocheck
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import LiveChatPanel from "@/components/public/LiveChatPanel";

export const metadata: Metadata = {
  title: "Live Chat AI BĐS",
  description: "Chat trực tiếp với AI Agent SGS LAND: hỏi về giá BĐS, pháp lý, dự án, lãi suất vay. Phản hồi tức thì 24/7.",
  alternates: { canonical: "https://sgsland.vn/livechat", languages: { "vi-VN": "https://sgsland.vn/livechat", "en-US": "https://sgsland.vn/en/livechat", "x-default": "https://sgsland.vn/livechat" } },
};
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

      <LiveChatPanel source={source} title={title} description={description} initialMessage={prompt} />

      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Hotline hỗ trợ: <a href="tel:0379281445" className="font-semibold" style={{ color: "var(--primary-600)" }}>0379 281 445</a>
      </p>
    </div>
  );
}
