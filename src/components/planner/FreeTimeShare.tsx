"use client";
// Planlayıcıdaki "Ortak boş saat" paneli: kendi dolu saatlerini kodlayıp paylaşılabilir link üretir.

import Link from "next/link";
import { useEffect, useState } from "react";
import { busyMask, encodeMask } from "@/lib/planner/free-time";
import { freeKey } from "./FreeTime";
import type { PlacedMeeting } from "./placed";
import styles from "./FreeTimeShare.module.css";

interface Props {
  meetings: readonly PlacedMeeting[];
  schoolId: string;
  termId: string;
}

export function FreeTimeShare({ meetings, schoolId, termId }: Props) {
  const [note, setNote] = useState("");
  const code = encodeMask(busyMask(meetings.map((m) => ({ day: m.day, start: m.start, end: m.end }))));

  // Kod tarayıcıda saklanır; ortak boş saat sayfası kendi programını buradan okur.
  useEffect(() => {
    try {
      window.localStorage.setItem(freeKey(schoolId, termId), code);
    } catch {
      /* depo kapalı */
    }
  }, [code, schoolId, termId]);

  async function copy() {
    const link = `${window.location.origin}/ozyegin/bos-saat/?k=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link kopyalandı. Arkadaşına gönder; o da kendi programını ekleyince ortak saatleriniz çıkar.");
    } catch {
      setNote("Kopyalanamadı. Ortak boş saat sayfasından linki elle alabilirsin.");
    }
  }

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span className={styles.title}>Ortak boş saat</span>
        <span className={styles.hint}>Arkadaşınla kesişen boşluklar.</span>
      </summary>

      <div className={styles.body}>
        <p className={styles.lead}>
          Linki arkadaşına gönder, o da kendi programını eklesin; ikinizin de boş olduğu saatler çıksın. Linkte ders
          adı yok, yalnızca dolu saatler var.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-pen" onClick={copy}>
            Boş saat linkimi kopyala
          </button>
          <Link href={`/ozyegin/bos-saat/?k=${code}`} className="btn btn-small">
            Sayfayı aç
          </Link>
        </div>
        {note && (
          <p className={styles.lead} role="status">
            {note}
          </p>
        )}
      </div>
    </details>
  );
}
