// Oy servisi: doğrulama ve özetleme. Oylar hoca başınadır (ders başına değil).
// Cloudflare'a bağımlı değil, testleri logic.test.ts içinde.

/** Hocaya sorulan, hepsi 1-5 ve hepsi isteğe bağlı kriterler. */
export const INSTRUCTOR_CRITERIA = ["clarity", "fairness", "helpful", "attendance"] as const;
export type Criterion = (typeof INSTRUCTOR_CRITERIA)[number];
export type Criteria = Partial<Record<Criterion, number>>;

/** Puanlar ilk oydan itibaren görünür; oy sayısı her zaman yanında yazar. */
export const MIN_VOTES = 1;
/** Bir cihazın oy verebileceği en fazla hoca (kötüye kullanım sınırı). */
export const MAX_PER_DEVICE = 60;
/** Aynı ağdan (IP) bir hoca için en fazla oy. */
export const MAX_PER_IP_PER_INSTRUCTOR = 4;
/** Aynı ağdan günde en fazla oy. */
export const MAX_PER_IP_PER_DAY = 40;

export interface VoteInput {
  school: string;
  /** Hocanın adı, kaynakta yazıldığı gibi. */
  instructor: string;
  /** Adres parçası: "emre-sefer". Kayıt anahtarı budur. */
  slug: string;
  /** Baştan seçse yine bu hocadan alır mıydı. */
  again: boolean;
  criteria: Criteria;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; vote: VoteInput };

const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
  const instructor = cleanInstructor(b.instructor);
  const device = typeof b.device === "string" ? b.device : "";

  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!SLUG_RE.test(slug) || slug.length > 80) return { ok: false, error: "Hoca adresi geçersiz" };
  if (!instructor) return { ok: false, error: "Hoca adı eksik" };
  if (typeof b.again !== "boolean") return { ok: false, error: "Yine alır mıydın eksik" };
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };

  const given = (typeof b.criteria === "object" && b.criteria !== null ? b.criteria : {}) as Record<string, unknown>;
  const criteria: Criteria = {};
  for (const name of INSTRUCTOR_CRITERIA) {
    const raw = given[name];
    if (raw === null || raw === undefined) continue;
    const value = intInRange(raw, 1, 5);
    if (value === null) return { ok: false, error: `${name} 1-5 olmalı` };
    criteria[name] = value;
  }

  return { ok: true, vote: { school, instructor, slug, again: b.again, criteria, device } };
}

/** Bir kriterin ortalaması ve kaç kişinin cevapladığı. */
export interface Scored {
  avg: number;
  n: number;
}

export interface Row {
  slug: string;
  name: string;
  n: number;
  /** Yine alırım diyenlerin oranı (0-1). */
  again: number;
  criteria?: Partial<Record<Criterion, Scored>>;
}

export interface InstructorSummary {
  slug: string;
  name: string;
  n: number;
  /** Yine alırım diyenlerin yüzdesi. */
  again: number;
  /** Cevaplanan kriterler, tek ondalıkla. */
  criteria: Criteria;
  /** Kriterlerin ortalaması (yoklama hariç); cevap yoksa null. */
  score: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Genel puan: anlatım, notlandırma ve yardımseverliğin ortalaması. Yoklama iyi/kötü değil, dışarıda. */
export function overallScore(criteria: Criteria): number | null {
  const parts = [criteria.clarity, criteria.fairness, criteria.helpful].filter((v): v is number => typeof v === "number");
  return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

export function summarize(rows: readonly Row[]): InstructorSummary[] {
  const out: InstructorSummary[] = [];
  for (const r of rows) {
    if (r.n < MIN_VOTES) continue;
    const criteria: Criteria = {};
    for (const name of INSTRUCTOR_CRITERIA) {
      const value = r.criteria?.[name];
      if (value?.n) criteria[name] = round1(value.avg);
    }
    out.push({ slug: r.slug, name: r.name, n: r.n, again: Math.round(r.again * 100), criteria, score: overallScore(criteria) });
  }
  return out.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "tr"));
}
