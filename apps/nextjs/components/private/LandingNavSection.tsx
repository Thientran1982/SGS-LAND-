"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, ExternalLink, FilePlus2 } from "lucide-react";

type LandingPageSummary = {
  id: string;
  project_name: string;
  slug: string;
  status: "draft" | "published" | string;
};

function statusLabel(status: string) {
  return status === "published" ? "Đã xuất bản" : "Bản nháp";
}

export default function LandingNavSection() {
  const [visitorKey, setVisitorKey] = useState("");
  const [pages, setPages] = useState<LandingPageSummary[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const userId = String(data?.user?.id || "").trim();
        if (!alive || !userId) return;
        setVisitorKey(userId);
        return fetch(`/api/landing-pages?visitorKey=${encodeURIComponent(userId)}`, {
          credentials: "include",
          cache: "no-store",
        });
      })
      .then((response) => (response?.ok ? response.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data?.pages)) setPages(data.pages);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
      <Link
        href="/livechat?source=LANDING_BUILDER&title=D%E1%BB%B1ng%20trang%20landing&prompt=T%C3%B4i%20mu%E1%BB%91n%20d%E1%BB%B1ng%20m%E1%BB%99t%20trang%20landing%20b%E1%BA%A5t%20%C4%91%E1%BB%99ng%20s%E1%BA%A3n"
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
        style={{ color: "var(--primary-600)", background: "var(--primary-subtle)" }}
      >
        <Building2 className="w-4 h-4 shrink-0" />
        Trang Landing
      </Link>
      <div className="mt-2 ml-3 space-y-1">
        {pages.map((page) => {
          const viewHref = `/landing/${encodeURIComponent(page.slug)}${
            page.status === "draft" && visitorKey ? `?visitorKey=${encodeURIComponent(visitorKey)}` : ""
          }`;
          return (
            <div key={page.id} className="flex items-center gap-2 min-w-0 text-xs">
              <span className="truncate flex-1" style={{ color: "var(--text-secondary)" }}>
                {page.project_name}
              </span>
              <span
                className="shrink-0"
                style={{ color: page.status === "published" ? "var(--color-success)" : "var(--text-tertiary)" }}
              >
                {statusLabel(page.status)}
              </span>
              <Link
                href={viewHref}
                aria-label={`Xem ${page.project_name}`}
                className="shrink-0 inline-flex items-center gap-1 font-semibold"
                style={{ color: "var(--primary-600)" }}
              >
                Xem <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          );
        })}
        <Link
          href="/livechat?source=LANDING_BUILDER&title=D%E1%BB%B1ng%20trang%20landing&prompt=T%C3%B4i%20mu%E1%BB%91n%20d%E1%BB%B1ng%20m%E1%BB%99t%20trang%20landing%20b%E1%BA%A5t%20%C4%91%E1%BB%99ng%20s%E1%BA%A3n"
          className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold"
          style={{ color: "var(--primary-600)" }}
        >
          <FilePlus2 className="w-3 h-3" /> + Tạo trang landing
        </Link>
      </div>
    </div>
  );
}