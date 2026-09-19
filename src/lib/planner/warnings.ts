// Planlayıcıdaki uyarılar: (1) seçtiğin şube değişti mi, (2) ön şartını sağlıyor musun.
// Hiçbir şeyi kendiliğinden değiştirmez; yalnızca durumu anlatır.
import type { SectionRef } from "../engine";
import { normalizeCode } from "../engine";
import { evaluatePrerequisite, parsePrerequisite, prerequisiteCodes } from "../roadmap/prereq";
import type { PrereqExpr } from "../roadmap/types";
import type { Course, Meeting } from "../types";

/* ------------------------------------------------------------------ */
/* Şube değişikliği                                                    */
/* ------------------------------------------------------------------ */

/** Bir şubenin tarayıcıya kaydedilen hâli; sonraki ziyarette bununla karşılaştırılır. */
export interface SectionSnapshot {
  code: string;
  sectionId: string;
  /** "1 08:40-10:30" biçiminde, sıralı. */
  times: string[];
  instructors: string[];
}

export interface Snapshot {
  v: 1;
  termId: string;
  savedAt: string;
  sections: SectionSnapshot[];
}

export const snapshotKey = (schoolId: string, termId: string) => `program-izi:${schoolId}:${termId}`;

export const timeList = (meetings: readonly Meeting[]): string[] =>
  meetings.map((m) => `${m.day} ${m.start}-${m.end}`).sort();

/** Sepetteki şubelerin şu anki hâli. */
export function snapshotOf(sections: readonly SectionRef[], courses: ReadonlyMap<string, Course>): SectionSnapshot[] {
  const out: SectionSnapshot[] = [];
  for (const ref of sections) {
    const section = courses.get(ref.courseCode)?.sections.find((s) => s.id === ref.sectionId);
    if (!section) continue;
    out.push({ code: ref.courseCode, sectionId: ref.sectionId, times: timeList(section.meetings), instructors: [...section.instructors] });
  }
  return out;
}

export type Change =
  /** Ders veriden çıktı: bu dönem açılmıyor. */
  | { kind: "courseGone"; code: string }
  /** Şube kapandı; dersin başka şubeleri olabilir. */
  | { kind: "sectionGone"; code: string; sectionId: string; left: number }
  | { kind: "time"; code: string; sectionId: string; before: string[]; after: string[] }
  | { kind: "instructor"; code: string; sectionId: string; before: string[]; after: string[] };

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Kaydedilen hâlle şimdiki veriyi karşılaştırır. Sepette olmayan kayıtlar yok sayılır. */
export function detectChanges(saved: readonly SectionSnapshot[], courses: ReadonlyMap<string, Course>, cart: readonly string[]): Change[] {
  const inCart = new Set(cart.map(normalizeCode));
  const changes: Change[] = [];
  for (const before of saved) {
    if (!inCart.has(normalizeCode(before.code))) continue;
    const course = courses.get(before.code);
    if (!course) {
      changes.push({ kind: "courseGone", code: before.code });
      continue;
    }
    const section = course.sections.find((s) => s.id === before.sectionId);
    if (!section) {
      changes.push({ kind: "sectionGone", code: before.code, sectionId: before.sectionId, left: course.sections.length });
      continue;
    }
    const times = timeList(section.meetings);
    if (!sameList(before.times, times)) {
      changes.push({ kind: "time", code: before.code, sectionId: before.sectionId, before: before.times, after: times });
    }
    if (!sameList(before.instructors, section.instructors)) {
      changes.push({ kind: "instructor", code: before.code, sectionId: before.sectionId, before: before.instructors, after: section.instructors });
    }
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/* Ön şart                                                             */
/* ------------------------------------------------------------------ */

export type PrereqState = "ok" | "missing" | "unknown";

export interface PrereqWarning {
  code: string;
  state: Exclude<PrereqState, "ok">;
  /** Ham ön koşul metni. */
  text: string;
  /** Eksik görünen dersler; yalnızca hepsi gerekliyse doldurulur ("A veya B" durumunda boş kalır). */
  missing: string[];
}

/** Ağaçta "veya" var mı: varsa eksik ders listesi verilmez. */
function hasOr(expr: PrereqExpr): boolean {
  if (expr.kind === "or") return true;
  if (expr.kind === "and") return expr.items.some(hasOr);
  return false;
}

/**
 * Sepetteki derslerin ön şartını, yol haritasında geçmiş işaretlenen derslere göre değerlendirir.
 * `passed` boşsa hiç uyarı üretilmez: öğrenci yol haritasını doldurmamıştır, tahmin yürütmeyiz.
 */
export function prereqWarnings(
  cart: readonly string[],
  courses: ReadonlyMap<string, Course>,
  passed: ReadonlySet<string>,
  passedEcts = 0,
): PrereqWarning[] {
  if (passed.size === 0) return [];
  const has = new Set([...passed].map(normalizeCode));
  const out: PrereqWarning[] = [];
  for (const code of cart) {
    const course = courses.get(code);
    const text = course?.prerequisites?.trim();
    if (!course || !text) continue;
    const expr = parsePrerequisite(text);
    const result = evaluatePrerequisite(expr, has, passedEcts);
    if (result === true) continue;
    // Sepetteki ders ön şartı karşılıyorsa (aynı dönem alınıyorsa) uyarma.
    const eksik = prerequisiteCodes(expr).filter((c) => !has.has(normalizeCode(c)) && !cart.some((x) => normalizeCode(x) === normalizeCode(c)));
    if (result === false && eksik.length === 0) continue;
    // "A veya B" gibi seçmeli koşullarda ders saymak yanıltır; yalnızca hepsi gerekliyse listelenir.
    const missing = hasOr(expr) ? [] : eksik;
    out.push({ code, state: result === false ? "missing" : "unknown", text, missing });
  }
  return out;
}
