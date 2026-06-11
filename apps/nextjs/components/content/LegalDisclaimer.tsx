// @ts-nocheck
import type { FC } from "react";
import { Scale } from "lucide-react";

interface LegalDisclaimerProps {
  lastUpdatedMonth?: string;
  lawName?: string;
  className?: string;
}

export const LegalDisclaimer: FC<LegalDisclaimerProps> = ({
  lastUpdatedMonth = "05/2025",
  lawName = "Luật Đất Đai 2024",
  className = "",
}) => (
  <div
    className={`flex gap-3 p-4 rounded-xl text-sm leading-relaxed ${className}`}
    role="note"
    aria-label="Lưu ý pháp lý"
    style={{
      background: "rgba(5, 150, 105, 0.06)",
      border: "1px solid rgba(5, 150, 105, 0.25)",
      color: "var(--text-secondary)",
    }}
  >
    <Scale className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--sgs-verified)" }} aria-hidden />
    <div>
      <p className="font-semibold mb-1" style={{ color: "var(--sgs-verified)" }}>Lưu ý pháp lý</p>
      <p>
        Nội dung bài viết này mang tính chất tham khảo chung, không thay thế tư vấn pháp lý chuyên
        nghiệp. Quy định pháp luật có thể thay đổi. Vui lòng liên hệ luật sư hoặc chuyên gia pháp
        lý để được tư vấn cụ thể cho trường hợp của bạn.
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
        Cập nhật lần cuối: {lastUpdatedMonth} theo {lawName}.
      </p>
    </div>
  </div>
);
