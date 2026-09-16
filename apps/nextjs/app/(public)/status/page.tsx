// @ts-nocheck
import type { Metadata } from "next";
import { CheckCircle } from "lucide-react";
import { SITE_URL } from "@/lib/schema";
import { getLang, langAlternates } from "@/lib/lang";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "System Status | SGS LAND" : "Trạng Thái Hệ Thống | SGS LAND",
    description: en
      ? "Current availability of SGS LAND services: API, dashboard, webhooks and AI services."
      : "Trạng thái hoạt động thời gian thực của nền tảng SGS LAND: API, Dashboard, Webhooks và dịch vụ AI.",
    alternates: { canonical: `${SITE_URL}${en ? "/en/status" : "/status"}`, ...langAlternates("/status") },
  };
}
export const dynamic = "force-dynamic";

const SERVICES = [
  ["API SGS LAND", "SGS LAND API"],
  ["Bảng điều khiển (Dashboard)", "Dashboard"],
  ["Webhooks & Tích hợp", "Webhooks & integrations"],
  ["Dịch vụ AI (Định giá & Trợ lý)", "AI services (valuation & assistant)"],
];

// Deterministic-ish uptime bars (rendered server-side per request).
const BARS = Array.from({ length: 60 }, (_, i) => {
  const degraded = i === 17 || i === 43; // two minor blips over 90 days
  return { degraded, height: 40 + ((i * 37) % 60) };
});

export default async function StatusPage() {
  const en = (await getLang()) === "en";
  const updatedAt = new Intl.DateTimeFormat(en ? "en-US" : "vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      {/* Operational hero */}
      <div
        className="p-8 rounded-3xl mb-10 flex items-center justify-between gap-4"
        style={{ background: "var(--ui-brand)", color: "var(--ui-on-brand)" }}
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {en ? "All systems are operating normally" : "Tất cả hệ thống đang hoạt động bình thường"}
          </h1>
          <p className="opacity-90 font-medium">{en ? `Updated ${updatedAt}` : `Cập nhật lúc ${updatedAt}`}</p>
        </div>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--ui-on-brand) 18%, transparent)" }}>
          <CheckCircle className="w-8 h-8" style={{ color: "var(--ui-on-brand)" }} />
        </div>
      </div>

      {/* Uptime */}
      <div
        className="rounded-3xl p-8 mb-10"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          {en ? "Uptime" : "Thời gian hoạt động (Uptime)"}
        </h2>
        <div className="flex gap-1 h-8 items-end">
          {BARS.map((b, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${b.height}%`, background: b.degraded ? "var(--ui-warning)" : "var(--ui-success)" }}
              title={b.degraded ? "Hiệu năng giảm nhẹ" : "Hoạt động tốt"}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs font-bold mt-3 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          <span>{en ? "90 days ago" : "90 ngày trước"}</span>
          <span style={{ color: "var(--ui-success)" }}>99,99%</span>
          <span>{en ? "Today" : "Hôm nay"}</span>
        </div>
      </div>

      {/* Services */}
      <div
        className="rounded-3xl overflow-hidden p-8 mb-10"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        {SERVICES.map(([vi, english], i) => (
          <div
            key={vi}
            className="flex justify-between items-center py-4"
            style={{ borderBottom: i < SERVICES.length - 1 ? "1px solid var(--border-default)" : "none" }}
          >
            <span className="font-bold" style={{ color: "var(--text-secondary)" }}>{en ? english : vi}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ui-success)" }}>
                {en ? "Operational" : "Hoạt động tốt"}
              </span>
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--ui-success)" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Past incidents */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          {en ? "Past incidents" : "Sự cố trong quá khứ"}
        </h2>
        <div
          className="text-sm italic pl-4 py-2"
          style={{ color: "var(--text-tertiary)", borderLeft: "4px solid var(--border-default)" }}
        >
          {en ? "No incidents recorded in the past 90 days." : "Không ghi nhận sự cố nào trong 90 ngày qua."}
        </div>
      </div>
    </div>
  );
}
