"use client";

import { useId, useMemo, useState } from "react";
import type { Course, PlanPoolCourse, Program } from "@/lib/types";
import {
  curriculumFor,
  describeAddition,
  groupByFaculty,
  planAddition,
  programYears,
  seasonOfTerm,
  yearLabel,
  type ElectiveGroup,
} from "@/lib/planner/curriculum";

interface Props {
  programs: readonly Program[];
  termLabel: string;
  courses: readonly Course[];
  cart: readonly string[];
  program: string | null;
  year: number | null;
  onSelect: (program: string | null, year: number | null) => void;
  onAdd: (code: string) => void;
  onAddMany: (codes: string[]) => void;
}

const SEASON_NAME = { guz: "Güz", bahar: "Bahar", yaz: "Yaz" } as const;
const SEARCH_HINT = "Bu seçmeli için istediğin dersi arayarak ekleyebilirsin.";

export function Curriculum({ programs, termLabel, courses, cart, program, year, onSelect, onAdd, onAddMany }: Props) {
  const id = useId();
  const [message, setMessage] = useState("");
  const groups = useMemo(() => groupByFaculty(programs), [programs]);
  const season = seasonOfTerm(termLabel);
  const chosen = useMemo(() => programs.find((p) => p.id === program) ?? null, [programs, program]);
  const years = chosen ? programYears(chosen) : [];
  const view = useMemo(
    () => (chosen && year !== null && season ? curriculumFor(chosen, year, season, courses) : null),
    [chosen, year, season, courses],
  );

  function selectProgram(nextId: string) {
    const next = programs.find((p) => p.id === nextId) ?? null;
    const keepYear = next && year !== null && programYears(next).includes(year) ? year : null;
    setMessage("");
    onSelect(next?.id ?? null, keepYear);
  }

  function addAll() {
    if (!view) return;
    const plan = planAddition(view, cart, courses);
    if (plan.added.length > 0) onAddMany(plan.added);
    setMessage(describeAddition(plan));
  }

  const offeredCount = view?.required.filter((r) => r.offered).length ?? 0;

  return (
    <section aria-labelledby={`${id}-t`} className="curriculum">
      <h2 className="group-title" id={`${id}-t`}>
        Müfredatın
        {season && season !== "yaz" && <span className="aside">{SEASON_NAME[season]} dönemi</span>}
      </h2>
      <div className="curriculum-fields">
        <label className="field">
          <span className="field-label">Bölümün</span>
          <select className="select" value={chosen?.id ?? ""} onChange={(e) => selectProgram(e.target.value)}>
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
          <span className="field-label">Sınıfın</span>
          <select
            className="select"
            value={chosen && year !== null ? String(year) : ""}
            disabled={!chosen}
            onChange={(e) => {
              setMessage("");
              onSelect(chosen?.id ?? null, e.target.value === "" ? null : Number(e.target.value));
            }}
          >
            <option value="">Seçilmedi</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {yearLabel(y)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!chosen || year === null ? (
        <p className="hint curriculum-gap">Bölümünü ve sınıfını seçersen bu dönem alman gereken dersler listelenir.</p>
      ) : season === "yaz" ? (
        <p className="hint curriculum-gap">Yaz döneminde müfredat listesi yok, derslerini arayarak ekleyebilirsin.</p>
      ) : !season || !view ? (
        <p className="hint curriculum-gap">Bu dönemin güz mü bahar mı olduğu anlaşılamadı, derslerini arayarak ekleyebilirsin.</p>
      ) : view.required.length === 0 && view.electives.length === 0 ? (
        <p className="hint curriculum-gap">
          {yearLabel(year)} {SEASON_NAME[season].toLocaleLowerCase("tr")} döneminde müfredatta ders yok.
        </p>
      ) : (
        <>
          {view.required.length > 0 && (
            <>
              <ul className="results curriculum-list" aria-label="Zorunlu dersler">
                {view.required.map((r) => {
                  const inCart = cart.includes(r.code);
                  return (
                    <li key={r.code} className={`result${r.offered ? "" : " is-off"}`}>
                      <span className="result-code num">{r.code}</span>
                      <span className="result-title">{r.title}</span>
                      <span className="result-status">{!r.offered ? "Bu dönem yok" : inCart ? "Sepette" : "Açılıyor"}</span>
                    </li>
                  );
                })}
              </ul>
              {offeredCount > 0 ? (
                <button type="button" className="btn btn-pen curriculum-add" onClick={addAll}>
                  Bu dönemin derslerini ekle
                </button>
              ) : (
                <p className="hint curriculum-gap">Bu dönemin zorunlu derslerinden hiçbiri açılmıyor.</p>
              )}
            </>
          )}
          <p className="hint curriculum-status" role="status">
            {message}
          </p>
          {view.electives.map((e) => (
            <Elective key={e.key} elective={e} cart={cart} onAdd={onAdd} />
          ))}
        </>
      )}
    </section>
  );
}

function Elective({ elective, cart, onAdd }: { elective: ElectiveGroup; cart: readonly string[]; onAdd: (code: string) => void }) {
  const { label, count, pool } = elective;
  return (
    <details className="cart-details elective">
      <summary>
        {label}
        {count > 1 && <span className="num"> ({count})</span>}
      </summary>
      {pool === null ? (
        <p className="hint">{SEARCH_HINT}</p>
      ) : pool.length === 0 ? (
        <p className="hint">Bu seçmelinin derslerinden hiçbiri bu dönem açılmıyor. {SEARCH_HINT}</p>
      ) : (
        <ul className="results" aria-label={`${label} dersleri`}>
          {pool.map((c) => (
            <PoolRow key={c.code} course={c} inCart={cart.includes(c.code)} onAdd={onAdd} />
          ))}
        </ul>
      )}
    </details>
  );
}

function PoolRow({ course, inCart, onAdd }: { course: PlanPoolCourse; inCart: boolean; onAdd: (code: string) => void }) {
  return (
    <li className="result">
      <span className="result-code num">{course.code}</span>
      <span className="result-title">{course.title}</span>
      <button
        type="button"
        className={`btn btn-small${inCart ? " btn-quiet" : ""}`}
        disabled={inCart}
        onClick={() => onAdd(course.code)}
        aria-label={inCart ? `${course.code} sepette` : `${course.code} ekle`}
      >
        {inCart ? "Sepette" : "Ekle"}
      </button>
    </li>
  );
}
