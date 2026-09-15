// Program haritasının yerleşimi: müfredat dönemleri sütun, sütun içi sıra barycenter ile. Saf ve deterministik.
import type { EdgeKind, GraphNode, PrereqGraph } from "./types";

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  colGap?: number;
  rowGap?: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  columns: { key: string; label: string; x: number }[];
  nodes: { code: string; x: number; y: number; w: number; h: number }[];
  edges: { from: string; to: string; kind: EdgeKind; path: string }[];
}

/** Sütun başlıkları için üst boşluk. */
const TOP = 32;
const ROUNDS = 4;
const SEASON_ORDER = { guz: 0, bahar: 1, yaz: 2, other: 3 } as const;
const SEASON_LABEL = { guz: "Güz", bahar: "Bahar", yaz: "Yaz", other: "Diğer" } as const;

const collator = new Intl.Collator("tr");
const r1 = (n: number) => Math.round(n * 10) / 10;

function columnOf(slot: GraphNode["slot"]): { key: string; label: string; order: number } {
  if (!slot) return { key: "diger", label: "Diğer", order: Number.MAX_SAFE_INTEGER };
  const year = slot.year === 0 ? "Hazırlık" : `${slot.year}. yıl`;
  return {
    key: `y${slot.year}-${slot.season}`,
    label: `${year} ${SEASON_LABEL[slot.season]}`,
    order: slot.year * 10 + SEASON_ORDER[slot.season],
  };
}

export function layoutProgramGraph(graph: PrereqGraph, opts: LayoutOptions = {}): GraphLayout {
  const w = opts.nodeWidth ?? 132;
  const h = opts.nodeHeight ?? 44;
  const colGap = opts.colGap ?? 56;
  const rowGap = opts.rowGap ?? 12;

  // Sütunlar; sütun içi başlangıç sırası müfredat (düğüm ekleme) sırası.
  const cols = new Map<string, { key: string; label: string; order: number; codes: string[] }>();
  for (const node of graph.nodes.values()) {
    const c = columnOf(node.slot);
    let col = cols.get(c.key);
    if (!col) cols.set(c.key, (col = { ...c, codes: [] }));
    col.codes.push(node.code);
  }
  const columns = [...cols.values()].sort((a, b) => a.order - b.order || collator.compare(a.key, b.key));
  const colIndex = new Map<string, number>();
  columns.forEach((col, i) => col.codes.forEach((code) => colIndex.set(code, i)));

  const edges = graph.edges.filter((e) => colIndex.has(e.from) && colIndex.has(e.to));
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const e of edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }

  const pos = new Map<string, number>();
  const refresh = (col: { codes: string[] }) => col.codes.forEach((code, i) => pos.set(code, i));
  columns.forEach(refresh);

  // Bir sütunu, belirtilen yöndeki komşuların ortalama sırasına göre diz; komşusuz ders yerinde kalır.
  const reorder = (ci: number, side: "left" | "right") => {
    const col = columns[ci];
    const bary = new Map<string, number>();
    for (const code of col.codes) {
      const ns = (neighbours.get(code) ?? []).filter((n) => {
        const nc = colIndex.get(n)!;
        return side === "left" ? nc < ci : nc > ci;
      });
      bary.set(code, ns.length ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length : pos.get(code)!);
    }
    col.codes.sort((a, b) => bary.get(a)! - bary.get(b)! || collator.compare(a, b));
    refresh(col);
  };
  for (let round = 0; round < ROUNDS; round++) {
    for (let ci = 1; ci < columns.length; ci++) reorder(ci, "left");
    for (let ci = columns.length - 2; ci >= 0; ci--) reorder(ci, "right");
  }

  const box = new Map<string, { x: number; y: number }>();
  const nodes: GraphLayout["nodes"] = [];
  let maxRows = 0;
  const outColumns = columns.map((col, ci) => {
    const x = ci * (w + colGap);
    col.codes.forEach((code, i) => {
      const y = TOP + i * (h + rowGap);
      box.set(code, { x, y });
      nodes.push({ code, x: r1(x), y: r1(y), w: r1(w), h: r1(h) });
    });
    maxRows = Math.max(maxRows, col.codes.length);
    return { key: col.key, label: col.label, x: r1(x) };
  });

  // Aynı sütunda ya da geriye giden kenar sağdan kavisle döner; son sütunda bu kavis için yer açılır.
  const bulgeMax = colGap * 0.8;
  let extraRight = 0;
  const outEdges = edges.map((e) => {
    const a = box.get(e.from)!;
    const b = box.get(e.to)!;
    const x1 = a.x + w;
    const y1 = a.y + h / 2;
    const y2 = b.y + h / 2;
    let path: string;
    if (b.x > a.x) {
      const x2 = b.x;
      const mx = (x1 + x2) / 2;
      path = `M${r1(x1)},${r1(y1)} C${r1(mx)},${r1(y1)} ${r1(mx)},${r1(y2)} ${r1(x2)},${r1(y2)}`;
    } else if (b.x === a.x) {
      const bulge = Math.min(bulgeMax, 16 + Math.abs(y2 - y1) * 0.15);
      if (colIndex.get(e.from) === columns.length - 1) extraRight = Math.max(extraRight, bulge);
      path = `M${r1(x1)},${r1(y1)} C${r1(x1 + bulge)},${r1(y1)} ${r1(x1 + bulge)},${r1(y2)} ${r1(x1)},${r1(y2)}`;
    } else {
      // Geriye: kaynaktan sağa çık, iki ders arasındaki boşluk hizasında sola geç, hedefe soldan gir.
      const bulge = bulgeMax;
      if (colIndex.get(e.from) === columns.length - 1) extraRight = Math.max(extraRight, bulge);
      const x2 = b.x;
      const ym = Math.max(a.y, b.y) + h + rowGap / 2;
      const xm = (x1 + x2) / 2;
      path =
        `M${r1(x1)},${r1(y1)} C${r1(x1 + bulge)},${r1(y1)} ${r1(x1 + bulge)},${r1(ym)} ${r1(xm)},${r1(ym)}` +
        ` C${r1(x2 - bulge)},${r1(ym)} ${r1(x2 - bulge)},${r1(y2)} ${r1(x2)},${r1(y2)}`;
    }
    return { from: e.from, to: e.to, kind: e.kind, path };
  });

  const width = columns.length ? columns.length * w + (columns.length - 1) * colGap + extraRight : 0;
  const height = columns.length ? TOP + maxRows * h + Math.max(0, maxRows - 1) * rowGap : 0;
  return { width: r1(width), height: r1(height), columns: outColumns, nodes, edges: outEdges };
}
