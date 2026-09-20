"use client";
// Planlayıcıdaki "Ortak boş saat" paneli: kendi dolu saatlerini kodlayıp paylaşılabilir link üretir.

import Link from "next/link";
import { useEffect, useState } from "react";
import { busyMask, encodeMask } from "@/lib/planner/free-time";
import { createCode } from "@/lib/planner/share-code";
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const mask = encodeMask(busyMask(meetings.map((m) => ({ day: m.day, start: m.start, end: m.end }))));

  // Kod tarayıcıda saklanır; ortak boş saat sayfası kendi programını buradan okur.
  useEffect(() => {
    try {
      window.localStorage.setItem(freeKey(schoolId, termId), mask);
    } catch {
      /* depo kapalı */
    }
  }, [mask, schoolId, termId]);

  async function copy() {
    if (busy) return;
    setBusy(true);
    setNote("");
    const result = await createCode("bos", mask);
    setBusy(false);
    if (!result.ok) {
      setNote(result.error);
      return;
    }
    setCode(result.code);
    try {
      await navigator.clipboard.writeText(result.code);
      setNote(`Kodun ${result.code}, panoya kopyalandı. Arkadaşına söyle, ortak boş saat sayfasına yazsın.`);
    } catch {
      setNote(`Kodun ${result.code}. Arkadaşına söyle, ortak boş saat sayfasına yazsın.`);
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
          Altı haneli bir kod al, arkadaşına söyle. O da ortak boş saat sayfasına bu kodu yazınca ikinizin de boş
          olduğu saatler çıkar. Kodda ders adı yok, yalnızca dolu saatler var.
        </p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-pen" onClick={copy} disabled={busy}>
            {busy ? "Kod alınıyor" : code ? `Kodun: ${code}` : "Kod al"}
          </button>
          <Link href={`/ozyegin/bos-saat/?k=${mask}`} className="btn btn-small">
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
