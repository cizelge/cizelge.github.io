"use client";
// "Ana ekrana ekle": Android/Chrome'da tarayıcının kurulum penceresini açar, iPhone'da nasıl ekleneceğini söyler.
// Uygulama olarak açıldıysa ya da kullanıcı kapattıysa görünmez.

import { useEffect, useState } from "react";
import styles from "./Today.module.css";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "bugun:kurulum-kapatildi";

type Mode = "hidden" | "prompt" | "ios" | "other";

export function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* depo kapalı */
    }
    if (standalone || dismissed) return;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const mobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(ios ? "ios" : mobile ? "other" : "hidden");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* depo kapalı */
    }
    setMode("hidden");
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") setMode("hidden");
    setEvent(null);
  }

  return (
    <section className={styles.install} aria-labelledby="kurulum-baslik">
      <h2 id="kurulum-baslik" className={styles.installTitle}>
        Telefonuna uygulama gibi ekle
      </h2>
      {mode === "prompt" ? (
        <p className={styles.muted}>Ana ekrandan tek dokunuşla açılır, internet yokken de bugünkü derslerin görünür.</p>
      ) : mode === "ios" ? (
        <p className={styles.muted}>
          Safari&apos;de alttaki Paylaş düğmesine dokun, sonra &ldquo;Ana Ekrana Ekle&rdquo;yi seç. İnternet yokken de açılır.
        </p>
      ) : (
        <p className={styles.muted}>
          Tarayıcının menüsünden &ldquo;Ana ekrana ekle&rdquo; ya da &ldquo;Uygulamayı yükle&rdquo;yi seç. İnternet yokken de açılır.
        </p>
      )}
      <div className={styles.installActions}>
        {mode === "prompt" && (
          <button type="button" className="btn btn-pen" onClick={install}>
            Ana ekrana ekle
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={dismiss}>
          Gösterme
        </button>
      </div>
    </section>
  );
}
