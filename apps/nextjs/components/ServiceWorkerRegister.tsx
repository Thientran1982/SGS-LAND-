"use client";

import { useEffect } from "react";

const DEV_CLEANUP_KEY = "sgs-dev-sw-cleanup";

async function cleanupDevelopmentServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  let isReloading = false;
  try {
    isReloading = sessionStorage.getItem(DEV_CLEANUP_KEY) === "reloading";
    if (isReloading) sessionStorage.removeItem(DEV_CLEANUP_KEY);
  } catch {
    /* storage may be unavailable in a restricted preview */
  }

  const [registrations, cacheNames] = await Promise.all([
    navigator.serviceWorker.getRegistrations().catch(() => []),
    typeof caches === "undefined" ? Promise.resolve<string[]>([]) : caches.keys().catch(() => []),
  ]);
  const hasStaleState = registrations.length > 0 || cacheNames.length > 0;

  await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
  if (typeof caches !== "undefined") {
    await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
  }

  if (hasStaleState && !isReloading) {
    try {
      sessionStorage.setItem(DEV_CLEANUP_KEY, "reloading");
    } catch {
      /* storage may be unavailable in a restricted preview */
    }
    window.location.reload();
  }
}

/**
 * Registers the service worker (/sw.js) for offline support.
 * Registration only runs in the browser, in production, and when
 * the browser supports service workers. In development the root layout
 * starts an early cleanup; this component waits for it so a stale worker
 * cannot keep serving old chunks after the page has hydrated.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // A browser can retain a production service worker while the Replit
    // preview is running the dev server on the same origin. Its cache-first
    // asset strategy can then pair old client chunks with fresh SSR HTML,
    // producing an apparent hydration mismatch. Preview/dev must never be
    // controlled by that worker.
    if (process.env.NODE_ENV !== "production") {
      // The inline bootstrap in the root layout runs before React hydration.
      // Keep this effect as a fallback for pages rendered without that layout
      // (and for browsers that finish the cleanup after this component mounts).
      const cleanup = (
        window as Window & {
          __sgsDevServiceWorkerCleanup?: Promise<void>;
        }
      ).__sgsDevServiceWorkerCleanup;
      void (cleanup ?? cleanupDevelopmentServiceWorkers());
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore registration errors */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}