"use client";

import { useState } from "react";
import {
  canRetake,
  computeGpa,
  formatGpa,
  GRADE_POINTS,
  GRADES,
  nextThreshold,
  retakeGpa,
  round2,
  targetAverage,
  THRESHOLDS,
  type Grade,
  type GradeEntry,
} from "@/lib/roadmap/gpa";

interface Props {
  entries: GradeEntry[];
  /** Kalan derslerin toplam AKTS'si (tahmin). */
  remainingCredits: number;
  /** Madde 20'ye göre dönem başına en fazla AKTS. */
  loadLimit: number;
  cap: boolean;
}

const SCALE_MIN = 1.5;
const SCALE_MAX = 4;
const pos = (v: number) => `${((Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`;

export function GpaPanel({ entries, remainingCredits, loadLimit, cap }: Props) {
  const { gpa, credits } = computeGpa(entries);
  const next = gpa === null ? null : nextThreshold(gpa);
  const [target, setTarget] = useState<string>("");
  const [retakeKey, setRetakeKey] = useState("");
  const [retakeGrade, setRetakeGrade] = useState<Grade>("A");

  if (gpa === null) {
    return (
      <section aria-labelledby="rm-gpa" className="rm-gpa">
        <h2 className="group-title rm-h2" id="rm-gpa">
          Not ortalaman
        </h2>
        <p className="hint">
          Soldaki derslerin yanından harf notunu seçersen genel not ortalaman burada hesaplanır. Notlar yalnızca bu
          tarayıcıda kalır.
        </p>
      </section>
    );
  }

  const targetValue = target === "" ? (next?.value ?? 3.5) : Number(target.replace(",", "."));
  const validTarget = Number.isFinite(targetValue) && targetValue > 0 && targetValue <= 4;
  const result = validTarget ? targetAverage(entries, remainingCredits, targetValue) : null;
  const retakable = entries.filter((e) => canRetake(e.grade));
  const retakeEntry = retakable.find((e) => e.key === retakeKey) ?? retakable[0];
  const retakeResult = retakeEntry ? retakeGpa(entries, retakeEntry.key, retakeGrade) : null;

  return (
    <section aria-labelledby="rm-gpa" className="rm-gpa">
      <h2 className="group-title rm-h2" id="rm-gpa">
        Not ortalaman
      </h2>

      <div className="rm-gpa-head">
        <p className="rm-gpa-value num">{formatGpa(gpa)}</p>
        <p className="hint">
          {entries.length} ders, {credits} AKTS üzerinden. {next ? `${next.label} için ${formatGpa(round2(next.value - gpa))} puan daha.` : "Bütün eşiklerin üstündesin."}
          {gpa < 2 && " 2,00'nin altı sınamalı sayılır."}
        </p>
      </div>

      <div className="rm-scale" aria-hidden="true">
        <div className="rm-scale-track">
          <span className="rm-scale-fill" style={{ width: pos(gpa) }} />
          {THRESHOLDS.map((t) => (
            <span key={t.value} className={`rm-scale-tick${gpa >= t.value ? " is-met" : ""}`} style={{ left: pos(t.value) }} />
          ))}
        </div>
      </div>
      <ul className="rm-thresholds">
        {THRESHOLDS.map((t) => (
          <li key={t.value} className={gpa >= t.value ? "is-met" : ""}>
            <span className="num">{formatGpa(t.value)}</span> {t.label}
            <span className="sr-only">{gpa >= t.value ? ", sağlanıyor" : ", henüz değil"}</span>
          </li>
        ))}
      </ul>

      <p className="hint">
        {cap
          ? "Çift anadal yaptığın için dönemde en fazla 42 AKTS alabilirsin."
          : `Bu ortalamayla dönemde en fazla ${loadLimit} AKTS alabilirsin.`}
      </p>

      <div className="rm-tools">
        <div className="rm-tool">
          <label className="field">
            <span className="field-label">Hedef ortalama</span>
            <input
              className="select rm-target num"
              inputMode="decimal"
              placeholder={formatGpa(next?.value ?? 3.5)}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <p className="rm-tool-result" aria-live="polite">
            {!result
              ? "0 ile 4 arasında bir ortalama yaz."
              : result.kind === "guaranteed"
                ? "Kalan derslerde ne alırsan al ortalaman bu hedefin altına düşmez."
                : result.kind === "impossible"
                  ? `Kalan ${remainingCredits} AKTS'nin hepsinden A alsan bile en fazla ${formatGpa(result.best)} olur.`
                  : result.kind === "noRemaining"
                    ? "Notu girilmemiş kalan ders yok."
                    : `Kalan yaklaşık ${remainingCredits} AKTS'de ortalama en az ${formatGpa(result.average)} alman gerekiyor (${gradeBand(result.average)}).`}
          </p>
        </div>

        {retakeEntry && retakeResult !== null && (
          <div className="rm-tool">
            <div className="rm-fields rm-fields-pair">
              <label className="field">
                <span className="field-label">Tekrar alırsam</span>
                <select className="select" value={retakeEntry.key} onChange={(e) => setRetakeKey(e.target.value)}>
                  {retakable.map((e) => (
                    <option key={e.key} value={e.key}>
                      {e.label} ({e.grade})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Yeni not</span>
                <select className="select" value={retakeGrade} onChange={(e) => setRetakeGrade(e.target.value as Grade)}>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="rm-tool-result" aria-live="polite">
              Ortalaman {formatGpa(gpa)} → <b className="num">{formatGpa(retakeResult)}</b>. Son alınan not geçerli olur;
              B ve üstü alınan dersler tekrar alınamaz.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Gereken ortalamanın harf karşılığı: 3,00 -> "B", 3,40 -> "B+ ile A- arası". */
function gradeBand(avg: number): string {
  const exact = GRADES.find((g) => Math.abs(GRADE_POINTS[g] - avg) < 1e-9);
  if (exact) return `her dersten ${exact}`;
  const above = [...GRADES].reverse().find((g) => GRADE_POINTS[g] > avg) ?? "A";
  const below = GRADES.find((g) => GRADE_POINTS[g] < avg) ?? "F";
  return `${below} ile ${above} arası`;
}
