"use client";
// Not dağılımı servisi ile konuşma. Servis adresi yoksa özellik hiç görünmez.
import { deviceId, RATINGS_API } from "@/lib/ratings/client";
import type { CourseGrades, Letter } from "./types";

const MY_KEY = "notlarim";

export interface MyGrade {
  letter: Letter;
  /** Hoca adres parçası; seçilmediyse null. */
  instructor: string | null;
  term: string;
}

/** Bu tarayıcıdan bildirilen notlar: ders anahtarı -> not. Sunucuda kimlik yok, burada da yok. */
export function readMyGrades(): Record<string, MyGrade> {
  try {
    const raw = window.localStorage.getItem(MY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MyGrade>) : {};
  } catch {
    return {};
  }
}

function writeMyGrades(all: Record<string, MyGrade>) {
  try {
    window.localStorage.setItem(MY_KEY, JSON.stringify(all));
  } catch {
    /* depo kapalı */
  }
}

export function saveMyGrade(course: string, grade: MyGrade) {
  const all = readMyGrades();
  all[course] = grade;
  writeMyGrades(all);
}

export function forgetMyGrade(course: string) {
  const all = readMyGrades();
  delete all[course];
  writeMyGrades(all);
}

export async function fetchCourseGrades(school: string, course: string): Promise<CourseGrades | null> {
  if (!RATINGS_API) return null;
  try {
    const url = `${RATINGS_API}/grades?school=${encodeURIComponent(school)}&course=${encodeURIComponent(course)}`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as { grades?: CourseGrades };
    return data.grades ?? null;
  } catch {
    return null;
  }
}

export type GradeResult = { ok: true; grades: CourseGrades | null } | { ok: false; error: string };

export async function sendGrade(school: string, course: string, grade: MyGrade): Promise<GradeResult> {
  if (!RATINGS_API) return { ok: false, error: "Not dağılımı kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, course, device, letter: grade.letter, instructor: grade.instructor ?? "", term: grade.term }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; grades?: CourseGrades };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Gönderilemedi" };
    return { ok: true, grades: data.grades ?? null };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}

export async function removeGrade(school: string, course: string): Promise<GradeResult> {
  if (!RATINGS_API) return { ok: false, error: "Not dağılımı kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}/ungrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school, course, device }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; grades?: CourseGrades };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Kaldırılamadı" };
    return { ok: true, grades: data.grades ?? null };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}
