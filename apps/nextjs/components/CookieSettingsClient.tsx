"use client";

import { useEffect, useState } from "react";
import {
  type ConsentState,
  getStoredConsent,
  saveConsent,
} from "@/lib/consent";
import { getOrCreateVisitorId } from "@/lib/visitorId";

const DEFAULTS: ConsentState = { ESSENTIAL: true, BEHAVIORAL: false, ADVERTISING: false };

export default function CookieSettingsClient() {
  const [state, setState] = useState<ConsentState>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contact, setContact] = useState("");
  const [erasureStatus, setErasureStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) setState(stored);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await saveConsent({ BEHAVIORAL: state.BEHAVIORAL, ADVERTISING: state.ADVERTISING });
    setSaving(false);
    setSaved(true);
  }

  async function handleErasureRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) return;
    setErasureStatus("sending");
    try {
      const isEmail = contact.includes("@");
      const res = await fetch("/api/public/visitor/erasure-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          email: isEmail ? contact.trim() : undefined,
          phone: isEmail ? undefined : contact.trim(),
        }),
      });
      setErasureStatus(res.ok ? "sent" : "error");
    } catch {
      setErasureStatus("error");
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 500 }}>Cookie thiet yeu (bat buoc)</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Can thiet de website hoat dong binh thuong.</div>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 999, background: "#16a34a", opacity: 0.6 }} />
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 500 }}>Cookie hanh vi & ca nhan hoa</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Cho phep goi y bat dong san tuong tu dua tren tin da xem.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.BEHAVIORAL}
            onClick={() => setState((s) => ({ ...s, BEHAVIORAL: !s.BEHAVIORAL }))}
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: state.BEHAVIORAL ? "#16a34a" : "#d1d5db",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: state.BEHAVIORAL ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 500 }}>Cookie quang cao</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Do luong va toi uu quang cao tren nen tang khac.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.ADVERTISING}
            onClick={() => setState((s) => ({ ...s, ADVERTISING: !s.ADVERTISING }))}
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: state.ADVERTISING ? "#16a34a" : "#d1d5db",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: state.ADVERTISING ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
              }}
            />
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: "#111827",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {saving ? "Dang luu..." : "Luu tuy chon"}
      </button>
      {saved && <span style={{ marginLeft: 12, fontSize: 13, color: "#16a34a" }}>Da luu tuy chon cua ban.</span>}

      <hr style={{ margin: "32px 0", border: 0, borderTop: "1px solid #e5e7eb" }} />

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Yeu cau xoa du lieu ca nhan</h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        Ban co the yeu cau xoa du lieu hanh vi lien quan den email/so dien thoai cua minh. Chung toi se xu
        ly trong vong 72 gio.
      </p>
      <form onSubmit={handleErasureRequest} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email hoac so dien thoai"
          style={{
            flex: "1 1 260px",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={erasureStatus === "sending"}
          style={{
            background: "transparent",
            color: "#111827",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Gui yeu cau
        </button>
      </form>
      {erasureStatus === "sent" && (
        <p style={{ fontSize: 13, color: "#16a34a", marginTop: 8 }}>Da ghi nhan yeu cau cua ban.</p>
      )}
      {erasureStatus === "error" && (
        <p style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>
          Co loi xay ra, vui long thu lai sau.
        </p>
      )}
    </div>
  );
}
