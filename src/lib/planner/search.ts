import type { Course } from "../types";
import { normalizeCode } from "../engine";

const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");

/** Kod başlangıcı en önce, sonra ad, sonra hoca eşleşmesi. */
export function searchCourses(courses: readonly Course[], query: string, limit = 30): Course[] {
  const q = query.trim();
  if (!q) return [];
  const codeKey = normalizeCode(q);
  const text = fold(q);

  const ranked: { course: Course; rank: number }[] = [];
  for (const course of courses) {
    const code = normalizeCode(course.code);
    let rank = -1;
    if (code === codeKey) rank = 0;
    else if (code.startsWith(codeKey)) rank = 1;
    else if (fold(course.title).includes(text)) rank = 2;
    else if (course.sections.some((s) => s.instructors.some((i) => fold(i).includes(text)))) rank = 3;
    if (rank >= 0) ranked.push({ course, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.course.code.localeCompare(b.course.code, "en"))
    .slice(0, limit)
    .map((r) => r.course);
}
