"use client";
/**
 * Bubble noi o goc man hinh, mo khung chat voi agent Minh.
 * Dung chung MinhChatPanel voi trang /livechat nen khong fork logic.
 */
import React, { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { MinhChatPanel } from "./MinhChatPanel";

export interface MinhChatWidgetProps {
  apiBase?: string;
  /** LINK | EMBED | QR | WEB | WIDGET */
  source?: string;
}

export function MinhChatWidget({ apiBase, source = "WIDGET" }: MinhChatWidgetProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("sgs-open-chat", openHandler);
    return () => window.removeEventListener("sgs-open-chat", openHandler);
  }, []);
  return (
    <>
      {open ? (
        <div
          className="shadow-2xl"
          style={{ position: "fixed", right: 16, bottom: 92, zIndex: 2147483000, width: "min(92vw, 380px)" }}
        >
          <MinhChatPanel
            apiBase={apiBase}
            source={source}
            heightClass="h-[420px]"
            className="shadow-2xl"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Đóng khung chat" : "Mở chat với chuyên viên Minh"}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl"
        style={{
          position: "fixed",
          right: 16,
          bottom: 20,
          zIndex: 2147483000,
          background: "var(--cw-navy, #0B1D26)",
        }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}

export default MinhChatWidget;
