import type { Course } from "../types";

/** Büyük/küçük harf ve Türkçe harf farkını yok sayar: "MİM", "mim" ve "MIM" aynı anahtara iner. */
const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");

const foldCode = (s: string) => fold(s).replace(/\s+/g, "");

/** Kod başlangıcı en önce, sonra ad, sonra hoca eşleşmesi. */
export function searchCourses(courses: readonly Course[], query: string, limit = 30): Course[] {
  const q = query.trim();
  if (!q) return [];
  const codeKey = foldCode(q);
  const text = fold(q);

  const ranked: { course: Course; rank: number }[] = [];
  for (const course of courses) {
    const code = foldCode(course.code);
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
