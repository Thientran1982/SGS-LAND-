"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

export interface GeneratedLandingSection {
  stage: string;
  title?: string;
  body?: string;
  items?: string[];
  images?: string[];
  layout?: string;
  design?: LandingDesign;
  phone?: string;
  contactName?: string;
  tokens?: number;
}

interface LandingDesign {
  pattern?: string;
  confidence?: number;
  palette?: {
    navy?: string;
    navyStrong?: string;
    gold?: string;
    goldStrong?: string;
    surface?: string;
    surfaceSubtle?: string;
    text?: string;
    textSecondary?: string;
    border?: string;
    shadow?: string;
  };
  hero?: {
    alignment?: string;
    overlay?: string;
    imageTreatment?: string;
  };
  gallery?: {
    layout?: string;
    aspectRatio?: string;
  };
}

export interface GeneratedLandingData {
  id: string;
  visitor_key?: string;
  project_name: string;
  slug: string;
  sections: GeneratedLandingSection[];
  status: "draft" | "published" | string;
  language?: string;
  updated_at?: string;
}

const SECTION_ORDER = ["hero", "gallery", "legal", "price", "amenities", "contact"] as const;
const SECTION_LABELS: Record<string, string> = {
  hero: "Tổng quan",
  gallery: "Không gian dự án",
  legal: "Pháp lý",
  price: "Giá & thanh toán",
  amenities: "Tiện ích",
  contact: "Liên hệ",
};
const DEFAULT_PUBLISH_ERROR = "Không thể phát hành trang lúc này. Vui lòng thử lại.";

function sectionOf(page: GeneratedLandingData, stage: string) {
  return (Array.isArray(page.sections) ? page.sections : []).find((section) => section.stage === stage);
}

function phoneHref(phone?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}

function safeThemeValue(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\))$/i.test(raw) ? raw : fallback;
}

function safeShadow(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  return /^[0-9a-zA-Z .(),%#-]+$/.test(raw) ? raw : fallback;
}

async function getCsrfToken() {
  const response = await fetch("/api/csrf-token", {
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  return typeof data?.csrfToken === "string" ? data.csrfToken : "";
}

export function LandingNotFound() {
  return (
    <main className="landing-builder-not-found">
      <div className="landing-builder-not-found-card">
        <span className="landing-builder-not-found-code">404</span>
        <h1>Không tìm thấy trang landing</h1>
        <p>Trang bạn đang tìm không tồn tại hoặc chưa được phát hành.</p>
        <Link href="/livechat" className="landing-builder-primary-button">
          Dựng trang landing mới
        </Link>
      </div>
    </main>
  );
}

export default function GeneratedLandingPage({
  page,
  visitorKey,
}: {
  page: GeneratedLandingData;
  visitorKey?: string;
}) {
  const [status, setStatus] = useState(page.status);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const isDraft = status === "draft";
  const canPublish = isDraft && Boolean(visitorKey && visitorKey === page.visitor_key);
  const canEdit = Boolean(visitorKey && visitorKey === page.visitor_key);
  const editHref = canEdit
    ? `/landing-ai/chinh-sua/${encodeURIComponent(page.slug)}?k=${encodeURIComponent(visitorKey!)}`
    : "";
  const hero = sectionOf(page, "hero");
  const design = hero?.design;
  const contact = sectionOf(page, "contact");
  const contactPhone = phoneHref(contact?.phone);
  const palette = design?.palette;
  const themeStyle = {
    "--landing-brand": safeThemeValue(palette?.navy, "#1b3a5c"),
    "--landing-brand-strong": safeThemeValue(palette?.navyStrong, "#0f2740"),
    "--landing-accent": safeThemeValue(palette?.gold, "#c8963e"),
    "--landing-accent-strong": safeThemeValue(palette?.goldStrong, "#8c6420"),
    "--landing-bg": safeThemeValue(palette?.surface, "#f7f9fa"),
    "--landing-surface-subtle": safeThemeValue(palette?.surfaceSubtle, "#f0f4f5"),
    "--landing-text": safeThemeValue(palette?.text, "#16202b"),
    "--landing-text-secondary": safeThemeValue(palette?.textSecondary, "#4c6471"),
    "--landing-border": safeThemeValue(palette?.border, "rgba(21, 49, 70, .14)"),
    "--ui-shadow-sm": safeShadow(palette?.shadow, "0 8px 26px rgba(21,34,50,.08)"),
  } as CSSProperties;

  async function publish() {
    if (!visitorKey || publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(page.slug)}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ visitorKey }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string" && !/^[A-Z0-9_]+$/.test(data.error)
            ? data.error
            : DEFAULT_PUBLISH_ERROR;
        throw new Error(message);
      }
      setStatus("published");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : DEFAULT_PUBLISH_ERROR);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main
      className={`landing-builder-page landing-builder-pattern-${design?.pattern || "sanctuary"}`}
      style={themeStyle}
      data-design-confidence={design?.confidence ?? ""}
    >
      {isDraft && (
        <div className="landing-builder-draft-banner" role="status">
          <div className="landing-builder-draft-content">
            <span><strong>Bản nháp</strong> · Chỉ người có liên kết quản trị mới xem được trang này.</span>
            {publishError && (
              <p className="landing-builder-publish-error" role="alert">
                Phát hành chưa thành công: {publishError} Bạn có thể thử lại.
              </p>
            )}
          </div>
          {canEdit && (
            <div className="landing-builder-banner-actions">
              <Link href={editHref} className="landing-builder-edit-button">
                Chỉnh sửa
              </Link>
              {canPublish && (
                <button type="button" onClick={publish} disabled={publishing} className="landing-builder-publish-button">
                  {publishing ? "Đang phát hành..." : "Phát hành trang"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {canEdit && !isDraft && (
        <div className="landing-builder-owner-bar">
          <span>Trang đã xuất bản · Bạn đang xem với quyền quản trị</span>
          <Link href={editHref} className="landing-builder-edit-button">
            Chỉnh sửa
          </Link>
        </div>
      )}

      <header className={`landing-builder-hero landing-builder-hero-${design?.hero?.alignment === "center" ? "center" : "left"}`} id="hero">
        <div className="landing-builder-wrap landing-builder-hero-inner">
          <span className="landing-builder-eyebrow">SGS LAND · LANDING BUILDER</span>
          <h1>{hero?.title || page.project_name}</h1>
          <p>{hero?.body || "Thông tin dự án đang được cập nhật."}</p>
          <a href="#contact" className="landing-builder-primary-button">Nhận tư vấn dự án</a>
        </div>
      </header>

      <div className="landing-builder-wrap landing-builder-content">
        {SECTION_ORDER.slice(1, -1).map((stage) => {
          const section = sectionOf(page, stage);
          const items = Array.isArray(section?.items) ? section.items.filter(Boolean) : [];
          const images = Array.isArray(section?.images)
            ? section.images.filter((url): url is string => typeof url === "string" && url.length > 0)
            : [];
          const body = typeof section?.body === "string" ? section.body.trim() : "";
          return (
            <section className={`landing-builder-section landing-builder-section-${stage}`} id={stage} key={stage}>
              <div className="landing-builder-section-heading">
                <span className="landing-builder-section-index">0{SECTION_ORDER.indexOf(stage) + 1}</span>
                <div>
                  <span className="landing-builder-eyebrow">{SECTION_LABELS[stage]}</span>
                  <h2>{section?.title || SECTION_LABELS[stage]}</h2>
                </div>
              </div>
              {body && <p className="landing-builder-body">{body}</p>}
              {images.length > 0 && (
                <div
                  className={`landing-builder-gallery-grid landing-builder-gallery-${section?.layout || design?.gallery?.layout || "editorial-grid"}`}
                  aria-label="Hình ảnh dự án"
                >
                  {images.map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`${page.project_name} - hình ảnh ${index + 1}`}
                      className="landing-builder-gallery-image"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className="landing-builder-item-grid">
                  {items.map((item, index) => (
                    <div className="landing-builder-item-card" key={`${item}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              )}
              {!body && items.length === 0 && images.length === 0 && (
                <p className="landing-builder-muted" role="status">
                  Nội dung {SECTION_LABELS[stage].toLowerCase()} đang được cập nhật.
                </p>
              )}
            </section>
          );
        })}

        <section className="landing-builder-section landing-builder-contact" id="contact">
          <div>
            <span className="landing-builder-eyebrow">{SECTION_LABELS.contact}</span>
            <h2>{contact?.title || "Liên hệ môi giới"}</h2>
            <p>{contact?.body || "Để lại thông tin để SGS LAND hỗ trợ bạn."}</p>
            {contact?.contactName && <strong className="landing-builder-contact-name">{contact.contactName}</strong>}
          </div>
          <div className="landing-builder-contact-actions">
            {contactPhone ? (
              <a href={contactPhone} className="landing-builder-primary-button">
                {contact?.phone}
              </a>
            ) : (
              <Link href="/livechat" className="landing-builder-primary-button">Chat với SGS LAND</Link>
            )}
            <span className="landing-builder-muted">Thông tin sẽ được xác nhận trước khi giao dịch.</span>
          </div>
        </section>
      </div>
    </main>
  );
}