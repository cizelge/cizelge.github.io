// Açılan Dersler sayfasından okunan dersleri mevcut dönem verisine işler.
//
// Sayfada kapasite, derslik, AKTS ve koşullar yoktur; bunlar mevcut veriden korunur. Sayfa yalnızca lisans
// müfredat alanlarındaki dersleri listeler (lab/recitation "L"/"R" ekli dersler ve lisansüstü dersler çoğunlukla
// yoktur), bu yüzden sayfada görünmeyen bir ders yalnızca "kapsamdaysa" silinir. Ayrıntılar: public-offerings.md
import type { Course, Meeting, Section, TermData } from "../../src/lib/types";

/** Bulunan kapsam içi mevcut şube oranı bunun altındaysa yazmayı reddet. */
export const MIN_FOUND_RATIO = 0.5;

/**
 * Sayfanın güvenilir biçimde listelediği dersler: 100-499 arası, ek taşımayan numara ("CS 201").
 * "CS 201L", "MATH 101R", "SAS 405_U", "PSY 481-03" ve 500+ dersler kapsam dışıdır: sayfada görünürlerse
 * güncellenir, görünmezlerse dokunulmaz.
 */
export function inScope(code: string): boolean {
  return /^\S+ [1-4]\d\d$/.test(code);
}

export interface TimeChange {
  key: string;           // "CS 201.A"
  before: string;        // "Çar 16:40-18:30"
  after: string;
}

export interface InstructorChange {
  key: string;
  before: string[];
  after: string[];
}

export interface MergeReport {
  addedCourses: string[];
  removedCourses: string[];
  /** Sayfada görünmediği hâlde SIS'ten kotası doğrulanmış olduğu için silinmeyen dersler (elle kontrol). */
  keptVerified: string[];
  addedSections: string[];
  removedSections: string[];
  timeChanges: TimeChange[];
  instructorChanges: InstructorChange[];
  titleChanges: string[];
  /** Sayfada görünmeyen, kapsam dışı olduğu için korunan dersler. */
  keptOutOfScope: number;
  /** Kapsam içi mevcut şubelerden sayfada bulunanların oranı (0-1); mevcut kapsam içi şube yoksa 1. */
  foundRatio: number;
  /** null değilse sonuç yazılmamalıdır. */
  refusal: string | null;
}

const DAY_SHORT = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const meetingKey = (m: Pick<Meeting, "day" | "start" | "end">) => `${m.day} ${m.start}-${m.end}`;
const describe = (ms: readonly Meeting[]) =>
  ms.length ? ms.map((m) => `${DAY_SHORT[m.day]} ${m.start}-${m.end}`).join(", ") : "saatsiz";
const sameMeetings = (a: readonly Meeting[], b: readonly Meeting[]) =>
  a.length === b.length && [...a.map(meetingKey)].sort().join("|") === [...b.map(meetingKey)].sort().join("|");
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function mergeSection(course: string, old: Section, page: Section, report: MergeReport): Section {
  const key = `${course}.${old.id}`;
  let meetings = old.meetings;
  if (!sameMeetings(old.meetings, page.meetings)) {
    meetings = page.meetings.map((m) => {
      // Derslik aynı gün ve başlangıç saatli eski oturumdan gelir (bitiş değişse de oda genelde aynıdır).
      const match = old.meetings.filter((o) => o.day === m.day && o.start === m.start);
      return { day: m.day, start: m.start, end: m.end, room: match.length === 1 ? match[0].room : null };
    });
    report.timeChanges.push({ key, before: describe(old.meetings), after: describe(meetings) });
  }
  let instructors = old.instructors;
  if (!sameList(old.instructors, page.instructors)) {
    instructors = page.instructors;
    report.instructorChanges.push({ key, before: old.instructors, after: page.instructors });
  }
  return { ...old, instructors, meetings };
}

/**
 * `pageCourses` (public-offerings.ts rowsToCourses çıktısı) ile `existing` dönemini birleştirir.
 * Girdileri değiştirmez. `report.refusal` doluysa dönen `term` kullanılmamalıdır.
 */
export function mergeOfferings(
  existing: TermData,
  pageCourses: readonly Course[],
  opts: { fetchedAt: string; minFoundRatio?: number },
): { term: TermData; report: MergeReport } {
  const report: MergeReport = {
    addedCourses: [],
    removedCourses: [],
    keptVerified: [],
    addedSections: [],
    removedSections: [],
    timeChanges: [],
    instructorChanges: [],
    titleChanges: [],
    keptOutOfScope: 0,
    foundRatio: 1,
    refusal: null,
  };

  const pageByCode = new Map(pageCourses.map((c) => [c.code, c]));
  const oldByCode = new Map(existing.courses.map((c) => [c.code, c]));

  // Güvenlik eşiği: sayfa tasarımı değişip ayrıştırma az şey bulursa veriyi silmemek için.
  let scoped = 0;
  let found = 0;
  for (const c of existing.courses) {
    if (!inScope(c.code)) continue;
    const p = pageByCode.get(c.code);
    for (const s of c.sections) {
      scoped++;
      if (p?.sections.some((x) => x.id === s.id)) found++;
    }
  }
  report.foundRatio = scoped === 0 ? 1 : found / scoped;
  const minRatio = opts.minFoundRatio ?? MIN_FOUND_RATIO;
  if (pageCourses.length === 0) {
    report.refusal = "Sayfada hiç ders bulunamadı";
  } else if (report.foundRatio < minRatio) {
    report.refusal =
      `Mevcut kapsam içi şubelerin yalnızca %${Math.round(report.foundRatio * 100)}'i sayfada bulundu ` +
      `(${found}/${scoped}, eşik %${Math.round(minRatio * 100)}); sayfa yapısı değişmiş olabilir`;
  }

  const out: Course[] = [];
  for (const old of existing.courses) {
    const page = pageByCode.get(old.code);
    if (!page) {
      // SIS ayrıntılarından kotası gelmiş bir ders gerçekten açılıyor demektir; yalnızca hiçbir müfredat
      // alanında listelenmediği için sayfada görünmüyor olabilir. Bunlar silinmez, raporda belirtilir.
      if (inScope(old.code) && old.sections.some((s) => s.capacity !== null)) {
        report.keptVerified.push(old.code);
        out.push(old);
      } else if (inScope(old.code)) {
        report.removedCourses.push(old.code);
      } else {
        report.keptOutOfScope++;
        out.push(old);
      }
      continue;
    }
    const title = page.title || old.title;
    if (title !== old.title) report.titleChanges.push(`${old.code}: ${old.title} → ${title}`);
    const sections: Section[] = [];
    for (const ps of page.sections) {
      const os = old.sections.find((s) => s.id === ps.id);
      if (os) {
        sections.push(mergeSection(old.code, os, ps, report));
      } else {
        sections.push({ ...ps, meetings: ps.meetings.map((m) => ({ ...m })) });
        report.addedSections.push(`${old.code}.${ps.id}`);
      }
    }
    for (const os of old.sections) {
      if (!page.sections.some((s) => s.id === os.id)) report.removedSections.push(`${old.code}.${os.id}`);
    }
    sections.sort((a, b) => a.id.localeCompare(b.id, "en"));
    // title, ects, localCredits, prerequisites, corequisites mevcut veriden (sayfada yoklar).
    out.push({ ...old, title, sections });
  }

  for (const page of pageCourses) {
    if (oldByCode.has(page.code)) continue;
    report.addedCourses.push(page.code);
    for (const s of page.sections) report.addedSections.push(`${page.code}.${s.id}`);
    out.push({ ...page, sections: page.sections.map((s) => ({ ...s, meetings: s.meetings.map((m) => ({ ...m })) })) });
  }

  out.sort((a, b) => a.code.localeCompare(b.code, "en"));
  return { term: { ...existing, fetchedAt: opts.fetchedAt, courses: out }, report };
}

/** Dönem verisinin fetchedAt dışındaki içeriği aynı mı. */
export function sameContent(a: TermData, b: TermData): boolean {
  return JSON.stringify({ ...a, fetchedAt: "" }) === JSON.stringify({ ...b, fetchedAt: "" });
}

export function hasChanges(r: MergeReport): boolean {
  return (
    r.addedCourses.length + r.removedCourses.length + r.addedSections.length + r.removedSections.length +
      r.timeChanges.length + r.instructorChanges.length + r.titleChanges.length >
    0
  );
}

/** Kısa sayım: "+3 şube, -1 ders, 2 saat". Değişiklik yoksa boş dizi. */
export function countParts(r: Pick<MergeReport, "addedCourses" | "removedCourses" | "addedSections" | "removedSections" | "timeChanges" | "instructorChanges" | "titleChanges">): string[] {
  const parts: string[] = [];
  if (r.addedCourses.length) parts.push(`+${r.addedCourses.length} ders`);
  if (r.removedCourses.length) parts.push(`-${r.removedCourses.length} ders`);
  // Yeni derslerin şubeleri "+N ders" içinde sayılır; burada yalnızca var olan derslere eklenenler.
  const newCourseSections = r.addedSections.filter((k) => r.addedCourses.includes(k.slice(0, k.lastIndexOf(".")))).length;
  const addedSections = r.addedSections.length - newCourseSections;
  if (addedSections) parts.push(`+${addedSections} şube`);
  if (r.removedSections.length) parts.push(`-${r.removedSections.length} şube`);
  if (r.timeChanges.length) parts.push(`${r.timeChanges.length} saat`);
  if (r.instructorChanges.length) parts.push(`${r.instructorChanges.length} hoca`);
  if (r.titleChanges.length) parts.push(`${r.titleChanges.length} ad`);
  return parts;
}
