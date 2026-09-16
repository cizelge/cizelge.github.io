// Çizelge oy servisi (Deno Deploy + Deno KV).
//   GET  /ratings?school=ozyegin  -> ders ve hoca özetleri
//   POST /ratings                 -> oy ver / oyunu değiştir
// Kişisel veri saklanmaz: IP adresi yerine gizli anahtarla karılmış özeti tutulur, ad ve numara istenmez.
//
// Not: Cloudflare workers.dev adresleri Türkiye'den açılmadığı için servis Deno Deploy'da duruyor.
import {
  INSTRUCTOR_CRITERIA,
  MAX_PER_DEVICE,
  MAX_PER_IP_PER_COURSE,
  MAX_PER_IP_PER_DAY,
  parseVote,
  summarize,
  summarizeInstructors,
  type Criteria,
  type Criterion,
  type CourseSummary,
  type InstructorSummary,
  type Row,
} from "./logic.ts";

const DEFAULT_ORIGINS = ["https://cizelge.github.io", "http://localhost:3000"];
const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
/** Özetler bu kadar süre bellekte tutulur. */
const CACHE_MS = 60_000;

interface StoredVote {
  instructor: string | null;
  difficulty: number;
  workload: number;
  again: boolean;
  /** Hocaya ait cevaplar (1-5); eski kayitlarda clarity/fairness ayri alanlardaydi. */
  criteria?: Criteria;
  clarity?: number | null;
  fairness?: number | null;
  at: string;
}

/** Eski ve yeni kayitlari ayni bicimde okur. */
function criteriaOf(v: StoredVote): Criteria {
  const out: Criteria = { ...v.criteria };
  if (!out.clarity && v.clarity) out.clarity = v.clarity;
  if (!out.fairness && v.fairness) out.fairness = v.fairness;
  return out;
}

const kv = await Deno.openKv();

function env(name: string): string | undefined {
  return Deno.env.get(name);
}

function allowedOrigins(): string[] {
  const list = env("ALLOWED_ORIGINS");
  return list ? list.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS;
}

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  // Vary her zaman gider: ara bellekler CORS başlıksız bir cevabı başka adrese vermesin.
  if (!allowedOrigins().includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...init.headers },
  });
}

async function hashIp(ip: string): Promise<string> {
  const salt = env("IP_SALT") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET");
  if (!secret) return true;
  if (typeof token !== "string" || token.length === 0) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** Ortalama biriktirici: (ders) ve (ders, hoca) satırları KV'deki oylardan hesaplanır. */
interface Acc {
  n: number;
  difficulty: number;
  workload: number;
  again: number;
  criteria: Partial<Record<Criterion, { sum: number; n: number }>>;
}

const empty = (): Acc => ({ n: 0, difficulty: 0, workload: 0, again: 0, criteria: {} });

function add(acc: Acc, v: StoredVote) {
  acc.n++;
  acc.difficulty += v.difficulty;
  acc.workload += v.workload;
  acc.again += v.again ? 1 : 0;
  const criteria = criteriaOf(v);
  for (const name of INSTRUCTOR_CRITERIA) {
    const value = criteria[name];
    if (!value) continue;
    const cell = acc.criteria[name] ?? { sum: 0, n: 0 };
    cell.sum += value;
    cell.n++;
    acc.criteria[name] = cell;
  }
}

function toRow(code: string, acc: Acc, instructor?: string): Row {
  const criteria: Row["criteria"] = {};
  for (const name of INSTRUCTOR_CRITERIA) {
    const cell = acc.criteria[name];
    if (cell?.n) criteria[name] = { avg: cell.sum / cell.n, n: cell.n };
  }
  return {
    code,
    instructor,
    n: acc.n,
    difficulty: acc.difficulty / acc.n,
    workload: acc.workload / acc.n,
    again: acc.again / acc.n,
    criteria,
  };
}

interface Cached {
  at: number;
  courses: Record<string, CourseSummary>;
  instructors: InstructorSummary[];
}

const cache = new Map<string, Cached>();

async function getSummaries(school: string, fresh = false): Promise<Cached> {
  const hit = cache.get(school);
  if (hit && !fresh && Date.now() - hit.at < CACHE_MS) return hit;

  const byCourse = new Map<string, Acc>();
  const byInstructor = new Map<string, Acc>();
  for await (const entry of kv.list<StoredVote>({ prefix: ["vote", school] })) {
    const code = String(entry.key[2]);
    const vote = entry.value;
    const course = byCourse.get(code) ?? empty();
    add(course, vote);
    byCourse.set(code, course);
    if (vote.instructor) {
      const key = `${code}|${vote.instructor}`;
      const acc = byInstructor.get(key) ?? empty();
      add(acc, vote);
      byInstructor.set(key, acc);
    }
  }

  const courseRows = [...byCourse].map(([code, acc]) => toRow(code, acc));
  const instructorRows = [...byInstructor].map(([key, acc]) => {
    const cut = key.indexOf("|");
    const [code, instructor] = [key.slice(0, cut), key.slice(cut + 1)];
    return toRow(code, acc, instructor);
  });

  const value: Cached = {
    at: Date.now(),
    courses: summarize(courseRows, instructorRows),
    instructors: summarizeInstructors(instructorRows),
  };
  cache.set(school, value);
  return value;
}

const DAY_MS = 86_400_000;

/** Süresi dolan işaret kayıtlarını sayar (sayaç yerine işaret: kendiliğinden temizlenir). */
async function countMarks(prefix: Deno.KvKey): Promise<number> {
  let n = 0;
  for await (const _ of kv.list({ prefix })) n++;
  return n;
}

async function postVote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseVote(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const vote = parsed.vote;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";
  if (!(await turnstileOk((body as { turnstile?: unknown }).turnstile, ip))) {
    return json({ error: "Doğrulama başarısız, sayfayı yenile" }, { status: 403, headers });
  }
  const ipHash = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  const voteKey = ["vote", vote.school, vote.code, vote.device];
  const existing = await kv.get<StoredVote>(voteKey);

  if (!existing.value) {
    const [device, perCourse, perDay] = await Promise.all([
      countMarks(["device", vote.device]),
      countMarks(["ipcourse", ipHash, vote.school, vote.code]),
      countMarks(["ipday", ipHash, today]),
    ]);
    if (device >= MAX_PER_DEVICE || perCourse >= MAX_PER_IP_PER_COURSE || perDay >= MAX_PER_IP_PER_DAY) {
      return json({ error: "Çok fazla oy gönderildi, daha sonra dene" }, { status: 429, headers });
    }
  }

  const stored: StoredVote = {
    instructor: vote.instructor,
    difficulty: vote.difficulty,
    workload: vote.workload,
    again: vote.again,
    criteria: vote.criteria,
    at: new Date().toISOString(),
  };

  await kv.set(voteKey, stored);
  if (!existing.value) {
    // İşaretler yalnızca yeni oyda yazılır; kendi oyunu değiştirmek sınıra girmez.
    // Süreleri dolunca kendiliğinden silinirler: gün işareti 2 gün, ders işareti 120 gün, cihaz işareti 2 yıl.
    await Promise.all([
      kv.set(["ipday", ipHash, today, vote.device], 1, { expireIn: 2 * DAY_MS }),
      kv.set(["ipcourse", ipHash, vote.school, vote.code, vote.device], 1, { expireIn: 120 * DAY_MS }),
      kv.set(["device", vote.device, vote.school, vote.code], 1, { expireIn: 730 * DAY_MS }),
    ]);
  }

  const summaries = await getSummaries(vote.school, true);
  return json({ ok: true, updated: !!existing.value, summary: summaries.courses[vote.code] ?? null }, { headers });
}

/** Bakım: kötüye kullanılan ya da deneme amaçlı oyları siler. ADMIN_KEY verilmemişse kapalıdır. */
async function deleteVotes(request: Request, url: URL, headers: Record<string, string>): Promise<Response> {
  const adminKey = env("ADMIN_KEY");
  if (!adminKey) return json({ error: "Kapalı" }, { status: 404, headers });
  if (request.headers.get("x-admin-key") !== adminKey) return json({ error: "Yetki yok" }, { status: 403, headers });
  const school = url.searchParams.get("school") ?? "";
  if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
  const code = url.searchParams.get("code");
  const device = url.searchParams.get("device");
  const prefix = code ? ["vote", school, code] : ["vote", school];
  let removed = 0;
  for await (const entry of kv.list({ prefix })) {
    if (device && entry.key[3] !== device) continue;
    await kv.delete(entry.key);
    removed++;
  }
  cache.delete(school);
  return json({ ok: true, removed }, { headers });
}

export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = cors(request);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (url.pathname === "/" ) return json({ ok: true, service: "cizelge-oy" }, { headers });
  if (url.pathname !== "/ratings") return json({ error: "Bulunamadı" }, { status: 404, headers });

  if (request.method === "GET") {
    const school = url.searchParams.get("school") ?? "";
    if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
    const { courses, instructors } = await getSummaries(school);
    return json(
      { school, updatedAt: new Date().toISOString(), courses, instructors },
      { headers: { ...headers, "Cache-Control": "public, max-age=300" } },
    );
  }

  if (request.method === "POST") {
    if (Object.keys(headers).length === 0) return json({ error: "Bu adresten oy kabul edilmiyor" }, { status: 403 });
    return await postVote(request, headers);
  }

  if (request.method === "DELETE") return await deleteVotes(request, url, headers);

  return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
}

// Deno Deploy kendi portunu verir; yerelde PORT ile denenir.
if (import.meta.main) Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8787) }, handler);
