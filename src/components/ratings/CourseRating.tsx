"use client";
// Bir dersin oy özeti: zorluk çubuğu, iş yükü ve "tekrar alır" oranı. Yeterli oy yoksa hiç görünmez.

import Link from "next/link";
import { instructorSlug } from "@/lib/ratings/instructors";
import { DIFFICULTY_LABELS, WORKLOAD_LABELS, type CourseSummary } from "@/lib/ratings/types";
import { personName } from "@/lib/format";
import styles from "./ratings.module.css";

export function CourseRating({ summary, compact = false }: { summary: CourseSummary | undefined; compact?: boolean }) {
  if (!summary) return null;
  const difficulty = summary.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 });
  const label = DIFFICULTY_LABELS[Math.min(4, Math.max(0, Math.round(summary.difficulty) - 1))];

  if (compact) {
    return (
      <p className={styles.line}>
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dotsFill} style={{ width: `${(summary.difficulty / 5) * 100}%` }} />
        </span>
        <span className="num">{difficulty}/5</span> {label}, {WORKLOAD_LABELS[Math.round(summary.workload) - 1]}, %
        <span className="num">{summary.again}</span> tekrar alır
        <span className={styles.count}> ({summary.n} oy)</span>
      </p>
    );
  }

  return (
    <div className={styles.card}>
      <dl className={styles.grid}>
        <div className={styles.cell}>
          <dt>Zorluk</dt>
          <dd>
            <span className={`${styles.big} num`}>{difficulty}</span>
            <span className={styles.unit}>/5, {label}</span>
          </dd>
        </div>
        <div className={styles.cell}>
          <dt>İş yükü</dt>
          <dd className={styles.value}>{WORKLOAD_LABELS[Math.round(summary.workload) - 1]}</dd>
        </div>
        <div className={styles.cell}>
          <dt>Tekrar alır</dt>
          <dd>
            <span className={`${styles.big} num`}>%{summary.again}</span>
          </dd>
        </div>
      </dl>
      <p className={styles.count}>{summary.n} öğrenci oyladı. Oylar isimsizdir, yazılı yorum alınmaz.</p>
      {summary.instructors && summary.instructors.length > 0 && (
        <ul className={styles.instructors}>
          {summary.instructors.map((i) => (
            <li key={i.name}>
              <Link href={`/ozyegin/hoca/${instructorSlug(i.name)}`} className={styles.who}>
                {personName(i.name)}
              </Link>{" "}
              <span className="num">{i.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}/5</span> zorluk, %
              <span className="num">{i.again}</span> tekrar alır
              {i.clarity !== null && (
                <>
                  , anlatım <span className="num">{i.clarity.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}/5</span>
                </>
              )}
              {i.fairness !== null && (
                <>
                  , notlandırma <span className="num">{i.fairness.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}/5</span>
                </>
              )}
              <span className={styles.count}> ({i.n} oy)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
