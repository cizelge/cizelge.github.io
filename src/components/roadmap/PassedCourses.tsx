"use client";

import { useId, useMemo } from "react";
import { GRADES, type Grade, type Grades } from "@/lib/roadmap/gpa";
import { hasCode, isDone, passedCodes } from "@/lib/roadmap/progress";
import type { Completion, Requirement, RoadmapProgram } from "@/lib/roadmap/types";
import { creditsText, KIND_HL, KIND_LABEL, slotLabel } from "./shared";

interface Props {
  programs: RoadmapProgram[];
  completion: Completion;
  passed: ReadonlySet<string>;
  grades: Grades;
  onChange: (completion: Completion, grades: Grades) => void;
}

interface Group {
  key: string;
  label: string;
  requirements: Requirement[];
}

function groupBySlot(program: RoadmapProgram): Group[] {
  const groups = new Map<string, Group>();
  for (const r of program.requirements) {
    const key = r.slot ? `y${r.slot.year}-${r.slot.season}` : "all";
    const g = groups.get(key);
    if (g) g.requirements.push(r);
    else groups.set(key, { key, label: slotLabel(r.slot), requirements: [r] });
  }
  return [...groups.values()];
}

export function PassedCourses({ programs, completion, passed, grades, onChange }: Props) {
  const id = useId();

  /** İşaret kaldırılınca not da silinir. */
  function set(reqId: string, value: true | string | null) {
    const next = { ...completion };
    const nextGrades = { ...grades };
    if (value === null) {
      delete next[reqId];
      delete nextGrades[reqId];
    } else next[reqId] = value;
    onChange(next, nextGrades);
  }

  /** Geçer not dersi geçildi yapar; F dersi kalanlara döndürür ama ortalamada tutulur. */
  function setGrade(reqId: string, grade: Grade | null) {
    const next = { ...completion };
    const nextGrades = { ...grades };
    if (grade === null) delete nextGrades[reqId];
    else {
      nextGrades[reqId] = grade;
      if (grade === "F") delete next[reqId];
      else if (next[reqId] === undefined) next[reqId] = true;
    }
    onChange(next, nextGrades);
  }

  return (
    <section aria-labelledby={`${id}-t`} className="rm-passed">
      <h2 className="group-title" id={`${id}-t`}>
        Geçtiğin dersler
      </h2>
      {programs.map((p) => (
        <ProgramBlock
          key={`${p.kind}:${p.id}`}
          program={p}
          others={programs.filter((o) => o !== p)}
          completion={completion}
          passed={passed}
          grades={grades}
          onSet={set}
          onGrade={setGrade}
        />
      ))}
    </section>
  );
}

function ProgramBlock({
  program,
  others,
  completion,
  passed,
  grades,
  onSet,
  onGrade,
}: {
  program: RoadmapProgram;
  others: RoadmapProgram[];
  completion: Completion;
  passed: ReadonlySet<string>;
  grades: Grades;
  onSet: (reqId: string, value: true | string | null) => void;
  onGrade: (reqId: string, grade: Grade | null) => void;
}) {
  const groups = useMemo(() => groupBySlot(program), [program]);
  const passedElsewhere = passedCodes(others, completion);
  const done = program.requirements.filter((r) => isDone(r, completion, passed)).length;

  if (program.requirements.length === 0) return null;

  return (
    <details className={`rm-program hl-${KIND_HL[program.kind]}`} open={program.kind === "anadal"}>
      <summary className="rm-program-summary">
        <span className="rm-swatch" aria-hidden="true" />
        <span className="rm-program-name">
          {program.name}
          <span className="sr-only">, {KIND_LABEL[program.kind]}</span>
        </span>
        <span className="hint num">
          {done}/{program.requirements.length}
        </span>
      </summary>
      {groups.map((g) => {
        const groupDone = g.requirements.filter((r) => isDone(r, completion, passed)).length;
        return (
          <details key={g.key} className="rm-slot">
            <summary>
              {g.label}
              <span className="hint num">
                {groupDone}/{g.requirements.length}
              </span>
            </summary>
            <ul className="rm-reqs">
              {g.requirements.map((r) => (
                <RequirementRow
                  key={r.id}
                  req={r}
                  mark={completion[r.id]}
                  passed={passed}
                  passedElsewhere={passedElsewhere}
                  grade={grades[r.id] ?? null}
                  onSet={onSet}
                  onGrade={onGrade}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </details>
  );
}

function RequirementRow({
  req,
  mark,
  passed,
  passedElsewhere,
  grade,
  onSet,
  onGrade,
}: {
  req: Requirement;
  mark: true | string | undefined;
  passed: ReadonlySet<string>;
  passedElsewhere: ReadonlySet<string>;
  grade: Grade | null;
  onSet: (reqId: string, value: true | string | null) => void;
  onGrade: (reqId: string, grade: Grade | null) => void;
}) {
  const label = req.code ?? req.title;
  const gradeSelect = (
    <GradeSelect value={grade} label={label} onChange={(g) => onGrade(req.id, g)} />
  );
  const failed = grade === "F" && (
    <span className="hint rm-req-hint rm-failed">F aldın; ders planda tekrar yer alır.</span>
  );
  // Havuzlu seçmeli: hangi dersin alındığı seçilir.
  if (req.kind === "elective" && req.pool) {
    const value = typeof mark === "string" ? mark : "";
    const known = !value || req.pool.some((c) => c.code === value);
    return (
      <li className="rm-req">
        <label className="rm-pick">
          <span className="rm-req-main">
            <span className="rm-req-title">{req.title}</span>
            <span className="rm-req-credits num">{creditsText(req.credits)}</span>
          </span>
          <select
            className="select"
            value={mark === true ? "*" : value}
            onChange={(e) => onSet(req.id, e.target.value === "" ? null : e.target.value === "*" ? true : e.target.value)}
          >
            <option value="">Almadım</option>
            {mark === true && <option value="*">Aldım, ders belirtilmedi</option>}
            {!known && <option value={value}>{value}</option>}
            {req.pool.map((c) => (
              <option key={c.code} value={c.code} disabled={c.code !== value && hasCode(passed, c.code)}>
                {c.code} {c.title}
              </option>
            ))}
          </select>
        </label>
        {(mark !== undefined || grade) && <div className="rm-grade-row">{gradeSelect}</div>}
        {failed}
      </li>
    );
  }

  const viaOther = mark === undefined && req.kind === "course" && !!req.code && hasCode(passed, req.code);
  const checked = mark !== undefined || viaOther;
  return (
    <li className="rm-req">
      <label className="rm-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={viaOther}
          onChange={(e) => onSet(req.id, e.target.checked ? true : null)}
        />
        <span className="rm-req-main">
          {req.code && <span className="rm-req-code num">{req.code}</span>}
          <span className="rm-req-title">{req.title}</span>
          <span className="rm-req-credits num">{creditsText(req.credits)}</span>
        </span>
      </label>
      {!viaOther && gradeSelect}
      {failed}
      {viaOther && (
        <span className="hint rm-req-hint">
          {req.code && hasCode(passedElsewhere, req.code) ? "diğer programda geçtin" : "seçmeli olarak geçtin"}
        </span>
      )}
    </li>
  );
}

function GradeSelect({ value, label, onChange }: { value: Grade | null; label: string; onChange: (g: Grade | null) => void }) {
  return (
    <select
      className={`select rm-grade${value ? " has-grade" : ""}`}
      aria-label={`${label} harf notu`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Grade))}
    >
      <option value="">Not</option>
      {GRADES.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}
