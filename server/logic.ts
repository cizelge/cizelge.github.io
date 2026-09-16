// Oy servisi: doğrulama ve özetleme. Cloudflare'a bağımlı değil, testleri burada.

export const WORKLOAD_LABELS = [
  "haftada 2 saatten az",
  "haftada 2–5 saat",
  "haftada 5–8 saat",
  "haftada 8–12 saat",
  "haftada 12 saatten fazla",
] as const;

/** Bir dersin özeti gösterilmeye başlanan en az oy sayısı. */
export const MIN_VOTES = 3;
/** Hoca kırılımı için en az oy sayısı (tek kişi tanınmasın diye daha yüksek). */
export const MIN_VOTES_INSTRUCTOR = 5;
/** Bir cihazın oy verebileceği en fazla ders (kötüye kullanım sınırı). */
export const MAX_PER_DEVICE = 60;
/** Aynı ağdan (IP) bir ders için en fazla oy. */
export const MAX_PER_IP_PER_COURSE = 4;
/** Aynı ağdan günde en fazla oy. */
export const MAX_PER_IP_PER_DAY = 40;

export interface VoteInput {
  school: string;
  code: string;
  instructor: string | null;
  difficulty: number;
  workload: number;
  again: boolean;
  /** Hocaya ait sorular; yalnızca hoca seçildiyse sorulur, boş bırakılabilir. */
  clarity: number | null;
  fairness: number | null;
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
  const clarity = b.clarity === null || b.clarity === undefined ? null : intInRange(b.clarity, 1, 5);
  const fairness = b.fairness === null || b.fairness === undefined ? null : intInRange(b.fairness, 1, 5);
  if (clarity === null && b.clarity !== null && b.clarity !== undefined) return { ok: false, error: "Anlatım 1-5 olmalı" };
  if (fairness === null && b.fairness !== null && b.fairness !== undefined) return { ok: false, error: "Notlandırma 1-5 olmalı" };
  return {
    ok: true,
    // Hoca seçilmediyse hocaya ait cevaplar saklanmaz.
    vote: {
      school,
      code,
      instructor,
      difficulty,
      workload,
      again: b.again,
      clarity: instructor ? clarity : null,
      fairness: instructor ? fairness : null,
      device,
    },
  };
}

export interface Row {
  code: string;
  instructor?: string | null;
  n: number;
  difficulty: number;
  workload: number;
  again: number;
  /** Anlatım ve notlandırma ortalaması; cevaplayan yoksa null. */
  clarity?: number | null;
  fairness?: number | null;
  /** Anlatım/notlandırma sorusunu cevaplayan oy sayısı. */
  clarityN?: number;
  fairnessN?: number;
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
  /** Anlatım ortalaması (1-5); yeterli cevap yoksa null. */
  clarity: number | null;
  /** Notlandırma ortalaması (1-5); yeterli cevap yoksa null. */
  fairness: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Soruyu yeterli kişi cevaplamadıysa ortalama gösterilmez. */
function enough(value: number | null | undefined, count: number | undefined): number | null {
  return typeof value === "number" && (count ?? 0) >= MIN_VOTES_INSTRUCTOR ? round1(value) : null;
}

/** Hoca sayfası için bir hocanın bütün dersleri. */
export interface InstructorRow extends Row {
  instructor: string;
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
      clarity: enough(r.clarity, r.clarityN),
      fairness: enough(r.fairness, r.fairnessN),
    });
  }
  for (const course of Object.values(out)) course.instructors?.sort((a, b) => b.n - a.n);
  return out;
}

export interface InstructorSummary {
  name: string;
  /** Bütün derslerindeki toplam oy. */
  n: number;
  difficulty: number;
  again: number;
  clarity: number | null;
  fairness: number | null;
  /** Yeterli oy alan dersleri, çoktan aza. */
  courses: { code: string; n: number; difficulty: number; again: number }[];
}

/** Hoca sayfaları için: (ders, hoca) satırlarını hocaya göre toplar. */
export function summarizeInstructors(rows: readonly Row[]): InstructorSummary[] {
  const byName = new Map<string, { n: number; difficulty: number; again: number; clarity: number; clarityN: number; fairness: number; fairnessN: number; courses: InstructorSummary["courses"] }>();
  for (const r of rows) {
    if (!r.instructor) continue;
    const agg = byName.get(r.instructor) ?? { n: 0, difficulty: 0, again: 0, clarity: 0, clarityN: 0, fairness: 0, fairnessN: 0, courses: [] };
    agg.n += r.n;
    agg.difficulty += r.difficulty * r.n;
    agg.again += r.again * r.n;
    if (typeof r.clarity === "number" && r.clarityN) {
      agg.clarity += r.clarity * r.clarityN;
      agg.clarityN += r.clarityN;
    }
    if (typeof r.fairness === "number" && r.fairnessN) {
      agg.fairness += r.fairness * r.fairnessN;
      agg.fairnessN += r.fairnessN;
    }
    if (r.n >= MIN_VOTES) agg.courses.push({ code: r.code, n: r.n, difficulty: round1(r.difficulty), again: Math.round(r.again * 100) });
    byName.set(r.instructor, agg);
  }
  const out: InstructorSummary[] = [];
  for (const [name, a] of byName) {
    if (a.n < MIN_VOTES_INSTRUCTOR) continue;
    out.push({
      name,
      n: a.n,
      difficulty: round1(a.difficulty / a.n),
      again: Math.round((a.again / a.n) * 100),
      clarity: a.clarityN >= MIN_VOTES_INSTRUCTOR ? round1(a.clarity / a.clarityN) : null,
      fairness: a.fairnessN >= MIN_VOTES_INSTRUCTOR ? round1(a.fairness / a.fairnessN) : null,
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
