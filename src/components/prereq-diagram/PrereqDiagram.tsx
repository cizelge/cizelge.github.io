"use client";

// Ön şart diyagramı: fakülte ve program seçimi, üç kip (aldıklarım, alabileceklerim, zincir) ve işaretlerin saklanması.
// Yol haritasındaki anadal için işaretler yol haritasının kaydına yazılır; başka programlar ayrı bir kayıtta durur.
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { groupByFaculty } from "@/lib/planner/curriculum";
import { chainOf, takeable, toggleRow, toggleTaken, type Mode } from "@/lib/prereq-graph/chain-state";
import { completionFromMarks, marksFromCompletion, sameCompletion } from "@/lib/prereq-graph/roadmap-sync";
import { buildRowsModel, layoutRows } from "@/lib/prereq-graph/rows-layout";
import { loadState, saveState } from "@/lib/roadmap/storage";
import type { Program, TermData } from "@/lib/types";
import { DiagramCanvas, type ChainView } from "./DiagramCanvas";
import { ElectiveDialog, type PoolOption } from "./ElectiveDialog";

interface Props {
  programs: Program[];
  /** Yalnızca kod, ad, AKTS ve ön şart metniyle dönem verisi. */
  terms: TermData[];
}

const OWN_KEY = "on-sart:ozyegin";
const MIN_WIDTH = 720;

interface OwnState {
  programId: string;
  taken: string[];
  choices: Record<string, string>;
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  {
    id: "taken",
    label: "Aldığım dersler",
    hint: "Aldığın derse dokun, ön şartları da işaretlenir. Dönemin adına dokununca bütün dönem işaretlenir.",
  },
  {
    id: "plan",
    label: "Alabileceğim dersler",
    hint: "Ön şartı tamam olan dersler açık renkte. Bu dönem alacaklarına eklemek için dokun.",
  },
  {
    id: "chain",
    label: "Zinciri gör",
    hint: "Bir derse dokun, açtığı bütün dersler öne çıkar. Aynı derse yeniden dokununca temizlenir.",
  },
];

function loadOwn(): OwnState | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(OWN_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.programId !== "string" || !Array.isArray(r.taken)) return null;
    const taken = r.taken.filter((x): x is string => typeof x === "string");
    const choices: Record<string, string> = {};
    if (typeof r.choices === "object" && r.choices !== null) {
      for (const [k, v] of Object.entries(r.choices)) if (typeof v === "string" && v) choices[k] = v;
    }
    return { programId: r.programId, taken, choices };
  } catch {
    return null;
  }
}

function saveOwn(state: OwnState) {
  try {
    window.localStorage.setItem(OWN_KEY, JSON.stringify(state));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

/** Seçilen programın işaretleri: yol haritası anadalıysa oradan, değilse ayrı kayıttan. */
function marksFor(program: Program): { taken: Set<string>; choices: Record<string, string>; synced: boolean } {
  const roadmap = loadState();
  if (roadmap.anadal === program.id) {
    const marks = marksFromCompletion(program, roadmap.completion);
    return { taken: new Set(marks.taken), choices: marks.choices, synced: true };
  }
  const own = loadOwn();
  if (own && own.programId === program.id) return { taken: new Set(own.taken), choices: own.choices, synced: false };
  return { taken: new Set(), choices: {}, synced: false };
}

const compact = (code: string) => code.replace(/\s+/g, "");

export function PrereqDiagram({ programs, terms }: Props) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("taken");
  const [taken, setTaken] = useState<Set<string>>(() => new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [synced, setSynced] = useState(false);
  const [planned, setPlanned] = useState<Set<string>>(() => new Set());
  const [center, setCenter] = useState<string | null>(null);
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [width, setWidth] = useState(MIN_WIDTH);
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupByFaculty(programs), [programs]);
  const program = useMemo(() => programs.find((p) => p.id === programId) ?? null, [programs, programId]);
  const facultyPrograms = groups.find((g) => g.faculty === faculty)?.programs ?? [];

  const choose = useCallback((next: Program | null) => {
    setProgramId(next?.id ?? null);
    setPlanned(new Set());
    setCenter(null);
    setDialogFor(null);
    setNote("");
    if (!next) {
      setTaken(new Set());
      setChoices({});
      setSynced(false);
      return;
    }
    const marks = marksFor(next);
    setTaken(marks.taken);
    setChoices(marks.choices);
    setSynced(marks.synced);
  }, []);

  // Kayıt sunucuda yok: ilk çizim boş, sonra yol haritasının anadalı ya da son bakılan program açılır.
  useEffect(() => {
    const anadal = loadState().anadal;
    const lastId = anadal ?? loadOwn()?.programId ?? null;
    const initial = programs.find((p) => p.id === lastId) ?? null;
    /* eslint-disable react-hooks/set-state-in-effect -- kayıt yalnızca tarayıcıda bilinir */
    if (initial) {
      setFaculty(initial.faculty);
      choose(initial);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [programs, choose]);

  // Çizim genişliği kutuya uyar; dar ekranda en az MIN_WIDTH olur ve kutu yana kayar.
  const hasProgram = program !== null;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, hasProgram]);

  const model = useMemo(() => (program ? buildRowsModel(program, terms, choices) : null), [program, terms, choices]);
  const layout = useMemo(() => (model ? layoutRows(model, { width }) : null), [model, width]);
  const byId = useMemo(() => new Map((model?.nodes ?? []).map((n) => [n.id, n])), [model]);

  const canTake = useMemo(() => (model && mode === "plan" ? takeable(model, taken) : new Set<string>()), [model, mode, taken]);
  const plannedNow = useMemo(() => new Set([...planned].filter((p) => canTake.has(p))), [planned, canTake]);
  const chain = useMemo<ChainView | null>(() => {
    if (!model || mode !== "chain" || !center || !byId.has(center)) return null;
    return { center, ...chainOf(model, center) };
  }, [model, mode, center, byId]);

  // Seçmeli kutusundaki seçenekler: havuz ya da (serbest seçmelide) bütün dersler.
  const allCourses = useMemo<PoolOption[]>(() => {
    const seen = new Map<string, PoolOption>();
    for (const t of terms) for (const c of t.courses) seen.set(c.code, { code: c.code, title: c.title, credits: c.ects });
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code, "tr"));
  }, [terms]);
  const dialogNode = dialogFor ? (byId.get(dialogFor) ?? null) : null;
  const dialogLabel = dialogNode ? (electiveLabel(program, dialogNode.id) ?? dialogNode.title) : null;

  /** İşaretleri değiştirir ve saklar. */
  function commit(nextTaken: Set<string>, nextChoices: Record<string, string>) {
    setTaken(nextTaken);
    setChoices(nextChoices);
    if (!program) return;
    const marks = { taken: [...nextTaken], choices: nextChoices };
    const roadmap = loadState();
    if (roadmap.anadal === program.id) {
      const completion = completionFromMarks(program, roadmap.completion, marks);
      if (!sameCompletion(completion, roadmap.completion)) saveState({ ...roadmap, completion });
      setSynced(true);
    } else {
      saveOwn({ programId: program.id, ...marks });
      setSynced(false);
    }
  }

  const nameOf = (nodeId: string) => {
    const n = byId.get(nodeId);
    return n ? (n.code ?? n.title) : nodeId;
  };

  function onNode(nodeId: string) {
    const node = byId.get(nodeId);
    if (!model || !node) return;
    if (node.kind === "elective" && node.code === null && mode !== "plan") {
      setDialogFor(nodeId);
      return;
    }
    if (mode === "taken") {
      const next = toggleTaken(model, taken, nodeId);
      const added = next.size - taken.size;
      commit(next, choices);
      setNote(
        next.has(nodeId)
          ? `${nameOf(nodeId)} alındı olarak işaretlendi${added > 1 ? `, ${added - 1} ön şartıyla birlikte` : ""}.`
          : `${nameOf(nodeId)} işareti kaldırıldı${taken.size - next.size > 1 ? `, ona dayanan ${taken.size - next.size - 1} dersle birlikte` : ""}.`,
      );
    } else if (mode === "plan") {
      if (node.kind === "elective" && node.code === null) {
        setDialogFor(nodeId);
        return;
      }
      if (!canTake.has(nodeId)) {
        setNote(taken.has(nodeId) ? `${nameOf(nodeId)} zaten alındı.` : `${nameOf(nodeId)} için ön şartlar henüz tamam değil.`);
        return;
      }
      const next = new Set(plannedNow);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      setPlanned(next);
      setNote(next.has(nodeId) ? `${nameOf(nodeId)} bu dönem alacaklarına eklendi.` : `${nameOf(nodeId)} listeden çıkarıldı.`);
    } else {
      const next = center === nodeId ? null : nodeId;
      setCenter(next);
      setNote(next ? `${nameOf(nodeId)} zinciri gösteriliyor.` : "Zincir temizlendi.");
    }
  }

  function onRow(rowKey: string) {
    if (!model || mode !== "taken") return;
    const next = toggleRow(model, taken, rowKey);
    commit(next, choices);
    const label = model.rows.find((r) => r.key === rowKey)?.label ?? "";
    setNote(next.size >= taken.size ? `${label} dersleri alındı olarak işaretlendi.` : `${label} işaretleri kaldırıldı.`);
  }

  const plannedList = [...plannedNow]
    .map((p) => byId.get(p))
    .filter((n): n is NonNullable<typeof n> => !!n && n.code !== null);
  const plannedEcts = plannedList.reduce((sum, n) => sum + (n.credits ?? 0), 0);
  const plannerHref = `/ozyegin?d=${plannedList.map((n) => compact(n.code!)).join(",")}`;
  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <main
      id="icerik"
      className="osd"
      onKeyDown={(e) => {
        if (e.key === "Escape" && center && !dialogFor) setCenter(null);
      }}
    >
      <header className="osd-head">
        <h1 className="board-title">Ön şart diyagramı</h1>
        <p className="hint osd-lede">
          Programının derslerini dönem dönem gör. Çizgiler hangi dersin hangisine ön şart olduğunu gösterir.
        </p>
        {synced && program && <p className="hint osd-synced">İşaretlerin yol haritasıyla ortak.</p>}
      </header>

      <div className="osd-controls">
        <label className="field osd-field">
          <span className="field-label">Fakülte</span>
          <select
            className="select"
            value={faculty ?? ""}
            onChange={(e) => {
              const next = e.target.value || null;
              setFaculty(next);
              const list = groups.find((g) => g.faculty === next)?.programs ?? [];
              if (!program || program.faculty !== next) choose(list.length === 1 ? list[0] : null);
            }}
          >
            <option value="">Fakülte seç</option>
            {groups.map((g) => (
              <option key={g.faculty} value={g.faculty}>
                {g.faculty}
              </option>
            ))}
          </select>
        </label>
        <label className="field osd-field">
          <span className="field-label">Program</span>
          <select
            className="select"
            value={programId ?? ""}
            disabled={!faculty}
            onChange={(e) => choose(programs.find((p) => p.id === e.target.value) ?? null)}
          >
            <option value="">Program seç</option>
            {facultyPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {note}
      </p>

      {!ready ? null : !program || !model || !layout ? (
        <p className="hint osd-empty">Fakülteni ve programını seç, diyagram hemen çizilir.</p>
      ) : (
        <section className="osd-stage" aria-labelledby={`${id}-mode`}>
          <div className="osd-toolbar">
            <div className="chips" role="group" aria-label="Kip" id={`${id}-mode`}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="chip"
                  aria-pressed={mode === m.id}
                  onClick={() => {
                    setMode(m.id);
                    setCenter(null);
                    setNote("");
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="hint osd-mode-hint">{activeMode.hint}</p>
          </div>

          <ul className="osd-legend">
            {mode !== "chain" && (
              <li>
                <span className="osd-key osd-key-taken" aria-hidden="true">
                  ✓
                </span>
                Alındı
              </li>
            )}
            {mode === "plan" && (
              <>
                <li>
                  <span className="osd-key osd-key-takeable" aria-hidden="true" />
                  Alabilirsin
                </li>
                <li>
                  <span className="osd-key osd-key-planned" aria-hidden="true">
                    +
                  </span>
                  Bu dönem alacakların
                </li>
              </>
            )}
            {mode === "chain" && (
              <>
                <li>
                  <span className="osd-key osd-key-center" aria-hidden="true" />
                  Seçtiğin ders
                </li>
                <li>
                  <span className="osd-key osd-key-down" aria-hidden="true" />
                  Açtığı dersler
                </li>
                <li>
                  <span className="osd-key osd-key-up" aria-hidden="true" />
                  Ön şartları
                </li>
              </>
            )}
            <li>
              <span className="osd-key osd-key-elective" aria-hidden="true" />
              Seçmeli, dokununca ders seçilir
            </li>
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="27" y2="5" className="osd-key-line is-or" />
              </svg>
              Kesik çizgi: seçeneklerden biri yeter
            </li>
          </ul>

          {mode === "plan" && (
            <div className="osd-plan" aria-live="polite">
              {plannedList.length === 0 ? (
                <p className="hint">Bu dönem alacağın dersleri diyagramdan seç.</p>
              ) : (
                <>
                  <p className="osd-plan-title">
                    Bu dönem alacakların <span className="hint num">{plannedList.length} ders, {plannedEcts} AKTS</span>
                  </p>
                  <ul className="osd-plan-list">
                    {plannedList.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="chip"
                          aria-label={`${n.code} listeden çıkar`}
                          onClick={() => onNode(n.id)}
                        >
                          {n.code} <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="osd-plan-actions">
                    <Link href={plannerHref} className="btn btn-pen btn-small">
                      Planlayıcıda aç
                    </Link>
                    <button type="button" className="btn btn-small btn-quiet" onClick={() => setPlanned(new Set())}>
                      Listeyi temizle
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {model.nodes.length === 0 ? (
            <p className="hint">Bu programın müfredatında gösterilecek ders yok.</p>
          ) : (
            <div className="osd-scroll" ref={scrollRef}>
              <DiagramCanvas
                model={model}
                layout={layout}
                mode={mode}
                taken={taken}
                takeable={canTake}
                planned={plannedNow}
                chain={chain}
                label={`${program.name} ön şart diyagramı, ${model.nodes.length} ders`}
                onNode={onNode}
                onChangeElective={setDialogFor}
                onRow={onRow}
              />
            </div>
          )}
          {model.edges.length === 0 && model.nodes.length > 0 && (
            <p className="hint">Bu programın dersleri arasında ön şart bağı bulunamadı.</p>
          )}
        </section>
      )}

      <ElectiveDialog
        label={dialogLabel}
        options={dialogNode?.pool ?? allCourses}
        free={!!dialogNode && dialogNode.pool === null}
        current={dialogFor ? (choices[dialogFor] ?? null) : null}
        taken={mode === "taken" && dialogFor ? taken.has(dialogFor) : null}
        onPick={(code) => {
          if (!dialogFor) return;
          commit(taken, { ...choices, [dialogFor]: code });
          setNote(`${code} seçildi.`);
        }}
        onClear={() => {
          if (!dialogFor) return;
          const next = { ...choices };
          delete next[dialogFor];
          commit(taken, next);
          setNote("Seçim kaldırıldı.");
        }}
        onToggleTaken={() => {
          if (!dialogFor || !model) return;
          commit(toggleTaken(model, taken, dialogFor), choices);
        }}
        onClose={() => setDialogFor(null)}
      />
    </main>
  );
}

/** Seçmeli gereksinim id'sinden müfredattaki etiket ("BSCS:y3-guz:4" -> "BSCS Program-İçi Seçmeli"). */
function electiveLabel(program: Program | null, reqId: string): string | null {
  if (!program) return null;
  const m = reqId.match(/:y(\d+)-(\w+):(\d+)$/);
  if (!m) return null;
  const sem = program.semesters.find((s) => s.year === Number(m[1]) && s.season === m[2]);
  const item = sem?.items[Number(m[3])];
  return item && item.kind === "elective" ? item.label : null;
}
