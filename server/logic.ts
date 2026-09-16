// Oy servisi: doğrulama ve özetleme. Cloudflare'a bağımlı değil, testleri burada.

export const WORKLOAD_LABELS = [
  "haftada 2 saatten az",
  "haftada 2–5 saat",
  "haftada 5–8 saat",
  "haftada 8–12 saat",
  "haftada 12 saatten fazla",
] as const;

/** Hocaya sorulan, hepsi 1-5 ve hepsi isteğe bağlı kriterler. */
export const INSTRUCTOR_CRITERIA = ["clarity", "fairness", "helpful", "attendance"] as const;
export type Criterion = (typeof INSTRUCTOR_CRITERIA)[number];

/** Özetler ilk oydan itibaren gösterilir; oy sayısı her zaman yanında yazar. */
export const MIN_VOTES = 1;
export const MIN_VOTES_INSTRUCTOR = 1;
/** Bir cihazın oy verebileceği en fazla ders (kötüye kullanım sınırı). */
export const MAX_PER_DEVICE = 60;
/** Aynı ağdan (IP) bir ders için en fazla oy. */
export const MAX_PER_IP_PER_COURSE = 4;
/** Aynı ağdan günde en fazla oy. */
export const MAX_PER_IP_PER_DAY = 40;

export type Criteria = Partial<Record<Criterion, number>>;

export interface VoteInput {
  school: string;
  code: string;
  instructor: string | null;
  difficulty: number;
  workload: number;
  again: boolean;
  /** Hocaya ait cevaplar; yalnızca hoca seçildiyse saklanır. */
  criteria: Criteria;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; vote: VoteInput };

const CODE_RE = /^[A-ZÇĞİÖŞÜ]{2,6} \d{3}[A-Z]?$/u;
const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{16,64}$/;

function intInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Hoca adı: fazla boşluklar atılır, 80 karakterle sınırlanır; boşsa null. */
export function cleanInstructor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  return name.length >= 3 ? name : null;
}

export function parseVote(body: unknown): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const code = typeof b.code === "string" ? b.code.replace(/\s+/g, " ").trim().toUpperCase() : "";
  const difficulty = intInRange(b.difficulty, 1, 5);
  const workload = intInRange(b.workload, 1, 5);
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!CODE_RE.test(code)) return { ok: false, error: "Ders kodu geçersiz" };
  if (difficulty === null) return { ok: false, error: "Zorluk 1-5 olmalı" };
  if (workload === null) return { ok: false, error: "İş yükü 1-5 olmalı" };
  if (typeof b.again !== "boolean") return { ok: false, error: "Tekrar alır mıydın eksik" };
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };

  const instructor = cleanInstructor(b.instructor);
  const given = (typeof b.criteria === "object" && b.criteria !== null ? b.criteria : {}) as Record<string, unknown>;
  const criteria: Criteria = {};
  for (const name of INSTRUCTOR_CRITERIA) {
    const raw = given[name];
    if (raw === null || raw === undefined) continue;
    const value = intInRange(raw, 1, 5);
    if (value === null) return { ok: false, error: `${name} 1-5 olmalı` };
    // Hoca seçilmediyse hocaya ait cevaplar saklanmaz.
    if (instructor) criteria[name] = value;
  }

  return { ok: true, vote: { school, code, instructor, difficulty, workload, again: b.again, criteria, device } };
}

/** Bir kriterin ortalaması ve kaç kişinin cevapladığı. */
export interface Scored {
  avg: number;
  n: number;
}

export interface Row {
  code: string;
  instructor?: string | null;
  n: number;
  difficulty: number;
  workload: number;
  again: number;
  /** Hoca satırlarında kriter ortalamaları. */
  criteria?: Partial<Record<Criterion, Scored>>;
}

export interface CourseSummary {
  n: number;
  /** 1-5 ortalama, tek ondalık. */
  difficulty: number;
  /** 1-5 ortalama, tek ondalık. */
  workload: number;
  /** Tekrar alırım diyenlerin yüzdesi, tam sayı. */
  again: number;
  /** Yalnızca yeterli oy alan hocalar. */
  instructors?: InstructorInCourse[];
}

export interface InstructorInCourse {
  name: string;
  n: number;
  difficulty: number;
  again: number;
  /** Yeterli kişi cevaplamayan kriter hiç dönmez. */
  criteria: Criteria;
}

export interface InstructorSummary extends InstructorInCourse {
  /** Bütün derslerin ortalaması (1-5); kriterlerin ortalaması değil, zorluk. */
  courses: { code: string; n: number; difficulty: number; again: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Yeterli cevap alan kriterleri tek ondalıkla verir. */
function shownCriteria(criteria: Partial<Record<Criterion, Scored>> | undefined): Criteria {
  const out: Criteria = {};
  for (const name of INSTRUCTOR_CRITERIA) {
    const value = criteria?.[name];
    if (value && value.n >= MIN_VOTES_INSTRUCTOR) out[name] = round1(value.avg);
  }
  return out;
}

/** Ders ve hoca satırlarını istemcinin okuduğu biçime çevirir; eşiğin altındakiler atılır. */
export function summarize(courseRows: readonly Row[], instructorRows: readonly Row[] = []): Record<string, CourseSummary> {
  const out: Record<string, CourseSummary> = {};
  for (const r of courseRows) {
    if (r.n < MIN_VOTES) continue;
    out[r.code] = { n: r.n, difficulty: round1(r.difficulty), workload: round1(r.workload), again: Math.round(r.again * 100) };
  }
  for (const r of instructorRows) {
    const course = out[r.code];
    if (!course || !r.instructor || r.n < MIN_VOTES_INSTRUCTOR) continue;
    (course.instructors ??= []).push({
      name: r.instructor,
      n: r.n,
      difficulty: round1(r.difficulty),
      again: Math.round(r.again * 100),
      criteria: shownCriteria(r.criteria),
    });
  }
  for (const course of Object.values(out)) course.instructors?.sort((a, b) => b.n - a.n);
  return out;
}

/** Hoca sayfaları için: (ders, hoca) satırlarını hocaya göre toplar. */
export function summarizeInstructors(rows: readonly Row[]): InstructorSummary[] {
  interface Acc {
    n: number;
    difficulty: number;
    again: number;
    criteria: Partial<Record<Criterion, Scored>>;
    courses: InstructorSummary["courses"];
  }
  const byName = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.instructor) continue;
    const agg: Acc = byName.get(r.instructor) ?? { n: 0, difficulty: 0, again: 0, criteria: {}, courses: [] };
    agg.n += r.n;
    agg.difficulty += r.difficulty * r.n;
    agg.again += r.again * r.n;
    for (const name of INSTRUCTOR_CRITERIA) {
      const value = r.criteria?.[name];
      if (!value?.n) continue;
      const acc = agg.criteria[name] ?? { avg: 0, n: 0 };
      acc.avg += value.avg * value.n;
      acc.n += value.n;
      agg.criteria[name] = acc;
    }
    if (r.n >= MIN_VOTES) agg.courses.push({ code: r.code, n: r.n, difficulty: round1(r.difficulty), again: Math.round(r.again * 100) });
    byName.set(r.instructor, agg);
  }

  const out: InstructorSummary[] = [];
  for (const [name, a] of byName) {
    if (a.n < MIN_VOTES_INSTRUCTOR) continue;
    const criteria: Partial<Record<Criterion, Scored>> = {};
    for (const key of INSTRUCTOR_CRITERIA) {
      const value = a.criteria[key];
      if (value?.n) criteria[key] = { avg: value.avg / value.n, n: value.n };
    }
    out.push({
      name,
      n: a.n,
      difficulty: round1(a.difficulty / a.n),
      again: Math.round((a.again / a.n) * 100),
      criteria: shownCriteria(criteria),
      courses: a.courses.sort((x, y) => y.n - x.n),
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

/** "Zorluk 3,8/5, haftada 5–8 saat, %72 tekrar alır (42 oy)" */
export function describe(s: CourseSummary): string {
  const difficulty = s.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 });
  return `Zorluk ${difficulty}/5, ${WORKLOAD_LABELS[Math.round(s.workload) - 1]}, %${s.again} tekrar alır (${s.n} oy)`;
}
