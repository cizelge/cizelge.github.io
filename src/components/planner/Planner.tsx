"use client";

import { useEffect, useMemo, useState } from "react";
import { parseTermLabel, SEASON_LABEL, termHasTimes, type TermOption } from "@/lib/terms";
import type { Course, ProgramsData, TermData } from "@/lib/types";
import { expandCorequisites, type RelaxedConstraint, type SectionRef } from "@/lib/engine";
import { visibleDays } from "@/lib/days";
import { programYears } from "@/lib/planner/curriculum";
import { buildIcs } from "@/lib/planner/ics";
import { decodeState, EMPTY_STATE, encodeState, missingNotice, termSwitchQuery, type PlannerState } from "@/lib/planner/state";
import { useSchedules } from "@/lib/planner/useSchedules";
import { Cart } from "./Cart";
import { CourseSearch } from "./CourseSearch";
import { Curriculum } from "./Curriculum";
import { NoSolution } from "./NoSolution";
import { placeMeetings, timeRange } from "./placed";
import { Tuning } from "./Preferences";
import { formatGap, groupSchedules, ScheduleStrip } from "./ScheduleStrip";
import { TermSelect } from "./TermSelect";
import { WeekGrid } from "./WeekGrid";

const STORAGE_KEY = "planlayici:";
const HIGHLIGHTERS = 6;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* gizli pencere vb.: sessizce geç */
  }
}

function nextMonday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}

interface PlannerProps {
  term: TermData;
  programs: ProgramsData | null;
  /** Dönem seçicinin seçenekleri (termOptions); boşsa seçici gösterilmez. */
  termOptions?: readonly TermOption[];
}

export function Planner({ term, programs, termOptions = [] }: PlannerProps) {
  const courses = useMemo(() => new Map<string, Course>(term.courses.map((c) => [c.code, c])), [term]);
  // Özyeğin bir dönemi önce yalnızca ders listesiyle yayınlar; saatler gelene kadar program oluşturulmaz.
  const hasTimes = useMemo(() => termHasTimes(term), [term]);
  const seasonName = SEASON_LABEL[parseTermLabel(term.termLabel).season];
  const sectionIds = useMemo(
    () => new Map(term.courses.map((c) => [c.code, c.sections.map((s) => s.id)])),
    [term],
  );
  const yearsByProgram = useMemo(
    () => (programs ? new Map(programs.programs.map((p) => [p.id, programYears(p)])) : undefined),
    [programs],
  );

  const [state, setState] = useState<PlannerState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [tab, setTab] = useState<"dersler" | "program">("dersler");
  const [note, setNote] = useState("");

  // İlk yükleme: önce linkteki durum, yoksa bu tarayıcıda kalan son durum.
  useEffect(() => {
    const query = window.location.search.slice(1) || readStorage(STORAGE_KEY + term.schoolId + term.termId) || "";
    const decoded = decodeState(query, sectionIds, yearsByProgram);
    // Elle yazılmış linklerde de yan koşullu dersler eksik kalmasın.
    const cartCourses = decoded.state.cart.map((c) => courses.get(c)).filter((c): c is Course => !!c);
    const withCoreqs = expandCorequisites(cartCourses, term.courses).map((c) => c.code);
    decoded.state.cart = [...decoded.state.cart, ...withCoreqs.filter((c) => !decoded.state.cart.includes(c))];
    setState(decoded.state);
    setMissing(window.location.search ? decoded.missing : []);
    if (decoded.state.cart.length > 0) setTab("program");
    setReady(true);
  }, [courses, sectionIds, yearsByProgram, term]);

  useEffect(() => {
    if (!ready) return;
    const query = encodeState(state);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    writeStorage(STORAGE_KEY + term.schoolId + term.termId, query);
  }, [state, ready, term.schoolId, term.termId]);

  const colorOf = (code: string) => Math.max(0, state.cart.indexOf(code)) % HIGHLIGHTERS;
  const update = (patch: Partial<PlannerState>) => setState((s) => ({ ...s, selected: 0, ...patch }));

  const input = useMemo(
    () =>
      state.cart.length === 0
        ? null
        : {
            courses: state.cart.map((c) => courses.get(c)!).filter(Boolean),
            freeDays: state.freeDays,
            locked: state.locked,
            excluded: state.excluded,
            weights: state.weights,
          },
    [state.cart, state.freeDays, state.locked, state.excluded, state.weights, courses],
  );
  const { result, pending } = useSchedules(ready && hasTimes ? input : null);

  const schedules = useMemo(() => result?.schedules ?? [], [result]);
  const selectedIndex = Math.min(state.selected, Math.max(0, schedules.length - 1));
  const current = schedules[selectedIndex];
  const groups = useMemo(() => groupSchedules(schedules, courses), [schedules, courses]);
  const groupRank = Math.max(0, groups.findIndex((g) => g.members.includes(selectedIndex))) + 1;
  const cartSections: SectionRef[] = state.cart.flatMap((code) =>
    (courses.get(code)?.sections ?? []).map((s) => ({ courseCode: code, sectionId: s.id })),
  );
  // Cumartesi/Pazar sütunu yalnızca sepetteki bir şube o gün ders yapıyorsa görünür.
  const days = visibleDays(
    cartSections.flatMap(
      (r) => courses.get(r.courseCode)?.sections.find((s) => s.id === r.sectionId)?.meetings ?? [],
    ),
  );
  const placed = current ? placeMeetings(current.sections, courses, colorOf) : [];
  const range = timeRange(placed);

  function addCourse(code: string) {
    const course = courses.get(code);
    if (!course || state.cart.includes(code)) return;
    const withCoreqs = expandCorequisites([course], term.courses).map((c) => c.code);
    const added = withCoreqs.filter((c) => !state.cart.includes(c));
    update({ cart: [...state.cart, ...added] });
    const extra = added.filter((c) => c !== code);
    setNote(extra.length ? `${code} ile birlikte alınması gereken ${extra.join(", ")} da eklendi.` : `${code} eklendi.`);
  }

  function addCourses(codes: string[]) {
    update({ cart: [...state.cart, ...codes.filter((c) => !state.cart.includes(c))] });
  }

  function removeCourse(code: string) {
    const { [code]: _, ...locked } = state.locked;
    void _;
    update({
      cart: state.cart.filter((c) => c !== code),
      locked,
      excluded: state.excluded.filter((e) => e.courseCode !== code),
    });
    setNote(`${code} çıkarıldı.`);
  }

  function applySuggestion(c: RelaxedConstraint) {
    if (c.kind === "freeDay") update({ freeDays: state.freeDays.filter((d) => d !== c.day) });
    if (c.kind === "lock") {
      const { [c.courseCode]: _, ...locked } = state.locked;
      void _;
      update({ locked });
    }
    if (c.kind === "exclusion") {
      update({ excluded: state.excluded.filter((e) => !(e.courseCode === c.courseCode && e.sectionId === c.sectionId)) });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link kopyalandı. Açan kişi aynı programı görür.");
    } catch {
      setNote("Link kopyalanamadı. Adres çubuğundaki linki paylaşabilirsin.");
    }
  }

  function downloadIcs() {
    if (!current) return;
    const blob = new Blob([buildIcs(current.sections, courses, nextMonday())], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `program-${groupRank}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote("Takvim dosyası indirildi. Dersler önümüzdeki Pazartesiden itibaren 14 hafta tekrar eder.");
  }

  const status = !ready
    ? ""
    : state.cart.length === 0
      ? ""
      : pending && !result
        ? "Programlar hesaplanıyor"
        : schedules.length === 0
          ? ""
          : `${result?.truncated ? "50.000'den fazla" : schedules.length === 50 ? "En iyi 50" : schedules.length} çakışmasız program${
              groups.length < schedules.length ? `, ${groups.length} farklı haftalık düzen` : " bulundu"
            }`;

  return (
    <div className="planner" data-tab={tab}>
      <div className="tabs" role="tablist" aria-label="Görünüm">
        <button type="button" role="tab" className="tab" aria-selected={tab === "dersler"} onClick={() => setTab("dersler")}>
          Dersler <span className="num">({state.cart.length})</span>
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "program"} onClick={() => setTab("program")}>
          Program
        </button>
      </div>

      <aside className="rail" aria-label="Ders seçimi ve tercihler">
        <TermSelect
          schoolId={term.schoolId}
          currentId={term.termId}
          options={termOptions}
          query={ready ? termSwitchQuery(state) : ""}
        />
        {programs && (
          <Curriculum
            programs={programs.programs}
            termLabel={term.termLabel}
            courses={term.courses}
            cart={state.cart}
            program={state.program}
            year={state.year}
            onSelect={(program, year) => setState((s) => ({ ...s, program, year }))}
            onAdd={addCourse}
            onAddMany={addCourses}
          />
        )}
        <CourseSearch courses={term.courses} cart={state.cart} onAdd={addCourse} />
        <Cart
          cart={state.cart}
          courses={courses}
          colorOf={colorOf}
          locked={state.locked}
          excluded={state.excluded}
          chosen={Object.fromEntries((current?.sections ?? []).map((r) => [r.courseCode, r.sectionId]))}
          onRemove={removeCourse}
          onLock={(code, id) => {
            const { [code]: _, ...rest } = state.locked;
            void _;
            update({ locked: id ? { ...rest, [code]: id } : rest });
          }}
          onToggleExclude={(ref) => {
            const has = state.excluded.some((e) => e.courseCode === ref.courseCode && e.sectionId === ref.sectionId);
            update({
              excluded: has
                ? state.excluded.filter((e) => !(e.courseCode === ref.courseCode && e.sectionId === ref.sectionId))
                : [...state.excluded, ref],
            });
          }}
        />
        {state.cart.length > 0 && (
          <button type="button" className="btn btn-pen tab-jump" onClick={() => setTab("program")}>
            Programları gör
          </button>
        )}
      </aside>

      <main className="board" id="icerik">
        <p className="sr-only" role="status" aria-live="polite">
          {note}
        </p>

        {!hasTimes && (
          <div className="notice">
            <h3>{seasonName} dönemi ders saatleri henüz açıklanmadı</h3>
            <p>
              Özyeğin şimdilik yalnızca {seasonName} döneminde açılacak dersleri yayınladı. Sepetini şimdiden
              hazırlayabilirsin; saatler açıklanınca programlar burada oluşur.
            </p>
          </div>
        )}

        {missing.length > 0 && (
          <div className="notice">
            <p>{missingNotice(missing, term.termLabel)}</p>
          </div>
        )}

        <div className="board-head">
          <h1 className="board-title">
            {!hasTimes
              ? `${seasonName} sepetin`
              : state.cart.length === 0
                ? "Haftan henüz boş"
                : current
                  ? `${groupRank}. program`
                  : "Programın"}
          </h1>
          <span className="board-status num" aria-live="polite">
            {status}
          </span>
        </div>

        {hasTimes && state.cart.length > 0 && (
          <Tuning
            freeDays={state.freeDays}
            onFreeDays={(freeDays) => update({ freeDays })}
            weights={state.weights}
            onWeights={(weights) => update({ weights })}
          />
        )}

        {groups.length > 1 && (
          <ScheduleStrip
            schedules={schedules}
            groups={groups}
            selected={selectedIndex}
            onSelect={(i) => setState((s) => ({ ...s, selected: i }))}
            courses={courses}
            colorOf={colorOf}
            days={days}
          />
        )}

        {result && schedules.length === 0 && state.cart.length > 0 && (
          <NoSolution reason={result.reason} suggestions={result.suggestions} onApply={applySuggestion} />
        )}

        {current && (
          <div className="board-head" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
            <dl className="facts">
              <div className="fact">
                <dt>Kampüste</dt>
                <dd className="num">{current.summary.days} gün</dd>
              </div>
              <div className="fact">
                <dt>Dersler arası</dt>
                <dd className="num">{formatGap(current.summary.gapMinutes)}</dd>
              </div>
              {current.summary.earliestStart && (
                <div className="fact">
                  <dt>İlk ders</dt>
                  <dd className="num">{current.summary.earliestStart}</dd>
                </div>
              )}
              {current.summary.latestEnd && (
                <div className="fact">
                  <dt>Son ders biter</dt>
                  <dd className="num">{current.summary.latestEnd}</dd>
                </div>
              )}
            </dl>
            <div className="actions">
              <button type="button" className="btn" onClick={copyLink}>
                Linki kopyala
              </button>
              <button type="button" className="btn" onClick={downloadIcs}>
                Takvime ekle
              </button>
            </div>
          </div>
        )}

        <WeekGrid
          meetings={placed}
          freeDays={state.freeDays}
          range={range}
          days={days}
          empty={
            !ready ? null : !hasTimes ? (
              <p>{seasonName} saatleri gelince programların burada boyanır.</p>
            ) : state.cart.length === 0 ? (
              <p>Ders ekledikçe en uygun programlar burada boyanır.</p>
            ) : null
          }
        />
      </main>
    </div>
  );
}
