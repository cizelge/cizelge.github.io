"use client";
// Bir dersin oy özeti: zorluk, iş yükü, "tekrar alır" oranı ve hoca kırılımı. Yeterli oy yoksa hiç görünmez.

import Link from "next/link";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";
import {
  CRITERION_INFO,
  DIFFICULTY_LABELS,
  INSTRUCTOR_CRITERIA,
  oneDecimal,
  instructorScore,
  WORKLOAD_LABELS,
  type CourseSummary,
} from "@/lib/ratings/types";
import { ScoreBadge } from "./ScoreBits";
import styles from "./ratings.module.css";

export function CourseRating({ summary, compact = false }: { summary: CourseSummary | undefined; compact?: boolean }) {
  if (!summary) return null;
  const label = DIFFICULTY_LABELS[Math.min(4, Math.max(0, Math.round(summary.difficulty) - 1))];

  if (compact) {
    return (
      <p className={styles.line}>
        <span className={styles.dots} aria-hidden="true">
          <span className={styles.dotsFill} style={{ width: `${(summary.difficulty / 5) * 100}%` }} />
        </span>
        <span className="num">{oneDecimal(summary.difficulty)}/5</span> {label}, {WORKLOAD_LABELS[Math.round(summary.workload) - 1]}, %
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
            <span className={`${styles.big} num`}>{oneDecimal(summary.difficulty)}</span>
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
            <li key={i.name} className={styles.instructor}>
              <Link href={`/ozyegin/hoca/${instructorSlug(i.name)}`} className={styles.who}>
                {personName(i.name)}
              </Link>
              <ScoreBadge score={instructorScore(i.criteria)} size="s" />
              <span className={styles.instructorMeta}>
                {INSTRUCTOR_CRITERIA.filter((name) => typeof i.criteria[name] === "number")
                  .map((name) => `${CRITERION_INFO[name].label.toLocaleLowerCase("tr")} ${oneDecimal(i.criteria[name]!)}`)
                  .join(", ") || `zorluk ${oneDecimal(i.difficulty)}/5`}
                <span className={styles.count}> ({i.n} oy)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
