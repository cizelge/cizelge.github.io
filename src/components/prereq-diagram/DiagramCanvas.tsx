"use client";

// Ön şart diyagramının SVG çizimi: dönem satırları, ders kutuları ve ön şart eğrileri.
// Durum hesaplamaz; ne gösterileceği PrereqDiagram'dan gelir.
import { Fragment, type KeyboardEvent } from "react";
import type { Mode } from "@/lib/prereq-graph/chain-state";
import type { RowNode, RowsLayout, RowsModel } from "@/lib/prereq-graph/rows";
import { charsForWidth, truncateLabel } from "@/components/roadmap/prereq-map-helpers";

export interface ChainView {
  center: string;
  ancestors: ReadonlySet<string>;
  descendants: ReadonlySet<string>;
  /** "from>to" */
  edges: ReadonlySet<string>;
}

interface Props {
  model: RowsModel;
  layout: RowsLayout;
  mode: Mode;
  taken: ReadonlySet<string>;
  takeable: ReadonlySet<string>;
  planned: ReadonlySet<string>;
  chain: ChainView | null;
  label: string;
  onNode: (id: string) => void;
  onChangeElective: (id: string) => void;
  onRow: (key: string) => void;
}

const CODE_SIZE = 12.5;
const TITLE_SIZE = 11;
const PAD = 8;
const LABEL_X = 14;

/** Adı en çok iki satıra böler; sığmayan kısım ikinci satırın sonunda "…" olur. */
export function wrapTitle(text: string, chars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= chars) return clean ? [clean] : [];
  const words = clean.split(" ");
  let first = "";
  let i = 0;
  while (i < words.length && (first ? `${first} ${words[i]}` : words[i]).length <= chars) {
    first = first ? `${first} ${words[i]}` : words[i];
    i++;
  }
  // Tek kelime satıra sığmıyorsa kelime bölünür.
  if (!first) return [truncateLabel(clean, chars)];
  const rest = words.slice(i).join(" ");
  return rest ? [first, truncateLabel(rest, chars)] : [first];
}

/** "1. yıl Güz" -> ["1. yıl", "Güz"]; tek kelimelik etiket tek satır. */
function splitRowLabel(label: string): string[] {
  const at = label.lastIndexOf(" ");
  return at > 0 ? [label.slice(0, at), label.slice(at + 1)] : [label];
}

function onKeys(e: KeyboardEvent<SVGGElement>, run: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    run();
  }
}

function nodeLabel(node: RowNode, parts: string[]): string {
  const head = node.kind === "elective" && node.code === null ? `Seçmeli: ${node.title}` : `${node.code ?? ""} ${node.title}`.trim();
  return [head, ...parts].join(", ");
}

export function DiagramCanvas({ model, layout, mode, taken, takeable, planned, chain, label, onNode, onChangeElective, onRow }: Props) {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const rowCounts = new Map<string, { all: number; taken: number }>();
  for (const n of model.nodes) {
    const c = rowCounts.get(n.row) ?? { all: 0, taken: 0 };
    c.all++;
    if (taken.has(n.id)) c.taken++;
    rowCounts.set(n.row, c);
  }

  return (
    <svg
      className="osd-svg"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label={label}
      data-mode={mode}
      data-chain={chain ? "" : undefined}
    >
      <g className="osd-rows">
        {layout.rows.map((r) => {
          const lines = splitRowLabel(r.label);
          const count = rowCounts.get(r.key) ?? { all: 0, taken: 0 };
          const full = count.all > 0 && count.taken === count.all;
          const cy = r.y + r.h / 2;
          const textLines = mode === "taken" ? [...lines, `${count.taken}/${count.all}`] : lines;
          const top = cy - ((textLines.length - 1) * 15) / 2;
          const text = (
            <text className="osd-row-label" x={LABEL_X} y={top} dominantBaseline="middle">
              {textLines.map((t, i) => (
                <tspan
                  key={i}
                  x={LABEL_X}
                  dy={i === 0 ? 0 : 15}
                  className={mode === "taken" && i === textLines.length - 1 ? "osd-row-count num" : undefined}
                >
                  {mode === "taken" && i === textLines.length - 1 && full ? `✓ ${t}` : t}
                </tspan>
              ))}
            </text>
          );
          return (
            <g key={r.key}>
              <rect className="osd-row" x={0.5} y={r.y + 0.5} width={layout.width - 1} height={r.h - 1} rx={12} />
              {mode === "taken" && count.all > 0 ? (
                <g
                  className="osd-row-btn"
                  role="button"
                  tabIndex={0}
                  aria-pressed={full}
                  aria-label={`${r.label}: ${full ? "bütün dersleri alındı, işaretleri kaldır" : "bütün dersleri alındı işaretle"}`}
                  onClick={() => onRow(r.key)}
                  onKeyDown={(e) => onKeys(e, () => onRow(r.key))}
                >
                  <rect className="osd-row-hit" x={4} y={r.y + 4} width={88} height={r.h - 8} rx={9} />
                  {text}
                </g>
              ) : (
                text
              )}
            </g>
          );
        })}
      </g>

      <g className="osd-edges" aria-hidden="true">
        {layout.edges.map((e, i) => {
          const key = `${e.from}>${e.to}`;
          const cls = ["osd-edge"];
          if (e.kind === "or") cls.push("is-or");
          if (chain) {
            if (chain.edges.has(key)) cls.push("is-chain");
            else cls.push("is-dim");
          } else if (mode === "taken" && taken.has(e.to)) {
            cls.push("is-strong");
          } else if (mode === "plan" && planned.has(e.to)) {
            cls.push("is-strong");
          }
          return <path key={`${key}>${i}`} d={e.path} className={cls.join(" ")} />;
        })}
      </g>

      <g className="osd-nodes">
        {layout.nodes.map((pos) => {
          const node = byId.get(pos.id);
          if (!node) return null;
          const isTaken = taken.has(node.id);
          const isPlanned = mode === "plan" && planned.has(node.id);
          const canTake = mode === "plan" && !isTaken && takeable.has(node.id);
          const isElective = node.kind === "elective";
          const unchosen = isElective && node.code === null;

          const cls = ["osd-node"];
          const status: string[] = [];
          if (isElective) cls.push("is-elective");
          if (isTaken) {
            status.push("alındı");
            if (mode !== "chain") cls.push("is-taken");
          }
          if (canTake) {
            cls.push("is-takeable");
            status.push(isPlanned ? "bu dönem alacaklarında" : "alabilirsin");
          }
          if (isPlanned) cls.push("is-planned");
          if (chain) {
            if (chain.center === node.id) {
              cls.push("is-center");
              status.push("zincirin merkezi");
            } else if (chain.descendants.has(node.id)) {
              cls.push("is-down");
              status.push("bu dersin açtığı");
            } else if (chain.ancestors.has(node.id)) {
              cls.push("is-up");
              status.push("ön şartı");
            } else {
              cls.push("is-dim");
            }
          }
          if (unchosen) status.push("seçmek için dokun");

          const mark = isPlanned ? "+ " : isTaken ? "✓ " : "";
          const codeLine = unchosen ? "Seçmeli" : (node.code ?? "");
          const codeChars = charsForWidth(pos.w, CODE_SIZE, PAD);
          const titleLines = wrapTitle(node.title, charsForWidth(pos.w, TITLE_SIZE, PAD));
          const cx = pos.w / 2;
          const codeY = titleLines.length > 1 ? pos.h / 2 - 13 : pos.h / 2 - 6;

          return (
            <Fragment key={node.id}>
              <g
                className={cls.join(" ")}
                data-id={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={mode === "taken" ? isTaken : mode === "plan" ? isPlanned : chain?.center === node.id}
                aria-label={nodeLabel(node, status)}
                onClick={() => onNode(node.id)}
                onKeyDown={(e) => onKeys(e, () => onNode(node.id))}
              >
                <rect className="osd-focus" x={-3} y={-3} width={pos.w + 6} height={pos.h + 6} rx={11} />
                <rect className="osd-box" width={pos.w} height={pos.h} rx={8} />
                <text className="osd-code" x={cx} y={codeY} textAnchor="middle" dominantBaseline="middle">
                  {truncateLabel(`${mark}${codeLine}`, codeChars)}
                </text>
                {titleLines.map((t, i) => (
                  <text
                    key={i}
                    className="osd-name"
                    x={cx}
                    y={codeY + 16 + i * 13}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {t}
                  </text>
                ))}
              </g>
              {isElective && !unchosen && (
                <g
                  className="osd-change"
                  transform={`translate(${pos.x + pos.w - 22},${pos.y - 6})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.code ?? ""} seçimini değiştir`}
                  onClick={() => onChangeElective(node.id)}
                  onKeyDown={(e) => onKeys(e, () => onChangeElective(node.id))}
                >
                  <rect className="osd-change-hit" x={-4} y={-4} width={28} height={28} />
                  <circle className="osd-change-dot" cx={10} cy={10} r={9} />
                  <text className="osd-change-glyph" x={10} y={10.5} textAnchor="middle" dominantBaseline="middle">
                    ⋯
                  </text>
                </g>
              )}
            </Fragment>
          );
        })}
      </g>
    </svg>
  );
}
