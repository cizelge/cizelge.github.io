// Ön şart diyagramı durum mantığı: alınan dersler, zincir, alınabilirlik. Saf; girdiler asla değiştirilmez.
import type { RowsModel } from "./rows";

export type Mode = "taken" | "plan" | "chain";

interface Req {
  /** "and" ön koşulları. */
  and: string[];
  /** "or" grupları: her gruptan biri yeter; seçenekler müfredat sırasında. */
  or: string[][];
}

// Aynı model için gereksinim tablosu bir kez kurulur.
const reqCache = new WeakMap<RowsModel, Map<string, Req>>();

function requirements(model: RowsModel): Map<string, Req> {
  const cached = reqCache.get(model);
  if (cached) return cached;
  const order = new Map(model.nodes.map((n, i) => [n.id, i]));
  const out = new Map<string, Req>();
  const groups = new Map<string, Map<string, string[]>>();
  for (const n of model.nodes) out.set(n.id, { and: [], or: [] });
  for (const e of model.edges) {
    const req = out.get(e.to);
    if (!req || !order.has(e.from)) continue;
    if (e.kind === "and") {
      if (!req.and.includes(e.from)) req.and.push(e.from);
      continue;
    }
    // Grupsuz "or" kenarı kendi başına bir grup sayılır.
    const gkey = e.group === null ? `x:${e.from}` : `g:${e.group}`;
    let g = groups.get(e.to);
    if (!g) groups.set(e.to, (g = new Map()));
    const list = g.get(gkey);
    if (list) {
      if (!list.includes(e.from)) list.push(e.from);
    } else g.set(gkey, [e.from]);
  }
  const byOrder = (a: string, b: string) => order.get(a)! - order.get(b)!;
  for (const [id, req] of out) {
    req.and.sort(byOrder);
    req.or = [...(groups.get(id)?.values() ?? [])].map((l) => l.sort(byOrder));
  }
  reqCache.set(model, out);
  return out;
}

/** id'nin ön koşul kapanışı; skip(n) true olan düğüm eklenmez ve üzerinden geçilmez. */
function closure(model: RowsModel, id: string, taken: ReadonlySet<string>, skip: (n: string) => boolean): Set<string> {
  const reqs = requirements(model);
  const out = new Set<string>();
  const visit = (n: string) => {
    const req = reqs.get(n);
    if (!req) return;
    const add = (p: string) => {
      if (p === id || out.has(p) || skip(p)) return;
      out.add(p);
      visit(p);
    };
    for (const p of req.and) add(p);
    for (const group of req.or) {
      // Gruptan alınmış (ya da zaten eklenmiş) biri varsa ek yok; yoksa ilk uygun seçenek.
      if (group.some((p) => taken.has(p) || out.has(p))) continue;
      const first = group.find((p) => p !== id && !skip(p));
      if (first) add(first);
    }
  };
  visit(id);
  return out;
}

/** id'nin bütün ön koşulları (dolaylı); "or" grubunda alınmış varsa ek yok, yoksa gruptaki ilk düğüm. */
export function closePrereqs(model: RowsModel, id: string, taken: ReadonlySet<string> = new Set()): Set<string> {
  return closure(model, id, taken, () => false);
}

function reach(model: RowsModel, id: string, dir: "up" | "down"): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of model.edges) {
    const [a, b] = dir === "up" ? [e.to, e.from] : [e.from, e.to];
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  }
  const out = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    for (const n of adj.get(stack.pop()!) ?? []) {
      if (n === id || out.has(n)) continue;
      out.add(n);
      stack.push(n);
    }
  }
  return out;
}

/** id'yi doğrudan ya da dolaylı gerektiren düğümler. */
export function dependents(model: RowsModel, id: string): Set<string> {
  return reach(model, id, "down");
}

function rowOf(model: RowsModel, id: string): string | undefined {
  return model.nodes.find((n) => n.id === id)?.row;
}

function removeWithCascade(model: RowsModel, taken: ReadonlySet<string>, ids: string[]): Set<string> {
  const reqs = requirements(model);
  const next = new Set(taken);
  const removed = new Set<string>();
  for (const id of ids) {
    if (next.delete(id)) removed.add(id);
  }
  // Çıkarılan bir düğüme dayanan ve başka seçenekle karşılanmayan alınmışlar da çıkar (sabit noktaya kadar).
  let changed = removed.size > 0;
  while (changed) {
    changed = false;
    for (const n of [...next]) {
      const req = reqs.get(n);
      if (!req) continue;
      const broken =
        req.and.some((p) => removed.has(p)) ||
        req.or.some((g) => g.some((p) => removed.has(p)) && !g.some((p) => next.has(p)));
      if (broken) {
        next.delete(n);
        removed.add(n);
        changed = true;
      }
    }
  }
  return next;
}

function addWithPrereqs(model: RowsModel, id: string, next: Set<string>): void {
  const row = rowOf(model, id);
  next.add(id);
  // Aynı satırdaki ön koşullar eklenmez (birlikte alınabilir).
  for (const p of closure(model, id, next, (n) => rowOf(model, n) === row)) next.add(p);
}

export function toggleTaken(model: RowsModel, taken: ReadonlySet<string>, id: string): Set<string> {
  if (!model.nodes.some((n) => n.id === id)) return new Set(taken);
  if (taken.has(id)) return removeWithCascade(model, taken, [id]);
  const next = new Set(taken);
  addWithPrereqs(model, id, next);
  return next;
}

/** Satırın hepsi alınmışsa hepsini çıkarır, değilse hepsini (ön koşullarıyla) ekler. */
export function toggleRow(model: RowsModel, taken: ReadonlySet<string>, rowKey: string): Set<string> {
  const ids = model.nodes.filter((n) => n.row === rowKey).map((n) => n.id);
  if (ids.length === 0) return new Set(taken);
  if (ids.every((id) => taken.has(id))) return removeWithCascade(model, taken, ids);
  const next = new Set(taken);
  for (const id of ids) if (!next.has(id)) addWithPrereqs(model, id, next);
  return next;
}

/** Alınmamış ve ön koşulları (program içi) karşılanmış düğümler; AKTS şartı yok sayılır. */
export function takeable(model: RowsModel, taken: ReadonlySet<string>): Set<string> {
  const reqs = requirements(model);
  const out = new Set<string>();
  for (const n of model.nodes) {
    if (taken.has(n.id)) continue;
    const req = reqs.get(n.id)!;
    if (req.and.every((p) => taken.has(p)) && req.or.every((g) => g.some((p) => taken.has(p)))) out.add(n.id);
  }
  return out;
}

/** Zincir: bütün atalar, bütün torunlar ve bunları bağlayan kenarlar ("from>to"). */
export function chainOf(
  model: RowsModel,
  id: string,
): { ancestors: Set<string>; descendants: Set<string>; edges: Set<string> } {
  const ancestors = reach(model, id, "up");
  const descendants = reach(model, id, "down");
  const edges = new Set<string>();
  for (const e of model.edges) {
    const up = ancestors.has(e.from) && (e.to === id || ancestors.has(e.to));
    const down = descendants.has(e.to) && (e.from === id || descendants.has(e.from));
    if (up || down) edges.add(`${e.from}>${e.to}`);
  }
  return { ancestors, descendants, edges };
}
