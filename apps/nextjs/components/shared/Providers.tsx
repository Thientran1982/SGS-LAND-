"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// QueryClientProvider and ThemeProvider both call React.useEffect() inside their
// render bodies.  React 19 / Next.js 15's prerender-client mode intentionally
// makes useEffect unavailable during SSG prerendering, so these providers MUST
// run client-side only.  We use dynamic({ ssr: false }) so they are excluded
// from server-side prerendering while still hydrating immediately in the browser.
const ClientOnlyProviders = dynamic(
  () => import("./ClientOnlyProviders").then((m) => m.ClientOnlyProviders),
  { ssr: false, loading: () => null }
);

export function Providers({ children }: { children: ReactNode }) {
  return <ClientOnlyProviders>{children}</ClientOnlyProviders>;
}
