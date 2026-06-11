// @ts-nocheck
"use client";

import dynamic from "next/dynamic";

// Lazy-load the AI chat widget — heavy, client-only
const AiChatWidget = dynamic(
  () => import("./AiChatWidget").then((m) => m.AiChatWidget),
  {
    ssr: false,
    loading: () => null,
  }
);

export function AiChatWidgetWrapper() {
  return <AiChatWidget />;
}
