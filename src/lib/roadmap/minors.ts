// Yandal ders listesini (Minor) yol haritasının ortak gereksinim biçimine çevirir. Saf mantık.
import type { Course, TermData } from "../types";
import type { Minor, PlanPoolCourse, Requirement, RoadmapProgram } from "./types";

/** Havuzdaki bilinen AKTS'lerin yuvarlanmış ortalaması; hiçbiri bilinmiyorsa null. */
export function averagePoolCredits(pool: readonly PlanPoolCourse[]): number | null {
  const known = pool.map((c) => c.credits).filter((c): c is number => c !== null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((a, b) => a + b, 0) / known.length);
}

/**
 * Zorunlular "course", her seçmeli grubu `min` adet "elective" gereksinimi olur.
 * `terms` verilirse ön koşul ve yan koşullar dönem verisinden (en yeni dönem önce) doldurulur.
 * status "unlisted" ise gereksinim listesi boştur.
 */
export function minorRequirements(minor: Minor, terms: readonly TermData[] = []): RoadmapProgram {
  const byCode = new Map<string, Course>();
  // Sonraki dönem öncekini ezer: güncel ön koşul metni kalır.
  for (const term of terms) for (const c of term.courses) byCode.set(c.code, c);

  const requirements: Requirement[] = [];
  if (minor.status === "listed") {
    minor.required.forEach((course, i) => {
      const hit = byCode.get(course.code);
      requirements.push({
        id: `${minor.id}:req:${i}`,
        programId: minor.id,
        kind: "course",
        code: course.code,
        title: course.title,
        credits: course.credits,
        prerequisites: hit?.prerequisites ?? "",
        corequisites: [...(hit?.corequisites ?? [])],
        pool: null,
        slot: null,
      });
    });
    minor.electiveGroups.forEach((group, g) => {
      const credits = averagePoolCredits(group.pool);
      for (let k = 0; k < group.min; k++) {
        requirements.push({
          id: `${minor.id}:sec:${g}:${k}`,
          programId: minor.id,
          kind: "elective",
          code: null,
          title: group.min > 1 ? `${minor.name} Seçmeli ${g + 1} (${k + 1}/${group.min})` : `${minor.name} Seçmeli ${g + 1}`,
          credits,
          prerequisites: "",
          corequisites: [],
          pool: [...group.pool],
          slot: null,
        });
      }
    });
  }

  const totalCredits = requirements.reduce((sum, r) => sum + (r.credits ?? 0), 0);
  return { id: minor.id, kind: "yandal", name: minor.name, requirements, totalCredits };
}
