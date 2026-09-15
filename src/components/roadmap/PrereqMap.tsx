"use client";

// Program ön koşul haritası: müfredat dönemleri sütun, dersler kutu, ön koşullar ok.
// Bir derse dokununca önündeki ve arkasındaki dersler öne çıkar, ayrıntı altta yazılır.
import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ancestors, buildProgramGraph, descendants } from "@/lib/prereq-graph/graph";
import { layoutProgramGraph } from "@/lib/prereq-graph/layout";
import type { PrereqGraph } from "@/lib/prereq-graph/types";
import { hasCode } from "@/lib/roadmap/progress";
import { parseTermLabel, type TermSeason } from "@/lib/terms";
import type { Program, TermData } from "@/lib/types";
import {
  charsForWidth,
  codeKey,
  courseSlug,
  degreeCounts,
  directNeighbors,
  nodeAriaLabel,
  truncateLabel,
} from "./prereq-map-helpers";
import { KIND_HL, KIND_LABEL } from "./shared";

interface Props {
  anadal: Program;
  cap: Program | null;
  terms: TermData[];
  /** Geçilen dersler (kanonik kod). */
  passed: ReadonlySet<string>;
  /** Kalan başka dersleri bekleten dersler. */
  criticalCodes: readonly string[];
  /** Şu anki dönem: ders sayfası yalnızca bu dönemde açılan dersler için var. */
  current: { startYear: number; season: TermSeason };
}

const NODE_W = 156;
const NODE_H = 48;
const CODE_SIZE = 13;
const TITLE_SIZE = 11.5;
const PAD = 10;
const MARK_R = 7;

type Which = "anadal" | "cap";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PrereqMap({ anadal, cap, terms, passed, criticalCodes, current }: Props) {
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState<Which>("anadal");
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const kind: Which = which === "cap" && cap ? "cap" : "anadal";
  const program = kind === "cap" && cap ? cap : anadal;

  // Ders sayfası derlemede yalnızca şu anki dönemin dersleri için üretilir.
  const pageCodes = useMemo(() => {
    const term = terms.find((t) => {
      try {
        const info = parseTermLabel(t.termLabel);
        return info.startYear === current.startYear && info.season === current.season;
      } catch {
        return false;
      }
    });
    return new Set((term?.courses ?? []).map((c) => codeKey(c.code)));
  }, [terms, current.startYear, current.season]);

  // Kapalıyken hesap yapılmaz: sayfa ilk açılışta hafif kalır.
  const graph = useMemo<PrereqGraph | null>(() => (open ? buildProgramGraph(program, terms) : null), [open, program, terms]);
  const layout = useMemo(
    () => (graph ? layoutProgramGraph(graph, { nodeWidth: NODE_W, nodeHeight: NODE_H, colGap: 56, rowGap: 12 }) : null),
    [graph],
  );
  const degrees = useMemo(() => (graph ? degreeCounts(graph) : new Map()), [graph]);
  const critical = useMemo(() => new Set(criticalCodes.map(codeKey)), [criticalCodes]);

  const active = selected && graph?.nodes.has(selected) ? selected : null;
  const related = useMemo(() => {
    if (!graph || !active) return null;
    const up = ancestors(graph, active);
    const down = descendants(graph, active);
    return { up, down, all: new Set([active, ...up, ...down]) };
  }, [graph, active]);

  const hl = KIND_HL[kind];
  const titleChars = charsForWidth(NODE_W, TITLE_SIZE, PAD);
  const codeChars = charsForWidth(NODE_W - 2 * MARK_R - 6, CODE_SIZE, PAD);

  function select(code: string | null, reveal = false) {
    setSelected((prev) => (code !== null && prev === code && !reveal ? null : code));
    if (code && reveal) {
      // Seçim listeden yapıldıysa kutu görünür alana kaydırılır.
      requestAnimationFrame(() => {
        const el = svgRef.current?.querySelector<SVGGElement>(`[data-code="${CSS.escape(code)}"]`);
        el?.scrollIntoView({ block: "nearest", inline: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      });
    }
  }

  function onNodeKey(e: KeyboardEvent<SVGGElement>, code: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(code);
    }
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && selected) {
      e.stopPropagation();
      setSelected(null);
    }
  }

  const isPassed = (code: string) => hasCode(passed, code);
  const titleOf = (code: string) => graph?.nodes.get(code)?.title ?? "";

  const selectedNode = active && graph ? graph.nodes.get(active)! : null;
  const neighbors = active && graph ? directNeighbors(graph.edges, active) : null;

  // Seçim listesi için sütun sırası.
  const groups = useMemo(() => {
    if (!layout || !graph) return [];
    const byX = new Map<number, string[]>();
    for (const n of [...layout.nodes].sort((a, b) => a.x - b.x || a.y - b.y)) {
      const list = byX.get(n.x) ?? [];
      list.push(n.code);
      byX.set(n.x, list);
    }
    return layout.columns.map((c) => ({ key: c.key, label: c.label, codes: byX.get(c.x) ?? [] }));
  }, [layout, graph]);

  return (
    <details className="pm" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="pm-summary">
        <h2 className="group-title rm-h2 pm-title">Ön koşul haritası</h2>
        <span className="hint pm-summary-hint">Hangi ders hangisinin önünü açıyor</span>
      </summary>

      {open && graph && layout && (
        <div className="pm-body" onKeyDown={onKey}>
          <p className="pm-link">
            <Link href="/ozyegin/on-sart-diyagrami" className="link">
              Tam ekran ön şart diyagramı
            </Link>
          </p>
          {cap && (
            <div className="chips pm-switch" role="group" aria-label="Program">
              {(["anadal", "cap"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="chip"
                  aria-pressed={kind === k}
                  onClick={() => {
                    setWhich(k);
                    setSelected(null);
                  }}
                >
                  <span className={`rm-swatch hl-${KIND_HL[k]}`} aria-hidden="true" />
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          )}

          <ul className="pm-legend">
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="27" y2="5" className="pm-key-line" />
              </svg>
              Düz çizgi: gerekli
            </li>
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="27" y2="5" className="pm-key-line is-or" />
              </svg>
              Kesik çizgi: seçeneklerden biri yeter
            </li>
            <li>
              <span className={`pm-key-box hl-${hl}`} aria-hidden="true">
                ✓
              </span>
              Geçtin
            </li>
            <li>
              <span className="pm-key-mark" aria-hidden="true">
                !
              </span>
              Kritik
            </li>
            <li>
              <span className="pm-key-mark is-unknown" aria-hidden="true">
                ?
              </span>
              Koşulu SIS&apos;ten kontrol et
            </li>
          </ul>

          {graph.nodes.size === 0 ? (
            <p className="hint">Bu programda haritada gösterilecek ders yok.</p>
          ) : (
            <>
              {graph.edges.length === 0 && (
                <p className="hint">Bu programın dersleri arasında ön koşul bağı bulunamadı.</p>
              )}

              <label className="field pm-picker">
                <span className="field-label">Bir ders seç</span>
                <select
                  className="select"
                  value={active ?? ""}
                  onChange={(e) => select(e.target.value || null, true)}
                >
                  <option value="">Seçim yok</option>
                  {groups.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.codes.map((code) => (
                        <option key={code} value={code}>
                          {code} {titleOf(code)}
                          {isPassed(code) ? " (geçtin)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="pm-scroll">
                <svg
                  ref={svgRef}
                  className={`pm-svg hl-${hl}`}
                  width={layout.width + 8}
                  height={layout.height + 8}
                  viewBox={`-4 -4 ${layout.width + 8} ${layout.height + 8}`}
                  role="group"
                  aria-label={`${program.name} ön koşul haritası, ${graph.nodes.size} ders`}
                  data-selecting={related ? "" : undefined}
                >
                  <defs>
                    <marker
                      id={`${uid}-arrow`}
                      viewBox="0 0 8 8"
                      refX="7.5"
                      refY="4"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,0.5 L8,4 L0,7.5 z" className="pm-arrow" />
                    </marker>
                    <marker
                      id={`${uid}-arrow-on`}
                      viewBox="0 0 8 8"
                      refX="7.5"
                      refY="4"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,0.5 L8,4 L0,7.5 z" className="pm-arrow is-on" />
                    </marker>
                  </defs>

                  <g aria-hidden="true">
                    {layout.columns.map((c) => (
                      <text key={c.key} x={c.x} y={16} className="pm-col-label">
                        {c.label}
                      </text>
                    ))}
                  </g>

                  <g aria-hidden="true">
                    {layout.edges.map((e, i) => {
                      const on = !!related && related.all.has(e.from) && related.all.has(e.to);
                      return (
                        <path
                          key={`${e.from}>${e.to}>${i}`}
                          d={e.path}
                          className={`pm-edge${e.kind === "or" ? " is-or" : ""}${on ? " is-on" : ""}`}
                          markerEnd={`url(#${uid}-arrow${on ? "-on" : ""})`}
                        />
                      );
                    })}
                  </g>

                  {layout.nodes.map((n) => {
                    const node = graph.nodes.get(n.code);
                    if (!node) return null;
                    const done = isPassed(n.code);
                    const crit = critical.has(codeKey(n.code));
                    const deg = degrees.get(n.code) ?? { prereqs: 0, unlocks: 0 };
                    const isSel = active === n.code;
                    const dim = !!related && !related.all.has(n.code);
                    const marks = [crit ? "!" : null, node.unreadable ? "?" : null].filter(Boolean) as string[];
                    const cls = [
                      "pm-node",
                      done ? "is-passed" : "is-remaining",
                      crit ? "is-critical" : "",
                      isSel ? "is-selected" : "",
                      dim ? "is-dim" : "",
                      related && !isSel && related.up.has(n.code) ? "is-up" : "",
                      related && !isSel && related.down.has(n.code) ? "is-down" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const codeText = truncateLabel(`${n.code}${done ? " ✓" : ""}`, codeChars);
                    return (
                      <g
                        key={n.code}
                        data-code={n.code}
                        className={cls}
                        transform={`translate(${n.x},${n.y})`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSel}
                        aria-label={nodeAriaLabel({
                          code: n.code,
                          title: node.title,
                          status: done ? "passed" : "remaining",
                          prereqCount: deg.prereqs,
                          unlockCount: deg.unlocks,
                          critical: crit,
                          unreadable: node.unreadable,
                        })}
                        onClick={() => select(n.code)}
                        onKeyDown={(e) => onNodeKey(e, n.code)}
                      >
                        <title>{`${n.code} ${node.title}`.trim()}</title>
                        <rect className="pm-focus" x={-4} y={-4} width={n.w + 8} height={n.h + 8} rx={11} />
                        <rect className="pm-box" x={0} y={0} width={n.w} height={n.h} rx={8} />
                        <text x={PAD} y={19} className="pm-code">
                          {codeText}
                        </text>
                        <text x={PAD} y={36} className="pm-name">
                          {truncateLabel(node.title, titleChars)}
                        </text>
                        {marks.map((m, i) => (
                          <g
                            key={m}
                            className={`pm-mark${m === "?" ? " is-unknown" : ""}`}
                            transform={`translate(${n.w - MARK_R - 4 - i * (2 * MARK_R + 3)},${MARK_R + 4})`}
                          >
                            <circle r={MARK_R} />
                            <text y={4} textAnchor="middle">
                              {m}
                            </text>
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="pm-detail" aria-live="polite">
                {!selectedNode || !neighbors ? (
                  <p className="hint">Bir derse dokun: önündeki ve arkasındaki dersler öne çıkar. Esc seçimi kaldırır.</p>
                ) : (
                  <>
                    <div className="pm-detail-head">
                      <h3 className="rm-h3">
                        <span className="num">{selectedNode.code}</span> {selectedNode.title}
                      </h3>
                      <span className="pm-status">{isPassed(selectedNode.code) ? "✓ Geçtin" : "Kalan"}</span>
                      {critical.has(codeKey(selectedNode.code)) && <span className="pm-status">! Kritik</span>}
                      <button type="button" className="btn btn-small btn-quiet pm-clear" onClick={() => setSelected(null)}>
                        Seçimi kaldır
                      </button>
                    </div>

                    <dl className="pm-facts">
                      <div>
                        <dt>Ön koşul metni</dt>
                        <dd>
                          {selectedNode.prerequisiteText || "Ön koşulu yok."}
                          {selectedNode.unreadable && (
                            <span className="hint"> ? Bir kısmı okunamadı, SIS&apos;ten kontrol et.</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Önce</dt>
                        <dd>
                          <NeighborList
                            items={neighbors.requires}
                            empty="Bu programda önünde ders yok."
                            onPick={(c) => select(c, true)}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Sonra açılır</dt>
                        <dd>
                          <NeighborList
                            items={neighbors.unlocks}
                            empty="Bu programda başka dersin önünü açmıyor."
                            onPick={(c) => select(c, true)}
                          />
                        </dd>
                      </div>
                      {selectedNode.minEcts !== null && (
                        <div>
                          <dt>AKTS şartı</dt>
                          <dd className="num">En az {selectedNode.minEcts} AKTS</dd>
                        </div>
                      )}
                    </dl>

                    {pageCodes.has(codeKey(selectedNode.code)) && (
                      <p className="pm-link">
                        <Link className="link" href={`/ozyegin/${courseSlug(selectedNode.code)}`}>
                          {selectedNode.code} ders sayfası
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
}

function NeighborList({
  items,
  empty,
  onPick,
}: {
  items: { code: string; kind: "and" | "or"; group?: number | null }[];
  empty: string;
  onPick: (code: string) => void;
}) {
  if (items.length === 0) return <span className="hint">{empty}</span>;
  const must = items.filter((i) => i.kind === "and");
  // Her seçenek grubu ayrı: "(A ya da B) ve (C ya da D)" iki gruptan birer ders demek.
  const groups = new Map<string, typeof items>();
  for (const i of items) {
    if (i.kind !== "or") continue;
    const k = String(i.group ?? "?");
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const either = [...groups.values()];
  const button = (code: string) => (
    <button key={code} type="button" className="pm-jump num" onClick={() => onPick(code)}>
      {code}
    </button>
  );
  return (
    <span className="pm-neighbors">
      {must.length > 0 && <span className="pm-group">{must.map((i) => button(i.code))}</span>}
      {either.map((group, g) => (
        <span key={group[0].code} className="pm-group is-or">
          <span className="hint">{must.length > 0 || g > 0 ? "ve şunlardan biri:" : "Şunlardan biri:"}</span>
          {group.map((i, k) => (
            <span key={i.code} className="pm-or-item">
              {k > 0 && <span className="hint">ya da</span>}
              {button(i.code)}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
