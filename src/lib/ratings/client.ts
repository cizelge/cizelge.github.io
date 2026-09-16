// Hoca puanları: özetleri okur ve oy gönderir. Servis adresi verilmezse (NEXT_PUBLIC_RATINGS_API boş)
// puanlama arayüzü hiç görünmez, site eskisi gibi çalışır.
import type { Criteria, InstructorSummary } from "./types";

export type { InstructorSummary };

export const RATINGS_API = process.env.NEXT_PUBLIC_RATINGS_API ?? "";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const CACHE_KEY = "puanlar:";
const CACHE_MS = 10 * 60 * 1000;
const DEVICE_KEY = "oy-cihaz";
const MY_VOTES_KEY = "oylarim-hoca";

export interface Summaries {
  updatedAt: string;
  instructors: InstructorSummary[];
}

/** Bu tarayıcıya özel rastgele kimlik; aynı hocayı ikinci kez oylamayı engellemek için. Kişiye bağlı değildir. */
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

/** Bütün hocaların puanı; servis kapalıysa ya da ulaşılamazsa null. */
export async function fetchSummaries(school: string): Promise<Summaries | null> {
  if (!RATINGS_API) return null;
  const cached = readCache(school);
  if (cached) return cached;
  try {
    const res = await fetch(`${RATINGS_API}/ratings?school=${encodeURIComponent(school)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Summaries;
    if (!data || !Array.isArray(data.instructors)) return null;
    writeCache(school, data);
    return data;
  } catch {
    return null;
  }
}

export interface VoteBody {
  school: string;
  /** Hocanın adı, kaynakta yazıldığı gibi. */
  instructor: string;
  slug: string;
  again: boolean;
  criteria: Criteria;
  /** İsteğe bağlı isimsiz yorum. */
  comment?: string | null;
  turnstile?: string;
}

export type VoteResult = { ok: true; updated: boolean; summary: InstructorSummary | null } | { ok: false; error: string };

export async function sendVote(body: VoteBody): Promise<VoteResult> {
  if (!RATINGS_API) return { ok: false, error: "Puanlama kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, device }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; updated?: boolean; summary?: InstructorSummary | null };
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

export interface MyVote {
  again: boolean;
  criteria: Criteria;
  comment?: string | null;
}

/** Kendi oyunu kaldırır; sunucudan ve bu tarayıcıdan siler. */
export async function removeVote(school: string, slug: string): Promise<{ ok: boolean; summary: InstructorSummary | null }> {
  if (!RATINGS_API) return { ok: false, summary: null };
  try {
    const res = await fetch(`${RATINGS_API}/unvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, slug, device: deviceId() }),
    });
    const data = (await res.json()) as { ok?: boolean; summary?: InstructorSummary | null };
    if (!res.ok || !data.ok) return { ok: false, summary: null };
    forgetMyVote(slug);
    try {
      window.sessionStorage.removeItem(CACHE_KEY + school);
    } catch {
      /* depo kapalı */
    }
    return { ok: true, summary: data.summary ?? null };
  } catch {
    return { ok: false, summary: null };
  }
}

/** Yorumu bildir; eşiğe gelince yorum herkesten gizlenir. */
export async function reportComment(school: string, slug: string, id: string): Promise<boolean> {
  if (!RATINGS_API) return false;
  try {
    const res = await fetch(`${RATINGS_API}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, slug, id, device: deviceId() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Kendi oyların (yalnızca bu tarayıcıda), hoca adresine göre. */
export function readMyVotes(): Record<string, MyVote> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(MY_VOTES_KEY) ?? "{}");
    return typeof raw === "object" && raw !== null ? (raw as Record<string, MyVote>) : {};
  } catch {
    return {};
  }
}

export function forgetMyVote(slug: string) {
  try {
    const all = readMyVotes();
    delete all[slug];
    window.localStorage.setItem(MY_VOTES_KEY, JSON.stringify(all));
  } catch {
    /* depo kapalı */
  }
}

export function saveMyVote(slug: string, vote: MyVote) {
  try {
    window.localStorage.setItem(MY_VOTES_KEY, JSON.stringify({ ...readMyVotes(), [slug]: vote }));
  } catch {
    /* depo kapalı */
  }
}
