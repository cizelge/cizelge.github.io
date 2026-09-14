// Bölüm müfredatını (Program) yol haritasının ortak gereksinim biçimine çevirir. Saf mantık.
import type { Program } from "../types";
import type { Requirement, RoadmapProgram } from "./types";

export function programRequirements(program: Program, kind: "anadal" | "cap"): RoadmapProgram {
  const requirements: Requirement[] = [];
  for (const sem of program.semesters) {
    sem.items.forEach((item, index) => {
      const base = {
        id: `${program.id}:y${sem.year}-${sem.season}:${index}`,
        programId: program.id,
        credits: item.credits,
        slot: { year: sem.year, season: sem.season },
      };
      if (item.kind === "course") {
        requirements.push({
          ...base,
          kind: "course",
          code: item.code,
          title: item.title,
          prerequisites: item.prerequisites ?? "",
          corequisites: [...(item.corequisites ?? [])],
          pool: null,
        });
      } else {
        requirements.push({
          ...base,
          kind: "elective",
          code: null,
          title: item.label,
          prerequisites: "",
          corequisites: [],
          pool: item.pool ? [...item.pool] : null,
        });
      }
    });
  }

  // Başlıklardaki krediler eksiksizse onlar, değilse satırların toplamı (bilinmeyen 0).
  const headed = program.semesters.length > 0 && program.semesters.every((s) => s.credits !== null);
  const totalCredits = headed
    ? program.semesters.reduce((sum, s) => sum + (s.credits ?? 0), 0)
    : requirements.reduce((sum, r) => sum + (r.credits ?? 0), 0);

  return { id: program.id, kind, name: program.name, requirements, totalCredits };
}
