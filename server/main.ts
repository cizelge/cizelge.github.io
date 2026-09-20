// OzuHelper hoca puanlama servisi (Deno Deploy + Deno KV).
//   GET    /ratings?school=ozyegin  -> hoca puanları
//   POST   /ratings                 -> oy ver / oyunu değiştir
//   DELETE /ratings?school=...      -> bakım (ADMIN_KEY ile)
//   GET    /grades?school=&course=  -> bir dersin not dağılımı
//   POST   /grades                  -> kendi harf notunu bildir / değiştir
//   POST   /ungrade                 -> kendi bildirimini kaldır
//   GET    /notes?school=&course=   -> ders notu bağlantıları
//   POST   /notes                   -> bağlantı paylaş
//   POST   /unnote                  -> kendi bağlantını kaldır
//   POST   /notereport              -> bağlantıyı bildir
//   GET    /courses?school=         -> ders puanları
//   POST   /courses                 -> derse oy ver
//   POST   /uncourse                -> ders oyunu kaldır
//   POST   /coursereport            -> ders yorumunu bildir
//   POST   /feedback                -> öneri, hata, veri düzeltme mesajı
//   GET    /feedback?school=        -> gelen mesajlar (ADMIN_KEY ile)
// Kişisel veri saklanmaz: IP adresi yerine gizli anahtarla karılmış özeti tutulur, ad ve numara istenmez.
//
// Not: Cloudflare workers.dev adresleri Türkiye'den açılmadığı için servis Deno Deploy'da duruyor.
import {
  HIDE_AFTER_REPORTS,
  INSTRUCTOR_CRITERIA,
  MAX_PER_DEVICE,
  MAX_PER_IP_PER_DAY,
  MAX_PER_IP_PER_INSTRUCTOR,
  overallScore,
  parseVote,
  summarize,
  type Comment,
  type Criteria,
  type Criterion,
  type InstructorSummary,
  type Row,
} from "./logic.ts";
import {
  MAX_GRADES_PER_DEVICE,
  MAX_GRADES_PER_IP_PER_COURSE,
  MAX_GRADES_PER_IP_PER_DAY,
  parseGrade,
  summarizeCourse,
  type CourseGrades,
  type GradeRow,
  type Letter,
} from "./grades.ts";
import {
  HIDE_AFTER_REPORTS as NOTE_HIDE_AFTER,
  MAX_NOTES_PER_DEVICE_COURSE,
  MAX_NOTES_PER_IP_PER_DAY,
  parseNote,
  sortNotes,
  type NoteKind,
  type NoteRow,
} from "./notes.ts";
import {
  COURSE_CRITERIA,
  courseScore,
  MAX_COURSE_VOTES_PER_IP_PER_DAY,
  MAX_COURSES_PER_DEVICE,
  MAX_PER_IP_PER_COURSE,
  parseCourseVote,
  summarizeCourses,
  type CourseComment,
  type CourseCriteria,
  type CourseCriterion,
  type CourseRow,
  type CourseSummary,
} from "./courses.ts";
import {
  FEEDBACK_DAYS,
  KIND_LABEL,
  MAX_FEEDBACK_PER_IP_PER_DAY,
  parseFeedback,
  type FeedbackKind,
} from "./feedback.ts";

const DEFAULT_ORIGINS = ["https://ozuhelper.github.io", "https://cizelge.github.io", "http://localhost:3000"];
const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
/** Özetler bu kadar süre bellekte tutulur. */
const CACHE_MS = 60_000;
const DAY_MS = 86_400_000;

interface StoredVote {
  name: string;
  again: boolean;
  criteria: Criteria;
  /** İsteğe bağlı isimsiz yorum. */
  comment?: string | null;
  at: string;
}

interface StoredGrade {
  letter: Letter;
  instructor: string | null;
  term: string;
  at: string;
}

interface StoredNote {
  url: string;
  title: string;
  kind: NoteKind;
  term: string | null;
  instructor: string | null;
  device: string;
  at: string;
}

/** Cihaz kimliğinden geri çevrilemez kısa kimlik: yorumu bildirmek ve güncellemek için. */
async function commentId(device: string, slug: string): Promise<string> {
  const data = new TextEncoder().encode(`${slug}|${device}|${env("IP_SALT") ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

/** Ortalama biriktirici: hoca satırları KV'deki oylardan hesaplanır. */
interface Acc {
  name: string;
  n: number;
  again: number;
  criteria: Partial<Record<Criterion, { sum: number; n: number }>>;
  comments: Comment[];
}

function add(acc: Acc, v: StoredVote) {
  acc.n++;
  acc.again += v.again ? 1 : 0;
  acc.name = v.name || acc.name;
  for (const name of INSTRUCTOR_CRITERIA) {
    const value = v.criteria?.[name];
    if (!value) continue;
    const cell = acc.criteria[name] ?? { sum: 0, n: 0 };
    cell.sum += value;
    cell.n++;
    acc.criteria[name] = cell;
  }
}

function toRow(slug: string, acc: Acc): Row {
  const criteria: Row["criteria"] = {};
  for (const name of INSTRUCTOR_CRITERIA) {
    const cell = acc.criteria[name];
    if (cell?.n) criteria[name] = { avg: cell.sum / cell.n, n: cell.n };
  }
  return { slug, name: acc.name, n: acc.n, again: acc.again / acc.n, criteria, comments: acc.comments };
}

interface Cached {
  at: number;
  instructors: InstructorSummary[];
}

const cache = new Map<string, Cached>();

async function getSummaries(school: string, fresh = false): Promise<Cached> {
  const hit = cache.get(school);
  if (hit && !fresh && Date.now() - hit.at < CACHE_MS) return hit;

  // Çok bildirilen yorumlar gizlenir.
  const hidden = new Set<string>();
  for await (const entry of kv.list({ prefix: ["reported", school] })) hidden.add(`${String(entry.key[2])}|${String(entry.key[3])}`);

  const bySlug = new Map<string, Acc>();
  for await (const entry of kv.list<StoredVote>({ prefix: ["vote", school] })) {
    const slug = String(entry.key[2]);
    const device = String(entry.key[3]);
    const acc = bySlug.get(slug) ?? { name: "", n: 0, again: 0, criteria: {}, comments: [] };
    add(acc, entry.value);
    const text = entry.value.comment;
    if (text) {
      const id = await commentId(device, slug);
      if (!hidden.has(`${slug}|${id}`)) {
        acc.comments.push({ id, text, at: entry.value.at, again: entry.value.again, score: overallScore(entry.value.criteria ?? {}) });
      }
    }
    bySlug.set(slug, acc);
  }

  const value: Cached = { at: Date.now(), instructors: summarize([...bySlug].map(([slug, acc]) => toRow(slug, acc))) };
  cache.set(school, value);
  return value;
}

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
  const voteKey = ["vote", vote.school, vote.slug, vote.device];
  const existing = await kv.get<StoredVote>(voteKey);

  if (!existing.value) {
    const [device, perInstructor, perDay] = await Promise.all([
      countMarks(["device", vote.device]),
      countMarks(["ipteacher", ipHash, vote.school, vote.slug]),
      countMarks(["ipday", ipHash, today]),
    ]);
    if (device >= MAX_PER_DEVICE || perInstructor >= MAX_PER_IP_PER_INSTRUCTOR || perDay >= MAX_PER_IP_PER_DAY) {
      return json({ error: "Çok fazla oy gönderildi, daha sonra dene" }, { status: 429, headers });
    }
  }

  const stored: StoredVote = {
    name: vote.instructor,
    again: vote.again,
    criteria: vote.criteria,
    comment: vote.comment,
    at: new Date().toISOString(),
  };
  await kv.set(voteKey, stored);
  if (!existing.value) {
    // İşaretler yalnızca yeni oyda yazılır; kendi oyunu değiştirmek sınıra girmez.
    // Süreleri dolunca kendiliğinden silinirler: gün işareti 2 gün, hoca işareti 120 gün, cihaz işareti 2 yıl.
    await Promise.all([
      kv.set(["ipday", ipHash, today, vote.device], 1, { expireIn: 2 * DAY_MS }),
      kv.set(["ipteacher", ipHash, vote.school, vote.slug, vote.device], 1, { expireIn: 120 * DAY_MS }),
      kv.set(["device", vote.device, vote.school, vote.slug], 1, { expireIn: 730 * DAY_MS }),
    ]);
  }

  const summaries = await getSummaries(vote.school, true);
  return json({ ok: true, updated: !!existing.value, summary: summaries.instructors.find((i) => i.slug === vote.slug) ?? null }, { headers });
}

/** Kendi oyunu kaldır: cihaz kimliği eşleşen kayıt silinir. */
async function removeVote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const slug = typeof b.slug === "string" ? b.slug : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[a-z0-9-]{1,80}$/.test(slug) || device.length < 16) {
    return json({ error: "İstek geçersiz" }, { status: 400, headers });
  }
  const key = ["vote", school, slug, device];
  const existing = await kv.get<StoredVote>(key);
  if (!existing.value) return json({ ok: true, removed: 0, summary: null }, { headers });
  await kv.delete(key);
  const summaries = await getSummaries(school, true);
  return json({ ok: true, removed: 1, summary: summaries.instructors.find((i) => i.slug === slug) ?? null }, { headers });
}

/** Yorumu bildir: aynı cihaz bir yorumu bir kez bildirir, eşiğe gelince yorum gizlenir. */
async function reportComment(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const slug = typeof b.slug === "string" ? b.slug : "";
  const id = typeof b.id === "string" ? b.id : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[a-z0-9-]{1,80}$/.test(slug) || !/^[0-9a-f]{12}$/.test(id) || device.length < 16) {
    return json({ error: "Bildirim geçersiz" }, { status: 400, headers });
  }
  await kv.set(["report", school, slug, id, device], 1, { expireIn: 365 * DAY_MS });
  let reports = 0;
  for await (const _ of kv.list({ prefix: ["report", school, slug, id] })) reports++;
  if (reports >= HIDE_AFTER_REPORTS) {
    await kv.set(["reported", school, slug, id], 1);
    cache.delete(school);
  }
  return json({ ok: true, reports, hidden: reports >= HIDE_AFTER_REPORTS }, { headers });
}

/** Bir dersin bütün bildirimleri; özet KV'den her seferinde okunur (ders başına az kayıt olur). */
async function courseGrades(school: string, course: string): Promise<CourseGrades> {
  const rows: GradeRow[] = [];
  for await (const entry of kv.list<StoredGrade>({ prefix: ["grade", school, course] })) {
    const v = entry.value;
    if (v?.letter && v.term) rows.push({ letter: v.letter, instructor: v.instructor ?? null, term: v.term });
  }
  return summarizeCourse(course, rows);
}

/** Kendi harf notunu bildir; aynı ders için ikinci bildirim eskisinin üstüne yazar. */
async function postGrade(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseGrade(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const grade = parsed.grade;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";
  const ipHash = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  const key = ["grade", grade.school, grade.course, grade.device];
  const existing = await kv.get<StoredGrade>(key);

  if (!existing.value) {
    const [device, perCourse, perDay] = await Promise.all([
      countMarks(["gdevice", grade.device]),
      countMarks(["gipcourse", ipHash, grade.school, grade.course]),
      countMarks(["gipday", ipHash, today]),
    ]);
    if (device >= MAX_GRADES_PER_DEVICE || perCourse >= MAX_GRADES_PER_IP_PER_COURSE || perDay >= MAX_GRADES_PER_IP_PER_DAY) {
      return json({ error: "Çok fazla bildirim gönderildi, daha sonra dene" }, { status: 429, headers });
    }
  }

  const stored: StoredGrade = { letter: grade.letter, instructor: grade.instructor, term: grade.term, at: new Date().toISOString() };
  await kv.set(key, stored);
  if (!existing.value) {
    await Promise.all([
      kv.set(["gipday", ipHash, today, grade.course], 1, { expireIn: 2 * DAY_MS }),
      kv.set(["gipcourse", ipHash, grade.school, grade.course, grade.device], 1, { expireIn: 120 * DAY_MS }),
      kv.set(["gdevice", grade.device, grade.school, grade.course], 1, { expireIn: 730 * DAY_MS }),
    ]);
  }
  return json({ ok: true, updated: !!existing.value, grades: await courseGrades(grade.school, grade.course) }, { headers });
}

/** Kendi not bildirimini kaldır. */
async function removeGrade(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = typeof b.course === "string" ? b.course.replace(/\s+/g, "").toUpperCase() : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[A-Z0-9]{3,12}$/.test(course) || device.length < 16) {
    return json({ error: "İstek geçersiz" }, { status: 400, headers });
  }
  const key = ["grade", school, course, device];
  const existing = await kv.get<StoredGrade>(key);
  if (existing.value) await kv.delete(key);
  return json({ ok: true, removed: existing.value ? 1 : 0, grades: await courseGrades(school, course) }, { headers });
}

/** Bir dersin bağlantıları; çok bildirilenler gizlenir. `device` verilirse kendi kayıtları işaretlenir. */
async function courseNotes(school: string, course: string, device = ""): Promise<NoteRow[]> {
  const hidden = new Set<string>();
  for await (const entry of kv.list({ prefix: ["notehidden", school, course] })) hidden.add(String(entry.key[3]));

  const rows: NoteRow[] = [];
  for await (const entry of kv.list<StoredNote>({ prefix: ["note", school, course] })) {
    const id = String(entry.key[3]);
    const v = entry.value;
    if (!v?.url || hidden.has(id)) continue;
    rows.push({
      id,
      url: v.url,
      title: v.title,
      kind: v.kind,
      term: v.term ?? null,
      instructor: v.instructor ?? null,
      at: v.at,
      mine: device !== "" && v.device === device,
    });
  }
  return sortNotes(rows);
}

/** Ders notu bağlantısı paylaş. */
async function postNote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseNote(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const note = parsed.note;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";
  const ipHash = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  const [mine, perDay] = await Promise.all([
    countMarks(["ndevice", note.device, note.school, note.course]),
    countMarks(["nipday", ipHash, today]),
  ]);
  if (mine >= MAX_NOTES_PER_DEVICE_COURSE) {
    return json({ error: `Bu derse en fazla ${MAX_NOTES_PER_DEVICE_COURSE} bağlantı ekleyebilirsin` }, { status: 429, headers });
  }
  if (perDay >= MAX_NOTES_PER_IP_PER_DAY) {
    return json({ error: "Bugünlük bağlantı sınırına geldin" }, { status: 429, headers });
  }

  // Aynı bağlantı ikinci kez eklenmesin.
  for await (const entry of kv.list<StoredNote>({ prefix: ["note", note.school, note.course] })) {
    if (entry.value?.url === note.url) return json({ error: "Bu bağlantı zaten paylaşılmış" }, { status: 409, headers });
  }

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const stored: StoredNote = {
    url: note.url,
    title: note.title,
    kind: note.kind,
    term: note.term,
    instructor: note.instructor,
    device: note.device,
    at: new Date().toISOString(),
  };
  await kv.set(["note", note.school, note.course, id], stored);
  await Promise.all([
    kv.set(["ndevice", note.device, note.school, note.course, id], 1, { expireIn: 730 * DAY_MS }),
    kv.set(["nipday", ipHash, today, id], 1, { expireIn: 2 * DAY_MS }),
  ]);
  return json({ ok: true, notes: await courseNotes(note.school, note.course, note.device) }, { headers });
}

/** Kendi bağlantını kaldır. */
async function removeNote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = typeof b.course === "string" ? b.course.replace(/\s+/g, "").toUpperCase() : "";
  const id = typeof b.id === "string" ? b.id : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[A-Z0-9]{3,12}$/.test(course) || !/^[0-9a-f]{12}$/.test(id) || device.length < 16) {
    return json({ error: "İstek geçersiz" }, { status: 400, headers });
  }
  const key = ["note", school, course, id];
  const existing = await kv.get<StoredNote>(key);
  // Yalnızca ekleyen cihaz kaldırabilir.
  if (existing.value && existing.value.device === device) {
    await kv.delete(key);
    await kv.delete(["ndevice", device, school, course, id]);
  }
  return json({ ok: true, notes: await courseNotes(school, course, device) }, { headers });
}

/** Bağlantıyı bildir: yeterince bildirim alınca gizlenir. */
async function reportNote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = typeof b.course === "string" ? b.course.replace(/\s+/g, "").toUpperCase() : "";
  const id = typeof b.id === "string" ? b.id : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[A-Z0-9]{3,12}$/.test(course) || !/^[0-9a-f]{12}$/.test(id) || device.length < 16) {
    return json({ error: "Bildirim geçersiz" }, { status: 400, headers });
  }
  await kv.set(["notereport", school, course, id, device], 1, { expireIn: 365 * DAY_MS });
  let reports = 0;
  for await (const _ of kv.list({ prefix: ["notereport", school, course, id] })) reports++;
  const hidden = reports >= NOTE_HIDE_AFTER;
  if (hidden) await kv.set(["notehidden", school, course, id], 1);
  return json({ ok: true, reports, hidden, notes: await courseNotes(school, course, device) }, { headers });
}

/** Ders oyu biriktirici. */
interface CourseAcc {
  title: string;
  n: number;
  again: number;
  criteria: Partial<Record<CourseCriterion, { sum: number; n: number }>>;
  comments: CourseComment[];
}

interface StoredCourseVote {
  title: string;
  again: boolean;
  criteria: CourseCriteria;
  comment?: string | null;
  at: string;
}

const courseCache = new Map<string, { at: number; courses: CourseSummary[] }>();

/** Bütün derslerin puanları; hoca özetleriyle aynı düzen. */
async function getCourseSummaries(school: string, fresh = false): Promise<CourseSummary[]> {
  const hit = courseCache.get(school);
  if (hit && !fresh && Date.now() - hit.at < CACHE_MS) return hit.courses;

  const hidden = new Set<string>();
  for await (const entry of kv.list({ prefix: ["creported", school] })) hidden.add(`${String(entry.key[2])}|${String(entry.key[3])}`);

  const byCourse = new Map<string, CourseAcc>();
  for await (const entry of kv.list<StoredCourseVote>({ prefix: ["cvote", school] })) {
    const course = String(entry.key[2]);
    const device = String(entry.key[3]);
    const v = entry.value;
    if (!v) continue;
    const acc = byCourse.get(course) ?? { title: "", n: 0, again: 0, criteria: {}, comments: [] };
    acc.n++;
    acc.again += v.again ? 1 : 0;
    acc.title = v.title || acc.title;
    for (const name of COURSE_CRITERIA) {
      const value = v.criteria?.[name];
      if (!value) continue;
      const cell = acc.criteria[name] ?? { sum: 0, n: 0 };
      cell.sum += value;
      cell.n++;
      acc.criteria[name] = cell;
    }
    if (v.comment) {
      const id = await commentId(device, course);
      if (!hidden.has(`${course}|${id}`)) {
        acc.comments.push({ id, text: v.comment, at: v.at, again: v.again, score: courseScore(v.criteria ?? {}) });
      }
    }
    byCourse.set(course, acc);
  }

  const rows: CourseRow[] = [...byCourse].map(([course, acc]) => {
    const criteria: CourseRow["criteria"] = {};
    for (const name of COURSE_CRITERIA) {
      const cell = acc.criteria[name];
      if (cell?.n) criteria[name] = { avg: cell.sum / cell.n, n: cell.n };
    }
    return { course, title: acc.title, n: acc.n, again: acc.again / acc.n, criteria, comments: acc.comments };
  });

  const courses = summarizeCourses(rows);
  courseCache.set(school, { at: Date.now(), courses });
  return courses;
}

/** Derse oy ver ya da oyunu değiştir. */
async function postCourseVote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseCourseVote(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const vote = parsed.vote;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";
  if (!(await turnstileOk((body as { turnstile?: unknown }).turnstile, ip))) {
    return json({ error: "Doğrulama başarısız, sayfayı yenile" }, { status: 403, headers });
  }
  const ipHash = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  const key = ["cvote", vote.school, vote.course, vote.device];
  const existing = await kv.get<StoredCourseVote>(key);

  if (!existing.value) {
    const [device, perCourse, perDay] = await Promise.all([
      countMarks(["cdevice", vote.device]),
      countMarks(["cipcourse", ipHash, vote.school, vote.course]),
      countMarks(["cipday", ipHash, today]),
    ]);
    if (device >= MAX_COURSES_PER_DEVICE || perCourse >= MAX_PER_IP_PER_COURSE || perDay >= MAX_COURSE_VOTES_PER_IP_PER_DAY) {
      return json({ error: "Çok fazla oy gönderildi, daha sonra dene" }, { status: 429, headers });
    }
  }

  const stored: StoredCourseVote = {
    title: vote.title,
    again: vote.again,
    criteria: vote.criteria,
    comment: vote.comment,
    at: new Date().toISOString(),
  };
  await kv.set(key, stored);
  if (!existing.value) {
    await Promise.all([
      kv.set(["cipday", ipHash, today, vote.course], 1, { expireIn: 2 * DAY_MS }),
      kv.set(["cipcourse", ipHash, vote.school, vote.course, vote.device], 1, { expireIn: 120 * DAY_MS }),
      kv.set(["cdevice", vote.device, vote.school, vote.course], 1, { expireIn: 730 * DAY_MS }),
    ]);
  }

  const courses = await getCourseSummaries(vote.school, true);
  return json(
    { ok: true, updated: !!existing.value, summary: courses.find((c) => c.course === vote.course) ?? null },
    { headers },
  );
}

/** Kendi ders oyunu kaldır. */
async function removeCourseVote(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = typeof b.course === "string" ? b.course.replace(/\s+/g, "").toUpperCase() : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[A-Z0-9]{3,12}$/.test(course) || device.length < 16) {
    return json({ error: "İstek geçersiz" }, { status: 400, headers });
  }
  const key = ["cvote", school, course, device];
  const existing = await kv.get<StoredCourseVote>(key);
  if (!existing.value) return json({ ok: true, removed: 0, summary: null }, { headers });
  await kv.delete(key);
  const courses = await getCourseSummaries(school, true);
  return json({ ok: true, removed: 1, summary: courses.find((c) => c.course === course) ?? null }, { headers });
}

/** Ders yorumunu bildir. */
async function reportCourseComment(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = typeof b.course === "string" ? b.course.replace(/\s+/g, "").toUpperCase() : "";
  const id = typeof b.id === "string" ? b.id : "";
  const device = typeof b.device === "string" ? b.device : "";
  if (!SCHOOL_RE.test(school) || !/^[A-Z0-9]{3,12}$/.test(course) || !/^[0-9a-f]{12}$/.test(id) || device.length < 16) {
    return json({ error: "Bildirim geçersiz" }, { status: 400, headers });
  }
  await kv.set(["creport", school, course, id, device], 1, { expireIn: 365 * DAY_MS });
  let reports = 0;
  for await (const _ of kv.list({ prefix: ["creport", school, course, id] })) reports++;
  if (reports >= HIDE_AFTER_REPORTS) {
    await kv.set(["creported", school, course, id], 1);
    courseCache.delete(school);
  }
  return json({ ok: true, reports, hidden: reports >= HIDE_AFTER_REPORTS }, { headers });
}

interface StoredFeedback {
  kind: FeedbackKind;
  message: string;
  contact: string | null;
  page: string | null;
  at: string;
}

/**
 * Geri bildirimi e-postayla iletir. RESEND_KEY ve FEEDBACK_TO tanımlı değilse hiçbir şey yapmaz;
 * mesaj her hâlükârda veritabanına yazılır, e-posta yalnızca haber vermek içindir.
 */
async function mailFeedback(school: string, stored: StoredFeedback): Promise<void> {
  const key = env("RESEND_KEY");
  const to = env("FEEDBACK_TO");
  if (!key || !to) return;
  const from = env("FEEDBACK_FROM") ?? "OzuHelper <onboarding@resend.dev>";
  const lines = [
    `Konu: ${KIND_LABEL[stored.kind]}`,
    `Okul: ${school}`,
    stored.page ? `Sayfa: ${stored.page}` : null,
    stored.contact ? `İletişim: ${stored.contact}` : "İletişim bırakılmamış",
    "",
    stored.message,
  ].filter((l) => l !== null);
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[OzuHelper] ${KIND_LABEL[stored.kind]}: ${stored.message.slice(0, 60)}`,
        text: lines.join("\n"),
        ...(stored.contact ? { reply_to: stored.contact } : {}),
      }),
    });
  } catch {
    // E-posta gitmezse mesaj yine de kayıtlı; sessizce geçilir.
  }
}

/** Geri bildirim gönder. Kimlik istenmez; iletişim bilgisi yazan kişi isterse eklenir. */
async function postFeedback(request: Request, headers: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseFeedback(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const feedback = parsed.feedback;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "0.0.0.0";
  const ipHash = await hashIp(ip);
  const today = new Date().toISOString().slice(0, 10);
  if ((await countMarks(["fipday", ipHash, today])) >= MAX_FEEDBACK_PER_IP_PER_DAY) {
    return json({ error: "Bugünlük mesaj sınırına geldin" }, { status: 429, headers });
  }

  const at = new Date().toISOString();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const stored: StoredFeedback = {
    kind: feedback.kind,
    message: feedback.message,
    contact: feedback.contact,
    page: feedback.page,
    at,
  };
  // Anahtarda zaman var: yeniden eskiye okumak için.
  await kv.set(["feedback", feedback.school, at, id], stored, { expireIn: FEEDBACK_DAYS * DAY_MS });
  await kv.set(["fipday", ipHash, today, id], 1, { expireIn: 2 * DAY_MS });
  // Kayıt tamam; e-posta sadece haber verir, gitmezse istek yine başarılıdır.
  await mailFeedback(feedback.school, stored);
  return json({ ok: true }, { headers });
}

/** Gelen mesajları oku. Yalnızca ADMIN_KEY ile. */
async function getFeedback(request: Request, url: URL, headers: Record<string, string>): Promise<Response> {
  const adminKey = env("ADMIN_KEY");
  if (!adminKey) return json({ error: "Kapalı" }, { status: 404, headers });
  if (request.headers.get("x-admin-key") !== adminKey) return json({ error: "Yetki yok" }, { status: 403, headers });
  const school = url.searchParams.get("school") ?? "";
  if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });

  const items: (StoredFeedback & { id: string })[] = [];
  for await (const entry of kv.list<StoredFeedback>({ prefix: ["feedback", school] })) {
    if (entry.value) items.push({ ...entry.value, id: String(entry.key[3]) });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return json({ ok: true, count: items.length, items }, { headers });
}

/** Bakım: kötüye kullanılan ya da deneme amaçlı oyları siler. ADMIN_KEY verilmemişse kapalıdır. */
async function deleteVotes(request: Request, url: URL, headers: Record<string, string>): Promise<Response> {
  const adminKey = env("ADMIN_KEY");
  if (!adminKey) return json({ error: "Kapalı" }, { status: 404, headers });
  if (request.headers.get("x-admin-key") !== adminKey) return json({ error: "Yetki yok" }, { status: 403, headers });
  const school = url.searchParams.get("school") ?? "";
  if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
  const slug = url.searchParams.get("slug");
  const device = url.searchParams.get("device");
  let removed = 0;

  // all=1: oylar, yorumlar, bildirimler ve sınır işaretleri dahil her şey silinir (sıfırdan başlamak için).
  if (url.searchParams.get("all") === "1") {
    for (const prefix of [
      ["vote"], ["report"], ["reported"], ["ipteacher"], ["ipday"], ["device"],
      ["grade"], ["gipcourse"], ["gipday"], ["gdevice"],
      ["note"], ["notereport"], ["notehidden"], ["ndevice"], ["nipday"],
      ["cvote"], ["creport"], ["creported"], ["cdevice"], ["cipcourse"], ["cipday"],
      ["feedback"], ["fipday"],
    ]) {
      for await (const entry of kv.list({ prefix })) {
        await kv.delete(entry.key);
        removed++;
      }
    }
    cache.clear();
    return json({ ok: true, removed, wiped: true }, { headers });
  }

  const prefix = slug ? ["vote", school, slug] : ["vote", school];
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
  if (url.pathname === "/") return json({ ok: true, service: "ozuhelper-oy" }, { headers });
  if (url.pathname === "/unvote" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten istek kabul edilmiyor" }, { status: 403, headers });
    return await removeVote(request, headers);
  }
  if (url.pathname === "/report" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten bildirim kabul edilmiyor" }, { status: 403, headers });
    return await reportComment(request, headers);
  }
  if (url.pathname === "/ungrade" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten istek kabul edilmiyor" }, { status: 403, headers });
    return await removeGrade(request, headers);
  }
  if (url.pathname === "/feedback") {
    if (request.method === "GET") return await getFeedback(request, url, headers);
    if (request.method === "POST") {
      if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten mesaj kabul edilmiyor" }, { status: 403, headers });
      return await postFeedback(request, headers);
    }
    return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
  }
  if (url.pathname === "/uncourse" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten istek kabul edilmiyor" }, { status: 403, headers });
    return await removeCourseVote(request, headers);
  }
  if (url.pathname === "/coursereport" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten bildirim kabul edilmiyor" }, { status: 403, headers });
    return await reportCourseComment(request, headers);
  }
  if (url.pathname === "/courses") {
    if (request.method === "GET") {
      const school = url.searchParams.get("school") ?? "";
      if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
      return json(
        { school, updatedAt: new Date().toISOString(), courses: await getCourseSummaries(school) },
        { headers: { ...headers, "Cache-Control": "private, max-age=60" } },
      );
    }
    if (request.method === "POST") {
      if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten oy kabul edilmiyor" }, { status: 403, headers });
      return await postCourseVote(request, headers);
    }
    return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
  }
  if (url.pathname === "/unnote" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten istek kabul edilmiyor" }, { status: 403, headers });
    return await removeNote(request, headers);
  }
  if (url.pathname === "/notereport" && request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten bildirim kabul edilmiyor" }, { status: 403, headers });
    return await reportNote(request, headers);
  }
  if (url.pathname === "/notes") {
    if (request.method === "GET") {
      const school = url.searchParams.get("school") ?? "";
      const course = (url.searchParams.get("course") ?? "").replace(/\s+/g, "").toUpperCase();
      const device = url.searchParams.get("device") ?? "";
      if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
      if (!/^[A-Z0-9]{3,12}$/.test(course)) return json({ error: "Ders kodu geçersiz" }, { status: 400, headers });
      return json(
        { school, course, notes: await courseNotes(school, course, device) },
        { headers: { ...headers, "Cache-Control": "private, max-age=60" } },
      );
    }
    if (request.method === "POST") {
      if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten paylaşım kabul edilmiyor" }, { status: 403, headers });
      return await postNote(request, headers);
    }
    return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
  }
  if (url.pathname === "/grades") {
    if (request.method === "GET") {
      const school = url.searchParams.get("school") ?? "";
      const course = (url.searchParams.get("course") ?? "").replace(/\s+/g, "").toUpperCase();
      if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
      if (!/^[A-Z0-9]{3,12}$/.test(course)) return json({ error: "Ders kodu geçersiz" }, { status: 400, headers });
      return json(
        { school, updatedAt: new Date().toISOString(), grades: await courseGrades(school, course) },
        { headers: { ...headers, "Cache-Control": "private, max-age=60" } },
      );
    }
    if (request.method === "POST") {
      if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten bildirim kabul edilmiyor" }, { status: 403, headers });
      return await postGrade(request, headers);
    }
    return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
  }
  if (url.pathname !== "/ratings") return json({ error: "Bulunamadı" }, { status: 404, headers });

  if (request.method === "GET") {
    const school = url.searchParams.get("school") ?? "";
    if (!SCHOOL_RE.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
    const { instructors } = await getSummaries(school);
    return json(
      { school, updatedAt: new Date().toISOString(), instructors },
      // Cevap adrese göre değişir; ortak ara bellekte tutulmasın.
      { headers: { ...headers, "Cache-Control": "private, max-age=60" } },
    );
  }

  if (request.method === "POST") {
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "Bu adresten oy kabul edilmiyor" }, { status: 403, headers });
    return await postVote(request, headers);
  }

  if (request.method === "DELETE") return await deleteVotes(request, url, headers);

  return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
}

// Deno Deploy kendi portunu verir; yerelde PORT ile denenir.
if (import.meta.main) Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8787) }, handler);
