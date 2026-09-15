"use client";

import { useMemo, useState } from "react";
import { DAY_NAMES, DAY_SHORT } from "@/lib/days";
import { fittingElectives, meetsOn, type FittingCourse } from "@/lib/planner/electives";
import type { Course, Meeting, Program } from "@/lib/types";
import type { CourseSummary } from "@/lib/ratings/types";
import { CourseRating } from "@/components/ratings/CourseRating";
import { useRatings } from "@/lib/ratings/useRatings";
import styles from "./ElectiveFinder.module.css";

type Day = Meeting["day"];

interface Props {
  programs: readonly Program[];
  programId: string | null;
  courses: readonly Course[];
  /** Seçili programın oturumları. */
  meetings: readonly Pick<Meeting, "day" | "start" | "end">[];
  cart: readonly string[];
  freeDays: readonly Day[];
  days: readonly Day[];
  onAdd: (code: string) => void;
}

const SHOWN = 8;

/** Bölümün seçmeli havuzlarından seçili programın boş saatlerine sığan dersler. */
export function ElectiveFinder({ programs, programId, courses, meetings, cart, freeDays, days, onAdd }: Props) {
  const program = programs.find((p) => p.id === programId) ?? null;
  const { summaries } = useRatings("ozyegin");
  const [day, setDay] = useState<Day | null>(null);
  const result = useMemo(
    () => (program ? fittingElectives(program, courses, meetings, cart, freeDays) : null),
    [program, courses, meetings, cart, freeDays],
  );
  const pickable = days.filter((d) => !freeDays.includes(d));

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span className={styles.title}>Programına sığan seçmeliler</span>
        <span className={styles.hint}>Boş saatlerine uyan ve bölümünde seçmeli sayılan dersler.</span>
      </summary>

      <div className={styles.body}>
        {!program || !result ? (
          <p className={styles.hint}>Önce Dersler kısmındaki &ldquo;Müfredatın&rdquo; bölümünden bölümünü seç.</p>
        ) : result.groups.length === 0 ? (
          <p className={styles.hint}>
            {program.name} müfredatında ders listesi olan bir seçmeli yok.
            {result.openLabels.length > 0 && " Seçmelilerin için dersleri aramadan ekleyebilirsin."}
          </p>
        ) : (
          <>
            <div className={styles.days} role="group" aria-label="Güne göre süz">
              <button type="button" className={styles.day} aria-pressed={day === null} onClick={() => setDay(null)}>
                Her gün
              </button>
              {pickable.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={styles.day}
                  aria-pressed={day === d}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => setDay(day === d ? null : d)}
                >
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>

            {result.groups.map((g) => (
              <Group
                key={g.label}
                label={g.label}
                offered={g.offered}
                fits={
                  day === null
                    ? g.fits
                    : g.fits
                        .filter((f) => meetsOn(f, day))
                        .map((f) => ({ ...f, sections: f.sections.filter((s) => s.meetings.some((m) => m.day === day)) }))
                }
                dayName={day === null ? null : DAY_NAMES[day]}
                onAdd={onAdd}
                ratings={summaries?.courses}
              />
            ))}

            {result.openLabels.length > 0 && (
              <p className={styles.hint}>
                {result.openLabels.join(", ")}: listesi yok, bölümün kurallarına uyan her ders sayılabilir. Ders aramadan
                ekleyebilirsin.
              </p>
            )}
            <p className={styles.fine}>
              Ön şartları senin geçtiğin derslere göre kontrol edilmiyor. Kontenjan ve bölüm kısıtları için SIS&apos;e bak.
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function Group({
  label,
  offered,
  fits,
  dayName,
  onAdd,
  ratings,
}: {
  label: string;
  offered: number;
  fits: FittingCourse[];
  dayName: string | null;
  onAdd: (code: string) => void;
  ratings?: Record<string, CourseSummary>;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? fits : fits.slice(0, SHOWN);
  const count =
    offered === 0
      ? "bu dönem açılan dersi yok"
      : fits.length === 0
        ? dayName
          ? `${dayName} sığan ders yok`
          : `açılan ${offered} dersten hiçbiri sığmıyor`
        : `${dayName ? `${dayName} ` : ""}${fits.length} ders sığıyor, açılan ${offered}`;

  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>
        {label} <span className={`${styles.count} num`}>{count}</span>
      </h3>
      {shown.length > 0 && (
        <ul className={styles.list}>
          {shown.map((f) => (
            <li key={f.code} className={styles.row}>
              <div className={styles.main}>
                <span className={`${styles.code} num`}>{f.code}</span>
                <span className={styles.name}>{f.title}</span>
                {f.ects !== null && <span className={`${styles.ects} num`}>{f.ects} AKTS</span>}
              </div>
              <ul className={styles.sections}>
                {f.sections.map((s) => (
                  <li key={s.id} className={`${styles.section} num`}>
                    <span className={styles.sectionId}>{s.id}</span>{" "}
                    {s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}–${m.end}`).join(", ")}
                  </li>
                ))}
              </ul>
              {ratings?.[f.code] && (
                <span className={styles.rating}>
                  <CourseRating summary={ratings[f.code]} compact />
                </span>
              )}
              {(f.corequisites.length > 0 || f.prerequisites) && (
                <p className={styles.meta}>
                  {f.corequisites.length > 0 && `${f.corequisites.join(", ")} ile birlikte alınır. `}
                  {f.prerequisites && `Ön şart: ${f.prerequisites}`}
                </p>
              )}
              <button type="button" className={`btn btn-small ${styles.add}`} onClick={() => onAdd(f.code)} aria-label={`${f.code} sepete ekle`}>
                Ekle
              </button>
            </li>
          ))}
        </ul>
      )}
      {fits.length > SHOWN && (
        <button type="button" className={`btn btn-small btn-quiet ${styles.more}`} onClick={() => setAll(!all)}>
          {all ? "Daha az göster" : `Hepsini göster (${fits.length})`}
        </button>
      )}
    </section>
  );
}
