// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Users, Zap, Globe2, Shield, Bot } from "lucide-react";

export const metadata: Metadata = {
  title: "CRM Bất Động Sản AI | Giải Pháp #1 Việt Nam",
  description:
    "SGS LAND CRM — Quản lý leads, hợp đồng, kho hàng BĐS trên 1 nền tảng. AI định giá, chat đa kênh (Zalo, Facebook, Email), báo cáo realtime. Dùng miễn phí.",
  alternates: { canonical: "https://sgsland.vn/crm-platform", languages: { "vi-VN": "https://sgsland.vn/crm-platform", "en-US": "https://sgsland.vn/en/crm-platform", "x-default": "https://sgsland.vn/crm-platform" } },
};

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: <Users className="w-6 h-6" />, title: "CRM Đa kênh", desc: "Quản lý leads từ Zalo, Facebook, Website, Email trong 1 dashboard. Tự động phân loại, chấm điểm và phân công theo AI." },
  { icon: <BarChart3 className="w-6 h-6" />, title: "Kho hàng thông minh", desc: "45.000+ sản phẩm BĐS. Tìm kiếm real-time, so sánh, match tự động với nhu cầu khách hàng." },
  { icon: <Bot className="w-6 h-6" />, title: "AI Agent 24/7", desc: "8 AI Agent tự động xử lý chat, định giá, pháp lý, thị trường. Giảm 70% thời gian tư vấn thủ công." },
  { icon: <Zap className="w-6 h-6" />, title: "Tự động hoá", desc: "Workflow tự động: nhắc lịch, gửi báo giá, follow-up. Sequences email/Zalo tích hợp." },
  { icon: <Globe2 className="w-6 h-6" />, title: "Báo cáo realtime", desc: "Dashboard phân tích: conversion rate, doanh số, hiệu suất broker. Xuất báo cáo PDF tức thì." },
  { icon: <Shield className="w-6 h-6" />, title: "Bảo mật doanh nghiệp", desc: "Multi-tenant, phân quyền RBAC, audit log đầy đủ. Tuân thủ PDPA Việt Nam 2023." },
];

export default function CrmLandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-20 sm:py-32" style={{ background: "linear-gradient(135deg, #E8EEF5 0%, #F8FAFC 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
            🏆 Giải pháp CRM BĐS #1 Việt Nam
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight" style={{ color: "var(--text-primary)" }}>
            Hệ điều hành BĐS<br />
            <span style={{ color: "var(--primary-600)" }}>thế hệ mới với AI</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Quản lý toàn bộ hoạt động kinh doanh BĐS trên 1 nền tảng — CRM, kho hàng, hợp đồng,
            AI agent và báo cáo realtime. Tin dùng bởi 15.000+ môi giới.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login"
              className="px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: "var(--primary-600)" }}>
              Dùng miễn phí 30 ngày
            </Link>
            <Link href="/contact"
              className="px-8 py-4 rounded-2xl text-sm font-semibold border transition-colors"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>
              Xem demo trực tiếp
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-14" style={{ color: "var(--text-primary)" }}>
            Tất cả trong 1 nền tảng
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl transition-all hover:shadow-token-md"
                style={{ background: "var(--bg-app)", border: "1px solid var(--border-default)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary-600)" }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20" style={{ background: "var(--primary-600)" }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Bắt đầu ngay — miễn phí</h2>
          <p className="text-white/80 mb-8">Cá nhân: miễn phí · Team 5-20 người: từ 990.000đ/tháng · Enterprise: liên hệ</p>
          <Link href="/login"
            className="inline-block px-10 py-4 bg-[var(--bg-surface)] rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ color: "var(--primary-600)" }}>
            Đăng ký dùng thử
          </Link>
        </div>
      </section>
    </div>
  );
}
