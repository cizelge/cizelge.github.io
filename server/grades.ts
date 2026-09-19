// Not dağılımı: öğrencilerin kendi harf notlarını isimsiz bildirmesi ve ders/hoca kırılımında özetlenmesi.
// Kimin ne aldığı anlaşılmasın diye dağılım belli bir sayıya ulaşmadan gösterilmez (MIN_GRADES).

/** Özyeğin harf notları; W = dersten çekildi, ortalamaya girmez. */
export const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "W"] as const;
export type Letter = (typeof LETTERS)[number];

/** Harfin 4'lük karşılığı; W'nin karşılığı yok. */
export const LETTER_POINTS: Record<Letter, number | null> = {
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  "D+": 1.3,
  D: 1,
  F: 0,
  W: null,
};

/** Dağılım bu kadar bildirim toplanmadan gösterilmez: az sayıda kişide kimin ne aldığı belli olur. */
export const MIN_GRADES = 5;
/** Hoca kırılımı için ayrı eşik. */
export const MIN_GRADES_PER_INSTRUCTOR = 5;
/** Bir cihazın not bildirebileceği en fazla ders. */
export const MAX_GRADES_PER_DEVICE = 80;
// Kampüs ağında yüzlerce öğrenci tek IP'den çıkar; sınırlar hoca oylarından gevşektir
// yoksa aynı dersi alan sınıfın çoğu "çok bildirim" hatası alır.
/** Aynı ağdan (IP) bir ders için en fazla bildirim. */
export const MAX_GRADES_PER_IP_PER_COURSE = 25;
/** Aynı ağdan günde en fazla bildirim. */
export const MAX_GRADES_PER_IP_PER_DAY = 150;

const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{16,64}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** "2025-2026-guz" gibi; yılın ikincisi birincinin bir fazlası olmalı. */
const TERM_RE = /^(\d{4})-(\d{4})-(guz|bahar|yaz)$/;

/** Ders kodunun kayıt anahtarı: "cs 201" -> "CS201". */
export function courseKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(key) ? key : null;
}

export function isLetter(value: unknown): value is Letter {
  return typeof value === "string" && (LETTERS as readonly string[]).includes(value);
}

/** Dönem kodu geçerli mi; gelecekteki dönem kabul edilmez (henüz notu yok). */
export function cleanTerm(raw: unknown, now = new Date()): string | null {
  if (typeof raw !== "string") return null;
  const m = TERM_RE.exec(raw);
  if (!m) return null;
  const start = Number(m[1]);
  if (Number(m[2]) !== start + 1) return null;
  // Akademik yıl eylülde başlar: ekimde 2026-2027 güz notu daha çıkmamıştır ama dönem geçerlidir.
  const year = now.getFullYear();
  if (start < 2010 || start > year) return null;
  return raw;
}

export interface GradeInput {
  school: string;
  /** "CS201" biçiminde anahtar. */
  course: string;
  letter: Letter;
  /** Dersi aldığı hocanın adres parçası; bilmiyorsa null. */
  instructor: string | null;
  term: string;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; grade: GradeInput };

export function parseGrade(body: unknown, now = new Date()): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = courseKey(b.course);
  const device = typeof b.device === "string" ? b.device : "";
  const term = cleanTerm(b.term, now);
  const rawSlug = typeof b.instructor === "string" ? b.instructor.trim().toLowerCase() : "";
  const instructor = rawSlug === "" ? null : rawSlug;

  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!course) return { ok: false, error: "Ders kodu geçersiz" };
  if (!isLetter(b.letter)) return { ok: false, error: "Harf notu geçersiz" };
  if (!term) return { ok: false, error: "Dönem geçersiz" };
  if (instructor !== null && (!SLUG_RE.test(instructor) || instructor.length > 80)) {
    return { ok: false, error: "Hoca adresi geçersiz" };
  }
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };

  return { ok: true, grade: { school, course, letter: b.letter, instructor, term, device } };
}

export type Counts = Partial<Record<Letter, number>>;

export interface GradeRow {
  letter: Letter;
  instructor: string | null;
  term: string;
}

export interface InstructorGrades {
  slug: string;
  n: number;
  letters: Counts;
  /** 4'lük ortalama; W dışında not yoksa null. */
  gpa: number | null;
  /** F ve W dışındakilerin oranı (yüzde). */
  pass: number | null;
}

export interface CourseGrades {
  course: string;
  /** Toplam bildirim sayısı (eşiğin altında da doğru sayıyı veririz). */
  n: number;
  /** Eşiğe ulaşılmadıysa dağılım boş döner. */
  hidden: boolean;
  letters: Counts;
  gpa: number | null;
  pass: number | null;
  /** En çok bildirim alandan aza, yalnızca eşiği geçen hocalar. */
  instructors: InstructorGrades[];
  /** Bildirim gelen dönemler, yeniden eskiye. */
  terms: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function tally(rows: readonly GradeRow[]): { letters: Counts; gpa: number | null; pass: number | null } {
  const letters: Counts = {};
  let sum = 0;
  let scored = 0;
  let passed = 0;
  let graded = 0;
  for (const row of rows) {
    letters[row.letter] = (letters[row.letter] ?? 0) + 1;
    const point = LETTER_POINTS[row.letter];
    if (point !== null) {
      sum += point;
      scored++;
      graded++;
      if (row.letter !== "F") passed++;
    }
  }
  return {
    letters,
    gpa: scored ? round2(sum / scored) : null,
    pass: graded ? Math.round((passed / graded) * 100) : null,
  };
}

/** Bir dersin bildirimlerini dağılıma çevirir. Eşiğin altındaysa yalnızca sayı döner. */
export function summarizeCourse(course: string, rows: readonly GradeRow[]): CourseGrades {
  const n = rows.length;
  const terms = [...new Set(rows.map((r) => r.term))].sort().reverse();
  if (n < MIN_GRADES) {
    return { course, n, hidden: true, letters: {}, gpa: null, pass: null, instructors: [], terms };
  }
  const all = tally(rows);

  const byInstructor = new Map<string, GradeRow[]>();
  for (const row of rows) {
    if (!row.instructor) continue;
    const list = byInstructor.get(row.instructor) ?? [];
    list.push(row);
    byInstructor.set(row.instructor, list);
  }
  const instructors: InstructorGrades[] = [];
  for (const [slug, list] of byInstructor) {
    if (list.length < MIN_GRADES_PER_INSTRUCTOR) continue;
    const t = tally(list);
    instructors.push({ slug, n: list.length, letters: t.letters, gpa: t.gpa, pass: t.pass });
  }
  instructors.sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug, "tr"));

  return { course, n, hidden: false, letters: all.letters, gpa: all.gpa, pass: all.pass, instructors, terms };
}
