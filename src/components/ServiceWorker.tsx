"use client";
// Service worker kaydı (yalnızca yayında). Kayıttan sonra bu sayfanın yüklediği dosyalar önbelleğe bildirilir.

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = [
          window.location.pathname,
          ...performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((u) => u.startsWith(window.location.origin)),
        ];
        registration.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch(() => {});
  }, []);
  return null;
}
