"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (/sw.js) for offline support.
 * Registration only runs in the browser, in production, and when
 * the browser supports service workers. Failures are swallowed so
 * they never affect page rendering.
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
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        caches.keys()
          .then((keys) => Promise.all(
            keys
              .filter((key) => key.startsWith("sgsland-"))
              .map((key) => caches.delete(key)),
          ))
          .catch(() => {});
      }
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
