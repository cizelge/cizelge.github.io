"use client";
// Devamsızlık takibi: kaçırdığın ders saatini sayar, ne kadar hakkın kaldığını söyler.
// Hiçbir şey sunucuya gitmez, sayılar yalnızca bu tarayıcıda durur.

import { useEffect, useId, useRef, useState } from "react";
import type { Course } from "@/lib/types";
import type { SectionRef } from "@/lib/engine";
import { attendance, attendanceText, DEFAULT_LIMIT, LIMITS, TERM_WEEKS, weeklyHours } from "@/lib/planner/attendance";
import styles from "./AttendancePanel.module.css";

interface Props {
  /** Seçili programdaki şubeler; ders saatleri buradan gelir. */
  sections: readonly SectionRef[];
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  schoolId: string;
  termId: string;
}

interface Entry {
  /** Kaçırılan ders saati. */
  missed: number;
  /** Bu ders için devamsızlık sınırı (yüzde). */
  limit: number;
}

type Saved = Record<string, Entry>;

const storageKey = (schoolId: string, termId: string) => `devamsizlik:${schoolId}:${termId}`;

function read(key: string): Saved {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Saved = {};
    for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as { missed?: unknown; limit?: unknown };
      const missed = typeof v.missed === "number" && v.missed >= 0 ? Math.floor(v.missed) : 0;
      const limit = typeof v.limit === "number" && LIMITS.includes(v.limit as (typeof LIMITS)[number]) ? v.limit : DEFAULT_LIMIT;
      out[code] = { missed, limit };
    }
    return out;
  } catch {
    return {};
  }
}

function write(key: string, value: Saved) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depo kapalı */
  }
}

export function AttendancePanel({ sections, courses, colorOf, schoolId, termId }: Props) {
  const key = storageKey(schoolId, termId);
  const [saved, setSaved] = useState<Saved>({});
  const loaded = useRef(false);
  const titleId = useId();

  useEffect(() => {
    loaded.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(read(key));
    loaded.current = true;
  }, [key]);

  function update(code: string, next: Partial<Entry>) {
    setSaved((old) => {
      const current = old[code] ?? { missed: 0, limit: DEFAULT_LIMIT };
      const value = { ...old, [code]: { ...current, ...next } };
      if (loaded.current) write(key, value);
      return value;
    });
  }

  const rows = sections
    .map((ref) => {
      const course = courses.get(ref.courseCode);
      const section = course?.sections.find((s) => s.id === ref.sectionId);
      if (!course || !section) return null;
      const entry = saved[course.code] ?? { missed: 0, limit: DEFAULT_LIMIT };
      return { course, section, entry, info: attendance(weeklyHours(section.meetings), entry.missed, entry.limit) };
    })
    .filter((r) => r !== null);

  if (rows.length === 0) return null;

  const over = rows.filter((r) => r.info.state === "over").length;
  const warn = rows.filter((r) => r.info.state === "warn").length;
  const headline =
    over > 0
      ? `${over} derste sınırı aştın.`
      : warn > 0
        ? `${warn} derste hakkın bitmek üzere.`
        : "Kalan devamsızlık hakkın.";

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span className={styles.title}>Devamsızlık takibi</span>
        <span className={styles.hint} data-alert={over > 0}>
          {headline}
        </span>
      </summary>

      <div className={styles.body}>
        <p className={styles.lead} id={titleId}>
          Devam kuralını her dersin hocası kendi belirler; buradaki sınır varsayılan olarak %30 (yani %70 devam).
          Kendi dersinin izlencesine bakıp değiştirebilirsin. Dönem {TERM_WEEKS} hafta sayılır.
        </p>

        <ul className={styles.list} aria-labelledby={titleId}>
          {rows.map(({ course, section, entry, info }) => (
            <li key={course.code} className={`${styles.row} hl-${colorOf(course.code)}`} data-state={info.state}>
              <div className={styles.head}>
                <span className={styles.code}>
                  <span className="num">{course.code}</span> <span className={styles.section}>{section.id}</span>
                </span>
                <span className={styles.perWeek}>
                  haftada <span className="num">{info.perWeek}</span> saat
                </span>
              </div>

              <p className={styles.text}>{attendanceText(info)}</p>

              <div className={styles.controls}>
                <div className={styles.counter}>
                  <button
                    type="button"
                    className={styles.step}
                    onClick={() => update(course.code, { missed: Math.max(0, entry.missed - 1) })}
                    disabled={entry.missed === 0}
                    aria-label={`${course.code}: kaçırılan ders saatini azalt`}
                  >
                    −
                  </button>
                  <span className={`${styles.count} num`} aria-live="polite">
                    {entry.missed}
                    <span className={styles.countLabel}> / {info.allowed}</span>
                  </span>
                  <button
                    type="button"
                    className={styles.step}
                    onClick={() => update(course.code, { missed: entry.missed + 1 })}
                    aria-label={`${course.code}: kaçırılan ders saatini artır`}
                  >
                    +
                  </button>
                </div>

                <label className={styles.limit}>
                  <span className="sr-only">{course.code} devamsızlık sınırı</span>
                  <select
                    className="select"
                    value={entry.limit}
                    onChange={(e) => update(course.code, { limit: Number(e.target.value) })}
                  >
                    {LIMITS.map((l) => (
                      <option key={l} value={l}>
                        sınır %{l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
