// Ders oyları: özetleri okur ve oy gönderir. Servis adresi verilmezse (NEXT_PUBLIC_RATINGS_API boş)
// oylama arayüzü hiç görünmez, site eskisi gibi çalışır.
import { WORKLOAD_LABELS, type CourseSummary } from "./types";

export type { CourseSummary };
export { WORKLOAD_LABELS };

export const RATINGS_API = process.env.NEXT_PUBLIC_RATINGS_API ?? "";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const CACHE_KEY = "oylar:";
const CACHE_MS = 10 * 60 * 1000;
const DEVICE_KEY = "oy-cihaz";

export interface Summaries {
  updatedAt: string;
  courses: Record<string, CourseSummary>;
}

/** Bu tarayıcıya özel rastgele kimlik; aynı dersi ikinci kez oylamayı engellemek için. Kişiye bağlı değildir. */
export function deviceId(): string {
  try {
    const saved = window.localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function readCache(school: string): Summaries | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY + school);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: Summaries };
    if (Date.now() - parsed.at > CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(school: string, data: Summaries) {
  try {
    window.sessionStorage.setItem(CACHE_KEY + school, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* depo kapalı */
  }
}

/** Bütün derslerin özeti; servis kapalıysa ya da ulaşılamazsa null. */
export async function fetchSummaries(school: string): Promise<Summaries | null> {
  if (!RATINGS_API) return null;
  const cached = readCache(school);
  if (cached) return cached;
  try {
    const res = await fetch(`${RATINGS_API}/ratings?school=${encodeURIComponent(school)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Summaries;
    if (!data || typeof data.courses !== "object") return null;
    writeCache(school, data);
    return data;
  } catch {
    return null;
  }
}

export interface VoteBody {
  school: string;
  code: string;
  instructor: string | null;
  difficulty: number;
  workload: number;
  again: boolean;
  turnstile?: string;
}

export type VoteResult = { ok: true; updated: boolean; summary: CourseSummary | null } | { ok: false; error: string };

export async function sendVote(body: VoteBody): Promise<VoteResult> {
  if (!RATINGS_API) return { ok: false, error: "Oylama kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, device }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; updated?: boolean; summary?: CourseSummary | null };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Oy gönderilemedi" };
    // Yeni özet görünsün diye önbellek atılır.
    try {
      window.sessionStorage.removeItem(CACHE_KEY + body.school);
    } catch {
      /* depo kapalı */
    }
    return { ok: true, updated: !!data.updated, summary: data.summary ?? null };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}

const MY_VOTES_KEY = "oylarim";

export interface MyVote {
  difficulty: number;
  workload: number;
  again: boolean;
  instructor: string | null;
}

/** Kendi oyların (yalnızca bu tarayıcıda): formu tekrar açınca dolu gelir. */
export function readMyVotes(): Record<string, MyVote> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(MY_VOTES_KEY) ?? "{}");
    return typeof raw === "object" && raw !== null ? (raw as Record<string, MyVote>) : {};
  } catch {
    return {};
  }
}

export function saveMyVote(code: string, vote: MyVote) {
  try {
    window.localStorage.setItem(MY_VOTES_KEY, JSON.stringify({ ...readMyVotes(), [code]: vote }));
  } catch {
    /* depo kapalı */
  }
}
