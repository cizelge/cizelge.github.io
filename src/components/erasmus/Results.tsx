"use client";

import { useId } from "react";
import { eleNeededFor, erasmusEligibility, erasmusScore } from "@/lib/erasmus/score";
import type { ErasmusData } from "@/lib/erasmus/types";
import { formatNumber, formatScore, formatSigned } from "./NumberField";

type Status = "ok" | "fail" | "unknown";
const ICONS: Record<Status, string> = { ok: "✓", fail: "✕", unknown: "?" };
const STATUS_TEXT: Record<Status, string> = { ok: "sağlanıyor", fail: "sağlanmıyor", unknown: "bilinmiyor" };

interface Input {
  gpa: number | null;
  ects: number | null;
  ele: number | null;
  criteria: Record<string, number>;
  target: number | null;
}

/** "Fakülte/yüksekokul bazında" -> "fakülte/yüksekokul bazında" */
const lowerFirst = (s: string) => (s ? s.charAt(0).toLocaleLowerCase("tr") + s.slice(1) : s);

export function Eligibility({ data, input, ready }: { data: ErasmusData; input: Input; ready: boolean }) {
  const id = useId();
  const items = erasmusEligibility(data, { gpa: input.gpa, ele: input.ele, ects: input.ects });
  return (
    <section aria-labelledby={id} className="er-section">
      <h2 className="group-title er-h2" id={id}>
        Başvuru şartları
      </h2>
      <ul className="gc-checks er-checks" aria-busy={!ready || undefined}>
        {items.map((item) => (
          <li key={item.id} data-status={item.status}>
            <span className="gc-check-icon" aria-hidden="true">
              {ICONS[item.status]}
            </span>
            <span>
              <span className="sr-only">{STATUS_TEXT[item.status]}: </span>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      {data.score.ranking && (
        <p className="hint gc-small">Başvurular {lowerFirst(data.score.ranking)} sıralanır; diğer fakültelerle yarışmazsın.</p>
      )}
    </section>
  );
}

export function ScoreEstimate({ data, input }: { data: ErasmusData; input: Input }) {
  const id = useId();
  const score = input.gpa !== null && input.ele !== null ? erasmusScore(data, { gpa: input.gpa, ele: input.ele, criteria: input.criteria }) : null;
  const needed =
    input.gpa !== null && input.target !== null
      ? eleNeededFor(data, { gpa: input.gpa, target: input.target, criteria: input.criteria })
      : null;
  const minEle = data.eligibility.minEle;

  return (
    <section aria-labelledby={id} className="er-section">
      <h2 className="group-title er-h2" id={id}>
        Tahmini Erasmus puanın
      </h2>

      {score ? (
        <div className="er-score" aria-live="polite">
          <p className="er-score-value num">{formatScore(score.total)}</p>
          <p className="er-score-parts num">
            Ortalama {formatScore(score.gpaPart)} + dil {formatScore(score.elePart)}
            {score.bonus !== 0 && <> + ek kriter {formatSigned(score.bonus)}</>}
          </p>
        </div>
      ) : (
        <p className="hint">Puanını görmek için GNO ve ELE puanını gir.</p>
      )}

      {needed && input.target !== null && (
        <p className="er-line" aria-live="polite">
          {needed.kind === "needed"
            ? `${formatNumber(input.target)} puana ulaşmak için ELE'den en az ${formatNumber(needed.ele)} alman gerekiyor.${
                needed.ele < minEle ? ` Başvuru için yine de en az ${formatNumber(minEle)} gerekiyor.` : ""
              }`
            : needed.kind === "impossible"
              ? `ELE'den 100 alsan bile ${formatNumber(input.target)} puana ulaşılmıyor.`
              : `Ortalaman ve ek kriterlerle ${formatNumber(input.target)} puan zaten aşılıyor; ELE'de başvuru şartı olan ${formatNumber(minEle)} yeterli.`}
        </p>
      )}

      <p className="hint gc-small">
        Hesap: ortalama (%{formatNumber(data.score.gpaWeight * 100)}) + ELE (%{formatNumber(data.score.eleWeight * 100)}) + ek kriterler.{" "}
        {data.score.gpaTo100.assumption}
      </p>
      <div className="notice er-notice">
        <p>
          Kabul edilme ihtimalini göstermez. Yerleşme, fakültendeki diğer başvuranların puanlarına ve okulların kontenjanına bağlı.
        </p>
      </div>
    </section>
  );
}
