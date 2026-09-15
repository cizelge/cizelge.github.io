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
  return { ok: true, vote: { school, code, instructor: cleanInstructor(b.instructor), difficulty, workload, again: b.again, device } };
}

export interface Row {
  code: string;
  instructor?: string | null;
  n: number;
  difficulty: number;
  workload: number;
  again: number;
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
  instructors?: { name: string; n: number; difficulty: number; again: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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
    (course.instructors ??= []).push({ name: r.instructor, n: r.n, difficulty: round1(r.difficulty), again: Math.round(r.again * 100) });
  }
  for (const course of Object.values(out)) course.instructors?.sort((a, b) => b.n - a.n);
  return out;
}

/** "Zorluk 3,8/5, haftada 5–8 saat, %72 tekrar alır (42 oy)" */
export function describe(s: CourseSummary): string {
  const difficulty = s.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 });
  return `Zorluk ${difficulty}/5, ${WORKLOAD_LABELS[Math.round(s.workload) - 1]}, %${s.again} tekrar alır (${s.n} oy)`;
}
