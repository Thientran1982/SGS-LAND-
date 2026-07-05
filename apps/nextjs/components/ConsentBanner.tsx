"use client";

import { useEffect, useState } from "react";
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
      aria-label="Cai dat cookie"
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
              SGS LAND su dung cookie thiet yeu de van hanh website va cookie tuy chon (neu ban dong y) de
              ca nhan hoa goi y bat dong san phu hop hon. Xem{" "}
              <a href="/cookie-settings" style={{ textDecoration: "underline" }}>
                chinh sach cookie
              </a>
              .
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowDetails(true)} disabled={saving} style={secondaryBtn}>
                Tuy chinh
              </button>
              <button onClick={handleRejectNonEssential} disabled={saving} style={secondaryBtn}>
                Chi thiet yeu
              </button>
              <button onClick={handleAcceptAll} disabled={saving} style={primaryBtn}>
                Chap nhan tat ca
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Tuy chon cookie</h2>
            <ConsentToggleRow
              label="Thiet yeu (bat buoc)"
              description="Can thiet de website hoat dong, khong the tat."
              checked={true}
              disabled
              onChange={() => {}}
            />
            <ConsentToggleRow
              label="Hanh vi & ca nhan hoa"
              description="Giup goi y bat dong san tuong tu va thong bao phu hop hon voi ban."
              checked={draft.BEHAVIORAL}
              onChange={(v) => setDraft((d) => ({ ...d, BEHAVIORAL: v }))}
            />
            <ConsentToggleRow
              label="Quang cao"
              description="Giup do luong va toi uu hieu qua quang cao tren cac nen tang khac."
              checked={draft.ADVERTISING}
              onChange={(v) => setDraft((d) => ({ ...d, ADVERTISING: v }))}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowDetails(false)} disabled={saving} style={secondaryBtn}>
                Quay lai
              </button>
              <button onClick={handleSaveCustom} disabled={saving} style={primaryBtn}>
                Luu tuy chon
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
