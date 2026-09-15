"use client";
// Cloudflare Turnstile: bot oylarını engeller. Site anahtarı verilmediyse hiç kullanılmaz.

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; theme: string }) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    const render = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widgetId = window.turnstile.render(box.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true, defer: true });
      script.addEventListener("load", render);
      if (!existing) document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={box} />;
}
