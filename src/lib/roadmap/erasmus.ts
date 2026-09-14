// Yol haritasında Erasmus dönemi: hangi dönemde yurt dışına çıkmak mezuniyeti en az etkiler. Saf mantık.
import { buildPlan, planTermLabel, type BuildPlanOptions } from "./plan";
import { canonicalCode } from "./progress";
import type { Completion, OfferingMap, PlanResult, Requirement, RoadmapProgram } from "./types";

export const DEFAULT_ERASMUS_ECTS = 30;

export interface ErasmusSuggestion {
  term: { startYear: number; season: "guz" | "bahar" };
  label: string;
  graduation: string | null;
  /** Erasmussuz plana göre kaç dönem geç mezuniyet (negatifse erken). */
  delayTerms: number;
  /** Erasmus dönemine yerleşen, yurt dışında saydırılacak seçmeli AKTS'si. */
  electivesAbroad: number;
  /** Erasmussuz planda o dönemde olan, Erasmus yüzünden sonraya kayan zorunlu ders kodları. */
  pushedRequired: string[];
}

const order = (t: { startYear: number; season: "guz" | "bahar" }) => t.startYear * 2 + (t.season === "bahar" ? 1 : 0);

/** Dönemdeki "course" gereksinimlerinin kodları, tekrarsız ve kanonik yazımla. */
function courseCodes(ids: string[], index: ReadonlyMap<string, Requirement>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const r = index.get(id);
    if (!r || r.kind !== "course" || !r.code) continue;
    const code = canonicalCode(r.code);
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

export function suggestErasmusTerms(
  programs: RoadmapProgram[],
  completion: Completion,
  offering: OfferingMap,
  options: BuildPlanOptions,
  candidates: number = 6,
): ErasmusSuggestion[] {
  const ects = options.erasmus?.ects ?? DEFAULT_ERASMUS_ECTS;
  const base: BuildPlanOptions = { ...options };
  delete base.erasmus;
  const baseline = buildPlan(programs, completion, offering, base);

  const index = new Map<string, Requirement>();
  for (const p of programs) for (const r of p.requirements) index.set(r.id, r);

  const out: ErasmusSuggestion[] = [];
  for (const bt of baseline.terms.slice(0, Math.max(0, candidates))) {
    const term = { startYear: bt.startYear, season: bt.season };
    const plan: PlanResult = buildPlan(programs, completion, offering, { ...base, erasmus: { term, ects } });
    const abroad = plan.terms.find((t) => t.erasmus);
    const inAbroad = new Set(abroad ? courseCodes(abroad.requirementIds, index) : []);
    out.push({
      term,
      label: planTermLabel(term.startYear, term.season),
      graduation: plan.graduation,
      // Mezuniyet dönemi sayısı: iki plan da aynı dönemden başladığı için dönem sayısı farkı.
      delayTerms: plan.terms.length - baseline.terms.length,
      electivesAbroad: abroad?.credits ?? 0,
      pushedRequired: courseCodes(bt.requirementIds, index).filter((c) => !inAbroad.has(c)),
    });
  }

  return out.sort(
    (a, b) =>
      a.delayTerms - b.delayTerms ||
      a.pushedRequired.length - b.pushedRequired.length ||
      b.electivesAbroad - a.electivesAbroad ||
      order(a.term) - order(b.term),
  );
}
