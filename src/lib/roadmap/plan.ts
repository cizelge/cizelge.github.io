// Mezuniyete kadar dönem dönem açgözlü plan. Saf mantık: React yok.
import type { TermSeason } from "../terms";
import * as realPrereq from "./prereq";
import { canonicalCode, isDone, passedCodes, passedEcts, slotOrder } from "./progress";
import type { Completion, OfferingMap, PlanOptions, PlanResult, PlanTerm, PrereqExpr, RoadmapProgram } from "./types";

/** Ön koşul modülü; testlerde sahtesi verilebilir. */
export interface PrereqApi {
  parse(text: string): PrereqExpr;
  evaluate(expr: PrereqExpr, passed: ReadonlySet<string>, passedEcts: number): boolean | null;
  codes(expr: PrereqExpr): string[];
  hasUnknown(expr: PrereqExpr): boolean;
}

export const defaultPrereq: PrereqApi = {
  parse: (t) => realPrereq.parsePrerequisite(t),
  evaluate: (e, p, n) => realPrereq.evaluatePrerequisite(e, p, n),
  codes: (e) => realPrereq.prerequisiteCodes(e),
  hasUnknown: (e) => realPrereq.hasUnknown(e),
};

export type BuildPlanOptions = PlanOptions & { prereq?: PrereqApi };

/** 2026 Güz -> "2026 Güz", 2026-2027 Bahar -> "2027 Bahar". */
export function planTermLabel(startYear: number, season: "guz" | "bahar"): string {
  return season === "guz" ? `${startYear} Güz` : `${startYear + 1} Bahar`;
}

/** Plana konacak tek ders ya da seçmeli; aynı kodlu gereksinimler tek birimdir. */
interface Unit {
  key: string;
  code: string | null;
  reqIds: string[];
  credits: number;
  prereqText: string;
  coreqs: string[];
  seasons: ReadonlySet<TermSeason>;
  order: number;
  seq: number;
}

const BOTH: ReadonlySet<TermSeason> = new Set(["guz", "bahar"]);
const MINOR_ORDER = 1e6;

/** Değerlendirme kümesi: hem "CS 101" hem "CS101" yazımı (ön koşul modülü hangisini kullanırsa). */
function addPassed(set: Set<string>, code: string) {
  const canon = canonicalCode(code);
  set.add(canon);
  set.add(canon.replace(/\s+/g, ""));
}

export function collectUnits(programs: RoadmapProgram[], completion: Completion, offering: OfferingMap): Unit[] {
  const passed = passedCodes(programs, completion);
  const units = new Map<string, Unit>();
  let seq = 0;
  for (const p of programs) {
    for (const r of p.requirements) {
      if (isDone(r, completion, passed)) continue;
      const order = r.slot ? slotOrder(r.slot) : MINOR_ORDER;
      if (r.kind === "course" && r.code) {
        const key = canonicalCode(r.code);
        const u = units.get(key);
        if (u) {
          u.reqIds.push(r.id);
          if (!u.credits && r.credits) u.credits = r.credits;
          if (!u.prereqText.trim() && r.prerequisites.trim()) u.prereqText = r.prerequisites;
          for (const c of r.corequisites) if (!u.coreqs.includes(c)) u.coreqs.push(c);
          u.order = Math.min(u.order, order);
          continue;
        }
        units.set(key, {
          key,
          code: key,
          reqIds: [r.id],
          credits: r.credits ?? 0,
          prereqText: r.prerequisites,
          coreqs: [...r.corequisites],
          // Haritada yoksa bilgi yok demektir; engellemeyiz.
          seasons: offering.get(key) ?? BOTH,
          order,
          seq: seq++,
        });
      } else {
        // Seçmeli: slot mevsiminde; slot yoksa ya da Güz/Bahar değilse iki mevsimde de.
        const s = r.slot?.season;
        units.set(`#${r.id}`, {
          key: `#${r.id}`,
          code: null,
          reqIds: [r.id],
          credits: r.credits ?? 0,
          prereqText: "",
          coreqs: [],
          seasons: s === "guz" || s === "bahar" ? new Set([s]) : BOTH,
          order,
          seq: seq++,
        });
      }
    }
  }
  return [...units.values()].sort((a, b) => a.order - b.order || a.seq - b.seq);
}

export function buildPlan(
  programs: RoadmapProgram[],
  completion: Completion,
  offering: OfferingMap,
  options: BuildPlanOptions,
): PlanResult {
  const prereq = options.prereq ?? defaultPrereq;
  const maxTerms = options.maxTerms ?? 16;
  const units = collectUnits(programs, completion, offering);
  const byCode = new Map(units.filter((u) => u.code).map((u) => [u.code!, u]));
  const exprs = new Map(units.map((u) => [u.key, prereq.parse(u.prereqText)]));

  // Yan koşul ilişkisi iki yönlü: biri ötekini listeliyorsa birlikte alınır.
  const coreqsOf = new Map<string, Unit[]>();
  const link = (a: Unit, b: Unit) => {
    if (a === b) return;
    const list = coreqsOf.get(a.key) ?? [];
    if (!list.includes(b)) list.push(b);
    coreqsOf.set(a.key, list);
  };
  for (const u of units) {
    for (const c of u.coreqs) {
      const v = byCode.get(canonicalCode(c));
      if (v) {
        link(u, v);
        link(v, u);
      }
    }
  }

  const passed = new Set<string>();
  for (const c of passedCodes(programs, completion)) addPassed(passed, c);
  let ects = passedEcts(programs, completion);

  const placed = new Set<string>();
  const terms: PlanTerm[] = [];
  let { startYear, season } = options.start;
  let idle = 0;

  while (placed.size < units.length && terms.length < maxTerms && idle < 2) {
    const term: PlanTerm = { startYear, season, label: planTermLabel(startYear, season), requirementIds: [], credits: 0 };
    const inTerm: Unit[] = [];
    const put = (u: Unit) => {
      placed.add(u.key);
      inTerm.push(u);
      term.requirementIds.push(...u.reqIds);
    };

    const abroad =
      options.erasmus !== undefined &&
      options.erasmus.term.startYear === startYear &&
      options.erasmus.term.season === season;

    if (abroad) {
      // Erasmus: Özyeğin'den ders yok. Kalan seçmeliler (mevsime bakmadan) AKTS hakkı kadar yurt dışına.
      term.erasmus = true;
      const limit = Math.max(0, options.erasmus!.ects);
      // Önce yalnızca bu mevsimde yer bulabilen seçmeliler (yoksa bir yıl beklerlerdi), sonra kalanlar; müfredat sırasıyla.
      const onlyHere = (u: Unit) => (u.seasons.size === 1 && u.seasons.has(season) ? 0 : 1);
      const electives = units.filter((u) => u.code === null).sort((a, b) => onlyHere(a) - onlyHere(b));
      for (const u of electives) {
        if (placed.has(u.key) || limit === 0) continue;
        if (term.credits + u.credits > limit) continue;
        put(u);
        term.credits += u.credits;
      }
    }

    for (const u of abroad ? [] : units) {
      if (placed.has(u.key) || !u.seasons.has(season)) continue;
      // Ders kendi başına AKTS sınırını aşıyorsa boş döneme tek başına konur.
      if (term.credits + u.credits > options.maxCredits && !(term.credits === 0 && inTerm.length === 0)) continue;
      // Ön koşul yalnızca önceki dönemlerle; null (okunamayan) engellemez.
      if (prereq.evaluate(exprs.get(u.key)!, passed, ects) === false) continue;
      put(u);
      term.credits += u.credits;
      // Yan koşullu gereksinimler aynı döneme, krediye sayılmadan.
      const queue = [u];
      while (queue.length) {
        for (const v of coreqsOf.get(queue.shift()!.key) ?? []) {
          if (placed.has(v.key)) continue;
          put(v);
          queue.push(v);
        }
      }
    }

    terms.push(term);
    // Boş Erasmus dönemi "ilerleme yok" sayılmaz: sonraki dönemlerde yerleşecek ders olabilir.
    if (inTerm.length > 0) idle = 0;
    else if (!abroad) idle++;
    for (const u of inTerm) if (u.code) addPassed(passed, u.code);
    ects += term.credits;
    if (season === "guz") season = "bahar";
    else {
      season = "guz";
      startYear++;
    }
  }

  // Sondaki boş dönemler atılır; Erasmus dönemi (boş olsa da) planın parçasıdır.
  while (terms.length > 0 && terms[terms.length - 1].requirementIds.length === 0 && !terms[terms.length - 1].erasmus) {
    terms.pop();
  }

  const unplaced: PlanResult["unplaced"] = [];
  for (const u of units) {
    if (placed.has(u.key)) continue;
    let reason: "prerequisite" | "notOffered" | "unknown";
    if (!u.seasons.has("guz") && !u.seasons.has("bahar")) reason = "notOffered";
    else if (prereq.evaluate(exprs.get(u.key)!, passed, ects) === false) reason = "prerequisite";
    else reason = "unknown";
    for (const id of u.reqIds) unplaced.push({ requirementId: id, reason });
  }

  return {
    terms,
    unplaced,
    graduation: unplaced.length === 0 && terms.length > 0 ? terms[terms.length - 1].label : null,
  };
}
