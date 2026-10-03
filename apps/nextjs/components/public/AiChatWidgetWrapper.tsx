"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Lazy-load khung chat voi agent Minh - nang, chi chay o client.
const MinhChatWidget = dynamic(
  () => import("./MinhChatWidget").then((m) => m.MinhChatWidget),
  {
    ssr: false,
    loading: () => null,
  },
);

export function AiChatWidgetWrapper() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 140);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div className="sgs-home-chat" data-scrolled={scrolled}>
      <style jsx global>{`
        .sgs-home-chat > button {
          right: clamp(22px, 3vw, 42px) !important;
          transition: transform .22s ease, right .22s ease, bottom .22s ease !important;
        }
        .sgs-home-chat[data-scrolled="true"] > button {
          right: clamp(34px, 5vw, 66px) !important;
          transform: scale(.84);
        }
        .sgs-home-chat > div {
          right: clamp(22px, 3vw, 42px) !important;
        }
        @media (max-width: 767px) {
          .sgs-home-chat > button { bottom: 74px !important; }
          .sgs-home-chat > div { bottom: 144px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sgs-home-chat > button { transition: none !important; }
        }
      `}</style>
      <MinhChatWidget source="WIDGET" />
    </div>
  );
}
