"use client";

import { useId, useMemo } from "react";
import type { Program } from "@/lib/types";
import { groupByFaculty, programYears } from "@/lib/planner/curriculum";
import type { StartSeason } from "@/lib/roadmap/storage";
import type { Minor } from "@/lib/roadmap/types";

const MINOR_INFO_URL = "https://www.ozyegin.edu.tr/tr/ogrenci-hizmetleri/basvuru-kabul/yandal-ogrenimi";
const collator = new Intl.Collator("tr");

interface Props {
  programs: readonly Program[];
  minors: readonly Minor[] | null;
  anadal: Program | null;
  cap: Program | null;
  minor: Minor | null;
  start: { year: number; season: StartSeason };
  note: string;
  onAnadal: (id: string | null) => void;
  onCap: (id: string | null) => void;
  onYandal: (id: string | null) => void;
  onStart: (start: { year: number; season: StartSeason }) => void;
  onMarkPrevious: () => void;
}

export function StartPanel({
  programs,
  minors,
  anadal,
  cap,
  minor,
  start,
  note,
  onAnadal,
  onCap,
  onYandal,
  onStart,
  onMarkPrevious,
}: Props) {
  const id = useId();
  const groups = useMemo(() => groupByFaculty(programs), [programs]);
  const capGroups = useMemo(
    () => groupByFaculty(programs.filter((p) => p.id !== anadal?.id)),
    [programs, anadal],
  );
  const sortedMinors = useMemo(
    () => (minors ? [...minors].sort((a, b) => collator.compare(a.name, b.name)) : []),
    [minors],
  );
  const years = anadal ? programYears(anadal) : [1, 2, 3, 4];
  const yearOptions = years.includes(start.year) ? years : [...years, start.year].sort((a, b) => a - b);
  const isFirst = start.year <= 1 && start.season === "guz" && !years.includes(0);

  return (
    <section aria-labelledby={`${id}-t`} className="rm-start">
      <h2 className="group-title" id={`${id}-t`}>
        Başlangıç
      </h2>

      <div className="rm-fields">
        <label className="field">
          <span className="field-label">Bölümün</span>
          <select className="select" value={anadal?.id ?? ""} onChange={(e) => onAnadal(e.target.value || null)}>
            <option value="">Seçilmedi</option>
            {groups.map((g) => (
              <optgroup key={g.faculty} label={g.faculty}>
                {g.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Çift anadal</span>
          <select
            className="select"
            value={cap?.id ?? ""}
            disabled={!anadal}
            onChange={(e) => onCap(e.target.value || null)}
          >
            <option value="">Yok</option>
            {capGroups.map((g) => (
              <optgroup key={g.faculty} label={g.faculty}>
                {g.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {minors && (
          <label className="field">
            <span className="field-label">Yandal</span>
            <select
              className="select"
              value={minor?.id ?? ""}
              disabled={!anadal}
              onChange={(e) => onYandal(e.target.value || null)}
            >
              <option value="">Yok</option>
              {sortedMinors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.status === "unlisted" ? " (ders listesi yayınlanmamış)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {minor?.status === "unlisted" && (
        <div className="notice rm-notice">
          <p>
            Bu yandalın ders listesi sayfada yayınlanmamış, planda yer almaz.{" "}
            <a className="link" href={minor.sourceUrl} target="_blank" rel="noreferrer">
              Bölümün sayfasına bak
            </a>
            .
          </p>
        </div>
      )}
      {minor && minor.status === "listed" && minor.notes.length > 0 && (
        <details className="rm-more">
          <summary>Yandal koşulları</summary>
          <ul className="rm-notes">
            {minor.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <a className="link" href={minor.sourceUrl} target="_blank" rel="noreferrer">
            Kaynak sayfa
          </a>
        </details>
      )}

      <fieldset className="rm-when" disabled={!anadal}>
        <legend className="field-label">Hangi dönemi başlatacaksın</legend>
        <div className="rm-fields rm-fields-pair">
          <label className="field">
            <span className="sr-only">Yıl</span>
            <select
              className="select"
              value={String(start.year)}
              onChange={(e) => onStart({ year: Number(e.target.value), season: start.season })}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? "Hazırlık" : `${y}. yıl`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-only">Dönem</span>
            <select
              className="select"
              value={start.season}
              onChange={(e) => onStart({ year: start.year, season: e.target.value === "bahar" ? "bahar" : "guz" })}
            >
              <option value="guz">Güz</option>
              <option value="bahar">Bahar</option>
            </select>
          </label>
        </div>
      </fieldset>

      {anadal && !isFirst && (
        <button type="button" className="btn rm-wide" onClick={onMarkPrevious}>
          Bundan önceki dönemlerin hepsini geçtim
        </button>
      )}
      {note && (
        <p className="hint rm-status" aria-hidden="true">
          {note}
        </p>
      )}

      <p className="hint rm-rules">
        Çift anadal için not ortalaman en az 2,72 olmalı ve sınıfının ilk %20&apos;sinde olmalısın (ya da bölümün YKS
        sıralaması şartını sağlamalısın); başvuru 3. dönemin başından 5. dönemin başına kadar yapılır. Yandal için en az
        2,50 gerekir ve kaldığın ders olmamalı.{" "}
        <a className="link" href={MINOR_INFO_URL} target="_blank" rel="noreferrer">
          Başvuru kuralları
        </a>
      </p>
    </section>
  );
}
