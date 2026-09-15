// Çizelge oy servisi (Cloudflare Worker + D1).
//   GET  /ratings?school=ozyegin  -> ders özetleri (5 dk önbellekli)
//   POST /ratings                 -> oy ver / oyunu değiştir
// Kişisel veri saklanmaz: IP adresi yerine gizli anahtarla karılmış özeti tutulur, ad ve öğrenci numarası istenmez.
import {
  MAX_PER_DEVICE,
  MAX_PER_IP_PER_COURSE,
  MAX_PER_IP_PER_DAY,
  parseVote,
  summarize,
  type Row,
} from "./logic";

interface Env {
  DB: D1Database;
  /** IP özetini karmak için; `wrangler secret put IP_SALT`. */
  IP_SALT: string;
  /** Virgülle ayrılmış izinli adresler. */
  ALLOWED_ORIGINS?: string;
  /** Varsa Turnstile doğrulaması yapılır. */
  TURNSTILE_SECRET?: string;
}

const DEFAULT_ORIGINS = ["https://cizelge.github.io", "http://localhost:3000"];

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS;
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...init.headers },
  });
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function turnstileOk(env: Env, token: unknown, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== "string" || token.length === 0) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function getSummaries(env: Env, school: string) {
  const courses = await env.DB.prepare(
    `SELECT code, COUNT(*) AS n, AVG(difficulty) AS difficulty, AVG(workload) AS workload, AVG(again) AS again
       FROM votes WHERE school = ? GROUP BY code`,
  )
    .bind(school)
    .all<Row>();
  const instructors = await env.DB.prepare(
    `SELECT code, instructor, COUNT(*) AS n, AVG(difficulty) AS difficulty, AVG(workload) AS workload, AVG(again) AS again
       FROM votes WHERE school = ? AND instructor IS NOT NULL GROUP BY code, instructor`,
  )
    .bind(school)
    .all<Row>();
  return summarize(courses.results ?? [], instructors.results ?? []);
}

async function postVote(request: Request, env: Env, headers: Record<string, string>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Gövde okunamadı" }, { status: 400, headers });
  }
  const parsed = parseVote(body);
  if (!parsed.ok) return json({ error: parsed.error }, { status: 400, headers });
  const vote = parsed.vote;

  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  if (!(await turnstileOk(env, (body as { turnstile?: unknown }).turnstile, ip))) {
    return json({ error: "Doğrulama başarısız, sayfayı yenile" }, { status: 403, headers });
  }
  const ipHash = await hashIp(ip, env.IP_SALT);
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  // Bu cihazın bu derse verdiği oy varsa güncelleme sayılır, sınırlara takılmaz.
  const existing = await env.DB.prepare(`SELECT id FROM votes WHERE school = ? AND code = ? AND device = ?`)
    .bind(vote.school, vote.code, vote.device)
    .first<{ id: number }>();

  if (!existing) {
    const limits = await env.DB.batch<{ n: number }>([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM votes WHERE device = ?`).bind(vote.device),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ? AND school = ? AND code = ?`).bind(ipHash, vote.school, vote.code),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ? AND created_at > ?`).bind(ipHash, dayAgo),
    ]);
    const [device, perCourse, perDay] = limits.map((r) => r.results?.[0]?.n ?? 0);
    if (device >= MAX_PER_DEVICE || perCourse >= MAX_PER_IP_PER_COURSE || perDay >= MAX_PER_IP_PER_DAY) {
      return json({ error: "Çok fazla oy gönderildi, daha sonra dene" }, { status: 429, headers });
    }
  }

  await env.DB.prepare(
    `INSERT INTO votes (school, code, instructor, difficulty, workload, again, device, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(school, code, device) DO UPDATE SET
       instructor = excluded.instructor, difficulty = excluded.difficulty, workload = excluded.workload,
       again = excluded.again, ip_hash = excluded.ip_hash, created_at = excluded.created_at`,
  )
    .bind(vote.school, vote.code, vote.instructor, vote.difficulty, vote.workload, vote.again ? 1 : 0, vote.device, ipHash, now)
    .run();

  const row = await env.DB.prepare(
    `SELECT code, COUNT(*) AS n, AVG(difficulty) AS difficulty, AVG(workload) AS workload, AVG(again) AS again
       FROM votes WHERE school = ? AND code = ?`,
  )
    .bind(vote.school, vote.code)
    .first<Row>();
  return json({ ok: true, updated: !!existing, summary: row ? summarize([row])[vote.code] ?? null : null }, { headers });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = cors(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname !== "/ratings") return json({ error: "Bulunamadı" }, { status: 404, headers });

    if (request.method === "GET") {
      const school = url.searchParams.get("school") ?? "";
      if (!/^[a-z][a-z0-9-]{1,30}$/.test(school)) return json({ error: "Okul geçersiz" }, { status: 400, headers });
      const summaries = await getSummaries(env, school);
      return json(
        { school, updatedAt: new Date().toISOString(), courses: summaries },
        { headers: { ...headers, "Cache-Control": "public, max-age=300" } },
      );
    }

    if (request.method === "POST") {
      if (Object.keys(headers).length === 0) return json({ error: "Bu adresten oy kabul edilmiyor" }, { status: 403 });
      return postVote(request, env, headers);
    }

    return json({ error: "Yöntem desteklenmiyor" }, { status: 405, headers });
  },
};

export default worker;
