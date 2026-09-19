"use client";

import { useEffect, useMemo, useState } from "react";
import { parseTermLabel, SEASON_LABEL, termHasTimes, type TermOption } from "@/lib/terms";
import type { Course, ProgramsData, TermData } from "@/lib/types";
import { expandCorequisites, type RelaxedConstraint, type SectionRef } from "@/lib/engine";
import { visibleDays } from "@/lib/days";
import { programYears } from "@/lib/planner/curriculum";
import { savePng } from "@/lib/planner/download-image";
import { OZYEGIN_CALENDAR } from "@/lib/calendar";
import { buildIcs } from "@/lib/planner/ics";
import { buildScheduleSvg, imageFileName } from "@/lib/planner/image";
import { decodeState, EMPTY_STATE, encodeState, missingNotice, termSwitchQuery, type PlannerState } from "@/lib/planner/state";
import { useSchedules } from "@/lib/planner/useSchedules";
import { bestPicks, scheduleScore, scoreLookup } from "@/lib/planner/instructor-score";
import { useRatings } from "@/lib/ratings/useRatings";
import { SwapSuggest } from "./SwapSuggest";
import { Warnings } from "./Warnings";
import { detectChanges, prereqWarnings, snapshotKey, snapshotOf, type SectionSnapshot } from "@/lib/planner/warnings";
import { loadState } from "@/lib/roadmap/storage";
import { programRequirements } from "@/lib/roadmap/requirements";
import { passedCodes, passedEcts } from "@/lib/roadmap/progress";
import { Cart } from "./Cart";
import { CourseSearch } from "./CourseSearch";
import { Curriculum } from "./Curriculum";
import { NoSolution } from "./NoSolution";
import { placeMeetings, timeRange } from "./placed";
import { Tuning } from "./Preferences";
import { formatGap, ScheduleStrip } from "./ScheduleStrip";
import { TermSelect } from "./TermSelect";
import { SectionSwitch } from "./SectionSwitch";
import { WeekGrid } from "./WeekGrid";
import { RegistrationPlan } from "./RegistrationPlan";
import { ShuttlePanel } from "./ShuttlePanel";
import { ElectiveFinder } from "./ElectiveFinder";
import type { ShuttleData } from "@/lib/shuttle/types";

const STORAGE_KEY = "planlayici:";
const HIGHLIGHTERS = 6;
const LAYOUT_PAGE = 50;

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

const fmtScore = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1 });

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
  /** Çizelgedeki ders kutuları ders sayfasına bağlansın mı (sayfalar yalnızca varsayılan dönem için var). */
  coursePages?: boolean;
  /** Kampüs servis saatleri; yoksa servis paneli gösterilmez. */
  shuttle?: ShuttleData | null;
}

export function Planner({ term, programs, termOptions = [], coursePages = false, shuttle = null }: PlannerProps) {
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
  // Sepeti boşaltmadan önceki hâl; "Geri al" için. Yeni ders eklenince unutulur.
  const [cleared, setCleared] = useState<Pick<PlannerState, "cart" | "locked" | "excluded" | "picks"> | null>(null);
  const [layoutLimit, setLayoutLimit] = useState(LAYOUT_PAGE);
  // Hoca puanına göre seçim iki adımda olur: önce düzen değişir, seçenekler gelince şubeler ayarlanır.
  const [tuneToTeachers, setTuneToTeachers] = useState(false);
  // Sepetten çıkarılan son ders: boşalan saate ne sığdığını gösterir.
  const [swapped, setSwapped] = useState<string | null>(null);
  // Bir önceki ziyaretteki şube bilgileri ve yol haritasındaki geçilen dersler (yalnızca tarayıcıda).
  const [snapshot, setSnapshot] = useState<SectionSnapshot[] | null>(null);
  const [passed, setPassed] = useState<{ codes: Set<string>; ects: number }>({ codes: new Set(), ects: 0 });

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

  // Yol haritasındaki işaretler ve önceki ziyaretin şube bilgileri: ikisi de yalnızca tarayıcıda.
  useEffect(() => {
    if (!programs) return;
    const state = loadState();
    const chosen = [state.anadal, state.cap]
      .map((id, i) => {
        const program = id ? programs.programs.find((p) => p.id === id) : null;
        return program ? programRequirements(program, i === 0 ? "anadal" : "cap") : null;
      })
      .filter((p) => p !== null);
     
    setPassed({ codes: passedCodes(chosen, state.completion), ects: passedEcts(chosen, state.completion) });
  }, [programs]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(snapshotKey(term.schoolId, term.termId));
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const sections = parsed && typeof parsed === "object" && Array.isArray((parsed as { sections?: unknown }).sections)
        ? ((parsed as { sections: SectionSnapshot[] }).sections)
        : [];
       
      setSnapshot(sections);
    } catch {
      setSnapshot([]);
    }
  }, [term.schoolId, term.termId]);

  const { summaries } = useRatings(term.schoolId);
  const scoreOf = useMemo(() => scoreLookup(summaries?.instructors), [summaries]);

  const colorOf = (code: string) => Math.max(0, state.cart.indexOf(code)) % HIGHLIGHTERS;
  const update = (patch: Partial<PlannerState>) => {
    setLayoutLimit(LAYOUT_PAGE);
    setState((s) => ({ ...s, selected: 0, ...patch }));
  };

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
  // Linkten gelen düzen sırası ilk sayfanın dışındaysa o düzene kadar yükle.
  const limit = Math.max(layoutLimit, Math.ceil((state.selected + 1) / LAYOUT_PAGE) * LAYOUT_PAGE);
  const { result, pending } = useSchedules(ready && hasTimes ? input : null, { layoutLimit: limit, layout: state.selected });

  const layouts = useMemo(() => result?.layouts ?? [], [result]);
  const layoutCount = result?.layoutCount ?? 0;
  const selectedLayout = Math.min(state.selected, Math.max(0, layouts.length - 1));
  // Başka bir düzene geçildiğinde işçinin cevabı gelene kadar eski düzenin şubeleri kullanılmaz.
  const alternatives = result && result.layout === selectedLayout ? result.alternatives : {};
  const best = layouts[selectedLayout]?.best;
  // Elle seçilen şube bu düzende aynı saatteyse onu kullan; saatler aynı olduğu için özet değişmez.
  const current = best && {
    ...best,
    sections: best.sections.map((r) =>
      alternatives[r.courseCode]?.includes(state.picks[r.courseCode]) ? { ...r, sectionId: state.picks[r.courseCode] } : r,
    ),
  };
  const groupRank = selectedLayout + 1;
  const cartSections: SectionRef[] = state.cart.flatMap((code) =>
    (courses.get(code)?.sections ?? []).map((s) => ({ courseCode: code, sectionId: s.id })),
  );
  // Cumartesi/Pazar sütunu yalnızca sepetteki bir şube o gün ders yapıyorsa görünür.
  const days = visibleDays(
    cartSections.flatMap(
      (r) => courses.get(r.courseCode)?.sections.find((s) => s.id === r.sectionId)?.meetings ?? [],
    ),
  );
  const teacherScore = current ? scheduleScore(current.sections, courses, scoreOf) : { score: null, known: 0 };
  // Puanı bilinen en az bir hoca varsa düğme çalışır.
  const canTune = layouts.some((l) => scheduleScore(l.best.sections, courses, scoreOf).score !== null);

  function tuneTeachers() {
    if (!canTune) return;
    let bestIndex = selectedLayout;
    let best = -1;
    layouts.forEach((layout, i) => {
      const { score } = scheduleScore(layout.best.sections, courses, scoreOf);
      if (score !== null && score > best) {
        best = score;
        bestIndex = i;
      }
    });
    const before = teacherScore.score;
    setTuneToTeachers(true);
    setState((s) => ({ ...s, selected: bestIndex, picks: {} }));
    setNote(before === null ? "Hoca puanı en yüksek program seçiliyor." : `Hoca puanı ${fmtScore(before)} idi, en iyisi aranıyor.`);
  }

  // Yeni düzenin şube seçenekleri gelince en iyi hocaları seç.
  useEffect(() => {
    if (!tuneToTeachers || !best || !result || result.layout !== selectedLayout) return;
    const picks = bestPicks(best.sections, result.alternatives, courses, scoreOf);
    const after = scheduleScore(
      best.sections.map((r) => (picks[r.courseCode] ? { ...r, sectionId: picks[r.courseCode] } : r)),
      courses,
      scoreOf,
    );
    setTuneToTeachers(false);
    setState((s) => ({ ...s, picks }));
    setNote(
      after.score === null
        ? "Bu derslerin hocaları için henüz puan yok."
        : `Hoca puanı en yüksek program seçildi: ${fmtScore(after.score)}/5 (${after.known} ders).`,
    );
  }, [tuneToTeachers, best, result, selectedLayout, courses, scoreOf]);

  const changes = snapshot ? detectChanges(snapshot, courses, state.cart) : [];
  const prereqs = prereqWarnings(state.cart, courses, passed.codes, passed.ects);

  // Sepete yeni giren şubelerin bugünkü hâli ize eklenir; var olan kayıtlara dokunulmaz.
  const currentSnapshot = current ? snapshotOf(current.sections, courses) : [];
  const snapshotJson = JSON.stringify(currentSnapshot);
  useEffect(() => {
    if (snapshot === null || !ready || currentSnapshot.length === 0) return;
    const known = new Set(snapshot.map((s) => `${s.code}.${s.sectionId}`));
    const fresh = currentSnapshot.filter((s) => !known.has(`${s.code}.${s.sectionId}`));
    if (fresh.length === 0) return;
    const merged = [...snapshot, ...fresh];
    setSnapshot(merged);
    writeStorage(
      snapshotKey(term.schoolId, term.termId),
      JSON.stringify({ v: 1, termId: term.termId, savedAt: new Date().toISOString(), sections: merged }),
    );
    // currentSnapshot içeriği snapshotJson ile temsil ediliyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotJson, snapshot, ready, term.schoolId, term.termId]);

  function forgetChanges() {
    const merged = snapshotOf(current?.sections ?? [], courses);
    setSnapshot(merged);
    writeStorage(
      snapshotKey(term.schoolId, term.termId),
      JSON.stringify({ v: 1, termId: term.termId, savedAt: new Date().toISOString(), sections: merged }),
    );
    setNote("Değişiklikler okundu.");
  }

  const placed = current ? placeMeetings(current.sections, courses, colorOf) : [];
  const range = timeRange(placed);

  function addCourse(code: string) {
    setCleared(null);
    setSwapped(null);
    const course = courses.get(code);
    if (!course || state.cart.includes(code)) return;
    const withCoreqs = expandCorequisites([course], term.courses).map((c) => c.code);
    const added = withCoreqs.filter((c) => !state.cart.includes(c));
    update({ cart: [...state.cart, ...added] });
    const extra = added.filter((c) => c !== code);
    setNote(extra.length ? `${code} ile birlikte alınması gereken ${extra.join(", ")} da eklendi.` : `${code} eklendi.`);
  }

  function addCourses(codes: string[]) {
    setCleared(null);
    update({ cart: [...state.cart, ...codes.filter((c) => !state.cart.includes(c))] });
  }

  function removeCourse(code: string) {
    setCleared(null);
    setSwapped(code);
    // Yan koşullu dersler birlikte alınır; biri çıkarılınca öteki de sepetten çıkar.
    const course = courses.get(code);
    const linked = course ? expandCorequisites([course], term.courses).map((c) => c.code) : [code];
    const gone = state.cart.filter((c) => linked.includes(c));
    const locked = { ...state.locked };
    for (const c of gone) delete locked[c];
    update({
      cart: state.cart.filter((c) => !gone.includes(c)),
      locked,
      excluded: state.excluded.filter((e) => !gone.includes(e.courseCode)),
    });
    const extra = gone.filter((c) => c !== code);
    setNote(extra.length ? `${code} ve birlikte alınan ${extra.join(", ")} çıkarıldı.` : `${code} çıkarıldı.`);
  }

  /** Öneri bir ya da iki ayarı birlikte gevşetir; hepsi tek durum güncellemesinde uygulanır. */
  function applySuggestion(constraints: readonly RelaxedConstraint[]) {
    let { freeDays, excluded } = state;
    const locked = { ...state.locked };
    for (const c of constraints) {
      if (c.kind === "freeDay") freeDays = freeDays.filter((d) => d !== c.day);
      if (c.kind === "lock") delete locked[c.courseCode];
      if (c.kind === "exclusion") {
        excluded = excluded.filter((e) => !(e.courseCode === c.courseCode && e.sectionId === c.sectionId));
      }
    }
    update({ freeDays, locked, excluded });
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
    const calendar = OZYEGIN_CALENDAR[term.termId];
    const ics = buildIcs(current.sections, courses, calendar ? { kind: "calendar", calendar } : { kind: "weeks", firstMonday: nextMonday() });
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `program-${term.termId}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    const fmt = (d: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00`));
    setNote(
      calendar
        ? `Takvim dosyası indirildi. Dersler ${fmt(calendar.start)}–${fmt(calendar.end)} arasında tekrar eder; tatiller atlandı, telafi günleri eklendi.`
        : "Takvim dosyası indirildi. Dersler önümüzdeki Pazartesiden itibaren 14 hafta tekrar eder.",
    );
  }

  async function downloadImage() {
    if (!current) return;
    setNote("Görsel hazırlanıyor.");
    try {
      const image = buildScheduleSvg({
        meetings: placed,
        days,
        freeDays: state.freeDays,
        termLabel: term.termLabel,
        title: `${groupRank}. program`,
        summary: current.summary,
      });
      const how = await savePng(image, imageFileName(term.termId), `${term.termLabel} ders programım`);
      setNote(
        how === "share"
          ? "Paylaşım penceresi açıldı. Oradan “Görseli Kaydet” dersen telefonun galerisine düşer."
          : how === "download"
            ? "Görsel indirildi."
            : "Görsel yeni sekmede açıldı. Üzerine basılı tutup kaydedebilirsin.",
      );
    } catch {
      setNote("Görsel oluşturulamadı.");
    }
  }

  const status = !ready
    ? ""
    : state.cart.length === 0
      ? ""
      : pending && !result
        ? "Programlar hesaplanıyor"
        : !result || result.total === 0
          ? ""
          : `${result.truncated ? `${result.total.toLocaleString("tr-TR")}'den fazla` : result.total.toLocaleString("tr-TR")} çakışmasız program${
              layoutCount < result.total ? `, ${layoutCount.toLocaleString("tr-TR")} farklı haftalık düzen` : " bulundu"
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
          onClear={() => {
            setCleared({ cart: state.cart, locked: state.locked, excluded: state.excluded, picks: state.picks });
            update({ cart: [], locked: {}, excluded: [], picks: {} });
            setNote("Sepet boşaltıldı.");
          }}
          onUndoClear={
            cleared
              ? () => {
                  update(cleared);
                  setCleared(null);
                  setNote("Sepet geri getirildi.");
                }
              : undefined
          }
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

        {(layouts.length > 1 || layoutCount > layouts.length) && (
          <ScheduleStrip
            layouts={layouts}
            layoutCount={layoutCount}
            selected={selectedLayout}
            onSelect={(i) => setState((s) => ({ ...s, selected: i }))}
            onMore={() => setLayoutLimit(limit + LAYOUT_PAGE)}
            courses={courses}
            colorOf={colorOf}
            days={days}
          />
        )}

        {result && result.total === 0 && state.cart.length > 0 && (
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
              {teacherScore.score !== null && (
                <div className="fact">
                  <dt>Hoca puanı</dt>
                  <dd className="num">{fmtScore(teacherScore.score)}/5</dd>
                </div>
              )}
            </dl>
            <div className="actions">
              {canTune && (
                <button type="button" className="btn btn-pen" onClick={tuneTeachers}>
                  Hoca puanına göre seç
                </button>
              )}
              <button type="button" className="btn" onClick={copyLink}>
                Linki kopyala
              </button>
              <button type="button" className="btn" onClick={downloadIcs}>
                Takvime ekle
              </button>
              <button type="button" className="btn" onClick={downloadImage}>
                Görsel kaydet
              </button>
            </div>
          </div>
        )}

        <Warnings changes={changes} prereqs={prereqs} onSeen={forgetChanges} />

        {swapped && programs && (
          <SwapSuggest
            school={term.schoolId}
            removed={swapped}
            programs={programs.programs}
            programId={state.program}
            courses={term.courses}
            meetings={placed}
            cart={state.cart}
            freeDays={state.freeDays}
            onAdd={addCourse}
            onUndo={() => {
              addCourse(swapped);
              setSwapped(null);
            }}
            onClose={() => setSwapped(null)}
          />
        )}

        <RegistrationPlan input={input} current={current} courses={courses} colorOf={colorOf} termLabel={term.termLabel} />
        {shuttle && current && <ShuttlePanel data={shuttle} meetings={placed} />}
        {programs && current && (
          <ElectiveFinder
            programs={programs.programs}
            programId={state.program}
            courses={term.courses}
            meetings={placed}
            cart={state.cart}
            freeDays={state.freeDays}
            days={days}
            onAdd={addCourse}
          />
        )}

        <WeekGrid
          hrefOf={
            coursePages
              ? (m) => {
                  const slug = courses.get(m.courseCode)?.slug;
                  return slug ? `/ozyegin/${slug}` : null;
                }
              : undefined
          }
          renderSection={(m) => {
            const ids = alternatives[m.courseCode];
            const course = courses.get(m.courseCode);
            if (!ids || ids.length < 2 || !course) return null;
            return (
              <SectionSwitch
                courseCode={m.courseCode}
                current={m.sectionId}
                options={ids.map((id) => course.sections.find((x) => x.id === id)!).filter(Boolean)}
                onPick={(id) => setState((s) => ({ ...s, picks: { ...s.picks, [m.courseCode]: id } }))}
              />
            );
          }}
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
