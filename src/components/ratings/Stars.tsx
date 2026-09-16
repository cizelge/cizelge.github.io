"use client";
// Yıldızlı puan: gösterim (Stars) ve seçim (StarInput).

import { oneDecimal } from "@/lib/ratings/types";
import styles from "./stars.module.css";

function Star({ fill }: { fill: number }) {
  // fill: 0-1 arası dolu oran; yarım yıldızlar için soldan kırpılır.
  return (
    <span className={styles.star}>
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={styles.empty}>
        <path d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.5l5.8-.8z" fill="currentColor" />
      </svg>
      <span className={styles.fillWrap} style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={styles.full}>
          <path d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.5l5.8-.8z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

/** Puanı beş yıldızla gösterir; puan yoksa soluk yıldızlar. */
export function Stars({ score, size = "m", showValue = true, count }: { score: number | null; size?: "s" | "m" | "l"; showValue?: boolean; count?: number }) {
  const value = score ?? 0;
  return (
    <span className={styles.row} data-size={size} data-empty={score === null}>
      <span className={styles.stars} role="img" aria-label={score === null ? "puan yok" : `5 üzerinden ${oneDecimal(score)}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} fill={Math.min(1, Math.max(0, value - i))} />
        ))}
      </span>
      {showValue && <span className={`${styles.value} num`}>{score === null ? "—" : oneDecimal(score)}</span>}
      {count !== undefined && <span className={styles.count}>({count})</span>}
    </span>
  );
}

/** Tıklanabilir yıldızlar. Aynı yıldıza ikinci kez basınca seçim kalkar. */
export function StarInput({ value, onChange, label, scale }: { value: number; onChange: (v: number) => void; label: string; scale?: readonly string[] }) {
  return (
    <div className={styles.input} role="radiogroup" aria-label={label}>
      <span className={styles.buttons}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={scale ? `${n}: ${scale[n - 1]}` : `${n} yıldız`}
            className={styles.pick}
            data-on={n <= value}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
              <path d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.5l5.8-.8z" fill="currentColor" />
            </svg>
          </button>
        ))}
      </span>
      <span className={styles.hint}>{value === 0 ? "seçilmedi" : scale ? scale[value - 1] : `${value}/5`}</span>
    </div>
  );
}
