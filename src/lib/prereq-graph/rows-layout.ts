// Ön şart diyagramı (satır görünümü): model kurma ve yerleşim. Saf ve deterministik; sözleşme rows.ts'te.
import { hasUnknown, parsePrerequisite } from "../roadmap/prereq";
import { canonicalCode } from "../roadmap/progress";
import type { PrereqExpr } from "../roadmap/types";
import type { PlanSeason, Program, TermData } from "../types";
import { courseGroups, courseKinds } from "./graph";
import type { RowEdge, RowNode, RowsLayout, RowsModel } from "./rows";

const SEASON_LABEL = { guz: "Güz", bahar: "Bahar", yaz: "Yaz", other: "Diğer" } as const;
const ROUNDS = 3;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ağaçtaki en büyük AKTS şartı; yoksa null. */
function maxMinEcts(expr: PrereqExpr): number | null {
  if (expr.kind === "minEcts") return expr.ects;
  if (expr.kind !== "and" && expr.kind !== "or") return null;
  let best: number | null = null;
  for (const it of expr.items) {
    const v = maxMinEcts(it);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

interface Info {
  title: string;
  credits: number | null;
  text: string;
}

/** Kod -> bilgi: önce program kalemleri, eksik alanlar dönem verisinden. */
function infoIndex(program: Program, terms: TermData[]): Map<string, Info> {
  const out = new Map<string, Info>();
  const merge = (code: string, title: string, credits: number | null, text: string) => {
    const cur = out.get(code);
    if (!cur) {
      out.set(code, { title, credits, text });
      return;
    }
    if (!cur.title && title) cur.title = title;
    if (cur.credits === null && credits !== null) cur.credits = credits;
    if (!cur.text && text) cur.text = text;
  };
  for (const sem of program.semesters) {
    for (const item of sem.items) {
      if (item.kind !== "course") continue;
      merge(canonicalCode(item.code), item.title ?? "", item.credits ?? null, (item.prerequisites ?? "").trim());
    }
  }
  for (const t of terms) {
    for (const c of t.courses) {
      merge(canonicalCode(c.code), c.title ?? "", c.ects ?? null, (c.prerequisites ?? "").trim());
    }
  }
  return out;
}

function rowLabel(year: number, season: PlanSeason, prepCount: number): string {
  if (year === 0) return prepCount > 1 ? `Hazırlık ${SEASON_LABEL[season]}` : "Hazırlık";
  return `${year}. yıl ${SEASON_LABEL[season]}`;
}

export function buildRowsModel(
  program: Program,
  terms: TermData[],
  electiveChoices: Record<string, string>,
): RowsModel {
  const index = infoIndex(program, terms);
  const prepKeys = new Set(program.semesters.filter((s) => s.year === 0).map((s) => s.season));

  const rows: RowsModel["rows"] = [];
  const rowSeen = new Set<string>();
  const nodes: RowNode[] = [];
  const courseIds = new Set<string>();

  for (const sem of program.semesters) {
    const key = `y${sem.year}-${sem.season}`;
    let added = false;
    sem.items.forEach((item, i) => {
      if (item.kind === "course") {
        const code = canonicalCode(item.code);
        if (courseIds.has(code)) return; // aynı kod: ilki kalır
        courseIds.add(code);
        const info = index.get(code);
        const text = info?.text ?? "";
        const expr = parsePrerequisite(text);
        nodes.push({
          id: code, kind: "course", row: key, code,
          title: info?.title ?? item.title ?? "", credits: info?.credits ?? null, pool: null,
          prerequisiteText: text, unreadable: hasUnknown(expr), minEcts: maxMinEcts(expr),
        });
      } else {
        const id = `${program.id}:y${sem.year}-${sem.season}:${i}`;
        const pool = item.pool ? item.pool.map((p) => ({ code: p.code, title: p.title, credits: p.credits })) : null;
        const choice = electiveChoices[id];
        // Havuzda olmayan seçim yok sayılır; serbest seçmelide (havuz null) her kod geçerli.
        const chosenCode = choice ? canonicalCode(choice) : null;
        const picked = chosenCode && pool ? pool.find((p) => canonicalCode(p.code) === chosenCode) : undefined;
        const valid = chosenCode !== null && (pool === null || picked !== undefined);
        if (valid) {
          const info = index.get(chosenCode);
          const text = info?.text ?? "";
          const expr = parsePrerequisite(text);
          nodes.push({
            id, kind: "elective", row: key, code: chosenCode,
            title: picked?.title || info?.title || chosenCode,
            credits: picked?.credits ?? info?.credits ?? item.credits ?? null,
            pool, prerequisiteText: text, unreadable: hasUnknown(expr), minEcts: maxMinEcts(expr),
          });
        } else {
          nodes.push({
            id, kind: "elective", row: key, code: null, title: item.label, credits: item.credits ?? null,
            pool, prerequisiteText: "", unreadable: false, minEcts: null,
          });
        }
      }
      added = true;
    });
    if (added && !rowSeen.has(key)) {
      rowSeen.add(key);
      rows.push({ key, label: rowLabel(sem.year, sem.season, prepKeys.size), year: sem.year, season: sem.season });
    }
  }

  // Kod -> kaynak düğüm: ders düğümü önce, yoksa o kodu seçmiş ilk seçmeli.
  const byCode = new Map<string, string>();
  for (const n of nodes) if (n.kind === "course" && n.code) byCode.set(n.code, n.id);
  for (const n of nodes) if (n.kind === "elective" && n.code && !byCode.has(n.code)) byCode.set(n.code, n.id);

  const edges: RowEdge[] = [];
  for (const n of nodes) {
    if (!n.prerequisiteText) continue;
    const expr = parsePrerequisite(n.prerequisiteText);
    const groups = courseGroups(expr);
    for (const [code, kind] of courseKinds(expr)) {
      const from = byCode.get(code);
      if (!from || from === n.id || code === n.code) continue;
      edges.push({ from, to: n.id, kind, group: kind === "or" ? (groups.get(code) ?? null) : null });
    }
  }
  return { rows, nodes, edges };
}

export interface RowsLayoutOptions {
  width?: number;
  nodeW?: number;
  nodeH?: number;
  gapX?: number;
  rowPadY?: number;
  rowGap?: number;
  labelW?: number;
}

export function layoutRows(model: RowsModel, opts: RowsLayoutOptions = {}): RowsLayout {
  const nodeW = opts.nodeW ?? 112;
  const nodeH = opts.nodeH ?? 64;
  const gapX = opts.gapX ?? 14;
  const rowPadY = opts.rowPadY ?? 16;
  const rowGap = opts.rowGap ?? 14;
  const labelW = opts.labelW ?? 96;

  const rowIndex = new Map(model.rows.map((r, i) => [r.key, i]));
  const rows = model.rows.map(() => [] as string[]);
  const rowOf = new Map<string, number>();
  for (const n of model.nodes) {
    const ri = rowIndex.get(n.row);
    if (ri === undefined) continue;
    rows[ri].push(n.id);
    rowOf.set(n.id, ri);
  }

  const edges = model.edges.filter((e) => rowOf.has(e.from) && rowOf.has(e.to));
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

  // Ortalanmış sıra: satır genişliği farklı olsa da hizalar karşılaştırılabilir.
  const pos = new Map<string, number>();
  const refresh = (ri: number) => rows[ri].forEach((id, i) => pos.set(id, i - (rows[ri].length - 1) / 2));
  rows.forEach((_, ri) => refresh(ri));

  const reorder = (ri: number, side: "up" | "down") => {
    const bary = new Map<string, number>();
    const order = new Map(rows[ri].map((id, i) => [id, i]));
    for (const id of rows[ri]) {
      const ns = (neighbours.get(id) ?? []).filter((n) => (side === "up" ? rowOf.get(n)! < ri : rowOf.get(n)! > ri));
      bary.set(id, ns.length ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length : pos.get(id)!);
    }
    rows[ri].sort((a, b) => bary.get(a)! - bary.get(b)! || order.get(a)! - order.get(b)!);
    refresh(ri);
  };
  for (let round = 0; round < ROUNDS; round++) {
    for (let ri = 1; ri < rows.length; ri++) reorder(ri, "up");
    if (round < ROUNDS - 1) for (let ri = rows.length - 2; ri >= 0; ri--) reorder(ri, "down");
  }

  const maxCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const contentW = maxCount ? maxCount * nodeW + (maxCount - 1) * gapX : 0;
  const width = Math.max(opts.width ?? 0, labelW + contentW);
  const rowH = rowPadY * 2 + nodeH;

  const box = new Map<string, { x: number; y: number; ri: number }>();
  const outNodes: RowsLayout["nodes"] = [];
  const outRows: RowsLayout["rows"] = model.rows.map((r, ri) => {
    const y = ri * (rowH + rowGap);
    const ids = rows[ri];
    const rowW = ids.length ? ids.length * nodeW + (ids.length - 1) * gapX : 0;
    const x0 = labelW + (width - labelW - rowW) / 2;
    ids.forEach((id, i) => {
      const x = x0 + i * (nodeW + gapX);
      box.set(id, { x, y: y + rowPadY, ri });
      outNodes.push({ id, x: r1(x), y: r1(y + rowPadY), w: nodeW, h: nodeH });
    });
    return { key: r.key, label: r.label, y: r1(y), h: rowH };
  });

  const outEdges: RowsLayout["edges"] = edges.map((e) => {
    const a = box.get(e.from)!;
    const b = box.get(e.to)!;
    let path: string;
    if (a.ri === b.ri) {
      // Aynı satır: yan kenardan çıkıp satır dolgusu içinde yukarı kavisle öbür kutunun yanına.
      const right = b.x > a.x;
      const x1 = right ? a.x + nodeW : a.x;
      const x2 = right ? b.x : b.x + nodeW;
      const ym = a.y + nodeH / 2;
      const top = a.y - rowPadY * 0.75;
      path = `M${r1(x1)},${r1(ym)} C${r1(x1)},${r1(top)} ${r1(x2)},${r1(top)} ${r1(x2)},${r1(ym)}`;
    } else {
      const x1 = a.x + nodeW / 2;
      const y1 = a.y + nodeH;
      const x2 = b.x + nodeW / 2;
      const y2 = b.y;
      const d = Math.max(rowPadY + rowGap / 2, Math.abs(y2 - y1) / 2);
      const dir = y2 >= y1 ? 1 : -1;
      path = `M${r1(x1)},${r1(y1)} C${r1(x1)},${r1(y1 + d * dir)} ${r1(x2)},${r1(y2 - d * dir)} ${r1(x2)},${r1(y2)}`;
    }
    return { from: e.from, to: e.to, kind: e.kind, path };
  });

  const height = rows.length ? rows.length * rowH + (rows.length - 1) * rowGap : 0;
  return { width: r1(width), height: r1(height), rows: outRows, nodes: outNodes, edges: outEdges };
}
