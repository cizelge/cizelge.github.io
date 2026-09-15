// "Programına sığan seçmeliler": bölümün seçmeli havuzlarından, seçili programın boş saatlerine sığan
// ve bu dönem açılan dersler. Saf mantık: React yok.
import type { Course, Meeting, PlanPoolCourse, Program, Section } from "../types";
import { expandCorequisites, normalizeCode, parseTime } from "../engine";

type Day = Meeting["day"];
type Slot = Pick<Meeting, "day" | "start" | "end">;

export interface ElectivePool {
  /** Program kodu atılmış etiket: "Program-İçi Seçmeli". */
  label: string;
  /** Havuz bilinmiyorsa (serbest seçmeli ya da çok büyük havuz) null. */
  pool: PlanPoolCourse[] | null;
}

export interface FittingCourse {
  code: string;
  title: string;
  ects: number | null;
  /** Programa sığan şubeler (yan koşullu dersleriyle birlikte sığanlar). */
  sections: Section[];
  /** Birlikte alınması gereken, sepette olmayan dersler ("CS 201L"). */
  corequisites: string[];
  prerequisites: string;
}

export interface ElectiveFit {
  label: string;
  /** Havuzdan bu dönem açılan ve sepette olmayan ders sayısı. */
  offered: number;
  fits: FittingCourse[];
}

export interface ElectiveFits {
  groups: ElectiveFit[];
  /** Havuzu listelenemeyen seçmeli etiketleri (serbest seçmeli vb.). */
  openLabels: string[];
}

/** Programdaki bütün seçmeli etiketleri, havuzları birleştirilmiş olarak; müfredattaki ilk görünüş sırasıyla. */
export function electivePools(program: Program): ElectivePool[] {
  const byLabel = new Map<string, ElectivePool>();
  const prefix = `${program.id} `;
  for (const semester of program.semesters) {
    for (const item of semester.items) {
      if (item.kind !== "elective") continue;
      const label = item.label.startsWith(prefix) && item.label.length > prefix.length ? item.label.slice(prefix.length) : item.label;
      const entry = byLabel.get(label);
      if (!entry) {
        byLabel.set(label, { label, pool: item.pool ? [...item.pool] : null });
      } else if (item.pool) {
        const pool = entry.pool ?? [];
        for (const p of item.pool) if (!pool.some((x) => normalizeCode(x.code) === normalizeCode(p.code))) pool.push(p);
        entry.pool = pool;
      }
    }
  }
  return [...byLabel.values()];
}

function overlaps(a: Slot, b: Slot): boolean {
  return a.day === b.day && parseTime(a.start) < parseTime(b.end) && parseTime(b.start) < parseTime(a.end);
}

/** Şubenin saati var, boş bırakılmak istenen güne düşmüyor ve dolu saatlerle çakışmıyor. */
function sectionFits(section: Section, busy: readonly Slot[], freeDays: readonly Day[]): boolean {
  return (
    section.meetings.length > 0 &&
    section.meetings.every((m) => !freeDays.includes(m.day) && !busy.some((b) => overlaps(m, b)))
  );
}

/**
 * `busy`: seçili programın oturumları. Bir ders, en az bir şubesi ve sepette olmayan her yan koşullu
 * dersinin en az bir şubesi (o şubeyle birlikte) boş saatlere sığıyorsa listelenir.
 */
export function fittingElectives(
  program: Program,
  courses: readonly Course[],
  busy: readonly Slot[],
  cart: readonly string[],
  freeDays: readonly Day[] = [],
): ElectiveFits {
  const byCode = new Map<string, Course>();
  for (const c of courses) if (!byCode.has(normalizeCode(c.code))) byCode.set(normalizeCode(c.code), c);
  const inCart = new Set(cart.map(normalizeCode));
  const memo = new Map<string, FittingCourse | null>();

  function fit(course: Course): FittingCourse | null {
    if (memo.has(course.code)) return memo.get(course.code)!;
    const coreqs = expandCorequisites([course], courses).filter(
      (c) => c.code !== course.code && !inCart.has(normalizeCode(c.code)),
    );
    const sections = course.sections.filter((s) => {
      if (!sectionFits(s, busy, freeDays)) return false;
      const withSection = [...busy, ...s.meetings];
      return coreqs.every((c) => c.sections.some((cs) => sectionFits(cs, withSection, freeDays)));
    });
    const result: FittingCourse | null = sections.length
      ? {
          code: course.code,
          title: course.title,
          ects: course.ects,
          sections,
          corequisites: coreqs.map((c) => c.code),
          prerequisites: course.prerequisites.trim(),
        }
      : null;
    memo.set(course.code, result);
    return result;
  }

  const groups: ElectiveFit[] = [];
  const openLabels: string[] = [];
  for (const { label, pool } of electivePools(program)) {
    if (!pool) {
      openLabels.push(label);
      continue;
    }
    const seen = new Set<string>();
    let offered = 0;
    const fits: FittingCourse[] = [];
    for (const p of pool) {
      const course = byCode.get(normalizeCode(p.code));
      if (!course || seen.has(course.code) || inCart.has(normalizeCode(course.code))) continue;
      seen.add(course.code);
      offered++;
      const f = fit(course);
      if (f) fits.push(f);
    }
    fits.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
    groups.push({ label, offered, fits });
  }
  return { groups, openLabels };
}

/** Şubelerden en az biri bu günde ders yapıyor mu. */
export function meetsOn(course: FittingCourse, day: Day): boolean {
  return course.sections.some((s) => s.meetings.some((m) => m.day === day));
}
