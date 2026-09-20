"use client";
// Ders puanları: özetleri okur, oy gönderir. Hoca oylarıyla aynı servis, ayrı uçlar.
import { deviceId, RATINGS_API } from "./client";
import { courseKey, type CourseCriteria, type CourseSummary } from "./course-types";

const CACHE_KEY = "ders-puanlari:";
const CACHE_MS = 10 * 60 * 1000;
const MY_KEY = "oylarim-ders";

export interface CourseSummaries {
  updatedAt: string;
  courses: CourseSummary[];
}

export interface MyCourseVote {
  again: boolean;
  criteria: CourseCriteria;
  comment?: string | null;
}

function readCache(school: string): CourseSummaries | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY + school);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: CourseSummaries };
    if (Date.now() - parsed.at > CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function dropCache(school: string) {
  try {
    window.sessionStorage.removeItem(CACHE_KEY + school);
  } catch {
    /* depo kapalı */
  }
}

/** Sekmedeki kopya; ekranı bekletmeden göstermek için. */
export const cachedCourseSummaries = readCache;

export async function fetchCourseSummaries(school: string): Promise<CourseSummaries | null> {
  if (!RATINGS_API) return null;
  try {
    const res = await fetch(`${RATINGS_API}/courses?school=${encodeURIComponent(school)}`, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as CourseSummaries;
    if (!data || !Array.isArray(data.courses)) return null;
    try {
      window.sessionStorage.setItem(CACHE_KEY + school, JSON.stringify({ at: Date.now(), data }));
    } catch {
      /* depo kapalı */
    }
    return data;
  } catch {
    return null;
  }
}

export type CourseVoteResult =
  | { ok: true; updated: boolean; summary: CourseSummary | null }
  | { ok: false; error: string };

export async function sendCourseVote(
  school: string,
  course: string,
  title: string,
  vote: MyCourseVote,
): Promise<CourseVoteResult> {
  if (!RATINGS_API) return { ok: false, error: "Puanlama kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, course: courseKey(course), title, device, ...vote }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; updated?: boolean; summary?: CourseSummary | null };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Oy gönderilemedi" };
    dropCache(school);
    return { ok: true, updated: !!data.updated, summary: data.summary ?? null };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}

export async function removeCourseVote(school: string, course: string): Promise<{ ok: boolean; summary: CourseSummary | null }> {
  if (!RATINGS_API) return { ok: false, summary: null };
  try {
    const res = await fetch(`${RATINGS_API}/uncourse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, course: courseKey(course), device: deviceId() }),
    });
    const data = (await res.json()) as { ok?: boolean; summary?: CourseSummary | null };
    if (!res.ok || !data.ok) return { ok: false, summary: null };
    forgetMyCourseVote(course);
    dropCache(school);
    return { ok: true, summary: data.summary ?? null };
  } catch {
    return { ok: false, summary: null };
  }
}

export async function reportCourseComment(school: string, course: string, id: string): Promise<boolean> {
  if (!RATINGS_API) return false;
  try {
    const res = await fetch(`${RATINGS_API}/coursereport`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, course: courseKey(course), id, device: deviceId() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Kendi ders oyların (yalnızca bu tarayıcıda), ders anahtarına göre. */
export function readMyCourseVotes(): Record<string, MyCourseVote> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(MY_KEY) ?? "{}");
    return typeof raw === "object" && raw !== null ? (raw as Record<string, MyCourseVote>) : {};
  } catch {
    return {};
  }
}

export function saveMyCourseVote(course: string, vote: MyCourseVote) {
  try {
    window.localStorage.setItem(MY_KEY, JSON.stringify({ ...readMyCourseVotes(), [courseKey(course)]: vote }));
  } catch {
    /* depo kapalı */
  }
}

export function forgetMyCourseVote(course: string) {
  try {
    const all = readMyCourseVotes();
    delete all[courseKey(course)];
    window.localStorage.setItem(MY_KEY, JSON.stringify(all));
  } catch {
    /* depo kapalı */
  }
}
