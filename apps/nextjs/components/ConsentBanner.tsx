"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/shared/useLang";
import { tt } from "@/lib/i18n";
import type { CSSProperties } from "react";
import {
  type ConsentState,
  acceptAll,
  rejectNonEssential,
  saveConsent,
  hasAnsweredConsent,
  getStoredConsent,
} from "@/lib/consent";

const primaryBtn: CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  background: "transparent",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

function ConsentToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 4px",
        borderBottom: "1px solid #e5e7eb",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          background: checked ? "#16a34a" : "#d1d5db",
          position: "relative",
          opacity: disabled ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
          }}
        />
      </button>
    </div>
  );
}

// Banner 2 lop theo Nghi dinh 13/2023/ND-CP & Luat 91/2025/QH15:
// Lop 1 = thong bao ngan + 3 nut hanh dong nhanh.
// Lop 2 = bang tuy chinh chi tiet tung loai cookie, khong co gia tri mac dinh duoc bat san
// (ngoai ESSENTIAL), im lang KHONG duoc coi la dong y.
export default function ConsentBanner() {
  const lang = useLang();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState<ConsentState>({ ESSENTIAL: true, BEHAVIORAL: false, ADVERTISING: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasAnsweredConsent()) {
      setVisible(true);
    }
    const stored = getStoredConsent();
    if (stored) setDraft(stored);
  }, []);

  if (!visible) return null;

  async function handleAcceptAll() {
    setSaving(true);
    await acceptAll();
    setSaving(false);
    setVisible(false);
  }

  async function handleRejectNonEssential() {
    setSaving(true);
    await rejectNonEssential();
    setSaving(false);
    setVisible(false);
  }

  async function handleSaveCustom() {
    setSaving(true);
    await saveConsent({ BEHAVIORAL: draft.BEHAVIORAL, ADVERTISING: draft.ADVERTISING });
    setSaving(false);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label={tt(lang, "Cài đặt cookie", "Cookie settings")}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {!showDetails ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#4b5563", flex: "1 1 320px" }}>
              {tt(lang,
                "SGS LAND sử dụng cookie thiết yếu để vận hành website và cookie tùy chọn (nếu bạn đồng ý) để cá nhân hóa gợi ý bất động sản phù hợp hơn. Xem ",
                "SGS LAND uses essential cookies to operate the site and optional cookies (with your consent) to personalise property recommendations. See ")}
              <a href="/cookie-settings" style={{ textDecoration: "underline" }}>
                {tt(lang, "chính sách cookie", "cookie policy")}
              </a>
              .
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowDetails(true)} disabled={saving} style={secondaryBtn}>
                {tt(lang, "Tùy chỉnh", "Customise")}
              </button>
              <button onClick={handleRejectNonEssential} disabled={saving} style={secondaryBtn}>
                {tt(lang, "Chỉ thiết yếu", "Essential only")}
              </button>
              <button onClick={handleAcceptAll} disabled={saving} style={primaryBtn}>
                {tt(lang, "Chấp nhận tất cả", "Accept all")}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{tt(lang, "Tùy chọn cookie", "Cookie preferences")}</h2>
            <ConsentToggleRow
              label={tt(lang, "Thiết yếu (bắt buộc)", "Essential (required)")}
              description={tt(lang, "Cần thiết để website hoạt động, không thể tắt.", "Required for the website to work; cannot be turned off.")}
              checked={true}
              disabled
              onChange={() => {}}
            />
            <ConsentToggleRow
              label={tt(lang, "Hành vi & cá nhân hóa", "Behaviour & personalisation")}
              description={tt(lang, "Giúp gợi ý bất động sản tương tự và thông báo phù hợp hơn với bạn.", "Helps us recommend similar properties and more relevant notifications.")}
              checked={draft.BEHAVIORAL}
              onChange={(v) => setDraft((d) => ({ ...d, BEHAVIORAL: v }))}
            />
            <ConsentToggleRow
              label={tt(lang, "Quảng cáo", "Advertising")}
              description={tt(lang, "Giúp đo lường và tối ưu hiệu quả quảng cáo trên các nền tảng khác.", "Helps measure and optimise ad performance on other platforms.")}
              checked={draft.ADVERTISING}
              onChange={(v) => setDraft((d) => ({ ...d, ADVERTISING: v }))}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowDetails(false)} disabled={saving} style={secondaryBtn}>
                {tt(lang, "Quay lại", "Back")}
              </button>
              <button onClick={handleSaveCustom} disabled={saving} style={primaryBtn}>
                {tt(lang, "Lưu tùy chọn", "Save preferences")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
