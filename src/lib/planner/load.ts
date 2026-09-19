// Dönemlik ders yükü: sepetteki AKTS ile yönetmelikteki üst sınırı karşılaştırır.
// Sınır ortalamaya bağlı (30 / 36 / 42); ortalama bilinmiyorsa uyarı üretilmez.
import type { Course } from "../types";

export interface LoadInfo {
  /** Sepetteki toplam AKTS (bilinmeyen dersler sayılmaz). */
  ects: number;
  /** AKTS'si veride olmayan dersler. */
  unknown: string[];
  /** Yönetmelik sınırı; ortalama bilinmiyorsa null. */
  limit: number | null;
  /** Sınırın dayandığı ortalama. */
  gpa: number | null;
  /** Çift anadal öğrencisi mi (sınırı 42'ye çıkarır). */
  cap: boolean;
}

export function cartLoad(
  cart: readonly string[],
  courses: ReadonlyMap<string, Course>,
  limit: number | null,
  gpa: number | null,
  cap: boolean,
): LoadInfo {
  let ects = 0;
  const unknown: string[] = [];
  for (const code of cart) {
    const course = courses.get(code);
    if (!course) continue;
    if (typeof course.ects === "number") ects += course.ects;
    else unknown.push(code);
  }
  return { ects, unknown, limit, gpa, cap };
}

/** Sınır aşıldıysa gösterilecek cümle; sorun yoksa null. */
export function overloadText(load: LoadInfo): string | null {
  if (load.limit === null || load.ects <= load.limit) return null;
  const extra = load.ects - load.limit;
  const why =
    load.gpa === null
      ? ""
      : load.cap
        ? " (çift anadal öğrencisi olduğun için 42)"
        : ` (ortalaman ${load.gpa.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} olduğu için)`;
  const note = load.unknown.length > 0 ? ` ${load.unknown.join(", ")} dersinin AKTS'si veride yok, bu sayıya girmedi.` : "";
  return `Sepetinde ${load.ects} AKTS var, dönem sınırın ${load.limit} AKTS${why}. ${extra} AKTS fazlasın.${note}`;
}
