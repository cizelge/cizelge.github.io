"use client";

import { useEffect, useMemo, useState } from "react";
import type { TermSeason } from "@/lib/terms";
import type { Program, TermData } from "@/lib/types";
import { criticalCourses, unreadablePrerequisites } from "@/lib/roadmap/critical";
import { DEFAULT_ERASMUS_ECTS, suggestErasmusTerms } from "@/lib/roadmap/erasmus";
import { computeGpa, gradeEntries, maxLoad } from "@/lib/roadmap/gpa";
import { minorRequirements } from "@/lib/roadmap/minors";
import { buildOfferingMap } from "@/lib/roadmap/offering";
import { buildPlan } from "@/lib/roadmap/plan";
import { markUntil, passedCodes, passedEcts, programProgress } from "@/lib/roadmap/progress";
import { programRequirements } from "@/lib/roadmap/requirements";
import { DEFAULT_START, EMPTY_STATE, loadState, planStart, saveState, type RoadmapState } from "@/lib/roadmap/storage";
import type { Completion, Minor, PlanOptions, RoadmapProgram } from "@/lib/roadmap/types";
import { ErasmusPlanner } from "./ErasmusPlanner";
import { GpaPanel } from "./GpaPanel";
import { PassedCourses } from "./PassedCourses";
import { PrereqWarnings } from "./PrereqWarnings";
import { StartPanel } from "./StartPanel";
import { Summary } from "./Summary";
import { TermPlan } from "./TermPlan";

interface Props {
  programs: Program[];
  minors: Minor[] | null;
  /** Yalnızca ders kodlarıyla dönem verisi (açılma bilgisi için). */
  terms: TermData[];
  /** Şu anki dönem; planın ilk takvim dönemi buna göre bulunur. */
  current: { startYear: number; season: TermSeason };
}

export function Roadmap({ programs, minors, terms, current }: Props) {
  const [state, setState] = useState<RoadmapState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"dersler" | "program">("dersler");
  const [note, setNote] = useState("");
  // Erasmus dönemi seçilmemişken de kutudaki AKTS önerilerde kullanılır.
  const [ectsDraft, setEctsDraft] = useState(DEFAULT_ERASMUS_ECTS);

  // Kayıt sunucuda yok: ilk çizim boş durumla yapılır, sonra tarayıcıdaki kayıt okunur.
  useEffect(() => {
    const saved = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kayıt yalnızca tarayıcıda bilinir
    setState(saved);
    if (saved.anadal) setTab("program");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveState(state);
  }, [state, ready]);

  const anadal = useMemo(() => programs.find((p) => p.id === state.anadal) ?? null, [programs, state.anadal]);
  const cap = useMemo(
    () => (anadal ? (programs.find((p) => p.id === state.cap && p.id !== anadal.id) ?? null) : null),
    [programs, anadal, state.cap],
  );
  const minor = useMemo(
    () => (anadal ? (minors?.find((m) => m.id === state.yandal) ?? null) : null),
    [minors, anadal, state.yandal],
  );

  const roadmap = useMemo(() => {
    const list: RoadmapProgram[] = [];
    if (anadal) list.push(programRequirements(anadal, "anadal"));
    if (cap) list.push(programRequirements(cap, "cap"));
    if (minor) list.push(minorRequirements(minor));
    return list;
  }, [anadal, cap, minor]);

  const { completion, grades, maxCredits } = state;
  const start = state.start ?? DEFAULT_START;

  const offering = useMemo(() => buildOfferingMap(terms, roadmap), [terms, roadmap]);
  const passed = useMemo(() => passedCodes(roadmap, completion), [roadmap, completion]);
  const progress = useMemo(
    () => roadmap.map((p) => programProgress(p, completion, passed)),
    [roadmap, completion, passed],
  );
  const erasmus = state.erasmus;
  const erasmusEcts = erasmus?.ects ?? ectsDraft;
  const planOptions = useMemo<PlanOptions>(
    () => ({ start: planStart(current, start.season), maxCredits }),
    [current, start.season, maxCredits],
  );
  // Erasmussuz plan: Erasmus dönemi seçenekleri ve öneriler buna göre.
  const basePlan = useMemo(
    () => (roadmap.length === 0 ? null : buildPlan(roadmap, completion, offering, planOptions)),
    [roadmap, completion, offering, planOptions],
  );
  const plan = useMemo(
    () => (!basePlan || !erasmus ? basePlan : buildPlan(roadmap, completion, offering, { ...planOptions, erasmus })),
    [basePlan, erasmus, roadmap, completion, offering, planOptions],
  );
  const erasmusSuggestions = useMemo(
    () =>
      !basePlan
        ? []
        : suggestErasmusTerms(
            roadmap,
            completion,
            offering,
            { ...planOptions, erasmus: { term: planOptions.start, ects: erasmusEcts } },
            basePlan.terms.length,
          ).slice(0, 3),
    [basePlan, roadmap, completion, offering, planOptions, erasmusEcts],
  );
  const entries = useMemo(() => gradeEntries(roadmap, completion, grades), [roadmap, completion, grades]);
  const gpa = computeGpa(entries).gpa;
  const loadLimit = maxLoad(gpa, { cap: !!cap, passedEcts: passedEcts(roadmap, completion) });
  // Hedef hesabı için kalan AKTS: planda yer alan derslerin toplamı (yerleşemeyenler hariç, tahmin).
  const remainingCredits = plan ? plan.terms.reduce((n, t) => n + t.credits, 0) : 0;
  const critical = useMemo(() => criticalCourses(roadmap, completion).slice(0, 5), [roadmap, completion]);
  const unreadable = useMemo(() => unreadablePrerequisites(roadmap, completion), [roadmap, completion]);

  const update = (patch: Partial<RoadmapState>) => setState((s) => ({ ...s, ...patch }));
  const setCompletion = (next: Completion) => update({ completion: next });

  function markPrevious() {
    const marks: Completion = {};
    for (const p of roadmap) {
      if (p.kind !== "yandal") Object.assign(marks, markUntil(p, start));
    }
    const added = Object.keys(marks).filter((id) => completion[id] === undefined).length;
    // Önceden seçilmiş havuz dersleri korunur.
    setCompletion({ ...marks, ...completion });
    setNote(added > 0 ? `${added} ders geçildi olarak işaretlendi.` : "Bu dönemden önce işaretlenecek yeni ders yok.");
  }

  const remaining = progress.reduce((n, p) => n + p.remainingCourses + p.remainingElectives, 0);

  return (
    <div className="planner roadmap" data-tab={tab}>
      <div className="tabs" role="tablist" aria-label="Görünüm">
        <button type="button" role="tab" className="tab" aria-selected={tab === "dersler"} onClick={() => setTab("dersler")}>
          Derslerin
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "program"} onClick={() => setTab("program")}>
          Plan
        </button>
      </div>

      <aside className="rail" aria-label="Bölüm ve geçtiğin dersler">
        <StartPanel
          programs={programs}
          minors={minors}
          anadal={anadal}
          cap={cap}
          minor={minor}
          start={start}
          note={note}
          onAnadal={(id) => {
            setNote("");
            update({ anadal: id, cap: state.cap === id ? null : state.cap });
          }}
          onCap={(id) => update({ cap: id })}
          onYandal={(id) => update({ yandal: id })}
          onStart={(next) => {
            setNote("");
            update({ start: next });
          }}
          onMarkPrevious={markPrevious}
        />
        {roadmap.length > 0 && (
          <PassedCourses
            programs={roadmap}
            completion={completion}
            passed={passed}
            grades={grades}
            onChange={(next, nextGrades) => update({ completion: next, grades: nextGrades })}
          />
        )}
        {anadal && (
          <button type="button" className="btn btn-pen tab-jump" onClick={() => setTab("program")}>
            Planı gör
          </button>
        )}
      </aside>

      <main className="board" id="icerik">
        <p className="sr-only" role="status" aria-live="polite">
          {note}
        </p>
        {!ready ? null : !plan ? (
          <div className="rm-empty">
            <h1 className="board-title">Mezuniyet yol haritası</h1>
            <p className="hint">
              Bölümünü seç. Geçtiğin dersleri işaretleyince kalan derslerin dönem dönem yerleşir ve ne zaman mezun
              olabileceğin görünür.
            </p>
            <button type="button" className="btn tab-jump" onClick={() => setTab("dersler")}>
              Bölümünü seç
            </button>
          </div>
        ) : (
          <>
            <Summary programs={roadmap} progress={progress} plan={plan} remaining={remaining} />
            <GpaPanel entries={entries} remainingCredits={remainingCredits} loadLimit={loadLimit} cap={!!cap} />
            {basePlan && basePlan.terms.length > 0 && (
              <ErasmusPlanner
                terms={basePlan.terms}
                value={erasmus}
                ects={erasmusEcts}
                suggestions={erasmusSuggestions}
                onTerm={(term) => update({ erasmus: term ? { term, ects: erasmusEcts } : null })}
                onEcts={(n) => {
                  setEctsDraft(n);
                  if (erasmus) update({ erasmus: { term: erasmus.term, ects: n } });
                }}
              />
            )}
            <TermPlan
              programs={roadmap}
              plan={plan}
              unreadableIds={unreadable.map((u) => u.requirementId)}
              maxCredits={maxCredits}
              onMaxCredits={(n) => update({ maxCredits: n })}
              loadLimit={gpa === null && !cap ? null : loadLimit}
              anadalId={anadal?.id ?? null}
            />
            <PrereqWarnings critical={critical} unreadable={unreadable} />
          </>
        )}
      </main>
    </div>
  );
}
