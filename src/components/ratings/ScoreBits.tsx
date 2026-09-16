"use client";
// Puan rozeti ve kriter çubukları: hoca kartlarında, hoca sayfasında ve ders kırılımında ortak kullanılır.

import { CRITERION_INFO, INSTRUCTOR_CRITERIA, oneDecimal, type Criteria } from "@/lib/ratings/types";
import styles from "./score.module.css";

/** Yıldızlı genel puan; puan yoksa soluk bir tire. */
export function ScoreBadge({ score, size = "m" }: { score: number | null; size?: "s" | "m" | "l" }) {
  return (
    <span className={styles.badge} data-size={size} data-empty={score === null}>
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={styles.star}>
        <path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" fill="currentColor" />
      </svg>
      <span className="num">{score === null ? "—" : oneDecimal(score)}</span>
    </span>
  );
}

/** 1-5 kriterleri çubuk olarak. Yeterli cevap almayan kriter listede görünmez. */
export function CriteriaBars({ criteria }: { criteria: Criteria }) {
  const shown = INSTRUCTOR_CRITERIA.filter((name) => typeof criteria[name] === "number");
  if (shown.length === 0) return <p className={styles.empty}>Kriterler için yeterli cevap yok.</p>;
  return (
    <ul className={styles.bars}>
      {shown.map((name) => {
        const value = criteria[name]!;
        return (
          <li key={name} className={styles.bar}>
            <span className={styles.barLabel}>{CRITERION_INFO[name].label}</span>
            <span className={`${styles.barValue} num`}>{oneDecimal(value)}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${(value / 5) * 100}%` }} />
            </span>
            <span className={styles.barNote}>{CRITERION_INFO[name].scale[Math.round(value) - 1]}</span>
          </li>
        );
      })}
    </ul>
  );
}
