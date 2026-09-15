// Ön koşul grafı: program haritası, ders zinciri, ata/torun kümeleri. Saf mantık: React yok.
import { hasUnknown, parsePrerequisite } from "../roadmap/prereq";
import { canonicalCode } from "../roadmap/progress";
import type { PrereqExpr } from "../roadmap/types";
import type { Program, TermData } from "../types";
import type { ChainLevel, EdgeKind, GraphEdge, GraphNode, PrereqGraph } from "./types";

/** Zincirde bir seviyede en fazla bu kadar ders gösterilir. */
export const CHAIN_LEVEL_CAP = 30;

const collator = new Intl.Collator("tr");

// Aynı metin birçok kez okunur (ör. "CS 201" onlarca derste); ayrıştırma sonucu saklanır.
const parseCache = new Map<string, PrereqExpr>();
function parse(text: string): PrereqExpr {
  let e = parseCache.get(text);
  if (!e) {
    e = parsePrerequisite(text);
    if (parseCache.size > 5000) parseCache.clear();
    parseCache.set(text, e);
  }
  return e;
}

/** Ağaçtaki ders kodları ve kenar türü: herhangi bir "or" altında -> "or"; aynı kod iki yerde ise "and" kazanır. */
function courseKinds(expr: PrereqExpr): Map<string, EdgeKind> {
  const out = new Map<string, EdgeKind>();
  const walk = (e: PrereqExpr, underOr: boolean) => {
    if (e.kind === "course") {
      const code = canonicalCode(e.code);
      const kind: EdgeKind = underOr ? "or" : "and";
      if (out.get(code) !== "and") out.set(code, kind);
    } else if (e.kind === "and" || e.kind === "or") {
      for (const it of e.items) walk(it, underOr || e.kind === "or");
    }
  };
  walk(expr, false);
  return out;
}

/**
 * "or" seçenek grupları: "(A or B) and (C or D)" -> A,B grup 0; C,D grup 1. İç içe or dıştaki grubu paylaşır.
 * Aynı kod "and" altında da geçiyorsa null (zorunlu).
 */
function courseGroups(expr: PrereqExpr): Map<string, number | null> {
  const out = new Map<string, number | null>();
  let next = 0;
  const walk = (e: PrereqExpr, group: number | null) => {
    if (e.kind === "course") {
      const code = canonicalCode(e.code);
      if (group === null) out.set(code, null);
      else if (!out.has(code)) out.set(code, group);
    } else if (e.kind === "or") {
      const g = group ?? next++;
      for (const it of e.items) walk(it, g);
    } else if (e.kind === "and") {
      for (const it of e.items) walk(it, group);
    }
  };
  walk(expr, null);
  return out;
}

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

type Slot = GraphNode["slot"];

interface Info {
  title: string;
  credits: number | null;
  text: string;
  slot: Slot;
}

/** Dönem verisinden kod -> ilk dolu başlık/AKTS/ön koşul metni. */
function termIndex(terms: TermData[]): Map<string, Info> {
  const out = new Map<string, Info>();
  for (const t of terms) {
    for (const c of t.courses) {
      const code = canonicalCode(c.code);
      const cur = out.get(code);
      const text = (c.prerequisites ?? "").trim();
      if (!cur) {
        out.set(code, { title: c.title ?? "", credits: c.ects ?? null, text, slot: null });
        continue;
      }
      if (!cur.title && c.title) cur.title = c.title;
      if (cur.credits === null && c.ects !== null && c.ects !== undefined) cur.credits = c.ects;
      if (!cur.text && text) cur.text = text;
    }
  }
  return out;
}

function makeNode(code: string, info: Info | undefined): GraphNode {
  const text = info?.text ?? "";
  const expr = parse(text);
  return {
    code,
    title: info?.title ?? "",
    credits: info?.credits ?? null,
    slot: info?.slot ?? null,
    unreadable: hasUnknown(expr),
    prerequisiteText: text,
    minEcts: maxMinEcts(expr),
  };
}

export function buildProgramGraph(program: Program, terms: TermData[]): PrereqGraph {
  const fromTerms = termIndex(terms);
  const infos = new Map<string, Info>();
  // Müfredat sırasıyla; aynı kod tekrar ederse ilk yeri kalır, eksik alanlar sonrakilerden dolar.
  for (const sem of program.semesters) {
    for (const item of sem.items) {
      if (item.kind !== "course") continue;
      const code = canonicalCode(item.code);
      const text = (item.prerequisites ?? "").trim();
      const cur = infos.get(code);
      if (cur) {
        if (!cur.title && item.title) cur.title = item.title;
        if (cur.credits === null && item.credits !== null) cur.credits = item.credits;
        if (!cur.text && text) cur.text = text;
        continue;
      }
      infos.set(code, { title: item.title ?? "", credits: item.credits ?? null, text, slot: { year: sem.year, season: sem.season } });
    }
  }
  const nodes = new Map<string, GraphNode>();
  for (const [code, info] of infos) {
    const t = fromTerms.get(code);
    if (t) {
      if (!info.title) info.title = t.title;
      if (info.credits === null) info.credits = t.credits;
      if (!info.text) info.text = t.text;
    }
    nodes.set(code, makeNode(code, info));
  }

  const edges: GraphEdge[] = [];
  for (const node of nodes.values()) {
    const expr = parse(node.prerequisiteText);
    const groups = courseGroups(expr);
    for (const [from, kind] of courseKinds(expr)) {
      // Program dışı kodlar ve kendine kenar atlanır; kodlar courseKinds içinde zaten tekil.
      if (from === node.code || !nodes.has(from)) continue;
      edges.push({ from, to: node.code, kind, group: kind === "or" ? (groups.get(from) ?? null) : null });
    }
  }
  return { nodes, edges };
}

/** Bütün programlar + dönem verisi: kod -> en iyi bilgi (program kalemi önce). */
const globalCache = new WeakMap<Program[], WeakMap<TermData[], Map<string, Info>>>();

/** Bütün programlar ve dönemler için ders bilgisi; aynı diziler için bir kez kurulur. */
function globalIndex(programs: Program[], terms: TermData[]): Map<string, Info> {
  let byTerms = globalCache.get(programs);
  if (!byTerms) globalCache.set(programs, (byTerms = new WeakMap()));
  const cached = byTerms.get(terms);
  if (cached) return cached;
  const out = buildGlobalIndex(programs, terms);
  byTerms.set(terms, out);
  return out;
}

function buildGlobalIndex(programs: Program[], terms: TermData[]): Map<string, Info> {
  const out = new Map<string, Info>();
  for (const p of programs) {
    for (const sem of p.semesters) {
      for (const item of sem.items) {
        if (item.kind !== "course") continue;
        const code = canonicalCode(item.code);
        const text = (item.prerequisites ?? "").trim();
        const cur = out.get(code);
        if (!cur) {
          out.set(code, { title: item.title ?? "", credits: item.credits ?? null, text, slot: { year: sem.year, season: sem.season } });
          continue;
        }
        if (!cur.title && item.title) cur.title = item.title;
        if (cur.credits === null && item.credits !== null) cur.credits = item.credits;
        if (!cur.text && text) cur.text = text;
      }
    }
  }
  for (const [code, t] of termIndex(terms)) {
    const cur = out.get(code);
    if (!cur) {
      out.set(code, t);
      continue;
    }
    if (!cur.title) cur.title = t.title;
    if (cur.credits === null) cur.credits = t.credits;
    if (!cur.text) cur.text = t.text;
  }
  return out;
}

/** Seviye seviye genişletme; bir ders zincirde bir kez görünür. */
function expand(
  root: string,
  depth: number,
  next: (code: string) => Map<string, EdgeKind>,
  nodeOf: (code: string) => GraphNode,
  groupOf: (via: string, code: string) => number | null = () => null,
): ChainLevel[] {
  const levels: ChainLevel[] = [];
  const seen = new Set<string>([root]);
  let frontier = [root];
  for (let d = 1; d <= depth && frontier.length > 0; d++) {
    const found = new Map<string, { kind: EdgeKind; via: string }>();
    for (const via of frontier) {
      for (const [code, kind] of next(via)) {
        if (seen.has(code)) continue;
        const cur = found.get(code);
        if (!cur) found.set(code, { kind, via });
        else if (cur.kind === "or" && kind === "and") cur.kind = "and";
      }
    }
    const codes = [...found.keys()].sort(collator.compare).slice(0, CHAIN_LEVEL_CAP);
    if (codes.length === 0) break;
    for (const c of codes) seen.add(c);
    levels.push({
      depth: d,
      items: codes.map((c) => {
        const f = found.get(c)!;
        return { node: nodeOf(c), kind: f.kind, via: f.via, group: f.kind === "or" ? groupOf(f.via, c) : null };
      }),
    });
    frontier = codes;
  }
  return levels;
}

// Ters dizin (ön koşul kodu -> onu isteyen dersler). Statik üretimde her ders sayfası aynı dizileri verir;
// dizi referansına göre bir kez kurulur.
const reverseCache = new WeakMap<Program[], WeakMap<TermData[], Map<string, Map<string, EdgeKind>>>>();

function reverseIndex(programs: Program[], terms: TermData[]): Map<string, Map<string, EdgeKind>> {
  let byTerms = reverseCache.get(programs);
  if (!byTerms) reverseCache.set(programs, (byTerms = new WeakMap()));
  const cached = byTerms.get(terms);
  if (cached) return cached;

  const reverse = new Map<string, Map<string, EdgeKind>>();
  const addReverse = (target: string, text: string) => {
    const t = (text ?? "").trim();
    if (!t) return;
    for (const [pre, kind] of courseKinds(parse(t))) {
      if (pre === target) continue;
      let m = reverse.get(pre);
      if (!m) reverse.set(pre, (m = new Map()));
      if (m.get(target) !== "and") m.set(target, kind);
    }
  };
  for (const p of programs) {
    for (const sem of p.semesters) {
      for (const item of sem.items) if (item.kind === "course") addReverse(canonicalCode(item.code), item.prerequisites);
    }
  }
  for (const t of terms) for (const c of t.courses) addReverse(canonicalCode(c.code), c.prerequisites);
  byTerms.set(terms, reverse);
  return reverse;
}

export function buildCourseChain(
  code: string,
  programs: Program[],
  terms: TermData[],
  depth = 3,
): { node: GraphNode; requires: ChainLevel[]; unlocks: ChainLevel[] } {
  const root = canonicalCode(code);
  const index = globalIndex(programs, terms);
  const nodeCache = new Map<string, GraphNode>();
  const nodeOf = (c: string) => {
    let n = nodeCache.get(c);
    if (!n) {
      n = makeNode(c, index.get(c));
      nodeCache.set(c, n);
    }
    return n;
  };

  const reverse = reverseIndex(programs, terms);

  const requires = expand(root, depth, (c) => {
    const m = courseKinds(parse(nodeOf(c).prerequisiteText));
    m.delete(c);
    return m;
  }, nodeOf, (via, c) => courseGroups(parse(nodeOf(via).prerequisiteText)).get(c) ?? null);
  const unlocks = expand(root, depth, (c) => reverse.get(c) ?? new Map(), nodeOf);
  return { node: nodeOf(root), requires, unlocks };
}

function reach(graph: PrereqGraph, code: string, dir: "up" | "down"): Set<string> {
  const start = canonicalCode(code);
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    const [a, b] = dir === "up" ? [e.to, e.from] : [e.from, e.to];
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  }
  const out = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    for (const n of adj.get(stack.pop()!) ?? []) {
      if (n === start || out.has(n)) continue;
      out.add(n);
      stack.push(n);
    }
  }
  return out;
}

/** Dersin doğrudan ve dolaylı bütün ön koşulları (kendisi hariç). */
export function ancestors(graph: PrereqGraph, code: string): Set<string> {
  return reach(graph, code, "up");
}

/** Dersi doğrudan ya da dolaylı gerektiren bütün dersler (kendisi hariç). */
export function descendants(graph: PrereqGraph, code: string): Set<string> {
  return reach(graph, code, "down");
}
