"use client";
// "Bırak, yerine koy": sepetten bir ders çıkarılınca boşalan saatlere sığan dersleri önerir.
// Bölümün seçmeli havuzlarından gelir; hoca puanı olanlar üstte.

import { useMemo } from "react";
import { DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";
import { fittingElectives, type FittingCourse } from "@/lib/planner/electives";
import { scoreLookup, sectionScore } from "@/lib/planner/instructor-score";
import { useRatings } from "@/lib/ratings/useRatings";
import { Stars } from "@/components/ratings/Stars";
import type { Course, Meeting, Program } from "@/lib/types";
import styles from "./SwapSuggest.module.css";

type Day = Meeting["day"];

interface Props {
  school: string;
  /** Sepetten yeni çıkarılan ders. */
  removed: string;
  programs: readonly Program[];
  programId: string | null;
  courses: readonly Course[];
  meetings: readonly Pick<Meeting, "day" | "start" | "end">[];
  cart: readonly string[];
  freeDays: readonly Day[];
  onAdd: (code: string) => void;
  onUndo: () => void;
  onClose: () => void;
}

const SHOWN = 6;

export function SwapSuggest({ school, removed, programs, programId, courses, meetings, cart, freeDays, onAdd, onUndo, onClose }: Props) {
  const { summaries } = useRatings(school);
  const program = programs.find((p) => p.id === programId) ?? null;
  const scoreOf = useMemo(() => scoreLookup(summaries?.instructors), [summaries]);

  const suggestions = useMemo(() => {
    if (!program) return [];
    const { groups } = fittingElectives(program, courses, meetings, cart, freeDays);
    const seen = new Set<string>();
    const all: { fit: FittingCourse; label: string; score: number | null }[] = [];
    for (const group of groups) {
      for (const fit of group.fits) {
        if (seen.has(fit.code)) continue;
        seen.add(fit.code);
        const byCode = new Map(courses.map((c) => [c.code, c]));
        const scores = fit.sections.map((s) => sectionScore(byCode.get(fit.code), s.id, scoreOf)).filter((v): v is number => v !== null);
        all.push({ fit, label: group.label, score: scores.length ? Math.max(...scores) : null });
      }
    }
    // Hoca puanı olanlar önce, sonra kod sırası.
    return all.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.fit.code.localeCompare(b.fit.code, "en", { numeric: true }));
  }, [program, courses, meetings, cart, freeDays, scoreOf]);

  return (
    <section className={styles.root} aria-labelledby="swap-baslik">
      <div className={styles.head}>
        <h2 id="swap-baslik" className={styles.title}>
          <span className="num">{removed}</span> çıkarıldı
        </h2>
        <div className={styles.headActions}>
          <button type="button" className={styles.link} onClick={onUndo}>
            Geri al
          </button>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Önerileri kapat">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {!program ? (
        <p className={styles.hint}>
          Bölümünü seçersen boşalan saatlere sığan seçmelileri burada sıralarım. Dersler kısmındaki
          &ldquo;Müfredatın&rdquo; bölümünden seçebilirsin.
        </p>
      ) : suggestions.length === 0 ? (
        <p className={styles.hint}>Boşalan saatlere sığan, bölümünde seçmeli sayılan bir ders bulamadım.</p>
      ) : (
        <>
          <p className={styles.hint}>Boşalan saatlere sığan dersler, hoca puanı yüksek olanlar üstte:</p>
          <ul className={styles.list}>
            {suggestions.slice(0, SHOWN).map(({ fit, label, score }) => (
              <li key={fit.code} className={styles.row}>
                <div className={styles.main}>
                  <span className={`${styles.code} num`}>{fit.code}</span>
                  <span className={styles.name}>{fit.title}</span>
                  {score !== null && <Stars score={score} size="s" />}
                </div>
                <p className={styles.meta}>
                  {label}
                  {" · "}
                  {fit.sections
                    .slice(0, 2)
                    .map((s) => `${s.id}: ${s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}`).join(", ")}`)
                    .join(" · ")}
                  {fit.sections[0]?.instructors[0] ? ` · ${personName(fit.sections[0].instructors[0])}` : ""}
                </p>
                <button type="button" className={`btn btn-small ${styles.add}`} onClick={() => onAdd(fit.code)}>
                  Ekle
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
