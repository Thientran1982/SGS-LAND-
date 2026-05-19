"use client";

import Link from "next/link";
import { MapPin, Phone, ArrowRight, Building2 } from "lucide-react";

interface ProjectDetail {
  name: string;
  developer?: string;
  location?: string;
  description?: string;
  total_units?: number;
  status?: string;
  handover_year?: string;
  // price_range can be string ("từ 6 tỷ") or object from backend
  price_range?: { min: number; max: number; unit: string } | string;
  legal_status?: string;
  property_types?: string[];
  investment_score?: number;
}

interface Props {
  project: ProjectDetail;
  slug: string;
}

export function ProjectDetailPage({ project, slug }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/" className="hover:opacity-80">Trang chủ</Link>
        <span>/</span>
        <Link href="/du-an" className="hover:opacity-80">Dự án</Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
      </nav>

      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          {project.status && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ background: "var(--primary-600)" }}>
              {project.status}
            </span>
          )}
          {project.legal_status && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
              {project.legal_status}
            </span>
          )}
        </div>

        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{project.name}</h1>

        {project.location && (
          <p className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            <MapPin className="w-4 h-4" style={{ color: "var(--primary-600)" }} />
            {project.location}
            {project.developer && ` · ${project.developer}`}
          </p>
        )}

        {project.description && (
          <p className="text-base leading-relaxed max-w-3xl" style={{ color: "var(--text-secondary)" }}>
            {project.description}
          </p>
        )}
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          project.price_range && {
            label: "Giá từ",
            value: typeof project.price_range === "string"
              ? project.price_range
              : `${project.price_range.min} ${project.price_range.unit}`,
          },
          project.total_units && { label: "Tổng sản phẩm", value: `${project.total_units}` },
          project.handover_year && { label: "Bàn giao", value: project.handover_year },
          project.investment_score && { label: "Investment Score", value: `${project.investment_score}/100` },
        ].filter((item): item is { label: string; value: string } => Boolean(item)).map((item) => (
          <div key={item.label} className="p-4 rounded-2xl text-center"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
            <p className="text-xl font-bold mb-1" style={{ color: "var(--primary-600)" }}>{item.value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="p-8 rounded-2xl" style={{ background: "var(--primary-subtle)", border: "1px solid var(--primary-600)20" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Tư vấn & đặt mua {project.name}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              SGS LAND — Đại lý phân phối uỷ quyền chính thức
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href="tel:+84971132378"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--primary-600)" }}>
              <Phone className="w-4 h-4" />
              0971 132 378
            </a>
            <Link href="/marketplace"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ border: "1.5px solid var(--primary-600)", color: "var(--primary-600)" }}>
              Xem tất cả BĐS <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
