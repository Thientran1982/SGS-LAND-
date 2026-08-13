"use client";
import dynamic from "next/dynamic";

// Lazy-load khung chat voi agent Minh - nang, chi chay o client.
const MinhChatWidget = dynamic(
  () => import("./MinhChatWidget").then((m) => m.MinhChatWidget),
  {
    ssr: false,
    loading: () => null,
  },
);

export function AiChatWidgetWrapper() {
  return <MinhChatWidget source="WIDGET" />;
}
