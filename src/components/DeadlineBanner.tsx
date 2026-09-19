"use client";
// Sitenin üstündeki geri sayım bandı: süren ya da bu hafta başlayacak kayıt/ekleme-bırakma/çekilme.
// "Bugün" sunucuda bilinmez; ilk çizimde bant yoktur, tarayıcıda İstanbul saatine göre görünür.

import Link from "next/link";
import { useEffect, useState } from "react";
import { deadlineText, pickDeadline } from "@/lib/academic-calendar/deadline";
import type { CalendarEvent } from "@/lib/academic-calendar/types";
import styles from "./deadline.module.css";

const DISMISS_KEY = "takvim-bandi-kapatilan";

const istanbulToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function DeadlineBanner({ events }: { events: CalendarEvent[] }) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = istanbulToday();
    const picked = pickDeadline(events, now);
    if (!picked) return;
    let dismissed = "";
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) ?? "";
    } catch {
      /* depo kapalı */
    }
    if (dismissed === picked.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setEvent(picked);
  }, [events]);

  if (!event) return null;
  const text = deadlineText(event, today);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, event!.id);
    } catch {
      /* depo kapalı */
    }
    setEvent(null);
  }

  return (
    <aside className={styles.band} data-urgent={text.urgent}>
      <Link href="/ozyegin/takvim" className={styles.text}>
        <span className={styles.head}>{text.head}</span>
        <span className={styles.detail}>{text.detail}</span>
      </Link>
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Bandı kapat">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}
