"use client";
// Planlayıcıdaki "Ortak boş saat" paneli: kendi dolu saatlerini kodlayıp paylaşılabilir link üretir.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";
import { busyMask, decodeMask, encodeMask } from "@/lib/planner/free-time";
import { SHARE_TEXT, shareOrWhatsapp } from "@/lib/planner/share-links";
import { sharedLabel, sharedSections } from "@/lib/planner/shared-sections";
import type { Course } from "@/lib/types";
import { freeKey } from "./FreeTime";
import type { PlacedMeeting } from "./placed";
import styles from "./FreeTimeShare.module.css";

interface Props {
  meetings: readonly PlacedMeeting[];
  schoolId: string;
  termId: string;
  /** Sepetteki dersler; "aynı şubeyi alalım" için. */
  cart: readonly string[];
  courses: ReadonlyMap<string, Course>;
}

/** Yapıştırılan link ya da ham koddan dolu saat kodunu çıkarır. */
function codeFromInput(raw: string): string | null {
  const text = raw.trim();
  if (text === "") return null;
  const fromLink = /[?&]k=([A-Za-z0-9_-]+)/.exec(text);
  const candidate = fromLink ? fromLink[1] : text;
  return decodeMask(candidate) ? candidate : null;
}

export function FreeTimeShare({ meetings, schoolId, termId, cart, courses }: Props) {
  const [note, setNote] = useState("");
  // Arkadaşının dolu saatleri ve seçili ders ("aynı şubeyi alalım").
  const [typed, setTyped] = useState("");
  const [friend, setFriend] = useState<Uint8Array | null>(null);
  const [picked, setPicked] = useState("");
  const code = encodeMask(busyMask(meetings.map((m) => ({ day: m.day, start: m.start, end: m.end }))));

  // Kod tarayıcıda saklanır; ortak boş saat sayfası kendi programını buradan okur.
  useEffect(() => {
    try {
      window.localStorage.setItem(freeKey(schoolId, termId), code);
    } catch {
      /* depo kapalı */
    }
  }, [code, schoolId, termId]);

  const matchCourses = useMemo(
    () => cart.map((c) => courses.get(c)).filter((c): c is Course => !!c && c.sections.length > 1),
    [cart, courses],
  );
  const current = matchCourses.find((c) => c.code === picked) ?? matchCourses[0];
  const rows = friend && current ? sharedSections(current, meetings, friend) : [];

  function addFriend() {
    const found = codeFromInput(typed);
    if (!found) {
      setNote("Kod okunamadı. Arkadaşının gönderdiği linki olduğu gibi yapıştır.");
      return;
    }
    setFriend(decodeMask(found));
    setTyped("");
    setNote("Arkadaşın eklendi.");
    if (!picked && matchCourses[0]) setPicked(matchCourses[0].code);
  }

  const link = () => `${window.location.origin}/ozyegin/bos-saat/?k=${code}`;

  async function send() {
    const how = await shareOrWhatsapp(SHARE_TEXT.freeTime, link());
    setNote(how === "share" ? "Paylaşım penceresi açıldı." : "WhatsApp açıldı, sohbeti seç.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
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
          <button type="button" className="btn btn-pen" onClick={send}>
            Arkadaşına gönder
          </button>
          <button type="button" className="btn btn-small" onClick={copy}>
            Linki kopyala
          </button>
          <Link href={`/ozyegin/bos-saat/?k=${code}`} className="btn btn-small">
            Sayfayı aç
          </Link>
        </div>
        <hr className={styles.rule} />

        <p className={styles.lead}>
          <strong>Aynı şubeyi alalım.</strong> Arkadaşının kodunu (ya da gönderdiği linki) yapıştır; hangi şubeleri
          ikinizin de alabileceğini göstereyim.
        </p>

        <div className={styles.actions}>
          <label className={styles.field}>
            <span className="sr-only">Arkadaşının kodu ya da linki</span>
            <input
              className={styles.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFriend()}
              placeholder="Arkadaşının linkini yapıştır"
              spellCheck={false}
            />
          </label>
          <button type="button" className="btn btn-small" onClick={addFriend}>
            Ekle
          </button>
          {friend && (
            <button type="button" className="btn btn-small" onClick={() => setFriend(null)}>
              Arkadaşı çıkar
            </button>
          )}
        </div>

        {friend && matchCourses.length === 0 && (
          <p className={styles.lead}>Sepetinde birden çok şubesi olan ders yok.</p>
        )}

        {friend && matchCourses.length > 0 && (
          <>
            <div className={styles.actions}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Ders</span>
                <select className="select" value={picked} onChange={(e) => setPicked(e.target.value)}>
                  {matchCourses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ul className={styles.rows}>
              {rows.map((row) => (
                <li key={row.sectionId} className={styles.row} data-ok={row.bothFree}>
                  <span className={styles.rowHead}>
                    <span className={`${styles.tag} num`}>{row.sectionId}</span>
                    <span className={`${styles.when} num`}>
                      {row.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}–${m.end}`).join(", ") || "saatsiz"}
                    </span>
                  </span>
                  <span className={styles.rowMeta}>
                    {row.instructors.map(personName).join(", ") || "Hoca belirtilmemiş"}
                  </span>
                  <span className={styles.rowState}>{sharedLabel(row)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {note && (
          <p className={styles.lead} role="status">
            {note}
          </p>
        )}
      </div>
    </details>
  );
}
