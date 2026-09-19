"use client";
// Şube değiştirme: dersin bütün şubelerini gün, saat, hoca ve puanıyla gösterir; seçilen şube programa kilitlenir.
// Çakışan şubeler de listelenir, hangi dersle çakıştığı yazar.

import { useEffect, useMemo, useRef } from "react";
import { Stars } from "@/components/ratings/Stars";
import { DAY_SHORT } from "@/lib/days";
import { parseTime } from "@/lib/engine";
import { personName } from "@/lib/format";
import { scoreLookup, sectionScore } from "@/lib/planner/instructor-score";
import { useRatings } from "@/lib/ratings/useRatings";
import type { Course, Meeting } from "@/lib/types";
import type { PlacedMeeting } from "./placed";
import styles from "./SectionSwap.module.css";

interface Props {
  school: string;
  course: Course;
  /** Şu an seçili şube. */
  currentId: string | undefined;
  /** Kilitli şube ("yalnız bu şube"); yoksa null. */
  lockedId: string | null;
  /** Programdaki bütün oturumlar (bu dersinkiler dahil). */
  meetings: readonly PlacedMeeting[];
  onPick: (sectionId: string) => void;
  onUnlock: () => void;
  onClose: () => void;
}

const overlaps = (a: Pick<Meeting, "day" | "start" | "end">, b: Pick<Meeting, "day" | "start" | "end">) =>
  a.day === b.day && parseTime(a.start) < parseTime(b.end) && parseTime(b.start) < parseTime(a.end);

export function SectionSwap({ school, course, currentId, lockedId, meetings, onPick, onUnlock, onClose }: Props) {
  const box = useRef<HTMLElement>(null);
  // Panel sepetten açılır; telefonda ekranın altında kalmasın diye görünür yere kaydırılır.
  useEffect(() => {
    box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [course.code]);
  const { summaries } = useRatings(school);
  const scoreOf = useMemo(() => scoreLookup(summaries?.instructors), [summaries]);
  // Bu dersin kendi oturumları çakışma sayılmaz.
  const others = meetings.filter((m) => m.courseCode !== course.code);

  const rows = course.sections.map((section) => {
    const clashes = new Set<string>();
    for (const m of section.meetings) {
      for (const other of others) if (overlaps(m, other)) clashes.add(other.courseCode);
    }
    return {
      section,
      clashes: [...clashes],
      score: sectionScore(course, section.id, scoreOf),
      when: section.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}–${m.end}`).join(", ") || "saatsiz",
      rooms: [...new Set(section.meetings.map((m) => m.room).filter((r): r is string => !!r))],
    };
  });

  return (
    <section ref={box} className={styles.root} aria-labelledby="sube-baslik">
      <div className={styles.head}>
        <h2 id="sube-baslik" className={styles.title}>
          <span className="num">{course.code}</span> şubeleri
        </h2>
        <div className={styles.headActions}>
          {lockedId && (
            <button type="button" className={styles.link} onClick={onUnlock}>
              Kilidi kaldır
            </button>
          )}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Şube listesini kapat">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {rows.map(({ section, clashes, score, when, rooms }) => {
          const chosen = section.id === currentId;
          return (
            <li key={section.id} className={styles.row} data-chosen={chosen} data-clash={clashes.length > 0}>
              <div className={styles.main}>
                <span className={`${styles.tag} num`}>{section.id}</span>
                <span className={`${styles.when} num`}>{when}</span>
                {score !== null && <Stars score={score} size="s" />}
              </div>
              <p className={styles.meta}>
                {section.instructors.map(personName).join(", ") || "Hoca belirtilmemiş"}
                {rooms.length > 0 && ` · ${rooms.join(", ")}`}
                {section.capacity !== null && ` · kota ${section.capacity}`}
                {clashes.length > 0 && (
                  <span className={styles.clash}> · {clashes.join(", ")} ile çakışıyor</span>
                )}
              </p>
              <button
                type="button"
                className={`btn btn-small ${styles.action}`}
                disabled={chosen && lockedId === section.id}
                onClick={() => onPick(section.id)}
              >
                {lockedId === section.id ? "Kilitli" : chosen ? "Kilitle" : "Bunu al"}
              </button>
            </li>
          );
        })}
      </ul>

      <p className={styles.hint}>
        Bir şube seçersen program o şubeye göre yeniden kurulur. Çakışan bir şubeyi seçersen çakışan dersi
        değiştirmen ya da çıkarman gerekir.
      </p>
    </section>
  );
}
