// Bölüm müfredatından "bu dönem hangi dersleri almalıyım" görünümü. Saf mantık: React yok.
import type { Course, PlanItem, PlanPoolCourse, Program, ProgramsData } from "../types";
import { expandCorequisites, normalizeCode } from "../engine";
import type { TermSeason } from "../terms";

export type { TermSeason };

/** Bundan büyük havuzlar liste olarak gösterilmez (serbest seçmeli gibi); ders aramayla eklenir. */
export const MAX_POOL_SIZE = 150;

const word = (w: string) => new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, "u");

/** "2026 - 2027 Güz" -> "guz". Dönem adı yoksa null. */
export function seasonOfTerm(termLabel: string): TermSeason | null {
  const t = termLabel.toLocaleLowerCase("tr");
  if (word("güz").test(t)) return "guz";
  if (word("bahar").test(t)) return "bahar";
  if (word("yaz").test(t)) return "yaz";
  return null;
}

/** Programda en az bir satırı olan yıllar, küçükten büyüğe (0 = Hazırlık). */
export function programYears(program: Program): number[] {
  const years = new Set(program.semesters.filter((s) => s.items.length > 0).map((s) => s.year));
  return [...years].sort((a, b) => a - b);
}

export function yearLabel(year: number): string {
  return year === 0 ? "Hazırlık" : `${year}. sınıf`;
}

const collator = new Intl.Collator("tr");

export function groupByFaculty(programs: readonly Program[]): { faculty: string; programs: Program[] }[] {
  const groups = new Map<string, Program[]>();
  for (const p of programs) {
    const list = groups.get(p.faculty);
    if (list) list.push(p);
    else groups.set(p.faculty, [p]);
  }
  return [...groups]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([faculty, list]) => ({ faculty, programs: [...list].sort((a, b) => collator.compare(a.name, b.name)) }));
}

export interface RequiredCourse {
  /** Açılıyorsa bu dönemki dersin kodu, açılmıyorsa müfredattaki kod. */
  code: string;
  title: string;
  offered: boolean;
}

export interface ElectiveGroup {
  /** Müfredattaki etiket olduğu gibi. */
  key: string;
  /** Başındaki program kodu atılmış etiket: "BSCS Program-İçi Seçmeli" -> "Program-İçi Seçmeli". */
  label: string;
  /** Aynı dönemde bu seçmeliden kaç tane alınacağı. */
  count: number;
  /** Havuzun bu dönem açılan dersleri; havuz bilinmiyorsa ya da çok büyükse null. */
  pool: PlanPoolCourse[] | null;
}

export interface CurriculumView {
  required: RequiredCourse[];
  electives: ElectiveGroup[];
}

function stripProgramPrefix(label: string, program: Program): string {
  const prefix = `${program.id} `;
  return label.startsWith(prefix) && label.length > prefix.length ? label.slice(prefix.length) : label;
}

export function curriculumFor(
  program: Program,
  year: number,
  season: TermSeason,
  courses: readonly Course[],
): CurriculumView {
  const offeredCode = new Map<string, Course>();
  for (const c of courses) {
    const key = normalizeCode(c.code);
    if (!offeredCode.has(key)) offeredCode.set(key, c);
  }

  const items: PlanItem[] = program.semesters.filter((s) => s.year === year && s.season === season).flatMap((s) => s.items);

  const required: RequiredCourse[] = [];
  const seen = new Set<string>();
  const electives = new Map<string, ElectiveGroup>();

  for (const item of items) {
    if (item.kind === "course") {
      const key = normalizeCode(item.code);
      if (seen.has(key)) continue;
      seen.add(key);
      const match = offeredCode.get(key);
      required.push({ code: match?.code ?? item.code, title: item.title || match?.title || "", offered: !!match });
      continue;
    }
    const group = electives.get(item.label);
    if (group) {
      group.count++;
      if (group.pool === null) group.pool = offeredPool(item.pool, offeredCode);
    } else {
      electives.set(item.label, {
        key: item.label,
        label: stripProgramPrefix(item.label, program),
        count: 1,
        pool: offeredPool(item.pool, offeredCode),
      });
    }
  }

  return { required, electives: [...electives.values()] };
}

function offeredPool(pool: PlanPoolCourse[] | null, offeredCode: ReadonlyMap<string, Course>): PlanPoolCourse[] | null {
  if (!pool || pool.length > MAX_POOL_SIZE) return null;
  const out: PlanPoolCourse[] = [];
  for (const p of pool) {
    const match = offeredCode.get(normalizeCode(p.code));
    if (match && !out.some((o) => o.code === match.code)) out.push({ ...p, code: match.code });
  }
  return out;
}

export interface AdditionPlan {
  /** Sepete eklenecek kodlar (yan koşullu dersler dahil), sırasıyla. */
  added: string[];
  /** Müfredatta olup bu dönem açılmayan zorunlu dersler. */
  notOffered: string[];
  /** Bu dönem açılan zorunlu ders sayısı. */
  offeredCount: number;
}

export function planAddition(view: CurriculumView, cart: readonly string[], courses: readonly Course[]): AdditionPlan {
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const offered = view.required.filter((r) => r.offered).map((r) => byCode.get(r.code)).filter((c): c is Course => !!c);
  const added = expandCorequisites(offered, courses)
    .map((c) => c.code)
    .filter((code) => !cart.includes(code));
  return {
    added,
    notOffered: view.required.filter((r) => !r.offered).map((r) => r.code),
    offeredCount: offered.length,
  };
}

export function describeAddition(plan: AdditionPlan): string {
  const head =
    plan.added.length > 0
      ? `${plan.added.join(", ")} eklendi.`
      : plan.offeredCount > 0
        ? "Bu dönem açılan zorunlu derslerin zaten sepette."
        : "Bu dönem açılan zorunlu ders yok.";
  return plan.notOffered.length > 0 ? `${head} Bu dönem açılmayan: ${plan.notOffered.join(", ")}.` : head;
}

/**
 * İstemciye gidecek veriyi küçültür: listelenmeyecek büyük havuzlar null olur,
 * arayüzde kullanılmayan ön koşul metinleri boşaltılır. Girdiyi değiştirmez.
 */
export function slimProgramsForClient(data: ProgramsData): ProgramsData {
  return {
    ...data,
    programs: data.programs.map((p) => ({
      ...p,
      semesters: p.semesters.map((s) => ({
        ...s,
        items: s.items.map((item): PlanItem =>
          item.kind === "course"
            ? { ...item, prerequisites: "" }
            : { ...item, pool: item.pool && item.pool.length > MAX_POOL_SIZE ? null : item.pool },
        ),
      })),
    })),
  };
}
