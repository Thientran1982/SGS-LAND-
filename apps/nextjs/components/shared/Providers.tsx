"use client";

import { QueryClientContext } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

// Browser singleton — created once and manually mounted (replacing the
// useEffect that QueryClientProvider would normally use for mount/unmount).
let _browserClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: fresh client per render to prevent cross-request state leakage
    return makeQueryClient();
  }
  if (!_browserClient) {
    _browserClient = makeQueryClient();
    // Mount immediately; replaces the useEffect in official QueryClientProvider
    _browserClient.mount();
  }
  return _browserClient;
}

// Provides QueryClient context WITHOUT calling any React hooks.
//
// Why not use <QueryClientProvider>?
//   It calls useEffect() internally, which is null in Next.js 15's prerender
//   dispatcher (ContextOnlyDispatcher) and crashes the build.
//
// Why not use dynamic({ ssr: false }) wrapping children?
//   That injects a BAILOUT_TO_CLIENT_SIDE_RENDERING template into the server
//   HTML, causing React hydration error #418 on every page load.
//
// This component only uses QueryClientContext.Provider (a plain Context.Provider
// element — no hooks) and is therefore safe to render during the prerender
// phase.  Pages whose own components use hooks (CrmShell, PublicHeader …) must
// still set `export const dynamic = "force-dynamic"` in their layout so they
// go through normal SSR rather than the limited prerender dispatcher.
export function Providers({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  return (
    <QueryClientContext.Provider value={client}>
      {children}
    </QueryClientContext.Provider>
  );
}
