// Ders puanlama: hoca oylarının ders karşılığı. Oy ders başınadır (şube ya da hoca başına değil).
// Hoca oylarıyla aynı kurallar: cihaz başına tek oy, isimsiz yorum, bildirilen yorum gizlenir.
import { cleanComment } from "./logic.ts";

/** Derse sorulan, hepsi 1-5 ve hepsi isteğe bağlı kriterler. */
export const COURSE_CRITERIA = ["useful", "interesting", "difficulty", "workload"] as const;
export type CourseCriterion = (typeof COURSE_CRITERIA)[number];
export type CourseCriteria = Partial<Record<CourseCriterion, number>>;

/** Genel puana giren kriterler: zorluk ve iş yükü iyi/kötü değildir, dışarıda kalır. */
const SCORED: readonly CourseCriterion[] = ["useful", "interesting"];

export const MIN_COURSE_VOTES = 1;
/** Bir cihazın oy verebileceği en fazla ders. */
export const MAX_COURSES_PER_DEVICE = 60;
/** Aynı ağdan (IP) bir ders için en fazla oy; kampüs ağı tek IP olabilir. */
export const MAX_PER_IP_PER_COURSE = 25;
/** Aynı ağdan günde en fazla ders oyu. */
export const MAX_COURSE_VOTES_PER_IP_PER_DAY = 150;

const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{16,64}$/;

/** Ders kodunun kayıt anahtarı: "cs 201" -> "CS201". */
export function courseKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(key) ? key : null;
}

/** Ders adı: fazla boşluk atılır, 120 karakterle sınırlanır. */
export function cleanCourseTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

export interface CourseVoteInput {
  school: string;
  /** "CS201" biçiminde anahtar. */
  course: string;
  /** Dersin adı (listede göstermek için). */
  title: string;
  /** Baştan seçse yine alır mıydı. */
  again: boolean;
  criteria: CourseCriteria;
  comment: string | null;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; vote: CourseVoteInput };

function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function parseCourseVote(body: unknown): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = courseKey(b.course);
  const device = typeof b.device === "string" ? b.device : "";

  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!course) return { ok: false, error: "Ders kodu geçersiz" };
  if (typeof b.again !== "boolean") return { ok: false, error: "Yine alır mıydın eksik" };
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };

  const given = (typeof b.criteria === "object" && b.criteria !== null ? b.criteria : {}) as Record<string, unknown>;
  const criteria: CourseCriteria = {};
  for (const name of COURSE_CRITERIA) {
    const raw = given[name];
    if (raw === null || raw === undefined) continue;
    const value = intInRange(raw, 1, 5);
    if (value === null) return { ok: false, error: `${name} 1-5 olmalı` };
    criteria[name] = value;
  }

  const comment = cleanComment(b.comment);
  if (!comment.ok) return { ok: false, error: comment.error };

  return {
    ok: true,
    vote: { school, course, title: cleanCourseTitle(b.title), again: b.again, criteria, comment: comment.comment, device },
  };
}

export interface CourseComment {
  id: string;
  text: string;
  at: string;
  again: boolean;
  score: number | null;
}

export interface Scored {
  avg: number;
  n: number;
}

export interface CourseRow {
  course: string;
  title: string;
  n: number;
  /** Yine alırım diyenlerin oranı (0-1). */
  again: number;
  criteria?: Partial<Record<CourseCriterion, Scored>>;
  comments?: CourseComment[];
}

export interface CourseSummary {
  course: string;
  title: string;
  n: number;
  /** Yine alırım diyenlerin yüzdesi. */
  again: number;
  criteria: CourseCriteria;
  /** Faydalı ve ilgi çekici ortalaması; cevap yoksa null. */
  score: number | null;
  comments: CourseComment[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Genel puan: faydalı ve ilgi çekici ortalaması. Zorluk ile iş yükü dışarıda. */
export function courseScore(criteria: CourseCriteria): number | null {
  const parts = SCORED.map((c) => criteria[c]).filter((v): v is number => typeof v === "number");
  return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

export function summarizeCourses(rows: readonly CourseRow[]): CourseSummary[] {
  const out: CourseSummary[] = [];
  for (const r of rows) {
    if (r.n < MIN_COURSE_VOTES) continue;
    const criteria: CourseCriteria = {};
    for (const name of COURSE_CRITERIA) {
      const value = r.criteria?.[name];
      if (value?.n) criteria[name] = round1(value.avg);
    }
    const comments = [...(r.comments ?? [])].sort((a, b) => b.at.localeCompare(a.at));
    out.push({
      course: r.course,
      title: r.title,
      n: r.n,
      again: Math.round(r.again * 100),
      criteria,
      score: courseScore(criteria),
      comments,
    });
  }
  return out.sort((a, b) => b.n - a.n || a.course.localeCompare(b.course, "tr"));
}
