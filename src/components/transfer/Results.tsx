"use client";

import { useMemo, useState } from "react";
import { evaluateAll, targetYearLevel } from "@/lib/transfer/eligibility";
import type { StudentProfile, TransferData } from "@/lib/transfer/types";
import { PATH_LABELS, ResultRow, STATUS_TEXT, type Evaluation, type PathKey } from "./ResultRow";

interface Props {
  data: TransferData;
  profile: StudentProfile;
  ready: boolean;
}

type Filter = "all" | PathKey;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Hepsi" },
  { id: "cap", label: "Çift anadal" },
  { id: "internal", label: "Yatay geçiş" },
  { id: "central", label: "Merkezi puanla" },
];

const ALL_PATHS: PathKey[] = ["internal", "central", "cap"];

export function Results({ data, profile, ready }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyOk, setOnlyOk] = useState(false);

  const results: Evaluation[] = useMemo(() => evaluateAll(profile, data), [profile, data]);
  const paths = filter === "all" ? ALL_PATHS : [filter];
  const visible = onlyOk ? results.filter((r) => paths.some((p) => r[p].status === "ok")) : results;
  const level = targetYearLevel(profile);

  return (
    <>
      <header className="gc-head">
        <h1 className="board-title">Yatay geçiş ve çift anadal</h1>
        <p className="gc-lede">
          Bilgilerini girdikçe hangi bölüme yatay geçiş ya da çift anadal başvurusu yapabileceğin burada görünür.
        </p>
        <p className="hint">
          Şartlar ve kontenjanlar {data.applicationTerm} başvuru dönemine ait. Başvuru tarihleri için kaynak sayfalara bak.
        </p>
        <div className="notice gc-notice">
          <p>
            Kabul edilme ihtimalini göstermez; sıralama formülü ve geçen yılın kabul ortalamaları yayınlanmıyor. Şartları
            ve kontenjanı gösterir.
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
          <input type="checkbox" checked={onlyOk} onChange={(e) => setOnlyOk(e.target.checked)} />
          Yalnızca uygun olanlar
        </label>
      </div>

      <div className="gc-legend-row">
        <ul className="gc-key" aria-label="İşaretler">
          <li>
            <span aria-hidden="true">✓</span> {STATUS_TEXT.ok}
          </li>
          <li>
            <span aria-hidden="true">✕</span> {STATUS_TEXT.fail}
          </li>
          <li>
            <span aria-hidden="true">?</span> {STATUS_TEXT.unknown}
          </li>
        </ul>
        <p className="hint gc-small" aria-live="polite">
          {ready ? `${visible.length} bölüm. ` : ""}
          {level ? `Sayılar ${level}. sınıf kontenjanı.` : "Kontenjanı görmek için tamamladığın dönemi gir."}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="hint">
          Bu seçimde uygun görünen bölüm yok. Eksik bilgileri doldurursan ya da başka bir yol seçersen sonuç değişebilir.
        </p>
      ) : (
        <ul className="gc-list" aria-label={filter === "all" ? "Bölümler" : `Bölümler, ${PATH_LABELS[filter]}`}>
          {visible.map((r) => (
            <ResultRow key={`${r.program.programId ?? ""}:${r.program.name}`} result={r} paths={paths} />
          ))}
        </ul>
      )}

      {data.sources.length > 0 && (
        <section className="gc-sources" aria-labelledby="gc-sources">
          <h2 className="group-title" id="gc-sources">
            Kaynaklar
          </h2>
          <ul>
            {data.sources.map((s) => (
              <li key={s.url}>
                <a className="link" href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="hint gc-small">Veri {formatDate(data.fetchedAt)} tarihinde alındı.</p>
        </section>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
}
