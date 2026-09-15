"use client";

import { useMemo, useState } from "react";
import { evaluateAll, targetYearLevel } from "@/lib/transfer/eligibility";
import type { HistoryIndex } from "@/lib/transfer/history";
import type { StudentProfile, TransferData } from "@/lib/transfer/types";
import { verdictFor } from "@/lib/transfer/verdict";
import {
  PATH_LABELS,
  ResultRow,
  VERDICT_SHORT,
  type Evaluation,
  type PathKey,
} from "./ResultRow";

interface Props {
  data: TransferData;
  profile: StudentProfile;
  ready: boolean;
  history: HistoryIndex;
}

type Filter = "all" | PathKey;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Hepsi" },
  { id: "cap", label: "Çift anadal" },
  { id: "yandal", label: "Yandal" },
  { id: "internal", label: "Yatay geçiş" },
  { id: "central", label: "Merkezi puanla" },
];

const ALL_PATHS: PathKey[] = ["cap", "yandal", "internal", "central"];

export function Results({ data, profile, ready, history }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyOk, setOnlyOk] = useState(false);

  const results: Evaluation[] = useMemo(
    () => evaluateAll(profile, data),
    [profile, data],
  );
  const paths = filter === "all" ? ALL_PATHS : [filter];
  const good = new Set(["likely", "maybe", "eligible"]);
  const visible = onlyOk
    ? results.filter((r) =>
        paths.some((p) =>
          good.has(
            verdictFor(
              r[p],
              (r.program.programId && history[r.program.programId]?.[p]) ||
                null,
            ).level,
          ),
        ),
      )
    : results;
  const level = targetYearLevel(profile);

  return (
    <>
      <header className="gc-head">
        <h1 className="board-title">Yatay geçiş ve çift anadal</h1>
        <p className="gc-lede">
          Bilgilerini girdikçe her bölüm için çift anadal, yandal ve yatay
          geçişin olup olmayacağı burada görünür.
        </p>
        <p className="hint">
          Şartlar ve kontenjanlar {data.applicationTerm} başvuru dönemine ait.
          Başvuru tarihleri için kaynak sayfalara bak.
        </p>
        <div className="notice gc-notice">
          <p>
            Cevap bir tahmindir. Şartlar resmi sayfalardan kontrol edilir;
            &quot;olur / olabilir / zor&quot; ise 2019–2024 başvuru sonuç
            listelerindeki kabul oranından gelir. O listelerde not ortalaması
            yok, oran şartları sağlamayan başvuruları da içerir; şartları
            sağlıyorsan şansın genelde bu orandan yüksektir.
          </p>
        </div>
      </header>

      <div className="gc-filters">
        <div className="chips" role="group" aria-label="Başvuru yolu">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="gc-toggle">
          <input
            type="checkbox"
            checked={onlyOk}
            onChange={(e) => setOnlyOk(e.target.checked)}
          />
          Yalnızca olabilecekler
        </label>
      </div>

      <div className="gc-legend-row">
        <ul className="gc-key" aria-label="İşaretler">
          <li>
            <span aria-hidden="true">✓</span> {VERDICT_SHORT.likely},{" "}
            {VERDICT_SHORT.maybe}
          </li>
          <li>
            <span aria-hidden="true">!</span> {VERDICT_SHORT.hard}
          </li>
          <li>
            <span aria-hidden="true">✕</span> {VERDICT_SHORT.no}
          </li>
          <li>
            <span aria-hidden="true">?</span> {VERDICT_SHORT.unknown}
          </li>
        </ul>
        <p className="hint gc-small" aria-live="polite">
          {ready ? `${visible.length} bölüm. ` : ""}
          {level
            ? `Sayılar ${level}. sınıf kontenjanı.`
            : "Kontenjanı görmek için tamamladığın dönemi gir."}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="hint">
          Bu seçimde uygun görünen bölüm yok. Eksik bilgileri doldurursan ya da
          başka bir yol seçersen sonuç değişebilir.
        </p>
      ) : (
        <>
          <div
            className="gc-columns"
            data-count={paths.length}
            aria-hidden="true"
          >
            <span>Bölüm</span>
            {paths.map((p) => (
              <span key={p}>{PATH_LABELS[p]}</span>
            ))}
          </div>
          <ul
            className="gc-list"
            aria-label={
              filter === "all" ? "Bölümler" : `Bölümler, ${PATH_LABELS[filter]}`
            }
          >
            {visible.map((r) => (
              <ResultRow
                key={`${r.program.programId ?? ""}:${r.program.name}`}
                result={r}
                paths={paths}
                history={
                  (r.program.programId && history[r.program.programId]) || {}
                }
              />
            ))}
          </ul>
        </>
      )}

      {data.sources.length > 0 && (
        <section className="gc-sources" aria-labelledby="gc-sources">
          <h2 className="group-title" id="gc-sources">
            Kaynaklar
          </h2>
          <ul>
            {data.sources.map((s) => (
              <li key={s.url}>
                <a
                  className="link"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="hint gc-small">
            Veri {formatDate(data.fetchedAt)} tarihinde alındı.
          </p>
        </section>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Istanbul",
      });
}
