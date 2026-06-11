// @ts-nocheck
import type { FC } from "react";
import { ShieldCheck, RefreshCw, BookOpen, Award } from "lucide-react";

interface TrustBadgesProps {
  className?: string;
  compact?: boolean;
}

const PARTNERS = ["Novaland", "Vinhomes", "Masterise", "Nam Long"];

const BADGES = [
  { icon: ShieldCheck, label: "Thông tin được kiểm chứng" },
  { icon: RefreshCw, label: "Cập nhật theo luật hiện hành" },
  { icon: BookOpen, label: "Chuyên gia SGS Land biên soạn" },
  { icon: Award, label: "Top Proptech Việt Nam 2025" },
];

export const TrustBadges: FC<TrustBadgesProps> = ({ className = "", compact = false }) => (
  <aside
    className={`rounded-2xl p-5 ${className}`}
    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    aria-label="Trust signals"
  >
    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-tertiary)" }}>
      Độ tin cậy
    </p>

    <ul className="space-y-2.5 mb-5">
      {BADGES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--primary-600)" }} aria-hidden />
          {label}
        </li>
      ))}
    </ul>

    {!compact && (
      <>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-tertiary)" }}>
          Đối tác uỷ quyền
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PARTNERS.map((p) => (
            <span
              key={p}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                opacity: 0.8,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </>
    )}
  </aside>
);
