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
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

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
